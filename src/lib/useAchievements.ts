"use client";

import { useState, useCallback, useRef } from "react";
import { AchievementDef, ACHIEVEMENTS_BY_ID } from "./achievements";

export interface UnlockedAchievement {
    id: string;
    unlockedAt: string;
}

export interface AchievementsState {
    unlocked: Record<string, UnlockedAchievement>;
    loaded: boolean;
}

export interface AchievementUnlockEvent {
    achievement: AchievementDef;
    capsules: number;
}

export function useAchievements() {
    const [state, setState] = useState<AchievementsState>({
        unlocked: {},
        loaded: false,
    });
    const [pendingToasts, setPendingToasts] = useState<AchievementUnlockEvent[]>([]);
    const [seenCount, setSeenCount] = useState<number>(0);

    // Prevent duplicate unlock calls for the same achievement within a session
    const pendingUnlocks = useRef(new Set<string>());

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/achievements");
            if (!res.ok) return;
            const data = await res.json();
            setState({ unlocked: data.unlocked || {}, loaded: true });

            // Restore seen count from localStorage
            const stored = localStorage.getItem("vibematch_achievements_seen");
            setSeenCount(stored ? parseInt(stored, 10) || 0 : 0);

            // Server detected user won yesterday's daily — auto-unlock
            if (data.dailyChampEligible && !data.unlocked?.['daily_champ']) {
                // Defer to after state is set
                setTimeout(() => {
                    fetch("/api/achievements", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "unlock", achievementIds: ["daily_champ"] }),
                    }).then(async (r) => {
                        if (!r.ok) return;
                        const result = await r.json();
                        if (result.unlocked?.length > 0) {
                            setState(prev => {
                                const next = { ...prev.unlocked };
                                next['daily_champ'] = { id: 'daily_champ', unlockedAt: new Date().toISOString() };
                                return { ...prev, unlocked: next };
                            });
                            setPendingToasts(prev => [...prev, {
                                achievement: ACHIEVEMENTS_BY_ID['daily_champ'],
                                capsules: result.unlocked[0].capsules,
                            }]);
                        }
                    }).catch(() => {});
                }, 500);
            }
        } catch {
            // Not logged in or error
        }
    }, []);

    const isUnlocked = useCallback(
        (id: string) => !!state.unlocked[id],
        [state.unlocked]
    );

    const getUnlockedSet = useCallback(
        () => new Set(Object.keys(state.unlocked)),
        [state.unlocked]
    );

    /**
     * Attempts to unlock one or more achievements.
     * Filters out already-unlocked ones, sends to server, and queues toasts.
     * Returns the newly unlocked achievement IDs.
     */
    const unlock = useCallback(async (ids: string[]): Promise<string[]> => {
        // Filter out already unlocked and currently pending
        const newIds = ids.filter(
            id => !state.unlocked[id] && !pendingUnlocks.current.has(id) && ACHIEVEMENTS_BY_ID[id]
        );
        if (newIds.length === 0) return [];

        // Mark as pending
        newIds.forEach(id => pendingUnlocks.current.add(id));

        try {
            const res = await fetch("/api/achievements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "unlock", achievementIds: newIds }),
            });

            if (!res.ok) {
                console.error("achievements unlock failed:", res.status);
                newIds.forEach(id => pendingUnlocks.current.delete(id));
                return [];
            }

            const data = await res.json();
            const unlockedIds = (data.unlocked as Array<{ id: string; capsules: number }>).map(u => u.id);

            // Update local state
            setState(prev => {
                const next = { ...prev.unlocked };
                for (const u of data.unlocked) {
                    next[u.id] = { id: u.id, unlockedAt: new Date().toISOString() };
                }
                return { ...prev, unlocked: next };
            });

            // Queue toasts for each newly unlocked
            const toasts: AchievementUnlockEvent[] = (data.unlocked as Array<{ id: string; capsules: number }>).map(u => ({
                achievement: ACHIEVEMENTS_BY_ID[u.id],
                capsules: u.capsules,
            }));
            if (toasts.length > 0) {
                setPendingToasts(prev => [...prev, ...toasts]);
            }

            // Clear pending
            newIds.forEach(id => pendingUnlocks.current.delete(id));

            return unlockedIds;
        } catch (e) {
            console.error("achievements unlock error:", e);
            newIds.forEach(id => pendingUnlocks.current.delete(id));
            return [];
        }
    }, [state.unlocked]);

    /** Remove the first toast from the queue (call after displaying it). */
    const dismissToast = useCallback(() => {
        setPendingToasts(prev => prev.slice(1));
    }, []);

    /** Mark all current achievements as "seen" — clears the badge. */
    const markSeen = useCallback(() => {
        const count = Object.keys(state.unlocked).length;
        setSeenCount(count);
        localStorage.setItem("vibematch_achievements_seen", String(count));
    }, [state.unlocked]);

    const unlockedCount = Object.keys(state.unlocked).length;
    const unseenCount = Math.max(0, unlockedCount - seenCount);

    return {
        state,
        pendingToasts,
        load,
        isUnlocked,
        getUnlockedSet,
        unlock,
        dismissToast,
        markSeen,
        unlockedCount,
        unseenCount,
    };
}
