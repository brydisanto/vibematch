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
import { gvcHoldersKey, isGvcHolder } from "@/lib/gvc";

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
    const holders: string[] = [];

    for (let i = 0; i < users.length; i += CONCURRENCY) {
        const batch = users.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map(async u => {
                // Holder if ANY linked wallet holds GVC (directly or via a
                // delegate.xyz delegation, which isGvcHolder expands). Short-
                // circuit on the first hit to keep RPC reads minimal.
                for (const w of u.wallets) {
                    if (await isGvcHolder(w)) return u.username;
                }
                return null;
            }),
        );
        for (const username of results) if (username) holders.push(username);
    }

    // Atomically swap the set to the freshly-computed membership so a
    // reader never sees a half-rebuilt set.
    const key = gvcHoldersKey();
    const tmp = `${key}:rebuild`;
    await kv.del(tmp);
    if (holders.length > 0) await kv.sadd(tmp, holders[0], ...holders.slice(1));
    await kv.rename(tmp, key).catch(async () => {
        // rename fails if tmp is empty (never created). In that case there
        // are zero holders — just clear the live set.
        await kv.del(key);
    });

    return NextResponse.json({
        ok: true,
        scanned: users.length,
        holders: holders.length,
        ms: Date.now() - started,
    });
}
