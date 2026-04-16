"use client";

import { useCallback, useEffect, useState } from "react";

// First-time user experience flags. Stored in localStorage so each browser
// gets its own FTUE session. Flags are intentionally one-way (set once, never
// reset) — a returning player on a new browser is treated as a new player,
// which is fine for a PoC (arguably a re-orientation feature).

const STORAGE_KEY = "vm_ftue_v1";

export type FtueFlag =
    | "primerShown"       // pre-game primer card dismissed
    | "firstMoveShown"    // idle-in-playing-view nudge to make first swap
    | "bombHintShown"     // first 4-match / bomb callout
    | "vibestreakHintShown" // first 5-match / vibestreak callout
    | "capsuleFlashShown"  // first time score crossed 15K
    | "postGameShown";    // first-game post-game modal

type FtueState = Record<FtueFlag, boolean>;

const EMPTY: FtueState = {
    primerShown: false,
    firstMoveShown: false,
    bombHintShown: false,
    vibestreakHintShown: false,
    capsuleFlashShown: false,
    postGameShown: false,
};

function read(): FtueState {
    if (typeof window === "undefined") return EMPTY;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw) as Partial<FtueState>;
        return { ...EMPTY, ...parsed };
    } catch {
        return EMPTY;
    }
}

function write(next: FtueState) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // storage full or disabled — FTUE just won't persist this session
    }
}

export function useFtue() {
    const [state, setState] = useState<FtueState>(EMPTY);

    // Hydrate from localStorage after mount (avoids SSR hydration mismatch)
    useEffect(() => {
        setState(read());
    }, []);

    const mark = useCallback((flag: FtueFlag) => {
        setState(prev => {
            if (prev[flag]) return prev;
            const next = { ...prev, [flag]: true };
            write(next);
            return next;
        });
    }, []);

    const has = useCallback((flag: FtueFlag) => state[flag], [state]);

    return { state, mark, has };
}
