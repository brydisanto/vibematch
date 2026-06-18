import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession, isUserBanned } from '@/lib/auth';
import { rateLimit, rateLimited429 } from '@/lib/rate-limit';
import { computeUserEntry, updateLeaderboardEntry } from './leaderboard/route';
import { BADGES, type Badge, type BadgeTier } from '@/lib/badges';
import { getEasternDailyKey } from '@/lib/daily-window';
import { bumpDailyCounter } from '@/lib/daily-counters';
import {
    PROMO_DROP_RATE,
    isPromoActive,
    pickActivePromoBadge,
    findPromoBadge,
    promoLeaderboardKey,
    eventSetPointsKey,
} from '@/lib/promo-badges';
import { frenzyCapsulesForScore, classicCapsulesForScore } from '@/lib/gameEngine';
import { logAuditEvent } from '@/lib/audit-log';
import { checkAutomatedAgent, checkOrigin } from '@/lib/anti-automation';

const FRENZY_CAPSULE_SCORE_THRESHOLD = 30000;

// Maximum plausible score for a classic game — reject forged submissions
// above this. Bumped from 500K alongside the scoring system change (base
// scores +50%, combo multiplier 0.75x → 1.0x) so legitimate high-skill
// runs aren't rejected at the API boundary.
const MAX_PLAUSIBLE_SCORE = 800_000;

// Rarity weights for capsule drops
// 101 total: 19 blue, 50 silver, 9 special, 20 gold, 3 cosmic
const TIER_WEIGHTS = {
    blue: 45,      // ~45% Common (19 badges)
    silver: 30,    // ~30% Rare (51 badges)
    special: 13,   // ~13% Strategic Special (9 badges, weighted drops within)
    gold: 9,       // ~9% Legendary (19 badges)
    cosmic: 3,     // ~3% Cosmic (3 badges)
} as const;

const CAPSULE_SCORE_THRESHOLD = 15000;
const CLASSIC_DAILY_CAP = 10;
export const MAX_BONUS_PRIZE_GAMES_PER_DAY = 15;

export interface PinBookData {
    pins: Record<string, { count: number; firstEarned: string; lastPulled?: string }>;
    capsules: number; // unopened
    totalOpened: number;
    totalEarned: number;
    /** Lifetime pins discovered per tier — INCREMENT ONLY. Incremented
     *  in the `collect` action when a pin drops (even duplicates).
     *  Never decremented on reroll, so tier-find achievements stay
     *  sticky regardless of subsequent burn flows. Backfilled from the
     *  current held count when we first encounter a legacy pinbook
     *  that doesn't have this field yet. */
    totalFoundByTier?: Partial<Record<BadgeTier, number>>;
    /** Lifetime count of completed rerolls. Bumped in
     *  /api/pinbook/reroll after a successful burn+payment. Drives the
     *  Redemption / S(pin) Cycle / Pin Magician / Pin Wizard quests.
     *  Forward-only — no retroactive backfill. */
    lifetimeRerollsCompleted?: number;
    /** Lifetime count of bonus prize-games purchased with $VIBESTR.
     *  Bumped in /api/pinbook/purchase-prize-games on success. Drives
     *  the Stacked quest. Forward-only — no retroactive backfill. */
    lifetimeBonusGamesPurchased?: number;
    /** Has collected at least one Event (promo partnership) pin.
     *  Set in the `collect` action when a promo badge is processed.
     *  Drives the Eventide quest. Retroactive credit is granted via
     *  the promo zsets when computing PlayerContext. */
    hasCollectedEventPin?: boolean;
}

interface DailyTracker {
    classicPlays: number;       // combined classic + frenzy plays (cap enforcement)
    date: string;
    bonusPrizeGames?: number;   // additional prize games purchased today
    // ===== Daily activity counters =====
    // Added 2026-05-21 to power the admin user-profile daily activity
    // table. All optional with 0 defaults so legacy daily records (which
    // don't have these fields) display as 0 in the admin view without
    // breaking anything.
    capsulesEarned?: number;    // capsules awarded today (any source)
    capsulesOpened?: number;    // capsule open actions today
    pinsFound?: number;         // pins added to the pinbook today (any source)
    newPinsFound?: number;      // unique-to-pinbook pins added today
    // Subset of classicPlays specifically for Frenzy. classicPlays
    // continues to be the combined counter for daily cap enforcement;
    // frenzyPlays lets the admin chart split the two modes. Pure
    // Classic plays = classicPlays - (frenzyPlays || 0).
    frenzyPlays?: number;
}

export function getTodayKey(username: string): string {
    return `pinbook:${username}:daily:${getEasternDailyKey()}`;
}

export async function getDailyTracker(username: string): Promise<DailyTracker> {
    const key = getTodayKey(username);
    const data = await kv.get(key) as DailyTracker | null;
    const today = getEasternDailyKey();
    if (data && data.date === today) return { bonusPrizeGames: 0, ...data };
    return { classicPlays: 0, date: today, bonusPrizeGames: 0 };
}

async function incrementClassicPlays(username: string, mode: 'classic' | 'frenzy' = 'classic'): Promise<DailyTracker> {
    // Ensure the tracker exists with today's date (so bonusPrizeGames isn't lost on rollover)
    const key = getTodayKey(username);
    const existing = await getDailyTracker(username);
    const updated: DailyTracker = {
        ...existing,
        classicPlays: existing.classicPlays + 1,
        // frenzyPlays is a subset of classicPlays — keep them in sync so
        // `classicPlays - frenzyPlays` is always the pure Classic count.
        frenzyPlays: (existing.frenzyPlays || 0) + (mode === 'frenzy' ? 1 : 0),
        date: existing.date,
        bonusPrizeGames: existing.bonusPrizeGames || 0,
    };
    // 95-day TTL so the admin daily-activity chart can see the full
    // 90-day window. The cap-enforcement check only ever reads today's
    // tracker so a longer retention has no functional cost.
    await kv.set(key, updated, { ex: 86400 * 95 });
    return updated;
}

// bumpDailyCounter is shared with referral + reroll via lib/daily-counters.

function emptyPinBook(): PinBookData {
    return {
        pins: {},
        capsules: 0,
        totalOpened: 0,
        totalEarned: 0,
        totalFoundByTier: {},
        lifetimeRerollsCompleted: 0,
        lifetimeBonusGamesPurchased: 0,
        hasCollectedEventPin: false,
    };
}

/**
 * Ensure `totalFoundByTier` is populated on a pinbook. Legacy pinbooks
 * pre-dating the tier-find achievements don't have this field — backfill
 * from their current held pin counts so they don't start from zero. Only
 * runs once per pinbook (idempotent — subsequent calls see a non-null
 * map and leave it alone).
 */
function ensureTotalFoundByTier(data: PinBookData): Required<Pick<PinBookData, 'totalFoundByTier'>>['totalFoundByTier'] {
    if (data.totalFoundByTier) return data.totalFoundByTier;
    const seeded: Partial<Record<BadgeTier, number>> = {};
    const tierOf = new Map(BADGES.map(b => [b.id, b.tier]));
    for (const [badgeId, entry] of Object.entries(data.pins || {})) {
        const t = tierOf.get(badgeId);
        if (!t) continue;
        seeded[t] = (seeded[t] || 0) + (entry?.count || 0);
    }
    data.totalFoundByTier = seeded;
    return seeded;
}

// Per-user lock backed by KV (works across serverless instances).
// In-memory map is kept as a fast path for same-instance concurrency.
const userLocks = new Map<string, Promise<any>>();
async function withUserLock<T>(username: string, fn: () => Promise<T>): Promise<T> {
    // KV lock: set NX with short TTL, retry briefly if contested
    const lockKey = `lock:pinbook:${username}`;
    const maxAttempts = 10;
    let attempts = 0;
    while (attempts < maxAttempts) {
        const acquired = await kv.set(lockKey, '1', { nx: true, ex: 5 });
        if (acquired) break;
        attempts++;
        await new Promise(r => setTimeout(r, 100));
    }
    if (attempts >= maxAttempts) {
        throw new Error('Could not acquire user lock after retries');
    }

    // In-memory serialization for same-instance concurrency
    const prev = userLocks.get(username) || Promise.resolve();
    const next = prev.then(fn, fn);
    userLocks.set(username, next);
    try {
        return await next;
    } finally {
        await kv.del(lockKey).catch(() => {});
        // Clean up if this is still the latest promise
        if (userLocks.get(username) === next) userLocks.delete(username);
    }
}

/**
 * Recover a stranded non-promo capsule pending for this user. Mirrors the
 * promo recovery in /api/promo/leaderboard but for canonical pins.
 *
 * The intended flow is open → reveal animation → collect. If the collect
 * call fails (network drop after the reveal started, browser closed
 * mid-animation, etc.) the pending sits in KV with the rolled badge
 * already determined, but the user's pinbook never gains the pin. With
 * the 5-minute pending TTL plus client-side retries this should be rare,
 * but when it happens it strands a paid-for capsule. This sweep credits
 * the rolled badge to the user's pinbook on their next pinbook GET if
 * the pending is at least RECOVERY_AGE_MS old (so we don't race a
 * legitimate in-flight collect).
 */
const PINBOOK_PENDING_RECOVERY_AGE_MS = 30_000;
async function recoverStrandedPinbookPending(
    username: string,
    data: PinBookData,
): Promise<{ recovered: boolean; data: PinBookData }> {
    try {
        const pendingKey = `pinbook:${username}:pending`;
        const pending = await kv.get(pendingKey) as { tier: string; badgeId: string; openedAt: number; isPromo?: boolean } | null;
        if (!pending) return { recovered: false, data };
        // Promo pendings have their own recovery in /api/promo/leaderboard.
        if (pending.isPromo) return { recovered: false, data };
        if (Date.now() - (pending.openedAt ?? 0) < PINBOOK_PENDING_RECOVERY_AGE_MS) {
            return { recovered: false, data };
        }
        const badgeDef = BADGES.find(b => b.id === pending.badgeId);
        if (!badgeDef || badgeDef.tier !== pending.tier) return { recovered: false, data };

        // Credit the badge identically to the collect handler so the
        // recovered pin matches what the user would have gotten.
        const nowIso = new Date().toISOString();
        const existing = data.pins[pending.badgeId];
        if (existing) {
            existing.count += 1;
            existing.lastPulled = nowIso;
        } else {
            data.pins[pending.badgeId] = { count: 1, firstEarned: nowIso, lastPulled: nowIso };
        }
        const tierFound = ensureTotalFoundByTier(data);
        tierFound[badgeDef.tier] = (tierFound[badgeDef.tier] || 0) + 1;

        await kv.set(`pinbook:${username}`, data);
        await kv.del(pendingKey);
        // Bump the daily-activity counters too so admin charts stay in sync.
        await bumpDailyCounter(username, "pinsFound", 1);
        if (!existing) await bumpDailyCounter(username, "newPinsFound", 1);
        return { recovered: true, data };
    } catch (e) {
        console.error('Pinbook pending recovery error:', e);
        return { recovered: false, data };
    }
}

// GET — fetch pin book for logged-in user
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const username = (session.username as string).toLowerCase();
        const key = `pinbook:${username}`;
        let [data, profile] = await Promise.all([
            kv.get(key) as Promise<PinBookData | null>,
            kv.get(`user:${username}`) as Promise<{ username?: string; avatarUrl?: string } | null>,
        ]);

        // Sweep any stranded non-promo pending before serving the pinbook
        // so the returned response includes the recovered pull. Only runs
        // when there's an existing pinbook (new users have nothing to
        // recover). No-ops when no pending exists or pending is too fresh.
        if (data) {
            const swept = await recoverStrandedPinbookPending(username, data);
            data = swept.data;
        }

        // Self-heal: refresh this user's leaderboard entry from their actual pinbook data.
        // This fixes stale entries caused by race conditions in the shared leaderboard key.
        if (data?.pins && Object.keys(data.pins).length > 0) {
            const entry = computeUserEntry(
                profile?.username || username,
                profile?.avatarUrl || '',
                data.pins,
            );
            // Fire-and-forget — don't block the response
            updateLeaderboardEntry(entry).catch(() => {});
        }

        const tracker = await getDailyTracker(username);
        return NextResponse.json({
            ...(data || emptyPinBook()),
            classicPlays: tracker.classicPlays,
            bonusPrizeGames: tracker.bonusPrizeGames || 0,
        });
    } catch (e) {
        console.error('PinBook GET error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST — earn capsule or open capsule
// body: { action: "earn", score: number } or { action: "open" }
export async function POST(req: Request) {
    try {
        // Anti-automation gate. Reject obvious CLI/agent UAs and
        // requests missing a valid browser Origin. See
        // src/lib/anti-automation.ts. Friction, not a hard boundary.
        const uaCheck = checkAutomatedAgent(req);
        const ogCheck = checkOrigin(req);
        if (uaCheck.blocked || ogCheck.blocked) {
            const s = await getSession().catch(() => null);
            await logAuditEvent({
                req,
                username: (s?.username as string) || 'anon',
                action: 'score.rejected',
                meta: {
                    endpoint: 'pinbook',
                    reason: uaCheck.blocked ? (uaCheck.reason || 'automated_agent') : (ogCheck.reason || 'bad_origin'),
                    uaPattern: uaCheck.matchedPattern || '',
                    uaSample: uaCheck.ua.slice(0, 120),
                },
            });
            return NextResponse.json({ error: 'Browser required' }, { status: 403 });
        }

        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const username = (session.username as string).toLowerCase();

        // Banned users keep their session cookie until it expires, but
        // every game-affecting mutation (trackGame, earn, bonus, open)
        // hits this POST handler — gate them all here.
        if (await isUserBanned(username)) {
            return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
        }

        // Per-action rate limits. The hard daily cap (10 base + 15 bonus
        // = 25 plays/day) is enforced lower-down via incrementClassicPlays;
        // these limits are the per-minute rate guard against burst floods.
        // Numbers chosen to be ~3-5x typical player throughput so a real
        // human can't hit them, but a buggy client / hostile loop is
        // capped before it can hammer KV.
        const action = body.action as string | undefined;
        const RATE_LIMITS: Record<string, { max: number; windowSec: number }> = {
            trackGame: { max: 12, windowSec: 60 },  // ~1 game start every 5s sustained
            logGame:   { max: 12, windowSec: 60 },  // pairs with trackGame at game end
            earn:      { max: 6,  windowSec: 60 },  // capsule-earn happens once per game
            bonus:     { max: 3,  windowSec: 60 },  // bonus capsule cap is 1 per game
            // open / collect — bulk "Open All" can fire hundreds of paired
            // calls back-to-back for users with deep inventory (post-raffle,
            // post-streak, after rerolls). Was 30/min, which capped Open All
            // at 30 capsules per window and surfaced as "Something went wrong"
            // on the second attempt. 600/min = 10/sec, comfortably above the
            // bulk loop's sustained rate while still rejecting bot-style
            // hammering.
            open:      { max: 600, windowSec: 60 },
            collect:   { max: 600, windowSec: 60 },
        };
        const limit = action ? RATE_LIMITS[action] : undefined;
        if (limit) {
            const rl = await rateLimit({ scope: `pinbook:${action}`, key: username, max: limit.max, windowSec: limit.windowSec });
            if (!rl.ok) {
                // Observability: surface rate-limit hits for logGame so we
                // can see if real players are tripping the 12/min cap (which
                // would silently drop their gamelog entries pre-client-retry).
                if (action === "logGame") {
                    console.warn(`[logGame] RATE_LIMITED user=${username} max=${limit.max}/${limit.windowSec}s`);
                }
                const r = rateLimited429(rl, `pinbook:${action}`);
                return NextResponse.json(r.body, r.init);
            }
        }

        // Serialize all pinbook mutations per user to prevent read-modify-write races
        return await withUserLock(username, async () => {
        const key = `pinbook:${username}`;
        const data = (await kv.get(key)) as PinBookData | null ?? emptyPinBook();

        if (body.action === 'trackGame') {
            // Track a game started (classic or daily). Issue a one-shot match token
            // that earn/bonus must present to get capsules. Each token represents
            // exactly one physical game the client has started.
            const gameMode = (body.gameMode as string) || 'classic';
            const today = getEasternDailyKey();

            // Daily: atomically set the daily_played marker at game START, not game END.
            // This prevents the "refresh mid-daily to get a fresh board" exploit.
            if (gameMode === 'daily') {
                const playedKey = `daily_played:${username}:${today}`;
                const acquired = await kv.set(playedKey, '1', { nx: true, ex: 86400 * 2 });
                if (!acquired) {
                    return NextResponse.json({ error: 'Daily already played today' }, { status: 400 });
                }
            }

            // Abandon-detection RETIRED. Original purpose: prevent
            // "refresh-shop" — reload the page to reroll the board for
            // free. That was an exploit when trackGame didn't consume a
            // play; today every trackGame increments classicPlays
            // against the daily 10+15 pool, so each refresh is a paid
            // play. Refresh-shopping no longer gives the attacker any
            // advantage they couldn't have gotten by just playing all
            // their plays (leaderboard tracks max score, capsule
            // eligibility is per-game and gated by score threshold).
            //
            // The check was generating false positives — players who
            // legitimately backed out of a bad-luck start within 30s
            // (chrisguyot 2026-05-24) had their next game's
            // leaderboard rank + capsule reward burned. Net result:
            // the protection cost more in legit user friction than
            // the exploit it was preventing now costs the system.
            //
            // We keep the activePointer write below — `prevFinishedMatchId`
            // body field still arrives from the client but is ignored
            // server-side. Leaving the client untouched keeps the deploy
            // backward-compatible.
            const activePointerKey = `pinbook:${username}:activeMatch`;
            const abandonedPrevious = false;

            // Classic + Frenzy share the same daily play counter — both
            // draw from the same bank. Daily Challenge has its own
            // separate one-shot-per-day gate above and doesn't count
            // here. Hitting the cap returns 429 so the client can prompt
            // the player to buy more bonus games or come back tomorrow.
            let classicPlays = 0;
            if (gameMode === 'classic' || gameMode === 'frenzy') {
                const tracker = await getDailyTracker(username);
                const effectiveCap = CLASSIC_DAILY_CAP + (tracker.bonusPrizeGames || 0);
                if (tracker.classicPlays >= effectiveCap) {
                    return NextResponse.json({
                        error: 'Out of plays today',
                        classicPlays: tracker.classicPlays,
                        cap: effectiveCap,
                        baseCap: CLASSIC_DAILY_CAP,
                        bonusPrizeGames: tracker.bonusPrizeGames || 0,
                    }, { status: 429 });
                }
                const updated = await incrementClassicPlays(username, gameMode === 'frenzy' ? 'frenzy' : 'classic');
                classicPlays = updated.classicPlays;
            }

            // Generate match token. Bound to user and single-use.
            const matchId = crypto.randomUUID();
            const matchKey = `pinbook:${username}:match:${matchId}`;
            // Every run that gets past the cap check is capsule-eligible.
            // `abandonedPrevious` is always false now — see the retired
            // abandon-detection block above. Field kept on the token for
            // backward compatibility with legacy in-flight tokens.
            const prizeEligible = true;

            // Server-issued seed for Phase 3 replay verification. Classic
            // mode previously generated the seed client-side, which meant
            // the server couldn't deterministically reconstruct the board
            // for replay. Daily already derives its seed from the date
            // (getDailySeed()), so we honor that here — the server replay
            // path can reproduce the same seed deterministically without
            // needing to store it. For Classic, we generate a fresh
            // 32-bit unsigned int (mulberry32-compatible) and persist it
            // in the match token. Client receives `seed` in the trackGame
            // response and uses it via createInitialState(mode, _, seed).
            //
            // Drafted badges: Vibe Draft mode lets the player pick 6
            // badges from a draft pool. The client passes
            // `draftedBadgeIds` so the server can recompute the same
            // gameBadges array at replay time. Standard Classic / Daily
            // omit this field.
            const seed = gameMode === 'daily'
                ? undefined // daily derives its own seed from the date; no need to store
                : (crypto.getRandomValues(new Uint32Array(1))[0]);
            const rawDraftedIds = body.draftedBadgeIds;
            let draftedBadgeIds: string[] | undefined;
            if (Array.isArray(rawDraftedIds)) {
                const cleaned = rawDraftedIds
                    .filter((s: unknown): s is string => typeof s === 'string')
                    .slice(0, 10);
                if (cleaned.length > 0) draftedBadgeIds = cleaned;
            }

            await kv.set(matchKey, {
                username,
                gameMode,
                createdAt: Date.now(),
                earnedCapsule: false,
                earnedBonus: false,
                logged: false,
                prizeEligible,
                abandonedPrevious,
                seed, // undefined for daily (use getDailySeed at replay time)
                draftedBadgeIds,
            }, { ex: 60 * 60 * 2 }); // 2 hour window

            // Point the active match pointer at the new matchId.
            await kv.set(activePointerKey, matchId, { ex: 60 * 60 * 2 });

            return NextResponse.json({
                tracked: true,
                classicPlays,
                capped: false,
                abandonedPrevious,
                matchId,
                seed, // omit/undefined on daily; client uses getDailySeed() locally
            });

        } else if (body.action === 'logGame') {
            // Log a completed game for admin forensics AND for server-side achievement
            // verification. Stats are client-reported; bounded for sanity. Match-token
            // validated games are additionally stored keyed by matchId so the achievements
            // endpoint can verify gameplay achievements against authoritative stats.
            const matchId = body.matchId as string | undefined;
            const gameMode = body.gameMode as string || 'classic';
            const stats = body.stats as {
                score?: number;
                matchCount?: number;
                maxCombo?: number;
                totalCascades?: number;
                bombsCreated?: number;
                vibestreaksCreated?: number;
                cosmicBlastsCreated?: number;
                crossCount?: number;
                shapesLanded?: Array<{ type: string; count: number }>;
                gameOverReason?: string;
            } | undefined;

            if (!stats || typeof stats !== 'object') {
                console.error(`[logGame] REJECTED missing-stats user=${username} matchId=${matchId || 'none'}`);
                return NextResponse.json({ error: 'Missing stats' }, { status: 400 });
            }

            // moveSequence: Phase 2 of server-authoritative score verification.
            // Bound + sanitize the array. We accept either swap or tap shapes
            // with all positions in the 0..7 board range. Anything else gets
            // dropped silently (no reject — old clients won't send this field
            // at all). The whole array is hard-capped at 200 entries: classic
            // is 30 moves, frenzy can be ~150 in a god-run, 200 leaves plenty
            // of headroom without inviting payload bloat from a hostile client.
            const MAX_MOVES = 200;
            const isPos = (p: unknown): p is { row: number; col: number } =>
                !!p && typeof p === 'object' &&
                typeof (p as { row: unknown }).row === 'number' &&
                typeof (p as { col: unknown }).col === 'number' &&
                (p as { row: number }).row >= 0 && (p as { row: number }).row < 8 &&
                (p as { col: number }).col >= 0 && (p as { col: number }).col < 8;
            type SafeSwap = { kind: 'swap'; from: { row: number; col: number }; to: { row: number; col: number }; t?: number; trusted?: boolean };
            type SafeTap = { kind: 'tap'; at: { row: number; col: number }; t?: number; trusted?: boolean };
            const safeMoveSequence: Array<SafeSwap | SafeTap> = [];
            // Per-move behavioral signals are optional and bounded:
            //   t        positive integer ms from game start (clamped 0..30min)
            //   trusted  boolean (PointerEvent.isTrusted) — false flags
            //            synthetic dispatchEvent calls
            const sanitizeMoveT = (v: unknown): number | undefined => {
                if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
                return Math.min(Math.floor(v), 30 * 60 * 1000);
            };
            const sanitizeTrust = (v: unknown): boolean | undefined =>
                typeof v === 'boolean' ? v : undefined;
            if (Array.isArray(body.moveSequence)) {
                for (const m of body.moveSequence.slice(0, MAX_MOVES)) {
                    if (!m || typeof m !== 'object') continue;
                    const kind = (m as { kind: unknown }).kind;
                    const t = sanitizeMoveT((m as { t?: unknown }).t);
                    const trusted = sanitizeTrust((m as { trusted?: unknown }).trusted);
                    if (kind === 'swap') {
                        const from = (m as { from?: unknown }).from;
                        const to = (m as { to?: unknown }).to;
                        if (isPos(from) && isPos(to)) {
                            safeMoveSequence.push({ kind: 'swap', from, to, t, trusted });
                        }
                    } else if (kind === 'tap') {
                        const at = (m as { at?: unknown }).at;
                        if (isPos(at)) {
                            safeMoveSequence.push({ kind: 'tap', at, t, trusted });
                        }
                    }
                }
            }

            // Tier-1 behavioral telemetry — derived from the per-move
            // timing series + client-reported game-level signals.
            // Computed once here so /api/scores can read it off matchstats
            // without recomputing on every submission.
            const moveTimes = safeMoveSequence
                .map(m => m.t)
                .filter((t): t is number => typeof t === 'number');
            const firstMoveMs = moveTimes.length > 0 ? moveTimes[0] : null;
            let moveStdDevMs: number | null = null;
            if (moveTimes.length >= 3) {
                const deltas: number[] = [];
                for (let i = 1; i < moveTimes.length; i++) {
                    deltas.push(moveTimes[i] - moveTimes[i - 1]);
                }
                const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
                const variance = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length;
                moveStdDevMs = Math.round(Math.sqrt(variance));
            }
            const behavioralIn = (body.behavioral as { webdriver?: unknown; untrustedEvents?: unknown; gameDurationMs?: unknown } | undefined) ?? {};
            const behavioral = {
                webdriver: behavioralIn.webdriver === true,
                untrustedEvents: Number.isFinite(behavioralIn.untrustedEvents)
                    ? Math.min(Math.max(0, Math.floor(behavioralIn.untrustedEvents as number)), 1000)
                    : 0,
                gameDurationMs: Number.isFinite(behavioralIn.gameDurationMs)
                    ? Math.min(Math.max(0, Math.floor(behavioralIn.gameDurationMs as number)), 30 * 60 * 1000)
                    : 0,
                firstMoveMs,
                moveStdDevMs,
                trustedRatio: safeMoveSequence.length > 0
                    ? Number((safeMoveSequence.filter(m => m.trusted !== false).length / safeMoveSequence.length).toFixed(3))
                    : 1,
            };

            // Sanity-bound every numeric stat so forged payloads can't bloat storage
            const safeNum = (v: unknown, max: number) => {
                const n = Number(v);
                if (!Number.isFinite(n) || n < 0) return 0;
                return Math.min(n, max);
            };

            // Sanitize shapesLanded (only L, T, cross types; bounded count)
            const ALLOWED_SHAPES = new Set(['L', 'T', 'cross']);
            const safeShapes: Array<{ type: string; count: number }> = [];
            if (Array.isArray(stats.shapesLanded)) {
                for (const s of stats.shapesLanded.slice(0, 10)) {
                    if (s && typeof s === 'object' && typeof s.type === 'string' && ALLOWED_SHAPES.has(s.type)) {
                        safeShapes.push({ type: s.type, count: safeNum(s.count, 1000) });
                    }
                }
            }

            const safeStats = {
                score: safeNum(stats.score, MAX_PLAUSIBLE_SCORE),
                matchCount: safeNum(stats.matchCount, 10_000),
                maxCombo: safeNum(stats.maxCombo, 100),
                totalCascades: safeNum(stats.totalCascades, 1_000),
                bombsCreated: safeNum(stats.bombsCreated, 1_000),
                vibestreaksCreated: safeNum(stats.vibestreaksCreated, 1_000),
                cosmicBlastsCreated: safeNum(stats.cosmicBlastsCreated, 1_000),
                crossCount: safeNum(stats.crossCount, 1_000),
                shapesLanded: safeShapes,
                gameOverReason: typeof stats.gameOverReason === 'string' ? stats.gameOverReason.slice(0, 50) : 'unknown',
            };

            // If a matchId is provided, validate it and mark the match as logged
            // (so a subsequent trackGame within 5min doesn't treat it as abandoned).
            // Also clear the activeMatch pointer for this user.
            let validatedMatch = false;
            if (matchId && typeof matchId === 'string') {
                const matchKey = `pinbook:${username}:match:${matchId}`;
                const match = await kv.get(matchKey) as any;
                if (match && match.username === username) {
                    // Frenzy was added later and accidentally left out of
                    // this gate — meant matchstats: was never written for
                    // Frenzy games. When matchstats verification was added
                    // to Frenzy /api/scores on 2026-05-31, every legit
                    // Frenzy submission started getting rejected with
                    // outcome=missing (reported by Booching: 611K Frenzy
                    // game didn't replace 343K PB).
                    validatedMatch = gameMode === 'classic' || gameMode === 'frenzy';
                    await kv.set(matchKey, { ...match, logged: true }, { ex: 60 * 60 * 2 });
                    const activePointerKey = `pinbook:${username}:activeMatch`;
                    const activePointer = await kv.get(activePointerKey);
                    if (activePointer === matchId) {
                        await kv.del(activePointerKey);
                    }
                }
            }

            const logEntry = {
                username,
                gameMode,
                ...safeStats,
                matchId: matchId || null,
                validatedMatch,
                timestamp: Date.now(),
                behavioral,
            };

            // Sorted set keyed by timestamp for easy pagination
            const logKey = `gamelog:${username}`;
            await kv.zadd(logKey, { score: Date.now(), member: JSON.stringify(logEntry) });
            const count = await kv.zcard(logKey);
            if (count > 500) {
                await kv.zremrangebyrank(logKey, 0, count - 501);
            }

            // Replay record: store the move sequence in a separate key
            // alongside matchstats so the (eventually) authoritative replay
            // pass can recompute the score. Keeping it out of matchstats
            // proper keeps that record lean for the per-POST /api/scores
            // lookup. Same 2-hour TTL as matchstats — long enough to cover
            // any out-of-band score submission, short enough not to grow.
            if (matchId && safeMoveSequence.length > 0) {
                await kv.set(
                    `replay:${username}:${matchId}`,
                    JSON.stringify({
                        username,
                        matchId,
                        gameMode,
                        moveCount: safeMoveSequence.length,
                        moveSequence: safeMoveSequence,
                        recordedAt: Date.now(),
                    }),
                    { ex: 60 * 60 * 2 },
                );
            }

            // Also store by matchId for achievement verification lookup.
            // Classic: keyed by the validated match token. Daily: keyed by a server-derived
            // daily match key so we can still verify daily gameplay achievements.
            if (validatedMatch && matchId) {
                await kv.set(`matchstats:${username}:${matchId}`, logEntry, { ex: 60 * 60 * 2 });
            } else if (gameMode === 'daily') {
                const today = getEasternDailyKey();
                await kv.set(`matchstats:${username}:daily:${today}`, logEntry, { ex: 86400 * 2 });
            }

            // Observability: structured log so we can grep Vercel logs to
            // measure logGame throughput, validatedMatch ratio, and (with
            // the client's retry attempts) the retry escape hatch rate.
            // Key fields are kept on one line so jq/grep is straightforward.
            console.log(`[logGame] user=${username} mode=${gameMode} matchId=${matchId || 'none'} score=${safeStats.score} validated=${validatedMatch} totalLogged=${count} moves=${safeMoveSequence.length}`);

            // Tier-1 bot-detection audit. Flag games whose behavioral
            // signature looks synthetic so the admin dashboard surfaces
            // them next to score events. Fires on EVERY classic logGame
            // so we capture both clean + suspicious baselines; trust the
            // dashboard's sort/filter to triage the spike.
            if (gameMode === 'classic' && validatedMatch) {
                const flags: string[] = [];
                if (behavioral.webdriver) flags.push('webdriver');
                if (behavioral.untrustedEvents > 0) flags.push(`untrustedEvents=${behavioral.untrustedEvents}`);
                if (behavioral.trustedRatio < 1) flags.push(`trustedRatio=${behavioral.trustedRatio}`);
                if (behavioral.moveStdDevMs !== null && behavioral.moveStdDevMs < 300 && safeMoveSequence.length >= 10) {
                    flags.push(`tightMoveStdDev=${behavioral.moveStdDevMs}`);
                }
                if (behavioral.firstMoveMs !== null && behavioral.firstMoveMs < 250) {
                    flags.push(`fastFirstMove=${behavioral.firstMoveMs}`);
                }
                await logAuditEvent({
                    req,
                    username,
                    action: 'game.behavioral',
                    meta: {
                        matchId: matchId || 'none',
                        mode: gameMode,
                        score: safeStats.score,
                        moves: safeMoveSequence.length,
                        webdriver: behavioral.webdriver,
                        untrustedEvents: behavioral.untrustedEvents,
                        gameDurationMs: behavioral.gameDurationMs,
                        firstMoveMs: behavioral.firstMoveMs ?? -1,
                        moveStdDevMs: behavioral.moveStdDevMs ?? -1,
                        trustedRatio: behavioral.trustedRatio,
                        flags: flags.length > 0 ? flags.join(',') : '-',
                    },
                });
            }

            return NextResponse.json({ logged: true });

        } else if (body.action === 'earn') {
            const score = body.score as number;
            const matchId = body.matchId as string | undefined;
            const gameMode = body.gameMode as string || 'classic';

            // Validate score is a plausible number
            if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > MAX_PLAUSIBLE_SCORE) {
                return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
            }

            // Per-mode score threshold and capsule ladder. Frenzy uses
            // the gameEngine helper so the ladder stays in one place
            // (mirrored on the client in GameOver).
            const modeThreshold = gameMode === 'frenzy' ? FRENZY_CAPSULE_SCORE_THRESHOLD : CAPSULE_SCORE_THRESHOLD;
            if (score < modeThreshold) {
                return NextResponse.json({ earned: false, reason: 'Score below threshold' });
            }
            const capsuleCount = gameMode === 'frenzy'
                ? frenzyCapsulesForScore(score)
                : classicCapsulesForScore(score);

            if (gameMode === 'classic' || gameMode === 'frenzy') {
                // Classic + Frenzy: require a valid single-use match token from trackGame
                if (!matchId || typeof matchId !== 'string') {
                    console.error(`[earn] Missing matchId for user=${username} score=${score} mode=${gameMode}`);
                    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
                }
                const matchKey = `pinbook:${username}:match:${matchId}`;
                const match = await kv.get(matchKey) as any;
                if (!match || match.username !== username) {
                    console.error(`[earn] Invalid match token for user=${username} matchId=${matchId} match=${JSON.stringify(match)}`);
                    return NextResponse.json({ error: 'Invalid or expired match token' }, { status: 400 });
                }
                if (match.earnedCapsule) {
                    return NextResponse.json({ error: 'Capsule already claimed for this match' }, { status: 400 });
                }
                // Note: the `!match.prizeEligible` reject was removed when
                // abandon-detection was retired in 9a4409f7. The only
                // remaining path that wrote prizeEligible=false was the
                // abandoned-previous penalty (now gone), so this check
                // would only fire for legacy in-flight tokens from before
                // the deploy — and penalizing those users is the same
                // false-positive the retirement was meant to fix. The
                // daily-cap-exhausted case can't trigger here because
                // trackGame returns 429 before creating a token at cap.
                // Atomically mark the match as claimed
                await kv.set(matchKey, { ...match, earnedCapsule: true }, { ex: 60 * 60 * 2 });
                data.capsules += capsuleCount;
                data.totalEarned += capsuleCount;
            } else if (gameMode === 'daily') {
                // Daily: require that the daily_played marker exists for today
                const today = getEasternDailyKey();
                const playedKey = `daily_played:${username}:${today}`;
                const hasPlayed = await kv.get(playedKey);
                if (!hasPlayed) {
                    return NextResponse.json({ error: 'Daily challenge not played yet' }, { status: 400 });
                }
                // Also require single-use: only one daily capsule grant per day
                const dailyEarnedKey = `daily_earned:${username}:${today}`;
                const alreadyEarned = await kv.set(dailyEarnedKey, '1', { nx: true, ex: 86400 * 2 });
                if (!alreadyEarned) {
                    return NextResponse.json({ error: 'Daily capsule already claimed' }, { status: 400 });
                }
                data.capsules += capsuleCount * 2;
                data.totalEarned += capsuleCount * 2;
            } else {
                return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 });
            }

            await kv.set(key, data);
            // Bump the admin daily-activity counter. Uses `gameMode === 'daily'`
            // doubling rule that's already applied above, so capsuleCount here
            // is the player-visible amount.
            await bumpDailyCounter(username, "capsulesEarned", gameMode === 'daily' ? capsuleCount * 2 : capsuleCount);
            return NextResponse.json({ earned: true, capsules: data.capsules, gameMode });

        } else if (body.action === 'bonus') {
            // Bonus capsule — awarded for T/cross shapes during gameplay.
            // Also requires a match token (one bonus per match, like earn).
            const matchId = body.matchId as string | undefined;
            const gameMode = body.gameMode as string || 'classic';

            if (gameMode === 'classic') {
                if (!matchId || typeof matchId !== 'string') {
                    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
                }
                const matchKey = `pinbook:${username}:match:${matchId}`;
                const match = await kv.get(matchKey) as any;
                if (!match || match.username !== username) {
                    return NextResponse.json({ error: 'Invalid or expired match token' }, { status: 400 });
                }
                if (match.earnedBonus) {
                    return NextResponse.json({ error: 'Bonus already claimed for this match' }, { status: 400 });
                }
                // Note: the `!match.prizeEligible` reject was removed when
                // abandon-detection was retired in 9a4409f7. See the matching
                // comment in the `earn` action above for the full rationale.
                await kv.set(matchKey, { ...match, earnedBonus: true }, { ex: 60 * 60 * 2 });
                data.capsules += 1;
                data.totalEarned += 1;
            } else if (gameMode === 'daily') {
                const today = getEasternDailyKey();
                const playedKey = `daily_played:${username}:${today}`;
                const hasPlayed = await kv.get(playedKey);
                if (!hasPlayed) {
                    return NextResponse.json({ error: 'Daily challenge not played yet' }, { status: 400 });
                }
                const dailyBonusKey = `daily_bonus:${username}:${today}`;
                const claimed = await kv.set(dailyBonusKey, '1', { nx: true, ex: 86400 * 2 });
                if (!claimed) {
                    return NextResponse.json({ error: 'Daily bonus already claimed' }, { status: 400 });
                }
                data.capsules += 2;
                data.totalEarned += 2;
            } else {
                return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 });
            }

            await kv.set(key, data);
            await bumpDailyCounter(username, "capsulesEarned", gameMode === 'daily' ? 2 : 1);
            return NextResponse.json({ earned: true, capsules: data.capsules, gameMode });

        } else if (body.action === 'open') {
            if (data.capsules <= 0) {
                return NextResponse.json({ error: 'No capsules to open' }, { status: 400 });
            }

            // If a pending reveal exists (user closed the tab mid-reveal,
            // a bulk run was interrupted, etc.), auto-credit that pin to
            // the user's pinbook before rolling the new one. The capsule
            // for that pending was already decremented on its original
            // open, so we only credit the pin — no double-charge. This
            // keeps users from getting stuck behind a stale pending and
            // protects the pin they already rolled.
            const pendingKey = `pinbook:${username}:pending`;
            const existingPending = await kv.get(pendingKey) as { tier: string; badgeId: string; openedAt: number; isPromo?: boolean } | null;
            if (existingPending) {
                if (existingPending.isPromo) {
                    // Stale promo pending — credit to promo zset, not pin map.
                    const stalePromo = findPromoBadge(existingPending.badgeId);
                    if (stalePromo && stalePromo.tier === existingPending.tier) {
                        await kv.zincrby(promoLeaderboardKey(stalePromo.id), 1, username);
                        // Also credit event-set points if this pin belongs to a set.
                        if (stalePromo.eventSetId) {
                            await kv.zincrby(eventSetPointsKey(stalePromo.eventSetId), stalePromo.points ?? 1, username);
                        }
                    }
                } else {
                    const staleBadge = BADGES.find(b => b.id === existingPending.badgeId);
                    if (staleBadge && staleBadge.tier === existingPending.tier) {
                        const nowIso = new Date().toISOString();
                        const existingPin = data.pins[staleBadge.id];
                        if (existingPin) {
                            existingPin.count += 1;
                            existingPin.lastPulled = nowIso;
                        } else {
                            data.pins[staleBadge.id] = { count: 1, firstEarned: nowIso, lastPulled: nowIso };
                        }
                        const tierFound = ensureTotalFoundByTier(data);
                        tierFound[staleBadge.tier] = (tierFound[staleBadge.tier] || 0) + 1;
                    }
                }
                await kv.del(pendingKey);
            }

            // Promo pre-roll — independent of the normal tier roll. When
            // this hits we award an active promo pin instead of running
            // the tier roll, so Common-pool economics are untouched. Gated
            // on the global active flag; if the partnership ends, this
            // branch becomes a no-op and capsules behave exactly as they
            // did before promos existed.
            let tier: BadgeTier;
            let badge: Badge;
            let isPromoPull = false;
            const activePromo = isPromoActive() && Math.random() < PROMO_DROP_RATE
                ? pickActivePromoBadge()
                : null;
            if (activePromo) {
                tier = activePromo.tier; // blue — treated as Common visually
                badge = activePromo;
                isPromoPull = true;
            } else {
                // Normal tier roll (unchanged)
                const roll = Math.random() * 100;
                let cumulative = 0;
                tier = 'blue';
                for (const [t, w] of Object.entries(TIER_WEIGHTS) as [BadgeTier, number][]) {
                    cumulative += w;
                    if (roll < cumulative) { tier = t; break; }
                }

                // Pick a specific badge from that tier.
                // For the "special" tier, use per-badge dropWeight for weighted selection
                // (Diamond/Cosmic VIBESTR badges are much rarer within this tier).
                const tierBadges = BADGES.filter(b => b.tier === tier);
                if (tierBadges.length === 0) {
                    return NextResponse.json({ error: 'No badges available for tier' }, { status: 500 });
                }
                const hasWeights = tierBadges.some(b => b.dropWeight !== undefined);
                if (hasWeights) {
                    // Weighted random selection within the tier
                    const totalWeight = tierBadges.reduce((s, b) => s + (b.dropWeight ?? 10), 0);
                    let weightRoll = Math.random() * totalWeight;
                    badge = tierBadges[tierBadges.length - 1]; // fallback
                    for (const b of tierBadges) {
                        weightRoll -= (b.dropWeight ?? 10);
                        if (weightRoll <= 0) { badge = b; break; }
                    }
                } else {
                    badge = tierBadges[Math.floor(Math.random() * tierBadges.length)];
                }
            }

            // Store pending reveal so collect can validate it. `isPromo`
            // flags the collect handler to route this to the promo zset
            // instead of the user's pin map.
            await kv.set(pendingKey, {
                tier,
                badgeId: badge.id,
                openedAt: Date.now(),
                isPromo: isPromoPull,
            }, { ex: 60 * 60 * 24 }); // 24-hour window so phone-down stranding gets swept on next pinbook GET

            // Decrement capsule count
            data.capsules -= 1;
            data.totalOpened += 1;
            await kv.set(key, data);
            await bumpDailyCounter(username, "capsulesOpened", 1);

            // Look up the user's current promo count BEFORE collect fires so
            // the client can render "duplicate" vs "new pin" correctly on
            // the reveal animation. Promo pins don't enter the pinbook pin
            // map, so the client can't derive duplicate state locally for
            // them like it does for canonical pins.
            let promoCountBeforeCollect = 0;
            if (isPromoPull) {
                const existingScore = await kv.zscore(promoLeaderboardKey(badge.id), username);
                promoCountBeforeCollect = typeof existingScore === 'number' ? existingScore : 0;
            }

            await logAuditEvent({
                req,
                username,
                action: 'capsule.open',
                meta: { tier, badgeId: badge.id, isPromo: isPromoPull, remainingCapsules: data.capsules },
            });

            return NextResponse.json({
                opened: true,
                tier,
                badgeId: badge.id,
                isPromo: isPromoPull,
                promoCountBeforeCollect,
                capsules: data.capsules,
                totalOpened: data.totalOpened,
            });

        } else if (body.action === 'collect') {
            // Server validates the badge against the pending reveal
            const badgeId = body.badgeId as string;
            if (!badgeId || typeof badgeId !== 'string') {
                return NextResponse.json({ error: 'Missing badgeId' }, { status: 400 });
            }

            const pendingKey = `pinbook:${username}:pending`;
            const pending = await kv.get(pendingKey) as { tier: string; badgeId: string; openedAt: number; isPromo?: boolean } | null;
            if (!pending) {
                return NextResponse.json({ error: 'No pending capsule to collect' }, { status: 400 });
            }
            if (pending.badgeId !== badgeId) {
                return NextResponse.json({ error: 'Badge does not match pending capsule' }, { status: 400 });
            }

            // Promo branch — separate counter zset, does NOT write to the
            // user's pinbook pin map. Means the official 101-pin Pinbook
            // never picks up promo pins and unique/total counts stay
            // anchored to the canonical catalog.
            if (pending.isPromo) {
                const promoDef = findPromoBadge(badgeId);
                if (!promoDef || promoDef.tier !== pending.tier) {
                    return NextResponse.json({ error: 'Invalid promo badge' }, { status: 400 });
                }
                await kv.del(pendingKey);
                // Per-pin counter: ZINCRBY by 1. For standalone events
                // this zset doubles as the leaderboard; for set events
                // it tracks per-pin collection only (the leaderboard
                // lives in event_set:<setId>:points below).
                const newCount = await kv.zincrby(promoLeaderboardKey(promoDef.id), 1, username);
                // Set-event leaderboard: credit the pin's points value
                // to event_set:<setId>:points. Standalone events skip
                // this — their pin counter IS the leaderboard.
                if (promoDef.eventSetId) {
                    const points = promoDef.points ?? 1;
                    await kv.zincrby(eventSetPointsKey(promoDef.eventSetId), points, username);
                }
                // Eventide quest flag — flip once; cheap idempotent write
                // since we hold the user lock for this whole branch.
                if (!data.hasCollectedEventPin) {
                    data.hasCollectedEventPin = true;
                    await kv.set(key, data);
                }
                return NextResponse.json({
                    collected: true,
                    isPromo: true,
                    isDuplicate: (typeof newCount === 'number' && newCount > 1),
                    count: typeof newCount === 'number' ? newCount : 1,
                });
            }

            // Double-check: badge actually exists in catalog with matching tier
            const badgeDef = BADGES.find(b => b.id === badgeId);
            if (!badgeDef || badgeDef.tier !== pending.tier) {
                return NextResponse.json({ error: 'Invalid badge' }, { status: 400 });
            }

            // Consume the pending reveal atomically
            await kv.del(pendingKey);

            const nowIso = new Date().toISOString();
            const existing = data.pins[badgeId];
            const wasNewPin = !existing;
            if (existing) {
                existing.count += 1;
                existing.lastPulled = nowIso;
            } else {
                data.pins[badgeId] = { count: 1, firstEarned: nowIso, lastPulled: nowIso };
            }

            // Lifetime per-tier pin counter — increments on every pull
            // (including duplicates), never decremented on reroll. Drives
            // the "Find N Cosmic/Special/etc. pins" achievement set.
            const tierFound = ensureTotalFoundByTier(data);
            tierFound[badgeDef.tier] = (tierFound[badgeDef.tier] || 0) + 1;

            await kv.set(key, data);

            // Daily-activity counters for the admin view. Every collect is
            // +1 pin found; new-to-pinbook pulls also bump newPinsFound.
            await bumpDailyCounter(username, "pinsFound", 1);
            if (wasNewPin) await bumpDailyCounter(username, "newPinsFound", 1);

            // Update pre-computed leaderboard entry

            const profileKey = `user:${username}`;
            const profile = await kv.get(profileKey) as { username?: string; avatarUrl?: string } | null;
            const entry = computeUserEntry(
                profile?.username || username,
                profile?.avatarUrl || '',
                data.pins,
            );
            // Await leaderboard update so it's consistent when client fetches it
            await updateLeaderboardEntry(entry);

            return NextResponse.json({
                collected: true,
                isDuplicate: !!existing,
                count: data.pins[badgeId].count,
                firstEarned: data.pins[badgeId].firstEarned,
                totalCollected: Object.keys(data.pins).length,
            });

        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
        }); // end withUserLock
    } catch (e) {
        console.error('PinBook POST error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
