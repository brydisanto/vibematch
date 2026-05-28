import type { Badge, BadgeTier } from "./badges";

/**
 * Promotional / partner pins.
 *
 * Promo pins are time-bound badges that:
 *  - Appear in the game-board tile pool (treated as blue/Common tier).
 *  - Appear in the home-screen FloatingBadges background.
 *  - Drop from capsules at PROMO_DROP_RATE, INDEPENDENT of the normal
 *    tier roll — they don't dilute the Common bucket.
 *  - Are tracked in a SEPARATE KV path (zset `promo:<id>:leaderboard`)
 *    and never written to the user's Pinbook pin map.
 *  - Power a 5th leaderboard tab in `LeaderboardModal` (shown only
 *    while the promo is active; hidden after partnership ends).
 *
 * Lifecycle:
 *  1. Add a `PromoBadge` entry below + drop the image asset under public/.
 *  2. Flip `NEXT_PUBLIC_PROMO_ACTIVE=true` in Vercel env to activate.
 *     The flag is read by both server (capsule pre-roll) and client
 *     (game-board pool, FloatingBadges, leaderboard tab visibility).
 *  3. When the partnership ends, flip the env var back to false. Promo
 *     stops appearing everywhere; historical counts persist in KV but
 *     the leaderboard tab disappears from the modal.
 */
export interface PromoBadge extends Badge {
    isPromo: true;
    /** Partner display name, shown on the leaderboard tab + reveal copy. */
    partnerName: string;
    /** Short tab label on the LeaderboardModal (keep it under ~8 chars). */
    tabLabel: string;
    /**
     * Long-form event description for the EventDrawer hero. Optional —
     * the drawer falls back to a generic line if missing.
     */
    description?: string;
    /** Optional event window label, e.g. "Through May 31" or "Launch Event 2026". */
    eventWindow?: string;
    /** Optional prize note shown in the drawer header, e.g. "Top 10 win 1 ETH". */
    prizeNote?: string;
    /**
     * Tint applied to the EventDrawer hero glow + accent borders.
     * Defaults to gold; partners with distinct colors should override.
     */
    accentColor?: string;
    /**
     * Event end timestamp (ISO 8601 string). When set, the EventDrawer
     * renders a live countdown to this moment and hides itself when
     * the time passes. Use Z-suffixed UTC for clarity — convert from
     * Eastern at definition time (June 8 noon EDT = 16:00 UTC).
     */
    endsAt?: string;
}

export const PROMO_BADGES: PromoBadge[] = [
    {
        id: "promo_opensea",
        name: "Aye Aye, Captain!",
        // Drop the partnership asset at public/badges/promo/opensea.webp
        // (or update this path) before flipping NEXT_PUBLIC_PROMO_ACTIVE.
        image: "/badges/promo/opensea.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "OpenSea",
        tabLabel: "Event",
        description: "OpenSea co-designed a custom pin with us as sponsors of the Vibeathon. Look for them in capsules and collect as many as possible. #1 on the leaderboard wins a special surprise.",
        eventWindow: "Launch Event · 2026",
        accentColor: "#4A9EFF",
        // June 8 2026, 12:00 PM Eastern. June is on EDT (UTC-4), so 16:00 UTC.
        endsAt: "2026-06-08T16:00:00Z",
    },
];

/**
 * Drop chance per capsule open. Independent of the normal tier roll — when
 * this hits, we skip the tier roll entirely and award the promo. 3%
 * puts the promo just below a typical Common pin (~4% individually) so
 * it feels like a real partnership presence in the haul without
 * dominating it. Tunable from 0.005 (rare) → 0.05 (very frequent)
 * without touching anything else.
 */
export const PROMO_DROP_RATE = 0.03;

/**
 * Single source of truth for "is the promo currently live?". Read by:
 *  - Server (api/pinbook open handler — gates the pre-roll)
 *  - Server (api/promo/leaderboard — gates whether endpoint serves)
 *  - Client (LeaderboardModal — gates 5th tab visibility)
 *  - Client (selectGameBadges — gates inclusion in game-board pool)
 *  - Client (FloatingBadges — gates inclusion in landing background)
 *
 * Using NEXT_PUBLIC_* so the same flag is readable on both sides without
 * a separate config dance. Flip in Vercel env and redeploy to activate.
 */
export function isPromoActive(): boolean {
    return process.env.NEXT_PUBLIC_PROMO_ACTIVE === "true";
}

/** Active promos (empty when the flag is off). */
export function getActivePromoBadges(): PromoBadge[] {
    return isPromoActive() ? PROMO_BADGES : [];
}

/**
 * Pick a random active promo when the pre-roll hits. Returns null if no
 * promos are active. With a single active promo this is deterministic,
 * but the function shape supports multi-partner promos later.
 */
export function pickActivePromoBadge(): PromoBadge | null {
    const active = getActivePromoBadges();
    if (active.length === 0) return null;
    return active[Math.floor(Math.random() * active.length)];
}

/** Lookup by id. Server validates pending reveals against this. */
export function findPromoBadge(id: string): PromoBadge | undefined {
    return PROMO_BADGES.find(p => p.id === id);
}

/** KV key for a promo's collector leaderboard (sorted set of user → count). */
export function promoLeaderboardKey(promoId: string): string {
    return `promo:${promoId}:leaderboard`;
}
