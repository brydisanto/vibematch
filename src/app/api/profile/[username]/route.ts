import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { BADGES, type BadgeTier } from "@/lib/badges";
import { getEasternDailyKey } from "@/lib/daily-window";

export const dynamic = "force-dynamic";

/**
 * Public profile endpoint for the tap-through profile page (/u/[username]).
 * Aggregates what we already store across:
 *   - user:<u>              canonical username + avatarUrl
 *   - user_auth:<u>         banned flag + createdAt
 *   - classic_leaderboard   all-time rank + score (zset)
 *   - classic_weekly:<wk>   weekly rank + score (zset)
 *   - classic_matches_played hash (lifetime games count)
 *   - pinbook:<u>           pin collection + tier counts
 *   - gamelog:<u>           recent runs (zset)
 *
 * Responses:
 *   200 — full profile data
 *   404 — user does not exist OR is banned (we surface as 404 so banned
 *         users don't get a recognisable "you've been banned" signal from
 *         a public endpoint; they still see their own state when logged
 *         in via session APIs)
 *
 * Cached 60s — profile data changes slowly relative to game throughput.
 */

const tierOrder: BadgeTier[] = ["cosmic", "gold", "special", "silver", "blue"];

function getWeeklyKey(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff)).toISOString().split("T")[0];
    return `classic_weekly:${monday}`;
}

interface ProfileBadge {
    id: string;
    name: string;
    image: string;
    tier: BadgeTier;
    count: number;
    firstEarned: string;
}

interface ProfileRecentRun {
    mode: string;
    score: number;
    timestamp: number;
}

interface ProfileResponse {
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

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
    try {
        const { username: rawUsername } = await params;
        if (!rawUsername || typeof rawUsername !== "string") {
            return NextResponse.json({ error: "Invalid username" }, { status: 400 });
        }
        const username = decodeURIComponent(rawUsername).toLowerCase();

        // Bail fast on obviously-bad input. Usernames in this app are
        // alphanumeric + underscores; reject anything else so we don't
        // hit KV for clearly garbage routes.
        if (!/^[a-z0-9_]{1,32}$/.test(username)) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

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
        // Banned or non-existent users return 404. We don't want public
        // pages for banned accounts surfacing scores / pins / etc.
        if (!auth || auth.banned === true) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const canonicalUsername = profile?.username || auth.username || rawUsername;

        // Rank + score lookups (canonical casing first, then raw as
        // backstop — matches the admin route's lookup pattern).
        const [allTimeScore, allTimeRank, weeklyScore, weeklyRank, dailyScore] = await Promise.all([
            kv.zscore("classic_leaderboard", canonicalUsername) as Promise<number | null>,
            kv.zrevrank("classic_leaderboard", canonicalUsername) as Promise<number | null>,
            kv.zscore(weeklyKey, canonicalUsername) as Promise<number | null>,
            kv.zrevrank(weeklyKey, canonicalUsername) as Promise<number | null>,
            kv.zscore(`daily_leaderboard:${today}`, canonicalUsername) as Promise<number | null>,
        ]);

        // Pinbook tier breakdown + top pins. `topPins` shows highest-tier
        // owned (up to 6) so the profile feels like a trophy case rather
        // than a flat list. Sorted: cosmic > gold > special > silver >
        // blue, then by name within a tier.
        const pinbook = pinbookRaw as
            | {
                  pins?: Record<string, { count: number; firstEarned: string }>;
              }
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
        // Completion %: unique pins owned / total non-collectOnly badges.
        // collectOnly badges (event/promo) aren't part of the base
        // collection denominator since they aren't available to every
        // user.
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

        const response: ProfileResponse = {
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

        return NextResponse.json(response, {
            headers: { "Cache-Control": "public, s-maxage=60, max-age=30" },
        });
    } catch (error) {
        console.error("[profile] fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}
