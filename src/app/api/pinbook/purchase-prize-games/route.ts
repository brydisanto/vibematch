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

const client = createPublicClient({
    chain: mainnet,
    transport: fallback([
        http('https://rpc.flashbots.net'),
        http('https://eth.llamarpc.com'),
        http('https://1rpc.io/eth'),
    ], { rank: true }),
});

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { txHash, walletAddress, packageSize } = body;

        if (!txHash || typeof txHash !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid txHash' }, { status: 400 });
        }
        if (!walletAddress || typeof walletAddress !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid walletAddress' }, { status: 400 });
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

        // --- Replay protection & lock ---
        const txKey = `tx:${normalizedTxHash}:processed`;
        const lockKey = `tx:${normalizedTxHash}:lock`;

        const acquired = await kv.set(lockKey, 'locked', { nx: true, ex: 60 });
        if (!acquired) {
            return NextResponse.json({ error: 'Transaction is currently being processed' }, { status: 409 });
        }

        const alreadyProcessed = await kv.get(txKey);
        if (alreadyProcessed) {
            await kv.del(lockKey);
            return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
        }

        // --- Fetch and verify transaction ---
        let receipt;
        try {
            receipt = await client.getTransactionReceipt({ hash: normalizedTxHash as `0x${string}` });
        } catch (e: any) {
            console.error(`[Purchase] getTransactionReceipt failed:`, e?.message || e);
            await kv.del(lockKey);
            return NextResponse.json({ error: 'Transaction not found or not yet confirmed. Please retry.' }, { status: 404 });
        }

        if (receipt.status !== 'success') {
            await kv.del(lockKey);
            return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
        }

        const tx = await client.getTransaction({ hash: normalizedTxHash as `0x${string}` });
        if (tx.from.toLowerCase() !== normalizedWallet) {
            await kv.del(lockKey);
            return NextResponse.json({ error: 'Transaction sender does not match provided wallet' }, { status: 400 });
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
            await kv.del(lockKey);
            return NextResponse.json({ error: 'No valid VIBESTR transfer event found in transaction' }, { status: 400 });
        }

        if (actualAmount < requiredAmount) {
            await kv.del(lockKey);
            return NextResponse.json({
                error: `Insufficient payment. Expected ${PACKAGE_PRICES[packageSize]} VIBESTR, got ${formatEther(actualAmount)} VIBESTR`,
            }, { status: 400 });
        }

        // --- Check daily bonus cap ---
        const tracker = await getDailyTracker(username);
        const currentBonus = tracker.bonusPrizeGames || 0;
        const newBonusTotal = currentBonus + packageSize;

        if (newBonusTotal > MAX_BONUS_PRIZE_GAMES_PER_DAY) {
            await kv.del(lockKey);
            return NextResponse.json({
                error: `Daily bonus cap reached. You can purchase ${MAX_BONUS_PRIZE_GAMES_PER_DAY - currentBonus} more prize games today.`,
                currentBonus,
                maxBonus: MAX_BONUS_PRIZE_GAMES_PER_DAY,
            }, { status: 400 });
        }

        // --- Grant bonus games ---
        const key = getTodayKey(username);
        const updated = { ...tracker, bonusPrizeGames: newBonusTotal };
        await kv.set(key, updated, { ex: 86400 * 2 });

        // Mark tx as processed (7-day TTL)
        await kv.set(txKey, JSON.stringify({
            username,
            wallet: normalizedWallet,
            packageSize,
            amount: formatEther(actualAmount),
            timestamp: Date.now(),
        }), { ex: 60 * 60 * 24 * 7 });
        await kv.del(lockKey);

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
