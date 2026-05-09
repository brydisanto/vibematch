import { kv } from "@vercel/kv";

/**
 * Emergency kill switches for expensive endpoints.
 *
 * Each protected endpoint reads `kv.get("kill:<scope>")` at the top
 * of the handler. If the key is set (any truthy value), the endpoint
 * short-circuits and returns 503. To trigger from the Vercel KV
 * dashboard or `redis-cli`:
 *
 *   SET kill:players-vibing 1
 *   SET kill:pinbook-leaderboard-scan 1
 *
 * Removing the key (DEL kill:<scope>) re-enables the endpoint
 * immediately — no redeploy needed.
 *
 * Use cases:
 *   - KV throughput spiking due to a runaway scan
 *   - Public RPC throttling forcing retries
 *   - Bug in a non-critical endpoint that's burning quota
 *
 * Fails OPEN — if the kill-switch lookup itself fails, we let the
 * request through. We'd rather have one expensive request go
 * through than 503 the whole game on a transient KV hiccup.
 *
 * In-memory cache: 5s TTL so a kill-switched endpoint doesn't add
 * its own KV call to every request. Trade-off: takes up to 5s for
 * a kill / un-kill to take effect across all serverless instances.
 */

const cache = new Map<string, { killed: boolean; expires: number }>();
const CACHE_TTL_MS = 5_000;

export async function isKilled(scope: string): Promise<boolean> {
    const cached = cache.get(scope);
    const now = Date.now();
    if (cached && cached.expires > now) {
        return cached.killed;
    }
    try {
        const v = await kv.get(`kill:${scope}`);
        const killed = !!v;
        cache.set(scope, { killed, expires: now + CACHE_TTL_MS });
        return killed;
    } catch {
        // Fail open on KV error.
        return false;
    }
}
