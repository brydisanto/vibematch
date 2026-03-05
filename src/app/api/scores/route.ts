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
    const skipAvatars = searchParams.get('skip_avatars') === 'true';

    try {
        let leaderboard: any = [];
        if (mode === 'classic') {
            leaderboard = await kv.zrange('classic_leaderboard', 0, 9, { rev: true, withScores: true });
        } else if (mode === 'daily') {
            const today = new Date().toISOString().split('T')[0];
            leaderboard = await kv.zrange(`daily_leaderboard:${today}`, 0, 9, { rev: true, withScores: true });
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

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

        // If we only need the scores and user strings, skip mapping out full avatars
        if (skipAvatars) {
            const basicMapped = formatted.map((entry: any) => ({
                username: entry.member || entry.value,
                score: Number(entry.score)
            }));
            return NextResponse.json(
                { leaderboard: basicMapped },
                { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
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
            { leaderboard: enriched },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
        );
    } catch (error) {
        console.error('KV error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
