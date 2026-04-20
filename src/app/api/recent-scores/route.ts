import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Returns the last N scored runs for the authenticated user — used to
 * populate the "RECENT RUNS" panel on the desktop Arcade landing. The
 * underlying storage is the existing `gamelog:<username>` zset (written
 * by /api/pinbook logGame), so this endpoint is read-only.
 *
 * Response shape:
 *   { runs: [{ mode, score, timestamp }] }
 *
 * Query params:
 *   ?limit=10  (default 10, max 20)
 */
export async function GET(req: Request) {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsedLimit = Number(searchParams.get("limit") ?? 10);
    const limit = Number.isFinite(parsedLimit)
        ? Math.min(20, Math.max(1, Math.floor(parsedLimit)))
        : 10;

    const username = (session.username as string).toLowerCase();

    try {
        const raw = await kv.zrange(`gamelog:${username}`, 0, limit - 1, { rev: true });
        const runs = ((raw as unknown[]) || [])
            .map(entry => {
                try {
                    const parsed = typeof entry === "string" ? JSON.parse(entry) : (entry as any);
                    if (!parsed) return null;
                    return {
                        mode: (parsed.gameMode as string) || "classic",
                        score: Number(parsed.score || 0),
                        timestamp: Number(parsed.timestamp || 0),
                    };
                } catch {
                    return null;
                }
            })
            .filter((r): r is { mode: string; score: number; timestamp: number } => r !== null);

        return NextResponse.json(
            { runs },
            // Per-user response — short private cache so the landing
            // doesn't hammer KV on every tab focus.
            { headers: { "Cache-Control": "private, max-age=15" } }
        );
    } catch (error) {
        console.error("KV error fetching recent scores:", error);
        return NextResponse.json({ error: "Failed to fetch recent scores" }, { status: 500 });
    }
}
