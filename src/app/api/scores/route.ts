import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession, isUserBanned } from '@/lib/auth';
import { rateLimit, rateLimited429 } from '@/lib/rate-limit';
import { getEasternDailyKey } from '@/lib/daily-window';
import { FRENZY_MIN_ROUND_MS, FRENZY_MAX_MS } from '@/lib/gameEngine';

// Maximum plausible score for a classic game — used to reject obviously-forged submissions.
// Well above any realistic game total given 30 moves + max combos. Bumped
// from 500K alongside the scoring system change (base scores +50%, combo
// multiplier 0.75x → 1.0x).
const MAX_PLAUSIBLE_SCORE = 800_000;
// Frenzy ceiling: a god-tier 60s round with full bonus-time + heat 2x
// sustained shouldn't crack ~300K. 500K leaves headroom for tuning the
// scoring math without us needing to bump this immediately.
const MAX_PLAUSIBLE_FRENZY_SCORE = 500_000;
// Generous upper bound on round duration. Clock cap is 2:30 (FRENZY_MAX_MS),
// plus board-load grace + final cascade resolving = ~30s buffer.
const MAX_FRENZY_ROUND_MS = FRENZY_MAX_MS + 30_000;

function getMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

// --- In-memory cache ---
// Per-user GET responses cache for 15s (each user gets their own variant,
// so cache hit rate per-entry is lower). Anonymous (no-username) GETs
// cache for 60s — they're identical across all unauthenticated callers
// and we add a CDN s-maxage header so Vercel's edge serves them directly.
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 15_000;
const CACHE_TTL_PUBLIC = 60_000;

export function invalidateLeaderboardCache() {
    for (const [key] of cache) {
        if (key.startsWith('leaderboard:')) cache.delete(key);
    }
}

function getCached(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key: string, data: any, ttlMs: number = CACHE_TTL) {
    cache.set(key, { data, expires: Date.now() + ttlMs });
}

export async function POST(req: Request) {
    try {
        // Auth required — derive username from session, never from body
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { mode, score, matchId, roundStartedAt, roundEndedAt } = await req.json();

        if (!mode || score === undefined) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (mode !== 'classic' && mode !== 'daily' && mode !== 'frenzy') {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        // Per-mode score ceiling.
        const scoreCap = mode === 'frenzy' ? MAX_PLAUSIBLE_FRENZY_SCORE : MAX_PLAUSIBLE_SCORE;
        if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > scoreCap) {
            return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
        }

        // Frenzy anti-cheat: the client sends start + end timestamps. A
        // submission that claims to have completed faster than
        // FRENZY_MIN_ROUND_MS, or longer than MAX_FRENZY_ROUND_MS, is
        // rejected. Replayed payloads or scripted "finished in 0ms"
        // submissions don't pass.
        if (mode === 'frenzy') {
            if (typeof roundStartedAt !== 'number' || typeof roundEndedAt !== 'number') {
                return NextResponse.json({ error: 'Missing round timestamps' }, { status: 400 });
            }
            const elapsed = roundEndedAt - roundStartedAt;
            if (!Number.isFinite(elapsed) || elapsed < FRENZY_MIN_ROUND_MS || elapsed > MAX_FRENZY_ROUND_MS) {
                return NextResponse.json({ error: 'Implausible round duration' }, { status: 400 });
            }
        }

        const sessionUsername = session.username as string;

        // Banned users can't post scores even with a valid session.
        if (await isUserBanned(sessionUsername)) {
            return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
        }

        // Rate limit: 12 score submissions / minute / user. A normal
        // 30-move classic round takes 30+ seconds even for fast players,
        // so 12/min is already 5x typical throughput. Caps a buggy
        // client or hostile actor from flooding the leaderboard zsets.
        const rl = await rateLimit({ scope: 'score', key: sessionUsername.toLowerCase(), max: 12, windowSec: 60 });
        if (!rl.ok) {
            const r = rateLimited429(rl, 'score');
            return NextResponse.json(r.body, r.init);
        }

        // Ensure canonical casing from profile
        const profileKey = `user:${sessionUsername.toLowerCase()}`;
        const profile = await kv.get(profileKey) as any;
        const canonicalUsername = profile?.username || sessionUsername;
        const username = sessionUsername; // body.username ignored
        const hasCaseVariant = canonicalUsername !== username;

        let isNewBest = false;
        let isNewAllTimeHigh = false;

        if (mode === 'classic') {
            const weeklyKey = `classic_weekly:${getMonday()}`;

            // Prize eligibility gate: classic matches played outside the
            // daily prize cap (or invalidated by the abandoned-match rule)
            // are "extra plays". They still get a response for the client
            // to display a score, but they don't write to the all-time or
            // weekly leaderboards — extras aren't allowed to influence
            // rankings, matching how they're already blocked from
            // awarding capsules.
            let leaderboardSkipped = false;
            let skipReason: string | null = null;
            if (matchId && typeof matchId === 'string') {
                const matchKey = `pinbook:${username.toLowerCase()}:match:${matchId}`;
                const match = await kv.get(matchKey) as { username?: string; prizeEligible?: boolean; abandonedPrevious?: boolean } | null;
                if (match && match.username === username.toLowerCase() && match.prizeEligible === false) {
                    leaderboardSkipped = true;
                    skipReason = match.abandonedPrevious ? 'previous-match-abandoned' : 'daily-cap-exceeded';
                }
            }

            if (leaderboardSkipped) {
                // Still bump the matches-played counter for admin visibility,
                // but never touch the leaderboard zsets.
                await kv.hincrby('classic_matches_played', canonicalUsername.toLowerCase(), 1);
                return NextResponse.json({
                    success: true,
                    isNewBest: false,
                    isNewAllTimeHigh: false,
                    leaderboardSkipped: true,
                    skipReason,
                });
            }

            // Pipeline: fetch current scores in a single round trip
            const readPipe = kv.pipeline();
            readPipe.zscore('classic_leaderboard', canonicalUsername);
            if (hasCaseVariant) readPipe.zscore('classic_leaderboard', username);
            if (hasCaseVariant) readPipe.zscore(weeklyKey, username);
            const readResults = await readPipe.exec();

            let ri = 0;
            const currentScore1 = readResults[ri++] as number | null;
            const currentScore2 = hasCaseVariant ? readResults[ri++] as number | null : null;
            const currentWeekly2 = hasCaseVariant ? readResults[ri++] as number | null : null;

            const maxCurrent = Math.max(Number(currentScore1 || 0), Number(currentScore2 || 0));
            isNewBest = maxCurrent === 0 || score > maxCurrent;

            // Pipeline: write scores + increment match count + cleanup in a single round trip
            const writePipe = kv.pipeline();
            writePipe.zadd('classic_leaderboard', { gt: true } as any, { score, member: canonicalUsername });
            writePipe.zadd(weeklyKey, { gt: true } as any, { score, member: canonicalUsername });
            writePipe.hincrby('classic_matches_played', canonicalUsername.toLowerCase(), 1);
            if (hasCaseVariant && currentScore2 !== null) {
                writePipe.zrem('classic_leaderboard', username);
            }
            if (hasCaseVariant && currentWeekly2 !== null) {
                writePipe.zrem(weeklyKey, username);
            }
            await writePipe.exec();

            // Check if this is now the all-time #1 score
            const top1 = await kv.zrange('classic_leaderboard', 0, 0, { rev: true, withScores: true });
            if (top1 && top1.length > 0) {
                const topEntry = top1[0] as any;
                const topScore = Number(topEntry.score ?? topEntry);
                const topMember = (topEntry.member || topEntry.value || '').toString().toLowerCase();
                if (topScore === score && topMember === canonicalUsername.toLowerCase()) {
                    isNewAllTimeHigh = true;
                }
            }

            // Invalidate GET cache for affected leaderboards
            for (const [key] of cache) {
                if (key.startsWith('leaderboard:')) cache.delete(key);
            }
        } else if (mode === 'frenzy') {
            const today = getEasternDailyKey();

            // Pipeline current all-time + daily scores for canonical + variant casing.
            const readPipe = kv.pipeline();
            readPipe.zscore('frenzy_leaderboard', canonicalUsername);
            if (hasCaseVariant) readPipe.zscore('frenzy_leaderboard', username);
            const readResults = await readPipe.exec();
            const currentAll1 = readResults[0] as number | null;
            const currentAll2 = hasCaseVariant ? readResults[1] as number | null : null;
            const maxCurrentAll = Math.max(Number(currentAll1 || 0), Number(currentAll2 || 0));
            isNewBest = maxCurrentAll === 0 || score > maxCurrentAll;

            const writePipe = kv.pipeline();
            writePipe.zadd('frenzy_leaderboard', { gt: true } as any, { score, member: canonicalUsername });
            writePipe.zadd(`frenzy_daily_leaderboard:${today}`, { gt: true } as any, { score, member: canonicalUsername });
            writePipe.hincrby('frenzy_matches_played', canonicalUsername.toLowerCase(), 1);
            if (hasCaseVariant && currentAll2 !== null) {
                writePipe.zrem('frenzy_leaderboard', username);
            }
            await writePipe.exec();

            const top1 = await kv.zrange('frenzy_leaderboard', 0, 0, { rev: true, withScores: true });
            if (top1 && top1.length > 0) {
                const topEntry = top1[0] as any;
                const topScore = Number(topEntry.score ?? topEntry);
                const topMember = (topEntry.member || topEntry.value || '').toString().toLowerCase();
                if (topScore === score && topMember === canonicalUsername.toLowerCase()) {
                    isNewAllTimeHigh = true;
                }
            }

            for (const [key] of cache) {
                if (key.startsWith('leaderboard:')) cache.delete(key);
            }
        } else if (mode === 'daily') {
            const today = getEasternDailyKey();

            // IMPORTANT: `daily_played:*` is owned by /api/pinbook.trackGame —
            // it marks that the user STARTED today's daily (set atomically at
            // game start to prevent the refresh-to-reroll exploit). We must
            // NOT treat that marker as "score already submitted", or we'd
            // reject every legitimate daily score post and the leaderboard
            // would never update. Use a separate `daily_scored:*` marker
            // whose contract is "score has been written for today".
            const scoredKey = `daily_scored:${canonicalUsername.toLowerCase()}:${today}`;
            const acquired = await kv.set(scoredKey, '1', { nx: true, ex: 86400 * 2 });
            if (!acquired) {
                // User has already submitted today's daily score. Silently
                // acknowledge to avoid surfacing a scary error on a duplicate
                // client retry.
                return NextResponse.json({ success: true, isNewBest: false, isNewAllTimeHigh: false });
            }

            // Use { gt: true } so if a duplicate NX race ever slipped
            // through, only the higher score survives.
            await kv.zadd(`daily_leaderboard:${today}`, { gt: true } as any, { score, member: canonicalUsername });
            isNewBest = true;

            // Invalidate GET cache
            for (const [key] of cache) {
                if (key.startsWith('leaderboard:')) cache.delete(key);
            }
        }

        return NextResponse.json({ success: true, isNewBest, isNewAllTimeHigh });
    } catch (error) {
        console.error('KV error saving score:', error);
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode'); // 'classic' or 'daily'
    const username = searchParams.get('username');
    // skip_avatars param removed — avatars are always lazy-loaded client-side now

    try {
        // Check in-memory cache first. Anonymous (no-username) requests
        // get a longer TTL since they're identical across callers; the
        // CDN s-maxage on the response lets Vercel's edge serve them
        // directly without invoking this function at all.
        const cacheKey = `leaderboard:${mode}:${username || ''}`;
        const isPublic = !username;
        const cdnHeader = isPublic
            ? 'public, s-maxage=60, stale-while-revalidate=180'
            : 'public, s-maxage=15, stale-while-revalidate=60';
        const cached = getCached(cacheKey);
        if (cached) {
            return NextResponse.json(cached, { headers: { 'Cache-Control': cdnHeader } });
        }

        let leaderboard: any = [];
        let leaderboardKey = '';
        const today = getEasternDailyKey();

        if (mode === 'classic') {
            leaderboardKey = 'classic_leaderboard';
        } else if (mode === 'weekly') {
            leaderboardKey = `classic_weekly:${getMonday()}`;
        } else if (mode === 'daily') {
            leaderboardKey = `daily_leaderboard:${today}`;
        } else if (mode === 'frenzy') {
            leaderboardKey = 'frenzy_leaderboard';
        } else if (mode === 'frenzy_daily') {
            leaderboardKey = `frenzy_daily_leaderboard:${today}`;
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        // Resolve canonical username in parallel with leaderboard fetch + total count
        let canonicalUsername: string | null = null;
        const leaderboardPromise = kv.zrange(leaderboardKey, 0, 49, { rev: true, withScores: true });
        const totalPlayersPromise = kv.zcard(leaderboardKey);
        const profilePromise = username
            ? kv.get(`user:${username.toLowerCase()}`)
            : Promise.resolve(null);

        const [rawLeaderboard, totalPlayers, userProfile] = await Promise.all([leaderboardPromise, totalPlayersPromise, profilePromise]);
        leaderboard = rawLeaderboard;

        if (username) {
            canonicalUsername = (userProfile as any)?.username || username;
        }

        // Normalize format
        let formatted: { member: string, score: number }[] = [];
        if (leaderboard.length > 0) {
            if (typeof leaderboard[0] === 'object' && leaderboard[0] !== null) {
                formatted = leaderboard.map((entry: any) => ({
                    member: entry.member || entry.value,
                    score: Number(entry.score)
                }));
            } else {
                for (let i = 0; i < leaderboard.length; i += 2) {
                    formatted.push({ member: String(leaderboard[i]), score: Number(leaderboard[i + 1]) });
                }
            }
        }

        // Deduplicate case-insensitively, keeping the highest score
        const uniqueEntriesMap = new Map<string, { member: string, score: number }>();
        for (const entry of formatted) {
            const memberStr = entry.member;
            const lowerMember = memberStr.toLowerCase();
            if (!uniqueEntriesMap.has(lowerMember) || entry.score > uniqueEntriesMap.get(lowerMember)!.score) {
                uniqueEntriesMap.set(lowerMember, entry);
            }
        }

        // Convert back to array, sort descending, and take top 50
        let uniqueFormatted = Array.from(uniqueEntriesMap.values());
        uniqueFormatted.sort((a, b) => b.score - a.score);
        formatted = uniqueFormatted.slice(0, 50);

        // Check if the current user is already in the top 50
        let personalBest: number | null = null;
        let userRank: number | null = null;
        let userInTop = false;
        let nextPlayer: { username: string; score: number } | null = null;

        if (canonicalUsername) {
            const lowerCanonical = canonicalUsername.toLowerCase();
            const topIndex = formatted.findIndex(e => e.member.toLowerCase() === lowerCanonical);
            if (topIndex !== -1) {
                userInTop = true;
                personalBest = formatted[topIndex].score;
                userRank = topIndex + 1;
                // Next player to beat is the one above in the list
                if (topIndex > 0) {
                    nextPlayer = { username: formatted[topIndex - 1].member, score: formatted[topIndex - 1].score };
                }
            } else {
                // User not in top 50 — pipeline their score + rank in a single round trip
                const pipe = kv.pipeline();
                pipe.zscore(leaderboardKey, canonicalUsername);
                if (canonicalUsername !== username) {
                    pipe.zscore(leaderboardKey, username!);
                }
                pipe.zrevrank(leaderboardKey, canonicalUsername);
                const pipeResults = await pipe.exec();

                let resultIdx = 0;
                const score1 = pipeResults[resultIdx++] as number | null;
                const score2 = (canonicalUsername !== username) ? pipeResults[resultIdx++] as number | null : null;
                const revRank = pipeResults[resultIdx++] as number | null;
                if (score1 !== null || score2 !== null) {
                    personalBest = Math.max(Number(score1 || 0), Number(score2 || 0));
                }
                if (revRank !== null) {
                    userRank = revRank + 1;
                    // Fetch the player one rank above (revRank - 1 in 0-indexed zrevrange)
                    if (revRank > 0) {
                        const above = await kv.zrange(leaderboardKey, revRank - 1, revRank - 1, { rev: true, withScores: true });
                        if (above && above.length > 0) {
                            const entry = above[0] as any;
                            if (typeof entry === 'object' && entry !== null) {
                                nextPlayer = { username: entry.member || entry.value, score: Number(entry.score) };
                            }
                        }
                    }
                }
            }
        }

        // Fetch total matches played across all users for classic / frenzy
        let totalMatchesPlayed = 0;
        if (mode === 'classic') {
            const allCounts = await kv.hgetall('classic_matches_played') as Record<string, number> | null;
            if (allCounts) {
                totalMatchesPlayed = Object.values(allCounts).reduce((sum, v) => sum + Number(v), 0);
            }
        } else if (mode === 'frenzy') {
            const allCounts = await kv.hgetall('frenzy_matches_played') as Record<string, number> | null;
            if (allCounts) {
                totalMatchesPlayed = Object.values(allCounts).reduce((sum, v) => sum + Number(v), 0);
            }
        }

        const mapped = formatted.map((entry: any) => ({
            username: entry.member || entry.value,
            score: Number(entry.score),
        }));

        let userEntry: any = null;
        if (!userInTop && canonicalUsername && personalBest !== null) {
            userEntry = { username: canonicalUsername, score: personalBest, rank: userRank };
        }

        const responseData = { leaderboard: mapped, personalBest: personalBest ? Number(personalBest) : 0, userRank, userInTop, userEntry, nextPlayer, totalPlayers, totalMatchesPlayed };
        setCached(cacheKey, responseData, isPublic ? CACHE_TTL_PUBLIC : CACHE_TTL);
        return NextResponse.json(
            responseData,
            { headers: { 'Cache-Control': cdnHeader } }
        );
    } catch (error) {
        console.error('KV error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
