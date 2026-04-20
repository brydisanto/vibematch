import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
    // Gate on session to prevent user enumeration. The session's username is
    // the authoritative source — the `?username=` query param is ignored once
    // the session is verified, removing any way for an unauthed caller to
    // probe whether an arbitrary account has played today.
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = (session.username as string).toLowerCase();

    try {
        const today = new Date().toISOString().split('T')[0];
        const playedKey = `daily_played:${username}:${today}`;
        const hasPlayed = await kv.get(playedKey);

        return NextResponse.json({ playedToday: !!hasPlayed }, {
            // Per-user answer — must not be shared by a CDN edge cache.
            headers: { 'Cache-Control': 'private, max-age=10' }
        });
    } catch (error) {
        console.error('KV error checking daily config:', error);
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }
}
