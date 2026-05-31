import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";
import { getEasternDailyKey } from "@/lib/daily-window";
import { classicCapsulesForScore, frenzyCapsulesForScore } from "@/lib/gameEngine";

export const dynamic = "force-dynamic";

// 5-minute in-memory cache. Aggregation scans hundreds of KV keys; running
// it on every page render would be wasteful given the data only changes
// on game completion / tx settle. Admins also tend to refresh frequently.
let cached: { at: number; data: DailyStats[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface DailyStats {
    date: string;
    dau: number;             // unique users with any activity that day
    newUsers: number;        // user_auth records with createdAt on this day
    classicPlays: number;    // PURE classic plays (combined trackers minus frenzy subset)
    frenzyPlays: number;     // frenzy plays (subset of the combined plays counter)
    capsulesEarned: number;  // sum of capsules awarded across all sources
    rerolls: number;         // count of reroll transactions
    vibestrSpent: number;    // sum of all tx amounts
}

async function scanKeys(pattern: string, limit: number = 50000): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const result = (await kv.scan(cursor, { match: pattern, count: 200 })) as [string | number, string[]];
        cursor = result[0];
        keys.push(...result[1]);
        if (keys.length >= limit) break;
    } while (cursor !== 0 && cursor !== "0");
    return keys;
}

/**
 * Aggregates per-day stats across all users for the admin line chart.
 *   - Activity (classicPlays, capsulesEarned) come from the per-user daily
 *     trackers at `pinbook:<user>:daily:<easternKey>`.
 *   - VIBESTR spend + rerolls come from `tx:*:processed`, bucketed by the
 *     Eastern day of the tx timestamp.
 *   - DAU is the count of unique users with any signal that day (tracker
 *     row OR tx).
 *
 * Returns the last `days` (default 30) days, newest last so chart x-axis
 * goes left-to-right oldest-to-newest.
 */
export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const daysParam = Number(url.searchParams.get("days") || 30);
    const days = Number.isFinite(daysParam) ? Math.min(180, Math.max(7, Math.floor(daysParam))) : 30;

    // Serve from cache if fresh AND the requested window matches.
    if (cached && Date.now() - cached.at < CACHE_TTL_MS && cached.data.length === days) {
        return NextResponse.json({ stats: cached.data, cachedAt: cached.at });
    }

    try {
        // --- Aggregate per-user daily trackers ---
        // Keys: pinbook:<user>:daily:<easternKey>
        const dailyKeys = await scanKeys("pinbook:*:daily:*");
        const buckets = new Map<string, {
            users: Set<string>;
            newUsers: number;
            classicPlays: number;
            frenzyPlays: number;
            capsulesEarned: number;
            vibestrSpent: number;
            rerolls: number;
        }>();
        const ensure = (date: string) => {
            let b = buckets.get(date);
            if (!b) {
                b = { users: new Set(), newUsers: 0, classicPlays: 0, frenzyPlays: 0, capsulesEarned: 0, vibestrSpent: 0, rerolls: 0 };
                buckets.set(date, b);
            }
            return b;
        };

        // Daily trackers have a 95-day TTL since 2026-05-31 (was 2d), so
        // recent days have a fresh tracker per (user, date) for the cap
        // enforcement path. We still read them when present because the
        // capsulesEarned counter is incremented at the exact moment a
        // capsule is awarded — more accurate than the gamelog-derived
        // approximation below.
        const trackerHits = new Set<string>(); // `<user>:<date>` pairs that came from a tracker
        for (const key of dailyKeys) {
            const parts = key.split(":");
            if (parts.length < 4 || parts[2] !== "daily") continue;
            const username = parts[1];
            const date = parts.slice(3).join(":");
            const data = (await kv.get(key)) as Record<string, unknown> | null;
            if (!data) continue;
            const b = ensure(date);
            b.users.add(username);
            const combined = Number(data.classicPlays) || 0;
            const frenzy = Number(data.frenzyPlays) || 0;
            b.classicPlays += Math.max(0, combined - frenzy);
            b.frenzyPlays += frenzy;
            b.capsulesEarned += Number(data.capsulesEarned) || 0;
            trackerHits.add(`${username}:${date}`);
        }

        // --- Backfill from gamelog for days the tracker has expired ---
        // gamelog:<user> zsets have no TTL so they keep the full history.
        // For any (user, date) pair without a fresh tracker we derive
        // classicPlays / frenzyPlays / DAU directly from the gamelog
        // entries, and approximate capsulesEarned by running the same
        // capsule ladder the server uses. Approximation caveats:
        //   - daily cap (first 10 games + bonuses) is ignored — bonus-
        //     game history isn't available retroactively, so this can
        //     slightly over-count capsules earned on days where players
        //     played past the cap. Fine for trend lines.
        //   - Daily Challenge doubles capsules; we double here too.
        const gamelogKeys = await scanKeys("gamelog:*");
        for (const key of gamelogKeys) {
            const username = key.split(":")[1];
            if (!username) continue;
            const entries = (await kv.zrange(key, 0, -1)) as string[];
            for (const raw of entries) {
                try {
                    const e = typeof raw === "string" ? JSON.parse(raw) : raw;
                    const ts = Number(e?.timestamp);
                    if (!Number.isFinite(ts) || ts <= 0) continue;
                    const date = getEasternDailyKey(new Date(ts));
                    const mode = String(e?.gameMode || "classic");
                    const score = Number(e?.score) || 0;
                    const b = ensure(date);
                    b.users.add(username);
                    // Only fill plays/capsules from gamelog when there's
                    // no fresh tracker for this (user, date). Tracker
                    // counters are authoritative when present.
                    if (!trackerHits.has(`${username}:${date}`)) {
                        if (mode === "frenzy") {
                            b.frenzyPlays += 1;
                            b.capsulesEarned += frenzyCapsulesForScore(score);
                        } else if (mode === "classic") {
                            b.classicPlays += 1;
                            b.capsulesEarned += classicCapsulesForScore(score);
                        } else if (mode === "daily") {
                            // Daily doesn't count toward classic/frenzy plays
                            // but does award double capsules.
                            b.capsulesEarned += classicCapsulesForScore(score) * 2;
                        }
                    }
                } catch {
                    continue;
                }
            }
        }

        // --- Aggregate registrations (new users per day) ---
        // user_auth records carry createdAt as an ISO timestamp at registration.
        // Bucket each by its Eastern day. Records pre-dating createdAt field
        // (legacy) are skipped — they don't show up on the chart, which is
        // the right behavior since we can't know their actual signup day.
        const authKeys = await scanKeys("user_auth:*");
        for (const key of authKeys) {
            const auth = await kv.get(key) as { createdAt?: string } | null;
            if (!auth?.createdAt) continue;
            const ts = Date.parse(auth.createdAt);
            if (!Number.isFinite(ts) || ts <= 0) continue;
            const date = getEasternDailyKey(new Date(ts));
            const b = ensure(date);
            b.newUsers += 1;
        }

        // --- Aggregate transactions ---
        const txKeys = await scanKeys("tx:*:processed");
        for (const key of txKeys) {
            const raw = await kv.get(key);
            if (!raw) continue;
            try {
                const data = typeof raw === "string" ? JSON.parse(raw) : raw;
                const ts = Number(data?.timestamp);
                if (!Number.isFinite(ts) || ts <= 0) continue;
                const date = getEasternDailyKey(new Date(ts));
                const amount = parseFloat(data?.amount || "0");
                const b = ensure(date);
                if (data?.username) b.users.add(String(data.username).toLowerCase());
                if (Number.isFinite(amount) && amount > 0) b.vibestrSpent += amount;
                if (data?.type === "reroll") b.rerolls += 1;
            } catch {
                continue;
            }
        }

        // --- Materialize the last `days` days, filling gaps with zeros ---
        const today = getEasternDailyKey();
        const window: string[] = [];
        const todayDate = new Date(`${today}T12:00:00-04:00`); // anchor at noon ET to dodge DST edges
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() - i);
            window.push(getEasternDailyKey(d));
        }

        const stats: DailyStats[] = window.map(date => {
            const b = buckets.get(date);
            return {
                date,
                dau: b ? b.users.size : 0,
                newUsers: b ? b.newUsers : 0,
                classicPlays: b ? b.classicPlays : 0,
                frenzyPlays: b ? b.frenzyPlays : 0,
                capsulesEarned: b ? b.capsulesEarned : 0,
                rerolls: b ? b.rerolls : 0,
                vibestrSpent: b ? Number(b.vibestrSpent.toFixed(2)) : 0,
            };
        });

        cached = { at: Date.now(), data: stats };
        return NextResponse.json({ stats, cachedAt: cached.at });
    } catch (e) {
        console.error("Admin daily stats error:", e);
        return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
    }
}
