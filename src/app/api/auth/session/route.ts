import { getSession } from "@/lib/auth";
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !session.username) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const profileKey = `user:${session.username.toLowerCase()}`;
        const profile = await kv.get(profileKey) as any;

        return NextResponse.json({
            authenticated: true,
            user: {
                username: session.username,
                avatarUrl: profile?.avatarUrl || "",
            }
        });
    } catch (error) {
        console.error("Session check error:", error);
        return NextResponse.json({ authenticated: false }, { status: 500 });
    }
}
