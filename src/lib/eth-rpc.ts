import { createPublicClient, http, fallback, type PublicClient } from "viem";
import { mainnet } from "viem/chains";

/**
 * Shared mainnet PublicClient with RPC fallback list.
 *
 * The fallback prepends a paid Alchemy endpoint (when ALCHEMY_API_KEY is
 * set) ahead of the public-RPC list. Public endpoints (flashbots,
 * llamarpc, 1rpc) share a per-IP rate limit and Vercel serverless
 * functions share egress IPs — under purchase / reroll volume those
 * RPCs WILL throttle, returning errors on legitimate transactions.
 *
 * With Alchemy first, normal traffic goes through the keyed paid RPC
 * (300M+ compute units/month free, plenty for our scale), and the
 * public list is a defense against Alchemy outages rather than the
 * primary path.
 *
 * To enable: set `ALCHEMY_API_KEY` in Vercel env vars. With nothing set
 * we transparently fall back to the original public-only behavior.
 *
 * Same client is reused across `wallet/vibestr-check`, `pinbook/
 * purchase-prize-games`, and `pinbook/reroll`.
 */

let cachedClient: PublicClient | null = null;

export function getMainnetClient(): PublicClient {
    if (cachedClient) return cachedClient;

    const alchemyKey = process.env.ALCHEMY_API_KEY;
    const transports = [];

    if (alchemyKey) {
        // Primary: Alchemy mainnet RPC
        transports.push(http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`));
    }

    // Public fallback list — same as before. Kept even when Alchemy is
    // available so a single-provider outage doesn't take down purchase
    // verification. `rank: true` makes viem health-check and prefer the
    // fastest available, so normal traffic still hits Alchemy.
    transports.push(
        http("https://rpc.flashbots.net"),
        http("https://eth.llamarpc.com"),
        http("https://1rpc.io/eth"),
    );

    cachedClient = createPublicClient({
        chain: mainnet,
        transport: fallback(transports, { rank: true }),
    }) as PublicClient;

    return cachedClient;
}
