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

export async function GET(req: Request) {
    const admin = await requireAdmin();
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

            return {
                username: profile?.username || auth?.username || username,
                lowercaseUsername: username,
                createdAt: auth?.createdAt || null,
                avatarUrl: profile?.avatarUrl || "",
                capsules: pinbook?.capsules || 0,
                totalEarned: pinbook?.totalEarned || 0,
                totalOpened: pinbook?.totalOpened || 0,
                uniquePins: pinbook?.pins ? Object.keys(pinbook.pins).length : 0,
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
