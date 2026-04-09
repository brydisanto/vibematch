import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getSession, revokeSession } from "@/lib/auth";

export async function POST() {
    // Revoke the session's jti in KV so it can't be replayed from a cached cookie
    try {
        const session = await getSession();
        if (session?.jti) {
            await revokeSession(session.jti as string);
        }
    } catch {
        // Session already invalid — just clear the cookie
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        expires: new Date(0),
        path: "/",
    });
    return res;
}
