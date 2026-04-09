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
import { createPublicClient, http, fallback, parseEther, formatEther, decodeEventLog, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import { kv } from '@vercel/kv';
import { getSession } from '@/lib/auth';
import { getDailyTracker, getTodayKey, MAX_BONUS_PRIZE_GAMES_PER_DAY } from '../route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '').toLowerCase();
const VIBESTR_ADDRESS = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196'.toLowerCase();

// Price per package (in VIBESTR). 10-pack has ~20% discount.
const PACKAGE_PRICES: Record<number, string> = {
    1: '50',    // 50 VIBESTR per game
    5: '225',   // 45 VIBESTR per game (10% off)
    10: '400',  // 40 VIBESTR per game (20% off)
};

const erc20TransferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);

// Minimum confirmations before accepting a tx (protects against chain reorgs)
const REQUIRED_CONFIRMATIONS = BigInt(3);

const client = createPublicClient({
    chain: mainnet,
    transport: fallback([
        http('https://rpc.flashbots.net'),
        http('https://eth.llamarpc.com'),
        http('https://1rpc.io/eth'),
    ], { rank: true }),
});

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

        const username = (session.username as string).toLowerCase();
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedTxHash = txHash.toLowerCase();
        const requiredAmount = parseEther(PACKAGE_PRICES[packageSize]);

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
        let currentBlock: bigint;
        try {
            currentBlock = await client.getBlockNumber();
        } catch (e: any) {
            console.error(`[Purchase] getBlockNumber failed:`, e?.message || e);
            return await fail(503, 'Could not verify confirmation depth. Please retry.');
        }
        const confirmations = currentBlock - receipt.blockNumber;
        if (confirmations < REQUIRED_CONFIRMATIONS) {
            return await fail(425, `Awaiting confirmations (${confirmations}/${REQUIRED_CONFIRMATIONS}). Please retry shortly.`);
        }

        const tx = await client.getTransaction({ hash: normalizedTxHash as `0x${string}` });
        if (tx.from.toLowerCase() !== normalizedWallet) {
            return await fail(400, 'Transaction sender does not match provided wallet');
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
            console.warn(`[Purchase] Insufficient payment for tx ${normalizedTxHash}: expected ${PACKAGE_PRICES[packageSize]}, got ${formatEther(actualAmount)}`);
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
            amount: formatEther(actualAmount),
            timestamp: Date.now(),
        }));

        await kv.del(lockKey);

        console.log(`[Purchase] SUCCESS tx=${normalizedTxHash} user=${username} wallet=${normalizedWallet} size=${packageSize} amount=${formatEther(actualAmount)}`);

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
