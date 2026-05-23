import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { auditUserKey, type AuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit/user?username=<u>&limit=<n>
 *
 * Returns the per-user audit timeline (most recent first). Events were
 * pushed onto a Redis list via LPUSH at write time, so index 0 is the
 * newest entry.
 *
 * Query params:
 *   - username (required) — case-insensitive lookup
 *   - limit    (optional) — 1-500, default 200
 *
 * Response: { username, events: AuditEvent[], totalReturned, capped }
 *   capped=true means more events likely exist beyond the limit
 *   (we don't compute LLEN because that's a separate round trip and
 *   the per-user cap is 500; you can always re-query with limit=500).
 */
export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const username = (searchParams.get("username") || "").trim();
    if (!username) {
        return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }
    const rawLimit = parseInt(searchParams.get("limit") || "200", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(500, Math.max(1, rawLimit)) : 200;

    try {
        const raw = await kv.lrange(auditUserKey(username), 0, limit - 1);
        // @vercel/kv auto-parses JSON values stored as strings, but defensively
        // accept both already-parsed objects and raw JSON strings.
        const events: AuditEvent[] = (raw || [])
            .map((entry: unknown) => {
                if (typeof entry === "string") {
                    try { return JSON.parse(entry) as AuditEvent; } catch { return null; }
                }
                if (entry && typeof entry === "object") return entry as AuditEvent;
                return null;
            })
            .filter((e): e is AuditEvent => !!e);

        return NextResponse.json({
            username,
            events,
            totalReturned: events.length,
            capped: events.length === limit,
        });
    } catch (err) {
        console.error("[audit/user] KV read failed", err);
        return NextResponse.json({ error: "Read failed" }, { status: 500 });
    }
}
