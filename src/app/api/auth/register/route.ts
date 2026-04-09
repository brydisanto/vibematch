import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { hashPassword, encrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password required" }, { status: 400 });
        }

        if (typeof username !== 'string' || typeof password !== 'string') {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        if (username.length < 3 || username.length > 30) {
            return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 });
        }

        if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
            return NextResponse.json(
                { error: "Username may only contain letters, numbers, underscores, hyphens, and periods" },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }

        // Rate limit registrations by IP (5 per hour)
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const rateLimitKey = `rl:register:${ip}`;
        const attempts = await kv.incr(rateLimitKey);
        if (attempts === 1) {
            await kv.expire(rateLimitKey, 60 * 60);
        }
        if (attempts > 5) {
            return NextResponse.json(
                { error: "Too many registration attempts. Please try again later." },
                { status: 429 }
            );
        }

        const userKey = `user_auth:${username.toLowerCase()}`;
        const existingUser = await kv.get(userKey);

        if (existingUser) {
            return NextResponse.json({ error: "Username already taken" }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = {
            username,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
        };

        await kv.set(userKey, newUser);

        // Also ensure a profile entry exists or is initialized
        const profileKey = `user:${username.toLowerCase()}`;
        const existingProfile = await kv.get(profileKey);
        if (!existingProfile) {
            await kv.set(profileKey, { username, avatarUrl: "" });
        }

        // Log them in immediately
        const session = await encrypt({ username });
        const res = NextResponse.json({ success: true, user: { username, avatarUrl: "" } });

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
        console.error("Registration error:", error);
        return NextResponse.json({ error: "Failed to register" }, { status: 500 });
    }
}
