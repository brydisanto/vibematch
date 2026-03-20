import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const playedKey = `daily_played:${username.toLowerCase()}:${today}`;
        const hasPlayed = await kv.get(playedKey);

        return NextResponse.json({ playedToday: !!hasPlayed }, {
            headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }
        });
    } catch (error) {
        console.error('KV error checking daily config:', error);
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }
}
