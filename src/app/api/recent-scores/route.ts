import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession, isUserBanned, getCachedUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Returns recent scored runs — either the authenticated user's own
 * history (scope=me, default) or the public global activity feed
 * (scope=global) used by the desktop "RECENT RUNS" panel.
 *
 * Mode summary:
 *   scope=me:     reads `gamelog:<user>` zset (private). Auth required.
 *                 Rows: { mode, score, timestamp }
 *   scope=global: reads `global_feed` zset (public). No auth required.
 *                 Banned users filtered at read time. Rows decorated
 *                 with canonical casing + avatarUrl for tap-through.
 *                 Rows: { username, avatarUrl, mode, score, timestamp }
 *
 * Query params:
 *   ?scope=me|global (default me)
 *   ?limit=10        (default 10, max 20)
 */

type GlobalFeedEntry = {
    username: string;
    mode: string;
    score: number;
    ts: number;
};

type MeRow = { mode: string; score: number; timestamp: number };
type GlobalRow = {
    username: string;
    avatarUrl: string | null;
    mode: string;
    score: number;
    timestamp: number;
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "me").toLowerCase();
    const parsedLimit = Number(searchParams.get("limit") ?? 10);
    const limit = Number.isFinite(parsedLimit)
        ? Math.min(20, Math.max(1, Math.floor(parsedLimit)))
        : 10;

    if (scope === "global") {
        return getGlobalFeed(limit);
    }

    return getMyFeed(limit);
}

async function getMyFeed(limit: number) {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = (session.username as string).toLowerCase();

    try {
        const raw = await kv.zrange(`gamelog:${username}`, 0, limit - 1, { rev: true });
        const runs: MeRow[] = ((raw as unknown[]) || [])
            .map(entry => {
                try {
                    const parsed = typeof entry === "string" ? JSON.parse(entry) : (entry as any);
                    if (!parsed) return null;
                    return {
                        mode: (parsed.gameMode as string) || "classic",
                        score: Number(parsed.score || 0),
                        timestamp: Number(parsed.timestamp || 0),
                    } as MeRow;
                } catch {
                    return null;
                }
            })
            .filter((r): r is MeRow => r !== null);

        return NextResponse.json(
            { scope: "me", runs },
            { headers: { "Cache-Control": "private, max-age=15" } },
        );
    } catch (error) {
        console.error("KV error fetching personal recent scores:", error);
        return NextResponse.json({ error: "Failed to fetch recent scores" }, { status: 500 });
    }
}

async function getGlobalFeed(limit: number) {
    try {
        // Over-fetch by 50% so banned users dropping out doesn't leave
        // the response short. Still bounded.
        const fetchSize = Math.min(50, Math.ceil(limit * 1.5));
        const raw = await kv.zrange("global_feed", 0, fetchSize - 1, { rev: true });

        const parsed: GlobalFeedEntry[] = ((raw as unknown[]) || [])
            .map(entry => {
                try {
                    const obj = typeof entry === "string" ? JSON.parse(entry) : (entry as any);
                    if (!obj || typeof obj.username !== "string") return null;
                    return {
                        username: obj.username,
                        mode: typeof obj.mode === "string" ? obj.mode : "classic",
                        score: Number(obj.score || 0),
                        ts: Number(obj.ts || 0),
                    } as GlobalFeedEntry;
                } catch {
                    return null;
                }
            })
            .filter((r): r is GlobalFeedEntry => r !== null);

        // Batch banned + profile lookups in parallel. isUserBanned is one
        // KV read per user; getCachedUserProfile is in-memory most of the
        // time and at worst one KV read. We unique-by-username first to
        // avoid duplicate reads when the same player appears multiple
        // times in the recent window.
        const uniqueUsers = Array.from(
            new Set(parsed.map(p => p.username.toLowerCase())),
        );
        const [bannedFlags, profiles] = await Promise.all([
            Promise.all(uniqueUsers.map(u => isUserBanned(u))),
            Promise.all(uniqueUsers.map(u => getCachedUserProfile(u))),
        ]);
        const bannedMap = new Map(uniqueUsers.map((u, i) => [u, bannedFlags[i]]));
        const profileMap = new Map(uniqueUsers.map((u, i) => [u, profiles[i]]));

        const runs: GlobalRow[] = parsed
            .filter(p => !bannedMap.get(p.username.toLowerCase()))
            .slice(0, limit)
            .map(p => {
                const profile = profileMap.get(p.username.toLowerCase());
                return {
                    username: profile?.username || p.username,
                    avatarUrl: profile?.avatarUrl || null,
                    mode: p.mode,
                    score: p.score,
                    timestamp: p.ts,
                };
            });

        return NextResponse.json(
            { scope: "global", runs },
            {
                // Public payload — let the Vercel edge serve repeat
                // callers from cache for a few seconds.
                headers: { "Cache-Control": "public, s-maxage=5, max-age=5" },
            },
        );
    } catch (error) {
        console.error("KV error fetching global feed:", error);
        return NextResponse.json({ error: "Failed to fetch global feed" }, { status: 500 });
    }
}
