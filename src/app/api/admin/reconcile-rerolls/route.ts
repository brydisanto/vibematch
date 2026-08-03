/**
 * Reconcile reroll purchases that never finished crediting.
 *
 * The reroll rail (/api/pinbook/reroll) reserves a tx as `pending`, verifies
 * the on-chain payment, then either credits capsules (`finalized`) or queues
 * a refund. Two failure modes leave a paying user empty-handed with no
 * self-healing (unlike the prize-game rail, which /api/admin/reconcile-
 * purchases already covers):
 *
 *   A. reroll_refund:<hash> stuck at `pending_admin_credit` — the burn plan
 *      failed post-payment (e.g. not enough duplicates) and nobody actioned
 *      the make-whole credit.
 *   B. tx:<hash>:processed stuck at `status: pending` — the request died
 *      after reserving but before finalizing (mobile drop, function timeout),
 *      so the user got neither capsules nor a refund, and the hash is now
 *      poisoned against retry.
 *
 * This cron resolves both. Job A credits owed refunds. Job B re-verifies the
 * on-chain payment for each stuck reservation (tracked in the `reroll:pending`
 * set) and, when valid, credits the capsules the user paid for WITHOUT the
 * burn (a system-failure make-whole — we can't trust the burn plan against a
 * since-changed pinbook). Bogus reservations with no real payment are released
 * so the user can retry; anything unverifiable is surfaced for manual review.
 *
 * Auth: Bearer CRON_SECRET (Vercel cron) or an admin session (manual run from
 * the admin panel). Idempotent — finalized/credited records are skipped.
 */

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { formatUnits, decodeEventLog, parseAbi } from 'viem';
import { requireAdmin } from '@/lib/admin-auth';
import { bumpDailyCounter } from '@/lib/daily-counters';
import { getMainnetClient } from '@/lib/eth-rpc';
import {
    getRequiredWei,
    USDC_TOKEN_ADDRESS,
    VIBESTR_TOKEN_ADDRESS,
    type PaymentRail,
} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

const TREASURY_ADDRESS = (process.env.TREASURY_ADDRESS_VERIFIER || process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '').toLowerCase();
const VIBESTR_ADDRESS = VIBESTR_TOKEN_ADDRESS.toLowerCase();
const USDC_ADDRESS = USDC_TOKEN_ADDRESS.toLowerCase();
const TOKEN_DECIMALS: Record<'vibestr' | 'usdc' | 'eth', number> = { vibestr: 18, usdc: 6, eth: 18 };
const erc20TransferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const client = getMainnetClient();

// A reservation younger than this may still be a live request; only treat
// older ones as truly dead. The reroll route's per-user lock is ex:30s and
// serverless requests are far shorter, so 5 minutes is comfortably safe.
const STUCK_MS = 5 * 60 * 1000;

interface PinBookLike { capsules?: number; totalEarned?: number; pins?: Record<string, unknown> }

async function creditCapsules(username: string, caps: number): Promise<boolean> {
    if (!(caps > 0)) return false;
    const pk = `pinbook:${username}`;
    const pb = (await kv.get(pk)) as PinBookLike | null;
    if (!pb) return false;
    pb.capsules = (pb.capsules || 0) + caps;
    pb.totalEarned = (pb.totalEarned || 0) + caps;
    await kv.set(pk, pb);
    await bumpDailyCounter(username, 'capsulesEarned', caps).catch(() => {});
    return true;
}

/** Re-verify an on-chain payment the same way the reroll route does. */
async function verifyPayment(
    txHash: string,
    wallet: string,
    rail: PaymentRail | 'eth',
    requiredAmount: bigint,
): Promise<{ ok: boolean; found: boolean }> {
    const w = wallet.toLowerCase();
    let receipt;
    try {
        receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch {
        return { ok: false, found: false }; // no such tx on-chain → bogus reservation
    }
    if (receipt.status !== 'success') return { ok: false, found: true };
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
    if (tx.from.toLowerCase() !== w) return { ok: false, found: true };

    let valid = false;
    let amount = BigInt(0);
    if (rail === 'eth') {
        if (tx.to && tx.to.toLowerCase() === TREASURY_ADDRESS) {
            valid = true;
            amount = BigInt(tx.value);
        }
    } else {
        const tokenAddress = rail === 'usdc' ? USDC_ADDRESS : VIBESTR_ADDRESS;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== tokenAddress) continue;
            try {
                const decoded = decodeEventLog({ abi: erc20TransferAbi, data: log.data, topics: log.topics });
                if (decoded.eventName === 'Transfer') {
                    const from = (decoded.args.from as string).toLowerCase();
                    const to = (decoded.args.to as string).toLowerCase();
                    if (from === w && to === TREASURY_ADDRESS) {
                        valid = true;
                        amount = decoded.args.value as bigint;
                        break;
                    }
                }
            } catch { continue; }
        }
    }
    if (!valid || amount < requiredAmount) return { ok: false, found: true };
    return { ok: true, found: true };
}

async function scanKeys(pattern: string, limit = 5000): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const [next, batch] = (await kv.scan(cursor, { match: pattern, count: 200 })) as [string | number, string[]];
        cursor = next;
        keys.push(...batch);
        if (keys.length >= limit) break;
    } while (cursor !== 0 && cursor !== '0');
    return keys;
}

async function reconcile() {
    const now = Date.now();
    const refundsCredited: Array<{ username: string; caps: number; txHash: string }> = [];
    const stuckRecovered: Array<{ username: string; caps: number; txHash: string }> = [];
    const stuckReleased: Array<{ username: string; txHash: string }> = [];
    const needsReview: Array<{ username: string; txHash: string; reason: string }> = [];

    // ---- Job A: owed refunds (burn plan failed post-payment) ----
    for (const key of await scanKeys('reroll_refund:*')) {
        const raw = await kv.get(key);
        if (!raw) continue;
        const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (o?.status !== 'pending_admin_credit') continue;
        const caps = Number(o.totalCapsules) || 0;
        const ok = await creditCapsules(o.username, caps);
        if (ok) {
            o.status = 'credited_admin';
            o.resolvedAt = now;
            o.resolvedBy = 'reconcile-rerolls';
            await kv.set(key, JSON.stringify(o));
            refundsCredited.push({ username: o.username, caps, txHash: o.txHash || key });
        } else {
            needsReview.push({ username: o.username, txHash: o.txHash || key, reason: 'refund credit failed (no pinbook)' });
        }
    }

    // ---- Job B: stuck `pending` reroll reservations ----
    const pendingHashes = (await kv.smembers('reroll:pending')) as string[];
    for (const hash of pendingHashes) {
        const txKey = `tx:${hash}:processed`;
        const raw = await kv.get(txKey);
        if (!raw) { await kv.srem('reroll:pending', hash); continue; } // already gone
        const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (o?.type !== 'reroll') { await kv.srem('reroll:pending', hash); continue; }
        if (o.status !== 'pending') { await kv.srem('reroll:pending', hash); continue; } // finalized elsewhere
        if (o.createdAt && now - Number(o.createdAt) < STUCK_MS) continue; // possibly still in flight

        // Legacy reservation without recovery fields — can't know the amount.
        if (!o.totalCapsules || !o.paymentRail || !o.wallet) {
            needsReview.push({ username: o.username || 'unknown', txHash: hash, reason: 'legacy reservation missing recovery fields' });
            continue;
        }

        const caps = Number(o.totalCapsules) || 0;
        const requiredAmount = await getRequiredWei('reroll-per-capsule', o.paymentRail as PaymentRail, caps);
        const v = await verifyPayment(hash, o.wallet, o.paymentRail, requiredAmount);

        if (v.ok) {
            const ok = await creditCapsules(o.username, caps);
            if (ok) {
                await kv.set(txKey, JSON.stringify({
                    ...o,
                    status: 'finalized',
                    recovered: true,
                    recoveredAt: now,
                    recoveredBy: 'reconcile-rerolls',
                    note: 'auto-credited without burn (system-failure make-whole)',
                    amount: formatUnits(requiredAmount, TOKEN_DECIMALS[o.paymentRail as keyof typeof TOKEN_DECIMALS]),
                }));
                await kv.srem('reroll:pending', hash);
                stuckRecovered.push({ username: o.username, caps, txHash: hash });
            } else {
                needsReview.push({ username: o.username, txHash: hash, reason: 'verified payment but no pinbook to credit' });
            }
        } else if (!v.found) {
            // No matching tx on-chain — the reservation was never backed by a
            // real payment. Release it so the hash is no longer poisoned.
            await kv.del(txKey);
            await kv.srem('reroll:pending', hash);
            stuckReleased.push({ username: o.username, txHash: hash });
        } else {
            needsReview.push({ username: o.username, txHash: hash, reason: 'payment on-chain but could not be verified (amount/sender/token mismatch)' });
        }
    }

    return {
        ranAt: new Date(now).toISOString(),
        refundsCredited,
        stuckRecovered,
        stuckReleased,
        needsReview,
        summary: {
            refundsCredited: refundsCredited.length,
            stuckRecovered: stuckRecovered.length,
            stuckReleased: stuckReleased.length,
            needsReview: needsReview.length,
        },
    };
}

function cronAuthorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    return (req.headers.get('authorization') || '') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
    let ok = cronAuthorized(req);
    if (!ok) ok = !!(await requireAdmin(req));
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        return NextResponse.json(await reconcile());
    } catch (e) {
        console.error('[reconcile-rerolls] error:', e);
        return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
    }
}
