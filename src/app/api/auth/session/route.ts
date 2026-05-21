import { getSession, getCachedUserProfile } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !session.username) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const profile = await getCachedUserProfile(session.username);

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
