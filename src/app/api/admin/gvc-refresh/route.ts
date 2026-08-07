/**
 * GET /api/admin/gvc-refresh
 *
 * Vercel Cron target (hourly). Re-derives the `gvc:holders` set from
 * scratch by scanning every user:<name> profile with a linked wallet and
 * checking GVC holding (direct balanceOf + delegate.xyz resolution).
 *
 * Why a full sweep rather than incremental: holders can sell or transfer
 * their GVC at any time, and delegations can be granted/revoked without
 * the player reconnecting. verify-on-connect catches new connects; this
 * catches everything that changes between connects. Rebuilding the set
 * each pass keeps it self-healing — no drift accumulates.
 *
 * Auth: Bearer CRON_SECRET, same as the other /api/admin crons.
 */

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { gvcHoldersKey, checkGvcHolder } from "@/lib/gvc";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// On-chain checks run in bounded-concurrency batches so one pass doesn't
// fire ~1000 RPC calls at once (Alchemy/public-RPC rate limits) or blow
// the function timeout.
const CONCURRENCY = 8;

function authorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const auth = req.headers.get("authorization") || "";
    return auth === `Bearer ${secret}`;
}

/**
 * Collect { username, wallets[] } for every profile with a linked wallet.
 * Wallets = the current walletAddress UNION every entry in linkedWallets, so
 * a user who holds GVC in any wallet they've ever connected is captured even
 * if their "current" wallet is a non-holding hot wallet. linkedWallets rides
 * along on the same profile mget, so this adds no extra KV round-trips.
 */
async function linkedWallets(): Promise<Array<{ username: string; wallets: `0x${string}`[] }>> {
    const re = /^0x[0-9a-fA-F]{40}$/;
    const out: Array<{ username: string; wallets: `0x${string}`[] }> = [];
    let cursor = "0";
    do {
        // NOTE: Upstash SCAN cursors exceed JS safe-integer range — keep
        // them as strings; never Number(cursor).
        const scan = await kv.scan(cursor, { match: "user:*", count: 500 }) as [string, string[]];
        cursor = scan[0];
        const keys = scan[1];
        if (keys.length > 0) {
            const values = await kv.mget(...keys) as Array<{ walletAddress?: string; linkedWallets?: string[] } | null>;
            keys.forEach((k, i) => {
                const v = values[i];
                const set = new Set<string>();
                const primary = v?.walletAddress?.toLowerCase();
                if (primary && re.test(primary)) set.add(primary);
                if (Array.isArray(v?.linkedWallets)) {
                    for (const lw of v!.linkedWallets) {
                        const x = String(lw).toLowerCase();
                        if (re.test(x)) set.add(x);
                    }
                }
                if (set.size > 0) {
                    out.push({ username: k.slice("user:".length).toLowerCase(), wallets: [...set] as `0x${string}`[] });
                }
            });
        }
    } while (cursor !== "0");
    return out;
}

export async function GET(req: Request) {
    if (!authorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const started = Date.now();
    const users = await linkedWallets();
    const key = gvcHoldersKey();

    // NON-DESTRUCTIVE update. We start from the CURRENT membership and only
    // ADD confirmed holders / REMOVE confirmed non-holders. A player whose
    // status can't be verified this run (RPC/registry hiccup) is left exactly
    // as-is. This is what stops transient failures from churning real holders
    // off the board — the old full-rebuild dropped anyone whose balanceOf read
    // failed, and the set decayed a little every run.
    const next = new Set((await kv.smembers(key)) as string[]);
    let added = 0, removed = 0, unknown = 0;

    for (let i = 0; i < users.length; i += CONCURRENCY) {
        const batch = users.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map(async u => {
                // Aggregate the tri-state across all of a user's wallets:
                // holds if ANY confirmed holds; unknown if none confirmed but
                // at least one couldn't be verified; else confirmed no.
                let anyUnknown = false;
                for (const w of u.wallets) {
                    const s = await checkGvcHolder(w);
                    if (s === "holds") return { username: u.username, status: "holds" as const };
                    if (s === "unknown") anyUnknown = true;
                }
                return { username: u.username, status: (anyUnknown ? "unknown" : "no") as "unknown" | "no" };
            }),
        );
        for (const { username, status } of results) {
            if (status === "holds") { if (!next.has(username)) added++; next.add(username); }
            else if (status === "no") { if (next.has(username)) removed++; next.delete(username); }
            else unknown++;
        }
    }

    // Manual overrides: always-included holders the on-chain check can't see —
    // e.g. someone whose GVC is currently on loan / delegated out of their
    // wallet. Union them in unconditionally so the sweep never drops them.
    const manual = (await kv.smembers("gvc:holders:manual")) as string[];
    let manualKept = 0;
    for (const u of manual) { const lc = String(u).toLowerCase(); if (!next.has(lc)) manualKept++; next.add(lc); }

    // Atomically swap in the updated set so a reader never sees a partial write.
    const tmp = `${key}:rebuild`;
    const nextArr = [...next];
    await kv.del(tmp);
    if (nextArr.length > 0) {
        await kv.sadd(tmp, nextArr[0], ...nextArr.slice(1));
        await kv.rename(tmp, key).catch(async () => { await kv.del(key); });
    } else {
        await kv.del(key);
    }

    return NextResponse.json({
        ok: true,
        scanned: users.length,
        holders: nextArr.length,
        added,
        removed,
        unknown,
        manualKept,
        ms: Date.now() - started,
    });
}
