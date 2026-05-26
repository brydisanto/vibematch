import { kv } from "@vercel/kv";
import { createHash } from "crypto";

/**
 * Lightweight audit log for high-stakes write endpoints — used to
 * track exploit attempts and multi-account abuse without storing
 * personally-identifiable data.
 *
 * What gets logged: timestamp, action name, username, hashed IP,
 * user-agent (truncated), and small action-specific metadata
 * (e.g. score amount, capsule action). Raw IPs are NEVER persisted;
 * only sha256(ip + server pepper), so the dataset is fraud-useful
 * (you can detect "same person via same IP") but doesn't expose
 * reversible IPs if KV is ever breached.
 *
 * Activation: set the `AUDIT_LOG_PEPPER` env var to any
 * high-entropy server-side secret. Helper becomes a no-op when
 * the var is missing — useful as a kill-switch and as the implicit
 * "the feature isn't configured yet" guard during rollout.
 *
 * Failure mode: every storage call is wrapped in try/catch. A KV
 * outage logs to server console and returns — the user's request
 * is never blocked by an audit-log failure.
 */

export type AuditAction =
    | "score.post"
    | "score.rejected"
    | "capsule.open"
    | "capsule.purchase"
    | "reroll.post"
    | "game.behavioral";

export interface AuditEvent {
    ts: number;
    action: AuditAction;
    username: string;
    ipHash: string;
    ua: string;
    meta?: Record<string, string | number | boolean>;
}

const PEPPER = process.env.AUDIT_LOG_PEPPER || "";
const PER_USER_CAP = 500;
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days — common fraud-log retention
const UA_MAX_LEN = 200;

/** Truncated SHA-256 of (ip + pepper). 16 hex chars = 64 bits of
 *  collision resistance, which is plenty for "same IP?" lookups while
 *  keeping the index compact. Returns "unknown" when the IP is missing
 *  or the pepper isn't configured. */
function hashIp(ip: string | null): string {
    if (!ip || !PEPPER) return "unknown";
    return createHash("sha256").update(ip + PEPPER).digest("hex").slice(0, 16);
}

/** Pulls the client IP from the proxy headers Vercel sets. Takes the
 *  leftmost x-forwarded-for entry (the real client; subsequent entries
 *  are proxy hops). Falls back to x-real-ip, then null. */
function getClientIp(req: Request): string | null {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
        const first = xff.split(",")[0].trim();
        if (first) return first;
    }
    const real = req.headers.get("x-real-ip");
    return real?.trim() || null;
}

/** KV keys. Separated per-user and per-IP indices so the admin UI can
 *  pivot either direction ("show me everything user X did" vs "show
 *  me every username seen on IP-hash Y"). */
export function auditUserKey(username: string): string {
    return `audit:user:${username.toLowerCase()}`;
}
export function auditIpKey(ipHash: string): string {
    return `audit:ip:${ipHash}`;
}

/**
 * Record an audit event. Fire-and-forget — callers can await for
 * sequencing reasons but should never block on this.
 *
 * Writes:
 *   1. `audit:user:<username>` — LPUSH of the event JSON, trimmed to
 *      the last PER_USER_CAP events, TTL 90d. Per-user timeline.
 *   2. `audit:ip:<ipHash>` — SADD of the username. Per-IP fan-out for
 *      surfacing shared devices. TTL 90d so cold IPs decay.
 */
export async function logAuditEvent(opts: {
    req: Request;
    username: string;
    action: AuditAction;
    meta?: Record<string, string | number | boolean>;
}): Promise<void> {
    // No pepper → helper is disabled. Lets you ship the wiring before
    // flipping the env flag, and acts as an emergency kill-switch.
    if (!PEPPER) return;

    try {
        const rawIp = getClientIp(opts.req);
        const ipHash = hashIp(rawIp);
        const ua = (opts.req.headers.get("user-agent") || "").slice(0, UA_MAX_LEN);
        const event: AuditEvent = {
            ts: Date.now(),
            action: opts.action,
            username: opts.username,
            ipHash,
            ua,
            meta: opts.meta,
        };

        const userKey = auditUserKey(opts.username);
        await kv.lpush(userKey, JSON.stringify(event));
        await kv.ltrim(userKey, 0, PER_USER_CAP - 1);
        await kv.expire(userKey, TTL_SECONDS);

        if (ipHash !== "unknown") {
            const ipKey = auditIpKey(ipHash);
            await kv.sadd(ipKey, opts.username.toLowerCase());
            await kv.expire(ipKey, TTL_SECONDS);
        }
    } catch (err) {
        // Audit-log failures must never propagate to the user. Log to
        // server console for SRE; the request keeps going.
        console.warn("[audit-log] write failed", err);
    }
}
