import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";
import {
    findPromoEventSet,
    getEventSetPins,
    eventSetPointsKey,
    eventSetSetDoneKey,
    promoLeaderboardKey,
} from "@/lib/promo-badges";
import { gvcHoldersKey } from "@/lib/gvc";

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
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "users";

        if (type === "users") {
            return await exportUsers();
        } else if (type === "transactions") {
            return await exportTransactions();
        } else if (type === "event") {
            const setId = searchParams.get("event") || "";
            return await exportEvent(setId);
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

/**
 * Full participant record for a single event set (Craig / Comfy In Clay /
 * Axie / any future set). Ranking mirrors the live leaderboard cascade in
 * src/app/api/promo/leaderboard/route.ts EXACTLY — points → grails → total
 * pins → [timed: set-completion time earliest | else herds] — so the export
 * order matches what players saw on the board. Joins each participant to
 * their wallet (user:<u>.walletAddress) and recovery email
 * (user_auth:<u>.email); both are optional and blank when not on file.
 */
async function exportEvent(setId: string) {
    const setDef = findPromoEventSet(setId);
    if (!setDef) {
        return NextResponse.json({ error: "Unknown event id" }, { status: 400 });
    }
    const pins = getEventSetPins(setId);

    type Row = { username: string; points: number; pinCounts: Record<string, number>; rank: number };

    // Points zset is the full cohort — any pin pull awards points, so it is
    // a superset of every participant across all of this event's boards.
    const allRaw = await kv.zrange(eventSetPointsKey(setId), 0, -1, { rev: true, withScores: true }) as Array<string | number>;
    const all: Row[] = [];
    for (let i = 0; i < allRaw.length; i += 2) {
        all.push({ username: String(allRaw[i]), points: Number(allRaw[i + 1]), pinCounts: {}, rank: 0 });
    }

    // Per-pin counts for every participant — needed for the tiebreakers and
    // the grails / total-pins / full-sets columns. Batched (pin × participant).
    if (all.length > 0) {
        const pinPromises: Promise<number | null>[] = [];
        const pinIndex: { entryIdx: number; pinId: string }[] = [];
        all.forEach((entry, entryIdx) => {
            pins.forEach(pin => {
                pinIndex.push({ entryIdx, pinId: pin.id });
                pinPromises.push(kv.zscore(promoLeaderboardKey(pin.id), entry.username) as Promise<number | null>);
            });
        });
        const counts = await Promise.all(pinPromises);
        pinIndex.forEach((ref, i) => {
            const v = counts[i];
            all[ref.entryIdx].pinCounts[ref.pinId] = typeof v === "number" ? Number(v) : 0;
        });
    }

    // Set-completion timestamps (timed events only, e.g. Axie).
    const timed = !!setDef.timedBoards;
    const setDoneAt = new Map<string, number>();
    if (timed) {
        const raw = await kv.zrange(eventSetSetDoneKey(setId), 0, -1, { withScores: true }) as Array<string | number>;
        for (let i = 0; i < raw.length; i += 2) setDoneAt.set(String(raw[i]), Number(raw[i + 1]));
    }

    // Cascade identical to the live board.
    const grailPin = pins.find(p => p.isChase) ?? [...pins].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
    const basePins = pins.filter(p => !p.isChase);
    const totalPinsFor = (e: Row) => pins.reduce((s, p) => s + (e.pinCounts[p.id] ?? 0), 0);
    const fullSetsFor = (e: Row) => basePins.length > 0 ? Math.min(...basePins.map(p => e.pinCounts[p.id] ?? 0)) : 0;
    all.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const aG = grailPin ? (a.pinCounts[grailPin.id] ?? 0) : 0;
        const bG = grailPin ? (b.pinCounts[grailPin.id] ?? 0) : 0;
        if (bG !== aG) return bG - aG;
        const aT = totalPinsFor(a), bT = totalPinsFor(b);
        if (bT !== aT) return bT - aT;
        if (timed) return (setDoneAt.get(a.username) ?? Infinity) - (setDoneAt.get(b.username) ?? Infinity);
        return fullSetsFor(b) - fullSetsFor(a);
    });
    all.forEach((e, i) => { e.rank = i + 1; });

    // GVC-holder flag (verified holders live in the gvc:holders set).
    const gvcSet = new Set<string>();
    try {
        const members = (await kv.smembers(gvcHoldersKey())) as string[];
        for (const m of members) gvcSet.add(String(m).toLowerCase());
    } catch { /* set may not exist for non-GVC events */ }

    // Wallet (profile) + email/created_at (auth), batched via mget.
    const profiles = all.length > 0
        ? await kv.mget(...all.map(e => `user:${e.username}`)) as Array<{ walletAddress?: string } | null>
        : [];
    const auths = all.length > 0
        ? await kv.mget(...all.map(e => `user_auth:${e.username}`)) as Array<{ email?: string; createdAt?: string } | null>
        : [];

    const headers = [
        "rank", "username", "points", "full_sets", "set_finish_time",
        "grails", "total_pins", "wallet_address", "email", "gvc_holder", "created_at",
    ];
    const rows: string[] = [headers.join(",")];
    all.forEach((e, i) => {
        const doneMs = setDoneAt.get(e.username);
        const grails = grailPin ? (e.pinCounts[grailPin.id] ?? 0) : 0;
        const row = [
            e.rank,
            escCsv(e.username),
            e.points,
            fullSetsFor(e),
            escCsv(doneMs != null ? new Date(doneMs).toISOString() : ""),
            grails,
            totalPinsFor(e),
            escCsv(profiles[i]?.walletAddress || ""),
            escCsv(auths[i]?.email || ""),
            gvcSet.has(e.username.toLowerCase()) ? "yes" : "no",
            escCsv(auths[i]?.createdAt || ""),
        ];
        rows.push(row.join(","));
    });

    const csv = rows.join("\n");
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="pindrop-event-${setId}-${new Date().toISOString().split("T")[0]}.csv"`,
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
