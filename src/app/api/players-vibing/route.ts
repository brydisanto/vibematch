import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * "N PLAYERS VIBING" top-bar data source. Returns:
 *   - count: total classic-leaderboard player count (same as before)
 *   - avatars: the N most-recently-active players (by recent game log),
 *     falling back to the classic leaderboard top-N if the game log is
 *     sparse. Each has { username, avatarUrl } so the UI can render a
 *     stack with real faces.
 *
 * No auth — this powers a public-visible top-bar count, so avatar URLs
 * are only ever served for accounts that already have a public profile.
 */

const AVATAR_COUNT = 5;

interface PlayerInfo {
    username: string;
    avatarUrl: string;
}

export async function GET() {
    try {
        // 1. Count: use the classic leaderboard zcard as the authoritative
        //    "total players who have ever played" — same signal the old
        //    text marquee used.
        const count = (await kv.zcard("classic_leaderboard")) as number;

        // 2. Recent-activity stream: scan gamelog:* keys and pick the
        //    owners of the most-recently-updated logs. The zset score is
        //    the Date.now() of each game-end, so zrange 0 0 rev gets the
        //    latest per user. Expensive on huge userbases; fine at our
        //    current scale.
        const usernames = await recentGamelogOwners(AVATAR_COUNT * 3);

        // 3. Pad from classic leaderboard if gamelog returned fewer than
        //    we want (brand-new KV state, etc).
        let padded: string[] = [...usernames];
        if (padded.length < AVATAR_COUNT) {
            const top = (await kv.zrange("classic_leaderboard", 0, AVATAR_COUNT - 1, { rev: true })) as string[];
            for (const u of top) {
                const lower = u.toLowerCase();
                if (!padded.some(p => p.toLowerCase() === lower)) padded.push(u);
                if (padded.length >= AVATAR_COUNT) break;
            }
        }
        padded = padded.slice(0, AVATAR_COUNT);

        // 4. Load each player's avatarUrl from the user:<name> profile blob.
        const avatars: PlayerInfo[] = await Promise.all(
            padded.map(async (u) => {
                try {
                    const profile = (await kv.get(`user:${u.toLowerCase()}`)) as { username?: string; avatarUrl?: string } | null;
                    return {
                        username: profile?.username || u,
                        avatarUrl: profile?.avatarUrl || "",
                    };
                } catch {
                    return { username: u, avatarUrl: "" };
                }
            }),
        );

        return NextResponse.json(
            { count, avatars },
            // Short public cache — marquee can tolerate a few seconds of
            // staleness and this endpoint scans gamelogs, which we'd
            // rather not do per-request.
            { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
        );
    } catch (e) {
        console.error("players-vibing error:", e);
        return NextResponse.json({ count: 0, avatars: [] }, { status: 200 });
    }
}

async function recentGamelogOwners(limit: number): Promise<string[]> {
    // Pull up to `limit` most recent gamelog timestamps across all users.
    // We scan gamelog:* keys and for each, zrange 0 0 rev to get the most
    // recent game end. Sort by ts desc, return usernames.
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const result = (await kv.scan(cursor, { match: "gamelog:*", count: 100 })) as [string | number, string[]];
        cursor = result[0];
        keys.push(...result[1]);
        if (keys.length >= 200) break; // hard cap on the scan
    } while (cursor !== 0 && cursor !== "0");

    if (keys.length === 0) return [];

    // Per-user: get most recent score. Batch parallel.
    const entries = await Promise.all(
        keys.map(async (k) => {
            const rows = (await kv.zrange(k, 0, 0, { rev: true, withScores: true })) as Array<{ score: number } | string | number>;
            // @vercel/kv sometimes returns [member, score] flat; handle both shapes.
            let ts = 0;
            if (Array.isArray(rows) && rows.length > 0) {
                const first = rows[0] as unknown;
                if (typeof first === "object" && first !== null && "score" in (first as object)) {
                    ts = Number((first as { score: number }).score) || 0;
                } else if (rows.length >= 2 && typeof rows[1] === "number") {
                    ts = Number(rows[1]) || 0;
                }
            }
            return { username: k.replace(/^gamelog:/, ""), ts };
        }),
    );

    return entries
        .filter(e => e.ts > 0)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit)
        .map(e => e.username);
}
