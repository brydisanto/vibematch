/**
 * Daily window helpers.
 *
 * Pin Drop's "daily" reset (Daily Challenge, daily plays cap, daily
 * leaderboard, streak counting) rolls over at NOON America/New_York,
 * not midnight UTC. America/New_York is used (not a fixed UTC-5 offset)
 * so the reset clock follows DST automatically — players see noon on
 * their wall clock year-round, regardless of EST vs EDT.
 *
 * Naming convention: a "daily window" is the 24-hour stretch from
 * noon ET on day N to noon ET on day N+1, and is keyed by the start
 * date (e.g. the window that starts at noon ET on 2026-05-20 is keyed
 * "2026-05-20" until noon ET 2026-05-21). A player checking in at
 * 9 AM ET on 2026-05-21 is still in the "2026-05-20" window.
 *
 * Used as the source of truth for:
 *   - daily_played:<u>:<date>
 *   - daily_earned:<u>:<date>
 *   - daily_bonus:<u>:<date>
 *   - daily_champ_bonus:<u>:<date>
 *   - daily_scored:<u>:<date>
 *   - daily_leaderboard:<date>
 *   - matchstats:<u>:daily:<date>
 *   - pinbook:<u>:daily:<date>     (plays-per-day cap tracker)
 *   - streak:<u>                    (date comparisons)
 *
 * Don't construct these date strings inline anywhere else — always
 * call getEasternDailyKey() so the window boundary stays consistent.
 */

const ET_TIMEZONE = 'America/New_York';

/**
 * Returns the daily window key (YYYY-MM-DD) the given timestamp falls
 * into. The window starts at noon ET on the labeled date.
 *
 * Examples (assuming non-DST math for simplicity):
 *   2026-05-20 14:00 ET → "2026-05-20" (1 PM, after noon ET 5-20)
 *   2026-05-21 09:00 ET → "2026-05-20" (still pre-noon, in 5-20 window)
 *   2026-05-21 12:00 ET → "2026-05-21" (exactly noon — new window)
 *   2026-05-21 13:00 ET → "2026-05-21" (after noon ET 5-21)
 */
export function getEasternDailyKey(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: ET_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
    // Intl can emit "24" for the hour part at midnight in some locales;
    // both "00" and "24" mean midnight, both are pre-noon.
    const hourRaw = get('hour');
    const hour = hourRaw === '24' ? 0 : parseInt(hourRaw, 10);
    if (hour < 12) {
        // Still in yesterday's window (which started at noon ET the day before).
        return shiftIsoDate(dateStr, -1);
    }
    return dateStr;
}

/**
 * Returns the Date instance representing the next noon ET reset boundary
 * after `now`. Used for client-side countdowns ("Resets in 4h 12m").
 *
 * Handles DST automatically. On the "spring forward" day this returns
 * 11 hours ahead from midnight ET; on "fall back" it returns 13.
 */
export function getNextNoonEastern(now: Date = new Date()): Date {
    // Read the current ET wall clock by constructing a Date in the local
    // timezone whose components MATCH the ET wall clock. Subtracting
    // its getTime() from now.getTime() gives the local-to-ET offset; we
    // apply the same offset to the target moment to convert it back.
    const nyWallString = now.toLocaleString('en-US', { timeZone: ET_TIMEZONE });
    const nyWall = new Date(nyWallString);
    const offsetToEt = now.getTime() - nyWall.getTime();

    const target = new Date(nyWall);
    target.setHours(12, 0, 0, 0);
    if (nyWall.getTime() >= target.getTime()) {
        // Past noon ET already → roll to tomorrow's noon.
        target.setDate(target.getDate() + 1);
    }
    return new Date(target.getTime() + offsetToEt);
}

/** YYYY-MM-DD arithmetic that avoids local-timezone drift. */
function shiftIsoDate(isoDate: string, days: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/** Convenience: returns yesterday's daily key (for the Daily Champion check). */
export function getEasternYesterdayKey(now: Date = new Date()): string {
    return shiftIsoDate(getEasternDailyKey(now), -1);
}
