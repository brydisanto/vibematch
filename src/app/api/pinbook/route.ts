import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Rarity weights for capsule drops
// 73 total badges: 38 blue, 25 silver, 8 gold, 2 cosmic
const TIER_WEIGHTS = {
    blue: 60,    // ~60%
    silver: 25,  // ~25%
    gold: 12,    // ~12%
    cosmic: 3,   // ~3%
} as const;

const CAPSULE_SCORE_THRESHOLD = 15000;

export interface PinBookData {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number; // unopened
    totalOpened: number;
    totalEarned: number;
}

function emptyPinBook(): PinBookData {
    return { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 };
}

// GET — fetch pin book for logged-in user
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const key = `pinbook:${(session.username as string).toLowerCase()}`;
        const data = (await kv.get(key)) as PinBookData | null;

        return NextResponse.json(data || emptyPinBook());
    } catch (e) {
        console.error('PinBook GET error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST — earn capsule or open capsule
// body: { action: "earn", score: number } or { action: "open" }
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const key = `pinbook:${(session.username as string).toLowerCase()}`;
        const data = (await kv.get(key)) as PinBookData | null ?? emptyPinBook();

        if (body.action === 'earn') {
            const score = body.score as number;
            if (!score || score < CAPSULE_SCORE_THRESHOLD) {
                return NextResponse.json({ earned: false, reason: 'Score below threshold' });
            }

            data.capsules += 1;
            data.totalEarned += 1;
            await kv.set(key, data);

            return NextResponse.json({ earned: true, capsules: data.capsules });

        } else if (body.action === 'open') {
            if (data.capsules <= 0) {
                return NextResponse.json({ error: 'No capsules to open' }, { status: 400 });
            }

            // Pick a random tier based on weights
            const roll = Math.random() * 100;
            let tier: string;
            if (roll < TIER_WEIGHTS.cosmic) {
                tier = 'cosmic';
            } else if (roll < TIER_WEIGHTS.cosmic + TIER_WEIGHTS.gold) {
                tier = 'gold';
            } else if (roll < TIER_WEIGHTS.cosmic + TIER_WEIGHTS.gold + TIER_WEIGHTS.silver) {
                tier = 'silver';
            } else {
                tier = 'blue';
            }

            // Return tier + random badge ID from that tier (client picks from BADGES)
            data.capsules -= 1;
            data.totalOpened += 1;
            await kv.set(key, data);

            // We pass back the tier; the client selects the specific badge
            // This keeps the badge list client-side only
            return NextResponse.json({
                opened: true,
                tier,
                capsules: data.capsules,
                totalOpened: data.totalOpened,
            });

        } else if (body.action === 'collect') {
            // Client confirms which badge was revealed — save to pin book
            const badgeId = body.badgeId as string;
            if (!badgeId) {
                return NextResponse.json({ error: 'Missing badgeId' }, { status: 400 });
            }

            const existing = data.pins[badgeId];
            if (existing) {
                existing.count += 1;
            } else {
                data.pins[badgeId] = { count: 1, firstEarned: new Date().toISOString() };
            }

            await kv.set(key, data);

            return NextResponse.json({
                collected: true,
                isDuplicate: !!existing,
                count: data.pins[badgeId].count,
                totalCollected: Object.keys(data.pins).length,
            });

        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (e) {
        console.error('PinBook POST error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
