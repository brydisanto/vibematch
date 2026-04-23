"use client";

import { useState, useCallback, useRef } from "react";
import { Badge, BADGES, BadgeTier } from "./badges";

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
    }, []);

    // Ref mirror of activeMatchId so async flows always read the latest value
    const activeMatchIdRef = useRef<string | null>(null);

    const earnCapsule = useCallback(async (score: number, gameMode: string = 'classic'): Promise<{ earned: boolean; reason?: string; capped?: boolean }> => {
        if (score < CAPSULE_SCORE_THRESHOLD) return { earned: false, reason: 'Score below threshold' };
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "earn", score, gameMode, matchId: activeMatchIdRef.current }),
            });
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
            return { earned: false, reason: data?.reason, capped: data?.capped };
        } catch (e) {
            console.error("pinbook earn error:", e);
            return { earned: false, reason: String(e) };
        }
    }, []);

    const trackGame = useCallback(async (gameMode: string = 'classic'): Promise<{ ok: boolean; error?: string }> => {
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "trackGame", gameMode }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
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
                // Classic-only: flag the match as "extra" so the HUD can
                // surface a practice banner. Daily matches never use the
                // cap, so always eligible.
                setCurrentMatchIsExtra(
                    gameMode === 'classic' && (!!data.capped || !!data.abandonedPrevious)
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
    }, gameMode: string = 'classic'): Promise<void> => {
        try {
            await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "logGame", matchId: activeMatchIdRef.current, gameMode, stats }),
            });
        } catch (e) { console.error("pinbook logGame error:", e); }
    }, []);

    const earnBonusCapsule = useCallback(async (gameMode: string = 'classic'): Promise<boolean> => {
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "bonus", gameMode, matchId: activeMatchIdRef.current }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("pinbook bonus failed:", res.status, errData, "matchId:", activeMatchIdRef.current);
                return false;
            }
            const data = await res.json();
            if (data.earned) {
                const amount = gameMode === 'daily' ? 2 : 1;
                setState(prev => ({ ...prev, capsules: data.capsules, totalEarned: prev.totalEarned + amount }));
                return true;
            }
        } catch (e) { console.error("pinbook bonus error:", e); }
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

            // Server picks both tier AND specific badge (authoritative)
            const tier = data.tier as BadgeTier;
            const badge = BADGES.find(b => b.id === data.badgeId);
            if (!badge) {
                console.error("Server returned unknown badgeId:", data.badgeId);
                return null;
            }

            const existing = state.pins[badge.id];
            const reveal: CapsuleReveal = {
                badge,
                tier,
                isDuplicate: !!existing,
                duplicateCount: existing ? existing.count : 0,
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
        earnCapsule,
        earnBonusCapsule,
        openCapsule,
        collectReveal,
        setBonusPrizeGames,
        totalCollected: Object.keys(state.pins).length,
        totalBadges: BADGES.length,
    };
}
