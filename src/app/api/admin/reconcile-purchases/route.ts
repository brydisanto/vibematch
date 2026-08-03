/**
 * GET /api/admin/reconcile-purchases
 *
 * Vercel Cron target. Reconciles on-chain treasury inflows that never
 * landed as tx:<hash>:processed records — the "user paid on-chain but
 * the client never POSTed to the server" failure mode (mobile Safari
 * tab suspension, WalletConnect deep-link into a killed tab, user
 * closed the modal before polling finished, etc.).
 *
 * For each treasury inflow with no matching KV record:
 *   1. Look up the sender wallet in the wallet→username reverse index.
 *   2. Match the amount to a bonus-game package at the current pricing
 *      snapshot (±20% tolerance for VIBESTR, ±5% for USDC).
 *   3. If matched, tracker cap allows, and user linked: create the tx
 *      record + increment bonusPrizeGames on today's daily tracker.
 *   4. Otherwise log a reason (unlinked wallet, amount mismatch, cap
 *      exceeded) into `reconcile_log:<setKey>` for admin review.
 *
 * NOT reconciled automatically:
 *   - Reroll txs (require a burn plan the reconciler doesn't have)
 *   - ETH-rail purchases (would need a separate Etherscan API path)
 *
 * Auth: Bearer CRON_SECRET, same as /api/admin/pricing/refresh.
 */

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
    getPricingSnapshot,
    VIBESTR_TOKEN_ADDRESS,
    USDC_TOKEN_ADDRESS,
    type PricingPackageId,
} from '@/lib/pricing';
import { getDailyTracker, getTodayKey, MAX_BONUS_PRIZE_GAMES_PER_DAY } from '@/app/api/pinbook/route';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '').toLowerCase();
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

const VIBESTR_ADDRESS = VIBESTR_TOKEN_ADDRESS.toLowerCase();
const USDC_ADDRESS = USDC_TOKEN_ADDRESS.toLowerCase();

// VIBESTR pricing floats day-to-day, so accept ±20% amount tolerance.
const VIBESTR_TOLERANCE = 0.20;
// USDC is 1:1 with USD; only tiny tolerance for rounding.
const USDC_TOLERANCE = 0.02;
// ETH amount is derived from ETH/USD at purchase time; the reconcile
// snapshot may be a few hours stale, so allow for intraday price drift.
// The 1/5/10 packages are 5x apart, so a 10% band can't confuse sizes.
const ETH_TOLERANCE = 0.10;

type Rail = 'vibestr' | 'usdc' | 'eth';

// How many blocks back to scan on each run — 24h at ~7000 blocks/day
// gives us plenty of headroom for a cron running hourly, and avoids
// re-processing the entire chain history on every run.
const SCAN_BLOCK_WINDOW = 8000;

interface EtherscanTokenTx {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    tokenDecimal?: string;
    // Present on `txlist` (native ETH) rows, absent on `tokentx` rows.
    isError?: string;
    input?: string;
}

interface ReconcileResult {
    txHash: string;
    from: string;
    rail: Rail;
    amountRaw: string;
    outcome:
        | { status: 'credited'; username: string; packageSize: number }
        | { status: 'refund_queued'; username: string; packageSize: number; reason: string }
        | { status: 'unresolved'; reason: string }
        | { status: 'skipped'; reason: string; username?: string };
}

const amountToStr = (amountRaw: string, rail: Rail) =>
    (Number(amountRaw) / (rail === 'usdc' ? 1e6 : 1e18)).toString();

/**
 * Over-cap payment: the user paid but crediting would exceed the daily cap.
 * Instead of skipping forever (silent loss), persist a purchase_refund entry
 * for admin resolution (credit-over-cap or VIBESTR refund) and finalize the tx
 * record with refund_pending so it stops being re-scanned every run.
 */
async function queuePurchaseRefund(
    txHash: string, from: string, username: string, packageSize: number,
    amountRaw: string, rail: Rail, timeStampMs: number, reason: string,
): Promise<void> {
    await kv.set(`purchase_refund:${txHash}`, JSON.stringify({
        username, wallet: from, txHash, packageSize,
        amount: amountToStr(amountRaw, rail), rail, reason,
        createdAt: Date.now(), status: 'pending_admin_credit',
    }));
    await kv.set(`tx:${txHash}:processed`, JSON.stringify({
        status: 'finalized', type: 'purchase', username, wallet: from, packageSize,
        amount: amountToStr(amountRaw, rail), paymentRail: rail, timestamp: timeStampMs,
        refund_pending: true, refund_reason: reason,
    }));
}

/**
 * A treasury inflow we can't auto-credit (wallet not linked to any account, or
 * amount doesn't match a purchase package — e.g. a reroll payment from an
 * unlinked wallet). Persist it so it surfaces in the admin panel for manual
 * identification instead of vanishing. Idempotent per tx hash.
 */
async function recordUnresolved(
    txHash: string, from: string, rail: Rail, amountRaw: string, reason: string, timeStampMs: number,
): Promise<void> {
    const key = `unresolved_payment:${txHash}`;
    if (await kv.get(key)) return;
    await kv.set(key, JSON.stringify({
        txHash, from, rail, amount: amountToStr(amountRaw, rail),
        reason, paidAt: timeStampMs, firstSeen: Date.now(), status: 'unresolved',
    }));
}

function authorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const auth = req.headers.get('authorization') || '';
    return auth === `Bearer ${secret}`;
}

async function fetchTokenTransfers(tokenAddress: string, startBlock: number): Promise<EtherscanTokenTx[]> {
    if (!ETHERSCAN_API_KEY || !TREASURY_ADDRESS) return [];
    const params = new URLSearchParams({
        chainid: '1',
        module: 'account',
        action: 'tokentx',
        contractaddress: tokenAddress,
        address: TREASURY_ADDRESS,
        startblock: String(startBlock),
        endblock: '99999999',
        sort: 'desc',
        page: '1',
        offset: '1000',
        apikey: ETHERSCAN_API_KEY,
    });
    const res = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json() as { status: string; result: EtherscanTokenTx[] | string };
    if (json.status !== '1' || !Array.isArray(json.result)) return [];
    return json.result.filter(t => t.to.toLowerCase() === TREASURY_ADDRESS);
}

/**
 * Native ETH transfers into the treasury (Etherscan `txlist`). MetaMask
 * mobile users frequently pay the ETH rail, and a mobile wallet round-trip
 * can strand the confirmation before the client POSTs to us — so these
 * need the same reconcile safety net the token rails already have.
 * Keep only successful, plain value transfers (input == 0x): a contract
 * call to the treasury would have a data payload and isn't a purchase.
 */
async function fetchNativeTransfers(startBlock: number): Promise<EtherscanTokenTx[]> {
    if (!ETHERSCAN_API_KEY || !TREASURY_ADDRESS) return [];
    const params = new URLSearchParams({
        chainid: '1',
        module: 'account',
        action: 'txlist',
        address: TREASURY_ADDRESS,
        startblock: String(startBlock),
        endblock: '99999999',
        sort: 'desc',
        page: '1',
        offset: '1000',
        apikey: ETHERSCAN_API_KEY,
    });
    const res = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json() as { status: string; result: EtherscanTokenTx[] | string };
    if (json.status !== '1' || !Array.isArray(json.result)) return [];
    return json.result.filter(t =>
        t.to.toLowerCase() === TREASURY_ADDRESS &&
        t.value !== '0' &&
        (t.isError ?? '0') === '0' &&
        (t.input ?? '0x') === '0x'
    );
}

async function getCurrentBlock(): Promise<number> {
    if (!ETHERSCAN_API_KEY) return 0;
    const params = new URLSearchParams({
        chainid: '1',
        module: 'proxy',
        action: 'eth_blockNumber',
        apikey: ETHERSCAN_API_KEY,
    });
    try {
        const res = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json() as { result?: string };
        return parseInt(json.result || '0x0', 16);
    } catch {
        return 0;
    }
}

/**
 * Build wallet→username reverse map by scanning user:* keys.
 * Runs once per reconcile pass; the map size (~1000 users) makes this
 * cheap enough that maintaining a persistent index isn't worth the
 * complexity yet.
 */
async function buildWalletMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let cursor = '0';
    do {
        const scan = await kv.scan(cursor, { match: 'user:*', count: 500 }) as [string, string[]];
        cursor = scan[0];
        const keys = scan[1];
        if (keys.length === 0) continue;
        const values = await kv.mget(...keys) as Array<{ walletAddress?: string; linkedWallets?: string[] } | null>;
        keys.forEach((k, i) => {
            const v = values[i];
            // key is user:<username>
            const username = k.slice('user:'.length).toLowerCase();
            // Map the current wallet AND every wallet the user has linked, so a
            // payment from a vault/second wallet still resolves to the account.
            const primary = v?.walletAddress?.toLowerCase();
            if (primary) map.set(primary, username);
            if (Array.isArray(v?.linkedWallets)) {
                for (const lw of v!.linkedWallets) {
                    const x = String(lw).toLowerCase();
                    if (x) map.set(x, username);
                }
            }
        });
    } while (cursor !== '0');
    return map;
}

/**
 * Try to match a paid amount to a package at the current pricing
 * snapshot. Returns the package id + size, or null if no match within
 * tolerance.
 */
function railWei(entry: { vibestrWei: string; usdcWei: string; ethWei: string }, rail: Rail): string {
    return rail === 'vibestr' ? entry.vibestrWei : rail === 'usdc' ? entry.usdcWei : entry.ethWei;
}

function matchPackage(
    rail: Rail,
    amountWei: bigint,
    snapshot: Awaited<ReturnType<typeof getPricingSnapshot>>,
): { packageId: PricingPackageId; packageSize: number } | null {
    const candidates: Array<{ id: PricingPackageId; size: number; requiredWei: bigint }> = [
        { id: 'prize-games-1', size: 1, requiredWei: BigInt(railWei(snapshot.packages['prize-games-1'], rail)) },
        { id: 'prize-games-5', size: 5, requiredWei: BigInt(railWei(snapshot.packages['prize-games-5'], rail)) },
        { id: 'prize-games-10', size: 10, requiredWei: BigInt(railWei(snapshot.packages['prize-games-10'], rail)) },
    ];
    const tolerance = rail === 'vibestr' ? VIBESTR_TOLERANCE : rail === 'usdc' ? USDC_TOLERANCE : ETH_TOLERANCE;
    // Match the LARGEST package that's within tolerance and ≤ amount + tol.
    // Sort desc by size so we credit the biggest matching package.
    candidates.sort((a, b) => b.size - a.size);
    for (const c of candidates) {
        const required = c.requiredWei;
        if (required <= BigInt(0)) continue;
        // Convert to floats for tolerance comparison — safe since amounts are small
        const amountF = Number(amountWei);
        const requiredF = Number(required);
        const ratio = amountF / requiredF;
        if (ratio >= 1 - tolerance && ratio <= 1 + tolerance) {
            return { packageId: c.id, packageSize: c.size };
        }
    }
    return null;
}

async function reconcileTx(
    tx: EtherscanTokenTx,
    rail: Rail,
    walletMap: Map<string, string>,
    snapshot: Awaited<ReturnType<typeof getPricingSnapshot>>,
): Promise<ReconcileResult> {
    const txHash = tx.hash.toLowerCase();
    const from = tx.from.toLowerCase();
    const amountRaw = tx.value;
    const base = { txHash, from, rail, amountRaw };

    const timeStampMs = Number(tx.timeStamp) * 1000;
    const username = walletMap.get(from);
    if (!username) {
        // Not a known wallet (e.g. a reroll paid from a wallet the user never
        // linked). Persist it so it surfaces for manual review instead of
        // silently skipping every run.
        await recordUnresolved(txHash, from, rail, amountRaw, 'wallet not linked to any user', timeStampMs);
        return { ...base, outcome: { status: 'unresolved', reason: 'wallet not linked to any user' } };
    }

    const match = matchPackage(rail, BigInt(amountRaw), snapshot);
    if (!match) {
        // Linked wallet but not a purchase amount (often a reroll payment).
        await recordUnresolved(txHash, from, rail, amountRaw, `amount ${amountToStr(amountRaw, rail)} ${rail} matches no purchase package`, timeStampMs);
        return { ...base, outcome: { status: 'unresolved', reason: `amount does not match any package`, } };
    }

    // Per-user lock so we don't race a live purchase flow.
    const lockKey = `lock:purchase:${username}`;
    const gotLock = await kv.set(lockKey, '1', { nx: true, ex: 30 });
    if (!gotLock) {
        return { ...base, outcome: { status: 'skipped', reason: 'user has an in-flight purchase; will retry next run', username } };
    }

    try {
        // Re-check tx record inside the lock — another process may
        // have reconciled it in the interim.
        const existing = await kv.get(`tx:${txHash}:processed`);
        if (existing) {
            return { ...base, outcome: { status: 'skipped', reason: 'tx record appeared during lock acquisition', username } };
        }

        // Re-check tracker inside the lock — a live purchase or another
        // reconciler pass may have updated it.
        const trackerFresh = await getDailyTracker(username);
        const currentBonus = trackerFresh.bonusPrizeGames || 0;
        const bonusFresh = currentBonus + match.packageSize;
        if (bonusFresh > MAX_BONUS_PRIZE_GAMES_PER_DAY) {
            // Paid over the daily cap. Queue a refund for admin resolution
            // (credit-over-cap or refund) rather than skipping it forever.
            const reason = `daily cap exceeded (${currentBonus}+${match.packageSize} > ${MAX_BONUS_PRIZE_GAMES_PER_DAY})`;
            await queuePurchaseRefund(txHash, from, username, match.packageSize, amountRaw, rail, Number(tx.timeStamp) * 1000, reason);
            return { ...base, outcome: { status: 'refund_queued', username, packageSize: match.packageSize, reason } };
        }

        // Grant games.
        const dailyKey = getTodayKey(username);
        await kv.set(dailyKey, { ...trackerFresh, bonusPrizeGames: bonusFresh }, { ex: 86400 * 2 });

        // Write the tx record. Match the shape of the live purchase route
        // so downstream analytics don't need to special-case reconciled
        // records — just the reconciled_by/at fields tell the admin.
        await kv.set(`tx:${txHash}:processed`, JSON.stringify({
            status: 'finalized',
            username,
            wallet: from,
            packageSize: match.packageSize,
            amount: (Number(amountRaw) / (rail === 'usdc' ? 1e6 : 1e18)).toString(),
            paymentRail: rail,
            timestamp: Number(tx.timeStamp) * 1000,
            reconciled_by: 'cron',
            reconciled_at: Date.now(),
        }));

        return { ...base, outcome: { status: 'credited', username, packageSize: match.packageSize } };
    } finally {
        await kv.del(lockKey);
    }
}

export async function GET(req: Request) {
    // Bearer CRON_SECRET (Vercel cron) or an admin session (manual run).
    let ok = authorized(req);
    if (!ok) ok = !!(await requireAdmin(req));
    if (!ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!TREASURY_ADDRESS) {
        return NextResponse.json({ error: 'Treasury address not configured' }, { status: 500 });
    }
    if (!ETHERSCAN_API_KEY) {
        return NextResponse.json({ error: 'ETHERSCAN_API_KEY not set' }, { status: 500 });
    }

    const currentBlock = await getCurrentBlock();
    const startBlock = currentBlock > SCAN_BLOCK_WINDOW ? currentBlock - SCAN_BLOCK_WINDOW : 0;

    const [vibestrTxs, usdcTxs, ethTxs] = await Promise.all([
        fetchTokenTransfers(VIBESTR_ADDRESS, startBlock),
        fetchTokenTransfers(USDC_ADDRESS, startBlock),
        fetchNativeTransfers(startBlock),
    ]);

    // Filter down to orphans (no KV record yet). Batch mget the tx keys.
    const allTxs: Array<{ rail: Rail; tx: EtherscanTokenTx }> = [
        ...vibestrTxs.map(tx => ({ rail: 'vibestr' as const, tx })),
        ...usdcTxs.map(tx => ({ rail: 'usdc' as const, tx })),
        ...ethTxs.map(tx => ({ rail: 'eth' as const, tx })),
    ];
    if (allTxs.length === 0) {
        return NextResponse.json({ scanned: 0, credited: 0, skipped: 0, results: [] });
    }
    const txKeys = allTxs.map(({ tx }) => `tx:${tx.hash.toLowerCase()}:processed`);
    const existingRecords = await kv.mget(...txKeys);
    const orphans = allTxs.filter((_, i) => existingRecords[i] === null || existingRecords[i] === undefined);

    if (orphans.length === 0) {
        return NextResponse.json({
            scanned: allTxs.length,
            orphans: 0,
            credited: 0,
            skipped: 0,
            results: [],
        });
    }

    // Build wallet map + fetch pricing snapshot once, reuse across all reconciliations.
    const [walletMap, snapshot] = await Promise.all([
        buildWalletMap(),
        getPricingSnapshot(),
    ]);

    const results: ReconcileResult[] = [];
    for (const { tx, rail } of orphans) {
        const result = await reconcileTx(tx, rail, walletMap, snapshot);
        results.push(result);
    }

    const credited = results.filter(r => r.outcome.status === 'credited').length;
    const refundQueued = results.filter(r => r.outcome.status === 'refund_queued').length;
    const unresolved = results.filter(r => r.outcome.status === 'unresolved').length;
    const skipped = results.filter(r => r.outcome.status === 'skipped').length;

    // Surface the outstanding queues (over-cap refunds awaiting a decision +
    // unidentified payments) so the admin panel can show them without a
    // separate scan. Small sets, cheap to enumerate.
    const [refundEntries, unresolvedEntries] = await Promise.all([
        enumerate('purchase_refund:*', o => o?.status === 'pending_admin_credit'),
        enumerate('unresolved_payment:*', o => o?.status === 'unresolved'),
    ]);

    // Log this pass for admin review + future analysis.
    try {
        await kv.zadd(`reconcile_log`, {
            score: Date.now(),
            member: JSON.stringify({
                at: Date.now(), scanned: allTxs.length, orphans: orphans.length,
                credited, refundQueued, unresolved, skipped, results: results.slice(0, 100),
            }),
        });
    } catch (e) {
        console.error('[Reconcile] log write failed:', e);
    }

    console.log(`[Reconcile] scanned=${allTxs.length} orphans=${orphans.length} credited=${credited} refundQueued=${refundQueued} unresolved=${unresolved} skipped=${skipped}`);

    return NextResponse.json({
        scanned: allTxs.length,
        orphans: orphans.length,
        credited, refundQueued, unresolved, skipped,
        pendingRefunds: refundEntries,
        unresolvedPayments: unresolvedEntries,
        results,
    });
}

/** Scan a key pattern and return parsed entries matching a predicate. */
async function enumerate(pattern: string, pred: (o: any) => boolean): Promise<any[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const [next, batch] = (await kv.scan(cursor, { match: pattern, count: 200 })) as [string | number, string[]];
        cursor = next;
        keys.push(...batch);
    } while (cursor !== 0 && cursor !== '0');
    if (keys.length === 0) return [];
    const vals = await kv.mget(...keys);
    return vals
        .map(v => (typeof v === 'string' ? JSON.parse(v) : v))
        .filter(o => o && pred(o));
}
