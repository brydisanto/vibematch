export type BadgeTier = "blue" | "silver" | "gold" | "cosmic";

export interface Badge {
    id: string;
    name: string;
    image: string;
    tier: BadgeTier;
    lore: string;
    pointMultiplier: number;
}

export const BADGES: Badge[] = [
    // ===== BLUE TIER (1×) =====
    {
        id: "any_gvc",
        name: "Any GVC",
        image: "/badges/any_gvc_1759173799963.webp",
        tier: "blue",
        lore: "A true member of the club. Any vibe is a good vibe.",
        pointMultiplier: 1,
    },
    {
        id: "baller",
        name: "Baller",
        image: "/badges/baller_1759173868839.webp",
        tier: "blue",
        lore: "Nothing but net. This one shoots for the moon.",
        pointMultiplier: 1,
    },
    {
        id: "billiards",
        name: "Billiards",
        image: "/badges/billiards_1759173890603.webp",
        tier: "blue",
        lore: "Corner pocket energy. Calculates every angle.",
        pointMultiplier: 1,
    },
    {
        id: "checkmate",
        name: "Checkmate",
        image: "/badges/checkmate_1759173863329.webp",
        tier: "blue",
        lore: "Three moves ahead. The strategist of the club.",
        pointMultiplier: 1,
    },
    {
        id: "chris_favorite_badge",
        name: "Chris Favorite Badge",
        image: "/badges/chris_favorite_badge_1759173988815.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "doge",
        name: "Doge",
        image: "/badges/doge_1759173842640.webp",
        tier: "blue",
        lore: "Much vibe. Very club. Wow.",
        pointMultiplier: 1,
    },
    {
        id: "electric_rings",
        name: "Electric Rings",
        image: "/badges/electric_rings_1759173878797.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "flow_state",
        name: "Flow State",
        image: "/badges/flow_state_1771355010910.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "full_send_maverick",
        name: "Full Send Maverick",
        image: "/badges/full_send_maverick_1759173982959.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "funky_fresh",
        name: "Funky Fresh",
        image: "/badges/funky_fresh_1759174001274.webp",
        tier: "blue",
        lore: "Groovy style, unmatched flavor. Always dripping.",
        pointMultiplier: 1,
    },
    {
        id: "fur_the_win",
        name: "Fur The Win",
        image: "/badges/fur_the_win_1759173969828.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "gradient_lover",
        name: "Gradient Lover",
        image: "/badges/gradient_lover_1759173808918.webp",
        tier: "blue",
        lore: "Life is a spectrum. Rides every color.",
        pointMultiplier: 1,
    },
    {
        id: "grayscale_seeker",
        name: "Grayscale Seeker",
        image: "/badges/grayscale_seeker_1759173797002.webp",
        tier: "blue",
        lore: "Sees the world in shades of cool.",
        pointMultiplier: 1,
    },
    {
        id: "highkeymoments_1",
        name: "Highkeymoments 1",
        image: "/badges/highkeymoments_1_1771433768524.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "hue_too_fresh",
        name: "Hue Too Fresh",
        image: "/badges/hue_too_fresh_1771355000776.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "ladies_night",
        name: "Ladies Night",
        image: "/badges/ladies_night_1759173991853.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "lamp",
        name: "Lamp",
        image: "/badges/lamp_1759173892925.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "multi_type_master",
        name: "Multi Type Master",
        image: "/badges/multi_type_master_1759173898608.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "nounish_vibes",
        name: "Nounish Vibes",
        image: "/badges/nounish_vibes_1759173973218.webp",
        tier: "blue",
        lore: "⌐◨-◨ Public good energy flows through.",
        pointMultiplier: 1,
    },
    {
        id: "pepe",
        name: "Pepe",
        image: "/badges/pepe_1759173846260.webp",
        tier: "blue",
        lore: "Feels good, man. The rarest of them all?",
        pointMultiplier: 1,
    },
    {
        id: "plants",
        name: "Plants",
        image: "/badges/plants_1759173871973.webp",
        tier: "blue",
        lore: "Rooted in good vibes. Grows organically.",
        pointMultiplier: 1,
    },
    {
        id: "plastic_lover",
        name: "Plastic Lover",
        image: "/badges/plastic_lover_1759173806081.webp",
        tier: "blue",
        lore: "Synthetic soul with a digital heartbeat.",
        pointMultiplier: 1,
    },
    {
        id: "poker_face",
        name: "Poker Face",
        image: "/badges/poker_face_1759173884906.webp",
        tier: "blue",
        lore: "Never reveals the hand. Ice cold composure.",
        pointMultiplier: 1,
    },
    {
        id: "pothead",
        name: "Pot Head",
        image: "/badges/pothead_1759173827603.webp",
        tier: "blue",
        lore: "Head in the clouds, vibes in the soul.",
        pointMultiplier: 1,
    },
    {
        id: "rainbow_boombox",
        name: "Rainbow Boombox",
        image: "/badges/rainbow_boombox_1759173875165.webp",
        tier: "blue",
        lore: "Blasting colors and beats wherever it goes.",
        pointMultiplier: 1,
    },
    {
        id: "rainbow_citizen",
        name: "Rainbow Citizen",
        image: "/badges/rainbow_citizen_1759173791000.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "robot_lover",
        name: "Robot Lover",
        image: "/badges/robot_lover_1759173802514.webp",
        tier: "blue",
        lore: "Heart of silicon, soul of steel. Beep boop.",
        pointMultiplier: 1,
    },
    {
        id: "science_goggles",
        name: "Science Goggles",
        image: "/badges/science_goggles_1759173835714.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "shower",
        name: "Shower",
        image: "/badges/shower_1759173865972.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "sir_vibes_a_lot",
        name: "Sir Vibes A Lot",
        image: "/badges/sir_vibes_a_lot_1759173980023.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "stone",
        name: "Stone",
        image: "/badges/stone_1759173815165.webp",
        tier: "blue",
        lore: "Unmovable, unshakeable. Solid as a rock.",
        pointMultiplier: 1,
    },
    {
        id: "straw_man",
        name: "Straw Man",
        image: "/badges/straw_man_1759173985595.webp",
        tier: "blue",
        lore: "Looks simple, but there's more to this one.",
        pointMultiplier: 1,
    },
    {
        id: "super_rare",
        name: "Super Rare",
        image: "/badges/super_rare_1759173833292.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "sweettooth",
        name: "Sweettooth",
        image: "/badges/sweettooth_1759173860105.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "toy_bricks",
        name: "Toy Bricks",
        image: "/badges/toy_bricks_1759173887659.webp",
        tier: "blue",
        lore: "Building blocks of the vibe ecosystem.",
        pointMultiplier: 1,
    },
    {
        id: "trait_maxi",
        name: "Trait Maxi",
        image: "/badges/trait_maxi_1771355017585.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "yin_n_yang",
        name: "Yin N Yang",
        image: "/badges/yin_n_yang_1759173942484.webp",
        tier: "blue",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1,
    },
    {
        id: "zoom_in_vibe_out",
        name: "Zoom In Vibe Out",
        image: "/badges/zoom_in_vibe_out_1759174018930.webp",
        tier: "blue",
        lore: "Look closer. The vibes get even deeper.",
        pointMultiplier: 1,
    },
    // ===== SILVER TIER (1.5×) =====
    {
        id: "anchorman",
        name: "Anchorman",
        image: "/badges/anchorman_1771355025752.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "astro_bean",
        name: "Astro Bean",
        image: "/badges/astro_bean_1759173824578.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "captain",
        name: "Captain",
        image: "/badges/captain_1759173895611.webp",
        tier: "silver",
        lore: "Leads the crew through calm and storm.",
        pointMultiplier: 1.5,
    },
    {
        id: "elite_rainbow_ranger",
        name: "Elite Rainbow Ranger",
        image: "/badges/elite_rainbow_ranger_1759174003980.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "full_throttle",
        name: "Full Throttle",
        image: "/badges/full_throttle_1759174022912.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "gamer",
        name: "Gamer",
        image: "/badges/gamer_1759173856821.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "gud_meat",
        name: "Gud Meat",
        image: "/badges/gud_meat_1759173936766.webp",
        tier: "silver",
        lore: "Grade-A quality. Juicy vibes guaranteed.",
        pointMultiplier: 1.5,
    },
    {
        id: "hail_mary_heroes",
        name: "Hail Mary Heroes",
        image: "/badges/hail_mary_heroes_1759173953534.webp",
        tier: "silver",
        lore: "Full send energy. Goes for glory every time.",
        pointMultiplier: 1.5,
    },
    {
        id: "high_noon_hustler",
        name: "High Noon Hustler",
        image: "/badges/high_noon_hustler_1759174007143.webp",
        tier: "silver",
        lore: "Fastest draw in the metaverse. Quickdraw vibes.",
        pointMultiplier: 1.5,
    },
    {
        id: "homerun",
        name: "Homerun",
        image: "/badges/homerun_1759174013207.webp",
        tier: "silver",
        lore: "Knocks it out of the park every single time.",
        pointMultiplier: 1.5,
    },
    {
        id: "hoodie_up_society",
        name: "Hoodie Up Society",
        image: "/badges/hoodie_up_society_1759174015984.webp",
        tier: "silver",
        lore: "Hooded legends. Anonymous but known by vibes.",
        pointMultiplier: 1.5,
    },
    {
        id: "king",
        name: "King",
        image: "/badges/king_1759173882056.webp",
        tier: "silver",
        lore: "Crowned by the community. Rules with grace.",
        pointMultiplier: 1.5,
    },
    {
        id: "mountain_goat",
        name: "Mountain Goat",
        image: "/badges/mountain_goat_1759174026593.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "no_face_no_problem",
        name: "No Face No Problem",
        image: "/badges/no_face_no_problem_1759173948247.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "party_in_the_back",
        name: "Party in the Back",
        image: "/badges/party_in_the_back_1759173998578.webp",
        tier: "silver",
        lore: "Business up front, chaos in the back. Mullet energy.",
        pointMultiplier: 1.5,
    },
    {
        id: "power_duo",
        name: "Power Duo",
        image: "/badges/power_duo_1759173963251.webp",
        tier: "silver",
        lore: "Two is better than one. Unstoppable pair.",
        pointMultiplier: 1.5,
    },
    {
        id: "rainbow_bubble_goggles",
        name: "Rainbow Bubble Goggles",
        image: "/badges/rainbow_bubble_goggles_1759173853819.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "ranger",
        name: "Ranger",
        image: "/badges/ranger_1759173821753.webp",
        tier: "silver",
        lore: "Patrols the edge of the known metaverse.",
        pointMultiplier: 1.5,
    },
    {
        id: "seas_the_day",
        name: "Seas The Day",
        image: "/badges/seas_the_day_1759173945252.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "showtime",
        name: "Showtime",
        image: "/badges/showtime_1759173995136.webp",
        tier: "silver",
        lore: "Curtains up. Steals the spotlight on arrival.",
        pointMultiplier: 1.5,
    },
    {
        id: "suited_up",
        name: "Suited Up",
        image: "/badges/suited_up_1759173934070.webp",
        tier: "silver",
        lore: "Dressed to impress. Clean vibes only.",
        pointMultiplier: 1.5,
    },
    {
        id: "surfer",
        name: "Surfer",
        image: "/badges/surfer_1759173830462.webp",
        tier: "silver",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 1.5,
    },
    {
        id: "tanks_a_lot",
        name: "Tanks a Lot",
        image: "/badges/tanks_a_lot_1759173976815.webp",
        tier: "silver",
        lore: "Heavy hitter. Rolls through with armored vibes.",
        pointMultiplier: 1.5,
    },
    {
        id: "varsity_vibes",
        name: "Varsity Vibes",
        image: "/badges/varsity_vibes_1759173950723.webp",
        tier: "silver",
        lore: "Letterman jacket swagger. All-star status.",
        pointMultiplier: 1.5,
    },
    {
        id: "vibefoot_fan_club",
        name: "Vibefoot Fan Club",
        image: "/badges/vibefoot_fan_club_1759173939420.webp",
        tier: "silver",
        lore: "Die-hard supporters. Stomping with style.",
        pointMultiplier: 1.5,
    },
    // ===== GOLD TIER (2×) =====
    {
        id: "astro_balls",
        name: "Astro Balls",
        image: "/badges/astro_balls_1759173838889.webp",
        tier: "gold",
        lore: "Interstellar swagger. Orbiting greatness.",
        pointMultiplier: 2,
    },
    {
        id: "gold_member",
        name: "Gold Member",
        image: "/badges/gold_member_1759173793799.webp",
        tier: "gold",
        lore: "The OG status. Everything they touch turns to gold.",
        pointMultiplier: 2,
    },
    {
        id: "great_stacheby",
        name: "Great Stacheby",
        image: "/badges/great_stacheby_1759173956903.webp",
        tier: "gold",
        lore: "Magnificent whiskers. Old sport energy.",
        pointMultiplier: 2,
    },
    {
        id: "necks_level",
        name: "Necks Level",
        image: "/badges/necks_level_1759173966777.webp",
        tier: "gold",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 2,
    },
    {
        id: "patch_powerhouse",
        name: "Patch Powerhouse",
        image: "/badges/patch_powerhouse_1771354988189.webp",
        tier: "gold",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 2,
    },
    {
        id: "rainbow_visor",
        name: "Rainbow Visor",
        image: "/badges/rainbow_visor_1759173849941.webp",
        tier: "gold",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 2,
    },
    {
        id: "shadow_funk_division",
        name: "Shadow Funk Division",
        image: "/badges/shadow_funk_division_1771355038766.webp",
        tier: "gold",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 2,
    },
    {
        id: "visooor_enjoyooor",
        name: "Visooor Enjoyooor",
        image: "/badges/visooor_enjoyooor_1759174010233.webp",
        tier: "gold",
        lore: "Fresh vibes just dropped.",
        pointMultiplier: 2,
    },
    // ===== COSMIC TIER (3×) =====
    {
        id: "cosmic_guardian",
        name: "Cosmic Guardian",
        image: "/badges/cosmic_guardian1759173818340.webp",
        tier: "cosmic",
        lore: "Transcends dimensions. Vibes from another galaxy.",
        pointMultiplier: 3,
    },
    {
        id: "one_of_one",
        name: "One of One",
        image: "/badges/one_of_one_1771354994630.webp",
        tier: "cosmic",
        lore: "The rarest of them all. Utterly unique.",
        pointMultiplier: 3,
    },
];

// Select N random badges for a game session, ensuring tier diversity
export function selectGameBadges(count: number = 6, seed?: number): Badge[] {
    const rng = seed !== undefined ? seededRandom(seed) : Math.random;

    const byTier: Record<BadgeTier, Badge[]> = {
        blue: shuffle(BADGES.filter((b) => b.tier === "blue"), rng),
        silver: shuffle(BADGES.filter((b) => b.tier === "silver"), rng),
        gold: shuffle(BADGES.filter((b) => b.tier === "gold"), rng),
        cosmic: shuffle(BADGES.filter((b) => b.tier === "cosmic"), rng),
    };

    // Distribution: 3 blue, 1 silver, 1 gold, 1 cosmic = 6 tiles
    const selected: Badge[] = [
        ...byTier.blue.slice(0, 3),
        ...byTier.silver.slice(0, 1),
        ...byTier.gold.slice(0, 1),
        ...byTier.cosmic.slice(0, 1),
    ];

    return shuffle(selected, rng);
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

// Tier color map
export const TIER_COLORS: Record<BadgeTier, string> = {
    blue: "#4A9EFF",
    silver: "#C0C0C0",
    gold: "#FFE048",
    cosmic: "#B366FF",
};

export const TIER_BORDER_COLORS: Record<BadgeTier, string> = {
    blue: "rgba(74, 158, 255, 0.5)",
    silver: "rgba(192, 192, 192, 0.5)",
    gold: "rgba(255, 224, 72, 0.6)",
    cosmic: "rgba(179, 102, 255, 0.7)",
};
