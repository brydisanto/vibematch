import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { username, mode, score } = await req.json();

        if (!username || !mode || score === undefined) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (mode === 'classic') {
            await kv.zadd('classic_leaderboard', { score, member: username });
        } else if (mode === 'daily') {
            const today = new Date().toISOString().split('T')[0];

            // Check if already played today
            const playedKey = `daily_played:${username.toLowerCase()}:${today}`;
            const hasPlayed = await kv.get(playedKey);

            if (hasPlayed) {
                return NextResponse.json({ error: 'Already played today' }, { status: 403 });
            }

            // Mark as played and add score
            await kv.set(playedKey, 'true');
            await kv.zadd(`daily_leaderboard:${today}`, { score, member: username });
        }

        return NextResponse.json({ success: true });
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
        let formatted = [];
        if (leaderboard.length > 0) {
            if (typeof leaderboard[0] === 'object' && leaderboard[0] !== null) {
                formatted = leaderboard;
            } else {
                for (let i = 0; i < leaderboard.length; i += 2) {
                    formatted.push({ member: leaderboard[i], score: leaderboard[i + 1] });
                }
            }
        }

        // Fetch personal best if username provided
        let personalBest: number | null = null;
        if (username) {
            personalBest = await kv.zscore(leaderboardKey, username);
        }

        // If we only need the scores and user strings, skip mapping out full avatars
        if (skipAvatars) {
            const basicMapped = formatted.map((entry: any) => ({
                username: entry.member || entry.value,
                score: Number(entry.score)
            }));
            return NextResponse.json(
                { leaderboard: basicMapped, personalBest: personalBest ? Number(personalBest) : 0 },
                { headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=5' } } // Reduced cache for more immediate updates
            );
        }

        // Enrich with avatars
        const enriched = await Promise.all(formatted.map(async (entry: any) => {
            const member = entry.member || entry.value;
            const pKey = `user:${member.toLowerCase()}`;
            const profile = await kv.get(pKey) as any;
            return {
                username: member,
                score: Number(entry.score),
                avatarUrl: profile?.avatarUrl || ''
            };
        }));

        return NextResponse.json(
            { leaderboard: enriched, personalBest: personalBest ? Number(personalBest) : 0 },
            { headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=5' } }
        );
    } catch (error) {
        console.error('KV error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
