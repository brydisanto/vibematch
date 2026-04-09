import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { verifyPassword, hashPassword, encrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

// Rate limit: 10 attempts per 15 minutes per IP+username combo
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 10;

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

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

        // Successful login — clear rate limit and rehash legacy SHA-256 passwords
        await kv.del(rateLimitKey);
        if (!user.password.startsWith("pbkdf2:")) {
            try {
                const newHash = await hashPassword(password);
                await kv.set(userKey, { ...user, password: newHash });
            } catch (e) {
                console.warn("Failed to rehash legacy password:", e);
            }
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
