import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit-treasury
 *
 * Compares on-chain VIBESTR Transfer events landing in the treasury wallet
 * against KV `tx:<hash>:processed` records. Surfaces:
 *
 *   - on-chain incoming amount (gross)
 *   - KV recorded amount (what the admin dashboard sums)
 *   - the diff (= VIBESTR that hit treasury but is unrecorded)
 *   - the orphan tx list (tx hash, from wallet, amount, timestamp, reason)
 *
 * Uses Etherscan's `tokentx` action. Set ETHERSCAN_API_KEY for the free
 * tier (without it, the call will still run but is severely rate-limited
 * and may return an error). The audit is read-only — it never modifies KV.
 */

const VIBESTR_ADDRESS = "0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196".toLowerCase();
const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "").toLowerCase();
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

interface EtherscanTokenTx {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;            // raw wei-style integer string
    tokenDecimal: string;
    contractAddress: string;
}

interface OrphanTx {
    txHash: string;
    fromWallet: string;
    amount: number;
    timestamp: number;        // unix seconds
    reason: "no_kv_record" | "missing_amount" | "amount_mismatch";
    kvRecordedAmount?: number;
}

async function fetchTreasuryTransfers(): Promise<{ txs: EtherscanTokenTx[]; error?: string }> {
    if (!TREASURY_ADDRESS) return { txs: [], error: "Treasury address not configured" };
    // Etherscan deprecated V1 — every V1 endpoint now returns
    // `NOTOK (You are using a deprecated V1 endpoint…)` even when an
    // API key is supplied. V2 uses a single multi-chain URL with an
    // explicit `chainid` param (mainnet = 1). API key is now required.
    // Migration ref: https://docs.etherscan.io/v2-migration
    if (!ETHERSCAN_API_KEY) {
        return {
            txs: [],
            error: "ETHERSCAN_API_KEY not set (required as of Etherscan V2). Free-tier key works.",
        };
    }

    // Etherscan pages — max 10k per page. The treasury is comfortably
    // under 10k incoming txs (sub-1k as of writing), so one page is enough.
    // Bump page handling later if we ever cross that.
    const params = new URLSearchParams({
        chainid: "1",
        module: "account",
        action: "tokentx",
        contractaddress: VIBESTR_ADDRESS,
        address: TREASURY_ADDRESS,
        startblock: "0",
        endblock: "99999999",
        sort: "asc",
        page: "1",
        offset: "10000",
        apikey: ETHERSCAN_API_KEY,
    });
    const url = `https://api.etherscan.io/v2/api?${params.toString()}`;

    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return { txs: [], error: `Etherscan HTTP ${res.status}` };
        const data = await res.json();
        if (data.status !== "1" && data.message !== "No transactions found") {
            return { txs: [], error: `Etherscan: ${data.message || "unknown"} (${data.result || ""})` };
        }
        const all = (data.result as EtherscanTokenTx[]) ?? [];
        // Only INCOMING transfers (to=treasury) — Etherscan's address filter
        // returns both directions; we want inflows only for spend accounting.
        const inflows = all.filter(t => t.to?.toLowerCase() === TREASURY_ADDRESS);
        return { txs: inflows };
    } catch (e) {
        return { txs: [], error: e instanceof Error ? e.message : "fetch failed" };
    }
}

/** Convert Etherscan's wei-style integer string + decimals to a float. */
function rawToFloat(raw: string, decimals: number): number {
    if (!raw) return 0;
    if (decimals <= 0) return Number(raw);
    if (raw.length <= decimals) {
        return Number(`0.${raw.padStart(decimals, "0")}`);
    }
    const whole = raw.slice(0, raw.length - decimals);
    const frac = raw.slice(raw.length - decimals);
    return Number(`${whole}.${frac}`);
}

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!TREASURY_ADDRESS) {
        return NextResponse.json({ error: "NEXT_PUBLIC_TREASURY_ADDRESS not set" }, { status: 500 });
    }

    const { txs: onchainTxs, error: fetchError } = await fetchTreasuryTransfers();
    if (fetchError) {
        return NextResponse.json({
            error: `Failed to fetch on-chain data: ${fetchError}`,
            hint: ETHERSCAN_API_KEY
                ? "Etherscan API call failed — try again."
                : "Set ETHERSCAN_API_KEY env var to use the audit (free tier works).",
        }, { status: 503 });
    }

    let onchainTotal = 0;
    let kvRecordedTotal = 0;
    const orphans: OrphanTx[] = [];

    for (const tx of onchainTxs) {
        const decimals = Number(tx.tokenDecimal) || 18;
        const amount = rawToFloat(tx.value, decimals);
        onchainTotal += amount;

        const txKey = `tx:${tx.hash.toLowerCase()}:processed`;
        const raw = await kv.get(txKey);

        if (!raw) {
            orphans.push({
                txHash: tx.hash.toLowerCase(),
                fromWallet: tx.from.toLowerCase(),
                amount,
                timestamp: Number(tx.timeStamp),
                reason: "no_kv_record",
            });
            continue;
        }

        let parsed: { amount?: string; status?: string } | null = null;
        try {
            parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as { amount?: string; status?: string });
        } catch {
            // Bad record — treat as missing for accounting purposes
            orphans.push({
                txHash: tx.hash.toLowerCase(),
                fromWallet: tx.from.toLowerCase(),
                amount,
                timestamp: Number(tx.timeStamp),
                reason: "no_kv_record",
            });
            continue;
        }

        // Pending reservations have no amount set — count as orphan since
        // they don't contribute to the admin total either.
        if (!parsed || parsed.status === "pending" || !parsed.amount) {
            orphans.push({
                txHash: tx.hash.toLowerCase(),
                fromWallet: tx.from.toLowerCase(),
                amount,
                timestamp: Number(tx.timeStamp),
                reason: "missing_amount",
            });
            continue;
        }

        const kvAmount = parseFloat(parsed.amount);
        kvRecordedTotal += Number.isFinite(kvAmount) ? kvAmount : 0;

        // Mismatch (e.g. partial recording) — flag for review
        if (Number.isFinite(kvAmount) && Math.abs(kvAmount - amount) > 0.01) {
            orphans.push({
                txHash: tx.hash.toLowerCase(),
                fromWallet: tx.from.toLowerCase(),
                amount,
                timestamp: Number(tx.timeStamp),
                reason: "amount_mismatch",
                kvRecordedAmount: kvAmount,
            });
        }
    }

    // Group orphans by from-wallet so admin can refund in one transaction
    // per recipient. Numbers are floats here — fine for display, the actual
    // refund command should re-source amount strings via parseUnits.
    const orphansByWallet = new Map<string, { wallet: string; total: number; count: number; txs: OrphanTx[] }>();
    for (const o of orphans) {
        const entry = orphansByWallet.get(o.fromWallet);
        if (entry) {
            entry.total += o.amount;
            entry.count += 1;
            entry.txs.push(o);
        } else {
            orphansByWallet.set(o.fromWallet, {
                wallet: o.fromWallet,
                total: o.amount,
                count: 1,
                txs: [o],
            });
        }
    }
    const walletGroups = Array.from(orphansByWallet.values())
        .sort((a, b) => b.total - a.total);

    const diff = onchainTotal - kvRecordedTotal;

    return NextResponse.json({
        treasuryAddress: TREASURY_ADDRESS,
        contractAddress: VIBESTR_ADDRESS,
        onchainTransferCount: onchainTxs.length,
        onchainTotal: Number(onchainTotal.toFixed(2)),
        kvRecordedTotal: Number(kvRecordedTotal.toFixed(2)),
        unaccountedAmount: Number(diff.toFixed(2)),
        orphanCount: orphans.length,
        orphansByWallet: walletGroups.map(g => ({
            wallet: g.wallet,
            txCount: g.count,
            totalAmount: Number(g.total.toFixed(2)),
            txs: g.txs.map(t => ({
                ...t,
                amount: Number(t.amount.toFixed(2)),
                kvRecordedAmount: t.kvRecordedAmount !== undefined ? Number(t.kvRecordedAmount.toFixed(2)) : undefined,
            })),
        })),
        notes: [
            "onchainTotal = sum of all incoming VIBESTR Transfer events to treasury",
            "kvRecordedTotal = sum of tx:*:processed records' amount field for recorded inflows",
            "unaccountedAmount = treasury received this much VIBESTR with no matching record (or with a corrupted record)",
            "Refund the orphansByWallet[].totalAmount to each wallet to make the player whole.",
        ],
    });
}
