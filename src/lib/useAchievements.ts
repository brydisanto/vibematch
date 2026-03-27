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

    // Prevent duplicate unlock calls for the same achievement within a session
    const pendingUnlocks = useRef(new Set<string>());

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/achievements");
            if (!res.ok) return;
            const data = await res.json();
            setState({ unlocked: data.unlocked || {}, loaded: true });
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

    return {
        state,
        pendingToasts,
        load,
        isUnlocked,
        getUnlockedSet,
        unlock,
        dismissToast,
        unlockedCount: Object.keys(state.unlocked).length,
    };
}
