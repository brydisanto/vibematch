import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { hashPassword, encrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/reset-confirm
 * Body: { token: string, newPassword: string }
 *
 * Validates a one-time reset token from /api/auth/reset-request, hashes
 * the new password with the same PBKDF2 routine used at registration,
 * and logs the user in. The reset token is deleted on success so the
 * link can't be reused.
 */
export async function POST(req: Request) {
    try {
        const { token, newPassword } = await req.json();

        if (!token || typeof token !== "string") {
            return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
        }

        if (!newPassword || typeof newPassword !== "string") {
            return NextResponse.json({ error: "New password required" }, { status: 400 });
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json(
                { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
                { status: 400 },
            );
        }

        // Look up token. Generic error if missing/expired so we don't
        // confirm whether a particular token existed in the wild.
        const tokenKey = `reset_token:${token}`;
        const tokenData = await kv.get(tokenKey) as { username?: string } | null;
        if (!tokenData || !tokenData.username) {
            return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
        }

        const userKey = `user_auth:${tokenData.username.toLowerCase()}`;
        const user = await kv.get(userKey) as { username?: string; password?: string; banned?: boolean } | null;
        if (!user) {
            // Token references a deleted user — treat as expired.
            await kv.del(tokenKey);
            return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
        }

        if (user.banned === true) {
            // Banned users can use the reset flow but no session ever
            // gets issued. Generic copy on purpose.
            await kv.del(tokenKey);
            return NextResponse.json(
                { error: "This account is not currently active. Reach out to support if you think this is a mistake." },
                { status: 403 },
            );
        }

        // Hash + persist new password. Burn the token before issuing a
        // session so a replay can't double-reset.
        const newHash = await hashPassword(newPassword);
        await kv.set(userKey, { ...user, password: newHash });
        await kv.del(tokenKey);

        // Issue a fresh session so the user is logged in after reset.
        const canonicalUsername = user.username || tokenData.username;
        const session = await encrypt({ username: canonicalUsername });
        const res = NextResponse.json({
            success: true,
            user: { username: canonicalUsername },
        });
        res.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: session,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });
        return res;
    } catch (error) {
        console.error("[reset-confirm] error:", error);
        return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
    }
}
