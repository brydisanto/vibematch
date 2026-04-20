import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Small per-user flag store for engagement events that aren't otherwise
 * server-observable — music track changes being the canonical example.
 * Keyed at `user_flags:<username>` as a plain JSON blob.
 *
 * Used by the achievements route to power journey quests like "Set The
 * Vibe" without having to trust a raw client claim every request.
 */
export interface UserFlags {
    musicChanged?: boolean;
    avatarUploaded?: boolean;
    prizeGamePurchased?: boolean;
}

const VALID_FLAGS: (keyof UserFlags)[] = [
    "musicChanged",
    "avatarUploaded",
    "prizeGamePurchased",
];

export async function GET() {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = (session.username as string).toLowerCase();
    try {
        const data = (await kv.get(`user_flags:${username}`)) as UserFlags | null;
        return NextResponse.json(
            { flags: data || {} },
            { headers: { "Cache-Control": "private, max-age=10" } }
        );
    } catch (error) {
        console.error("user-flags GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = (session.username as string).toLowerCase();
    try {
        const body = await req.json();
        const flag = body?.flag as string | undefined;
        if (!flag || !VALID_FLAGS.includes(flag as keyof UserFlags)) {
            return NextResponse.json({ error: "Invalid flag" }, { status: 400 });
        }
        const key = `user_flags:${username}`;
        const existing = (await kv.get(key)) as UserFlags | null;
        const next: UserFlags = { ...(existing || {}), [flag]: true };
        await kv.set(key, next);
        return NextResponse.json({ flags: next });
    } catch (error) {
        console.error("user-flags POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
