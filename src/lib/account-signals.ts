import { kv } from "@vercel/kv";

/**
 * Account signal capture for multi-account / farming detection.
 *
 * Records the IP + device fingerprint each account is seen from, and keeps
 * reverse indexes so "which accounts share this IP / device" is a single
 * SMEMBERS. It does NOT block or gate anything — it's a passive signal layer
 * so an admin can cluster suspected multi-accounts (e.g. before validating
 * event-reward payouts). Best-effort throughout; never throws into callers.
 *
 * Keys:
 *   account_signals:<username>   JSON { ips[], devices[], firstSeen, lastSeen }
 *   sig_ip:<ip>                  set of usernames seen from that IP
 *   sig_device:<fingerprint>     set of usernames seen from that device
 *   sig_seen:<u>:<ip>:<fp>       short-TTL throttle marker for the hot path
 */

const CAP = 30; // max distinct IPs / devices retained per account

/** First hop of x-forwarded-for is the client; fall back to x-real-ip. */
export function extractIp(req: Request): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip")?.trim() ||
        "unknown"
    );
}

function normFingerprint(fp: unknown): string | null {
    if (typeof fp !== "string") return null;
    const s = fp.trim();
    return /^[a-z0-9]{4,64}$/i.test(s) ? s : null;
}

interface SignalRecord {
    ips?: string[];
    devices?: string[];
    firstSeen?: number;
    lastSeen?: number;
}

/**
 * Record an (ip, device) observation for a username. Updates the per-account
 * record only when a new IP or device appears, and always keeps the reverse
 * indexes current (SADD is idempotent).
 */
export async function recordAccountSignals(username: string, ip: string, fingerprint?: unknown): Promise<void> {
    try {
        const u = username.toLowerCase();
        const fp = normFingerprint(fingerprint);
        const validIp = ip && ip !== "unknown" ? ip : null;
        if (!validIp && !fp) return;

        const key = `account_signals:${u}`;
        const cur = (await kv.get(key)) as SignalRecord | null;
        const ips = new Set(cur?.ips || []);
        const devices = new Set(cur?.devices || []);
        let changed = !cur;
        if (validIp && !ips.has(validIp)) { ips.add(validIp); changed = true; }
        if (fp && !devices.has(fp)) { devices.add(fp); changed = true; }
        const now = Date.now();
        if (changed) {
            await kv.set(key, {
                ips: [...ips].slice(-CAP),
                devices: [...devices].slice(-CAP),
                firstSeen: cur?.firstSeen || now,
                lastSeen: now,
            } satisfies SignalRecord);
        }
        if (validIp) await kv.sadd(`sig_ip:${validIp}`, u);
        if (fp) await kv.sadd(`sig_device:${fp}`, u);
    } catch {
        /* signal capture must never affect the request outcome */
    }
}

/**
 * Hot-path variant: records at most once per hour per (user, ip, device) combo
 * so submitting games doesn't hammer KV. The throttle set(nx) is the only cost
 * on the common (already-seen) path.
 */
export async function recordAccountSignalsThrottled(username: string, ip: string, fingerprint?: unknown): Promise<void> {
    try {
        const fp = normFingerprint(fingerprint) || "none";
        const throttleKey = `sig_seen:${username.toLowerCase()}:${ip}:${fp}`;
        const isNew = await kv.set(throttleKey, "1", { nx: true, ex: 3600 });
        if (!isNew) return;
        await recordAccountSignals(username, ip, fingerprint);
    } catch {
        /* best effort */
    }
}
