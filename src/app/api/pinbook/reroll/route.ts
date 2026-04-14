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
import { createPublicClient, http, fallback, parseUnits, formatUnits, decodeEventLog, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import { kv } from '@vercel/kv';
import { getSession } from '@/lib/auth';
import { BADGES, type BadgeTier } from '@/lib/badges';

export const dynamic = 'force-dynamic';

const TREASURY_ADDRESS = (process.env.TREASURY_ADDRESS_VERIFIER || process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '').toLowerCase();
const VIBESTR_ADDRESS_RAW = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
const VIBESTR_ADDRESS = VIBESTR_ADDRESS_RAW.toLowerCase();

// VIBESTR cost per reroll (small fixed fee regardless of tier burned)
const VIBESTR_PER_REROLL = 5; // 5 VIBESTR per reroll, scales with quantity
const MAX_REROLLS_PER_TX = 20; // safety cap

// Pins to burn per reroll by tier
const BURN_COST: Record<string, number> = {
    blue: 5,
    silver: 4,
    special: 3,
    gold: 2,
    cosmic: 1,
};

const erc20TransferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const erc20DecimalsAbi = parseAbi(['function decimals() view returns (uint8)']);

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

let cachedDecimals: number | null = null;
async function getTokenDecimals(): Promise<number> {
    if (cachedDecimals !== null) return cachedDecimals;
    const result = await client.readContract({
        address: VIBESTR_ADDRESS_RAW as `0x${string}`,
        abi: erc20DecimalsAbi,
        functionName: 'decimals',
    });
    cachedDecimals = Number(result);
    return cachedDecimals;
}

interface PinBookData {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number;
    totalOpened: number;
    totalEarned: number;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { txHash, walletAddress, burnTier, quantity: rawQuantity } = body;

        // Validate inputs
        if (!txHash || typeof txHash !== 'string' || !TX_HASH_REGEX.test(txHash)) {
            return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });
        }
        if (!walletAddress || typeof walletAddress !== 'string' || !WALLET_REGEX.test(walletAddress)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
        }
        if (!burnTier || !BURN_COST[burnTier]) {
            return NextResponse.json({ error: 'Invalid burn tier' }, { status: 400 });
        }

        const quantity = Math.min(Math.max(1, Math.floor(Number(rawQuantity) || 1)), MAX_REROLLS_PER_TX);
        const username = (session.username as string).toLowerCase();
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedTxHash = txHash.toLowerCase();
        const burnPerReroll = BURN_COST[burnTier];
        const totalBurnCount = burnPerReroll * quantity;
        const totalVibestrCost = String(VIBESTR_PER_REROLL * quantity);

        // Get token decimals
        let decimals: number;
        try {
            decimals = await getTokenDecimals();
        } catch {
            return NextResponse.json({ error: 'Payment temporarily unavailable' }, { status: 503 });
        }
        const requiredAmount = parseUnits(totalVibestrCost, decimals);

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

        // Verify the player has enough duplicates to burn BEFORE verifying payment
        const pinbookKey = `pinbook:${username}`;
        const pinbook = (await kv.get(pinbookKey)) as PinBookData | null;
        if (!pinbook || !pinbook.pins) {
            return await fail(400, 'No pins to burn');
        }

        // Count burnable duplicates in the chosen tier
        const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));
        let burnableDuplicates = 0;
        const burnCandidates: { id: string; burnableCount: number }[] = [];

        for (const [badgeId, pinData] of Object.entries(pinbook.pins)) {
            const tier = badgeTierMap.get(badgeId);
            if (tier !== burnTier) continue;
            // Only burn duplicates: keep at least 1
            const burnable = Math.max(0, pinData.count - 1);
            if (burnable > 0) {
                burnableDuplicates += burnable;
                burnCandidates.push({ id: badgeId, burnableCount: burnable });
            }
        }

        if (burnableDuplicates < totalBurnCount) {
            return await fail(400, `Not enough duplicates. Need ${totalBurnCount} burnable ${burnTier} pins (${burnPerReroll} x ${quantity}), have ${burnableDuplicates}.`);
        }

        // Verify VIBESTR payment
        let receipt;
        try {
            receipt = await client.getTransactionReceipt({ hash: normalizedTxHash as `0x${string}` });
        } catch {
            return await fail(404, 'Transaction not found. Please retry.');
        }

        if (receipt.status !== 'success') {
            return await fail(400, 'Transaction failed on-chain');
        }

        // Confirmation check
        const currentBlock = await client.getBlockNumber();
        if (receipt.blockNumber + BigInt(1) > currentBlock) {
            return await fail(425, 'Awaiting confirmation. Please retry.');
        }

        const tx = await client.getTransaction({ hash: normalizedTxHash as `0x${string}` });
        if (tx.from.toLowerCase() !== normalizedWallet) {
            return await fail(400, 'Sender mismatch');
        }

        // Parse Transfer event
        let validTransfer = false;
        let actualAmount = BigInt(0);
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== VIBESTR_ADDRESS) continue;
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

        if (!validTransfer || actualAmount < requiredAmount) {
            return await fail(400, 'Payment verification failed');
        }

        // --- All verified: burn pins + grant capsule ---

        // Burn pins from duplicates (spread across candidates)
        let remaining = totalBurnCount;
        for (const candidate of burnCandidates) {
            if (remaining <= 0) break;
            const pin = pinbook.pins[candidate.id];
            const toBurn = Math.min(remaining, candidate.burnableCount);
            pin.count -= toBurn;
            remaining -= toBurn;
        }

        // Grant capsules
        pinbook.capsules += quantity;
        pinbook.totalEarned += quantity;

        await kv.set(pinbookKey, pinbook);

        // Finalize tx record
        await kv.set(txKey, JSON.stringify({
            status: 'finalized',
            type: 'reroll',
            username,
            wallet: normalizedWallet,
            burnTier,
            quantity,
            totalBurned: totalBurnCount,
            amount: formatUnits(actualAmount, decimals),
            timestamp: Date.now(),
        }));

        await kv.del(lockKey);

        console.log(`[Reroll] SUCCESS user=${username} burned=${totalBurnCount}x${burnTier} qty=${quantity} amount=${formatUnits(actualAmount, decimals)}`);

        return NextResponse.json({
            success: true,
            burnTier,
            quantity,
            totalBurned: totalBurnCount,
            capsules: pinbook.capsules,
        });

    } catch (error: any) {
        console.error('Reroll error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
