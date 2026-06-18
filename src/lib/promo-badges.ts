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
    /** Partner display name, shown on the leaderboard tab + reveal copy.
     *  Optional for Pin Drop's own in-house events that don't have a
     *  branded partner. When absent, the partner-name line above the
     *  event title is hidden. */
    partnerName?: string;
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
    /** Partner display name (optional for in-house Pin Drop events). */
    partnerName?: string;
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
    /** UTC moment the event opens. When set, only capsules earned at or
     *  after this timestamp are eligible to roll set pins — pre-event
     *  hoarded capsules can be opened freely but won't yield event pins.
     *  Undefined disables the lockout (scaffold / testing mode: every
     *  capsule is eligible). */
    startsAt?: string;
    /** Short tab label on the LeaderboardModal (keep under ~8 chars). */
    tabLabel: string;
    /** Optional hero image for the drawer + header pill (large square or
     *  portrait works best). When absent the drawer falls back to the
     *  highest-points pin from the set, but a dedicated character /
     *  partner asset usually reads better than reusing a pin tile. */
    heroImage?: string;
    /** Bonus points awarded per FULL set completed (one of every pin in
     *  the set). Stacks multiplicatively: 3 of each pin = 3 full sets =
     *  3 × setBonusPoints in bonus on top of per-pin points. Defaults to
     *  0 (no bonus) so single-pin events and lottery-style sets opt in
     *  explicitly. */
    setBonusPoints?: number;
    /** Hard cap on the per-user leaderboard score. Once reached, the
     *  zset entry stops climbing — any further collects are still
     *  credited to per-pin counters but don't move the leaderboard
     *  score. Use when the event ends in a raffle of all "maxed"
     *  collectors rather than a strict ranking. Omit for uncapped. */
    scoreCap?: number;
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
    // ── Craig's Bubble Gum Blast (PLACEHOLDER pin art) ──────────────
    // Pin Drop's first in-house event set. 4 pins of escalating rarity
    // sharing eventSetId "craigs_bubble_gum_blast". All four currently
    // reuse the same gvcday placeholder art — swap each entry's image
    // for the final art before launch. Drop weights and point values
    // are first-pass; tune from playtests.
    {
        id: "craigs_bubble_gum_blast_common",
        name: "Bubble Gum",
        image: "/badges/promo/set/gvcday.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        tabLabel: "Set",
        eventSetId: "craigs_bubble_gum_blast",
        points: 1,
        dropWeight: 70,
        rarityLabel: "Common",
    },
    {
        id: "craigs_bubble_gum_blast_rare",
        name: "Pink Bubble Gum",
        image: "/badges/promo/set/gvcday.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        tabLabel: "Set",
        eventSetId: "craigs_bubble_gum_blast",
        points: 2,
        dropWeight: 20,
        rarityLabel: "Rare",
    },
    {
        id: "craigs_bubble_gum_blast_epic",
        name: "Big Bubble Gum",
        image: "/badges/promo/set/gvcday.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        tabLabel: "Set",
        eventSetId: "craigs_bubble_gum_blast",
        points: 5,
        dropWeight: 8,
        rarityLabel: "Epic",
    },
    {
        id: "craigs_bubble_gum_blast_legendary",
        name: "Giga Bubble Gum",
        image: "/badges/promo/set/gvcday.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        tabLabel: "Set",
        eventSetId: "craigs_bubble_gum_blast",
        points: 10,
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
        id: "craigs_bubble_gum_blast",
        name: "Craig's Bubble Gum Blast",
        // No partnerName — this is an in-house Pin Drop event.
        description: "Craig's chewing through capsules. Collect Bubble Gum pins to score points; complete a full set of 4 for a bonus. Cap at 100 — all finishers go in the prize raffle.",
        eventWindow: "Pin Drop Original · 2026",
        // Pink/purple accent. Tweak the hex to taste; this hue reads as
        // both ("magenta") and pairs well with the existing GVC palette.
        accentColor: "#D26AFF",
        // Update before launch. Format same as PromoBadge.endsAt above.
        endsAt: undefined,
        tabLabel: "Set",
        heroImage: "/badges/promo/set/craig_vibington.jpg",
        // +25 per full set collected (one of every pin). Stacks: 3 of
        // each = 75 bonus. Combined with per-pin points + the 100 cap,
        // exactly 3 full sets gets you to the max (54 pin pts + 75 set
        // bonus = 129 → capped at 100).
        setBonusPoints: 25,
        // Hard cap. Reaching 100 pts qualifies for the prize raffle;
        // everyone at 100 is treated equally for the draw.
        scoreCap: 100,
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

/**
 * Compute a user's total event-set score from their per-pin owned
 * counts. Pure function — no KV reads — so the server can reuse it
 * inline at collect time and the test harness can verify scoring
 * math without a fixture.
 *
 *   total = Σ(owned × points)  +  fullSets × setBonusPoints
 *   fullSets = min(owned of every pin in the set)
 *   capped at set.scoreCap (if defined)
 *
 * Returns 0 when the set definition or the per-pin map is empty.
 */
export interface EventSetScoreBreakdown {
    pinScore: number;
    fullSets: number;
    setBonus: number;
    rawTotal: number;
    cappedTotal: number;
    cap: number | null;
}
export function computeEventSetScore(
    setId: string,
    perPinOwned: Record<string, number>,
): EventSetScoreBreakdown {
    const set = findPromoEventSet(setId);
    const pins = getEventSetPins(setId);
    if (!set || pins.length === 0) {
        return { pinScore: 0, fullSets: 0, setBonus: 0, rawTotal: 0, cappedTotal: 0, cap: null };
    }
    let pinScore = 0;
    let minOwned = Infinity;
    for (const pin of pins) {
        const owned = Math.max(0, Number(perPinOwned[pin.id] ?? 0));
        pinScore += owned * (pin.points ?? 1);
        if (owned < minOwned) minOwned = owned;
    }
    const fullSets = minOwned === Infinity ? 0 : minOwned;
    const setBonus = fullSets * (set.setBonusPoints ?? 0);
    const rawTotal = pinScore + setBonus;
    const cap = set.scoreCap ?? null;
    const cappedTotal = cap !== null ? Math.min(rawTotal, cap) : rawTotal;
    return { pinScore, fullSets, setBonus, rawTotal, cappedTotal, cap };
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

/**
 * Eligibility context for the current event's capsule lockout. Returns
 * the event key + startsAt only when an event with an explicit startsAt
 * is the primary active event. Used by capsule earn/open/reroll paths
 * to gate event-pin drops to capsules earned during the event window.
 *
 * Returns null when:
 *   - the promo feature is off
 *   - there's no active event
 *   - the active event has no startsAt (scaffold / testing mode → all
 *     capsules are eligible by default; lockout disabled)
 */
export function getEventEligibilityContext(): { eventKey: string; startsAt: string } | null {
    if (!isPromoActive()) return null;
    const primary = getPrimaryActiveEvent();
    if (!primary) return null;
    if (primary.kind === "set") {
        if (!primary.set.startsAt) return null;
        return { eventKey: primary.set.id, startsAt: primary.set.startsAt };
    }
    return null;
}

/** True iff the lockout window is open (event has a startsAt and we're
 *  past it). When false, callers should NOT increment the eligibility
 *  counter — we're either in scaffold mode (no startsAt) or pre-event.
 *  Returns the eligibility context when active, null otherwise. */
export function activeEligibilityWindow(): { eventKey: string } | null {
    const ctx = getEventEligibilityContext();
    if (!ctx) return null;
    if (Date.now() < new Date(ctx.startsAt).getTime()) return null;
    return { eventKey: ctx.eventKey };
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
