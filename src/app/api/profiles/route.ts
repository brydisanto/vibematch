import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { invalidateLeaderboardCache } from '@/app/api/scores/route';
import type { LeaderboardEntry } from '@/app/api/pinbook/leaderboard/route';

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.username) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { username, avatarUrl } = await req.json();

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 });
        }

        // Prevent users from updating other people's profiles
        if (username.toLowerCase() !== session.username.toLowerCase()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const key = `user:${username.toLowerCase()}`;
        await kv.set(key, { username, avatarUrl });

        // Bust score leaderboard cache so updated avatar shows immediately
        invalidateLeaderboardCache();

        // Update avatar in pinbook leaderboard entry if it exists
        const pinbookLb = (await kv.get('pinbook:leaderboard')) as LeaderboardEntry[] | null;
        if (pinbookLb) {
            const idx = pinbookLb.findIndex(e => e.username.toLowerCase() === username.toLowerCase());
            if (idx >= 0 && pinbookLb[idx].avatarUrl !== avatarUrl) {
                pinbookLb[idx] = { ...pinbookLb[idx], avatarUrl };
                await kv.set('pinbook:leaderboard', pinbookLb);
            }
        }

        return NextResponse.json({ success: true, profile: { username, avatarUrl } });
    } catch (error) {
        console.error('KV error saving profile:', error);
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    try {
        const key = `user:${username.toLowerCase()}`;
        const profile = await kv.get(key);

        if (profile) {
            return NextResponse.json({ profile });
        } else {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('KV error fetching profile:', error);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}
