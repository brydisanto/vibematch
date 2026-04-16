import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { computeUserEntry, updateLeaderboardEntry } from './leaderboard/route';
import { BADGES, type Badge, type BadgeTier } from '@/lib/badges';

// Maximum plausible score for a classic game — reject forged submissions above this.
const MAX_PLAUSIBLE_SCORE = 500_000;

// Rarity weights for capsule drops
// 101 total: 19 blue, 51 silver, 9 special, 19 gold, 3 cosmic
const TIER_WEIGHTS = {
    blue: 45,      // ~45% Common (19 badges)
    silver: 30,    // ~30% Rare (51 badges)
    special: 13,   // ~13% Strategic Special (9 badges, weighted drops within)
    gold: 9,       // ~9% Legendary (19 badges)
    cosmic: 3,     // ~3% Cosmic (3 badges)
} as const;

const CAPSULE_SCORE_THRESHOLD = 15000;
const CLASSIC_DAILY_CAP = 10;
export const MAX_BONUS_PRIZE_GAMES_PER_DAY = 10;

export interface PinBookData {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number; // unopened
    totalOpened: number;
    totalEarned: number;
}

interface DailyTracker {
    classicPlays: number;
    date: string;
    bonusPrizeGames?: number; // additional prize games purchased today
}

export function getTodayKey(username: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `pinbook:${username}:daily:${today}`;
}

export async function getDailyTracker(username: string): Promise<DailyTracker> {
    const key = getTodayKey(username);
    const data = await kv.get(key) as DailyTracker | null;
    const today = new Date().toISOString().slice(0, 10);
    if (data && data.date === today) return { bonusPrizeGames: 0, ...data };
    return { classicPlays: 0, date: today, bonusPrizeGames: 0 };
}

async function incrementClassicPlays(username: string): Promise<DailyTracker> {
    // Ensure the tracker exists with today's date (so bonusPrizeGames isn't lost on rollover)
    const key = getTodayKey(username);
    const existing = await getDailyTracker(username);
    const updated: DailyTracker = {
        classicPlays: existing.classicPlays + 1,
        date: existing.date,
        bonusPrizeGames: existing.bonusPrizeGames || 0,
    };
    await kv.set(key, updated, { ex: 86400 * 2 });
    return updated;
}

function emptyPinBook(): PinBookData {
    return { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 };
}

// Per-user lock backed by KV (works across serverless instances).
// In-memory map is kept as a fast path for same-instance concurrency.
const userLocks = new Map<string, Promise<any>>();
async function withUserLock<T>(username: string, fn: () => Promise<T>): Promise<T> {
    // KV lock: set NX with short TTL, retry briefly if contested
    const lockKey = `lock:pinbook:${username}`;
    const maxAttempts = 10;
    let attempts = 0;
    while (attempts < maxAttempts) {
        const acquired = await kv.set(lockKey, '1', { nx: true, ex: 5 });
        if (acquired) break;
        attempts++;
        await new Promise(r => setTimeout(r, 100));
    }
    if (attempts >= maxAttempts) {
        throw new Error('Could not acquire user lock after retries');
    }

    // In-memory serialization for same-instance concurrency
    const prev = userLocks.get(username) || Promise.resolve();
    const next = prev.then(fn, fn);
    userLocks.set(username, next);
    try {
        return await next;
    } finally {
        await kv.del(lockKey).catch(() => {});
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

        const tracker = await getDailyTracker(username);
        return NextResponse.json({
            ...(data || emptyPinBook()),
            classicPlays: tracker.classicPlays,
            bonusPrizeGames: tracker.bonusPrizeGames || 0,
        });
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
            // Track a game started (classic or daily). Issue a one-shot match token
            // that earn/bonus must present to get capsules. Each token represents
            // exactly one physical game the client has started.
            const gameMode = (body.gameMode as string) || 'classic';
            const today = new Date().toISOString().slice(0, 10);

            // Daily: atomically set the daily_played marker at game START, not game END.
            // This prevents the "refresh mid-daily to get a fresh board" exploit.
            if (gameMode === 'daily') {
                const playedKey = `daily_played:${username}:${today}`;
                const acquired = await kv.set(playedKey, '1', { nx: true, ex: 86400 * 2 });
                if (!acquired) {
                    return NextResponse.json({ error: 'Daily already played today' }, { status: 400 });
                }
            }

            // Mid-game refresh penalty: if the previous match was created <5 min ago
            // and never received a logGame, mark it abandoned AND make the new match
            // ineligible for capsules. Prevents board-shopping via refresh.
            const ABANDON_WINDOW_MS = 5 * 60 * 1000;
            const activePointerKey = `pinbook:${username}:activeMatch`;
            const previousMatchId = await kv.get(activePointerKey) as string | null;
            let abandonedPrevious = false;
            if (previousMatchId) {
                const prevMatchKey = `pinbook:${username}:match:${previousMatchId}`;
                const prev = await kv.get(prevMatchKey) as any;
                if (prev && !prev.logged && Date.now() - (prev.createdAt ?? 0) < ABANDON_WINDOW_MS) {
                    // Burn the previous match — no capsules from it retroactively.
                    await kv.set(prevMatchKey, { ...prev, abandoned: true, prizeEligible: false }, { ex: 60 * 60 * 2 });
                    abandonedPrevious = true;
                }
            }

            // Classic: count plays toward the daily cap. Daily games don't count.
            let capped = false;
            let classicPlays = 0;
            if (gameMode === 'classic') {
                const tracker = await incrementClassicPlays(username);
                const effectiveCap = CLASSIC_DAILY_CAP + (tracker.bonusPrizeGames || 0);
                capped = tracker.classicPlays > effectiveCap;
                classicPlays = tracker.classicPlays;
            }

            // Generate match token. Bound to user and single-use.
            const matchId = crypto.randomUUID();
            const matchKey = `pinbook:${username}:match:${matchId}`;
            // prizeEligible: false if capped OR if this is a refresh within 5 min of a prior game.
            const prizeEligible = !capped && !abandonedPrevious;
            await kv.set(matchKey, {
                username,
                gameMode,
                createdAt: Date.now(),
                earnedCapsule: false,
                earnedBonus: false,
                logged: false,
                prizeEligible,
                abandonedPrevious,
            }, { ex: 60 * 60 * 2 }); // 2 hour window

            // Point the active match pointer at the new matchId.
            await kv.set(activePointerKey, matchId, { ex: 60 * 60 * 2 });

            return NextResponse.json({
                tracked: true,
                classicPlays,
                capped,
                abandonedPrevious,
                matchId,
            });

        } else if (body.action === 'logGame') {
            // Log a completed game for admin forensics AND for server-side achievement
            // verification. Stats are client-reported; bounded for sanity. Match-token
            // validated games are additionally stored keyed by matchId so the achievements
            // endpoint can verify gameplay achievements against authoritative stats.
            const matchId = body.matchId as string | undefined;
            const gameMode = body.gameMode as string || 'classic';
            const stats = body.stats as {
                score?: number;
                matchCount?: number;
                maxCombo?: number;
                totalCascades?: number;
                bombsCreated?: number;
                vibestreaksCreated?: number;
                cosmicBlastsCreated?: number;
                crossCount?: number;
                shapesLanded?: Array<{ type: string; count: number }>;
                gameOverReason?: string;
            } | undefined;

            if (!stats || typeof stats !== 'object') {
                return NextResponse.json({ error: 'Missing stats' }, { status: 400 });
            }

            // Sanity-bound every numeric stat so forged payloads can't bloat storage
            const safeNum = (v: unknown, max: number) => {
                const n = Number(v);
                if (!Number.isFinite(n) || n < 0) return 0;
                return Math.min(n, max);
            };

            // Sanitize shapesLanded (only L, T, cross types; bounded count)
            const ALLOWED_SHAPES = new Set(['L', 'T', 'cross']);
            const safeShapes: Array<{ type: string; count: number }> = [];
            if (Array.isArray(stats.shapesLanded)) {
                for (const s of stats.shapesLanded.slice(0, 10)) {
                    if (s && typeof s === 'object' && typeof s.type === 'string' && ALLOWED_SHAPES.has(s.type)) {
                        safeShapes.push({ type: s.type, count: safeNum(s.count, 1000) });
                    }
                }
            }

            const safeStats = {
                score: safeNum(stats.score, MAX_PLAUSIBLE_SCORE),
                matchCount: safeNum(stats.matchCount, 10_000),
                maxCombo: safeNum(stats.maxCombo, 100),
                totalCascades: safeNum(stats.totalCascades, 1_000),
                bombsCreated: safeNum(stats.bombsCreated, 1_000),
                vibestreaksCreated: safeNum(stats.vibestreaksCreated, 1_000),
                cosmicBlastsCreated: safeNum(stats.cosmicBlastsCreated, 1_000),
                crossCount: safeNum(stats.crossCount, 1_000),
                shapesLanded: safeShapes,
                gameOverReason: typeof stats.gameOverReason === 'string' ? stats.gameOverReason.slice(0, 50) : 'unknown',
            };

            // If a matchId is provided, validate it and mark the match as logged
            // (so a subsequent trackGame within 5min doesn't treat it as abandoned).
            // Also clear the activeMatch pointer for this user.
            let validatedMatch = false;
            if (matchId && typeof matchId === 'string') {
                const matchKey = `pinbook:${username}:match:${matchId}`;
                const match = await kv.get(matchKey) as any;
                if (match && match.username === username) {
                    validatedMatch = gameMode === 'classic';
                    await kv.set(matchKey, { ...match, logged: true }, { ex: 60 * 60 * 2 });
                    const activePointerKey = `pinbook:${username}:activeMatch`;
                    const activePointer = await kv.get(activePointerKey);
                    if (activePointer === matchId) {
                        await kv.del(activePointerKey);
                    }
                }
            }

            const logEntry = {
                username,
                gameMode,
                ...safeStats,
                matchId: matchId || null,
                validatedMatch,
                timestamp: Date.now(),
            };

            // Sorted set keyed by timestamp for easy pagination
            const logKey = `gamelog:${username}`;
            await kv.zadd(logKey, { score: Date.now(), member: JSON.stringify(logEntry) });
            const count = await kv.zcard(logKey);
            if (count > 500) {
                await kv.zremrangebyrank(logKey, 0, count - 501);
            }

            // Also store by matchId for achievement verification lookup.
            // Classic: keyed by the validated match token. Daily: keyed by a server-derived
            // daily match key so we can still verify daily gameplay achievements.
            if (validatedMatch && matchId) {
                await kv.set(`matchstats:${username}:${matchId}`, logEntry, { ex: 60 * 60 * 2 });
            } else if (gameMode === 'daily') {
                const today = new Date().toISOString().split('T')[0];
                await kv.set(`matchstats:${username}:daily:${today}`, logEntry, { ex: 86400 * 2 });
            }

            return NextResponse.json({ logged: true });

        } else if (body.action === 'earn') {
            const score = body.score as number;
            const matchId = body.matchId as string | undefined;
            const gameMode = body.gameMode as string || 'classic';

            // Validate score is a plausible number
            if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > MAX_PLAUSIBLE_SCORE) {
                return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
            }

            if (score < CAPSULE_SCORE_THRESHOLD) {
                return NextResponse.json({ earned: false, reason: 'Score below threshold' });
            }

            // Tiered capsule rewards
            const capsuleCount = score >= 50000 ? 3 : score >= 30000 ? 2 : 1;

            if (gameMode === 'classic') {
                // Classic: require a valid single-use match token from trackGame
                if (!matchId || typeof matchId !== 'string') {
                    console.error(`[earn] Missing matchId for user=${username} score=${score} mode=${gameMode}`);
                    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
                }
                const matchKey = `pinbook:${username}:match:${matchId}`;
                const match = await kv.get(matchKey) as any;
                if (!match || match.username !== username) {
                    console.error(`[earn] Invalid match token for user=${username} matchId=${matchId} match=${JSON.stringify(match)}`);
                    return NextResponse.json({ error: 'Invalid or expired match token' }, { status: 400 });
                }
                if (match.earnedCapsule) {
                    return NextResponse.json({ error: 'Capsule already claimed for this match' }, { status: 400 });
                }
                if (!match.prizeEligible) {
                    return NextResponse.json({ earned: false, reason: 'Match was outside prize cap', capped: true });
                }
                // Atomically mark the match as claimed
                await kv.set(matchKey, { ...match, earnedCapsule: true }, { ex: 60 * 60 * 2 });
                data.capsules += capsuleCount;
                data.totalEarned += capsuleCount;
            } else if (gameMode === 'daily') {
                // Daily: require that the daily_played marker exists for today
                const today = new Date().toISOString().split('T')[0];
                const playedKey = `daily_played:${username}:${today}`;
                const hasPlayed = await kv.get(playedKey);
                if (!hasPlayed) {
                    return NextResponse.json({ error: 'Daily challenge not played yet' }, { status: 400 });
                }
                // Also require single-use: only one daily capsule grant per day
                const dailyEarnedKey = `daily_earned:${username}:${today}`;
                const alreadyEarned = await kv.set(dailyEarnedKey, '1', { nx: true, ex: 86400 * 2 });
                if (!alreadyEarned) {
                    return NextResponse.json({ error: 'Daily capsule already claimed' }, { status: 400 });
                }
                data.capsules += capsuleCount * 2;
                data.totalEarned += capsuleCount * 2;
            } else {
                return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 });
            }

            await kv.set(key, data);
            return NextResponse.json({ earned: true, capsules: data.capsules, gameMode });

        } else if (body.action === 'bonus') {
            // Bonus capsule — awarded for T/cross shapes during gameplay.
            // Also requires a match token (one bonus per match, like earn).
            const matchId = body.matchId as string | undefined;
            const gameMode = body.gameMode as string || 'classic';

            if (gameMode === 'classic') {
                if (!matchId || typeof matchId !== 'string') {
                    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
                }
                const matchKey = `pinbook:${username}:match:${matchId}`;
                const match = await kv.get(matchKey) as any;
                if (!match || match.username !== username) {
                    return NextResponse.json({ error: 'Invalid or expired match token' }, { status: 400 });
                }
                if (match.earnedBonus) {
                    return NextResponse.json({ error: 'Bonus already claimed for this match' }, { status: 400 });
                }
                if (!match.prizeEligible) {
                    return NextResponse.json({ earned: false, reason: 'Match was outside prize cap', capped: true });
                }
                await kv.set(matchKey, { ...match, earnedBonus: true }, { ex: 60 * 60 * 2 });
                data.capsules += 1;
                data.totalEarned += 1;
            } else if (gameMode === 'daily') {
                const today = new Date().toISOString().split('T')[0];
                const playedKey = `daily_played:${username}:${today}`;
                const hasPlayed = await kv.get(playedKey);
                if (!hasPlayed) {
                    return NextResponse.json({ error: 'Daily challenge not played yet' }, { status: 400 });
                }
                const dailyBonusKey = `daily_bonus:${username}:${today}`;
                const claimed = await kv.set(dailyBonusKey, '1', { nx: true, ex: 86400 * 2 });
                if (!claimed) {
                    return NextResponse.json({ error: 'Daily bonus already claimed' }, { status: 400 });
                }
                data.capsules += 2;
                data.totalEarned += 2;
            } else {
                return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 });
            }

            await kv.set(key, data);
            return NextResponse.json({ earned: true, capsules: data.capsules, gameMode });

        } else if (body.action === 'open') {
            if (data.capsules <= 0) {
                return NextResponse.json({ error: 'No capsules to open' }, { status: 400 });
            }

            // Reject opening if a pending reveal already exists
            const pendingKey = `pinbook:${username}:pending`;
            const existingPending = await kv.get(pendingKey);
            if (existingPending) {
                return NextResponse.json({ error: 'A pending capsule is already open' }, { status: 400 });
            }

            // Pick a random tier based on weights (server-side)
            const roll = Math.random() * 100;
            let cumulative = 0;
            let tier: BadgeTier = 'blue';
            for (const [t, w] of Object.entries(TIER_WEIGHTS) as [BadgeTier, number][]) {
                cumulative += w;
                if (roll < cumulative) { tier = t; break; }
            }

            // Pick a specific badge from that tier.
            // For the "special" tier, use per-badge dropWeight for weighted selection
            // (Diamond/Cosmic VIBESTR badges are much rarer within this tier).
            const tierBadges = BADGES.filter(b => b.tier === tier);
            if (tierBadges.length === 0) {
                return NextResponse.json({ error: 'No badges available for tier' }, { status: 500 });
            }
            let badge: Badge;
            const hasWeights = tierBadges.some(b => b.dropWeight !== undefined);
            if (hasWeights) {
                // Weighted random selection within the tier
                const totalWeight = tierBadges.reduce((s, b) => s + (b.dropWeight ?? 10), 0);
                let weightRoll = Math.random() * totalWeight;
                badge = tierBadges[tierBadges.length - 1]; // fallback
                for (const b of tierBadges) {
                    weightRoll -= (b.dropWeight ?? 10);
                    if (weightRoll <= 0) { badge = b; break; }
                }
            } else {
                badge = tierBadges[Math.floor(Math.random() * tierBadges.length)];
            }

            // Store pending reveal so collect can validate it
            await kv.set(pendingKey, {
                tier,
                badgeId: badge.id,
                openedAt: Date.now(),
            }, { ex: 60 * 5 }); // 5 minute window to collect

            // Decrement capsule count
            data.capsules -= 1;
            data.totalOpened += 1;
            await kv.set(key, data);

            return NextResponse.json({
                opened: true,
                tier,
                badgeId: badge.id,
                capsules: data.capsules,
                totalOpened: data.totalOpened,
            });

        } else if (body.action === 'collect') {
            // Server validates the badge against the pending reveal
            const badgeId = body.badgeId as string;
            if (!badgeId || typeof badgeId !== 'string') {
                return NextResponse.json({ error: 'Missing badgeId' }, { status: 400 });
            }

            const pendingKey = `pinbook:${username}:pending`;
            const pending = await kv.get(pendingKey) as { tier: string; badgeId: string; openedAt: number } | null;
            if (!pending) {
                return NextResponse.json({ error: 'No pending capsule to collect' }, { status: 400 });
            }
            if (pending.badgeId !== badgeId) {
                return NextResponse.json({ error: 'Badge does not match pending capsule' }, { status: 400 });
            }

            // Double-check: badge actually exists in catalog with matching tier
            const badgeDef = BADGES.find(b => b.id === badgeId);
            if (!badgeDef || badgeDef.tier !== pending.tier) {
                return NextResponse.json({ error: 'Invalid badge' }, { status: 400 });
            }

            // Consume the pending reveal atomically
            await kv.del(pendingKey);

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
