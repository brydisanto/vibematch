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
    /** When true, this pin adds `points` to the player's score but is
     *  EXCLUDED from the min-of-pins calculation that gates the set
     *  bonus. Used for "chase" tier pins that reward pulling on top
     *  of a full base set without making the set impossible to
     *  complete. Defaults to false. */
    isChase?: boolean;
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
    /** Short, one-line copy for the main LeaderboardModal "Event" tab
     *  header where the long-form drawer description would feel too
     *  dense. Falls back to description when omitted. */
    shortDescription?: string;
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
    /** Label for the drawer's pin-collection tab. Defaults to "The Set"
     *  which reads generically. Partner events with a themed name (e.g.
     *  "The Herd" for the Claynosaurz event) override here. */
    setTabLabel?: string;
    /** Label for the completion leaderboard sub-tab + its column. Defaults
     *  to "Herds" (Claynoz). Events whose set mechanic is a full-set
     *  completion race use "Sets". */
    setsBoardLabel?: string;
    /** When true, the event uses the TIMED board model: the Sets board is
     *  a one-per-player completion race ranked by finish time (from the
     *  set_done zset), and the Grails board ranks by count then time-to-
     *  count (from the grails composite). When false/absent, the Claynoz
     *  model is used: Sets = herds count, Grails = raw grail-pin count. */
    timedBoards?: boolean;
    /** When true, the leaderboard exposes an extra "Points/GVC" board that
     *  ranks only players verified to hold a GVC NFT (see src/lib/gvc.ts).
     *  Same points cascade as the open board, filtered to the gvc:holders
     *  set. Off/absent for events without a GVC-gated prize track. */
    gvcBoard?: boolean;
    /** Sub-tab / column label for the GVC-only board. Defaults to
     *  "GVC Holders". */
    gvcBoardLabel?: string;
    /** When set, adds a "Prizes" tab with the full how-to-win rundown
     *  (every board + the prize lines), and replaces the leaderboard's
     *  "Most Grails" spotlight with a single board-specific line on each
     *  sub-tab. `metric` ties a board entry to its leaderboard sub-tab
     *  (points | herds | grail | gvc). */
    leaderboardGuide?: {
        boards: { metric: "points" | "herds" | "grail" | "gvc"; name: string; detail: string }[];
        prizes: string[];
    };
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
    /** Display label for the set-bonus row in the drawer. Defaults to
     *  "FULL SET"; partner events with themed naming (e.g. "SET OF 4"
     *  for Claynosaurz where the chase pin is excluded) can override. */
    setBonusLabel?: string;
    /** Optional full-bleed background swapped in behind the game board
     *  while this set is active. Path under /public. When absent the
     *  default vibematchbg2.jpg is used. Doubles as the header-pill
     *  thumbnail and the guaranteed-preloaded frame; when a rotation set
     *  (gameBackgrounds) is present this should be one of its members. */
    gameBackground?: string;
    /** Optional pool of backgrounds to rotate between per game. When set
     *  and non-empty, the game board picks one deterministically per
     *  board (stable during a game, varies across games). Falls back to
     *  gameBackground when absent. */
    gameBackgrounds?: string[];
    /** Optional partner logo shown alongside the Pin Drop logo above
     *  the game board during the event. The Pin Drop logo stays its
     *  usual size and slides left, the partner logo sits to its right
     *  separated by a small "×". Path under /public. When absent only
     *  the Pin Drop logo is shown. */
    partnerLogo?: string;
    /** Optional BGM that takes over while the event is live. classicMusic
     *  becomes the primary track on load (winning over the saved pick);
     *  frenzyMusic owns Frenzy mode (with the usual tempo ramp). Each is a
     *  path that must also exist in BGM_FILES (src/lib/sounds.ts) so the
     *  track resolves + stays cyclable. When only classicMusic is set it
     *  covers Frenzy too; when neither is set the default rotation plays. */
    classicMusic?: string;
    frenzyMusic?: string;
    /** Hard cap on the per-user leaderboard score. Once reached, the
     *  zset entry stops climbing — any further collects are still
     *  credited to per-pin counters but don't move the leaderboard
     *  score. Use when the event ends in a raffle of all "maxed"
     *  collectors rather than a strict ranking. Omit for uncapped. */
    scoreCap?: number;
    /** Board frame color palette used by GameBoard while this set is
     *  active. When omitted, the frame stays gold. Set colors that
     *  read from lightest → darkest to keep the metallic-edge feel
     *  consistent with Craig's pink frame. */
    frameGradient?: {
        top: string;
        mid: string;
        bottom: string;
        shadow: string;
    };
    /** When true, this set's pins are included in the game-board tile
     *  pool during the event (they can appear as playable tiles in
     *  addition to dropping from capsules). Defaults false — Craig's
     *  set-event pins only drop from capsules. Turn on for partner
     *  events where showing the partner's IP on-board is part of the
     *  co-marketing beat. */
    includeInGameTiles?: boolean;
    /** Post-event prize results. When present, the EventDrawer shows a
     *  WINNERS tab. Populate after prizes are decided; keyed by exact
     *  username. When the optional final stats (points/herds/grails) are
     *  supplied, the tab renders THIS list directly in the given order
     *  (frozen final data) — which is required for winners who finished
     *  outside the live top-50. Without them, it falls back to filtering
     *  the live leaderboard to these usernames. Order this array by the
     *  Total Points board ranking. */
    winners?: Array<{ username: string; prize: string; points?: number; herds?: number; grails?: number }>;
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
        image: "/badges/promo/set/bubble_gum.webp",
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
        name: "Double Bubble Gum",
        image: "/badges/promo/set/bubble_gum_pink.webp",
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
        image: "/badges/promo/set/bubble_gum_big.webp",
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
        image: "/badges/promo/set/bubble_gum_giga.webp",
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        tabLabel: "Set",
        eventSetId: "craigs_bubble_gum_blast",
        points: 10,
        dropWeight: 2,
        rarityLabel: "Legendary",
    },
    // ── Claynosaurz partner event ───────────────────────────────────
    // 4 base pins + 1 Cosmic chase pin. Cosmic adds points but is
    // EXCLUDED from the min-of-pins set-bonus math, so completing the
    // 4-pin base set still fires setBonusPoints whether or not you
    // land the Cosmic. Weights are smoothed vs Craig's: gentler
    // Common → Legendary gradient, then a hard gap to Cosmic. Sum ≈
    // 100, drop rate 20%, per-cap odds:
    //   Common (Milo)          9.93%
    //   Rare (Bex)             5.36%
    //   Epic (Trix)            2.98%
    //   Legendary (Flea)       1.39%
    //   Cosmic (Claynotopia)   0.33%  ← ultra-rare, excluded from set bonus
    {
        id: "claynosaurz_common",
        name: "Milo",
        image: "/badges/promo/set/claynosaurz/common.webp",
        // Base tier — matches other 1× blue tiles on the board.
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "Claynosaurz",
        tabLabel: "Herd",
        eventSetId: "claynosaurz_partner_event",
        points: 1,
        dropWeight: 50,
        rarityLabel: "Common",
    },
    {
        id: "claynosaurz_rare",
        name: "Bex",
        image: "/badges/promo/set/claynosaurz/rare.webp",
        // Blue in-game tier (1×) so Milo + Bex can BOTH occupy blue
        // slots on the full-herd board — the 3B/1S/1G/1C composition
        // has one slot per upper tier, so fitting all 5 pins means
        // stacking the two most common pins in blue. Event rarity /
        // drop odds are unchanged (dropWeight + rarityLabel below).
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true,
        partnerName: "Claynosaurz",
        tabLabel: "Herd",
        eventSetId: "claynosaurz_partner_event",
        points: 2,
        dropWeight: 27,
        rarityLabel: "Rare",
    },
    {
        id: "claynosaurz_epic",
        name: "Trix",
        image: "/badges/promo/set/claynosaurz/epic.webp",
        // Silver in-game tier (1.5×) — shifted down one so Claynotopia
        // can hold the cosmic slot on the full-herd board.
        tier: "silver" as BadgeTier,
        pointMultiplier: 1.5,
        isPromo: true,
        partnerName: "Claynosaurz",
        tabLabel: "Herd",
        eventSetId: "claynosaurz_partner_event",
        points: 5,
        dropWeight: 15,
        rarityLabel: "Epic",
    },
    {
        id: "claynosaurz_legendary",
        name: "Flea",
        image: "/badges/promo/set/claynosaurz/legendary.webp",
        // Gold in-game tier (2×) — shifted down one so Claynotopia
        // can hold the cosmic slot on the full-herd board.
        tier: "gold" as BadgeTier,
        pointMultiplier: 2,
        isPromo: true,
        partnerName: "Claynosaurz",
        tabLabel: "Herd",
        eventSetId: "claynosaurz_partner_event",
        points: 10,
        dropWeight: 7,
        rarityLabel: "Legendary",
    },
    {
        // "Cosmic" is Claynosaurz's original file naming; the visible
        // rarity label is "Grail" and the mechanic (isChase) is
        // generic. On the game board Claynotopia IS the cosmic-tier
        // pin for the event, and the full-herd board promotes it into
        // the cosmic slot so all 5 pins appear together. isChase still
        // excludes it from set-completion math and from the every-board
        // event floor.
        id: "claynosaurz_cosmic",
        name: "Claynotopia",
        description: "Ultra rare. Go grail hunting and watch the points rain!",
        image: "/badges/promo/set/claynosaurz/cosmic.webp",
        tier: "cosmic" as BadgeTier,
        pointMultiplier: 3,
        isPromo: true,
        partnerName: "Claynosaurz",
        tabLabel: "Herd",
        eventSetId: "claynosaurz_partner_event",
        // Cosmic awards a big point boost (2x Legendary) but doesn't
        // gate the set bonus — see isChase.
        points: 20,
        // Fractional weight — bumps Chase per-cap odds from ~0.15%
        // (weight=1) to ~0.25% (weight≈1.67) at the 15% pool rate,
        // without perturbing the four base tiers' odds. dropWeight is
        // treated as a plain number by the weighted picker, so the
        // fraction is safe.
        dropWeight: 1.67,
        rarityLabel: "Grail",
        isChase: true,
    },

    // ===================================================================
    // AXIE PIN DROP  (Aug 3 → Aug 10 2026, 12PM ET)
    // 9 base pins across 3 rarities (Rare/Epic/Mystic) + 1 grail. Final
    // art + named pins. No score cap on the points board this event.
    // Board tiers map rarity → blue/silver/gold (grail → cosmic).
    // ===================================================================
    // 3× RARE (2 pts each) — entry tier for the Axie special pins.
    ...([1, 2, 3] as const).map((n) => ({
        id: `axie_rare_${n}`,
        name: ({ 1: "Ena", 2: "Tripp", 3: "Pomodoro" } as const)[n],
        image: `/badges/promo/set/axie/rare_${n}.webp`,
        tier: "blue" as BadgeTier,
        pointMultiplier: 1,
        isPromo: true as const,
        partnerName: "Axie Infinity",
        tabLabel: "Set",
        eventSetId: "axie_partner_event",
        points: 2,
        dropWeight: 58,
        rarityLabel: "Rare",
    })),
    // 3× EPIC (4 pts each)
    ...([1, 2, 3] as const).map((n) => ({
        id: `axie_epic_${n}`,
        name: ({ 1: "Momo", 2: "Mit", 3: "Venoki" } as const)[n],
        image: `/badges/promo/set/axie/epic_${n}.webp`,
        tier: "silver" as BadgeTier,
        pointMultiplier: 1.5,
        isPromo: true as const,
        partnerName: "Axie Infinity",
        tabLabel: "Set",
        eventSetId: "axie_partner_event",
        points: 4,
        dropWeight: 24,
        rarityLabel: "Epic",
    })),
    // 3× MYSTIC (10 pts each) — rarest base tier, gates full-set completion.
    ...([1, 2, 3] as const).map((n) => ({
        id: `axie_mystic_${n}`,
        name: ({ 1: "Bubba", 2: "Olek", 3: "Puffy" } as const)[n],
        image: `/badges/promo/set/axie/mystic_${n}.webp`,
        tier: "gold" as BadgeTier,
        pointMultiplier: 2,
        isPromo: true as const,
        partnerName: "Axie Infinity",
        tabLabel: "Set",
        eventSetId: "axie_partner_event",
        points: 10,
        dropWeight: 16,
        rarityLabel: "Mystic",
    })),
    // 1× GRAIL — ultra rare, excluded from set completion (isChase).
    {
        id: "axie_grail",
        name: "Kotaro",
        description: "Ultra rare. The hardest pull in the event.",
        image: "/badges/promo/set/axie/grail.webp",
        tier: "cosmic" as BadgeTier,
        pointMultiplier: 3,
        isPromo: true,
        partnerName: "Axie Infinity",
        tabLabel: "Set",
        eventSetId: "axie_partner_event",
        points: 25,
        dropWeight: 3.3,
        rarityLabel: "Grail",
        isChase: true,
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
        description: "Help Craig prepare for the first Gumbustion. Collect different Bubble Gum pins to score points; complete a full set of all 4 to land a bonus. Points cap at 100, everyone that maxes out joins the prize raffle.",
        shortDescription: "Help Craig prepare for the first Gumbustion. Find special Bubble Gum Pins to win prizes!",
        eventWindow: "Pin Drop Original",
        // Pink/purple accent. Tweak the hex to taste; this hue reads as
        // both ("magenta") and pairs well with the existing GVC palette.
        accentColor: "#D26AFF",
        // Monday July 6 2026, 12:00 PM Eastern. EDT is UTC-4 in July
        // → 16:00 UTC. Drives both the pre-event countdown in the
        // EventDrawer hero and the capsule-eligibility lockout (no
        // event pins drop from capsules earned before this moment).
        startsAt: "2026-07-06T16:00:00Z",
        // Monday July 13 2026, 12:00 PM Eastern — exactly one week of
        // collecting. Drives the "ENDS …" countdown once the event is
        // live, then flips the drawer to FINAL RESULTS at cutoff.
        endsAt: "2026-07-13T16:00:00Z",
        tabLabel: "Set",
        heroImage: "/badges/promo/set/craig_vibington.webp",
        // +25 per full set collected (one of every pin). Stacks: 3 of
        // each = 75 bonus. Combined with per-pin points + the 100 cap,
        // exactly 3 full sets gets you to the max (54 pin pts + 75 set
        // bonus = 129 → capped at 100).
        setBonusPoints: 25,
        // Hard cap. Reaching 100 pts qualifies for the prize raffle;
        // everyone at 100 is treated equally for the draw.
        scoreCap: 100,
        // Pink Bubble Gum board frame while Craig's runs (was the
        // bubbleGumFrame boolean before this refactor).
        frameGradient: {
            top:    "#FFB4E5",
            mid:    "#D26AFF",
            bottom: "#5A1F8C",
            shadow: "#5A1F8C",
        },
        // Set pins do NOT appear on the game board — capsule drops only.
        includeInGameTiles: false,
        gameBackground: "/backgrounds/game-bg-bubble-gum.webp",
        // Prize results, decided 2026-07-15 after the July 13 close.
        // Raffle winners from the 100-point pool + the Giga chase.
        winners: [
            { username: "tylersmom423", prize: "GVC #4957" },
            { username: "gabo", prize: "50K $VIBESTR" },
            { username: "brandon87", prize: "20K $VIBESTR" },
            { username: "bassline81", prize: "20K $VIBESTR" },
            { username: "joker", prize: "20K $VIBESTR" },
            { username: "btdwayne", prize: "20K $VIBESTR" },
            { username: "gintonic", prize: "20K $VIBESTR" },
            { username: "jordankallman", prize: "20K $VIBESTR" },
            { username: "charles", prize: "20K $VIBESTR" },
            { username: "joafe82", prize: "20K $VIBESTR" },
            { username: "itsarmana", prize: "20K $VIBESTR" },
            { username: "wyllt", prize: "20K $VIBESTR" },
        ],
    },
    {
        id: "claynosaurz_partner_event",
        name: "Comfy In Clay",
        partnerName: "Claynosaurz",
        description: "Get comfy in Clay and collect all of your favorite characters to win fun prizes.",
        shortDescription: "Get comfy in Clay and collect all of your favorite characters to win fun prizes.",
        eventWindow: "Claynosaurz x Pin Drop",
        // Claynosaurz brand teal / turquoise. Update to their exact
        // brand hex when the partnership brief lands.
        accentColor: "#00C4B4",
        // Launch: Monday July 20 2026, 12:00 PM Eastern (16:00 UTC).
        // Window: 7 days, closing Monday July 27 12:00 PM Eastern.
        startsAt: "2026-07-20T16:00:00Z",
        endsAt: "2026-07-27T16:00:00Z",
        tabLabel: "Set",
        // Temporary hero — pointing at the branded Cosmic pin since
        // it carries the Claynosaurz logo and reads well at hero size.
        // Swap when a dedicated character/mascot hero drops.
        heroImage: "/badges/promo/set/claynosaurz/cosmic.webp",
        // Same as Craig's — +25 per full 4-pin base set completed.
        // Chase pin does NOT count toward set completion (isChase),
        // so the max-out math is unchanged from Craig's despite the
        // 5-pin display.
        setBonusPoints: 25,
        // Hard cap on the leaderboard score, same as Craig's.
        scoreCap: 100,
        // Teal board frame gradient — Claynosaurz brand accent as the
        // mid stop, brighter tint on top, deep teal on bottom.
        frameGradient: {
            top:    "#7FEFE0",
            mid:    "#00C4B4",
            bottom: "#004E48",
            shadow: "#004E48",
        },
        // Claynoz characters ARE playable on the game board during
        // the event — part of the co-marketing beat. The 5 pins get
        // added to the tile pool alongside the normal tiers.
        includeInGameTiles: true,
        setTabLabel: "The Herd",
        // Set-of-4 bonus label — the Grail chase pin is excluded from
        // the min-of-pins math, so completing 4 of every base pin
        // fires the bonus.
        setBonusLabel: "SET OF 4",
        gameBackground: "/backgrounds/game-bg-claynosaurz.webp",
        partnerLogo: "/assets/claynosaurz-logo.webp",
        // Single theme covered both modes; the generalized selector uses
        // classicMusic for Frenzy too when frenzyMusic is absent.
        classicMusic: "/music/claynoz-theme.mp3",
        // Final Comfy in Clay winners, ordered by the Total Points board.
        // Stats baked in (frozen final data) so winners who finished
        // outside the live top-50 (charles, dadutch, y00ted, zombegonetv)
        // still render on the WINNERS tab.
        winners: [
            { username: "brandon87", prize: "1 Pioneer Pack", points: 100, herds: 8, grails: 4 },
            { username: "gnz0", prize: "1 Pioneer Pack", points: 100, herds: 7, grails: 3 },
            { username: "wyllt", prize: "1 Pioneer Pack", points: 100, herds: 4, grails: 3 },
            { username: "checkmeh", prize: "1 Pioneer Pack", points: 100, herds: 2, grails: 3 },
            { username: "kesha", prize: "1 Pioneer Pack", points: 100, herds: 2, grails: 3 },
            { username: "economist", prize: "1 Pioneer Pack", points: 100, herds: 4, grails: 3 },
            { username: "joker", prize: "1 Pioneer Pack", points: 100, herds: 10, grails: 2 },
            { username: "tylersmom423", prize: "2 Pioneer Packs", points: 100, herds: 15, grails: 2 },
            { username: "iammcmuffin", prize: "1 Pioneer Pack", points: 100, herds: 10, grails: 1 },
            { username: "btdwayne", prize: "1 Pioneer Pack", points: 100, herds: 10, grails: 1 },
            { username: "hermehs.the.bored", prize: "1 Pioneer Pack", points: 100, herds: 4, grails: 1 },
            { username: "pinstripedgator", prize: "1 Pioneer Pack", points: 100, herds: 3, grails: 1 },
            { username: "stuffkeithbuys", prize: "1 Pioneer Pack", points: 100, herds: 1, grails: 1 },
            { username: "charles", prize: "3 Pioneer Packs", points: 100, herds: 15, grails: 0 },
            { username: "dadutch", prize: "1 Pioneer Pack", points: 100, herds: 3, grails: 0 },
            { username: "y00ted", prize: "1 Pioneer Pack", points: 100, herds: 3, grails: 0 },
            { username: "zombegonetv", prize: "1 Pioneer Pack", points: 100, herds: 2, grails: 0 },
        ],
    },
    {
        id: "axie_partner_event",
        name: "Axie Pin Drop",
        partnerName: "Axie Infinity",
        description: "A seven-day event from Good Vibes Club and Axie Infinity. Collect the nine-pin Axie set, race the clock, and climb four leaderboards to win prizes. 1 GVC, 100 Axies, 5,877 accessories, and more are up for grabs. Note: the Full Set leaderboard is a race and winners are determined by time to completion.",
        shortDescription: "Collect Axie pins to win prizes!",
        eventWindow: "Axie Infinity x Pin Drop",
        // Axie aqua-blue brand accent.
        accentColor: "#4A9EFF",
        // Launch: Monday Aug 3 2026, 9:00 AM Eastern (EDT = UTC-4, 13:00 UTC).
        // Window: 7 days, closing Monday Aug 10 9:00 AM Eastern (13:00 UTC).
        startsAt: "2026-08-03T13:00:00Z",
        endsAt: "2026-08-10T13:00:00Z",
        tabLabel: "Set",
        // Drawer hero stays the Axie Infinity logo (the grail pin art is
        // now Kotaro, a separate image).
        heroImage: "/badges/promo/set/axie/hero-logo.webp",
        // NO points cap this event — points accumulate uncapped. Sets are
        // also a separate completion-time race (see the leaderboard route),
        // AND completing a full set of 9 awards +25 to the points board.
        setBonusPoints: 25,
        // scoreCap intentionally omitted — no cap.
        // Axie aqua board frame.
        frameGradient: {
            top:    "#B6E3FF",
            mid:    "#4A9EFF",
            bottom: "#123A6B",
            shadow: "#123A6B",
        },
        // Axie pins are playable board tiles. Every board carries at least
        // one Axie base pin (Rare/Epic/Mystic). Roughly 1 in 5 boards fires
        // the full-set board: all 6 tiles are Axie, composed 3 Rare / 1 Epic
        // / 1 Mystic / 1 Grail, so the 3B/1S/1G/1C game distribution holds.
        // The Grail only appears as a tile on that full-set board, keeping
        // the chase rare on the board as well as in capsules.
        includeInGameTiles: true,
        setTabLabel: "The Set",
        setsBoardLabel: "Full Set Race",
        timedBoards: true,
        gvcBoard: true,
        gvcBoardLabel: "GVC Holders",
        leaderboardGuide: {
            boards: [
                { metric: "points", name: "Total Points", detail: "Every Axie pin scores by rarity. Highest total wins (no cap on points). Sets of 9 add +25 bonus points." },
                { metric: "herds", name: "Full Set Race", detail: "Find all 9 Axie pins, ranked by time to finish (note: this excludes the grail pin)." },
                { metric: "grail", name: "Grail Chase", detail: "Ranked by the number of grail pins found. Time is the tiebreaker." },
                { metric: "gvc", name: "GVC Holders", detail: "A special points leaderboard for verified GVC holders (accepts delegate.xyz)." },
            ],
            prizes: [
                "1 GVC NFT grand prize (Total Points #1).",
                "250,000 $VIBESTR (5,000/each to Total Points #2-#51).",
                "5,889 limited-edition Axie accessories across the Points, Full Set, and Grail Chase leaderboards. Accessory rewards scale by place of finish (see X thread for full breakdown). Accessories range from Common to Mystic.",
                "100 collectible Axies for the GVC Holders leaderboard. Japanese for #1-10, Nightmare for #11-#50, Summer for #51-#100.",
                "1 Team of Axies airdropped to every GVC holder that plays in the event.",
            ],
        },
        setBonusLabel: "EVERY FULL SET OF 9",
        // Four Axie backgrounds rotate per game (stable during a board,
        // varies across games). gameBackground is bg-1 as the thumbnail +
        // guaranteed-preload frame.
        gameBackground: "/backgrounds/game-bg-axie-1.webp",
        gameBackgrounds: [
            "/backgrounds/game-bg-axie-1.webp",
            "/backgrounds/game-bg-axie-2.webp",
            "/backgrounds/game-bg-axie-3.webp",
            "/backgrounds/game-bg-axie-4.webp",
        ],
        partnerLogo: "/assets/axie-logo.webp",
        classicMusic: "/music/axie-summer.mp3",
        frenzyMusic: "/music/axie-lunar-battle.mp3",
    },
];

/**
 * Drop chance per capsule open. Independent of the normal tier roll — when
 * this hits, we skip the tier roll entirely and award the promo. Global,
 * but only the single active event uses it (events don't overlap).
 *
 * Claynosaurz ran at 20% (4-pin set): Common 9.93 / Rare 5.36 / Epic 2.98
 * / Legendary 1.39 / Grail 0.33.
 *
 * Axie runs at 30% (9-pin set, tiers Rare/Epic/Mystic + Grail). A 9-pin
 * set is a much steeper coupon-collector than 4, so the higher pool keeps
 * the full-set grind in Claynoz's range (~90-100 capsules) while preserving
 * a clean tier gradient and an identical grail rarity. Drop weights are
 * unchanged from the earlier tuning; only the tier labels + point values
 * (Rare 2 / Epic 4 / Mystic 10 / Grail 25) differ. Per-capsule odds at 30%:
 *   Rare (each of 3)     ~5.19%   (tier ~15.6%)
 *   Epic (each of 3)     ~2.50%   (tier ~7.5%)
 *   Mystic (each of 3)   ~2.20%   (tier ~6.6%)
 *   Grail (chase)        ~0.33%   ← same as Claynoz; excluded from set
 */
export const PROMO_DROP_RATE = 0.30;

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

/** True once the promo's endsAt has passed. For set-event pins the
 *  lifetime is defined at the SET level (individual pins have no
 *  endsAt of their own), so we inherit from the parent set. Standalone
 *  promos check their own endsAt. Anything with no resolved endsAt
 *  never expires.
 *
 *  The set inheritance is load-bearing: without it, set-event pins
 *  never read as ended and keep dropping from eligible capsules
 *  indefinitely — this is exactly how Craig's pins kept dropping for
 *  three days after the July 13 cutoff. */
export function isPromoEnded(promo: PromoBadge): boolean {
    if (promo.eventSetId) {
        const set = findPromoEventSet(promo.eventSetId);
        if (!set?.endsAt) return false;
        return Date.now() >= new Date(set.endsAt).getTime();
    }
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

/** True while a set event is INSIDE its window (startsAt passed, endsAt
 *  not). This is the gate for every event-specific game surface — board
 *  tiles, background, frame gradient, partner logo, theme music, combo
 *  phrases. Pre-start the event is announce-only: banner shows COMING
 *  SOON, drawer opens with info, but the game itself stays stock until
 *  the window opens. */
export function isEventSetLive(set: Pick<PromoEventSet, "startsAt" | "endsAt">): boolean {
    const now = Date.now();
    if (set.startsAt && now < new Date(set.startsAt).getTime()) return false;
    if (set.endsAt && now >= new Date(set.endsAt).getTime()) return false;
    return true;
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

/** KV key for an event set's "herds" leaderboard — sorted by fullSets
 *  (min of base-pin counts) as the primary metric, tie-broken by
 *  points. Composite score stored as `fullSets × 1000 + cappedPoints`
 *  so a single ZRANGE returns the correct ordering. Extract with:
 *      herds  = Math.floor(score / 1000)
 *      points = score - herds × 1000
 *  Requires cappedPoints ≤ 999 (safe since scoreCap ≤ 100 in practice). */
export function eventSetHerdsKey(setId: string): string {
    return `event_set:${setId}:herds`;
}
export function encodeHerdsScore(fullSets: number, cappedPoints: number): number {
    return fullSets * 1000 + Math.min(999, Math.max(0, cappedPoints));
}
export function decodeHerdsScore(score: number): { fullSets: number; cappedPoints: number } {
    const fullSets = Math.floor(score / 1000);
    return { fullSets, cappedPoints: score - fullSets * 1000 };
}

/** Per-user timestamp of the first time cappedTotal reached the set's
 *  scoreCap. Written with { nx: true } so only the FIRST cap-crossing
 *  is recorded. Read by the leaderboard endpoint as the "speed to
 *  100" tiebreaker — earlier ms wins. Absent for users who haven't
 *  reached the cap yet. */
export function eventSetReachedCapKey(setId: string, username: string): string {
    return `event_set:${setId}:reached_cap:${username}`;
}

// ── Axie-era leaderboard keys (completion-time + composite ranking) ──
// These support events whose Sets board is a one-per-player COMPLETION
// RACE (ranked by time) and whose Grails board is tie-broken by time to
// reach a count. Claynoz keeps using the herds key above; new events use
// these.

/** Set-completion race zset. score = completion timestamp (ms). Written
 *  ONCE per player (ZADD NX) the moment they first hold one of every base
 *  (non-chase) pin. ZRANGE ascending = ranking (earliest completion wins);
 *  the score doubles as the "finished at" timestamp the UI displays. One
 *  entry per user, so it is inherently capped at 1 set per player. */
export function eventSetSetDoneKey(setId: string): string {
    return `event_set:${setId}:set_done`;
}

/** Grail race zset — ranks by grail count, tie-broken by TIME to reach
 *  that count (earlier wins). Both encoded in one score so a single
 *  ZREVRANGE returns the true order:
 *      score = count × BUCKET + (BUCKET - 1 - secondsSinceEventStart)
 *  A higher count always outranks a lower one; within a count, the
 *  smaller elapsed-seconds (earlier) yields a higher score. BUCKET (1e7)
 *  exceeds a 7-day event's second span (~6.05e5), and count × 1e7 stays
 *  well inside float64's exact-integer range. */
const GRAIL_BUCKET = 10_000_000;
export function eventSetGrailsKey(setId: string): string {
    return `event_set:${setId}:grails`;
}
export function encodeGrailScore(count: number, secondsSinceStart: number): number {
    const s = Math.min(GRAIL_BUCKET - 1, Math.max(0, Math.floor(secondsSinceStart)));
    return Math.max(0, Math.floor(count)) * GRAIL_BUCKET + (GRAIL_BUCKET - 1 - s);
}
export function decodeGrailScore(score: number): { count: number; secondsSinceStart: number } {
    const count = Math.floor(score / GRAIL_BUCKET);
    const inv = score - count * GRAIL_BUCKET;
    return { count, secondsSinceStart: (GRAIL_BUCKET - 1) - inv };
}

/** GVC-holder-only points zset. Mirrors the main points zset but only
 *  verified GVC holders are written to it, so the Points/GVC board is a
 *  direct ZREVRANGE with no per-read ownership checks. Membership is
 *  managed by the holder-verification subsystem (added on verify, and
 *  the points value kept in lockstep with the main board on each
 *  collect while the user is a verified holder). */
export function eventSetPointsGvcKey(setId: string): string {
    return `event_set:${setId}:points_gvc`;
}

/** Seconds elapsed since an event's startsAt, clamped to >= 0. Used to
 *  encode "time to goal" into the grail + (future) rank composites so
 *  timestamps stay small and comparable within the event window. */
export function secondsSinceEventStart(set: Pick<PromoEventSet, "startsAt">, nowMs: number): number {
    if (!set.startsAt) return 0;
    const start = new Date(set.startsAt).getTime();
    return Math.max(0, Math.floor((nowMs - start) / 1000));
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
    let baseCount = 0;
    for (const pin of pins) {
        const owned = Math.max(0, Number(perPinOwned[pin.id] ?? 0));
        pinScore += owned * (pin.points ?? 1);
        // Chase pins add to pinScore but don't gate the set bonus —
        // completing all 4 base pins is what triggers the bonus.
        if (pin.isChase) continue;
        baseCount++;
        if (owned < minOwned) minOwned = owned;
    }
    // fullSets = min of BASE pin counts only. If a set is chase-only
    // (no base pins configured — shouldn't happen), no bonus fires.
    const fullSets = baseCount === 0 || minOwned === Infinity ? 0 : minOwned;
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
    // Fall back to the MOST RECENT set, including ended (archive view).
    // Ordering by startsAt (not array position) matters once more than one
    // event has ended: the banner + drawer should surface the event that
    // just finished, not whichever set happens to be defined first in
    // PROMO_BADGES. Without this, the day Claynoz ended the header reverted
    // to Craig (defined earlier) instead of showing Claynoz's final state.
    const endedSets = [...new Set(active.filter(p => p.eventSetId).map(p => p.eventSetId as string))]
        .map(id => findPromoEventSet(id))
        .filter((s): s is PromoEventSet => !!s)
        .sort((a, b) => (b.startsAt ? new Date(b.startsAt).getTime() : 0) - (a.startsAt ? new Date(a.startsAt).getTime() : 0));
    if (endedSets.length > 0) {
        const set = endedSets[0];
        return { kind: "set", set, pins: getEventSetPins(set.id) };
    }
    // Fall back to the most recent standalone (including ended), by endsAt.
    const standalone = [...active.filter(p => !p.eventSetId)]
        .sort((a, b) => (b.endsAt ? new Date(b.endsAt).getTime() : 0) - (a.endsAt ? new Date(a.endsAt).getTime() : 0))[0];
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
