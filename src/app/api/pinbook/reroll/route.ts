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
const VIBESTR_PER_REROLL = 1; // 1 VIBESTR per reroll, scales with quantity
const MAX_REROLLS_PER_TX = 20; // safety cap

// Pins to burn per capsule by tier
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
        const { txHash, walletAddress, burns } = body;
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

        // Parse and validate burns per tier
        let totalCapsules = 0;
        const parsedBurns: { tier: string; capsules: number; pinsNeeded: number }[] = [];
        for (const [tier, qty] of Object.entries(burns)) {
            if (!BURN_COST[tier]) continue;
            const capsules = Math.min(Math.max(0, Math.floor(Number(qty) || 0)), MAX_REROLLS_PER_TX);
            if (capsules <= 0) continue;
            parsedBurns.push({ tier, capsules, pinsNeeded: BURN_COST[tier] * capsules });
            totalCapsules += capsules;
        }

        if (totalCapsules <= 0 || totalCapsules > MAX_REROLLS_PER_TX) {
            return NextResponse.json({ error: 'Invalid burn quantities' }, { status: 400 });
        }

        const username = (session.username as string).toLowerCase();
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedTxHash = txHash.toLowerCase();
        const totalVibestrCost = String(VIBESTR_PER_REROLL * totalCapsules);

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
                return await fail(400, `Not enough ${tierName} duplicates. Need ${burn.pinsNeeded}, have ${available}.`);
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

        // Execute the burn plan
        for (const { id, toBurn } of burnPlan) {
            pinbook.pins[id].count -= toBurn;
        }

        // Grant capsules
        pinbook.capsules += totalCapsules;
        pinbook.totalEarned += totalCapsules;

        await kv.set(pinbookKey, pinbook);

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
