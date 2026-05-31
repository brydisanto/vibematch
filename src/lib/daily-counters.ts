import { kv } from "@vercel/kv";
import { getEasternDailyKey } from "@/lib/daily-window";

/**
 * Per-user daily activity counters surfaced in the admin user-profile page.
 * Keys are shared with the existing DailyTracker schema in
 * /api/pinbook/route.ts — these counters live alongside classicPlays and
 * bonusPrizeGames on `pinbook:{username}:daily:{easternKey}`.
 *
 * All bumps are best-effort: wrapped in try/catch so a counter failure
 * can't break the calling action's success path.
 */
export type DailyCounterField =
    | "capsulesEarned"
    | "capsulesOpened"
    | "pinsFound"
    | "newPinsFound";

function todayKey(username: string): string {
    return `pinbook:${username.toLowerCase()}:daily:${getEasternDailyKey()}`;
}

export async function bumpDailyCounter(
    username: string,
    field: DailyCounterField,
    amount: number = 1,
): Promise<void> {
    if (amount <= 0) return;
    try {
        const key = todayKey(username);
        const today = getEasternDailyKey();
        const existing = (await kv.get(key)) as Record<string, unknown> | null;
        // Initialize a fresh tracker if there's nothing for today yet so
        // the counters work even on a user's first action of the day.
        const base = existing && existing.date === today
            ? existing
            : { classicPlays: 0, date: today, bonusPrizeGames: 0 };
        const current = Number(base[field]) || 0;
        const next = { ...base, [field]: current + amount };
        // 95-day TTL — matches the audit-log retention and lets the
        // admin daily-activity chart show the full 90-day window
        // without losing historical counters. (Previous 2-day TTL was
        // sized for the cap-enforcement use case and silently dropped
        // chart data older than two days.)
        await kv.set(key, next, { ex: 86400 * 95 });
    } catch (e) {
        console.error(`[bumpDailyCounter] failed for ${username} ${field} +${amount}:`, e);
    }
}
