import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { auditIpKey } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit/ip?hash=<ipHash>
 *
 * Returns the list of usernames that have ever logged an event from the
 * given IP hash (within the 90-day TTL). This is the fanout view used to
 * surface shared-device / multi-account suspects.
 *
 * Response: { hash, usernames: string[], count }
 */
export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const hash = (searchParams.get("hash") || "").trim();
    if (!hash) {
        return NextResponse.json({ error: "Missing hash" }, { status: 400 });
    }
    // Light defensive validation — every legit hash is hex, ≤16 chars.
    // Reject obviously malformed input so the admin UI can't accidentally
    // send a wildcard key.
    if (!/^[a-f0-9]{1,32}$/i.test(hash)) {
        return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
    }

    try {
        const members = (await kv.smembers(auditIpKey(hash))) as string[];
        const usernames = members.slice().sort();
        return NextResponse.json({
            hash,
            usernames,
            count: usernames.length,
        });
    } catch (err) {
        console.error("[audit/ip] KV read failed", err);
        return NextResponse.json({ error: "Read failed" }, { status: 500 });
    }
}
