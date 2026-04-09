import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";
import { detectAnomalies, highestSeverity, type GameLogEntry, type AnomalyFlag } from "@/lib/game-anomalies";

export const dynamic = "force-dynamic";

async function scanKeys(pattern: string, limit: number = 5000): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const result = (await kv.scan(cursor, { match: pattern, count: 100 })) as [string | number, string[]];
        cursor = result[0];
        keys.push(...result[1]);
        if (keys.length >= limit) break;
    } while (cursor !== 0 && cursor !== "0");
    return keys;
}

interface FlaggedGame extends GameLogEntry {
    flags: AnomalyFlag[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    username: string;
}

export async function GET(req: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const minSeverity = (searchParams.get("severity") || "low").toLowerCase();
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1, none: 0 } as const;
        const minRank = severityRank[minSeverity as keyof typeof severityRank] ?? 1;

        // Scan for all game log keys
        const gameLogKeys = await scanKeys("gamelog:*", 5000);

        const flaggedGames: FlaggedGame[] = [];
        let totalGamesScanned = 0;
        const userSummary = new Map<string, { flaggedCount: number; maxSeverity: string }>();

        for (const key of gameLogKeys) {
            // Extract username from key: gamelog:<username>
            const username = key.replace("gamelog:", "");

            // Fetch all logged games for this user (most recent 200)
            const entriesRaw = await kv.zrange(key, 0, 199, { rev: true }) as string[];
            totalGamesScanned += entriesRaw.length;

            for (const entry of entriesRaw) {
                let game: GameLogEntry;
                try {
                    game = typeof entry === 'string' ? JSON.parse(entry) : entry;
                } catch {
                    continue;
                }

                const flags = detectAnomalies(game);
                if (flags.length === 0) continue;

                const severity = highestSeverity(flags);
                if (severity === 'none') continue;

                // Only include if it meets the minimum severity filter
                if (severityRank[severity] < minRank) continue;

                flaggedGames.push({
                    ...game,
                    username: game.username || username,
                    flags,
                    severity,
                });

                // Track per-user summary
                const prev = userSummary.get(username) || { flaggedCount: 0, maxSeverity: 'low' };
                prev.flaggedCount += 1;
                if (severityRank[severity as keyof typeof severityRank] > severityRank[prev.maxSeverity as keyof typeof severityRank]) {
                    prev.maxSeverity = severity;
                }
                userSummary.set(username, prev);
            }
        }

        // Sort by severity (critical first), then newest first
        flaggedGames.sort((a, b) => {
            const sDiff = severityRank[b.severity] - severityRank[a.severity];
            if (sDiff !== 0) return sDiff;
            return (b.timestamp || 0) - (a.timestamp || 0);
        });

        // Build the user summary list
        const users = Array.from(userSummary.entries())
            .map(([username, data]) => ({
                username,
                flaggedCount: data.flaggedCount,
                maxSeverity: data.maxSeverity,
            }))
            .sort((a, b) => {
                const sDiff = severityRank[b.maxSeverity as keyof typeof severityRank] - severityRank[a.maxSeverity as keyof typeof severityRank];
                if (sDiff !== 0) return sDiff;
                return b.flaggedCount - a.flaggedCount;
            });

        return NextResponse.json({
            flaggedGames: flaggedGames.slice(0, 500), // cap response size
            totalFlagged: flaggedGames.length,
            totalGamesScanned,
            totalUsersFlagged: users.length,
            usersFlagged: users,
        });
    } catch (e) {
        console.error("Admin anomalies error:", e);
        return NextResponse.json({ error: "Failed to load anomalies" }, { status: 500 });
    }
}
