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
    // ── Event-set fields ────────────────────────────────────────────
    // Set when this pin is part of a multi-pin event (each set has 4
    // pins of different rarities, each worth different point values).
    // When eventSetId is absent the pin behaves as a stand-alone promo
    // (the OpenSea-style model).
    /** Groups this pin into a multi-pin event set with shared metadata
     *  (description, prize, endsAt) defined in PROMO_EVENT_SETS below. */
    eventSetId?: string;
    /** Point value awarded to the collector for pulling this pin.
     *  Sum of points across all pulls is the player's score on the
     *  event-set leaderboard. Defaults to 1 for single-pin events. */
    points?: number;
    /** Relative drop weight within the same eventSetId. Higher = more
     *  common. Drop is weighted, not uniform, so rarity drives both
     *  scarcity AND point value. */
    dropWeight?: number;
    /** Short human label for the rarity — "Common", "Rare", "Epic",
     *  "Legendary". Shown in the drawer's set view, no game logic. */
    rarityLabel?: string;
}

/**
 * Set-level metadata for multi-pin events. Each event has 4 pins
 * (the PromoBadge entries that share its id via `eventSetId`); this
 * record holds the shared display copy + lifecycle fields.
 */
export interface PromoEventSet {
    id: string;
    name: string;
    partnerName: string;
    /** Long-form copy shown in the EventDrawer hero. */
    description?: string;
    /** Event window label (e.g. "Through Jun 28 · 2026"). */
    eventWindow?: string;
    /** Prize note shown in the drawer header. */
    prizeNote?: string;
    /** Accent color for hero glow, ring, leaderboard accents. */
    accentColor?: string;
    /** UTC cutoff after which drops stop and the leaderboard finalizes. */
    endsAt?: string;
    /** Short tab label on the LeaderboardModal (keep under ~8 chars). */
    tabLabel: string;
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
    // ── Sample event set (PLACEHOLDER) ──────────────────────────────
    // 4 pins sharing eventSetId "promo_set_sample". Drop weights and
    // point values are illustrative — tune at brief time. Images
    // referenced under public/badges/promo/set/ — drop assets there
    // before flipping the env flag.
    {
        id: "promo_set_sample_common",
        name: "Sample Common",
        image: "/badges/promo/set/sample_common.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "Sample Partner",
        tabLabel: "Set",
        eventSetId: "promo_set_sample",
        points: 1,
        dropWeight: 70,
        rarityLabel: "Common",
    },
    {
        id: "promo_set_sample_rare",
        name: "Sample Rare",
        image: "/badges/promo/set/sample_rare.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "Sample Partner",
        tabLabel: "Set",
        eventSetId: "promo_set_sample",
        points: 3,
        dropWeight: 20,
        rarityLabel: "Rare",
    },
    {
        id: "promo_set_sample_epic",
        name: "Sample Epic",
        image: "/badges/promo/set/sample_epic.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "Sample Partner",
        tabLabel: "Set",
        eventSetId: "promo_set_sample",
        points: 8,
        dropWeight: 8,
        rarityLabel: "Epic",
    },
    {
        id: "promo_set_sample_legendary",
        name: "Sample Legendary",
        image: "/badges/promo/set/sample_legendary.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "Sample Partner",
        tabLabel: "Set",
        eventSetId: "promo_set_sample",
        points: 25,
        dropWeight: 2,
        rarityLabel: "Legendary",
    },
];

/**
 * Set-level metadata registry. Keyed by id matching the
 * PromoBadge.eventSetId on each member pin. Adding a new set =
 * one entry here + 4 PromoBadge entries above with matching
 * eventSetId.
 */
export const PROMO_EVENT_SETS: PromoEventSet[] = [
    {
        id: "promo_set_sample",
        name: "Sample Event",
        partnerName: "Sample Partner",
        description: "Placeholder copy for the next special event. Collect all 4 pins of varying rarity. Each pull earns points; total points decide the leaderboard. Top collectors win prizes.",
        eventWindow: "Sample Event · 2026",
        accentColor: "#FFAA55",
        // Update before launch. Format same as PromoBadge.endsAt above.
        endsAt: undefined,
        tabLabel: "Set",
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

/** Active promos (empty when the flag is off). Includes ended promos so
 *  the leaderboard tab + drawer can remain visible after the cutoff. */
export function getActivePromoBadges(): PromoBadge[] {
    return isPromoActive() ? PROMO_BADGES : [];
}

/** True once the promo's endsAt has passed. Promos without endsAt
 *  never expire. */
export function isPromoEnded(promo: PromoBadge): boolean {
    if (!promo.endsAt) return false;
    return Date.now() >= new Date(promo.endsAt).getTime();
}

/** Promos still actively dropping — env flag on AND not past endsAt.
 *  Used by capsule pre-roll, game-board pool, and floating-background
 *  visuals so a promo stops appearing the moment it ends, without
 *  needing the env flag flipped. */
export function getDroppablePromoBadges(): PromoBadge[] {
    return getActivePromoBadges().filter(p => !isPromoEnded(p));
}

/**
 * Pick a random droppable promo when the pre-roll hits. Returns null
 * if no promos are still dropping.
 *
 * For multi-partner concurrency: groups droppable promos by their
 * eventSetId (or self for standalone promos) into "units", picks a
 * unit uniformly, then weight-picks a pin within that unit using
 * dropWeight. This means a 4-pin set competes with a single-pin
 * standalone event as a unit, not 4-to-1.
 */
export function pickActivePromoBadge(): PromoBadge | null {
    const droppable = getDroppablePromoBadges();
    if (droppable.length === 0) return null;
    // Group by eventSetId; standalone promos form a group of one
    // keyed by their own id.
    const groups = new Map<string, PromoBadge[]>();
    for (const p of droppable) {
        const key = p.eventSetId ?? p.id;
        const arr = groups.get(key) ?? [];
        arr.push(p);
        groups.set(key, arr);
    }
    const keys = Array.from(groups.keys());
    const chosenKey = keys[Math.floor(Math.random() * keys.length)];
    const chosenGroup = groups.get(chosenKey)!;
    if (chosenGroup.length === 1) return chosenGroup[0];
    // Multi-pin set — weight-pick within.
    const totalWeight = chosenGroup.reduce((s, p) => s + (p.dropWeight ?? 0), 0);
    if (totalWeight <= 0) {
        return chosenGroup[Math.floor(Math.random() * chosenGroup.length)];
    }
    let r = Math.random() * totalWeight;
    for (const p of chosenGroup) {
        r -= p.dropWeight ?? 0;
        if (r <= 0) return p;
    }
    return chosenGroup[chosenGroup.length - 1];
}

/** Lookup by id. Server validates pending reveals against this. */
export function findPromoBadge(id: string): PromoBadge | undefined {
    return PROMO_BADGES.find(p => p.id === id);
}

/** KV key for a promo's collector leaderboard (sorted set of user → count). */
export function promoLeaderboardKey(promoId: string): string {
    return `promo:${promoId}:leaderboard`;
}

/** KV key for an event set's points-scored leaderboard. ZADD with the
 *  pin's points field on every collect; ZRANGE rev for the ranking. */
export function eventSetPointsKey(setId: string): string {
    return `event_set:${setId}:points`;
}

/** Lookup a set-level metadata record by id. */
export function findPromoEventSet(setId: string): PromoEventSet | undefined {
    return PROMO_EVENT_SETS.find(s => s.id === setId);
}

/** All pins belonging to a given event set, in the order they're
 *  defined in PROMO_BADGES (which is the order we want to render
 *  them — typically Common → Legendary). */
export function getEventSetPins(setId: string): PromoBadge[] {
    return PROMO_BADGES.filter(p => p.eventSetId === setId);
}

/** Resolve the event the EventDrawer + header pill should currently
 *  surface. Multi-pin sets win over standalone promos, and within
 *  standalone promos the still-dropping one wins over an ended one.
 *  Falls back to the first active promo so the OpenSea-style archive
 *  view keeps working after its endsAt. */
export type PrimaryEvent =
    | { kind: "standalone"; promo: PromoBadge }
    | { kind: "set"; set: PromoEventSet; pins: PromoBadge[] };

export function getPrimaryActiveEvent(): PrimaryEvent | null {
    const active = getActivePromoBadges();
    if (active.length === 0) return null;
    // Prefer a set whose pins are still dropping.
    const droppable = active.filter(p => !isPromoEnded(p));
    const droppableSetId = droppable.find(p => p.eventSetId)?.eventSetId;
    if (droppableSetId) {
        const set = findPromoEventSet(droppableSetId);
        if (set) {
            const pins = getEventSetPins(droppableSetId);
            return { kind: "set", set, pins };
        }
    }
    // Any standalone droppable promo next.
    const standaloneDroppable = droppable.find(p => !p.eventSetId);
    if (standaloneDroppable) return { kind: "standalone", promo: standaloneDroppable };
    // Fall back to any active set, including ended (archive view).
    const anySetId = active.find(p => p.eventSetId)?.eventSetId;
    if (anySetId) {
        const set = findPromoEventSet(anySetId);
        if (set) {
            const pins = getEventSetPins(anySetId);
            return { kind: "set", set, pins };
        }
    }
    // Fall back to any active standalone (including ended).
    const standalone = active.find(p => !p.eventSetId);
    if (standalone) return { kind: "standalone", promo: standalone };
    return null;
}

/** Weighted-pick a single pin from an event set using each pin's
 *  dropWeight. Falls back to uniform pick if weights are missing or
 *  sum to 0. Returns null when the set is empty. */
export function pickEventSetPin(setId: string): PromoBadge | null {
    const pins = getEventSetPins(setId);
    if (pins.length === 0) return null;
    const totalWeight = pins.reduce((s, p) => s + (p.dropWeight ?? 0), 0);
    if (totalWeight <= 0) {
        return pins[Math.floor(Math.random() * pins.length)];
    }
    let r = Math.random() * totalWeight;
    for (const p of pins) {
        r -= p.dropWeight ?? 0;
        if (r <= 0) return p;
    }
    return pins[pins.length - 1];
}
