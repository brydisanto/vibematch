import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import {
    verifyPassword,
    hashPassword,
    isLegacyHash,
    encrypt,
    SESSION_COOKIE_NAME,
} from "@/lib/auth";

// Rate limit: 10 attempts per 15 minutes per IP+username combo
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 10;

const MIN_PASSWORD_LENGTH = 8;

/**
 * Login endpoint. Two-phase for legacy-hash accounts:
 *
 *   Phase 1 (normal login or first attempt on a legacy account):
 *     POST { username, password }
 *     → If password matches a PBKDF2 hash: issue session, done.
 *     → If password matches a LEGACY SHA-256 hash: no session issued.
 *       Response: 401 with { requiresPasswordRotation: true }.
 *       The client prompts the user to choose a new password.
 *
 *   Phase 2 (legacy account completing rotation):
 *     POST { username, password, newPassword }
 *     → verifies the old password again against the legacy hash,
 *     → re-hashes the new password with PBKDF2,
 *     → writes it back before issuing the session.
 *
 * Prior behavior silently auto-rehashed the existing password on login. That
 * was fine for normal-case hygiene but inadequate after 2026-04-20 — any
 * legacy-format hash could have been exposed, so we require the user to
 * actively choose a replacement password they know wasn't in that blast
 * radius.
 */
export async function POST(req: Request) {
    try {
        const { username, password, newPassword } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password required" }, { status: 400 });
        }

        // Rate limit by IP + username
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const rateLimitKey = `rl:login:${ip}:${username.toLowerCase()}`;
        const attempts = await kv.incr(rateLimitKey);
        if (attempts === 1) {
            await kv.expire(rateLimitKey, LOGIN_WINDOW_SECONDS);
        }
        if (attempts > MAX_LOGIN_ATTEMPTS) {
            return NextResponse.json(
                { error: "Too many login attempts. Please try again in a few minutes." },
                { status: 429 }
            );
        }

        const userKey = `user_auth:${username.toLowerCase()}`;
        const user = await kv.get(userKey) as any;

        if (!user) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const passwordValid = await verifyPassword(password, user.password);
        if (!passwordValid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Password verified. Now check whether the stored hash is legacy.
        const legacy = isLegacyHash(user.password);

        if (legacy) {
            // Phase 2: user has provided newPassword — rotate before issuing a
            // session. Enforce the same strength rules as registration.
            if (typeof newPassword === "string" && newPassword.length > 0) {
                if (newPassword.length < MIN_PASSWORD_LENGTH) {
                    return NextResponse.json(
                        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
                        { status: 400 }
                    );
                }
                if (newPassword === password) {
                    return NextResponse.json(
                        { error: "New password must be different from your current password" },
                        { status: 400 }
                    );
                }
                try {
                    const newHash = await hashPassword(newPassword);
                    await kv.set(userKey, { ...user, password: newHash });
                } catch (e) {
                    console.error("Failed to persist rotated password:", e);
                    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
                }
                // Fall through to issue session below.
            } else {
                // Phase 1: block session issuance; client must prompt for a new password.
                // Rate limit is intentionally NOT cleared — rotation attempts
                // still count until success, so brute-forcers don't reset
                // their counter by triggering the rotation branch.
                return NextResponse.json(
                    {
                        error: "Password rotation required",
                        requiresPasswordRotation: true,
                    },
                    { status: 401 }
                );
            }
        }

        // Successful login — clear rate limit.
        await kv.del(rateLimitKey);

        // Fetch profile in parallel with JWT generation so login returns everything
        const [session, profile] = await Promise.all([
            encrypt({ username: user.username }),
            kv.get(`user:${user.username.toLowerCase()}`),
        ]);
        const avatarUrl = (profile as any)?.avatarUrl || "";
        const res = NextResponse.json({
            success: true,
            user: { username: user.username, avatarUrl },
            passwordRotated: legacy,
        });

        res.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: session,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return res;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Failed to login" }, { status: 500 });
    }
}
