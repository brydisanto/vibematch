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
 * Add-only by design: connecting a wallet that holds GVC puts the user on
 * the board and remembers that wallet (profile.linkedWallets). Connecting a
 * wallet that does NOT hold never drops the user, because they may still hold
 * via another linked wallet (the vault-vs-hot-wallet case). Removal is left
 * to the hourly cron (/api/admin/gvc-refresh), which re-derives the board by
 * checking ALL of each user's linked wallets and only drops someone once none
 * of their wallets hold GVC anymore.
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

        const w = walletAddress.toLowerCase();
        const holds = await isGvcHolder(w as `0x${string}`);

        const existingFlags = (await kv.get(`user_flags:${username}`)) as Record<string, boolean> | null;
        if (holds) {
            // On the board, flag set, and remember this wallet so a later
            // switch to a non-holding wallet never drops them.
            await kv.sadd(gvcHoldersKey(), username);
            if (!existingFlags?.gvcHolder) {
                await kv.set(`user_flags:${username}`, { ...(existingFlags || {}), gvcHolder: true });
            }
            const pkey = `user:${username}`;
            const prof = (await kv.get(pkey)) as any || {};
            const prev: string[] = Array.isArray(prof.linkedWallets) ? prof.linkedWallets : [];
            if (!prev.includes(w)) {
                await kv.set(pkey, { ...prof, linkedWallets: [...prev, w].slice(-12) });
            }
            return NextResponse.json({ verified: true, walletHoldsGvc: true, contract: GVC_CONTRACT });
        }

        // This wallet does not hold GVC. Do NOT remove the user — another
        // linked wallet may still hold, and the hourly cron re-derives the
        // board from all of them. Report their actual current board status.
        const onBoard = (await kv.sismember(gvcHoldersKey(), username)) === 1;
        return NextResponse.json({ verified: onBoard, walletHoldsGvc: false, contract: GVC_CONTRACT });
    } catch (error) {
        console.error("gvc-check error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
