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
import { createPublicClient, http, fallback, parseUnits, formatUnits, decodeEventLog, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import { kv } from '@vercel/kv';
import { getSession } from '@/lib/auth';
import { getDailyTracker, getTodayKey, MAX_BONUS_PRIZE_GAMES_PER_DAY } from '../route';

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

const VIBESTR_ADDRESS_RAW = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
const VIBESTR_ADDRESS = VIBESTR_ADDRESS_RAW.toLowerCase();

// Price per package (in VIBESTR). Testing prices — will raise before public launch.
const PACKAGE_PRICES: Record<number, string> = {
    1: '1',   // 1 VIBESTR per game
    5: '3',   // 0.6 VIBESTR per game (testing)
    10: '5',  // 0.5 VIBESTR per game (testing)
};

const erc20TransferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const erc20DecimalsAbi = parseAbi(['function decimals() view returns (uint8)']);

// Minimum confirmations before accepting a tx (protects against chain reorgs)
const REQUIRED_CONFIRMATIONS = BigInt(1);

const client = createPublicClient({
    chain: mainnet,
    transport: fallback([
        http('https://rpc.flashbots.net'),
        http('https://eth.llamarpc.com'),
        http('https://1rpc.io/eth'),
    ], { rank: true }),
});

// Cache the token's decimals value on first call. If the token doesn't respond
// or returns something wild, refuse to process payments.
let cachedDecimals: number | null = null;
async function getTokenDecimals(): Promise<number> {
    if (cachedDecimals !== null) return cachedDecimals;
    try {
        const result = await client.readContract({
            address: VIBESTR_ADDRESS_RAW as `0x${string}`,
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
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { txHash, walletAddress, packageSize } = body;

        // Strict format validation — reject before hitting any RPC
        if (!txHash || typeof txHash !== 'string' || !TX_HASH_REGEX.test(txHash)) {
            return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
        }
        if (!walletAddress || typeof walletAddress !== 'string' || !WALLET_REGEX.test(walletAddress)) {
            return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }
        if (!PACKAGE_PRICES[packageSize]) {
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
        // Fetch token decimals (cached after first call) — refuse payments if unavailable
        let decimals: number;
        try {
            decimals = await getTokenDecimals();
        } catch (e) {
            return NextResponse.json({ error: 'Payment temporarily unavailable' }, { status: 503 });
        }
        const requiredAmount = parseUnits(PACKAGE_PRICES[packageSize], decimals);

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

        // Parse event logs for valid Transfer
        let validTransferFound = false;
        let actualAmount = BigInt(0);

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== VIBESTR_ADDRESS) continue;
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

        if (!validTransferFound) {
            return await fail(400, 'Payment verification failed');
        }

        if (actualAmount < requiredAmount) {
            // Log detail server-side, return generic message to client
            console.warn(`[Purchase] Insufficient payment for tx ${normalizedTxHash}: expected ${PACKAGE_PRICES[packageSize]}, got ${formatUnits(actualAmount, decimals)}`);
            return await fail(400, 'Payment verification failed');
        }

        // --- Check daily bonus cap ---
        const tracker = await getDailyTracker(username);
        const currentBonus = tracker.bonusPrizeGames || 0;
        const newBonusTotal = currentBonus + packageSize;

        if (newBonusTotal > MAX_BONUS_PRIZE_GAMES_PER_DAY) {
            return await fail(400, `Daily bonus cap reached. You can purchase ${MAX_BONUS_PRIZE_GAMES_PER_DAY - currentBonus} more prize games today.`, {
                currentBonus,
                maxBonus: MAX_BONUS_PRIZE_GAMES_PER_DAY,
            });
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

        await kv.del(lockKey);

        console.log(`[Purchase] SUCCESS tx=${normalizedTxHash} user=${username} wallet=${normalizedWallet} size=${packageSize} amount=${formatUnits(actualAmount, decimals)}`);

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
