"use client";

import { useState, useCallback } from "react";
import { Badge, BADGES, BadgeTier } from "./badges";

export interface PinBookState {
    pins: Record<string, { count: number; firstEarned: string }>;
    capsules: number;
    totalOpened: number;
    totalEarned: number;
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
        loaded: false,
    });
    const [pendingReveal, setPendingReveal] = useState<CapsuleReveal | null>(null);

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

    const earnCapsule = useCallback(async (score: number): Promise<boolean> => {
        if (score < CAPSULE_SCORE_THRESHOLD) return false;
        try {
            const res = await fetch("/api/pinbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "earn", score }),
            });
            const data = await res.json();
            if (data.earned) {
                setState(prev => ({ ...prev, capsules: data.capsules, totalEarned: prev.totalEarned + 1 }));
                return true;
            }
        } catch { /* ignore */ }
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
            const data = await res.json();
            if (!data.opened) return null;

            // Pick a random badge from the returned tier
            const tier = data.tier as BadgeTier;
            const tierBadges = BADGES.filter(b => b.tier === tier);
            const badge = tierBadges[Math.floor(Math.random() * tierBadges.length)];

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
        } catch {
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
            const data = await res.json();
            if (data.collected) {
                setState(prev => ({
                    ...prev,
                    pins: {
                        ...prev.pins,
                        [pendingReveal.badge.id]: {
                            count: data.count,
                            firstEarned: prev.pins[pendingReveal.badge.id]?.firstEarned || new Date().toISOString(),
                        },
                    },
                }));
            }
        } catch { /* ignore */ }
        setPendingReveal(null);
    }, [pendingReveal]);

    return {
        state,
        pendingReveal,
        load,
        earnCapsule,
        openCapsule,
        collectReveal,
        totalCollected: Object.keys(state.pins).length,
        totalBadges: BADGES.length,
    };
}
