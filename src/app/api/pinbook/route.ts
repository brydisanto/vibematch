import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { computeUserEntry, updateLeaderboardEntry } from './leaderboard/route';

// Rarity weights for capsule drops
// 73 total badges: 38 blue, 25 silver, 8 gold, 2 cosmic
const TIER_WEIGHTS = {
    blue: 60,    // ~60%
    silver: 25,  // ~25%
    gold: 12,    // ~12%
    cosmic: 3,   // ~3%
} as const;

const CAPSULE_SCORE_THRESHOLD = 15000;
const CLASSIC_DAILY_CAP = 15;

export interface PinBookData {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number; // unopened
    totalOpened: number;
    totalEarned: number;
}

interface DailyTracker {
    classicPlays: number;
    date: string;
}

function getTodayKey(username: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `pinbook:${username}:daily:${today}`;
}

async function getDailyTracker(username: string): Promise<DailyTracker> {
    const key = getTodayKey(username);
    const data = await kv.get(key) as DailyTracker | null;
    const today = new Date().toISOString().slice(0, 10);
    if (data && data.date === today) return data;
    return { classicPlays: 0, date: today };
}

async function incrementClassicPlays(username: string): Promise<DailyTracker> {
    const tracker = await getDailyTracker(username);
    tracker.classicPlays += 1;
    const key = getTodayKey(username);
    await kv.set(key, tracker, { ex: 86400 * 2 }); // expire after 2 days
    return tracker;
}

function emptyPinBook(): PinBookData {
    return { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 };
}

// Simple per-user lock to prevent concurrent read-modify-write races
const userLocks = new Map<string, Promise<any>>();
async function withUserLock<T>(username: string, fn: () => Promise<T>): Promise<T> {
    const prev = userLocks.get(username) || Promise.resolve();
    const next = prev.then(fn, fn); // run fn after previous completes (even if it failed)
    userLocks.set(username, next);
    try {
        return await next;
    } finally {
        // Clean up if this is still the latest promise
        if (userLocks.get(username) === next) userLocks.delete(username);
    }
}

// GET — fetch pin book for logged-in user
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const username = (session.username as string).toLowerCase();
        const key = `pinbook:${username}`;
        const [data, profile] = await Promise.all([
            kv.get(key) as Promise<PinBookData | null>,
            kv.get(`user:${username}`) as Promise<{ username?: string; avatarUrl?: string } | null>,
        ]);

        // Self-heal: refresh this user's leaderboard entry from their actual pinbook data.
        // This fixes stale entries caused by race conditions in the shared leaderboard key.
        if (data?.pins && Object.keys(data.pins).length > 0) {
            const entry = computeUserEntry(
                profile?.username || username,
                profile?.avatarUrl || '',
                data.pins,
            );
            // Fire-and-forget — don't block the response
            updateLeaderboardEntry(entry).catch(() => {});
        }

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
        const username = (session.username as string).toLowerCase();

        // Serialize all pinbook mutations per user to prevent read-modify-write races
        return await withUserLock(username, async () => {
        const key = `pinbook:${username}`;
        const data = (await kv.get(key)) as PinBookData | null ?? emptyPinBook();

        if (body.action === 'trackGame') {
            // Track a classic game played (win or lose) toward the daily cap

            const tracker = await incrementClassicPlays(username);
            const capped = tracker.classicPlays > CLASSIC_DAILY_CAP;
            return NextResponse.json({ tracked: true, classicPlays: tracker.classicPlays, capped });

        } else if (body.action === 'earn') {
            const score = body.score as number;
            const gameMode = body.gameMode as string || 'classic';

            if (!score || score < CAPSULE_SCORE_THRESHOLD) {
                return NextResponse.json({ earned: false, reason: 'Score below threshold' });
            }



            // Classic mode: enforce daily cap (based on games played, not earned)
            if (gameMode === 'classic') {
                const tracker = await getDailyTracker(username);
                if (tracker.classicPlays > CLASSIC_DAILY_CAP) {
                    return NextResponse.json({ earned: false, reason: 'Daily classic cap reached', capped: true });
                }
                data.capsules += 1;
                data.totalEarned += 1;
            } else {
                // Daily challenge: double capsules
                data.capsules += 2;
                data.totalEarned += 2;
            }

            await kv.set(key, data);
            return NextResponse.json({ earned: true, capsules: data.capsules, gameMode });

        } else if (body.action === 'bonus') {
            // Bonus capsule — awarded for T/cross shapes during gameplay
            // Already limited to 1 per game by client-side bonusCapsuleAwarded flag
            const gameMode = body.gameMode as string || 'classic';


            // Classic mode: check daily cap (bonus is still within a capped game)
            if (gameMode === 'classic') {
                const tracker = await getDailyTracker(username);
                if (tracker.classicPlays > CLASSIC_DAILY_CAP) {
                    return NextResponse.json({ earned: false, reason: 'Daily classic cap reached', capped: true });
                }
                data.capsules += 1;
                data.totalEarned += 1;
            } else {
                // Daily challenge: double bonus
                data.capsules += 2;
                data.totalEarned += 2;
            }

            await kv.set(key, data);
            return NextResponse.json({ earned: true, capsules: data.capsules, gameMode });

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

            // Update pre-computed leaderboard entry

            const profileKey = `user:${username}`;
            const profile = await kv.get(profileKey) as { username?: string; avatarUrl?: string } | null;
            const entry = computeUserEntry(
                profile?.username || username,
                profile?.avatarUrl || '',
                data.pins,
            );
            // Await leaderboard update so it's consistent when client fetches it
            await updateLeaderboardEntry(entry);

            return NextResponse.json({
                collected: true,
                isDuplicate: !!existing,
                count: data.pins[badgeId].count,
                firstEarned: data.pins[badgeId].firstEarned,
                totalCollected: Object.keys(data.pins).length,
            });

        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
        }); // end withUserLock
    } catch (e) {
        console.error('PinBook POST error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
