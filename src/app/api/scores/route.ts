import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

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

        let isNewBest = false;

        if (mode === 'classic') {
            const currentScore1 = await kv.zscore('classic_leaderboard', canonicalUsername);
            const currentScore2 = (canonicalUsername !== username) ? await kv.zscore('classic_leaderboard', username) : null;

            const maxCurrent = Math.max(Number(currentScore1 || 0), Number(currentScore2 || 0));
            isNewBest = maxCurrent === 0 || score > maxCurrent;

            // Vercel KV zadd will update the score even if lower, so always save the max known score
            const scoreToSave = Math.max(maxCurrent, score);
            await kv.zadd('classic_leaderboard', { score: scoreToSave, member: canonicalUsername });

            // Clean up the split variant if it exists
            if (canonicalUsername !== username && currentScore2 !== null) {
                await kv.zrem('classic_leaderboard', username);
            }
        } else if (mode === 'daily') {
            const today = new Date().toISOString().split('T')[0];

            // Check if already played today
            const playedKey = `daily_played:${canonicalUsername.toLowerCase()}:${today}`;
            const hasPlayed = await kv.get(playedKey);

            if (hasPlayed) {
                return NextResponse.json({ error: 'Already played today' }, { status: 403 });
            }

            // Mark as played and add score
            await kv.set(playedKey, 'true');
            await kv.zadd(`daily_leaderboard:${today}`, { score, member: canonicalUsername });
            isNewBest = true; // Daily is effectively always a new personal best for that day
        }

        return NextResponse.json({ success: true, isNewBest });
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
        let leaderboard: any = [];
        let leaderboardKey = '';
        const today = new Date().toISOString().split('T')[0];

        if (mode === 'classic') {
            leaderboardKey = 'classic_leaderboard';
        } else if (mode === 'daily') {
            leaderboardKey = `daily_leaderboard:${today}`;
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        leaderboard = await kv.zrange(leaderboardKey, 0, 9, { rev: true, withScores: true });

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

        // Convert back to array, sort descending, and take top 10
        let uniqueFormatted = Array.from(uniqueEntriesMap.values());
        uniqueFormatted.sort((a, b) => b.score - a.score);
        formatted = uniqueFormatted.slice(0, 10);

        // Fetch personal best if username provided
        let personalBest: number | null = null;
        if (username) {
            // Robust lookup: ensure we use the canonical casing from the profile for the leaderboard
            const profileKey = `user:${username.toLowerCase()}`;
            const profile = await kv.get(profileKey) as any;
            const canonicalUsername = profile?.username || username;

            const score1 = await kv.zscore(leaderboardKey, canonicalUsername);
            const score2 = (canonicalUsername.toLowerCase() !== username.toLowerCase() || canonicalUsername !== username) ? await kv.zscore(leaderboardKey, username) : null;

            if (score1 !== null || score2 !== null) {
                personalBest = Math.max(Number(score1 || 0), Number(score2 || 0));
            }
        }

        // If we only need the scores and user strings, skip mapping out full avatars
        if (skipAvatars) {
            const basicMapped = formatted.map((entry: any) => ({
                username: entry.member || entry.value,
                score: Number(entry.score)
            }));
            return NextResponse.json(
                { leaderboard: basicMapped, personalBest: personalBest ? Number(personalBest) : 0 },
                { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } }
            );
        }

        // Enrich with avatars
        let enriched: any[] = [];
        if (formatted.length > 0) {
            const pKeys = formatted.map((entry: any) => `user:${(entry.member || entry.value).toLowerCase()}`);
            const profiles = await kv.mget(...pKeys);

            enriched = formatted.map((entry: any, index: number) => {
                const profile = profiles[index] as any;
                return {
                    username: entry.member || entry.value,
                    score: Number(entry.score),
                    avatarUrl: profile?.avatarUrl || ''
                };
            });
        }

        return NextResponse.json(
            { leaderboard: enriched, personalBest: personalBest ? Number(personalBest) : 0 },
            { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } }
        );
    } catch (error) {
        console.error('KV error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
