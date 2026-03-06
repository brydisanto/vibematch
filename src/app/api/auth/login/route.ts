import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { hashPassword, encrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

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

        const hashedPassword = await hashPassword(password);
        if (user.password !== hashedPassword) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Log them in
        const session = await encrypt({ username: user.username });
        const res = NextResponse.json({ success: true, user: { username: user.username } });

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
