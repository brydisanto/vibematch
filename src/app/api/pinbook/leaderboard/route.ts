import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { BADGES, BadgeTier } from '@/lib/badges';

// Tier → point value for Pin Score
const TIER_POINTS: Record<BadgeTier, number> = { blue: 1, silver: 2, special: 3, gold: 4, cosmic: 5 };
const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));

// Sorted set for ranking (zadd is atomic — no read-modify-write race)
const RANK_KEY = 'pinbook:lb:rank';
// Per-user entry key prefix (each user writes only their own key — no contention)
const ENTRY_PREFIX = 'pinbook:lb:entry:';
// Legacy key (single JSON array — being replaced)
const LEGACY_KEY = 'pinbook:leaderboard';

const TOTAL_BADGES = BADGES.length;

export interface LeaderboardEntry {
    username: string;
    avatarUrl: string;
    uniqueCount: number;
    totalPins: number;
    percentComplete: number;
    pinScore: number;
}

// Composite score for sorted set ranking.
// Higher = better. Encodes percentComplete (primary), pinScore, uniqueCount, totalPins.
function compositeScore(entry: LeaderboardEntry): number {
    return (
        entry.percentComplete * 1_000_000_000 +
        entry.pinScore * 1_000_000 +
        entry.uniqueCount * 1_000 +
        entry.totalPins
    );
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

// Atomic update: zadd (sorted set) + set (per-user entry). No shared mutable state.
export async function updateLeaderboardEntry(entry: LeaderboardEntry): Promise<void> {
    const score = compositeScore(entry);
    const member = entry.username.toLowerCase();
    const entryKey = `${ENTRY_PREFIX}${member}`;

    await Promise.all([
        kv.zadd(RANK_KEY, { score, member }),
        kv.set(entryKey, entry),
    ]);
}

// GET — read sorted set + per-user entries (race-free)
export async function GET() {
    try {
        const session = await getSession();
        const currentUsername = session?.username || null;

        // Check if new sorted set exists; fall back to legacy key if not yet migrated
        const rankSize = await kv.zcard(RANK_KEY);

        if (rankSize === 0) {
            // Fall back to legacy JSON array
            const leaderboard = await kv.get(LEGACY_KEY) as LeaderboardEntry[] | null;
            const lb = (leaderboard || []).map(e => ({ ...e, avatarUrl: '' }));
            return NextResponse.json(
                { leaderboard: lb, totalPlayers: lb.length, currentUsername },
                { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } }
            );
        }

        // Get all members ordered by score descending (zrange with rev)
        const members = await kv.zrange(RANK_KEY, 0, -1, { rev: true }) as string[];

        if (members.length === 0) {
            return NextResponse.json(
                { leaderboard: [], totalPlayers: 0, currentUsername },
                { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } }
            );
        }

        // Fetch per-user entries individually (avoid mget size limit)
        const lb: LeaderboardEntry[] = [];
        for (const m of members) {
            const entry = await kv.get(`${ENTRY_PREFIX}${m}`) as LeaderboardEntry | null;
            if (entry) {
                lb.push({ ...entry, avatarUrl: '' });
            }
        }

        return NextResponse.json(
            { leaderboard: lb, totalPlayers: lb.length, currentUsername },
            { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } }
        );
    } catch (e) {
        console.error('PinBook leaderboard error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE — wipe all pinbook data and leaderboard (admin only)
export async function DELETE() {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Scan for all pinbook keys (user data + daily trackers + leaderboard entries + legacy)
        const allKeys: string[] = [];
        let cursor: any = 0;
        do {
            const result = await kv.scan(cursor, { match: 'pinbook:*', count: 100 }) as any;
            cursor = result[0];
            for (const key of result[1] as string[]) {
                allKeys.push(key);
            }
        } while (cursor != 0);

        // Delete sorted set + all scanned keys
        if (allKeys.length > 0) {
            await kv.del(...allKeys, RANK_KEY);
        } else {
            await kv.del(RANK_KEY);
        }

        return NextResponse.json({ wiped: true, keysDeleted: allKeys.length + 1 });
    } catch (e) {
        console.error('Pinbook wipe error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST — rebuild leaderboard from all pinbook data (admin only)
export async function POST() {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Find all user pinbook keys (skip daily trackers, leaderboard entries, legacy key)
        const allKeys: string[] = [];
        let cursor: any = 0;
        do {
            const result = await kv.scan(cursor, { match: 'pinbook:*', count: 100 }) as any;
            cursor = result[0];
            for (const key of result[1] as string[]) {
                if (!key.includes(':daily:') && !key.includes(':leaderboard') && !key.startsWith('pinbook:lb:')) {
                    allKeys.push(key);
                }
            }
        } while (cursor != 0);

        if (allKeys.length === 0) {
            return NextResponse.json({ rebuilt: true, count: 0, keys: [] });
        }

        // Clear old sorted set and legacy key
        try { await kv.del(RANK_KEY); } catch { /* may not exist */ }
        try { await kv.del(LEGACY_KEY); } catch { /* may not exist */ }

        let count = 0;
        const rebuilt: string[] = [];

        // Process users one at a time to avoid mget size limits (1MB Upstash cap)
        for (const key of allKeys) {
            const uname = key.replace('pinbook:', '');
            const [data, profile] = await Promise.all([
                kv.get(key) as Promise<any>,
                kv.get(`user:${uname}`) as Promise<any>,
            ]);

            if (!data?.pins || Object.keys(data.pins).length === 0) continue;

            const username = profile?.username || uname;
            const avatarUrl = profile?.avatarUrl || '';
            const entry = computeUserEntry(username, avatarUrl, data.pins);
            const score = compositeScore(entry);
            const member = username.toLowerCase();

            await kv.zadd(RANK_KEY, { score, member });
            await kv.set(`${ENTRY_PREFIX}${member}`, entry);
            rebuilt.push(`${username}: ${entry.uniqueCount} pins, score ${entry.pinScore}`);
            count++;
        }

        return NextResponse.json({ rebuilt: true, count, users: rebuilt });
    } catch (e: any) {
        console.error('Leaderboard rebuild error:', e?.message || e);
        return NextResponse.json({ error: 'Server error', detail: e?.message || String(e) }, { status: 500 });
    }
}
