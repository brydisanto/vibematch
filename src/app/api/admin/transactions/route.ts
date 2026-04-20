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
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const txKeys = await scanKeys("tx:*:processed");
        const transactions: any[] = [];

        for (const key of txKeys) {
            const raw = await kv.get(key);
            if (!raw) continue;
            try {
                const data = typeof raw === "string" ? JSON.parse(raw) : raw;
                const txHash = key.split(":")[1];
                transactions.push({ txHash, ...data });
            } catch {
                continue;
            }
        }

        // Sort newest first
        transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return NextResponse.json({
            transactions,
            total: transactions.length,
        });
    } catch (e) {
        console.error("Admin transactions error:", e);
        return NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
    }
}
