"use client";

import { useState, useCallback, useRef } from "react";
import { Badge, BADGES, BadgeTier } from "./badges";

export interface PinBookState {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number;
    totalOpened: number;
    totalEarned: number;
    classicPlays: number;
    bonusPrizeGames: number;
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

    const earnCapsule = useCallback(async (score: number, gameMode: string = 'classic'): Promise<boolean> => {
        if (score < CAPSULE_SCORE_THRESHOLD) return false;
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "earn", score, gameMode, matchId: activeMatchIdRef.current }),
            });
            if (!res.ok) { console.error("pinbook earn failed:", res.status); return false; }
            const data = await res.json();
            if (data.earned) {
                const amount = gameMode === 'daily' ? 2 : 1;
                setState(prev => ({ ...prev, capsules: data.capsules, totalEarned: prev.totalEarned + amount }));
                return true;
            }
        } catch (e) { console.error("pinbook earn error:", e); }
        return false;
    }, []);

    const trackGame = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "trackGame" }),
            });
            if (!res.ok) { console.error("pinbook trackGame failed:", res.status); return; }
            const data = await res.json();
            if (data.classicPlays != null) {
                setState(prev => ({ ...prev, classicPlays: data.classicPlays }));
            }
            if (data.matchId) {
                activeMatchIdRef.current = data.matchId;
                setActiveMatchId(data.matchId);
            }
        } catch (e) { console.error("pinbook trackGame error:", e); }
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
            if (!res.ok) { console.error("pinbook bonus failed:", res.status); return false; }
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
                setState(prev => ({
                    ...prev,
                    pins: {
                        ...prev.pins,
                        [pendingReveal.badge.id]: {
                            count: data.count,
                            firstEarned: data.firstEarned || prev.pins[pendingReveal.badge.id]?.firstEarned || new Date().toISOString(),
                        },
                    },
                }));
                setPendingReveal(null);
            } else {
                console.error("pinbook collect returned collected=false");
            }
        } catch (e) { console.error("pinbook collect error:", e); }
    }, [pendingReveal]);

    const setBonusPrizeGames = useCallback((bonus: number) => {
        setState(prev => ({ ...prev, bonusPrizeGames: bonus }));
    }, []);

    return {
        state,
        pendingReveal,
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
