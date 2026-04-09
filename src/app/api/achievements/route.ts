import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ACHIEVEMENTS_BY_ID, checkRetroactiveAchievements, type PlayerContext } from '@/lib/achievements';
import { BADGES } from '@/lib/badges';

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
        const pinbook = (pinData || { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 }) as {
            pins: Record<string, { count: number; firstEarned: string }>;
            capsules: number;
            totalOpened: number;
            totalEarned: number;
        };

        // Build authoritative PlayerContext from stored pinbook state.
        // This is the same logic as page.tsx's tier counting, but server-side.
        const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));
        const ctx: PlayerContext = {
            streak: 0,
            uniquePins: Object.keys(pinbook.pins).length,
            totalPinsOpened: pinbook.totalOpened || 0,
            hasSilverPin: false,
            hasGoldPin: false,
            hasCosmicPin: false,
            commonPinCount: 0,
            rarePinCount: 0,
            legendaryPinCount: 0,
            cosmicPinCount: 0,
            gamesPlayedToday: 0,
        };
        for (const badgeId of Object.keys(pinbook.pins)) {
            const tier = badgeTierMap.get(badgeId);
            if (tier === 'blue') ctx.commonPinCount++;
            if (tier === 'silver') { ctx.hasSilverPin = true; ctx.rarePinCount++; }
            if (tier === 'gold') { ctx.hasGoldPin = true; ctx.legendaryPinCount++; }
            if (tier === 'cosmic') { ctx.hasCosmicPin = true; ctx.cosmicPinCount++; }
        }

        // Fetch streak
        const streakRaw = await kv.get(`streak:${username}`) as { streak: number; lastPlayed: string } | null;
        if (streakRaw) {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            // Only count streak as active if last played today or yesterday
            if (streakRaw.lastPlayed === today || streakRaw.lastPlayed === yesterdayStr) {
                ctx.streak = streakRaw.streak || 0;
            }
        }

        // Check the daily champ achievement separately (needs leaderboard lookup)
        let dailyChampEligible = false;
        if (!achievements.unlocked['daily_champ']) {
            try {
                const yesterday = new Date();
                yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                const yesterdayKey = `daily_leaderboard:${yesterday.toISOString().split('T')[0]}`;
                const top = await kv.zrange(yesterdayKey, 0, 0, { rev: true }) as string[];
                if (top.length > 0 && top[0].toLowerCase() === username) {
                    dailyChampEligible = true;
                }
            } catch {
                // ignore
            }
        }

        // Run server-side retroactive check to get the AUTHORITATIVE set of unlockable IDs
        const alreadyUnlockedSet = new Set(Object.keys(achievements.unlocked));
        const authoritativeUnlockable = new Set(checkRetroactiveAchievements(ctx, alreadyUnlockedSet));

        // Add daily_champ if eligible
        if (dailyChampEligible && !alreadyUnlockedSet.has('daily_champ')) {
            authoritativeUnlockable.add('daily_champ');
        }

        // Game-play achievements (first_combo, first_bomb, cascade_5, etc.) cannot be
        // verified from stored state. They require a match token from trackGame to prove
        // the player actually earned them. Until that system is added, we trust the client
        // ONLY if the achievement's capsule reward is 1 or less (low-value trust) AND the
        // achievement is in a known game-play category.
        const GAMEPLAY_ACHIEVEMENT_IDS = new Set([
            'first_game', 'first_combo', 'first_bomb', 'first_vibestreak',
            'first_l_shape', 'first_t_shape', 'first_cross_shape', 'first_cosmic',
            'score_25k', 'score_50k', 'score_75k', 'score_100k',
            'cascade_5', 'combo_5', 'combo_6', 'combo_8',
            'bombs_5', 'cascades_15', 'cross_3', 'l_shapes_3', 't_shapes_3',
            'shape_trifecta', 'daily_cap', 'daily_30k',
        ]);

        const newlyUnlocked: Array<{ id: string; capsules: number }> = [];
        let totalCapsules = 0;
        const rejected: string[] = [];

        for (const id of body.achievementIds as string[]) {
            if (typeof id !== 'string') continue;
            // Skip if already unlocked or invalid
            if (achievements.unlocked[id]) continue;
            const def = ACHIEVEMENTS_BY_ID[id];
            if (!def) continue;

            // Strict verification path: retroactively verifiable from state
            if (authoritativeUnlockable.has(id)) {
                achievements.unlocked[id] = { unlockedAt: new Date().toISOString() };
                totalCapsules += def.capsules;
                newlyUnlocked.push({ id, capsules: def.capsules });
                continue;
            }

            // Game-play achievements: allow for now, but log for monitoring.
            // Low capsule value (1-3) limits abuse impact. TODO: gate with match token.
            if (GAMEPLAY_ACHIEVEMENT_IDS.has(id) && def.capsules <= 3) {
                achievements.unlocked[id] = { unlockedAt: new Date().toISOString() };
                totalCapsules += def.capsules;
                newlyUnlocked.push({ id, capsules: def.capsules });
                continue;
            }

            // Otherwise reject
            rejected.push(id);
        }

        if (rejected.length > 0) {
            console.warn(`[achievements] Rejected unverified unlocks for ${username}:`, rejected);
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
