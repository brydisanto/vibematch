export type BadgeTier = "blue" | "silver" | "special" | "gold" | "cosmic";

export interface Badge {
    id: string;
    name: string;
    image: string;
    tier: BadgeTier;
    pointMultiplier: number;
    /** If true, this badge only appears in capsule drops / pin book — not on the game board. */
    collectOnly?: boolean;
    /** Relative weight within the tier for capsule drops. Higher = more common. Server-side only. */
    dropWeight?: number;
}

export const BADGES: Badge[] = [
    // ===== COMMON TIER (1×) — 15 badges =====
    {
        id: "any_gvc",
        name: "Citizen of Vibetown",
        image: "/badges/any_gvc_1759173799963.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "full_send_maverick",
        name: "Full Send Maverick",
        image: "/badges/full_send_maverick_1759173982959.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "funky_fresh",
        name: "Funky Fresh",
        image: "/badges/funky_fresh_1759174001274.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "gradient_lover",
        name: "Gradient Gatherer",
        image: "/badges/gradient_lover_1759173808918.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "highkeymoments_1",
        name: "Highkey Moments",
        image: "/badges/highkeymoments_1_1771433768524.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "visooor_enjoyooor",
        name: "Visooor Enjoyooor",
        image: "/badges/visooor_enjoyooor_1759174010233.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "ladies_night",
        name: "Ladies Night",
        image: "/badges/ladies_night_1759173991853.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "necks_level",
        name: "Necks Level",
        image: "/badges/necks_level_1759173966777.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "multi_type_master",
        name: "Multi-Type Master",
        image: "/badges/multi_type_master_1759173898608.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "vibetown_social_club",
        name: "Vibetown Social Club",
        image: "/badges/vibetown_social_club_1759173960008.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "plastic_lover",
        name: "Plastic Pioneer",
        image: "/badges/plastic_lover_1759173806081.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "hail_mary_heroes",
        name: "Hail Mary Heroes",
        image: "/badges/hail_mary_heroes_1759173953534.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "seas_the_day",
        name: "Seas The Day",
        image: "/badges/seas_the_day_1759173945252.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "robot_lover",
        name: "Love At First Byte",
        image: "/badges/robot_lover_1759173802514.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    {
        id: "suited_up",
        name: "Suited Up",
        image: "/badges/suited_up_1759173934070.webp",
        tier: "blue",
        pointMultiplier: 1,
    },
    // ===== UNCOMMON TIER (1.5×) — 59 badges =====
    {
        id: "pothead",
        name: "High Vibes",
        image: "/badges/pothead_1759173827603.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "rainbow_boombox",
        name: "Bass In Your Face",
        image: "/badges/rainbow_boombox_1759173875165.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "flow_state",
        name: "Flow State",
        image: "/badges/flow_state_1771355010910.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "kinky",
        name: "Kinky",
        image: "/badges/kinky_1771355046536.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "checkmate",
        name: "No Pawn Intended",
        image: "/badges/checkmate_1759173863329.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "fur_the_win",
        name: "Fur The Win",
        image: "/badges/fur_the_win_1759173969828.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "grayscale_seeker",
        name: "Grailscale Hunter",
        image: "/badges/grayscale_seeker_1759173797002.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "poker_face",
        name: "Pocket Rockets",
        image: "/badges/poker_face_1759173884906.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "rainbow_citizen",
        name: "Rainbow Maxi",
        image: "/badges/rainbow_citizen_1759173791000.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "trait_maxi",
        name: "Trait Maxi",
        image: "/badges/trait_maxi_1771355017585.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "yin_n_yang",
        name: "Yin N' Yang",
        image: "/badges/yin_n_yang_1759173942484.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "zoom_in_vibe_out",
        name: "Zoom In, Vibe Out",
        image: "/badges/zoom_in_vibe_out_1759174018930.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "science_goggles",
        name: "Atomic Aura",
        image: "/badges/science_goggles_1759173835714.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "toy_bricks",
        name: "Brick By Brick",
        image: "/badges/toy_bricks_1759173887659.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "plants",
        name: "Aloe You Vera Much",
        image: "/badges/plants_1759173871973.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "hue_too_fresh",
        name: "Hue Too Fresh",
        image: "/badges/hue_too_fresh_1771355000776.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "chris_favorite_badge",
        name: "Chris' Favorite Badge",
        image: "/badges/chris_favorite_badge_1759173988815.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "anchorman",
        name: "Anchorman",
        image: "/badges/anchorman_1771355025752.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "doge",
        name: "Shiba Syndicate",
        image: "/badges/doge_1759173842640.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "captain",
        name: "Oh Captain, My Captain",
        image: "/badges/captain_1759173895611.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "elite_rainbow_ranger",
        name: "Elite Rainbow Ranger",
        image: "/badges/elite_rainbow_ranger_1759174003980.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "full_throttle",
        name: "Full Throttle",
        image: "/badges/full_throttle_1759174022912.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "gamer",
        name: "360 No Scope",
        image: "/badges/gamer_1759173856821.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "gud_meat",
        name: "Gud Meat",
        image: "/badges/gud_meat_1759173936766.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "rack_em_up",
        name: "Rack 'Em Up",
        image: "/badges/rack_'em_up_1759173890603.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "high_noon_hustler",
        name: "High Noon Hustler",
        image: "/badges/high_noon_hustler_1759174007143.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "homerun",
        name: "Homerun",
        image: "/badges/homerun_1759174013207.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "pepe",
        name: "Pepe Posse",
        image: "/badges/pepe_1759173846260.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "shower",
        name: "Soaked N' Stoked",
        image: "/badges/shower_1759173865972.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "mountain_goat",
        name: "Mountain GOAT",
        image: "/badges/mountain_goat_1759174026593.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "no_face_no_problem",
        name: "No Face, No Problem",
        image: "/badges/no_face_no_problem_1759173948247.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "party_in_the_back",
        name: "Party in the Back",
        image: "/badges/party_in_the_back_1759173998578.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "power_duo",
        name: "Power Duo",
        image: "/badges/power_duo_1759173963251.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "rainbow_bubble_goggles",
        name: "Bubble Visionary",
        image: "/badges/rainbow_bubble_goggles_1759173853819.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "sir_vibes_a_lot",
        name: "Sir Vibes-a-Lot",
        image: "/badges/sir_vibes_a_lot_1759173980023.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "showtime",
        name: "Showtime",
        image: "/badges/showtime_1759173995136.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "super_rare",
        name: "SuperRare",
        image: "/badges/super_rare_1759173833292.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "patch_powerhouse",
        name: "Patch Powerhouse",
        image: "/badges/patch_powerhouse_1771354988189.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "tanks_a_lot",
        name: "Tanks A Lot",
        image: "/badges/tanks_a_lot_1759173976815.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "tatted_up",
        name: "Tatted Up",
        image: "/badges/tatted_up_1771355030286.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "varsity_vibes",
        name: "Varsity Vibes",
        image: "/badges/varsity_vibes_1759173950723.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "vibefoot_fan_club",
        name: "Vibefoot Fan Club",
        image: "/badges/vibefoot_fan_club_1759173939420.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "nounish_vibes",
        name: "Nounish Vibes",
        image: "/badges/nounish_vibes_1759173973218.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "ranger",
        name: "Vibe Ranger",
        image: "/badges/ranger_1759173821753.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "rainbow_visor",
        name: "Hue Got This",
        image: "/badges/rainbow_visor_1759173849941.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    // ===== GOLD TIER (2×) — 13 badges =====
    {
        id: "surfer",
        name: "Get Pitted",
        image: "/badges/surfer_1759173830462.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "astro_balls",
        name: "Stellar Spheres",
        image: "/badges/astro_balls_1759173838889.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "gold_member",
        name: "Golden Fever",
        image: "/badges/gold_member_1759173793799.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "great_stacheby",
        name: "Great 'Stacheby",
        image: "/badges/great_stacheby_1759173956903.webp",
        tier: "silver",
        pointMultiplier: 1.5,
    },
    {
        id: "shadow_funk_division",
        name: "Shadow Funk Division",
        image: "/badges/shadow_funk_division_1771355038766.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "straw_man",
        name: "Straw Man",
        image: "/badges/straw_man_1759173985595.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "king",
        name: "Vibetown Royalty",
        image: "/badges/king_1759173882056.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "stone",
        name: "Marble Potential",
        image: "/badges/stone_1759173815165.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "lamp",
        name: "I Love Lamp",
        image: "/badges/lamp_1759173892925.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "hoodie_up_society",
        name: "Hoodie Up Society",
        image: "/badges/hoodie_up_society_1759174015984.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "electric_rings",
        name: "Watt's Up",
        image: "/badges/electric_rings_1759173878797.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "astro_bean",
        name: "AstroBean",
        image: "/badges/astro_bean_1759173824578.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "vibetown_baller",
        name: "Vibetown Baller",
        image: "/badges/vibetown_baller_1759173868839.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    {
        id: "sugar_rush",
        name: "Sugar Rush",
        image: "/badges/sugar_rush_1759173860105.webp",
        tier: "gold",
        pointMultiplier: 2,
    },
    // ===== COSMIC TIER (3×) — 3 badges =====
    {
        id: "cosmic_guardian",
        name: "Cosmic Guardian",
        image: "/badges/cosmic_guardian1759173818340.webp",
        tier: "cosmic",
        pointMultiplier: 3,
    },
    {
        id: "one_of_one",
        name: "One of One",
        image: "/badges/one_of_one_1771354994630.webp",
        tier: "cosmic",
        pointMultiplier: 3,
    },
    {
        id: "the_completionist",
        name: "The Completionist",
        image: "/badges/the_completionist_1771355052089.webp",
        tier: "cosmic",
        pointMultiplier: 3,
    },

    // ===== COLLECTION-ONLY BADGES (24) — capsule drops only, not on game board =====

    // Common (1)
    {
        id: "highkeymoments_2",
        name: "HighKey Moments II",
        image: "/badges/highkeymoments_2.webp",
        tier: "gold",
        pointMultiplier: 3,
        collectOnly: true,
    },

    // Rare (6) — Hatrick & High Five collection milestones
    // Hatrick badges → Common
    {
        id: "gradient_hatrick",
        name: "Gradient Hatrick",
        image: "/badges/gradient_hatrick.webp",
        tier: "blue",
        pointMultiplier: 1,
        collectOnly: true,
    },
    {
        id: "plastic_hatrick",
        name: "Plastic Hatrick",
        image: "/badges/plastic_hatrick.webp",
        tier: "blue",
        pointMultiplier: 1,
        collectOnly: true,
    },
    {
        id: "robot_hatrick",
        name: "Robot Hatrick",
        image: "/badges/robot_hatrick.webp",
        tier: "blue",
        pointMultiplier: 1,
        collectOnly: true,
    },

    // High Five badges → Rare
    {
        id: "gradient_high_five",
        name: "Gradient High Five",
        image: "/badges/gradient_high_five.webp",
        tier: "silver",
        pointMultiplier: 2,
        collectOnly: true,
    },
    {
        id: "plastic_high_five",
        name: "Plastic High Five",
        image: "/badges/plastic_high_five.webp",
        tier: "silver",
        pointMultiplier: 2,
        collectOnly: true,
    },
    {
        id: "robot_high_five",
        name: "Robot High Five",
        image: "/badges/robot_high_five.webp",
        tier: "silver",
        pointMultiplier: 2,
        collectOnly: true,
    },

    // ===== STRATEGIC SPECIALS — $VIBESTR Tier Badges + Bounty Hunter =====
    // These sit between Rare and Legendary in drop weight.
    // Within this tier, Diamond and Cosmic are much harder to find (handled
    // by the dropWeight field on Badge — server uses it when selecting).
    {
        id: "vibestr_blue_tier",
        name: "$VIBESTR Blue Tier",
        image: "/badges/vibestr_blue_tier.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 20,  // common within specials
    },
    {
        id: "vibestr_bronze_tier",
        name: "$VIBESTR Bronze Tier",
        image: "/badges/vibestr_bronze_tier.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 20,
    },
    {
        id: "vibestr_silver_tier",
        name: "$VIBESTR Silver Tier",
        image: "/badges/vibestr_silver_tier.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 15,
    },
    {
        id: "vibestr_gold_tier",
        name: "$VIBESTR Gold Tier",
        image: "/badges/vibestr_gold_tier.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 12,
    },
    {
        id: "vibestr_pink_tier",
        name: "$VIBESTR Pink Tier",
        image: "/badges/vibestr_pink_tier.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 10,
    },
    {
        id: "vibestr_purple_tier",
        name: "$VIBESTR Purple Tier",
        image: "/badges/vibestr_purple_tier.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 8,
    },
    {
        id: "vibestr_diamond_tier",
        name: "$VIBESTR Diamond Tier",
        image: "/badges/vibestr_diamond_tier.webp",
        tier: "special",
        pointMultiplier: 3,
        collectOnly: true,
        dropWeight: 3,  // very rare within specials
    },
    {
        id: "vibestr_cosmic_tier",
        name: "$VIBESTR Cosmic Tier",
        image: "/badges/vibestr_cosmic_tier.webp",
        tier: "special",
        pointMultiplier: 3,
        collectOnly: true,
        dropWeight: 2,  // rarest within specials
    },
    {
        id: "vibestr_bounty_hunter",
        name: "VIBE Bounty Hunter",
        image: "/badges/vibestr_bounty_hunter.webp",
        tier: "special",
        pointMultiplier: 2,
        collectOnly: true,
        dropWeight: 10,
    },

    // Collector Milestone Badges (8) — max at Legendary, none Cosmic
    {
        id: "five_badges",
        name: "Collector of Epic Vibes",
        image: "/badges/five_badges.webp",
        tier: "blue",
        pointMultiplier: 1,
        collectOnly: true,
    },
    {
        id: "ten_badges",
        name: "Collector of Exquisite Vibes",
        image: "/badges/ten_badges.webp",
        tier: "silver",
        pointMultiplier: 2,
        collectOnly: true,
    },
    {
        id: "fifteen_badges",
        name: "Collector of Legendary Vibes",
        image: "/badges/fifteen_badges.webp",
        tier: "silver",
        pointMultiplier: 2,
        collectOnly: true,
    },
    {
        id: "twenty_badges",
        name: "Collector of Pristine Vibes",
        image: "/badges/twenty_badges.webp",
        tier: "gold",
        pointMultiplier: 3,
        collectOnly: true,
    },
    {
        id: "thirty_badges",
        name: "Collector of Transcendent Vibes",
        image: "/badges/thirty_badges.webp",
        tier: "gold",
        pointMultiplier: 3,
        collectOnly: true,
    },
    {
        id: "forty_badges",
        name: "Collector of Immaculate Vibes",
        image: "/badges/forty_badges.webp",
        tier: "gold",
        pointMultiplier: 3,
        collectOnly: true,
    },
    {
        id: "fifty_badges",
        name: "Collector of Magnificent Vibes",
        image: "/badges/fifty_badges.webp",
        tier: "gold",
        pointMultiplier: 3,
        collectOnly: true,
    },
    {
        id: "unfathomable_vibes",
        name: "Collector of Unfathomable Vibes",
        image: "/badges/unfathomable_vibes.webp",
        tier: "gold",
        pointMultiplier: 3,
        collectOnly: true,
    },
];

// Game-board-eligible badges (excludes collection-only badges)
const GAME_BADGES = BADGES.filter(b => !b.collectOnly);

// Select N random badges for a game session, ensuring tier diversity + conflict group separation
export function selectGameBadges(count: number = 6, seed?: number): Badge[] {
    const rng = seed !== undefined ? seededRandom(seed) : Math.random;

    const byTier: Record<BadgeTier, Badge[]> = {
        blue: shuffle(GAME_BADGES.filter((b) => b.tier === "blue"), rng),
        silver: shuffle(GAME_BADGES.filter((b) => b.tier === "silver"), rng),
        special: shuffle(GAME_BADGES.filter((b) => b.tier === "special"), rng),
        gold: shuffle(GAME_BADGES.filter((b) => b.tier === "gold"), rng),
        cosmic: shuffle(GAME_BADGES.filter((b) => b.tier === "cosmic"), rng),
    };

    // Distribution: 3 blue, 1 silver, 1 gold, 1 cosmic = 6 tiles
    // "special" badges are collection-only so they don't appear on the board.
    const usedGroups = new Set<number>();
    const selected: Badge[] = [
        ...selectFromTier(byTier.cosmic, 1, usedGroups),
        ...selectFromTier(byTier.gold, 1, usedGroups),
        ...selectFromTier(byTier.silver, 1, usedGroups),
        ...selectFromTier(byTier.blue, 3, usedGroups),
    ];

    return shuffle(selected, rng);
}

// Select 10 random badges for Vibe Draft pool (5 blue, 2 silver, 2 gold, 1 cosmic)
export function selectDraftPool(seed?: number): Badge[] {
    const rng = seed !== undefined ? seededRandom(seed) : Math.random;

    const byTier: Record<BadgeTier, Badge[]> = {
        blue: shuffle(GAME_BADGES.filter((b) => b.tier === "blue"), rng),
        silver: shuffle(GAME_BADGES.filter((b) => b.tier === "silver"), rng),
        special: shuffle(GAME_BADGES.filter((b) => b.tier === "special"), rng),
        gold: shuffle(GAME_BADGES.filter((b) => b.tier === "gold"), rng),
        cosmic: shuffle(GAME_BADGES.filter((b) => b.tier === "cosmic"), rng),
    };

    const usedGroups = new Set<number>();
    const pool: Badge[] = [
        ...selectFromTier(byTier.cosmic, 1, usedGroups),
        ...selectFromTier(byTier.gold, 2, usedGroups),
        ...selectFromTier(byTier.silver, 2, usedGroups),
        ...selectFromTier(byTier.blue, 5, usedGroups),
    ];

    return shuffle(pool, rng);
}

// Seeded PRNG (mulberry32)
export function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Fisher-Yates shuffle with optional RNG
function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Generate daily seed from date string
export function getDailySeed(date?: string): number {
    const d = date || new Date().toISOString().split("T")[0];
    let hash = 0;
    for (let i = 0; i < d.length; i++) {
        const char = d.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash);
}

// Conflict groups: badges in the same group should never appear together in a game (color contrast)
// Badges not in any group (straw_man, surfer, captain, shower, anchorman) have no conflicts.
export const CONFLICT_GROUPS: Record<string, number | number[]> = {
    // #1
    any_gvc: 1,
    seas_the_day: 1,
    // #2
    chris_favorite_badge: 2,
    super_rare: 2,
    grayscale_seeker: 2,
    checkmate: 2,
    poker_face: 2,
    rack_em_up: 2,
    sir_vibes_a_lot: 2,
    // #3 (includes former #6)
    one_of_one: 3,
    visooor_enjoyooor: 3,
    suited_up: 3,
    party_in_the_back: 3,
    flow_state: 3,
    highkeymoments_1: 3,
    gradient_lover: 3,
    power_duo: 3,
    pepe: 3,
    plants: 3,
    science_goggles: 3,
    // #4
    full_send_maverick: 4,
    tanks_a_lot: 4,
    patch_powerhouse: 4,
    the_completionist: 4,
    varsity_vibes: 4,
    mountain_goat: 4,
    electric_rings: 4,
    stone: 4,
    shadow_funk_division: 4,
    // #5
    pothead: 5,
    funky_fresh: 5,
    vibetown_social_club: 5,
    vibefoot_fan_club: 5,
    ladies_night: 5,
    full_throttle: 5,
    sugar_rush: 5,
    astro_bean: 5,
    plastic_lover: 5,
    homerun: 5,
    // #7
    king: 7,
    nounish_vibes: 7,
    lamp: 7,
    kinky: 7,
    hail_mary_heroes: 7,
    gud_meat: 7,
    toy_bricks: 7,
    ranger: 7,
    trait_maxi: 7,
    // #8
    rainbow_bubble_goggles: 8,
    astro_balls: 8,
    hue_too_fresh: 8,
    rainbow_citizen: 8,
    yin_n_yang: 8,
    elite_rainbow_ranger: 8,
    rainbow_visor: 8,
    // #9
    zoom_in_vibe_out: 9,
    fur_the_win: 9,
    doge: 9,
    great_stacheby: 9,
    showtime: 9,
    vibetown_baller: 9,
    no_face_no_problem: 9,
    gold_member: 9,
    tatted_up: 9,
    // #10
    necks_level: 10,
    gamer: 10,
    cosmic_guardian: 10,
    hoodie_up_society: 10,
    rainbow_boombox: 10,
    multi_type_master: 10,
    // robot_lover conflicts with groups 3, 4, and 10
    robot_lover: [3, 4, 10],
    high_noon_hustler: 10,
};

// Select badges from a shuffled tier pool while respecting conflict groups
function selectFromTier(
    pool: Badge[],
    count: number,
    usedGroups: Set<number>,
): Badge[] {
    const selected: Badge[] = [];
    for (const badge of pool) {
        if (selected.length >= count) break;
        const group = CONFLICT_GROUPS[badge.id];
        if (group !== undefined) {
            const groups = Array.isArray(group) ? group : [group];
            if (groups.some(g => usedGroups.has(g))) continue;
            for (const g of groups) usedGroups.add(g);
        }
        selected.push(badge);
    }
    return selected;
}

// Tier color map
export const TIER_COLORS: Record<BadgeTier, string> = {
    blue: "#E0E0E0",     // Grey/White = Common
    silver: "#4A9EFF",   // Blue = Rare
    special: "#FF8C42",  // Orange = Strategic Special
    gold: "#FFE048",     // Gold = Legendary
    cosmic: "#B366FF",   // Purple = Cosmic
};

export const TIER_DISPLAY_NAMES: Record<BadgeTier, string> = {
    blue: "Common",
    silver: "Rare",
    special: "Strategic Specials",
    gold: "Legendary",
    cosmic: "Cosmic",
};

export const TIER_BORDER_COLORS: Record<BadgeTier, string> = {
    blue: "rgba(224, 224, 224, 0.4)",
    silver: "rgba(74, 158, 255, 0.5)",
    special: "rgba(255, 140, 66, 0.6)",
    gold: "rgba(255, 224, 72, 0.6)",
    cosmic: "rgba(179, 102, 255, 0.7)",
};
