import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
    isPromoActive,
    getActivePromoBadges,
    PROMO_BADGES,
    promoLeaderboardKey,
    findPromoBadge,
} from '@/lib/promo-badges';

/**
 * Recover stranded promo pendings for the requesting user.
 *
 * The intended flow is open → reveal animation → collect. The collect
 * step calls kv.del(pendingKey) + zincrby. But various client-side
 * failure modes (cached old bundle pre-resolveBadge fix, network drop
 * mid-collect, browser tab closed before onComplete fires, etc.) can
 * leave a pending in KV that never gets credited. The leaderboard
 * count visibly lags.
 *
 * This sweep runs on every leaderboard GET for the signed-in user.
 * If their pending is isPromo and at least RECOVERY_AGE_MS old (so we
 * don't race a legitimate in-flight collect), we credit + del it
 * before reading the score. The user lands on the leaderboard and
 * sees their correct count without any manual intervention.
 */
const RECOVERY_AGE_MS = 30_000;

async function recoverStrandedPromoPending(username: string): Promise<void> {
    try {
        const pendingKey = `pinbook:${username}:pending`;
        const pending = await kv.get(pendingKey) as { tier: string; badgeId: string; openedAt: number; isPromo?: boolean } | null;
        if (!pending || !pending.isPromo) return;
        if (Date.now() - (pending.openedAt ?? 0) < RECOVERY_AGE_MS) return;
        const promoDef = findPromoBadge(pending.badgeId);
        if (!promoDef || promoDef.tier !== pending.tier) return;
        // ZADD via zincrby on the leaderboard zset, mirror what /collect does.
        await kv.zincrby(promoLeaderboardKey(promoDef.id), 1, username);
        await kv.del(pendingKey);
    } catch (e) {
        console.error('Promo pending recovery error:', e);
        // Don't throw — the leaderboard read should still succeed.
    }
}

/**
 * Promo leaderboard endpoint.
 *
 * Returns the top collectors for the currently-active promo pin (or for
 * a specific promo via ?id=<promoId> — used by the post-partnership
 * archive flow if you ever want to re-expose a frozen leaderboard).
 *
 * Shape:
 *   {
 *     promo: { id, name, partnerName, tabLabel, image } | null,
 *     leaderboard: [{ username, count, rank }, ...],  // top 50
 *     userEntry: { username, count, rank } | null,    // signed-in user
 *     totalPlayers: number,
 *     active: boolean,
 *   }
 *
 * When `isPromoActive()` is false and no `?id=` is supplied, returns
 * `{ promo: null, leaderboard: [], ... }` so the client can decide
 * whether to render the tab.
 */
export async function GET(req: Request) {
    try {
        const session = await getSession();
        const currentUsername = session?.username || null;

        const url = new URL(req.url);
        const queryId = url.searchParams.get('id');

        // Pick the target promo:
        //   - explicit ?id= wins (lets us read historical leaderboards)
        //   - else: first active promo (typical case)
        //   - else: nothing
        let promo = queryId
            ? PROMO_BADGES.find(p => p.id === queryId) ?? null
            : getActivePromoBadges()[0] ?? null;

        if (!promo) {
            return NextResponse.json(
                { promo: null, leaderboard: [], userEntry: null, totalPlayers: 0, active: isPromoActive() },
                { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
            );
        }

        const key = promoLeaderboardKey(promo.id);

        // Sweep up any stranded isPromo pending for this user before
        // we read the leaderboard. See recoverStrandedPromoPending docs.
        // Only runs for authenticated requests — guests have no pending.
        if (currentUsername) {
            await recoverStrandedPromoPending(currentUsername);
        }

        // Parallelize every KV read. zrange + zcard are user-agnostic,
        // zscore + zrank are only needed when a user is signed in.
        // Running them concurrently shaves ~150ms off the warm path
        // versus the previous sequential pipeline.
        const [topRaw, totalPlayersRaw, userScoreRaw, userAscRankRaw] = await Promise.all([
            kv.zrange(key, 0, 49, { rev: true, withScores: true }) as Promise<Array<string | number>>,
            kv.zcard(key),
            currentUsername ? kv.zscore(key, currentUsername) : Promise.resolve(null),
            currentUsername ? kv.zrank(key, currentUsername) : Promise.resolve(null),
        ]);

        const leaderboard: { username: string; count: number; rank: number }[] = [];
        for (let i = 0; i < topRaw.length; i += 2) {
            leaderboard.push({
                username: String(topRaw[i]),
                count: Number(topRaw[i + 1]),
                rank: (i / 2) + 1,
            });
        }
        const totalPlayers = typeof totalPlayersRaw === 'number' ? totalPlayersRaw : 0;

        // If signed-in user isn't in the top 50, surface their entry so
        // the modal can pin them at the bottom. We already paid for the
        // zscore + zrank up-front; the inTop check just chooses whether
        // to use the top-50 row data or the standalone lookup.
        let userEntry: { username: string; count: number; rank: number } | null = null;
        if (currentUsername) {
            const inTop = leaderboard.find(e => e.username.toLowerCase() === currentUsername.toLowerCase());
            if (inTop) {
                userEntry = inTop;
            } else if (userScoreRaw !== null && userScoreRaw !== undefined) {
                // zrank returns ascending rank (0-based). Convert to
                // descending 1-based rank: totalPlayers - ascRank.
                const ascRank = typeof userAscRankRaw === 'number' ? userAscRankRaw : null;
                userEntry = {
                    username: currentUsername,
                    count: Number(userScoreRaw),
                    rank: ascRank !== null ? totalPlayers - ascRank : totalPlayers,
                };
            }
        }

        // Cache as `private`: the response includes user-specific data
        // (userEntry), so we can't let the CDN serve one user's response
        // to another. Browser-level cache is fine and still keeps repeat
        // tab opens snappy within the window.
        return NextResponse.json(
            {
                promo: {
                    id: promo.id,
                    name: promo.name,
                    partnerName: promo.partnerName,
                    tabLabel: promo.tabLabel,
                    image: promo.image,
                },
                leaderboard,
                userEntry,
                totalPlayers,
                active: isPromoActive(),
            },
            { headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=60' } }
        );
    } catch (e) {
        console.error('Promo leaderboard error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
