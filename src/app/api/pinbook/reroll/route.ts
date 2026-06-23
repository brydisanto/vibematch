/**
 * POST /api/pinbook/reroll
 * Burns duplicate pins + verifies VIBESTR payment → grants 1 random capsule.
 *
 * Body: { txHash, walletAddress, burnTier: 'blue'|'silver'|'special'|'gold'|'cosmic' }
 *
 * Burn costs per capsule:
 *   5 Common / 4 Rare / 3 Special / 2 Legendary / 1 Cosmic
 *
 * Only burns duplicates — player always keeps at least 1 of each pin.
 * VIBESTR cost is small and fixed per reroll regardless of tier.
 */

import { NextResponse } from 'next/server';
import { formatUnits, decodeEventLog, parseAbi } from 'viem';
import { kv } from '@vercel/kv';
import { getSession } from '@/lib/auth';
import { bumpDailyCounter } from '@/lib/daily-counters';
import { BADGES, type BadgeTier } from '@/lib/badges';
import { computeUserEntry, updateLeaderboardEntry } from '../leaderboard/route';
import { getMainnetClient } from '@/lib/eth-rpc';
import { logAuditEvent } from '@/lib/audit-log';
import { checkAutomatedAgent, checkOrigin } from '@/lib/anti-automation';
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
// Per-tx safety cap. Was 20 → bumped to 50 after Onward hit "Invalid burn
// quantities" on a 27-capsule reroll. The cap is a fat-finger guard, not
// an economic limit, so giving it generous headroom is fine.
const MAX_REROLLS_PER_TX = 50;

// Pins to burn per capsule by tier
const BURN_COST: Record<string, number> = {
    blue: 5,
    silver: 4,
    special: 3,
    gold: 2,
    cosmic: 1,
};

const erc20TransferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);

const client = getMainnetClient();

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;

// Decimals are now hardcoded by token — VIBESTR/USDC are immutable
// mainnet contracts. Saves an RPC round-trip per reroll.
const TOKEN_DECIMALS: Record<'vibestr' | 'usdc' | 'eth', number> = {
    vibestr: 18,
    usdc: 6,
    eth: 18,
};

interface PinBookData {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number;
    totalOpened: number;
    totalEarned: number;
    /** Lifetime reroll counter — mirrors the field on the canonical
     *  PinBookData in ../route.ts. Bumped on each successful reroll
     *  (by capsule count, not transaction count) so multi-capsule
     *  rerolls progress the quest by the right amount. */
    lifetimeRerollsCompleted?: number;
}

export async function POST(request: Request) {
    try {
        // Anti-automation gate. See src/lib/anti-automation.ts.
        const uaCheck = checkAutomatedAgent(request);
        const ogCheck = checkOrigin(request);
        if (uaCheck.blocked || ogCheck.blocked) {
            const s = await getSession().catch(() => null);
            await logAuditEvent({
                req: request,
                username: (s?.username as string) || 'anon',
                action: 'score.rejected',
                meta: {
                    endpoint: 'reroll',
                    reason: uaCheck.blocked ? (uaCheck.reason || 'automated_agent') : (ogCheck.reason || 'bad_origin'),
                    uaPattern: uaCheck.matchedPattern || '',
                    uaSample: uaCheck.ua.slice(0, 120),
                },
            });
            return NextResponse.json({ error: 'Browser required' }, { status: 403 });
        }

        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { txHash, walletAddress, burns } = body;
        const paymentRail: PaymentRail = (
            body.paymentRail === 'usdc' || body.paymentRail === 'eth' ? body.paymentRail : 'vibestr'
        );
        // burns: Record<BadgeTier, number> — e.g. { blue: 2, silver: 1 } means
        // 2 capsules from Common (burns 10 pins) + 1 capsule from Rare (burns 4 pins)

        // Validate inputs
        if (!txHash || typeof txHash !== 'string' || !TX_HASH_REGEX.test(txHash)) {
            return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });
        }
        if (!walletAddress || typeof walletAddress !== 'string' || !WALLET_REGEX.test(walletAddress)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
        }
        if (!burns || typeof burns !== 'object') {
            return NextResponse.json({ error: 'Missing burns object' }, { status: 400 });
        }

        // Parse burns per tier. We clamp negatives/garbage to 0 here, but
        // the per-tier UPPER bound is enforced post-payment-verification so
        // a fat-finger / buggy-client over-cap submission gets its VIBESTR
        // queued for refund instead of silently dropped.
        let totalCapsules = 0;
        const parsedBurns: { tier: string; capsules: number; pinsNeeded: number }[] = [];
        for (const [tier, qty] of Object.entries(burns)) {
            if (!BURN_COST[tier]) continue;
            const capsules = Math.max(0, Math.floor(Number(qty) || 0));
            if (capsules <= 0) continue;
            parsedBurns.push({ tier, capsules, pinsNeeded: BURN_COST[tier] * capsules });
            totalCapsules += capsules;
        }

        // Pre-payment guard: zero/negative is a malformed request — no
        // payment should ever be in flight for this, so reject hard.
        if (totalCapsules <= 0) {
            console.error(`[Reroll] Invalid burn quantities. burns=${JSON.stringify(burns)} parsed=${JSON.stringify(parsedBurns)} totalCapsules=${totalCapsules}`);
            return NextResponse.json({ error: 'Invalid burn quantities' }, { status: 400 });
        }

        // NOTE: totalCapsules > MAX_REROLLS_PER_TX is intentionally NOT
        // checked here. If the user paid for an over-cap reroll, we want
        // the post-payment refund queue to catch it (see Phase 2 below)
        // rather than dropping their VIBESTR on the floor.

        console.log(`[Reroll] Processing: burns=${JSON.stringify(burns)} totalCapsules=${totalCapsules}`);

        const username = (session.username as string).toLowerCase();
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedTxHash = txHash.toLowerCase();

        // Read the canonical wei amount for this (package, rail) from the
        // pricing snapshot. Multiplied by totalCapsules since the reroll
        // package is per-capsule. Falls back to FALLBACK_PRICING from
        // src/lib/pricing.ts if KV hasn't been seeded yet.
        const requiredAmount = await getRequiredWei(
            'reroll-per-capsule',
            paymentRail,
            totalCapsules,
        );
        const decimals = TOKEN_DECIMALS[paymentRail];
        if (requiredAmount <= BigInt(0)) {
            return NextResponse.json({ error: 'Pricing unavailable' }, { status: 503 });
        }

        // Replay protection
        const txKey = `tx:${normalizedTxHash}:processed`;
        const reservation = await kv.set(txKey, JSON.stringify({ status: 'pending', username, type: 'reroll' }), { nx: true });
        if (!reservation) {
            return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
        }

        const releaseReservation = async () => {
            try {
                const current = await kv.get(txKey);
                if (current) {
                    const parsed = typeof current === 'string' ? JSON.parse(current) : current;
                    if (parsed?.status === 'pending') await kv.del(txKey);
                }
            } catch {}
        };

        // Per-user lock
        const lockKey = `lock:reroll:${username}`;
        const gotLock = await kv.set(lockKey, '1', { nx: true, ex: 30 });
        if (!gotLock) {
            await releaseReservation();
            return NextResponse.json({ error: 'Another reroll is in flight' }, { status: 409 });
        }

        const fail = async (status: number, message: string) => {
            await kv.del(lockKey);
            await releaseReservation();
            return NextResponse.json({ error: message }, { status });
        };

        // ====== PHASE 1: verify the on-chain payment FIRST ======
        // Critical reordering (2026-05-22): previously the burn-plan
        // validation came before payment verification, which meant a user
        // who submitted a stale or impossible burn plan would have their
        // signed VIBESTR tx confirmed on-chain while the server rejected
        // with 400 — VIBESTR lost, no admin record. Now we verify payment
        // first; if burn plan then fails, we mark the tx for refund
        // instead of silently discarding it.
        let receipt;
        try {
            receipt = await client.getTransactionReceipt({ hash: normalizedTxHash as `0x${string}` });
        } catch {
            return await fail(404, 'Transaction not found. Please retry.');
        }

        if (receipt.status !== 'success') {
            return await fail(400, 'Transaction failed on-chain');
        }

        const tx = await client.getTransaction({ hash: normalizedTxHash as `0x${string}` });
        if (tx.from.toLowerCase() !== normalizedWallet) {
            return await fail(400, 'Sender mismatch');
        }

        // Verifier — different shape per rail:
        //   - VIBESTR / USDC: decode the ERC-20 Transfer log emitted by
        //     the token contract, check from/to/value.
        //   - ETH: read the native transfer fields directly off the tx.
        let validTransfer = false;
        let actualAmount = BigInt(0);
        if (paymentRail === 'eth') {
            if (tx.to && tx.to.toLowerCase() === TREASURY_ADDRESS) {
                validTransfer = true;
                actualAmount = BigInt(tx.value);
            }
        } else {
            const tokenAddress = paymentRail === 'usdc' ? USDC_ADDRESS : VIBESTR_ADDRESS;
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== tokenAddress) continue;
                try {
                    const decoded = decodeEventLog({ abi: erc20TransferAbi, data: log.data, topics: log.topics });
                    if (decoded.eventName === 'Transfer') {
                        const from = (decoded.args.from as string).toLowerCase();
                        const to = (decoded.args.to as string).toLowerCase();
                        if (from === normalizedWallet && to === TREASURY_ADDRESS) {
                            validTransfer = true;
                            actualAmount = decoded.args.value as bigint;
                            break;
                        }
                    }
                } catch { continue; }
            }
        }

        if (!validTransfer || actualAmount < requiredAmount) {
            console.error(`[Reroll] Payment verification failed. rail=${paymentRail} validTransfer=${validTransfer} actualAmount=${actualAmount} requiredAmount=${requiredAmount} tx=${normalizedTxHash}`);
            return await fail(400, 'Payment verification failed');
        }

        // ====== PHASE 2: validate burn plan against current pinbook ======
        // Past this point, the VIBESTR has been confirmed on-chain. Any
        // failure here MUST be tracked for admin refund — we never silently
        // discard a paid reroll.
        const pinbookKey = `pinbook:${username}`;
        const pinbook = (await kv.get(pinbookKey)) as PinBookData | null;

        const queueRefund = async (reason: string) => {
            try {
                const refundKey = `reroll_refund:${normalizedTxHash}`;
                await kv.set(refundKey, JSON.stringify({
                    username,
                    wallet: normalizedWallet,
                    txHash: normalizedTxHash,
                    amount: formatUnits(actualAmount, decimals),
                    burns: parsedBurns,
                    totalCapsules,
                    reason,
                    createdAt: Date.now(),
                    status: 'pending_admin_credit',
                }));
                // Tx record stays as 'processed' with a 'refund_pending' flag so
                // it can't be retried under the same hash.
                await kv.set(txKey, JSON.stringify({
                    status: 'finalized',
                    type: 'reroll',
                    username,
                    wallet: normalizedWallet,
                    burns: parsedBurns,
                    totalCapsules,
                    amount: formatUnits(actualAmount, decimals),
                    timestamp: Date.now(),
                    refund_pending: true,
                    refund_reason: reason,
                }));
                await kv.del(lockKey);
            } catch (e) {
                console.error('[Reroll] queueRefund failed:', e);
            }
        };

        // Post-payment cap enforcement. If a buggy/manipulated client signed
        // a tx for more than MAX_REROLLS_PER_TX capsules, reject the grant
        // but queue the VIBESTR for refund so it lands in admin's view.
        if (totalCapsules > MAX_REROLLS_PER_TX) {
            const reason = `Exceeded per-tx cap: ${totalCapsules} > ${MAX_REROLLS_PER_TX}`;
            console.error(`[Reroll] POST-PAYMENT FAILURE — cap exceeded. user=${username} tx=${normalizedTxHash} ${reason}`);
            await queueRefund(reason);
            return NextResponse.json({
                error: `Reroll exceeded the per-transaction cap of ${MAX_REROLLS_PER_TX} capsules. Your VIBESTR has been logged for refund — contact support.`,
            }, { status: 400 });
        }

        if (!pinbook || !pinbook.pins) {
            await queueRefund('No pins to burn');
            console.error(`[Reroll] POST-PAYMENT FAILURE — no pinbook. user=${username} tx=${normalizedTxHash}`);
            return NextResponse.json({
                error: 'No pins to burn. Your VIBESTR has been logged for refund — contact support.',
            }, { status: 400 });
        }

        // Validate each tier has enough burnable duplicates
        const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));
        const burnPlan: { id: string; toBurn: number }[] = [];

        for (const burn of parsedBurns) {
            // Collect candidates for this tier
            const candidates: { id: string; burnable: number }[] = [];
            let available = 0;
            for (const [badgeId, pinData] of Object.entries(pinbook.pins)) {
                if (badgeTierMap.get(badgeId) !== burn.tier) continue;
                const burnable = Math.max(0, pinData.count - 1);
                if (burnable > 0) {
                    candidates.push({ id: badgeId, burnable });
                    available += burnable;
                }
            }

            if (available < burn.pinsNeeded) {
                const tierName = burn.tier.charAt(0).toUpperCase() + burn.tier.slice(1);
                console.error(`[Reroll] POST-PAYMENT FAILURE — not enough ${tierName} duplicates. Need ${burn.pinsNeeded}, have ${available}. user=${username} tx=${normalizedTxHash}`);
                await queueRefund(`Not enough ${tierName} duplicates. Need ${burn.pinsNeeded}, have ${available}.`);
                return NextResponse.json({
                    error: `Not enough ${tierName} duplicates. Need ${burn.pinsNeeded}, have ${available}. Your VIBESTR has been logged for refund — contact support.`,
                }, { status: 400 });
            }

            // Plan which specific pins to burn from this tier
            let remaining = burn.pinsNeeded;
            for (const c of candidates) {
                if (remaining <= 0) break;
                const take = Math.min(remaining, c.burnable);
                burnPlan.push({ id: c.id, toBurn: take });
                remaining -= take;
            }
        }

        // --- All verified: burn pins + grant capsule ---

        // Execute the burn plan
        for (const { id, toBurn } of burnPlan) {
            pinbook.pins[id].count -= toBurn;
        }

        // Grant capsules
        pinbook.capsules += totalCapsules;
        pinbook.totalEarned += totalCapsules;
        // Reroll quest counter — bump by the number of capsules actually
        // rerolled, not by 1 per transaction, so a 5-capsule reroll
        // progresses Pin Wizard (50+) by 5.
        pinbook.lifetimeRerollsCompleted = (pinbook.lifetimeRerollsCompleted || 0) + totalCapsules;

        await kv.set(pinbookKey, pinbook);
        await bumpDailyCounter(username, "capsulesEarned", totalCapsules);

        // Recalculate leaderboard entry (pin counts changed due to burn)
        const profile = await kv.get(`user:${username}`) as { username?: string; avatarUrl?: string } | null;
        const entry = computeUserEntry(
            profile?.username || username,
            profile?.avatarUrl || '',
            pinbook.pins,
        );
        updateLeaderboardEntry(entry).catch(() => {});

        // Finalize tx record
        await kv.set(txKey, JSON.stringify({
            status: 'finalized',
            type: 'reroll',
            username,
            wallet: normalizedWallet,
            burns: parsedBurns,
            totalCapsules,
            amount: formatUnits(actualAmount, decimals),
            timestamp: Date.now(),
        }));

        await kv.del(lockKey);

        const burnSummary = parsedBurns.map(b => `${b.pinsNeeded}x${b.tier}`).join('+');
        console.log(`[Reroll] SUCCESS user=${username} burned=${burnSummary} capsules=${totalCapsules} amount=${formatUnits(actualAmount, decimals)}`);

        await logAuditEvent({
            req: request,
            username,
            action: 'reroll.post',
            meta: { burnSummary, totalCapsules, amountWei: actualAmount.toString() },
        });

        return NextResponse.json({
            success: true,
            burns: parsedBurns,
            totalCapsules,
            capsules: pinbook.capsules,
        });

    } catch (error: any) {
        console.error('Reroll error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
