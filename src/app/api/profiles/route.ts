import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { username, avatarUrl } = await req.json();

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 });
        }

        const key = `user:${username.toLowerCase()}`;
        await kv.set(key, { username, avatarUrl });

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
