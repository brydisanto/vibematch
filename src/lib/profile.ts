import { kv } from "@vercel/kv";
import { BADGES, type BadgeTier } from "@/lib/badges";
import { getEasternDailyKey } from "@/lib/daily-window";

/**
 * Shared profile-data aggregator used by both /api/profile/[username]
 * (HTTP endpoint) and /u/[username] (server-rendered page). Returns
 * null when the user does not exist or is banned — callers translate
 * that into 404 / not-found UI.
 */

const tierOrder: BadgeTier[] = ["cosmic", "gold", "special", "silver", "blue"];

function getWeeklyKey(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff)).toISOString().split("T")[0];
    return `classic_weekly:${monday}`;
}

export interface ProfileBadge {
    id: string;
    name: string;
    image: string;
    tier: BadgeTier;
    count: number;
    firstEarned: string;
}

export interface ProfileRecentRun {
    mode: string;
    score: number;
    timestamp: number;
}

export interface ProfileResponse {
    username: string;
    avatarUrl: string | null;
    joinedAt: string | null;
    rank: {
        allTime: number | null;
        weekly: number | null;
    };
    best: {
        allTime: number | null;
        daily: number | null;
    };
    gamesPlayed: number;
    pins: {
        unique: number;
        total: number;
        completion: number;
        byTier: Record<BadgeTier, number>;
        topPins: ProfileBadge[];
    };
    recentRuns: ProfileRecentRun[];
}

export async function getProfile(rawUsername: string): Promise<ProfileResponse | null> {
    if (!rawUsername || typeof rawUsername !== "string") return null;
    const username = decodeURIComponent(rawUsername).toLowerCase();

    // Reject obviously-bad input without hitting KV. Usernames in this
    // app are alphanumeric + underscores, capped at 32 chars.
    if (!/^[a-z0-9_]{1,32}$/.test(username)) return null;

    const today = getEasternDailyKey();
    const weeklyKey = getWeeklyKey();

    const [authRaw, profileRaw, pinbookRaw, gamesPlayedRaw, gameLogRaw] = await Promise.all([
        kv.get(`user_auth:${username}`),
        kv.get(`user:${username}`),
        kv.get(`pinbook:${username}`),
        kv.hget("classic_matches_played", username),
        kv.zrange(`gamelog:${username}`, 0, 9, { rev: true }),
    ]);

    const auth = authRaw as { username?: string; banned?: boolean; createdAt?: string } | null;
    const profile = profileRaw as { username?: string; avatarUrl?: string } | null;
    // Banned + non-existent users return null. Public surface never
    // exposes ban state.
    if (!auth || auth.banned === true) return null;

    const canonicalUsername = profile?.username || auth.username || rawUsername;

    const [allTimeScore, allTimeRank, weeklyScore, weeklyRank, dailyScore] = await Promise.all([
        kv.zscore("classic_leaderboard", canonicalUsername) as Promise<number | null>,
        kv.zrevrank("classic_leaderboard", canonicalUsername) as Promise<number | null>,
        kv.zscore(weeklyKey, canonicalUsername) as Promise<number | null>,
        kv.zrevrank(weeklyKey, canonicalUsername) as Promise<number | null>,
        kv.zscore(`daily_leaderboard:${today}`, canonicalUsername) as Promise<number | null>,
    ]);
    void weeklyScore;

    const pinbook = pinbookRaw as
        | { pins?: Record<string, { count: number; firstEarned: string }> }
        | null;
    const byTier: Record<BadgeTier, number> = {
        blue: 0,
        silver: 0,
        special: 0,
        gold: 0,
        cosmic: 0,
    };
    let uniquePins = 0;
    let totalPins = 0;
    const owned: ProfileBadge[] = [];
    const badgeById = new Map(BADGES.map(b => [b.id, b]));
    if (pinbook?.pins) {
        for (const [badgeId, entry] of Object.entries(pinbook.pins)) {
            const def = badgeById.get(badgeId);
            if (!def) continue;
            const count = Number(entry?.count || 0);
            if (count <= 0) continue;
            uniquePins += 1;
            totalPins += count;
            byTier[def.tier] += count;
            owned.push({
                id: def.id,
                name: def.name,
                image: def.image,
                tier: def.tier,
                count,
                firstEarned: entry?.firstEarned || "",
            });
        }
    }
    owned.sort((a, b) => {
        const ai = tierOrder.indexOf(a.tier);
        const bi = tierOrder.indexOf(b.tier);
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name);
    });
    const topPins = owned.slice(0, 6);
    const baseDenominator = BADGES.filter(b => !b.collectOnly).length;
    const completion = baseDenominator > 0
        ? Math.round((uniquePins / baseDenominator) * 100)
        : 0;

    const recentRuns: ProfileRecentRun[] = ((gameLogRaw as unknown[]) || [])
        .map(entry => {
            try {
                const parsed = typeof entry === "string" ? JSON.parse(entry) : (entry as any);
                if (!parsed) return null;
                return {
                    mode: (parsed.gameMode as string) || "classic",
                    score: Number(parsed.score || 0),
                    timestamp: Number(parsed.timestamp || 0),
                } as ProfileRecentRun;
            } catch {
                return null;
            }
        })
        .filter((r): r is ProfileRecentRun => r !== null);

    return {
        username: canonicalUsername,
        avatarUrl: profile?.avatarUrl || null,
        joinedAt: auth.createdAt || null,
        rank: {
            allTime: allTimeRank !== null ? allTimeRank + 1 : null,
            weekly: weeklyRank !== null ? weeklyRank + 1 : null,
        },
        best: {
            allTime: allTimeScore !== null ? Number(allTimeScore) : null,
            daily: dailyScore !== null ? Number(dailyScore) : null,
        },
        gamesPlayed: Number(gamesPlayedRaw || 0),
        pins: {
            unique: uniquePins,
            total: totalPins,
            completion,
            byTier,
            topPins,
        },
        recentRuns,
    };
}
