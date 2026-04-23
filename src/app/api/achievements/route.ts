import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
    ACHIEVEMENTS_BY_ID,
    checkAchievements,
    checkRetroactiveAchievements,
    type GameEndStats,
} from '@/lib/achievements';
import { BADGES } from '@/lib/badges';
import { buildPlayerContext } from '@/lib/playerContext';

// Mid-game achievements that fire from checkMidGameAchievements in the
// client. These are observable one-off claims ("did you land a T shape?
// did you hit a 5× combo?") that the server can't re-verify at the
// moment they happen because matchstats are written at game END, not
// per-turn. Capsule rewards are small (1–3 each) and none of them
// influence leaderboards, so the spoof surface is minimal. Trusting
// the client here is the pragmatic call; the alternative is silently
// rejecting every mid-game unlock, which was the bug surfaced by the
// missing T-shape toast.
const MID_GAME_TRUSTED_IDS = new Set([
    'first_combo',
    'first_bomb',
    'first_vibestreak',
    'first_cosmic',
    'first_l_shape',
    'first_t_shape',
    'first_cross_shape',
    'combo_5',
    'combo_6',
    'combo_8',
    'cascade_5',
]);

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
            kv.get(pinKey) as Promise<{ pins: Record<string, unknown>; capsules: number; totalOpened: number; totalEarned: number; totalFoundByTier?: Record<string, number> } | null>,
        ]);

        const achievements = achData || emptyAchievements();
        const pinbook = (pinData || { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 }) as {
            pins: Record<string, { count: number; firstEarned: string }>;
            capsules: number;
            totalOpened: number;
            totalEarned: number;
            totalFoundByTier?: Partial<Record<import('@/lib/badges').BadgeTier, number>>;
        };

        // Load engagement signals that aren't part of the pinbook blob:
        //   - profile.avatarUrl authoritatively verifies "uploaded an avatar"
        //   - user_flags:<user> stores music-change + prize-game-purchased flags
        //     written by their respective endpoints, so the server doesn't
        //     have to trust a client claim here.
        const [profileRaw, flagsRaw] = await Promise.all([
            kv.get(`user:${username}`) as Promise<{ avatarUrl?: string } | null>,
            kv.get(`user_flags:${username}`) as Promise<{
                musicChanged?: boolean;
                avatarUploaded?: boolean;
                prizeGamePurchased?: boolean;
                vibestrHolder?: boolean;
            } | null>,
        ]);
        const hasUploadedAvatar =
            !!(profileRaw?.avatarUrl && profileRaw.avatarUrl.trim()) ||
            !!flagsRaw?.avatarUploaded;
        const hasChangedMusic = !!flagsRaw?.musicChanged;
        const hasPurchasedPrizeGame = !!flagsRaw?.prizeGamePurchased;
        const hasVibestrWallet = !!flagsRaw?.vibestrHolder;

        // Build authoritative PlayerContext from stored pinbook state
        const ctx = buildPlayerContext(pinbook.pins, {
            totalPinsOpened: pinbook.totalOpened,
            totalFoundByTier: pinbook.totalFoundByTier,
            hasUploadedAvatar,
            hasChangedMusic,
            hasPurchasedPrizeGame,
            hasVibestrWallet,
        });

        // Fetch streak + referral count
        const [streakRaw, referralRaw] = await Promise.all([
            kv.get(`streak:${username}`) as Promise<{ streak: number; lastPlayed: string } | null>,
            kv.get(`referral:${username}`) as Promise<{ totalReferrals?: number } | null>,
        ]);
        ctx.referralCount = referralRaw?.totalReferrals || 0;
        const streakData = streakRaw;
        if (streakData) {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (streakData.lastPlayed === today || streakData.lastPlayed === yesterdayStr) {
                ctx.streak = streakData.streak || 0;
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
        // (pin/tier/streak based — verifiable from stored state)
        const alreadyUnlockedSet = new Set(Object.keys(achievements.unlocked));
        const authoritativeUnlockable = new Set(checkRetroactiveAchievements(ctx, alreadyUnlockedSet));

        // Add daily_champ if eligible
        if (dailyChampEligible && !alreadyUnlockedSet.has('daily_champ')) {
            authoritativeUnlockable.add('daily_champ');
        }

        // --- Game-play achievement verification ---
        // Gameplay achievements (cascade_5, first_bomb, score_50k, etc.) are verified by
        // looking up the authoritative match stats stored by logGame and re-running
        // checkAchievements server-side against those stats.
        const matchId = typeof body.matchId === 'string' ? body.matchId : undefined;
        const gameMode = typeof body.gameMode === 'string' ? body.gameMode : 'classic';

        let serverVerifiedGameplay = new Set<string>();
        if (matchId || gameMode === 'daily') {
            let matchStats: any = null;
            if (matchId && gameMode === 'classic') {
                matchStats = await kv.get(`matchstats:${username}:${matchId}`);
            } else if (gameMode === 'daily') {
                const today = new Date().toISOString().split('T')[0];
                matchStats = await kv.get(`matchstats:${username}:daily:${today}`);
            }

            if (matchStats && typeof matchStats === 'object') {
                const stats = matchStats as any;
                const gameEndStats: GameEndStats = {
                    score: Number(stats.score) || 0,
                    maxCombo: Number(stats.maxCombo) || 0,
                    totalCascades: Number(stats.totalCascades) || 0,
                    matchCount: Number(stats.matchCount) || 0,
                    bombsCreated: Number(stats.bombsCreated) || 0,
                    vibestreaksCreated: Number(stats.vibestreaksCreated) || 0,
                    cosmicBlastsCreated: Number(stats.cosmicBlastsCreated) || 0,
                    shapesLanded: Array.isArray(stats.shapesLanded) ? stats.shapesLanded : [],
                    crossCount: Number(stats.crossCount) || 0,
                    gameMode: String(stats.gameMode || gameMode),
                };
                // checkAchievements returns all IDs that pass — filter to gameplay ones
                const verifiedIds = checkAchievements(gameEndStats, ctx, alreadyUnlockedSet);
                serverVerifiedGameplay = new Set(verifiedIds);
            }
        }

        const newlyUnlocked: Array<{ id: string; capsules: number }> = [];
        let totalCapsules = 0;
        const rejected: string[] = [];

        for (const id of body.achievementIds as string[]) {
            if (typeof id !== 'string') continue;
            // Skip if already unlocked or invalid
            if (achievements.unlocked[id]) continue;
            const def = ACHIEVEMENTS_BY_ID[id];
            if (!def) continue;

            // Path 1: retroactively verifiable from stored state (pins, tiers, streak, daily champ)
            if (authoritativeUnlockable.has(id)) {
                achievements.unlocked[id] = { unlockedAt: new Date().toISOString() };
                totalCapsules += def.capsules;
                newlyUnlocked.push({ id, capsules: def.capsules });
                continue;
            }

            // Path 2: gameplay achievement verified by server re-running checkAchievements
            // against match-token-bound stats
            if (serverVerifiedGameplay.has(id)) {
                achievements.unlocked[id] = { unlockedAt: new Date().toISOString() };
                totalCapsules += def.capsules;
                newlyUnlocked.push({ id, capsules: def.capsules });
                continue;
            }

            // Path 3: trusted mid-game claims (first-X shapes/specials,
            // combo milestones, cascade_5). These fire from the client's
            // per-turn checkMidGameAchievements and can't be server-
            // verified in-flight because matchstats are written on game
            // end. Accept the client's claim — see MID_GAME_TRUSTED_IDS
            // comment for the rationale on why this is safe.
            if (MID_GAME_TRUSTED_IDS.has(id)) {
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
