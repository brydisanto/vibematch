import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { verifyPassword, encrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password required" }, { status: 400 });
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

        // Fetch profile in parallel with JWT generation so login returns everything
        const [session, profile] = await Promise.all([
            encrypt({ username: user.username }),
            kv.get(`user:${user.username.toLowerCase()}`),
        ]);
        const avatarUrl = (profile as any)?.avatarUrl || "";
        const res = NextResponse.json({ success: true, user: { username: user.username, avatarUrl } });

        res.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: session,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return res;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Failed to login" }, { status: 500 });
    }
}
