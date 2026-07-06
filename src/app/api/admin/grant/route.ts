import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";
import { getEasternDailyKey } from "@/lib/daily-window";
import { activeEligibilityWindow } from "@/lib/promo-badges";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/grant
 *
 * Admin-only endpoint to credit a user with bonus plays (today's daily
 * tracker) or pin capsules (their pinbook). Each call writes an audit
 * entry to `admin_grants:<username>` so we have a forensic trail.
 *
 * Body:
 *   { username: string, type: "plays" | "capsules", amount: number, note?: string }
 *
 * Returns: { ok: true, balance: { plays?: number, capsules?: number } }
 *
 * Notes:
 * - "plays" credits today's tracker only. There's no concept of "carry
 *   over" — if the player has 0 plays left today, +5 plays gives them
 *   5 plays right now; tomorrow's cap resets independently.
 * - "capsules" increments BOTH `capsules` (the unopened balance) AND
 *   `totalEarned` (lifetime counter). It does NOT touch `totalOpened`.
 * - Caps amount at 100 per call to prevent fat-finger disasters.
 */

interface PinbookData {
    capsules?: number;
    totalEarned?: number;
    totalOpened?: number;
    pins?: Record<string, { count: number; firstEarned: string }>;
    /** Per-event count of capsules eligible to roll event pins.
     *  Mirror of the field in the pinbook route type — grant path
     *  keeps it in sync so admin-granted capsules can drop event
     *  pins when the event window is open. */
    eligibleByEvent?: Record<string, number>;
}

interface DailyTracker {
    classicPlays: number;
    date: string;
    bonusPrizeGames?: number;
}

interface GrantAuditEntry {
    timestamp: number;
    admin: string;
    type: "plays" | "capsules";
    amount: number;
    note?: string;
}

const MAX_AMOUNT_PER_CALL = 100;

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { username?: string; type?: string; amount?: number; note?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const username = (body.username || "").toLowerCase().trim();
    const type = body.type;
    const amount = Number(body.amount);
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : undefined;

    if (!username) {
        return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }
    if (type !== "plays" && type !== "capsules") {
        return NextResponse.json({ error: "type must be 'plays' or 'capsules'" }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be a positive integer" }, { status: 400 });
    }
    if (amount > MAX_AMOUNT_PER_CALL) {
        return NextResponse.json({
            error: `amount exceeds per-call cap of ${MAX_AMOUNT_PER_CALL}. Issue multiple grants if you really need more.`,
        }, { status: 400 });
    }

    // Verify the user exists. Don't accidentally create accounts via grants.
    const auth = await kv.get(`user_auth:${username}`);
    if (!auth) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const balance: { plays?: number; capsules?: number } = {};

    if (type === "plays") {
        const today = getEasternDailyKey();
        const trackerKey = `pinbook:${username}:daily:${today}`;
        const existing = (await kv.get(trackerKey)) as DailyTracker | null;
        const tracker: DailyTracker = existing && existing.date === today
            ? { ...existing, bonusPrizeGames: (existing.bonusPrizeGames || 0) + amount }
            : { classicPlays: 0, date: today, bonusPrizeGames: amount };
        // 2-day TTL matches incrementClassicPlays — daily trackers
        // shouldn't accumulate forever in KV across months of play.
        await kv.set(trackerKey, tracker, { ex: 86400 * 2 });
        balance.plays = tracker.bonusPrizeGames || 0;
    } else {
        const pinbookKey = `pinbook:${username}`;
        const existing = ((await kv.get(pinbookKey)) as PinbookData | null) || {};
        const capsules = (existing.capsules || 0) + amount;
        const totalEarned = (existing.totalEarned || 0) + amount;
        // If an event window is currently open, credit event
        // eligibility on the grant so the new capsules can drop
        // event pins. Pre-event and no-event states return null and
        // this block is skipped — matching the earn / open credit
        // paths in the pinbook route.
        const elig = activeEligibilityWindow();
        const eligibleByEvent = { ...(existing.eligibleByEvent || {}) };
        if (elig) {
            eligibleByEvent[elig.eventKey] = (eligibleByEvent[elig.eventKey] || 0) + amount;
        }
        const next: PinbookData = {
            ...existing,
            capsules,
            totalEarned,
            // Preserve pins map and totalOpened if present
            pins: existing.pins || {},
            totalOpened: existing.totalOpened || 0,
            eligibleByEvent,
        };
        await kv.set(pinbookKey, next);
        balance.capsules = capsules;
    }

    // Audit log: zset keyed by timestamp so we can read newest-first.
    const auditEntry: GrantAuditEntry = {
        timestamp: Date.now(),
        admin,
        type,
        amount,
        note,
    };
    try {
        await kv.zadd(`admin_grants:${username}`, {
            score: auditEntry.timestamp,
            member: JSON.stringify(auditEntry),
        });
    } catch (e) {
        // Audit failure shouldn't block the grant — log and continue.
        console.error("[admin/grant] audit write failed", e);
    }

    console.log(`[admin/grant] ${admin} granted ${amount} ${type} to ${username}${note ? ` (note: ${note})` : ""}`);

    return NextResponse.json({ ok: true, balance });
}

/**
 * GET /api/admin/grant?username=<u>
 * Returns the audit trail of grants for a user (newest first, capped at 50).
 */
export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const username = (searchParams.get("username") || "").toLowerCase().trim();
    if (!username) {
        return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    try {
        const raw = (await kv.zrange(`admin_grants:${username}`, 0, 49, { rev: true })) as string[];
        const entries: GrantAuditEntry[] = raw.map(r => {
            try {
                return typeof r === "string" ? JSON.parse(r) : r;
            } catch {
                return null;
            }
        }).filter(Boolean) as GrantAuditEntry[];
        return NextResponse.json({ entries });
    } catch (e) {
        console.error("[admin/grant] audit read failed", e);
        return NextResponse.json({ entries: [] });
    }
}
