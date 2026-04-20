"use client";

/**
 * Admin API client helpers. Every admin fetch goes through adminFetch() so
 * the X-Admin-Token header (stored in localStorage) is attached automatically.
 *
 * The token itself is a high-entropy shared secret set via ADMIN_ACCESS_TOKEN
 * on the server. Admins paste it once into AdminTokenGate; it's persisted in
 * localStorage and never leaves the device except to our own API. A stolen
 * session cookie without the token cannot access admin endpoints.
 */

const STORAGE_KEY = "vibematch.adminToken";

export function getAdminToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

export function setAdminToken(token: string): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, token);
    } catch {}
}

export function clearAdminToken(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
}

export class AdminAuthError extends Error {
    constructor(message = "Admin authorization required") {
        super(message);
        this.name = "AdminAuthError";
    }
}

/**
 * Wrapper around fetch that attaches the admin token header. Throws
 * AdminAuthError on 403 so callers can trigger a re-prompt. We deliberately
 * do NOT support query-param fallback — the token never appears in URLs,
 * access logs, or browser history.
 */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const token = getAdminToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("X-Admin-Token", token);
    const res = await fetch(input, { ...init, headers });
    if (res.status === 403) {
        clearAdminToken();
        throw new AdminAuthError();
    }
    return res;
}

/**
 * Trigger a browser file download via fetch + blob. Use this for admin
 * exports instead of a plain <a href> so the X-Admin-Token header can be
 * attached. Derives the filename from Content-Disposition when present.
 */
export async function adminDownload(path: string, fallbackFilename: string): Promise<void> {
    const res = await adminFetch(path);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || fallbackFilename;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
