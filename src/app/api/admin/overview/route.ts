import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function scanKeys(pattern: string, limit: number = 10000): Promise<string[]> {
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
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // Count users
        const userAuthKeys = await scanKeys("user_auth:*");
        const pinbookKeys = await scanKeys("pinbook:*");

        // Filter out daily/leaderboard keys from pinbook scan
        const pinbookUserKeys = pinbookKeys.filter(k => {
            const parts = k.split(":");
            return parts.length === 2 && parts[0] === "pinbook";
        });

        // Count transactions
        const txKeys = await scanKeys("tx:*:processed");

        // Aggregate tx data
        let totalVibestrSpent = 0;
        let totalGamesGranted = 0;
        const txRecords: any[] = [];

        for (const key of txKeys) {
            const raw = await kv.get(key);
            if (!raw) continue;
            try {
                const data = typeof raw === "string" ? JSON.parse(raw) : raw;
                txRecords.push(data);
                totalVibestrSpent += parseFloat(data.amount || "0");
                totalGamesGranted += Number(data.packageSize || 0);
            } catch {
                continue;
            }
        }

        // Count total capsules earned across all users
        let totalCapsulesEarned = 0;
        let totalPinsCollected = 0;
        for (const key of pinbookUserKeys) {
            const pb = await kv.get(key) as any;
            if (pb?.totalEarned) totalCapsulesEarned += Number(pb.totalEarned);
            if (pb?.pins) totalPinsCollected += Object.keys(pb.pins).length;
        }

        return NextResponse.json({
            totalUsers: userAuthKeys.length,
            totalPinbookUsers: pinbookUserKeys.length,
            totalCapsulesEarned,
            totalPinsCollected,
            totalTransactions: txRecords.length,
            totalVibestrSpent,
            totalGamesGranted,
        });
    } catch (e) {
        console.error("Admin overview error:", e);
        return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
    }
}
