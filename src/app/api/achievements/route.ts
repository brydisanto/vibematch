import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ACHIEVEMENTS_BY_ID } from '@/lib/achievements';

export interface AchievementsData {
    unlocked: Record<string, { unlockedAt: string }>;
}

function emptyAchievements(): AchievementsData {
    return { unlocked: {} };
}

// GET — fetch unlocked achievements for logged-in user
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const username = (session.username as string).toLowerCase();
        const key = `achievements:${username}`;
        const data = (await kv.get(key)) as AchievementsData | null;
        const achievements = data || emptyAchievements();

        // Check if user won yesterday's daily challenge (for daily_champ achievement)
        let dailyChampEligible = false;
        if (!achievements.unlocked['daily_champ']) {
            try {
                const yesterday = new Date();
                yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                const yesterdayKey = `daily_leaderboard:${yesterday.toISOString().split('T')[0]}`;
                // Get #1 entry from yesterday's sorted set (highest score)
                const top = await kv.zrange(yesterdayKey, 0, 0, { rev: true }) as string[];
                if (top.length > 0 && top[0].toLowerCase() === username) {
                    dailyChampEligible = true;
                }
            } catch {
                // Non-critical — skip if leaderboard check fails
            }
        }

        return NextResponse.json({ ...achievements, dailyChampEligible });
    } catch (e) {
        console.error('Achievements GET error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST — unlock achievement(s) and award capsules
// body: { action: "unlock", achievementIds: string[] }
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const username = (session.username as string).toLowerCase();

        if (body.action !== 'unlock' || !Array.isArray(body.achievementIds)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const achKey = `achievements:${username}`;
        const pinKey = `pinbook:${username}`;

        const [achData, pinData] = await Promise.all([
            kv.get(achKey) as Promise<AchievementsData | null>,
            kv.get(pinKey) as Promise<{ pins: Record<string, unknown>; capsules: number; totalOpened: number; totalEarned: number } | null>,
        ]);

        const achievements = achData || emptyAchievements();
        const pinbook = pinData || { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 };

        const newlyUnlocked: Array<{ id: string; capsules: number }> = [];
        let totalCapsules = 0;

        for (const id of body.achievementIds as string[]) {
            // Skip if already unlocked or invalid
            if (achievements.unlocked[id]) continue;
            const def = ACHIEVEMENTS_BY_ID[id];
            if (!def) continue;

            achievements.unlocked[id] = { unlockedAt: new Date().toISOString() };
            totalCapsules += def.capsules;
            newlyUnlocked.push({ id, capsules: def.capsules });
        }

        if (newlyUnlocked.length === 0) {
            return NextResponse.json({ unlocked: [], capsules: pinbook.capsules });
        }

        // Award capsules to pinbook
        pinbook.capsules += totalCapsules;
        pinbook.totalEarned += totalCapsules;

        // Save both atomically
        await Promise.all([
            kv.set(achKey, achievements),
            kv.set(pinKey, pinbook),
        ]);

        return NextResponse.json({
            unlocked: newlyUnlocked,
            capsules: pinbook.capsules,
            totalCapsules,
        });
    } catch (e) {
        console.error('Achievements POST error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
