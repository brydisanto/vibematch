import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function scanKeys(pattern: string, limit: number = 1000): Promise<string[]> {
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

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { username: rawUsername } = await params;
        const username = rawUsername.toLowerCase();

        const [authRaw, pinbookRaw, profileRaw, streakRaw, achievementsRaw, lbEntryRaw] = await Promise.all([
            kv.get(`user_auth:${username}`),
            kv.get(`pinbook:${username}`),
            kv.get(`user:${username}`),
            kv.get(`streak:${username}`),
            kv.get(`achievements:${username}`),
            kv.get(`pinbook:lb:entry:${username}`),
        ]);

        const auth = authRaw as any;
        if (!auth) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const pinbook = pinbookRaw as any;
        const profile = profileRaw as any;

        // Strip password hash from auth object before returning
        const safeAuth = auth ? { username: auth.username, createdAt: auth.createdAt } : null;

        // Get all daily trackers for this user (last 30 days)
        const dailyKeys = await scanKeys(`pinbook:${username}:daily:*`);
        const dailyTrackers = await Promise.all(dailyKeys.map(async k => {
            const data = await kv.get(k) as any;
            const date = k.split(":").pop();
            return { date, ...data };
        }));
        dailyTrackers.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        // Get user's tx records
        const txKeys = await scanKeys("tx:*:processed");
        const userTxs: any[] = [];
        for (const key of txKeys) {
            const raw = await kv.get(key);
            if (!raw) continue;
            try {
                const data = typeof raw === "string" ? JSON.parse(raw) : raw;
                if (data.username === username) {
                    const txHash = key.split(":")[1];
                    userTxs.push({ txHash, ...data });
                }
            } catch {
                continue;
            }
        }
        userTxs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return NextResponse.json({
            auth: safeAuth,
            profile,
            pinbook,
            streak: streakRaw,
            achievements: achievementsRaw,
            leaderboardEntry: lbEntryRaw,
            dailyTrackers: dailyTrackers.slice(0, 30),
            transactions: userTxs,
        });
    } catch (e) {
        console.error("Admin user detail error:", e);
        return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
    }
}
