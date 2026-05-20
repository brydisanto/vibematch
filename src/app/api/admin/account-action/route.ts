import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";
import { getEasternDailyKey } from "@/lib/daily-window";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/account-action
 *
 * Admin-only endpoint for ban / unban / delete on a user account.
 *
 * Body:
 *   { username: string, action: "ban" | "unban" | "delete", reason?: string }
 *
 * Behavior:
 *  - "ban" sets `user_auth.banned = true` + bannedAt/bannedBy/bannedReason.
 *    Removes the user from `classic_leaderboard` and today's daily
 *    leaderboard. Stores their pre-ban classic score on the auth record
 *    so unban can restore it without rescanning history. Login + game
 *    start + score submission all reject banned users at the API level.
 *  - "unban" clears the banned flag and re-adds the user to
 *    `classic_leaderboard` if a pre-ban score is recorded.
 *  - "delete" wipes the auth record + pinbook + profile + ancillary
 *    user-keyed data, and removes their leaderboard entries. Game logs
 *    and tx records are preserved for forensic value. Writes a tombstone
 *    `deleted_user:<username>` so the audit trail survives.
 *
 * All actions append an entry to `admin_grants:<username>` (the existing
 * audit zset, which now tracks all admin actions, not just grants).
 */

interface UserAuth {
    username: string;
    password: string;
    createdAt?: string;
    banned?: boolean;
    bannedAt?: number;
    bannedBy?: string;
    bannedReason?: string;
    preBanScore?: number;
}

interface AuditEntry {
    timestamp: number;
    admin: string;
    type: "ban" | "unban" | "delete" | "plays" | "capsules";
    amount?: number;
    note?: string;
    reason?: string;
}

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

async function appendAudit(username: string, entry: AuditEntry) {
    try {
        await kv.zadd(`admin_grants:${username}`, {
            score: entry.timestamp,
            member: JSON.stringify(entry),
        });
    } catch (e) {
        console.error("[admin/account-action] audit write failed", e);
    }
}

async function removeFromLeaderboards(canonicalUsername: string, lowerUsername: string) {
    const today = getEasternDailyKey();
    // Remove both the canonical-cased entry and any lowercase variant —
    // older accounts may have been seeded with the lowercase form.
    await Promise.all([
        kv.zrem("classic_leaderboard", canonicalUsername),
        kv.zrem("classic_leaderboard", lowerUsername),
        kv.zrem(`daily_leaderboard:${today}`, canonicalUsername),
        kv.zrem(`daily_leaderboard:${today}`, lowerUsername),
    ]);
}

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { username?: string; action?: string; reason?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const username = (body.username || "").toLowerCase().trim();
    const action = body.action;
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;

    if (!username) {
        return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }
    if (action !== "ban" && action !== "unban" && action !== "delete") {
        return NextResponse.json({ error: "action must be 'ban', 'unban', or 'delete'" }, { status: 400 });
    }

    const authKey = `user_auth:${username}`;
    const auth = (await kv.get(authKey)) as UserAuth | null;

    // For ban / unban we need the user to exist. For delete we want
    // idempotency — if they're already gone, treat that as success.
    if (!auth && action !== "delete") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve canonical-cased username from profile so leaderboard removes hit.
    const profile = (await kv.get(`user:${username}`)) as { username?: string } | null;
    const canonicalUsername = profile?.username || auth?.username || username;

    if (action === "ban") {
        if (!auth) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Capture current classic score so unban can restore it.
        const currentScore = (await kv.zscore("classic_leaderboard", canonicalUsername)) as number | null
            ?? (await kv.zscore("classic_leaderboard", username)) as number | null;

        const updated: UserAuth = {
            ...auth,
            banned: true,
            bannedAt: Date.now(),
            bannedBy: admin,
            bannedReason: reason,
            preBanScore: currentScore != null ? currentScore : auth.preBanScore,
        };
        await kv.set(authKey, updated);
        await removeFromLeaderboards(canonicalUsername, username);
        await appendAudit(username, {
            timestamp: Date.now(),
            admin,
            type: "ban",
            reason,
        });
        console.log(`[admin/account-action] ban: ${admin} banned ${username} (reason: ${reason || "—"})`);
        return NextResponse.json({ ok: true, banned: true, preBanScore: updated.preBanScore ?? null });
    }

    if (action === "unban") {
        if (!auth) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const restoredScore = auth.preBanScore;
        const updated: UserAuth = {
            ...auth,
            banned: false,
        };
        // Remove ban metadata (keep only when banned=true).
        delete updated.bannedAt;
        delete updated.bannedBy;
        delete updated.bannedReason;
        delete updated.preBanScore;
        await kv.set(authKey, updated);

        // Re-add to classic leaderboard if we have their old score.
        if (typeof restoredScore === "number" && restoredScore > 0) {
            try {
                await kv.zadd("classic_leaderboard", { score: restoredScore, member: canonicalUsername });
            } catch (e) {
                console.error("[admin/account-action] failed to restore leaderboard entry", e);
            }
        }

        await appendAudit(username, {
            timestamp: Date.now(),
            admin,
            type: "unban",
            reason,
        });
        console.log(`[admin/account-action] unban: ${admin} unbanned ${username}`);
        return NextResponse.json({ ok: true, banned: false, restoredScore: restoredScore ?? null });
    }

    // action === "delete"
    // Forensics-preserving delete: wipes login + pinbook + profile +
    // ancillary state, but keeps gamelog and tx records for investigation.
    const keysToDelete: string[] = [
        authKey,
        `user:${username}`,
        `pinbook:${username}`,
        `pinbook:lb:entry:${username}`,
        `streak:${username}`,
        `achievements:${username}`,
        `ftue_flags:${username}`,
        `user_flags:${username}`,
        `referral:${username}`,
        `referral:credited:${username}`,
        `pinbook:${username}:activeMatch`,
    ];

    // Daily trackers and match records are scoped under pinbook:<u>:* —
    // scan and delete those too. Cap the scan so a runaway pattern can't
    // pull thousands of unrelated keys (defensive — the prefix is tight).
    const dailyKeys = await scanKeys(`pinbook:${username}:*`, 2000);
    keysToDelete.push(...dailyKeys);

    // Daily-played / earned / bonus markers are spread across dates.
    const dailyMarkers = [
        ...(await scanKeys(`daily_played:${username}:*`, 500)),
        ...(await scanKeys(`daily_earned:${username}:*`, 500)),
        ...(await scanKeys(`daily_bonus:${username}:*`, 500)),
        ...(await scanKeys(`matchstats:${username}:*`, 500)),
    ];
    keysToDelete.push(...dailyMarkers);

    // De-dupe in case the wide scan caught keys we already enumerated.
    const uniqueKeys = Array.from(new Set(keysToDelete));

    if (uniqueKeys.length > 0) {
        try {
            await kv.del(...uniqueKeys);
        } catch (e) {
            console.error("[admin/account-action] kv.del batch failed, falling back to single deletes", e);
            for (const k of uniqueKeys) {
                try { await kv.del(k); } catch {}
            }
        }
    }

    await removeFromLeaderboards(canonicalUsername, username);

    // Tombstone — survives the user_auth deletion so audit history reads
    // can still confirm this account was deleted (vs. just never existed).
    await kv.set(`deleted_user:${username}`, {
        deletedAt: Date.now(),
        deletedBy: admin,
        reason,
        canonicalUsername,
        keysDeleted: uniqueKeys.length,
    });

    await appendAudit(username, {
        timestamp: Date.now(),
        admin,
        type: "delete",
        reason,
    });

    console.log(`[admin/account-action] delete: ${admin} deleted ${username} (${uniqueKeys.length} keys, reason: ${reason || "—"})`);
    return NextResponse.json({ ok: true, deleted: true, keysDeleted: uniqueKeys.length });
}
