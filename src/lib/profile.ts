import { kv } from "@vercel/kv";
import { BADGES, type BadgeTier } from "@/lib/badges";
import { getEasternDailyKey, getEasternYesterdayKey } from "@/lib/daily-window";
import { getTier, type TierInfo, type TierId } from "@/lib/tiers";
import { PROMO_BADGES, promoLeaderboardKey, type PromoBadge } from "@/lib/promo-badges";

/**
 * Shared profile-data aggregator used by both /api/profile/[username]
 * (HTTP endpoint) and /u/[username] (server-rendered page). Returns
 * null when the user does not exist or is banned — callers translate
 * that into 404 / not-found UI.
 */

const tierOrder: BadgeTier[] = ["cosmic", "gold", "special", "silver", "blue"];

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

export interface ProfileEventTrophy {
    /** Promo / event badge id (e.g. "promo_opensea"). */
    id: string;
    /** Display name pulled from the PromoBadge definition. */
    name: string;
    image: string;
    /** Partner / event label (e.g. "OpenSea Event"). */
    partnerName: string;
    /** Number of these the player collected. */
    owned: number;
    /** 1-indexed rank on the event leaderboard. Null when not ranked. */
    rank: number | null;
}

export interface ProfileTrophyCase {
    /** Forward-only count of confirmed Daily Challenge #1 finishes, bumped
     *  in /api/daily-champ-bonus when a champion claims their bonus.
     *  Historical wins predating that counter aren't included. */
    dailyWins: number;
    /** Event trophies — one per promo/partnership the player engaged with.
     *  Empty when the player hasn't collected any promo pins yet. */
    events: ProfileEventTrophy[];
    /** True when the player has hit 100% of BADGES.length unique pins,
     *  unlocking the exclusive Pin Drop completionist badge. */
    completedPinBook: boolean;
}

export interface ProfileTier {
    id: TierId;
    label: string;
    color: string;
    accent: string;
}

export interface ProfileResponse {
    username: string;
    avatarUrl: string | null;
    joinedAt: string | null;
    rank: {
        /** All-time Classic rank (1-indexed, null if unranked). */
        score: number | null;
        /** All-time Frenzy rank (1-indexed, null if unranked). */
        frenzy: number | null;
        pins: number | null;
    };
    tier: ProfileTier;
    /** Active daily-play streak. Resets to 0 if the player hasn't logged
     *  in today or yesterday (matching the streak API's active-window
     *  rule), so the nameplate never shows a stale streak number. */
    streak: number;
    trophyCase: ProfileTrophyCase;
    best: {
        /** Personal best Classic score, all-time. Null until first
         *  classic submission. */
        allTime: number | null;
        /** Personal best Frenzy score, all-time. Null until first
         *  frenzy submission. */
        frenzy: number | null;
        /** Personal best Daily Challenge score for today only. Kept
         *  on the data layer for any future consumer; the public
         *  profile no longer surfaces it. */
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

function tierFromInfo(info: TierInfo): ProfileTier {
    return { id: info.id, label: info.label, color: info.color, accent: info.accent };
}

export async function getProfile(rawUsername: string): Promise<ProfileResponse | null> {
    if (!rawUsername || typeof rawUsername !== "string") return null;
    const username = decodeURIComponent(rawUsername).toLowerCase();

    // Reject obviously-bad input without hitting KV. Usernames in this
    // app are alphanumeric + underscores, capped at 32 chars.
    if (!/^[a-z0-9_]{1,32}$/.test(username)) return null;

    const today = getEasternDailyKey();

    const [
        authRaw,
        profileRaw,
        pinbookRaw,
        gamesPlayedRaw,
        gameLogRaw,
        streakRaw,
        dailyWinsRaw,
    ] = await Promise.all([
        kv.get(`user_auth:${username}`),
        kv.get(`user:${username}`),
        kv.get(`pinbook:${username}`),
        kv.hget("classic_matches_played", username),
        kv.zrange(`gamelog:${username}`, 0, 9, { rev: true }),
        kv.get(`streak:${username}`) as Promise<{ streak?: number; lastPlayed?: string } | null>,
        kv.hget("daily_wins", username),
    ]);

    // Match the streak API's "active streak" rule: only count if the
    // player played today or yesterday. Otherwise the streak has lapsed
    // and we surface 0 (same as the home screen + leaderboard).
    const todayKey = getEasternDailyKey();
    const yesterdayKey = getEasternYesterdayKey();
    const rawStreak = Number(streakRaw?.streak || 0);
    const streakActive = streakRaw?.lastPlayed === todayKey || streakRaw?.lastPlayed === yesterdayKey;
    const streak = streakActive ? rawStreak : 0;

    const auth = authRaw as { username?: string; banned?: boolean; createdAt?: string } | null;
    const profile = profileRaw as { username?: string; avatarUrl?: string } | null;
    // Banned + non-existent users return null. Public surface never
    // exposes ban state.
    if (!auth || auth.banned === true) return null;

    const canonicalUsername = profile?.username || auth.username || rawUsername;

    // Score rank reads from the canonical-cased entry; pin rank uses
    // lowercase since the pinbook leaderboard zset keys members that
    // way (see /api/pinbook/leaderboard updateLeaderboardEntry).
    const [
        allTimeScore,
        allTimeRank,
        dailyScore,
        pinRank,
        frenzyScore,
        frenzyRank,
    ] = await Promise.all([
        kv.zscore("classic_leaderboard", canonicalUsername) as Promise<number | null>,
        kv.zrevrank("classic_leaderboard", canonicalUsername) as Promise<number | null>,
        kv.zscore(`daily_leaderboard:${today}`, canonicalUsername) as Promise<number | null>,
        kv.zrevrank("pinbook:lb:rank", username) as Promise<number | null>,
        kv.zscore("frenzy_leaderboard", canonicalUsername) as Promise<number | null>,
        kv.zrevrank("frenzy_leaderboard", canonicalUsername) as Promise<number | null>,
    ]);

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
    // Profile shows the whole collection rather than a top-6 slice,
    // so the showcase reads as a real pinbook page. `topPins` keeps
    // its sort (cosmic → blue → name) so the rarest pins lead.
    const topPins = owned;
    // Use BADGES.length so tier + completion stay in sync with the
    // canonical Tier modal (TierInfoModal), the pin leaderboard
    // (TOTAL_BADGES = BADGES.length), and the home-screen hero chip
    // (LandingPageArcade uses BADGES.length too). Earlier this excluded
    // collectOnly badges, which inflated cazsreyem (77 unique) to 100%
    // / One-Of-One despite the pin leaderboard ranking him at #60.
    const denominator = BADGES.length;
    const completion = denominator > 0
        ? Math.round((uniquePins / denominator) * 100)
        : 0;

    // Trophy case — running record of special-event achievements. Today
    // that means promo / partnership pins (e.g. OpenSea Aye Aye, Captain)
    // and Daily Challenge wins. Adds to this list as more events ship.
    //
    // Promo pins are tracked ENTIRELY in the promo:<id>:leaderboard zset
    // (member = username, score = collection count) — they're never
    // written to pinbook.pins. So both the owned count and the rank
    // come from the same zset: zscore for count, zrevrank for rank.
    // Daily wins are a forward-only hash counter bumped in
    // /api/daily-champ-bonus on successful claim.
    const promoLookups = await Promise.all(
        PROMO_BADGES.map(async (promo: PromoBadge) => {
            const lbKey = promoLeaderboardKey(promo.id);
            const [scoreRaw, rankRaw] = await Promise.all([
                kv.zscore(lbKey, username) as Promise<number | null>,
                kv.zrevrank(lbKey, username) as Promise<number | null>,
            ]);
            const owned = scoreRaw !== null ? Number(scoreRaw) : 0;
            if (owned <= 0) return null;
            return {
                id: promo.id,
                name: promo.name,
                image: promo.image,
                partnerName: promo.partnerName,
                owned,
                rank: rankRaw !== null ? rankRaw + 1 : null,
            } as ProfileEventTrophy;
        }),
    );
    const completedPinBook = uniquePins >= BADGES.length && BADGES.length > 0;

    const trophyCase: ProfileTrophyCase = {
        dailyWins: Number(dailyWinsRaw || 0),
        events: promoLookups.filter((t): t is ProfileEventTrophy => !!t),
        completedPinBook,
    };

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
            score: allTimeRank !== null ? allTimeRank + 1 : null,
            frenzy: frenzyRank !== null ? frenzyRank + 1 : null,
            pins: pinRank !== null ? pinRank + 1 : null,
        },
        tier: tierFromInfo(getTier(completion)),
        streak,
        trophyCase,
        best: {
            allTime: allTimeScore !== null ? Number(allTimeScore) : null,
            frenzy: frenzyScore !== null ? Number(frenzyScore) : null,
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
