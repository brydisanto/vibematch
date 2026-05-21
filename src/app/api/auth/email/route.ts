import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const MAX_EMAIL_LENGTH = 254; // RFC 5321 cap

/** Minimal RFC-ish email check. Catches the obvious typos; doesn't try
 *  to be authoritative — Resend will reject malformed deliveries downstream. */
function isPlausibleEmail(s: string): boolean {
    if (s.length > MAX_EMAIL_LENGTH) return false;
    if (s.length < 3) return false;
    const at = s.indexOf("@");
    if (at <= 0 || at === s.length - 1) return false;
    if (s.indexOf("@", at + 1) !== -1) return false; // no second @
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    if (!local || !domain) return false;
    if (!domain.includes(".")) return false;
    if (/\s/.test(s)) return false;
    return true;
}

/**
 * GET /api/auth/email — returns the email on file for the signed-in user,
 *   or null if not set. Auth-required.
 */
export async function GET() {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const userKey = `user_auth:${(session.username as string).toLowerCase()}`;
        const user = await kv.get(userKey) as { email?: string } | null;
        return NextResponse.json({ email: user?.email || null });
    } catch (e) {
        console.error("[email GET] error:", e);
        return NextResponse.json({ error: "Failed to fetch email" }, { status: 500 });
    }
}

/**
 * POST /api/auth/email — set or clear the recovery email for the signed-in
 *   user. Body: { email: string | null }. Auth-required.
 *
 *   Empty string or null clears the email (user opts out of recovery).
 */
export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { email } = await req.json();

        const username = (session.username as string).toLowerCase();
        const userKey = `user_auth:${username}`;
        const user = await kv.get(userKey) as { username?: string; password?: string; email?: string } | null;
        if (!user) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        let nextEmail: string | undefined;
        if (email === null || email === "" || typeof email === "undefined") {
            nextEmail = undefined; // clearing
        } else if (typeof email !== "string") {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 });
        } else {
            const trimmed = email.trim().toLowerCase();
            if (!isPlausibleEmail(trimmed)) {
                return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
            }
            nextEmail = trimmed;
        }

        // Write back. Preserve all other fields.
        const next = { ...user };
        if (nextEmail === undefined) delete next.email;
        else next.email = nextEmail;
        await kv.set(userKey, next);

        return NextResponse.json({ ok: true, email: nextEmail ?? null });
    } catch (e) {
        console.error("[email POST] error:", e);
        return NextResponse.json({ error: "Failed to save email" }, { status: 500 });
    }
}
