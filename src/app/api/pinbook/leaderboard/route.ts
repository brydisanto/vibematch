import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { BADGES, BadgeTier } from '@/lib/badges';

// Tier → point value for Pin Score
const TIER_POINTS: Record<BadgeTier, number> = { blue: 1, silver: 2, gold: 3, cosmic: 4 };
const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));

const LEADERBOARD_KEY = 'pinbook:leaderboard';
const TOTAL_BADGES = BADGES.length;

export interface LeaderboardEntry {
    username: string;
    avatarUrl: string;
    uniqueCount: number;
    totalPins: number;
    percentComplete: number;
    pinScore: number;
}

// Called from the collect action in /api/pinbook to update a single user's entry
export function computeUserEntry(
    username: string,
    avatarUrl: string,
    pins: Record<string, { count: number }>,
): LeaderboardEntry {
    const uniqueCount = Object.keys(pins).length;
    const totalPins = Object.values(pins).reduce((sum, p) => sum + p.count, 0);
    const percentComplete = Math.round((uniqueCount / TOTAL_BADGES) * 100);

    let pinScore = 0;
    for (const [badgeId, pin] of Object.entries(pins)) {
        const tier = badgeTierMap.get(badgeId) || 'blue';
        pinScore += pin.count * TIER_POINTS[tier];
    }

    return { username, avatarUrl, uniqueCount, totalPins, percentComplete, pinScore };
}

export async function updateLeaderboardEntry(entry: LeaderboardEntry): Promise<void> {
    const existing = (await kv.get(LEADERBOARD_KEY)) as LeaderboardEntry[] | null ?? [];

    // Replace or add this user's entry
    const idx = existing.findIndex(e => e.username.toLowerCase() === entry.username.toLowerCase());
    if (idx >= 0) {
        existing[idx] = entry;
    } else {
        existing.push(entry);
    }

    // Sort
    existing.sort((a, b) =>
        b.percentComplete - a.percentComplete ||
        b.pinScore - a.pinScore ||
        b.uniqueCount - a.uniqueCount ||
        b.totalPins - a.totalPins
    );

    await kv.set(LEADERBOARD_KEY, existing);
}

// GET — single KV read, no scanning
export async function GET() {
    try {
        const [leaderboard, session] = await Promise.all([
            kv.get(LEADERBOARD_KEY) as Promise<LeaderboardEntry[] | null>,
            getSession(),
        ]);

        // Strip avatar data from response — avatars are lazy-loaded client-side
        // to avoid the single leaderboard key exceeding Upstash 10MB limit
        const lb = (leaderboard || []).map(e => ({ ...e, avatarUrl: '' }));
        return NextResponse.json(
            { leaderboard: lb, totalPlayers: lb.length, currentUsername: session?.username || null },
            { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } }
        );
    } catch (e) {
        console.error('PinBook leaderboard error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE — wipe all pinbook data and leaderboard (admin reset)
export async function DELETE() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Scan for all pinbook keys (user data + daily trackers + leaderboard)
        const allKeys: string[] = [];
        let cursor: any = 0;
        do {
            const result = await kv.scan(cursor, { match: 'pinbook:*', count: 100 }) as any;
            cursor = result[0];
            for (const key of result[1] as string[]) {
                allKeys.push(key);
            }
        } while (cursor != 0);

        // Delete all in batches
        if (allKeys.length > 0) {
            await kv.del(...allKeys);
        }

        return NextResponse.json({ wiped: true, keysDeleted: allKeys.length });
    } catch (e) {
        console.error('Pinbook wipe error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST — rebuild leaderboard from all pinbook data (one-time migration)
export async function POST() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const allKeys: string[] = [];
        let cursor: any = 0;
        do {
            const result = await kv.scan(cursor, { match: 'pinbook:*', count: 100 }) as any;
            cursor = result[0];
            for (const key of result[1] as string[]) {
                if (!key.includes(':daily:') && !key.includes(':leaderboard')) allKeys.push(key);
            }
        } while (cursor != 0);

        if (allKeys.length === 0) {
            return NextResponse.json({ rebuilt: true, count: 0 });
        }

        const pinbooks = await kv.mget(...allKeys);
        const profileKeys = allKeys.map(k => `user:${k.replace('pinbook:', '')}`);
        const profiles = await kv.mget(...profileKeys);

        const entries: LeaderboardEntry[] = [];
        for (let i = 0; i < allKeys.length; i++) {
            const data = pinbooks[i] as any;
            const profile = profiles[i] as any;
            if (!data?.pins) continue;

            const username = profile?.username || allKeys[i].replace('pinbook:', '');
            const avatarUrl = profile?.avatarUrl || '';
            entries.push(computeUserEntry(username, avatarUrl, data.pins));
        }

        entries.sort((a, b) =>
            b.percentComplete - a.percentComplete ||
            b.pinScore - a.pinScore ||
            b.uniqueCount - a.uniqueCount ||
            b.totalPins - a.totalPins
        );

        await kv.set(LEADERBOARD_KEY, entries);
        return NextResponse.json({ rebuilt: true, count: entries.length });
    } catch (e) {
        console.error('Leaderboard rebuild error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
