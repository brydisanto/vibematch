import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * POST /api/auth/reset-request
 * Body: { username: string }
 *
 * Generates a one-time reset token, stores it keyed by token (with TTL),
 * and emails the link to the address on file for that user. Always
 * returns the same generic 200 response regardless of whether the user
 * exists or has an email — prevents account enumeration via the reset
 * endpoint.
 */
export async function POST(req: Request) {
    try {
        const { username } = await req.json();

        if (!username || typeof username !== "string") {
            // Still return the generic success so an attacker can't
            // distinguish "bad request" from "user doesn't exist".
            return genericOk();
        }

        // Rate limit by IP — 3 reset requests / 15 min. Tighter than login
        // because each successful call triggers an email send.
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const rateLimitKey = `rl:reset-request:${ip}`;
        const attempts = await kv.incr(rateLimitKey);
        if (attempts === 1) {
            await kv.expire(rateLimitKey, 15 * 60);
        }
        if (attempts > 3) {
            // Still return generic 200 so we don't help bots distinguish
            // rate-limit vs success. Just don't send the email.
            return genericOk();
        }

        const userKey = `user_auth:${username.toLowerCase()}`;
        const user = await kv.get(userKey) as { username?: string; email?: string } | null;
        if (!user || !user.email) {
            // No account, or account has no email on file. Generic
            // response either way — user has to set an email in their
            // profile before they can reset. We do log this to help
            // operations spot lockouts.
            console.log(`[reset-request] no recoverable email for ${username.toLowerCase()}`);
            return genericOk();
        }

        // Generate token, store keyed by token (not by user) so the link
        // itself is the secret. crypto.randomUUID is 128-bit, plenty.
        const token = crypto.randomUUID();
        const tokenKey = `reset_token:${token}`;
        await kv.set(
            tokenKey,
            { username: user.username || username, createdAt: Date.now() },
            { ex: RESET_TOKEN_TTL_SECONDS },
        );

        const result = await sendPasswordResetEmail({
            to: user.email,
            username: user.username || username,
            resetToken: token,
        });

        if (!result.ok) {
            // Send failed or skipped (no API key configured). Don't expose
            // the difference to the caller — but log so we can fix it.
            console.error(`[reset-request] send failed for ${user.username}: ${result.error || "skipped"}`);
        }

        return genericOk();
    } catch (error) {
        console.error("[reset-request] error:", error);
        return genericOk();
    }
}

function genericOk() {
    return NextResponse.json({
        ok: true,
        message: "If an account exists with a recovery email on file, a reset link has been sent.",
    });
}
