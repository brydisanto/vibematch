import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";

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

// Aggregate all tx records into per-user totals — done once per request.
// Splits txs into bonus-game purchases (no `type` field) vs rerolls
// (`type === "reroll"`) so the admin dashboard can surface them as
// distinct columns. Both kinds count toward `txCount` for the legacy
// "Purchases" column, but `rerollCount` lets us show rerolls separately.
interface UserSpend {
    spent: number;
    txCount: number;
    bonusGames: number;
    rerollCount: number;
}

async function buildUserSpendMap(): Promise<Map<string, UserSpend>> {
    // Keys are normalized to lowercase to match how user_auth keys are
    // shaped. Some legacy tx records stored `username` with the canonical
    // casing (mixed case) while the per-user lookup keys off the lowercase
    // user_auth: key — without normalization those legacy txs ended up
    // bucketed under a mixed-case key and never matched, which made the
    // per-user "VIBESTR Spent" column sum lower than the overview total.
    const spendMap = new Map<string, UserSpend>();
    const txKeys = await scanKeys("tx:*:processed");
    for (const key of txKeys) {
        const raw = await kv.get(key);
        if (!raw) continue;
        try {
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (!data?.username) continue;
            const userKey = String(data.username).toLowerCase();
            const entry = spendMap.get(userKey) || { spent: 0, txCount: 0, bonusGames: 0, rerollCount: 0 };
            entry.spent += parseFloat(data.amount || "0");
            if (data.type === "reroll") {
                entry.rerollCount += 1;
            } else {
                entry.txCount += 1;
                entry.bonusGames += Number(data.packageSize || 0);
            }
            spendMap.set(userKey, entry);
        } catch {
            continue;
        }
    }
    return spendMap;
}

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("q")?.toLowerCase() || "";

        const authKeys = await scanKeys("user_auth:*");
        const usernames = authKeys
            .map(k => k.replace("user_auth:", ""))
            .filter(u => !search || u.includes(search))
            .sort();

        // Pre-aggregate spend data so we don't scan tx keys per-user
        const spendMap = await buildUserSpendMap();

        // For each user, load lightweight summary stats
        const users = await Promise.all(usernames.slice(0, 200).map(async (username) => {
            const [authRaw, pinbookRaw, profileRaw] = await Promise.all([
                kv.get(`user_auth:${username}`),
                kv.get(`pinbook:${username}`),
                kv.get(`user:${username}`),
            ]);
            const auth = authRaw as any;
            const pinbook = pinbookRaw as any;
            const profile = profileRaw as any;

            const canonicalUsername = profile?.username || auth?.username || username;
            let highScore = await kv.zscore('classic_leaderboard', canonicalUsername) as number | null;
            if (highScore == null) {
                highScore = await kv.zscore('classic_leaderboard', username) as number | null;
            }

            const spend = spendMap.get(username) || { spent: 0, txCount: 0, bonusGames: 0, rerollCount: 0 };

            return {
                username: canonicalUsername,
                lowercaseUsername: username,
                createdAt: auth?.createdAt || null,
                avatarUrl: profile?.avatarUrl || "",
                walletAddress: profile?.walletAddress || null,
                capsules: pinbook?.capsules || 0,
                totalEarned: pinbook?.totalEarned || 0,
                totalOpened: pinbook?.totalOpened || 0,
                uniquePins: pinbook?.pins ? Object.keys(pinbook.pins).length : 0,
                highScore: highScore ?? 0,
                vibestrSpent: spend.spent,
                purchaseCount: spend.txCount,
                rerollCount: spend.rerollCount,
            };
        }));

        return NextResponse.json({
            users,
            total: usernames.length,
            shown: users.length,
        });
    } catch (e) {
        console.error("Admin users error:", e);
        return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
    }
}
