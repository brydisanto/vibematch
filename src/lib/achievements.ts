/**
 * Achievement definitions for VibeMatch.
 *
 * Two categories:
 * - Journey: sequential FTUE achievements that teach game mechanics
 * - Mastery: long-term goals for experienced players
 *
 * Each achievement awards pin capsules on completion.
 */

export type AchievementCategory = "journey" | "mastery";

export interface AchievementDef {
    id: string;
    category: AchievementCategory;
    icon: string;         // emoji
    title: string;
    description: string;
    capsules: number;     // capsule reward
    order: number;        // display order within category
}

// ── Journey achievements (FTUE) ──────────────────────────────────────

export const JOURNEY_ACHIEVEMENTS: AchievementDef[] = [
    {
        id: "first_game",
        category: "journey",
        icon: "🎮",
        title: "First Match",
        description: "Complete your first game",
        capsules: 1,
        order: 1,
    },
    {
        id: "first_combo",
        category: "journey",
        icon: "🔥",
        title: "Getting Warmer",
        description: "Reach a 2× combo",
        capsules: 1,
        order: 2,
    },
    {
        id: "first_bomb",
        category: "journey",
        icon: "💣",
        title: "Boom!",
        description: "Create your first bomb",
        capsules: 1,
        order: 3,
    },
    {
        id: "first_vibestreak",
        category: "journey",
        icon: "⚡",
        title: "Laser Party",
        description: "Create your first laser party",
        capsules: 2,
        order: 4,
    },
    {
        id: "first_cosmic",
        category: "journey",
        icon: "🌌",
        title: "Cosmic Touch",
        description: "Create your first cosmic blast",
        capsules: 3,
        order: 5,
    },
    {
        id: "first_l_shape",
        category: "journey",
        icon: "🔷",
        title: "L Is For Lit",
        description: "Land your first L shape",
        capsules: 1,
        order: 6,
    },
    {
        id: "first_t_shape",
        category: "journey",
        icon: "🔶",
        title: "T oo Sick",
        description: "Land your first T shape",
        capsules: 1,
        order: 7,
    },
    {
        id: "first_cross_shape",
        category: "journey",
        icon: "✦",
        title: "Cross That Off",
        description: "Land your first cross shape",
        capsules: 2,
        order: 8,
    },
    {
        id: "first_capsule",
        category: "journey",
        icon: "🎁",
        title: "Collector",
        description: "Open your first capsule",
        capsules: 1,
        order: 9,
    },
    {
        id: "tier_silver",
        category: "journey",
        icon: "🥈",
        title: "Rare Find",
        description: "Collect your first Rare pin",
        capsules: 1,
        order: 10,
    },
    {
        id: "tier_special",
        category: "journey",
        icon: "🔶",
        title: "Strategic Find",
        description: "Collect your first Strategic Specials pin",
        capsules: 2,
        order: 11,
    },
    {
        id: "tier_gold",
        category: "journey",
        icon: "🥇",
        title: "Gold Standard",
        description: "Collect your first Legendary pin",
        capsules: 2,
        order: 12,
    },
    {
        id: "tier_cosmic",
        category: "journey",
        icon: "✨",
        title: "Cosmic Destiny",
        description: "Collect your first Cosmic pin",
        capsules: 3,
        order: 13,
    },
    {
        id: "first_daily",
        category: "journey",
        icon: "📅",
        title: "Daily Ritual",
        description: "Finish your first Daily Challenge game",
        capsules: 1,
        order: 14,
    },
    {
        id: "streak_3",
        category: "journey",
        icon: "🔥",
        title: "Streak Starter",
        description: "Reach a 3-day streak",
        capsules: 2,
        order: 15,
    },
    {
        id: "score_25k",
        category: "journey",
        icon: "🏆",
        title: "High Roller",
        description: "Score 25,000+ in a single game",
        capsules: 2,
        order: 16,
    },
    {
        id: "upload_avatar",
        category: "journey",
        icon: "🖼️",
        title: "Face Lift",
        description: "Upload a profile picture",
        capsules: 1,
        order: 17,
    },
    {
        id: "change_music",
        category: "journey",
        icon: "🎵",
        title: "Set The Vibe",
        description: "Change your game music",
        capsules: 1,
        order: 18,
    },
];

// ── Mastery achievements ─────────────────────────────────────────────

export const MASTERY_ACHIEVEMENTS: AchievementDef[] = [
    {
        id: "cascade_5",
        category: "mastery",
        icon: "🌊",
        title: "Chain Reaction",
        description: "5+ cascades in one turn",
        capsules: 1,
        order: 1,
    },
    {
        id: "combo_5",
        category: "mastery",
        icon: "🔥",
        title: "Combo King",
        description: "Reach a 5× combo",
        capsules: 2,
        order: 2,
    },
    {
        id: "combo_6",
        category: "mastery",
        icon: "🤯",
        title: "rkf4trrgrggrgh;[['11]",
        description: "Reach a 6× combo",
        capsules: 2,
        order: 3,
    },
    {
        id: "combo_8",
        category: "mastery",
        icon: "👑",
        title: "Untouchable",
        description: "Reach an 8× combo",
        capsules: 3,
        order: 4,
    },
    {
        id: "pins_10",
        category: "mastery",
        icon: "📌",
        title: "Pin Enthusiast",
        description: "Collect 10 unique badges",
        capsules: 1,
        order: 5,
    },
    {
        id: "pins_25",
        category: "mastery",
        icon: "🎖️",
        title: "Pin Collector",
        description: "Collect 25 unique badges",
        capsules: 2,
        order: 6,
    },
    {
        id: "pins_50",
        category: "mastery",
        icon: "🏅",
        title: "Pin Hoarder",
        description: "Collect 50 unique badges",
        capsules: 3,
        order: 7,
    },
    {
        id: "pins_69",
        category: "mastery",
        icon: "🤙",
        title: "Nice Pins!",
        description: "Collect 69 unique badges",
        capsules: 3,
        order: 8,
    },
    {
        id: "pins_all",
        category: "mastery",
        icon: "💎",
        title: "Pin Completionist",
        description: "Collect all 101 badges",
        capsules: 3,
        order: 9,
    },
    {
        id: "pins_90",
        category: "mastery",
        icon: "🗃️",
        title: "Big League Collector",
        description: "Collect 90+ unique badges",
        capsules: 3,
        order: 9,
    },
    {
        id: "all_common",
        category: "mastery",
        icon: "📋",
        title: "Common Ground",
        description: "Collect all 19 Common pins",
        capsules: 2,
        order: 12,
    },
    {
        id: "all_rare",
        category: "mastery",
        icon: "🗂️",
        title: "Rare Breed",
        description: "Collect all 51 Rare pins",
        capsules: 3,
        order: 13,
    },
    {
        id: "all_legendary",
        category: "mastery",
        icon: "🏆",
        title: "Living Legend",
        description: "Collect all 19 Legendary pins",
        capsules: 3,
        order: 15,
    },
    {
        id: "all_special",
        category: "mastery",
        icon: "🔶",
        title: "Strategist",
        description: "Collect all 9 Strategic Specials pins",
        capsules: 4,
        order: 16,
    },
    {
        id: "all_cosmic",
        category: "mastery",
        icon: "🌌",
        title: "Cosmic Completionist",
        description: "Collect all 3 Cosmic pins",
        capsules: 5,
        order: 17,
    },
    {
        id: "bombs_5",
        category: "mastery",
        icon: "💥",
        title: "Bomb Squad",
        description: "Create 5 bombs in one game",
        capsules: 1,
        order: 16,
    },
    {
        id: "cascades_15",
        category: "mastery",
        icon: "⛓️",
        title: "Cascade Master",
        description: "15+ total cascades in one game",
        capsules: 2,
        order: 17,
    },
    {
        id: "cascades_30",
        category: "mastery",
        icon: "🌊",
        title: "Cascade Flood",
        description: "30+ total cascades in one game",
        capsules: 3,
        order: 17.3,
    },
    {
        id: "cascades_45",
        category: "mastery",
        icon: "🌀",
        title: "Cascade Tsunami",
        description: "45+ total cascades in one game",
        capsules: 4,
        order: 17.6,
    },
    {
        id: "score_50k",
        category: "mastery",
        icon: "⭐",
        title: "Score Legend",
        description: "Score 50,000+ in a single game",
        capsules: 2,
        order: 18,
    },
    {
        id: "score_75k",
        category: "mastery",
        icon: "💫",
        title: "Diamond Hands",
        description: "Score 75,000+ in a single game",
        capsules: 2,
        order: 19,
    },
    {
        id: "score_100k",
        category: "mastery",
        icon: "🌟",
        title: "Century Club",
        description: "Score 100,000+ in a single game",
        capsules: 3,
        order: 20,
    },
    {
        id: "streak_7",
        category: "mastery",
        icon: "🗓️",
        title: "Devoted",
        description: "Reach a 7-day streak",
        capsules: 2,
        order: 21,
    },
    {
        id: "streak_30",
        category: "mastery",
        icon: "💫",
        title: "Committed",
        description: "Reach a 30-day streak",
        capsules: 3,
        order: 22,
    },
    {
        id: "l_shapes_3",
        category: "mastery",
        icon: "🔷",
        title: "L Train",
        description: "Land 3 L shapes in one game",
        capsules: 3,
        order: 24,
    },
    {
        id: "l_shapes_5",
        category: "mastery",
        icon: "🟦",
        title: "L Express",
        description: "Land 5 L shapes in one game",
        capsules: 4,
        order: 24.5,
    },
    {
        id: "t_shapes_3",
        category: "mastery",
        icon: "🔶",
        title: "T Party",
        description: "Land 3 T shapes in one game",
        capsules: 3,
        order: 25,
    },
    {
        id: "t_shapes_5",
        category: "mastery",
        icon: "🟧",
        title: "T Tsunami",
        description: "Land 5 T shapes in one game",
        capsules: 4,
        order: 25.5,
    },
    {
        id: "shape_trifecta",
        category: "mastery",
        icon: "🔮",
        title: "Shape Trifecta",
        description: "Land an L, T, and cross in the same game",
        capsules: 3,
        order: 26,
    },
    {
        id: "daily_cap",
        category: "mastery",
        icon: "⚔️",
        title: "Weekly Warrior",
        description: "Play 15 games in one day",
        capsules: 1,
        order: 27,
    },
    {
        id: "daily_30k",
        category: "mastery",
        icon: "📅",
        title: "Daily Grinder",
        description: "Score 30,000+ in a Daily Challenge",
        capsules: 2,
        order: 28,
    },
    {
        id: "daily_50k",
        category: "mastery",
        icon: "🗓️",
        title: "Daily Demolisher",
        description: "Score 50,000+ in a Daily Challenge",
        capsules: 3,
        order: 28.5,
    },
    {
        id: "daily_champ",
        category: "mastery",
        icon: "👑",
        title: "Daily Champion",
        description: "Finish #1 on the Daily Challenge",
        capsules: 3,
        order: 29,
    },
    {
        id: "refer_1",
        category: "mastery",
        icon: "🤝",
        title: "Good Vibes Ambassador",
        description: "Refer your first friend",
        capsules: 1,
        order: 30,
    },
    {
        id: "refer_5",
        category: "mastery",
        icon: "🤙",
        title: "Vibe Recruiter",
        description: "Refer 5 friends",
        capsules: 2,
        order: 31,
    },
    {
        id: "refer_10",
        category: "mastery",
        icon: "🏄",
        title: "Vibe Commander",
        description: "Refer 10 friends",
        capsules: 3,
        order: 32,
    },
    {
        id: "buy_prize_game",
        category: "mastery",
        icon: "🪙",
        title: "Put In A Coin",
        description: "Buy at least 1 prize game with $VIBESTR",
        capsules: 1,
        order: 33,
    },
    {
        id: "wallet_vibestr",
        category: "mastery",
        icon: "💰",
        title: "Bag Holder",
        description: "Connect a wallet holding $VIBESTR",
        capsules: 2,
        order: 34,
    },
];

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
    ...JOURNEY_ACHIEVEMENTS,
    ...MASTERY_ACHIEVEMENTS,
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
    ALL_ACHIEVEMENTS.map(a => [a.id, a])
);

// ── Client-side condition checking ───────────────────────────────────

export interface GameEndStats {
    score: number;
    maxCombo: number;
    totalCascades: number;
    matchCount: number;
    bombsCreated: number;
    vibestreaksCreated: number;
    cosmicBlastsCreated: number;
    shapesLanded: { type: string; count: number }[];
    crossCount: number;
    gameMode: string;
}

export interface PlayerContext {
    streak: number;
    uniquePins: number;
    totalPinsOpened: number;
    hasSilverPin: boolean;
    hasGoldPin: boolean;
    hasCosmicPin: boolean;
    commonPinCount: number;   // unique common pins collected
    rarePinCount: number;     // unique rare pins collected
    specialPinCount: number;  // unique special pins collected
    legendaryPinCount: number; // unique legendary pins collected
    cosmicPinCount: number;   // unique cosmic pins collected
    hasSpecialPin: boolean;
    referralCount: number;
    gamesPlayedToday: number;
    /** User has uploaded a custom profile picture (avatarUrl is non-empty). */
    hasUploadedAvatar: boolean;
    /** User has explicitly selected a BGM track (localStorage vibematch_bgm_track set). */
    hasChangedMusic: boolean;
    /** User has ever had bonus prize games (so they purchased at least one). */
    hasPurchasedPrizeGame: boolean;
    /** User has connected a wallet that holds $VIBESTR (verified server-side). */
    hasVibestrWallet: boolean;
}

/**
 * Given end-of-game stats and player context, returns achievement IDs
 * that should be unlocked. Caller is responsible for filtering out
 * already-unlocked achievements.
 */
export function checkAchievements(
    stats: GameEndStats,
    context: PlayerContext,
    alreadyUnlocked: Set<string>,
): string[] {
    const newly: string[] = [];

    function check(id: string, condition: boolean) {
        if (condition && !alreadyUnlocked.has(id)) {
            newly.push(id);
        }
    }

    // Journey
    check("first_game", true); // completing any game
    check("first_combo", stats.maxCombo >= 2);
    check("first_bomb", stats.bombsCreated >= 1);
    check("first_vibestreak", stats.vibestreaksCreated >= 1);
    check("first_l_shape", stats.shapesLanded.some(s => s.type === "L"));
    check("first_t_shape", stats.shapesLanded.some(s => s.type === "T"));
    check("first_cross_shape", stats.shapesLanded.some(s => s.type === "cross"));
    check("first_capsule", context.totalPinsOpened >= 1);
    check("first_daily", stats.gameMode === "daily");
    check("streak_3", context.streak >= 3);
    check("first_cosmic", stats.cosmicBlastsCreated >= 1);
    check("score_25k", stats.score >= 25000);

    // Mastery
    check("cascade_5", stats.totalCascades >= 5);
    check("combo_5", stats.maxCombo >= 5);
    check("combo_6", stats.maxCombo >= 6);
    check("combo_8", stats.maxCombo >= 8);
    check("pins_10", context.uniquePins >= 10);
    check("pins_25", context.uniquePins >= 25);
    check("pins_50", context.uniquePins >= 50);
    check("pins_69", context.uniquePins >= 69);
    check("pins_all", context.uniquePins >= 101);
    check("tier_silver", context.hasSilverPin);
    check("tier_gold", context.hasGoldPin);
    check("tier_special", context.hasSpecialPin);
    check("tier_cosmic", context.hasCosmicPin);
    check("all_common", context.commonPinCount >= 19);
    check("all_rare", context.rarePinCount >= 51);
    check("all_special", context.specialPinCount >= 9);
    check("all_legendary", context.legendaryPinCount >= 19);
    check("all_cosmic", context.cosmicPinCount >= 3);
    check("bombs_5", stats.bombsCreated >= 5);
    check("cascades_15", stats.totalCascades >= 15);
    check("cascades_30", stats.totalCascades >= 30);
    check("cascades_45", stats.totalCascades >= 45);
    check("score_50k", stats.score >= 50000);
    check("score_75k", stats.score >= 75000);
    check("score_100k", stats.score >= 100000);
    check("streak_7", context.streak >= 7);
    check("streak_30", context.streak >= 30);
    const lCount = stats.shapesLanded.find(s => s.type === "L")?.count ?? 0;
    const tCount = stats.shapesLanded.find(s => s.type === "T")?.count ?? 0;
    const crossCount = stats.shapesLanded.find(s => s.type === "cross")?.count ?? 0;
    check("l_shapes_3", lCount >= 3);
    check("l_shapes_5", lCount >= 5);
    check("t_shapes_3", tCount >= 3);
    check("t_shapes_5", tCount >= 5);
    check("shape_trifecta", lCount > 0 && tCount > 0 && crossCount > 0);
    check("daily_cap", context.gamesPlayedToday >= 15);
    check("daily_30k", stats.gameMode === "daily" && stats.score >= 30000);
    check("daily_50k", stats.gameMode === "daily" && stats.score >= 50000);
    check("refer_1", context.referralCount >= 1);
    check("refer_5", context.referralCount >= 5);
    check("refer_10", context.referralCount >= 10);
    check("pins_90", context.uniquePins >= 90);

    // Profile / engagement quests (journey)
    check("upload_avatar", context.hasUploadedAvatar);
    check("change_music", context.hasChangedMusic);
    check("buy_prize_game", context.hasPurchasedPrizeGame);
    check("wallet_vibestr", context.hasVibestrWallet);

    return newly;
}

/**
 * Checks achievements that can be retroactively awarded based on player context
 * (pin collection, streaks, etc.) — no active game needed.
 * Called once on app load so existing players get credit for past progress.
 */
export function checkRetroactiveAchievements(
    context: PlayerContext,
    alreadyUnlocked: Set<string>,
): string[] {
    const newly: string[] = [];

    function check(id: string, condition: boolean) {
        if (condition && !alreadyUnlocked.has(id)) {
            newly.push(id);
        }
    }

    // Journey — context-based only
    check("first_capsule", context.totalPinsOpened >= 1);
    check("streak_3", context.streak >= 3);

    // Mastery — pin collection + streaks
    check("pins_10", context.uniquePins >= 10);
    check("pins_25", context.uniquePins >= 25);
    check("pins_50", context.uniquePins >= 50);
    check("pins_69", context.uniquePins >= 69);
    check("pins_90", context.uniquePins >= 90);
    check("pins_all", context.uniquePins >= 101);
    check("tier_silver", context.hasSilverPin);
    check("tier_gold", context.hasGoldPin);
    check("tier_special", context.hasSpecialPin);
    check("tier_cosmic", context.hasCosmicPin);
    check("all_common", context.commonPinCount >= 19);
    check("all_rare", context.rarePinCount >= 51);
    check("all_special", context.specialPinCount >= 9);
    check("all_legendary", context.legendaryPinCount >= 19);
    check("all_cosmic", context.cosmicPinCount >= 3);
    check("streak_7", context.streak >= 7);
    check("streak_30", context.streak >= 30);
    check("refer_1", context.referralCount >= 1);
    check("refer_5", context.referralCount >= 5);
    check("refer_10", context.referralCount >= 10);

    // Profile / engagement — derived from context flags
    check("upload_avatar", context.hasUploadedAvatar);
    check("change_music", context.hasChangedMusic);
    check("buy_prize_game", context.hasPurchasedPrizeGame);
    check("wallet_vibestr", context.hasVibestrWallet);

    return newly;
}

/**
 * Checks achievements that can trigger mid-game (after each turn).
 * Only includes achievements detectable from a single turn result.
 */
export function checkMidGameAchievements(
    turnCombo: number,
    turnCascades: number,
    specialsCreated: string[],
    shapeType: string | null,
    alreadyUnlocked: Set<string>,
): string[] {
    const newly: string[] = [];

    function check(id: string, condition: boolean) {
        if (condition && !alreadyUnlocked.has(id)) {
            newly.push(id);
        }
    }

    check("first_combo", turnCombo >= 2);
    check("first_bomb", specialsCreated.includes("bomb"));
    check("first_vibestreak", specialsCreated.includes("vibestreak"));
    check("first_cosmic", specialsCreated.includes("cosmic_blast"));
    check("first_l_shape", shapeType === "L");
    check("first_t_shape", shapeType === "T");
    check("first_cross_shape", shapeType === "cross");
    check("combo_5", turnCombo >= 5);
    check("combo_6", turnCombo >= 6);
    check("combo_8", turnCombo >= 8);
    check("cascade_5", turnCascades >= 5);

    return newly;
}
