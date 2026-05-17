import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
    isPromoActive,
    getActivePromoBadges,
    PROMO_BADGES,
    promoLeaderboardKey,
} from '@/lib/promo-badges';

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

        // Pull top 50 with scores — highest count first.
        // Vercel KV's zrange with { rev: true, withScores: true } returns
        // a flat [member, score, member, score, ...] array.
        const top: Array<string | number> = await kv.zrange(key, 0, 49, { rev: true, withScores: true }) as Array<string | number>;
        const leaderboard: { username: string; count: number; rank: number }[] = [];
        for (let i = 0; i < top.length; i += 2) {
            leaderboard.push({
                username: String(top[i]),
                count: Number(top[i + 1]),
                rank: (i / 2) + 1,
            });
        }

        const totalPlayers = await kv.zcard(key);

        // If signed-in user isn't in the top 50, surface their entry
        // separately so the modal can pin them at the bottom.
        let userEntry: { username: string; count: number; rank: number } | null = null;
        if (currentUsername) {
            const inTop = leaderboard.find(e => e.username.toLowerCase() === currentUsername.toLowerCase());
            if (inTop) {
                userEntry = inTop;
            } else {
                const score = await kv.zscore(key, currentUsername);
                if (score !== null && score !== undefined) {
                    // zrank returns ascending rank (0-based). Convert to
                    // descending 1-based rank: totalPlayers - ascRank.
                    const ascRank = await kv.zrank(key, currentUsername);
                    let derivedRank: number;
                    if (typeof ascRank === 'number') {
                        derivedRank = (totalPlayers as number) - ascRank;
                    } else {
                        derivedRank = totalPlayers as number;
                    }
                    userEntry = {
                        username: currentUsername,
                        count: Number(score),
                        rank: derivedRank,
                    };
                }
            }
        }

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
                totalPlayers: totalPlayers ?? 0,
                active: isPromoActive(),
            },
            { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
        );
    } catch (e) {
        console.error('Promo leaderboard error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
