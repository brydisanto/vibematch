/**
 * Lightweight, stable device fingerprint for multi-account clustering.
 *
 * Combines coarse, non-PII browser/device traits into a short hash and caches
 * it in localStorage so it stays stable across sessions on the same browser
 * profile. It is a CLUSTERING signal, not identity: multiple accounts used in
 * the same browser share a fingerprint (the thing we want to catch), while a
 * different browser or incognito produces a different one. Pair with server-
 * side IP for a stronger signal.
 */

function hashString(s: string): string {
    // djb2, unsigned, base36 — compact and dependency-free.
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

let cached: string | null = null;

export function getDeviceFingerprint(): string {
    if (cached) return cached;
    if (typeof window === "undefined") return "none";
    try {
        const KEY = "pd_device_fp";
        const stored = window.localStorage.getItem(KEY);
        if (stored) { cached = stored; return stored; }

        const nav = navigator as Navigator & { deviceMemory?: number };
        const parts: string[] = [
            nav.userAgent || "",
            nav.language || "",
            (nav.languages || []).join(","),
            `${screen.width}x${screen.height}x${screen.colorDepth}`,
            Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            String(nav.hardwareConcurrency || ""),
            String(nav.deviceMemory || ""),
            (nav.platform || ""),
        ];
        // A small canvas signal adds entropy across otherwise-identical specs.
        try {
            const c = document.createElement("canvas");
            const ctx = c.getContext("2d");
            if (ctx) {
                ctx.textBaseline = "top";
                ctx.font = "14px 'Arial'";
                ctx.fillStyle = "#f60";
                ctx.fillRect(0, 0, 60, 20);
                ctx.fillStyle = "#069";
                ctx.fillText("pindrop-fp", 2, 2);
                parts.push(hashString(c.toDataURL()));
            }
        } catch { /* canvas blocked — skip that signal */ }

        const fp = hashString(parts.join("|"));
        try { window.localStorage.setItem(KEY, fp); } catch { /* ignore */ }
        cached = fp;
        return fp;
    } catch {
        return "none";
    }
}
