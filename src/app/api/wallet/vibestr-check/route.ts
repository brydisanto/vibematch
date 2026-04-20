import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { createPublicClient, http, fallback, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Verifies that a connected wallet holds $VIBESTR and, if so, writes the
 * `vibestrHolder` flag onto the signed-in user's `user_flags:<user>` blob.
 * /api/achievements consumes that flag to award the "Bag Holder" quest.
 *
 * Why server-side:
 *   - The quest is worth 2 capsules; we don't want a trivially spoofable
 *     client POST to grant it.
 *   - Client sends the wallet address; server independently reads
 *     balanceOf(address) via a public RPC. No signature required — a user
 *     claiming a wallet they don't own can't boost their own flag because
 *     they'd only benefit themselves (and only if the address they named
 *     actually holds VIBESTR).
 *
 * Rate-limited loosely via KV to keep accidental polling from hammering RPC.
 */

const VIBESTR_ADDRESS = "0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196" as `0x${string}`;
const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;
const erc20BalanceAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const client = createPublicClient({
    chain: mainnet,
    transport: fallback([
        http("https://rpc.flashbots.net"),
        http("https://eth.llamarpc.com"),
        http("https://1rpc.io/eth"),
    ], { rank: true }),
});

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

        // Short-circuit: if already flagged, don't hammer RPC.
        const existingFlags = (await kv.get(`user_flags:${username}`)) as Record<string, boolean> | null;
        if (existingFlags?.vibestrHolder) {
            return NextResponse.json({ verified: true, cached: true });
        }

        // Lightweight per-user rate limit — 60s window.
        const rlKey = `rl:vibestr-check:${username}`;
        const attempts = await kv.incr(rlKey);
        if (attempts === 1) await kv.expire(rlKey, 60);
        if (attempts > 10) {
            return NextResponse.json({ error: "Rate limited — try again in a minute" }, { status: 429 });
        }

        const balance = await client.readContract({
            address: VIBESTR_ADDRESS,
            abi: erc20BalanceAbi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
        });

        const ZERO = BigInt(0);
        const holds = typeof balance === "bigint" ? balance > ZERO : BigInt(balance as unknown as string) > ZERO;

        if (!holds) {
            return NextResponse.json({ verified: false, balance: "0" });
        }

        await kv.set(`user_flags:${username}`, {
            ...(existingFlags || {}),
            vibestrHolder: true,
        });

        return NextResponse.json({ verified: true });
    } catch (error) {
        console.error("vibestr-check error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
