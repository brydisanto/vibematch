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
        const type = searchParams.get("type") || "users";

        if (type === "users") {
            return await exportUsers();
        } else if (type === "transactions") {
            return await exportTransactions();
        } else {
            return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
        }
    } catch (e) {
        console.error("Admin export error:", e);
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
}

async function exportUsers() {
    const authKeys = await scanKeys("user_auth:*");
    const usernames = authKeys.map(k => k.replace("user_auth:", "")).sort();

    // Build spend map
    const txKeys = await scanKeys("tx:*:processed");
    const spendMap = new Map<string, { spent: number; txCount: number }>();
    for (const key of txKeys) {
        const raw = await kv.get(key);
        if (!raw) continue;
        try {
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (!data?.username) continue;
            const entry = spendMap.get(data.username) || { spent: 0, txCount: 0 };
            entry.spent += parseFloat(data.amount || "0");
            entry.txCount += 1;
            spendMap.set(data.username, entry);
        } catch { continue; }
    }

    const headers = [
        "username", "created_at", "wallet_address", "unique_pins", "capsules_unopened",
        "capsules_earned", "capsules_opened", "high_score", "vibestr_spent", "purchase_count",
        "referrals", "avatar_url",
    ];

    const rows: string[] = [headers.join(",")];

    for (const username of usernames) {
        const [auth, pinbook, profile, referral] = await Promise.all([
            kv.get(`user_auth:${username}`) as Promise<any>,
            kv.get(`pinbook:${username}`) as Promise<any>,
            kv.get(`user:${username}`) as Promise<any>,
            kv.get(`referral:${username}`) as Promise<any>,
        ]);

        const canonicalUsername = profile?.username || auth?.username || username;
        let highScore = await kv.zscore('classic_leaderboard', canonicalUsername) as number | null;
        if (highScore == null) {
            highScore = await kv.zscore('classic_leaderboard', username) as number | null;
        }

        const spend = spendMap.get(username) || { spent: 0, txCount: 0 };

        const row = [
            escCsv(canonicalUsername),
            escCsv(auth?.createdAt || ""),
            escCsv(profile?.walletAddress || ""),
            pinbook?.pins ? Object.keys(pinbook.pins).length : 0,
            pinbook?.capsules || 0,
            pinbook?.totalEarned || 0,
            pinbook?.totalOpened || 0,
            highScore ?? 0,
            spend.spent.toFixed(2),
            spend.txCount,
            referral?.totalReferrals || 0,
            escCsv(profile?.avatarUrl || ""),
        ];

        rows.push(row.join(","));
    }

    const csv = rows.join("\n");
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="vibematch-users-${new Date().toISOString().split('T')[0]}.csv"`,
        },
    });
}

async function exportTransactions() {
    const txKeys = await scanKeys("tx:*:processed");
    const headers = ["tx_hash", "username", "wallet", "package_size", "amount_vibestr", "timestamp", "date"];
    const rows: string[] = [headers.join(",")];

    const transactions: any[] = [];
    for (const key of txKeys) {
        const raw = await kv.get(key);
        if (!raw) continue;
        try {
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            const txHash = key.split(":")[1];
            transactions.push({ txHash, ...data });
        } catch { continue; }
    }

    transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    for (const tx of transactions) {
        const row = [
            escCsv(tx.txHash || ""),
            escCsv(tx.username || ""),
            escCsv(tx.wallet || ""),
            tx.packageSize || 0,
            tx.amount || "0",
            tx.timestamp || 0,
            escCsv(tx.timestamp ? new Date(tx.timestamp).toISOString() : ""),
        ];
        rows.push(row.join(","));
    }

    const csv = rows.join("\n");
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="vibematch-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
        },
    });
}

function escCsv(val: string): string {
    if (!val) return '""';
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
}
