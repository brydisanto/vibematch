import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

/**
 * Public profile endpoint backing the tap-through profile page at
 * /u/[username]. The actual aggregation lives in lib/profile.ts so
 * the server-rendered page can call the same code path without an
 * extra HTTP hop. Returns 404 for non-existent or banned users —
 * public surface never exposes ban state.
 *
 * Cached 60s — profile data changes slowly relative to game throughput.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
    try {
        const { username } = await params;
        const profile = await getProfile(username);
        if (!profile) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json(profile, {
            headers: { "Cache-Control": "public, s-maxage=60, max-age=30" },
        });
    } catch (error) {
        console.error("[profile] fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}
