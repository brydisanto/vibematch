import { kv } from "@vercel/kv";

/**
 * KV-backed sliding-window rate limiter. Same pattern as the login /
 * register routes, generalized so every hot endpoint can use it.
 *
 * Returns `{ ok: true }` if the request fits inside the budget, or
 * `{ ok: false, retryAfter }` if the caller should be 429'd.
 *
 * Fails OPEN — if KV is degraded we'd rather let traffic through
 * than lock everyone out, same philosophy as `isUserBanned()`.
 *
 * Usage:
 *   const rl = await rateLimit({ scope: 'score', key: username, max: 10, windowSec: 60 });
 *   if (!rl.ok) return NextResponse.json({ error: 'Too many requests', retryAfter: rl.retryAfter }, { status: 429 });
 */
export interface RateLimitResult {
    ok: boolean;
    /** Seconds the caller should wait before retrying. Only present on `ok: false`. */
    retryAfter?: number;
    /** Current count after this attempt. Useful for debug logging. */
    count?: number;
}

export interface RateLimitOptions {
    /** Logical bucket name — used as the KV key prefix. */
    scope: string;
    /** Identity to bucket on (username, IP, userId, etc). Should be already lowercased / canonicalised. */
    key: string;
    /** Max attempts allowed in the window. */
    max: number;
    /** Window length in seconds. */
    windowSec: number;
}

export async function rateLimit({ scope, key, max, windowSec }: RateLimitOptions): Promise<RateLimitResult> {
    const rlKey = `rl:${scope}:${key}`;
    try {
        const count = await kv.incr(rlKey);
        // INCR doesn't set a TTL on its own — apply on the first hit. We
        // can detect "first hit" via count===1; subsequent INCRs leave
        // the existing TTL intact.
        if (count === 1) {
            await kv.expire(rlKey, windowSec);
        }
        if (count > max) {
            // We don't know the exact remaining TTL without an extra
            // round-trip, so we return windowSec as a worst-case hint.
            // Good enough for Retry-After headers; clients typically
            // back off-and-retry rather than honour to the millisecond.
            return { ok: false, retryAfter: windowSec, count };
        }
        return { ok: true, count };
    } catch (e) {
        console.error(`[rateLimit] KV error on ${scope}:${key}, failing open:`, e);
        return { ok: true };
    }
}

/**
 * Helper for the common pattern of returning a 429 when limited.
 * Caller still has to do the NextResponse.json — this just builds
 * the standard payload + headers shape.
 */
export function rateLimited429(result: RateLimitResult, scope: string) {
    return {
        body: {
            error: "Too many requests. Please slow down.",
            scope,
            retryAfter: result.retryAfter ?? 60,
        },
        init: {
            status: 429 as const,
            headers: {
                "Retry-After": String(result.retryAfter ?? 60),
            },
        },
    };
}
