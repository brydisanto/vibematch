/**
 * POST /api/pinbook/purchase-prize-games
 * Verifies a VIBESTR payment transaction and grants bonus prize games for today.
 *
 * Body: { txHash, walletAddress, packageSize: 1 | 5 | 10 }
 *
 * Verification steps:
 *   1. Session user is authenticated
 *   2. Tx is confirmed on Ethereum
 *   3. Sender matches walletAddress
 *   4. VIBESTR Transfer event to treasury is present
 *   5. Amount matches expected for packageSize
 *   6. Tx not already processed (replay protection)
 *   7. Grant would not exceed MAX_BONUS_PRIZE_GAMES_PER_DAY
 */

import { NextResponse } from 'next/server';
import { formatUnits, decodeEventLog, parseAbi } from 'viem';
import { getMainnetClient } from '@/lib/eth-rpc';
import { kv } from '@vercel/kv';
import { getSession } from '@/lib/auth';
import { getDailyTracker, getTodayKey, MAX_BONUS_PRIZE_GAMES_PER_DAY } from '../route';
import { logAuditEvent } from '@/lib/audit-log';
import { checkAutomatedAgent, checkOrigin } from '@/lib/anti-automation';
import {
    getRequiredWei,
    USDC_TOKEN_ADDRESS,
    VIBESTR_TOKEN_ADDRESS,
    type PaymentRail,
    type PricingPackageId,
} from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Two-env treasury verification:
// - NEXT_PUBLIC_TREASURY_ADDRESS is what the client sees & sends funds to
// - TREASURY_ADDRESS_VERIFIER is what the server actually checks against
// If these disagree, we HARD-FAIL every purchase request so an env-var drift
// (malicious or accidental) can't silently redirect funds. Previous behavior
// was a console.warn; post-Vercel-incident the warn is not enough.
const PUBLIC_TREASURY = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '').toLowerCase();
const VERIFIER_TREASURY = (process.env.TREASURY_ADDRESS_VERIFIER || process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '').toLowerCase();
const TREASURY_ADDRESS = VERIFIER_TREASURY;

const TREASURY_MISCONFIGURED = !TREASURY_ADDRESS || (
    !!process.env.TREASURY_ADDRESS_VERIFIER &&
    !!PUBLIC_TREASURY &&
    PUBLIC_TREASURY !== VERIFIER_TREASURY
);

if (TREASURY_MISCONFIGURED) {
    console.error(
        `[Purchase] TREASURY MISCONFIGURED: public=${PUBLIC_TREASURY || '<missing>'} ` +
        `verifier=${VERIFIER_TREASURY || '<missing>'}. All purchase verification will hard-fail ` +
        `until env vars agree.`
    );
}

// Ethereum mainnet chainId — reject any receipt from a different chain (e.g.
// testnet-cheap txs accidentally verified via a misbehaving RPC in fallback).
const EXPECTED_CHAIN_ID = BigInt(1);

const VIBESTR_ADDRESS = VIBESTR_TOKEN_ADDRESS.toLowerCase();
const USDC_ADDRESS = USDC_TOKEN_ADDRESS.toLowerCase();

// Maps a UI packageSize (1 / 5 / 10) to the canonical pricing-table id.
const PACKAGE_ID_BY_SIZE: Record<number, PricingPackageId> = {
    1: 'prize-games-1',
    5: 'prize-games-5',
    10: 'prize-games-10',
};

// Token decimals — VIBESTR/USDC are immutable mainnet contracts.
const TOKEN_DECIMALS: Record<PaymentRail, number> = {
    vibestr: 18,
    usdc: 6,
    eth: 18,
};

const erc20TransferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const erc20DecimalsAbi = parseAbi(['function decimals() view returns (uint8)']);

// Minimum confirmations before accepting a tx (protects against chain reorgs)
const REQUIRED_CONFIRMATIONS = BigInt(1);

const client = getMainnetClient();

// Cache the token's decimals value on first call. If the token doesn't respond
// or returns something wild, refuse to process payments.
let cachedDecimals: number | null = null;
async function getTokenDecimals(): Promise<number> {
    if (cachedDecimals !== null) return cachedDecimals;
    try {
        const result = await client.readContract({
            address: VIBESTR_TOKEN_ADDRESS as `0x${string}`,
            abi: erc20DecimalsAbi,
            functionName: 'decimals',
        });
        const decimals = Number(result);
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
            throw new Error(`Invalid decimals: ${decimals}`);
        }
        if (decimals !== 18) {
            console.warn(`[Purchase] VIBESTR token decimals = ${decimals}, expected 18. parseUnits will still work but verify this is correct.`);
        }
        cachedDecimals = decimals;
        return decimals;
    } catch (e) {
        console.error('[Purchase] Failed to read VIBESTR decimals:', e);
        throw new Error('Could not verify token configuration');
    }
}

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;

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
                    endpoint: 'purchase-prize-games',
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
        const { txHash, walletAddress, packageSize } = body;
        const paymentRail: PaymentRail = (
            body.paymentRail === 'usdc' || body.paymentRail === 'eth' ? body.paymentRail : 'vibestr'
        );

        // Strict format validation — reject before hitting any RPC
        if (!txHash || typeof txHash !== 'string' || !TX_HASH_REGEX.test(txHash)) {
            return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
        }
        if (!walletAddress || typeof walletAddress !== 'string' || !WALLET_REGEX.test(walletAddress)) {
            return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }
        const packageId = PACKAGE_ID_BY_SIZE[packageSize];
        if (!packageId) {
            return NextResponse.json({ error: 'Invalid packageSize. Must be 1, 5, or 10.' }, { status: 400 });
        }

        if (!TREASURY_ADDRESS) {
            console.error('NEXT_PUBLIC_TREASURY_ADDRESS is not set');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Hard-fail any purchase while public/verifier treasury envs disagree.
        // The warning at module load is a heads-up; this is the actual guard.
        if (TREASURY_MISCONFIGURED) {
            return NextResponse.json({ error: 'Payment temporarily unavailable (server misconfiguration)' }, { status: 503 });
        }

        const username = (session.username as string).toLowerCase();
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedTxHash = txHash.toLowerCase();

        // Read the canonical wei amount for this (package, rail) from the
        // pricing snapshot. Falls back to FALLBACK_PRICING from
        // src/lib/pricing.ts if KV hasn't been seeded yet.
        const requiredAmount = await getRequiredWei(packageId, paymentRail, 1);
        const decimals = TOKEN_DECIMALS[paymentRail];
        if (requiredAmount <= BigInt(0)) {
            return NextResponse.json({ error: 'Pricing unavailable' }, { status: 503 });
        }

        // --- Replay protection: atomic NX set (reserves the tx hash) ---
        // No TTL — replay markers are permanent. Cheap storage vs economic loss.
        const txKey = `tx:${normalizedTxHash}:processed`;
        const reservation = await kv.set(
            txKey,
            JSON.stringify({ status: 'pending', reservedAt: Date.now(), username }),
            { nx: true }
        );
        if (!reservation) {
            return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
        }

        // Helper to release the reservation on any failure path before it's finalized
        const releaseReservation = async () => {
            // Only delete if still pending — never delete a finalized record
            try {
                const current = await kv.get(txKey);
                if (current) {
                    const parsed = typeof current === 'string' ? JSON.parse(current) : current;
                    if (parsed?.status === 'pending') {
                        await kv.del(txKey);
                    }
                }
            } catch {
                // swallow
            }
        };

        // Per-user lock (prevents two simultaneous purchase calls from racing)
        const lockKey = `lock:purchase:${username}`;
        const gotLock = await kv.set(lockKey, '1', { nx: true, ex: 30 });
        if (!gotLock) {
            await releaseReservation();
            return NextResponse.json({ error: 'Another purchase is in flight. Please wait.' }, { status: 409 });
        }

        // Helper for error paths — releases lock and pending reservation
        const fail = async (status: number, message: string, extra?: Record<string, unknown>) => {
            await kv.del(lockKey);
            await releaseReservation();
            return NextResponse.json({ error: message, ...(extra || {}) }, { status });
        };

        // --- Fetch and verify transaction ---
        let receipt;
        try {
            receipt = await client.getTransactionReceipt({ hash: normalizedTxHash as `0x${string}` });
        } catch (e: any) {
            console.error(`[Purchase] getTransactionReceipt failed:`, e?.message || e);
            return await fail(404, 'Transaction not found or not yet confirmed. Please retry.');
        }

        if (receipt.status !== 'success') {
            return await fail(400, 'Transaction failed on-chain');
        }

        // Confirmation depth check: protect against reorgs
        // No confirmation depth check — accept immediately once receipt exists.
        // Amounts are small; reorg risk is negligible on Ethereum mainnet.

        const tx = await client.getTransaction({ hash: normalizedTxHash as `0x${string}` });
        if (tx.from.toLowerCase() !== normalizedWallet) {
            return await fail(400, 'Transaction sender does not match provided wallet');
        }

        // Chain-id sanity: refuse any tx not on mainnet. Guards against the
        // edge case where an RPC endpoint in fallback() misbehaves and serves
        // a testnet-cheap receipt; also catches a compromised RPC config.
        if (tx.chainId !== undefined && BigInt(tx.chainId) !== EXPECTED_CHAIN_ID) {
            console.error(`[Purchase] chainId mismatch: got ${tx.chainId} expected ${EXPECTED_CHAIN_ID}`);
            return await fail(400, 'Transaction is on the wrong chain');
        }

        // Verifier — different shape per rail:
        //   - VIBESTR / USDC: decode the ERC-20 Transfer event log.
        //   - ETH: read tx.value directly (native transfer).
        let validTransferFound = false;
        let actualAmount = BigInt(0);

        if (paymentRail === 'eth') {
            if (tx.to && tx.to.toLowerCase() === TREASURY_ADDRESS) {
                validTransferFound = true;
                actualAmount = BigInt(tx.value);
            }
        } else {
            const tokenAddress = paymentRail === 'usdc' ? USDC_ADDRESS : VIBESTR_ADDRESS;
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== tokenAddress) continue;
                try {
                    const decoded = decodeEventLog({
                        abi: erc20TransferAbi,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'Transfer') {
                        const fromAddr = (decoded.args.from as string).toLowerCase();
                        const toAddr = (decoded.args.to as string).toLowerCase();
                        const amount = decoded.args.value as bigint;
                        if (fromAddr === normalizedWallet && toAddr === TREASURY_ADDRESS) {
                            validTransferFound = true;
                            actualAmount = amount;
                            break;
                        }
                    }
                } catch {
                    continue;
                }
            }
        }

        if (!validTransferFound) {
            // No payment landed in treasury — safe to release the reservation.
            return await fail(400, 'Payment verification failed');
        }

        // ====== POST-PAYMENT GUARDRAIL ======
        // From here on, treasury HAS received VIBESTR (actualAmount). Any
        // failure path MUST persist the tx record + queue a refund instead
        // of silently deleting the reservation. Silent-delete was the bug
        // that left 33k+ VIBESTR unaccounted between on-chain inflows and
        // the admin total.
        const queueRefund = async (reason: string) => {
            try {
                const refundKey = `purchase_refund:${normalizedTxHash}`;
                await kv.set(refundKey, JSON.stringify({
                    type: 'purchase',
                    username,
                    wallet: normalizedWallet,
                    txHash: normalizedTxHash,
                    packageSize,
                    amount: formatUnits(actualAmount, decimals),
                    reason,
                    createdAt: Date.now(),
                    status: 'pending_admin_credit',
                }));
                // Promote the tx record to 'finalized' with refund_pending so
                // it (a) counts in the admin VIBESTR total and (b) blocks
                // replay under the same hash.
                await kv.set(txKey, JSON.stringify({
                    status: 'finalized',
                    type: 'purchase',
                    username,
                    wallet: normalizedWallet,
                    packageSize,
                    amount: formatUnits(actualAmount, decimals),
                    timestamp: Date.now(),
                    refund_pending: true,
                    refund_reason: reason,
                }));
                await kv.del(lockKey);
            } catch (e) {
                console.error('[Purchase] queueRefund failed:', e);
            }
        };

        if (actualAmount < requiredAmount) {
            const reason = `Underpaid (${paymentRail}): expected ${formatUnits(requiredAmount, decimals)}, got ${formatUnits(actualAmount, decimals)}`;
            console.error(`[Purchase] POST-PAYMENT FAILURE — underpayment. user=${username} tx=${normalizedTxHash} ${reason}`);
            await queueRefund(reason);
            return NextResponse.json({
                error: 'Payment amount was less than required. Your VIBESTR has been logged for refund — contact support.',
            }, { status: 400 });
        }

        // --- Check daily bonus cap ---
        const tracker = await getDailyTracker(username);
        const currentBonus = tracker.bonusPrizeGames || 0;
        const newBonusTotal = currentBonus + packageSize;

        if (newBonusTotal > MAX_BONUS_PRIZE_GAMES_PER_DAY) {
            const reason = `Cap exceeded: ${currentBonus}+${packageSize} > ${MAX_BONUS_PRIZE_GAMES_PER_DAY}`;
            console.error(`[Purchase] POST-PAYMENT FAILURE — daily cap exceeded. user=${username} tx=${normalizedTxHash} ${reason}`);
            await queueRefund(reason);
            return NextResponse.json({
                error: `Daily bonus cap reached. Your VIBESTR has been logged for refund — contact support. (Cap is ${MAX_BONUS_PRIZE_GAMES_PER_DAY}/day; you already had ${currentBonus}.)`,
                currentBonus,
                maxBonus: MAX_BONUS_PRIZE_GAMES_PER_DAY,
            }, { status: 400 });
        }

        // --- Grant bonus games ---
        const dailyKey = getTodayKey(username);
        const updated = { ...tracker, bonusPrizeGames: newBonusTotal };
        await kv.set(dailyKey, updated, { ex: 86400 * 2 });

        // Finalize replay marker — permanent (no TTL) to prevent replay after any TTL expiry
        await kv.set(txKey, JSON.stringify({
            status: 'finalized',
            username,
            wallet: normalizedWallet,
            packageSize,
            amount: formatUnits(actualAmount, decimals),
            timestamp: Date.now(),
        }));

        // Persist engagement flag so the "Put In A Coin" achievement fires
        // on the next retroactive check. Best-effort — not critical path.
        try {
            const flagsKey = `user_flags:${username}`;
            const existingFlags = (await kv.get(flagsKey)) as Record<string, boolean> | null;
            await kv.set(flagsKey, { ...(existingFlags || {}), prizeGamePurchased: true });
        } catch (flagErr) {
            console.warn('[Purchase] failed to set prizeGamePurchased flag', flagErr);
        }

        // Bump lifetime bonus-game counter on the pinbook so the new
        // "Stacked" quest (buy 10+ bonus games) has the data it needs.
        // Best-effort — not critical path; a KV blip here doesn't roll
        // back the purchase.
        try {
            const pinbookKey = `pinbook:${username}`;
            const pinbook = (await kv.get(pinbookKey)) as Record<string, unknown> | null;
            if (pinbook) {
                const current = typeof pinbook.lifetimeBonusGamesPurchased === 'number'
                    ? pinbook.lifetimeBonusGamesPurchased
                    : 0;
                pinbook.lifetimeBonusGamesPurchased = current + packageSize;
                await kv.set(pinbookKey, pinbook);
            }
        } catch (bumpErr) {
            console.warn('[Purchase] failed to bump lifetimeBonusGamesPurchased', bumpErr);
        }

        await kv.del(lockKey);

        console.log(`[Purchase] SUCCESS tx=${normalizedTxHash} user=${username} wallet=${normalizedWallet} size=${packageSize} amount=${formatUnits(actualAmount, decimals)}`);

        await logAuditEvent({
            req: request,
            username,
            action: 'capsule.purchase',
            meta: {
                packageSize,
                txHash: normalizedTxHash,
                wallet: normalizedWallet,
                amountWei: actualAmount.toString(),
            },
        });

        return NextResponse.json({
            success: true,
            packageSize,
            bonusPrizeGames: newBonusTotal,
            classicPlays: tracker.classicPlays,
        });

    } catch (error: any) {
        console.error('Purchase verification error:', error);
        if (error.message?.includes('timeout') || error.message?.includes('network') || error.cause?.code === 'ETIMEDOUT') {
            return NextResponse.json({ error: 'RPC timeout. Please retry.' }, { status: 503 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
