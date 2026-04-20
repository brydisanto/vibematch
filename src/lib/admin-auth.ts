import { getSession } from "./auth";

/**
 * Check if the current session user is an admin.
 *
 * Authorization is two-layered:
 *   1. Session username must be in ADMIN_USERNAMES (env, comma-separated).
 *   2. If ADMIN_ACCESS_TOKEN is set in env, the caller must also present a
 *      matching `X-Admin-Token` header. This is a lightweight MFA stub —
 *      admins paste the token into the admin UI, which stores it in
 *      localStorage and attaches it to every admin fetch. A compromised
 *      user session alone is NOT enough to reach admin endpoints once the
 *      env is populated.
 *
 * If ADMIN_ACCESS_TOKEN is unset, the header check is skipped so the system
 * degrades gracefully (e.g. on a fresh deploy before the env is configured),
 * but every production deploy is expected to set it.
 *
 * Returns the admin username if authorized, null otherwise.
 */
export async function requireAdmin(req?: Request): Promise<string | null> {
    const session = await getSession();
    if (!session?.username) return null;

    const adminList = (process.env.ADMIN_USERNAMES || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    const username = (session.username as string).toLowerCase();
    if (!adminList.includes(username)) return null;

    const expectedToken = process.env.ADMIN_ACCESS_TOKEN;
    if (expectedToken) {
        if (!req) return null;
        const provided = req.headers.get("x-admin-token");
        if (!provided || !timingSafeEqual(provided, expectedToken)) {
            return null;
        }
    }

    return username;
}

/**
 * Constant-time string comparison to prevent timing attacks on the admin
 * token. JS '===' short-circuits on first mismatched byte, which in theory
 * leaks token prefix length. This is paranoia-level for a shared env token,
 * but it's free to do right.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

export function isAdminUsername(username: string): boolean {
    const adminList = (process.env.ADMIN_USERNAMES || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    return adminList.includes(username.toLowerCase());
}
