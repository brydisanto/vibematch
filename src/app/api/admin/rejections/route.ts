import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/rejections?limit=200&days=14
 *
 * Reads the `score_rejections` zset (every replay-mismatched submission
 * since REPLAY_ENFORCEMENT=reject went live) and returns:
 *   recent     — newest-first list of individual rejections
 *   offenders  — aggregated counts per username, sorted desc, with the
 *                most-recent rejection snapshot inlined so admins can
 *                scan repeat-offender behavior without N round-trips
 *
 * Members of `score_rejections` are JSON snapshot strings written by
 * the /api/scores rejection path. Each contains seed + draftedBadgeIds
 * + full moveSequence so we can re-run the replay locally for false-
 * positive review.
 */
interface RejectionSnapshot {
    ts: number;
    username: string;
    matchId: string;
    mode: string;
    seed?: number;
    draftedBadgeIds?: string[] | null;
    submitted: number;
    computed: number;
    delta: number;
    movesConsumed: number;
    matchCount: number;
    maxCombo: number;
    totalCascades: number;
    bombsCreated: number;
    moveSequence?: unknown[];
}

interface OffenderRow {
    username: string;
    count: number;
    totalSubmittedDelta: number;
    largestDelta: number;
    largestDeltaSubmitted: number;
    largestDeltaTs: number;
    mostRecentTs: number;
    sample: Omit<RejectionSnapshot, "moveSequence">;
}

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(1000, Math.max(10, Number(url.searchParams.get("limit") || 200)));
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 14)));

    try {
        const cutoff = Date.now() - days * 86_400_000;
        // ZRANGE BYSCORE high → low so newest first. zrange's `byScore`
        // option needs min/max as strings; "+inf" / cutoff is the window.
        const rawRows = await kv.zrange("score_rejections", "+inf", cutoff, {
            byScore: true,
            rev: true,
            count: limit,
            offset: 0,
        }) as unknown[];

        const recent: RejectionSnapshot[] = [];
        for (const raw of rawRows) {
            if (typeof raw !== "string") continue;
            try {
                const snap = JSON.parse(raw) as RejectionSnapshot;
                if (!snap || typeof snap.ts !== "number") continue;
                // Drop the heavy moveSequence from the API response —
                // admins don't need 30 moves per row in the table view.
                // Recovery script can re-fetch the per-user snapshot key
                // if a contested rejection needs full inspection.
                const { moveSequence: _moveSequence, ...lite } = snap;
                void _moveSequence;
                recent.push(lite as RejectionSnapshot);
            } catch {
                continue;
            }
        }

        const byUser = new Map<string, OffenderRow>();
        for (const r of recent) {
            const u = r.username.toLowerCase();
            const absDelta = Math.abs(r.delta);
            let row = byUser.get(u);
            if (!row) {
                row = {
                    username: r.username,
                    count: 0,
                    totalSubmittedDelta: 0,
                    largestDelta: 0,
                    largestDeltaSubmitted: 0,
                    largestDeltaTs: 0,
                    mostRecentTs: 0,
                    sample: r,
                };
                byUser.set(u, row);
            }
            row.count += 1;
            row.totalSubmittedDelta += absDelta;
            if (absDelta > row.largestDelta) {
                row.largestDelta = absDelta;
                row.largestDeltaSubmitted = r.submitted;
                row.largestDeltaTs = r.ts;
            }
            if (r.ts > row.mostRecentTs) {
                row.mostRecentTs = r.ts;
                row.sample = r;
            }
        }

        const offenders = Array.from(byUser.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.largestDelta - a.largestDelta;
        });

        return NextResponse.json({
            windowDays: days,
            scanned: rawRows.length,
            totalRejections: recent.length,
            uniqueOffenders: offenders.length,
            recent,
            offenders,
        });
    } catch (err) {
        console.error("[admin/rejections] error", err);
        return NextResponse.json({ error: "Failed to load rejections" }, { status: 500 });
    }
}
