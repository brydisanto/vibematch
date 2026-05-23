import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit/top-ips?limit=<n>&minUsers=<m>
 *
 * Scans every `audit:ip:*` key, fetches its SCARD (the count of distinct
 * usernames seen on that IP hash within the 90-day TTL), and returns
 * the top N by user count. This is the "suspect IPs you didn't think to
 * search" view — an IP hash with 12 usernames touching it is almost
 * always either a real shared device (family, library, school) or a
 * deliberate multi-account farm. Either way, worth a manual look.
 *
 * Query params:
 *   - limit    (optional) — 1-100, default 50
 *   - minUsers (optional) — only include IPs with at least this many
 *                            usernames. Default 2 (excludes single-user
 *                            IPs, which are the vast majority and noise).
 *
 * Response: { hashes: { hash, count }[], scanned, returned }
 *
 * Caching: results are cached in-memory for 60 seconds per (limit, minUsers)
 * combo. The SCAN + N pipelined SCARDs are not cheap; admin can click the
 * refresh button (or wait 60s) to invalidate.
 */

interface TopIpEntry {
    hash: string;
    count: number;
}

interface CacheEntry {
    expires: number;
    payload: { hashes: TopIpEntry[]; scanned: number; returned: number };
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
    const rawMin = parseInt(searchParams.get("minUsers") || "2", 10);
    const minUsers = Number.isFinite(rawMin) ? Math.max(1, rawMin) : 2;
    const force = searchParams.get("force") === "1";

    const cacheKey = `${limit}|${minUsers}`;
    if (!force) {
        const hit = cache.get(cacheKey);
        if (hit && hit.expires > Date.now()) {
            return NextResponse.json(hit.payload);
        }
    }

    try {
        // Iterate every audit:ip:* key via SCAN. We stop at HARD_SCAN_CAP
        // to avoid unbounded admin requests if the namespace explodes.
        const HARD_SCAN_CAP = 5_000;
        const ipKeys: string[] = [];
        let cursor: string | number = 0;
        do {
            const [next, batch] = await kv.scan(cursor, { match: "audit:ip:*", count: 200 });
            cursor = next as string | number;
            if (Array.isArray(batch)) ipKeys.push(...(batch as string[]));
            if (ipKeys.length >= HARD_SCAN_CAP) break;
        } while (String(cursor) !== "0");

        // Pipeline SCARDs in chunks to bound concurrency.
        const CHUNK = 100;
        const counts: TopIpEntry[] = [];
        for (let i = 0; i < ipKeys.length; i += CHUNK) {
            const slice = ipKeys.slice(i, i + CHUNK);
            const sizes = await Promise.all(slice.map(k => kv.scard(k)));
            for (let j = 0; j < slice.length; j++) {
                const size = Number(sizes[j]) || 0;
                if (size < minUsers) continue;
                counts.push({
                    hash: slice[j].replace("audit:ip:", ""),
                    count: size,
                });
            }
        }
        counts.sort((a, b) => b.count - a.count);
        const top = counts.slice(0, limit);

        const payload = { hashes: top, scanned: ipKeys.length, returned: top.length };
        cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, payload });
        return NextResponse.json(payload);
    } catch (err) {
        console.error("[audit/top-ips] scan failed", err);
        return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }
}
