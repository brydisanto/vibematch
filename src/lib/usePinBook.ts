"use client";

import { useState, useCallback, useRef } from "react";
import { Badge, BADGES, BadgeTier } from "./badges";
import { findPromoBadge } from "./promo-badges";

/**
 * Unified badge lookup for capsule reveals. The server can return
 * either a canonical pin id (one of the 101) or a promo pin id
 * (e.g. promo_opensea when the 3% partnership pre-roll hits).
 * Without this fallback to PROMO_BADGES, promo pulls would surface
 * as "something went wrong" because BADGES alone doesn't carry the
 * partnership pin.
 */
function resolveBadge(badgeId: string): Badge | undefined {
    return BADGES.find(b => b.id === badgeId) ?? findPromoBadge(badgeId);
}

export interface PinBookState {
    pins: Record<string, { count: number; firstEarned: string; lastPulled?: string }>;
    capsules: number;
    totalOpened: number;
    totalEarned: number;
    classicPlays: number;
    bonusPrizeGames: number;
    /** Lifetime per-tier pin finds. Undefined for legacy pinbooks; the
     *  server backfills from held counts on first mutation, and
     *  buildPlayerContext falls back to the same derivation client-side. */
    totalFoundByTier?: Partial<Record<BadgeTier, number>>;
    loaded: boolean;
}

export interface CapsuleReveal {
    badge: Badge;
    tier: BadgeTier;
    isDuplicate: boolean;
    duplicateCount: number;
}

const CAPSULE_SCORE_THRESHOLD = 15000;

// ===== logGame reliability =====
// /api/pinbook log was previously fire-and-forget: any 4xx/5xx silently
// succeeded at the await. Investigation of a user with 19 capsules but
// only 1 gamelog entry confirmed legit games were being silently dropped
// on flaky connections. These helpers add retry-with-backoff and a
// localStorage-backed queue so a failed log gets replayed on next pinbook
// load (next session / reload / next game).
const LOG_RETRY_DELAYS_MS = [500, 1500, 4000];
const PENDING_LOG_KEY_PREFIX = "pending_logGame:";
const MAX_PENDING_LOGS = 25;          // cap localStorage growth on hostile loops
const PENDING_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // drop stale queue entries after a week

interface PendingLogPayload {
    action: "logGame";
    matchId: string | null;
    gameMode: string;
    stats: unknown;
    /** Replay-grade record of player actions. Currently stored server-
     *  side without being read — Phase 3 will use this. May be empty
     *  for older queued entries from before this field existed. */
    moveSequence?: unknown[];
    queuedAt: number;
}

async function postLogGame(payload: Omit<PendingLogPayload, "queuedAt">): Promise<boolean> {
    try {
        const res = await fetch("/api/pinbook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return res.ok;
    } catch {
        return false;
    }
}

function queuePendingLog(payload: Omit<PendingLogPayload, "queuedAt">) {
    if (typeof window === "undefined") return;
    try {
        // Keyed by matchId when present so duplicate replays of the same
        // game don't pile up. Without a matchId, fall back to timestamp
        // so each enqueue is a distinct entry rather than a clobber.
        const matchId = payload.matchId || `nomatch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const key = `${PENDING_LOG_KEY_PREFIX}${matchId}`;
        const entry: PendingLogPayload = { ...payload, queuedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(entry));
        // Cap total pending entries — drop oldest if over.
        const all = listPendingLogKeys();
        if (all.length > MAX_PENDING_LOGS) {
            // Sort by queuedAt ascending so oldest goes first.
            const withTs = all
                .map(k => {
                    try {
                        const v = JSON.parse(localStorage.getItem(k) || "{}") as PendingLogPayload;
                        return { k, ts: v.queuedAt || 0 };
                    } catch { return { k, ts: 0 }; }
                })
                .sort((a, b) => a.ts - b.ts);
            for (const drop of withTs.slice(0, all.length - MAX_PENDING_LOGS)) {
                localStorage.removeItem(drop.k);
            }
        }
    } catch {
        // localStorage unavailable / quota exceeded — best-effort.
    }
}

function listPendingLogKeys(): string[] {
    if (typeof window === "undefined") return [];
    const out: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(PENDING_LOG_KEY_PREFIX)) out.push(k);
        }
    } catch { /* ignore */ }
    return out;
}

/**
 * Generic retrying POST to /api/pinbook. Retries on network errors and
 * 5xx responses, NOT on 4xx (those are logical rejections like "Capsule
 * already claimed" — retrying just wastes round trips). Returns the
 * final Response (which may still be a 4xx) or null on a total network
 * failure across all attempts.
 *
 * Used by earnCapsule + earnBonusCapsule. They're already idempotent
 * server-side via match.earnedCapsule / daily_earned NX markers, so a
 * retry that lands after a successful prior attempt cleanly returns
 * 400 "already claimed" rather than double-crediting. No queue — these
 * actions are tied to a matchKey with a 2-hour TTL, so a next-session
 * replay would arrive after the server forgot about the match anyway.
 */
async function retryablePinbookPost(body: unknown): Promise<Response | null> {
    for (let attempt = 0; attempt < LOG_RETRY_DELAYS_MS.length + 1; attempt++) {
        if (attempt > 0) {
            const delay = LOG_RETRY_DELAYS_MS[attempt - 1] ?? 4000;
            await new Promise(r => setTimeout(r, delay));
        }
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            // 2xx + 4xx are terminal. Only 5xx falls through to retry.
            if (res.status < 500) return res;
        } catch {
            // network error — fall through to retry
        }
    }
    return null;
}

/** Sends a logGame payload with up to 3 retries (exponential-ish backoff).
 *  On final failure, queues the payload to localStorage for next-session
 *  replay so we don't silently drop the entry. Returns true on success. */
async function logGameWithRetry(payload: Omit<PendingLogPayload, "queuedAt">): Promise<boolean> {
    // First attempt is immediate; remaining attempts use LOG_RETRY_DELAYS_MS.
    for (let attempt = 0; attempt < LOG_RETRY_DELAYS_MS.length + 1; attempt++) {
        if (attempt > 0) {
            const delay = LOG_RETRY_DELAYS_MS[attempt - 1] ?? 4000;
            await new Promise(r => setTimeout(r, delay));
        }
        const ok = await postLogGame(payload);
        if (ok) return true;
    }
    // All attempts failed — queue for later.
    console.warn("[pinbook] logGame failed after retries; queued for next session", payload.matchId);
    queuePendingLog(payload);
    return false;
}

/** Replays any logGame payloads previously queued by a failed session.
 *  Called from pinbook.load(). Stale entries (> PENDING_LOG_MAX_AGE_MS)
 *  are dropped without replay — the server's matchstats TTL has long
 *  since expired by then so the entry would land unvalidated anyway. */
async function flushPendingLogs(): Promise<void> {
    if (typeof window === "undefined") return;
    const keys = listPendingLogKeys();
    if (keys.length === 0) return;
    const now = Date.now();
    for (const key of keys) {
        let entry: PendingLogPayload | null = null;
        try {
            entry = JSON.parse(localStorage.getItem(key) || "null");
        } catch { /* corrupt — fall through */ }
        if (!entry || (now - (entry.queuedAt || 0)) > PENDING_LOG_MAX_AGE_MS) {
            localStorage.removeItem(key);
            continue;
        }
        const ok = await postLogGame({
            action: entry.action,
            matchId: entry.matchId,
            gameMode: entry.gameMode,
            stats: entry.stats,
            moveSequence: entry.moveSequence ?? [],
        });
        if (ok) {
            localStorage.removeItem(key);
        }
        // If still failing, leave it — next load() retries.
    }
}

export function usePinBook() {
    const [state, setState] = useState<PinBookState>({
        pins: {},
        capsules: 0,
        totalOpened: 0,
        totalEarned: 0,
        classicPlays: 0,
        bonusPrizeGames: 0,
        loaded: false,
    });
    const [pendingReveal, setPendingReveal] = useState<CapsuleReveal | null>(null);
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
    // True when the current match was started outside the daily prize
    // cap (capped OR abandoned-previous). Consumed by the HUD to flag
    // "extra play — no leaderboard / no capsules" during gameplay.
    const [currentMatchIsExtra, setCurrentMatchIsExtra] = useState<boolean>(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/pinbook");
            if (!res.ok) return;
            const data = await res.json();
            setState({ ...data, loaded: true });
        } catch {
            // Not logged in or error — use empty state
        }
        // Opportunistic flush of any logGame payloads that failed in a
        // prior session. Fire-and-forget — we don't want to block the
        // load UI on a backlog of retries.
        flushPendingLogs().catch(() => { /* swallow */ });
    }, []);

    // Ref mirror of activeMatchId so async flows always read the latest value
    const activeMatchIdRef = useRef<string | null>(null);
    // Holds the most recently finished matchId (set by markGameFinished
    // when the game-end flow completes on the client, regardless of
    // whether logGame's server POST succeeded). Sent in the next
    // trackGame body so the server can skip its abandoned-previous
    // heuristic when the client confirms the previous match finished
    // normally. Without this, a logGame that fell into the retry queue
    // — common on flaky networks — would leave the server thinking the
    // prior match was abandoned, and the next game would be flagged
    // EXTRA PLAY / no capsule. A refresh-shopper's reloaded client has
    // no memory of the prior matchId, so they can't forge this signal.
    const lastFinishedMatchIdRef = useRef<string | null>(null);

    const markGameFinished = useCallback((matchId: string | null) => {
        if (matchId) lastFinishedMatchIdRef.current = matchId;
    }, []);

    const earnCapsule = useCallback(async (score: number, gameMode: string = 'classic'): Promise<{ earned: boolean; reason?: string; capped?: boolean; abandonedPrevious?: boolean }> => {
        if (score < CAPSULE_SCORE_THRESHOLD) return { earned: false, reason: 'Score below threshold' };
        // Retry on 5xx + network errors so a transient blip on the
        // capsule-earn POST doesn't silently strip a legit 15K+ run's
        // reward. Server is idempotent via match.earnedCapsule — a
        // duplicate after a successful prior attempt returns 400 cleanly.
        const res = await retryablePinbookPost({ action: "earn", score, gameMode, matchId: activeMatchIdRef.current });
        if (!res) {
            console.error("pinbook earn network failure after retries; matchId:", activeMatchIdRef.current);
            return { earned: false, reason: 'Network error' };
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error("pinbook earn failed:", res.status, data, "matchId:", activeMatchIdRef.current);
            return { earned: false, reason: data?.error || `HTTP ${res.status}` };
        }
        if (data.earned) {
            const amount = gameMode === 'daily' ? 2 : 1;
            setState(prev => ({ ...prev, capsules: data.capsules, totalEarned: prev.totalEarned + amount }));
            return { earned: true };
        }
        console.warn("pinbook earn rejected:", data);
        // Pass through abandonedPrevious so the client can show the
        // accurate "previous game wasn't finished" copy instead of the
        // generic "Capsule not awarded: <reason>" toast.
        return { earned: false, reason: data?.reason, capped: data?.capped, abandonedPrevious: data?.abandonedPrevious };
    }, []);

    const trackGame = useCallback(async (gameMode: string = 'classic'): Promise<{
        ok: boolean;
        error?: string;
        outOfPlays?: boolean;
        classicPlays?: number;
        cap?: number;
        baseCap?: number;
        bonusPrizeGames?: number;
    }> => {
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "trackGame",
                    gameMode,
                    // Lets the server skip its abandoned-previous-match
                    // heuristic when this matches the active pointer (the
                    // user really did finish their previous game, even if
                    // logGame was queued / hasn't reached the server).
                    prevFinishedMatchId: lastFinishedMatchIdRef.current,
                }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                // 429 = hard daily-cap reached. Surface structured info so
                // the caller can prompt the user to buy bonus games or
                // come back tomorrow instead of just toasting an error.
                if (res.status === 429) {
                    if (typeof errData.classicPlays === 'number') {
                        setState(prev => ({ ...prev, classicPlays: errData.classicPlays }));
                    }
                    return {
                        ok: false,
                        outOfPlays: true,
                        error: errData.error || 'Out of plays today',
                        classicPlays: errData.classicPlays,
                        cap: errData.cap,
                        baseCap: errData.baseCap,
                        bonusPrizeGames: errData.bonusPrizeGames,
                    };
                }
                console.error("pinbook trackGame failed:", res.status, errData);
                return { ok: false, error: errData.error || `HTTP ${res.status}` };
            }
            const data = await res.json();
            if (data.classicPlays != null) {
                setState(prev => ({ ...prev, classicPlays: data.classicPlays }));
            }
            if (data.matchId) {
                activeMatchIdRef.current = data.matchId;
                setActiveMatchId(data.matchId);
                // Every classic run that gets past the cap check is now
                // capsule-eligible. The only thing that still flips this
                // is the abandoned-previous-match guard.
                setCurrentMatchIsExtra(
                    gameMode === 'classic' && !!data.abandonedPrevious
                );
                console.log("[usePinBook] trackGame matchId:", data.matchId, "mode:", gameMode, "abandonedPrevious:", data.abandonedPrevious);
            } else {
                console.warn("[usePinBook] trackGame response missing matchId:", data);
            }
            return { ok: true };
        } catch (e) {
            console.error("pinbook trackGame error:", e);
            return { ok: false, error: String(e) };
        }
    }, []);

    const logGame = useCallback(async (stats: {
        score: number;
        matchCount: number;
        maxCombo: number;
        totalCascades: number;
        bombsCreated: number;
        vibestreaksCreated: number;
        cosmicBlastsCreated: number;
        crossCount: number;
        shapesLanded: Array<{ type: string; count: number }>;
        gameOverReason: string;
    }, gameMode: string = 'classic', moveSequence: unknown[] = []): Promise<void> => {
        // Retry + queue: previously a single await fetch with no .ok check.
        // Any 4xx/5xx silently succeeded at the await, dropping the gamelog
        // entry without telling anyone. logGameWithRetry now does 4 total
        // attempts with exponential-ish backoff, and on final failure queues
        // the payload to localStorage for replay on the next pinbook.load().
        //
        // moveSequence is Phase 2 of the server-authoritative score scope:
        // the deterministic record of swaps + special-tile taps. Server
        // stores it but doesn't replay it yet — that's Phase 3.
        await logGameWithRetry({
            action: "logGame",
            matchId: activeMatchIdRef.current,
            gameMode,
            stats,
            moveSequence,
        });
    }, []);

    const earnBonusCapsule = useCallback(async (gameMode: string = 'classic'): Promise<boolean> => {
        // Retry on 5xx + network errors. Server enforces 1-per-match
        // bonus cap so duplicates from a retry are rejected cleanly.
        const res = await retryablePinbookPost({ action: "bonus", gameMode, matchId: activeMatchIdRef.current });
        if (!res) {
            console.error("pinbook bonus network failure after retries; matchId:", activeMatchIdRef.current);
            return false;
        }
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("pinbook bonus failed:", res.status, errData, "matchId:", activeMatchIdRef.current);
            return false;
        }
        const data = await res.json().catch(() => ({}));
        if (data.earned) {
            const amount = gameMode === 'daily' ? 2 : 1;
            setState(prev => ({ ...prev, capsules: data.capsules, totalEarned: prev.totalEarned + amount }));
            return true;
        }
        return false;
    }, []);

    const openCapsule = useCallback(async (): Promise<CapsuleReveal | null> => {
        if (state.capsules <= 0) return null;
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "open" }),
            });
            if (!res.ok) { console.error("pinbook open failed:", res.status); return null; }
            const data = await res.json();
            if (!data.opened) return null;

            // Server picks both tier AND specific badge (authoritative).
            // Look up via resolveBadge so promo pins (server-flagged
            // isPromo) resolve from PROMO_BADGES rather than dead-ending
            // when the canonical BADGES catalog doesn't contain them.
            const tier = data.tier as BadgeTier;
            const badge = resolveBadge(data.badgeId);
            if (!badge) {
                console.error("Server returned unknown badgeId:", data.badgeId);
                return null;
            }

            // For canonical pins, duplicate state derives from the local
            // pinbook map. For promos, that map never carries them, so the
            // server provides the user's pre-collect promo count and we
            // derive isDuplicate from that. Without this branch, every
            // promo pull rendered "new pin collected" even on a player's
            // 5th OpenSea pull.
            let isDuplicate: boolean;
            let duplicateCount: number;
            if (data.isPromo) {
                const priorCount = typeof data.promoCountBeforeCollect === 'number' ? data.promoCountBeforeCollect : 0;
                isDuplicate = priorCount > 0;
                duplicateCount = priorCount;
            } else {
                const existing = state.pins[badge.id];
                isDuplicate = !!existing;
                duplicateCount = existing ? existing.count : 0;
            }
            const reveal: CapsuleReveal = {
                badge,
                tier,
                isDuplicate,
                duplicateCount,
            };

            setState(prev => ({
                ...prev,
                capsules: data.capsules,
                totalOpened: data.totalOpened,
            }));

            setPendingReveal(reveal);
            return reveal;
        } catch (e) {
            console.error("pinbook open error:", e);
            return null;
        }
    }, [state.capsules, state.pins]);

    const collectReveal = useCallback(async () => {
        if (!pendingReveal) return;
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "collect", badgeId: pendingReveal.badge.id }),
            });
            if (!res.ok) { console.error("pinbook collect failed:", res.status); return; }
            const data = await res.json();
            if (data.collected) {
                setState(prev => {
                    const nowIso = new Date().toISOString();
                    // Promo pulls track in a separate KV zset server-side
                    // and must not enter the Pinbook pins map. Keeps the
                    // canonical 101 collection % anchored.
                    if (data.isPromo) {
                        return prev;
                    }
                    // Mirror the server's increment of the lifetime per-
                    // tier counter so the retroactive achievement check
                    // sees the latest count in-session (previously the
                    // counter only refreshed on next /api/pinbook GET,
                    // which left tier-find achievements like
                    // "Cosmic Frequency" un-firing until reload).
                    const tier = pendingReveal.badge.tier;
                    const tfb = { ...(prev.totalFoundByTier || {}) };
                    tfb[tier] = (tfb[tier] || 0) + 1;
                    return {
                        ...prev,
                        pins: {
                            ...prev.pins,
                            [pendingReveal.badge.id]: {
                                count: data.count,
                                firstEarned: data.firstEarned || prev.pins[pendingReveal.badge.id]?.firstEarned || nowIso,
                                // Always bump lastPulled — even on duplicates — so
                                // the most-recent pull bubbles to the top of any
                                // recency-sorted list (Recent Pulls in the rail).
                                lastPulled: nowIso,
                            },
                        },
                        totalFoundByTier: tfb,
                    };
                });
                setPendingReveal(null);
            } else {
                console.error("pinbook collect returned collected=false");
            }
        } catch (e) { console.error("pinbook collect error:", e); }
    }, [pendingReveal]);

    const setBonusPrizeGames = useCallback((bonus: number) => {
        setState(prev => ({ ...prev, bonusPrizeGames: bonus }));
    }, []);

    /** Atomic open+collect for bulk capsule flows. Bypasses `pendingReveal`
     *  state entirely — bulk flows can't wait a full render cycle between
     *  open and collect, and the state-based openCapsule/collectReveal pair
     *  would race the React render and leave a pending reveal on the server
     *  (which would reject the next open with "A pending capsule is already
     *  open"). This path hits the server sequentially and updates state in
     *  a single functional setState. Never sets `pendingReveal`, so it
     *  doesn't interfere with the single-capsule tap-to-collect flow. */
    // 429-aware POST helper used by the bulk-open loop. The server bumps
    // open/collect to 600/min, but we keep this resilience so a deep bulk
    // (or a future cap change) auto-recovers instead of bailing partway.
    // Honors the server's Retry-After header; falls back to a short fixed
    // wait if missing. One retry, then bail to keep failure modes simple.
    const postWith429Retry = async (body: object): Promise<Response> => {
        const fire = () => fetch("/api/pinbook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const first = await fire();
        if (first.status !== 429) return first;
        const retryAfterSec = parseInt(first.headers.get("Retry-After") || "2", 10);
        const waitMs = Math.min(Math.max(retryAfterSec, 1), 60) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
        return fire();
    };

    const rollAndCollectCapsule = useCallback(async (): Promise<CapsuleReveal | null> => {
        try {
            const openRes = await postWith429Retry({ action: "open" });
            if (!openRes.ok) {
                console.error("rollAndCollectCapsule open failed:", openRes.status);
                return null;
            }
            const openData = await openRes.json();
            if (!openData.opened) return null;

            const tier = openData.tier as BadgeTier;
            const badge = resolveBadge(openData.badgeId);
            if (!badge) {
                console.error("Server returned unknown badgeId:", openData.badgeId);
                return null;
            }

            const collectRes = await postWith429Retry({ action: "collect", badgeId: openData.badgeId });
            if (!collectRes.ok) {
                console.error("rollAndCollectCapsule collect failed:", collectRes.status);
                return null;
            }
            const collectData = await collectRes.json();
            if (!collectData.collected) return null;

            const nowIso = new Date().toISOString();
            setState(prev => {
                const next: PinBookState = {
                    ...prev,
                    capsules: openData.capsules,
                    totalOpened: openData.totalOpened,
                };
                // Promo pins live in their own zset server-side and must
                // NOT enter the Pinbook pins map — otherwise the canonical
                // 101 collection % would inflate every time a partnership
                // pin drops. Server tags promo opens with isPromo and the
                // collect response sets isPromo too.
                if (!collectData.isPromo && !openData.isPromo) {
                    next.pins = {
                        ...prev.pins,
                        [badge.id]: {
                            count: collectData.count,
                            firstEarned: collectData.firstEarned
                                || prev.pins[badge.id]?.firstEarned
                                || nowIso,
                            lastPulled: nowIso,
                        },
                    };
                    // Mirror server's lifetime-per-tier increment locally so
                    // tier-find achievements fire in-session without reload.
                    const tfb = { ...(prev.totalFoundByTier || {}) };
                    tfb[tier] = (tfb[tier] || 0) + 1;
                    next.totalFoundByTier = tfb;
                }
                return next;
            });

            return {
                badge,
                tier,
                isDuplicate: !!collectData.isDuplicate,
                duplicateCount: collectData.isDuplicate ? Math.max(0, collectData.count - 1) : 0,
            };
        } catch (e) {
            console.error("rollAndCollectCapsule error:", e);
            return null;
        }
    }, []);

    // Exposed for consumers that need to read the latest match id in async flows
    const getActiveMatchId = useCallback(() => activeMatchIdRef.current, []);

    return {
        state,
        pendingReveal,
        activeMatchId,
        getActiveMatchId,
        currentMatchIsExtra,
        load,
        trackGame,
        logGame,
        markGameFinished,
        earnCapsule,
        earnBonusCapsule,
        openCapsule,
        collectReveal,
        rollAndCollectCapsule,
        setBonusPrizeGames,
        totalCollected: Object.keys(state.pins).length,
        totalBadges: BADGES.length,
    };
}
