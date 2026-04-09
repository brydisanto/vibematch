import { getSession } from "./auth";

/**
 * Check if the current session user is an admin.
 * Admin list is set via env var ADMIN_USERNAMES (comma-separated).
 * Returns the admin username if authorized, null otherwise.
 */
export async function requireAdmin(): Promise<string | null> {
    const session = await getSession();
    if (!session?.username) return null;

    const adminList = (process.env.ADMIN_USERNAMES || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    const username = (session.username as string).toLowerCase();
    return adminList.includes(username) ? username : null;
}

export function isAdminUsername(username: string): boolean {
    const adminList = (process.env.ADMIN_USERNAMES || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    return adminList.includes(username.toLowerCase());
}
