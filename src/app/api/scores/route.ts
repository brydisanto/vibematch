import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

function getMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

// --- In-memory cache (15s TTL) ---
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 15_000;

function getCached(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key: string, data: any) {
    cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

export async function POST(req: Request) {
    try {
        const { username, mode, score } = await req.json();

        if (!username || !mode || score === undefined) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Ensure canonical casing from profile
        const profileKey = `user:${username.toLowerCase()}`;
        const profile = await kv.get(profileKey) as any;
        const canonicalUsername = profile?.username || username;
        const hasCaseVariant = canonicalUsername !== username;

        let isNewBest = false;
        let isNewAllTimeHigh = false;

        if (mode === 'classic') {
            const weeklyKey = `classic_weekly:${getMonday()}`;

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

            // Pipeline: write scores + cleanup in a single round trip
            const writePipe = kv.pipeline();
            writePipe.zadd('classic_leaderboard', { gt: true } as any, { score, member: canonicalUsername });
            writePipe.zadd(weeklyKey, { gt: true } as any, { score, member: canonicalUsername });
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
        } else if (mode === 'daily') {
            const today = new Date().toISOString().split('T')[0];

            // Check if already played today
            const playedKey = `daily_played:${canonicalUsername.toLowerCase()}:${today}`;
            const hasPlayed = await kv.get(playedKey);

            if (hasPlayed) {
                return NextResponse.json({ error: 'Already played today' }, { status: 403 });
            }

            // Pipeline: mark played + add score in one round trip
            const dailyPipe = kv.pipeline();
            dailyPipe.set(playedKey, 'true');
            dailyPipe.zadd(`daily_leaderboard:${today}`, { score, member: canonicalUsername });
            await dailyPipe.exec();
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
    const skipAvatars = searchParams.get('skip_avatars') === 'true';

    try {
        // Check in-memory cache first
        const cacheKey = `leaderboard:${mode}:${username || ''}:${skipAvatars}`;
        const cached = getCached(cacheKey);
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' }
            });
        }

        let leaderboard: any = [];
        let leaderboardKey = '';
        const today = new Date().toISOString().split('T')[0];

        if (mode === 'classic') {
            leaderboardKey = 'classic_leaderboard';
        } else if (mode === 'weekly') {
            leaderboardKey = `classic_weekly:${getMonday()}`;
        } else if (mode === 'daily') {
            leaderboardKey = `daily_leaderboard:${today}`;
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        // Resolve canonical username in parallel with leaderboard fetch
        let canonicalUsername: string | null = null;
        const leaderboardPromise = kv.zrange(leaderboardKey, 0, 49, { rev: true, withScores: true });
        const profilePromise = username
            ? kv.get(`user:${username.toLowerCase()}`)
            : Promise.resolve(null);

        const [rawLeaderboard, userProfile] = await Promise.all([leaderboardPromise, profilePromise]);
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

        // If we only need the scores and user strings, skip mapping out full avatars
        if (skipAvatars) {
            const basicMapped = formatted.map((entry: any) => ({
                username: entry.member || entry.value,
                score: Number(entry.score)
            }));
            const responseData = { leaderboard: basicMapped, personalBest: personalBest ? Number(personalBest) : 0, userRank, userInTop, nextPlayer };
            setCached(cacheKey, responseData);
            return NextResponse.json(
                responseData,
                { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } }
            );
        }

        // Enrich with avatars — single batch mget for all users
        let enriched: any[] = [];
        // Collect all usernames that need profiles (top 50 + possibly the current user)
        const allEntries = [...formatted];
        if (canonicalUsername && !userInTop && personalBest !== null) {
            allEntries.push({ member: canonicalUsername, score: personalBest });
        }

        if (allEntries.length > 0) {
            const pKeys = allEntries.map(entry => `user:${entry.member.toLowerCase()}`);
            const profiles = await kv.mget(...pKeys);

            enriched = allEntries.map((entry, index) => {
                const profile = profiles[index] as any;
                return {
                    username: entry.member,
                    score: Number(entry.score),
                    avatarUrl: profile?.avatarUrl || ''
                };
            });
        }

        // Split out user entry if they're outside the top 50
        const top50 = enriched.slice(0, formatted.length);
        const userEntry = (!userInTop && canonicalUsername && personalBest !== null)
            ? enriched[enriched.length - 1]
            : null;

        const responseData = { leaderboard: top50, personalBest: personalBest ? Number(personalBest) : 0, userRank, userEntry, nextPlayer };
        setCached(cacheKey, responseData);
        return NextResponse.json(
            responseData,
            { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } }
        );
    } catch (error) {
        console.error('KV error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
