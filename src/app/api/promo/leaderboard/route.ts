import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
    isPromoActive,
    getActivePromoBadges,
    PROMO_BADGES,
    promoLeaderboardKey,
    findPromoBadge,
    eventSetPointsKey,
    eventSetHerdsKey,
    decodeHerdsScore,
    eventSetReachedCapKey,
    findPromoEventSet,
    getEventSetPins,
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
        // ?set=<eventSetId> reads from the points-scored event-set
        // leaderboard. ?id=<promoId> reads from the per-pin counter
        // (which doubles as the leaderboard for standalone events).
        const querySetId = url.searchParams.get('set');

        // Set-event mode: source key is event_set:<setId>:points,
        // metadata comes from PROMO_EVENT_SETS + the set's pins.
        if (querySetId) {
            const setDef = findPromoEventSet(querySetId);
            const pins = getEventSetPins(querySetId);
            if (!setDef || pins.length === 0) {
                return NextResponse.json(
                    { promo: null, leaderboard: [], userEntry: null, totalPlayers: 0, active: isPromoActive() },
                    { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
                );
            }
            const key = eventSetPointsKey(querySetId);
            if (currentUsername) {
                await recoverStrandedPromoPending(currentUsername);
            }
            const [topRaw, totalPlayersRaw, userScoreRaw, userAscRankRaw] = await Promise.all([
                kv.zrange(key, 0, 49, { rev: true, withScores: true }) as Promise<Array<string | number>>,
                kv.zcard(key),
                currentUsername ? kv.zscore(key, currentUsername) : Promise.resolve(null),
                currentUsername ? kv.zrank(key, currentUsername) : Promise.resolve(null),
            ]);
            const leaderboard: { username: string; count: number; rank: number; pinCounts: Record<string, number>; avatarUrl: string }[] = [];
            for (let i = 0; i < topRaw.length; i += 2) {
                leaderboard.push({
                    username: String(topRaw[i]),
                    count: Number(topRaw[i + 1]),
                    rank: (i / 2) + 1,
                    pinCounts: {}, // filled in below
                    avatarUrl: '', // filled in below
                });
            }
            // Batch-fetch profiles so the drawer doesn't fire N per-row
            // fetches to /api/profiles when it opens. One mget covers
            // every visible avatar in a single RTT.
            if (leaderboard.length > 0) {
                const profileKeys = leaderboard.map(e => `user:${e.username}`);
                const profiles = await kv.mget(...profileKeys) as Array<{ avatarUrl?: string } | null>;
                leaderboard.forEach((entry, i) => {
                    entry.avatarUrl = profiles[i]?.avatarUrl ?? '';
                });
            }
            // Enrich each leaderboard row with per-pin counts. One
            // zscore per (pin × user) — 4 pins × 50 users = 200 reads,
            // batched via Promise.all so it's a single RTT.
            if (leaderboard.length > 0) {
                const pinPromises: Promise<number | null>[] = [];
                const pinIndex: { entryIdx: number; pinId: string }[] = [];
                leaderboard.forEach((entry, entryIdx) => {
                    pins.forEach(pin => {
                        pinIndex.push({ entryIdx, pinId: pin.id });
                        pinPromises.push(
                            kv.zscore(promoLeaderboardKey(pin.id), entry.username) as Promise<number | null>
                        );
                    });
                });
                const allCounts = await Promise.all(pinPromises);
                pinIndex.forEach((ref, i) => {
                    const v = allCounts[i];
                    leaderboard[ref.entryIdx].pinCounts[ref.pinId] = typeof v === 'number' ? Number(v) : 0;
                });
            }
            // Tiebreaker cascade for the points board: points →
            // gigas (highest-points pin count) → total pins → speed
            // to cap (earliest cappedTotal ≥ scoreCap). Reorders
            // rows that share the same points score; ranks are
            // reassigned after the sort so the client sees the true
            // order.
            if (leaderboard.length > 1) {
                const gigaPin = [...pins].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
                // Batch reached_cap timestamps — one mget for all rows.
                const capKeys = leaderboard.map(e => eventSetReachedCapKey(querySetId, e.username));
                const capTimestamps = capKeys.length > 0
                    ? await kv.mget(...capKeys) as (number | string | null)[]
                    : [];
                const reachedAt = new Map<string, number>();
                leaderboard.forEach((e, i) => {
                    const raw = capTimestamps[i];
                    const ts = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number(raw) : NaN);
                    if (!isNaN(ts) && ts > 0) reachedAt.set(e.username, ts);
                });
                const totalPinsFor = (e: typeof leaderboard[number]) =>
                    pins.reduce((sum, p) => sum + (e.pinCounts[p.id] ?? 0), 0);
                leaderboard.sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    const aGigas = gigaPin ? (a.pinCounts[gigaPin.id] ?? 0) : 0;
                    const bGigas = gigaPin ? (b.pinCounts[gigaPin.id] ?? 0) : 0;
                    if (bGigas !== aGigas) return bGigas - aGigas;
                    const aTotal = totalPinsFor(a);
                    const bTotal = totalPinsFor(b);
                    if (bTotal !== aTotal) return bTotal - aTotal;
                    const aCap = reachedAt.get(a.username) ?? Infinity;
                    const bCap = reachedAt.get(b.username) ?? Infinity;
                    return aCap - bCap;
                });
                leaderboard.forEach((e, i) => { e.rank = i + 1; });
            }
            const totalPlayers = typeof totalPlayersRaw === 'number' ? totalPlayersRaw : 0;
            let userEntry: { username: string; count: number; rank: number; pinCounts: Record<string, number>; avatarUrl: string } | null = null;
            // Per-pin owned counts for the signed-in user — drives the
            // "Set" tab in the drawer.
            const ownedPerPin: Record<string, number> = {};
            if (currentUsername) {
                const scores = await Promise.all(pins.map(p => kv.zscore(promoLeaderboardKey(p.id), currentUsername)));
                pins.forEach((p, i) => {
                    ownedPerPin[p.id] = typeof scores[i] === 'number' ? Number(scores[i]) : 0;
                });
            } else {
                pins.forEach(p => { ownedPerPin[p.id] = 0; });
            }
            if (currentUsername) {
                const inTop = leaderboard.find(e => e.username.toLowerCase() === currentUsername.toLowerCase());
                if (inTop) {
                    userEntry = inTop;
                } else if (userScoreRaw !== null && userScoreRaw !== undefined) {
                    const ascRank = typeof userAscRankRaw === 'number' ? userAscRankRaw : null;
                    const userProfile = await kv.get(`user:${currentUsername}`) as { avatarUrl?: string } | null;
                    userEntry = {
                        username: currentUsername,
                        count: Number(userScoreRaw),
                        rank: ascRank !== null ? totalPlayers - ascRank : totalPlayers,
                        // Reuse the per-pin owned counts we already fetched
                        // for the Set tab.
                        pinCounts: { ...ownedPerPin },
                        avatarUrl: userProfile?.avatarUrl ?? '',
                    };
                }
            }
            // Herds leaderboard — same top-50 read, but from the herds
            // zset with composite score (fullSets × 1000 + points).
            // Decoded into { herds, points } per entry for the client.
            const herdsKey = eventSetHerdsKey(querySetId);
            const herdsRaw = await kv.zrange(herdsKey, 0, 49, { rev: true, withScores: true }) as Array<string | number>;
            const herdsLeaderboard: { username: string; herds: number; count: number; rank: number; avatarUrl: string }[] = [];
            for (let i = 0; i < herdsRaw.length; i += 2) {
                const username = String(herdsRaw[i]);
                const decoded = decodeHerdsScore(Number(herdsRaw[i + 1]));
                herdsLeaderboard.push({
                    username,
                    herds: decoded.fullSets,
                    count: decoded.cappedPoints,
                    rank: (i / 2) + 1,
                    avatarUrl: '', // filled below via mget
                });
            }
            if (herdsLeaderboard.length > 0) {
                const profileKeys = herdsLeaderboard.map(e => `user:${e.username}`);
                const profiles = await kv.mget(...profileKeys) as Array<{ avatarUrl?: string } | null>;
                herdsLeaderboard.forEach((entry, i) => {
                    entry.avatarUrl = profiles[i]?.avatarUrl ?? '';
                });
            }
            // Grail Chase leaderboard — ranked by chase-pin (isChase)
            // count. Reuses the existing per-pin zset for the chase pin,
            // so no separate KV write is needed at drop time. Only
            // present for sets that actually have a chase pin defined.
            const chasePin = pins.find(p => p.isChase);
            const grailLeaderboard: { username: string; count: number; rank: number; avatarUrl: string }[] = [];
            if (chasePin) {
                const grailRaw = await kv.zrange(
                    promoLeaderboardKey(chasePin.id),
                    0, 49,
                    { rev: true, withScores: true },
                ) as Array<string | number>;
                for (let i = 0; i < grailRaw.length; i += 2) {
                    grailLeaderboard.push({
                        username: String(grailRaw[i]),
                        count: Number(grailRaw[i + 1]),
                        rank: (i / 2) + 1,
                        avatarUrl: '',
                    });
                }
                if (grailLeaderboard.length > 0) {
                    const profileKeys = grailLeaderboard.map(e => `user:${e.username}`);
                    const profiles = await kv.mget(...profileKeys) as Array<{ avatarUrl?: string } | null>;
                    grailLeaderboard.forEach((entry, i) => {
                        entry.avatarUrl = profiles[i]?.avatarUrl ?? '';
                    });
                }
            }
            return NextResponse.json(
                {
                    eventSet: {
                        id: setDef.id,
                        name: setDef.name,
                        partnerName: setDef.partnerName,
                        tabLabel: setDef.tabLabel,
                        accentColor: setDef.accentColor,
                        description: setDef.description,
                        eventWindow: setDef.eventWindow,
                        prizeNote: setDef.prizeNote,
                        endsAt: setDef.endsAt,
                        setBonusPoints: setDef.setBonusPoints ?? null,
                        scoreCap: setDef.scoreCap ?? null,
                        pins: pins.map(p => ({
                            id: p.id,
                            name: p.name,
                            image: p.image,
                            rarityLabel: p.rarityLabel ?? null,
                            points: p.points ?? 1,
                            owned: ownedPerPin[p.id] ?? 0,
                            // isChase lets any client exclude the grail pin from
                            // herd (min-of-base) math without re-deriving it from
                            // the registry.
                            isChase: p.isChase ?? false,
                        })),
                    },
                    scoreLabel: 'points',
                    leaderboard,
                    herdsLeaderboard,
                    grailLeaderboard,
                    userEntry,
                    totalPlayers,
                    active: isPromoActive(),
                },
                { headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=60' } }
            );
        }

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
