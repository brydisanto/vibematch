import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GVC_CONTRACT, WALLET_REGEX, gvcHoldersKey, isGvcHolder } from "@/lib/gvc";

export const dynamic = "force-dynamic";

/**
 * Verifies whether a connected wallet holds a GVC NFT (directly or via a
 * delegate.xyz delegation) and reflects the result into the `gvc:holders`
 * KV set + the user's `user_flags.gvcHolder`. The Axie "Points/GVC"
 * leaderboard filters the ranked points cohort against that set.
 *
 * Unlike vibestr-check this does NOT short-circuit when already flagged:
 * a re-check must be able to REMOVE a user who sold/transferred their GVC
 * since last connect. The hourly cron (/api/admin/gvc-refresh) sweeps all
 * linked wallets for the same reason.
 *
 * Server-side by design — the client names the address, the server reads
 * balanceOf itself, so a user can only ever verify a wallet whose GVC the
 * named address (or its delegator) actually holds.
 */
export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = (session.username as string).toLowerCase();

    try {
        const body = await req.json();
        const walletAddress = body?.walletAddress as string | undefined;
        if (!walletAddress || !WALLET_REGEX.test(walletAddress)) {
            return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
        }

        // Per-user rate limit — 60s window, mirrors vibestr-check.
        const rlKey = `rl:gvc-check:${username}`;
        const attempts = await kv.incr(rlKey);
        if (attempts === 1) await kv.expire(rlKey, 60);
        if (attempts > 10) {
            return NextResponse.json({ error: "Rate limited — try again in a minute" }, { status: 429 });
        }

        const holds = await isGvcHolder(walletAddress.toLowerCase() as `0x${string}`);

        // Reflect into the holder set (authoritative for the board) and the
        // per-user flag (for any holder-badge UI). Both are idempotent.
        const existingFlags = (await kv.get(`user_flags:${username}`)) as Record<string, boolean> | null;
        if (holds) {
            await kv.sadd(gvcHoldersKey(), username);
            if (!existingFlags?.gvcHolder) {
                await kv.set(`user_flags:${username}`, { ...(existingFlags || {}), gvcHolder: true });
            }
        } else {
            await kv.srem(gvcHoldersKey(), username);
            if (existingFlags?.gvcHolder) {
                await kv.set(`user_flags:${username}`, { ...existingFlags, gvcHolder: false });
            }
        }

        return NextResponse.json({ verified: holds, contract: GVC_CONTRACT });
    } catch (error) {
        console.error("gvc-check error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
