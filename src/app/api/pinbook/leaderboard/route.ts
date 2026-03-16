import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// In-memory cache (30s TTL — collection data changes less often than scores)
let cachedData: { data: any; expires: number } | null = null;
const CACHE_TTL = 30_000;

export async function GET() {
    try {
        // Return cached if fresh
        if (cachedData && Date.now() < cachedData.expires) {
            const session = await getSession();
            return NextResponse.json(
                { ...cachedData.data, currentUsername: session?.username || null },
                { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
            );
        }

        // Scan all pinbook keys — pattern: pinbook:{username}
        const allKeys: string[] = [];
        let cursor: any = 0;
        do {
            const result = await kv.scan(cursor, { match: 'pinbook:*', count: 100 }) as any;
            cursor = result[0];
            allKeys.push(...(result[1] as string[]));
        } while (cursor != 0);

        if (allKeys.length === 0) {
            const session = await getSession();
            return NextResponse.json({
                leaderboard: [],
                currentUsername: session?.username || null,
            });
        }

        // Batch fetch all pinbook data
        const pinbooks = await kv.mget(...allKeys);

        // Also fetch profiles for avatars in a single batch
        const profileKeys = allKeys.map(k => `user:${k.replace('pinbook:', '')}`);
        const profiles = await kv.mget(...profileKeys);

        const TOTAL_BADGES = 77;

        const entries = allKeys.map((key, i) => {
            const data = pinbooks[i] as any;
            const profile = profiles[i] as any;
            if (!data?.pins) return null;

            const username = profile?.username || key.replace('pinbook:', '');
            const avatarUrl = profile?.avatarUrl || '';
            const pins = data.pins as Record<string, { count: number }>;
            const uniqueCount = Object.keys(pins).length;
            const totalPins = Object.values(pins).reduce((sum, p) => sum + p.count, 0);
            const percentComplete = Math.round((uniqueCount / TOTAL_BADGES) * 100);

            return {
                username,
                avatarUrl,
                uniqueCount,
                totalPins,
                percentComplete,
            };
        }).filter(Boolean);

        // Sort by % complete (desc), then unique count (desc), then total pins (desc)
        entries.sort((a: any, b: any) =>
            b.percentComplete - a.percentComplete ||
            b.uniqueCount - a.uniqueCount ||
            b.totalPins - a.totalPins
        );

        // Cache the leaderboard data (without user-specific info)
        cachedData = { data: { leaderboard: entries }, expires: Date.now() + CACHE_TTL };

        const session = await getSession();
        return NextResponse.json(
            { leaderboard: entries, currentUsername: session?.username || null },
            { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
        );
    } catch (e) {
        console.error('PinBook leaderboard error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
