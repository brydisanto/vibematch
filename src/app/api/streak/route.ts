import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

interface StreakData {
    streak: number;
    lastPlayed: string;
}

function getTodayUTC(): string {
    return new Date().toISOString().split('T')[0];
}

function getYesterdayUTC(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ streak: 0, lastPlayed: null });
    }

    try {
        const data = await kv.get<StreakData>(`streak:${username.toLowerCase()}`);
        if (!data) {
            return NextResponse.json({ streak: 0, lastPlayed: null }, {
                headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
            });
        }
        // Check if streak is still valid (played today or yesterday)
        const today = getTodayUTC();
        const yesterday = getYesterdayUTC();
        const isActive = data.lastPlayed === today || data.lastPlayed === yesterday;
        return NextResponse.json({
            streak: isActive ? data.streak : 0,
            lastPlayed: data.lastPlayed,
        }, {
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
        });
    } catch (error) {
        console.error('KV error fetching streak:', error);
        return NextResponse.json({ streak: 0, lastPlayed: null });
    }
}

export async function POST(req: Request) {
    try {
        const { username } = await req.json();

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 });
        }

        const key = `streak:${username.toLowerCase()}`;
        const today = getTodayUTC();
        const yesterday = getYesterdayUTC();

        const existing = await kv.get<StreakData>(key);

        let newStreak = 1;
        if (existing) {
            if (existing.lastPlayed === today) {
                // Already recorded today — no change
                return NextResponse.json({ streak: existing.streak, lastPlayed: existing.lastPlayed });
            } else if (existing.lastPlayed === yesterday) {
                // Consecutive day — increment
                newStreak = existing.streak + 1;
            }
            // Else: streak broken — reset to 1
        }

        const updated: StreakData = { streak: newStreak, lastPlayed: today };
        await kv.set(key, updated);

        return NextResponse.json(updated);
    } catch (error) {
        console.error('KV error updating streak:', error);
        return NextResponse.json({ error: 'Failed to update streak' }, { status: 500 });
    }
}
