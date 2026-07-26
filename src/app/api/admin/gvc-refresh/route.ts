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

/** Collect { username, wallet } for every profile with a linked wallet. */
async function linkedWallets(): Promise<Array<{ username: string; wallet: `0x${string}` }>> {
    const out: Array<{ username: string; wallet: `0x${string}` }> = [];
    let cursor = "0";
    do {
        // NOTE: Upstash SCAN cursors exceed JS safe-integer range — keep
        // them as strings; never Number(cursor).
        const scan = await kv.scan(cursor, { match: "user:*", count: 500 }) as [string, string[]];
        cursor = scan[0];
        const keys = scan[1];
        if (keys.length > 0) {
            const values = await kv.mget(...keys) as Array<{ walletAddress?: string } | null>;
            keys.forEach((k, i) => {
                const wallet = values[i]?.walletAddress?.toLowerCase();
                if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)) {
                    out.push({ username: k.slice("user:".length).toLowerCase(), wallet: wallet as `0x${string}` });
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
            batch.map(async u => (await isGvcHolder(u.wallet)) ? u.username : null),
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
