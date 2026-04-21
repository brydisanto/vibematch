import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BONUS_CAPSULES = 3;

interface PinBookLite {
    pins: Record<string, { count: number; firstEarned: string; lastPulled?: string }>;
    capsules: number;
    totalOpened: number;
    totalEarned: number;
}

/**
 * Daily Champion bonus — the #1 player on each day's Daily Challenge leaderboard
 * gets +3 capsules credited the following day, once per day. This is separate
 * from the sticky `daily_champ` achievement (which still fires one-time at
 * capsules: 3 for your first-ever win) — champions keep earning recurring
 * capsules every day they repeat the #1 finish.
 *
 * GET:
 *   - Looks up yesterday's daily leaderboard.
 *   - If the authed user is top of that list AND `daily_champ_bonus:<user>:<date>`
 *     hasn't been claimed yet, atomically mark it claimed (NX) and credit the
 *     capsules to their pinbook.
 *   - Returns { claimed, capsules, date } on a fresh claim, or
 *     { claimed: false } if the user didn't win or already claimed.
 *
 * Idempotent: hitting this multiple times in a day after winning credits
 * capsules once. NX-lock prevents races between tabs.
 */
export async function GET() {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = (session.username as string).toLowerCase();

    try {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const dateStr = yesterday.toISOString().split("T")[0];
        const leaderboardKey = `daily_leaderboard:${dateStr}`;

        // Who was #1 on yesterday's daily?
        const top = (await kv.zrange(leaderboardKey, 0, 0, { rev: true })) as string[];
        if (!top || top.length === 0 || top[0].toLowerCase() !== username) {
            return NextResponse.json({ claimed: false, reason: "not-winner" });
        }

        // Atomic claim marker — NX ensures only the first request through
        // actually awards capsules even under concurrent requests. 8-day TTL
        // (covers any late claim + a week of safety; the user must claim
        // within a few days of their win).
        const claimKey = `daily_champ_bonus:${username}:${dateStr}`;
        const acquired = await kv.set(claimKey, "1", { nx: true, ex: 86400 * 8 });
        if (!acquired) {
            return NextResponse.json({ claimed: false, reason: "already-claimed", date: dateStr });
        }

        // Award capsules to pinbook
        const pinKey = `pinbook:${username}`;
        const pinbook = ((await kv.get(pinKey)) as PinBookLite | null) || {
            pins: {},
            capsules: 0,
            totalOpened: 0,
            totalEarned: 0,
        };
        pinbook.capsules += BONUS_CAPSULES;
        pinbook.totalEarned += BONUS_CAPSULES;
        await kv.set(pinKey, pinbook);

        return NextResponse.json({
            claimed: true,
            capsules: BONUS_CAPSULES,
            date: dateStr,
            totalCapsules: pinbook.capsules,
        });
    } catch (error) {
        console.error("daily-champ-bonus error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
