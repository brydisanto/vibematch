"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// First-time user experience flags. Stored in localStorage AND mirrored to
// the server when a username is present, so a returning player on a new
// browser doesn't replay the first-run flow. Local is the source of truth
// for read latency; server is the source of truth for "have I seen this
// before, ever?". On hydrate we union the two and write any missing local
// flags back to the server.
//
// Flags are intentionally one-way (set once, never reset) — `?resetFtue=1`
// in the URL wipes localStorage for testing but does NOT clear the server
// blob (you'd need an out-of-band KV delete for that).

const STORAGE_KEY = "vm_ftue_v1";

export type FtueFlag =
    | "primerShown"       // pre-game primer card dismissed
    | "firstMoveShown"    // idle-in-playing-view nudge to make first swap
    | "bombHintShown"     // first 4-match / bomb callout
    | "vibestreakHintShown" // first 5-match / vibestreak callout
    | "cosmicBlastHintShown" // first 6-match / cosmic blast callout
    | "firstCapsuleShown"  // first time a capsule was actually earned (server-confirmed)
    | "firstFailShown";    // first time a game ended without earning a capsule

type FtueState = Record<FtueFlag, boolean>;

const EMPTY: FtueState = {
    primerShown: false,
    firstMoveShown: false,
    bombHintShown: false,
    vibestreakHintShown: false,
    cosmicBlastHintShown: false,
    firstCapsuleShown: false,
    firstFailShown: false,
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

async function fetchServerFlags(): Promise<Partial<FtueState>> {
    try {
        const res = await fetch("/api/ftue", { credentials: "include" });
        if (!res.ok) return {};
        const data = await res.json().catch(() => ({}));
        return (data?.flags ?? {}) as Partial<FtueState>;
    } catch {
        return {};
    }
}

async function postServerFlag(flag: FtueFlag): Promise<void> {
    try {
        await fetch("/api/ftue", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flag }),
        });
    } catch {
        // Network blip — local mark is still in place, will resync on next load.
    }
}

export function useFtue() {
    const [state, setState] = useState<FtueState>(EMPTY);
    // Mirror state in a ref so `has()` can answer truthfully even within
    // the same tick a `mark()` was called (React state updates batch
    // asynchronously, which previously let two FTUE checks both fire when
    // they ran back-to-back).
    const stateRef = useRef<FtueState>(EMPTY);

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.get("resetFtue") === "1") {
                    window.localStorage.removeItem(STORAGE_KEY);
                    url.searchParams.delete("resetFtue");
                    window.history.replaceState({}, "", url.toString());
                    console.log("[useFtue] resetFtue=1 — cleared localStorage and stripped param");
                }
            } catch {
                // ignore URL parse errors
            }
        }
        const local = read();
        stateRef.current = local;
        setState(local);

        // Merge with server flags if a session exists. We trust whichever
        // side says "true" — flags are one-way, so the union is safe.
        // Anything new on the server gets written back to local; anything
        // local but not on server gets pushed up.
        let cancelled = false;
        (async () => {
            const server = await fetchServerFlags();
            if (cancelled) return;
            const merged: FtueState = { ...local };
            const newlyServerSet: FtueFlag[] = [];
            const needsServerWrite: FtueFlag[] = [];
            (Object.keys(EMPTY) as FtueFlag[]).forEach(flag => {
                const inLocal = !!local[flag];
                const inServer = !!server[flag];
                if (inServer && !inLocal) {
                    merged[flag] = true;
                    newlyServerSet.push(flag);
                }
                if (inLocal && !inServer) {
                    needsServerWrite.push(flag);
                }
            });
            if (newlyServerSet.length > 0) {
                write(merged);
            }
            stateRef.current = merged;
            setState(merged);
            // Backfill the server with any flags only local has — fire-and-forget.
            for (const flag of needsServerWrite) {
                postServerFlag(flag);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const mark = useCallback((flag: FtueFlag) => {
        if (stateRef.current[flag]) return;
        const next = { ...stateRef.current, [flag]: true };
        stateRef.current = next;
        write(next);
        setState(next);
        // Persist server-side so a different browser/session won't replay it.
        postServerFlag(flag);
    }, []);

    // has() reads from the ref so a same-tick check after mark() returns
    // the freshly-set value, not the stale React state.
    const has = useCallback((flag: FtueFlag) => stateRef.current[flag], []);

    return { state, mark, has };
}
