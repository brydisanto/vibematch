import Foundation

// MARK: - Seeded PRNG (mulberry32 - bit-compatible with TypeScript version)

/// A seeded pseudo-random number generator using the mulberry32 algorithm.
/// Produces identical sequences to the TypeScript implementation given the same seed.
struct SeededRandom: RandomNumberGenerator {
    private var state: Int32

    init(seed: Int) {
        // JS `s |= 0` coerces to signed 32-bit integer
        self.state = Int32(truncatingIfNeeded: seed)
    }

    /// Returns a value in [0, 1) identical to the TypeScript `seededRandom` output.
    mutating func nextDouble() -> Double {
        // s = (s + 0x6D2B79F5) | 0
        state = state &+ 0x6D2B_79F5

        // Reinterpret as unsigned for bitwise ops, then back to signed where needed.
        var t: UInt32 = UInt32(bitPattern: state)

        // let t = Math.imul(s ^ (s >>> 15), 1 | s)
        let xor1 = t ^ (t >> 15)
        let or1 = t | 1
        t = xor1 &* or1

        // t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        let xor2 = t ^ (t >> 7)
        let or2 = t | 61
        let product = xor2 &* or2
        t = (t &+ product) ^ t

        // return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        let result = t ^ (t >> 14)
        return Double(result) / 4294967296.0
    }

    /// RandomNumberGenerator conformance — produces a UInt64 from two mulberry32 calls.
    mutating func next() -> UInt64 {
        let hi = UInt64(UInt32(nextDouble() * 4294967296.0))
        let lo = UInt64(UInt32(nextDouble() * 4294967296.0))
        return (hi << 32) | lo
    }
}

// MARK: - Daily Seed

/// Generates a deterministic seed from a date string "YYYY-MM-DD".
/// Bit-compatible with the TypeScript `getDailySeed` function.
func getDailySeed(date: String? = nil) -> Int {
    let d: String
    if let date = date {
        d = date
    } else {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        d = formatter.string(from: Date())
    }

    var hash: Int32 = 0
    for char in d.utf16 {
        // hash = ((hash << 5) - hash + char) | 0
        let shifted = hash &<< 5
        hash = shifted &- hash &+ Int32(char)
    }

    // JS Math.abs — returns positive. In JS, Math.abs(-2147483648) = 2147483648
    // which exceeds Int32 range but is fine as a JS number.
    // We use Int to hold the absolute value safely.
    if hash == Int32.min {
        return Int(2147483648)
    }
    return Int(abs(hash))
}

// MARK: - Badge Catalog
// Synced with web src/lib/badges.ts — 101 badges total
// Game board: 15 Common (blue, 1x), 46 Rare (silver, 1.5x), 13 Legendary (gold, 2x), 3 Cosmic (cosmic, 3x) = 77
// Collect-only: 4 Common, 3 Rare, 9 Legendary, 9 Strategic Specials = 24
// collectOnly badges appear in capsule drops / pin book only, never on the game board

let BADGES: [Badge] = [
    // ===== COMMON TIER (1×) — 15 badges =====
    Badge(id: "any_gvc", name: "Citizen of Vibetown", image: "/badges/any_gvc_1759173799963.webp", tier: .blue, lore: "Every journey starts with a vibe.", pointMultiplier: 1.0),
    Badge(id: "full_send_maverick", name: "Full Send Maverick", image: "/badges/full_send_maverick_1759173982959.webp", tier: .blue, lore: "No half-sends allowed.", pointMultiplier: 1.0),
    Badge(id: "funky_fresh", name: "Funky Fresh", image: "/badges/funky_fresh_1759174001274.webp", tier: .blue, lore: "Fresh out the funk factory.", pointMultiplier: 1.0),
    Badge(id: "gradient_lover", name: "Gradient Gatherer", image: "/badges/gradient_lover_1759173808918.webp", tier: .blue, lore: "Life's better in gradients.", pointMultiplier: 1.0),
    Badge(id: "highkeymoments_1", name: "Highkey Moments", image: "/badges/highkeymoments_1_1771433768524.webp", tier: .blue, lore: "Capturing the highs.", pointMultiplier: 1.0),
    Badge(id: "visooor_enjoyooor", name: "Visooor Enjoyooor", image: "/badges/visooor_enjoyooor_1759174010233.webp", tier: .blue, lore: "See it. Enjoy it.", pointMultiplier: 1.0),
    Badge(id: "ladies_night", name: "Ladies Night", image: "/badges/ladies_night_1759173991853.webp", tier: .blue, lore: "The vibes are immaculate.", pointMultiplier: 1.0),
    Badge(id: "necks_level", name: "Necks Level", image: "/badges/necks_level_1759173966777.webp", tier: .blue, lore: "Taking it to the necks level.", pointMultiplier: 1.0),
    Badge(id: "multi_type_master", name: "Multi-Type Master", image: "/badges/multi_type_master_1759173898608.webp", tier: .blue, lore: "A master of many types.", pointMultiplier: 1.0),
    Badge(id: "vibetown_social_club", name: "Vibetown Social Club", image: "/badges/vibetown_social_club_1759173960008.webp", tier: .blue, lore: "Members only. Vibes required.", pointMultiplier: 1.0),
    Badge(id: "plastic_lover", name: "Plastic Pioneer", image: "/badges/plastic_lover_1759173806081.webp", tier: .blue, lore: "Vinyl dreams in a digital world.", pointMultiplier: 1.0),
    Badge(id: "hail_mary_heroes", name: "Hail Mary Heroes", image: "/badges/hail_mary_heroes_1759173953534.webp", tier: .blue, lore: "When in doubt, throw it deep.", pointMultiplier: 1.0),
    Badge(id: "seas_the_day", name: "Seas The Day", image: "/badges/seas_the_day_1759173945252.webp", tier: .blue, lore: "Catch the wave.", pointMultiplier: 1.0),
    Badge(id: "robot_lover", name: "Love At First Byte", image: "/badges/robot_lover_1759173802514.webp", tier: .blue, lore: "01001100 01001111 01010110 01000101.", pointMultiplier: 1.0),
    Badge(id: "suited_up", name: "Suited Up", image: "/badges/suited_up_1759173934070.webp", tier: .blue, lore: "Dress sharp, vibe sharper.", pointMultiplier: 1.0),

    // ===== RARE TIER (1.5x) — 46 badges =====
    Badge(id: "pothead", name: "High Vibes", image: "/badges/pothead_1759173827603.webp", tier: .silver, lore: "Elevated state of mind.", pointMultiplier: 1.5),
    Badge(id: "rainbow_boombox", name: "Bass In Your Face", image: "/badges/rainbow_boombox_1759173875165.webp", tier: .silver, lore: "Drop the bass, catch the rainbow.", pointMultiplier: 1.5),
    Badge(id: "flow_state", name: "Flow State", image: "/badges/flow_state_1771355010910.webp", tier: .silver, lore: "In the zone.", pointMultiplier: 1.5),
    Badge(id: "kinky", name: "Kinky", image: "/badges/kinky_1771355046536.webp", tier: .silver, lore: "A little twist never hurt.", pointMultiplier: 1.5),
    Badge(id: "checkmate", name: "No Pawn Intended", image: "/badges/checkmate_1759173863329.webp", tier: .silver, lore: "Strategic vibes only.", pointMultiplier: 1.5),
    Badge(id: "fur_the_win", name: "Fur The Win", image: "/badges/fur_the_win_1759173969828.webp", tier: .silver, lore: "Furry and fierce.", pointMultiplier: 1.5),
    Badge(id: "grayscale_seeker", name: "Grailscale Hunter", image: "/badges/grayscale_seeker_1759173797002.webp", tier: .silver, lore: "Finding beauty in the grays.", pointMultiplier: 1.5),
    Badge(id: "poker_face", name: "Pocket Rockets", image: "/badges/poker_face_1759173884906.webp", tier: .silver, lore: "Never show your hand.", pointMultiplier: 1.5),
    Badge(id: "rainbow_citizen", name: "Rainbow Maxi", image: "/badges/rainbow_citizen_1759173791000.webp", tier: .silver, lore: "All in on the spectrum.", pointMultiplier: 1.5),
    Badge(id: "trait_maxi", name: "Trait Maxi", image: "/badges/trait_maxi_1771355017585.webp", tier: .silver, lore: "Maximizing every trait.", pointMultiplier: 1.5),
    Badge(id: "yin_n_yang", name: "Yin N' Yang", image: "/badges/yin_n_yang_1759173942484.webp", tier: .silver, lore: "Balance in all things.", pointMultiplier: 1.5),
    Badge(id: "zoom_in_vibe_out", name: "Zoom In, Vibe Out", image: "/badges/zoom_in_vibe_out_1759174018930.webp", tier: .silver, lore: "Focus on the vibes.", pointMultiplier: 1.5),
    Badge(id: "science_goggles", name: "Atomic Aura", image: "/badges/science_goggles_1759173835714.webp", tier: .silver, lore: "Science meets style.", pointMultiplier: 1.5),
    Badge(id: "toy_bricks", name: "Brick By Brick", image: "/badges/toy_bricks_1759173887659.webp", tier: .silver, lore: "Building something great.", pointMultiplier: 1.5),
    Badge(id: "plants", name: "Aloe You Vera Much", image: "/badges/plants_1759173871973.webp", tier: .silver, lore: "Growing vibes naturally.", pointMultiplier: 1.5),
    Badge(id: "hue_too_fresh", name: "Hue Too Fresh", image: "/badges/hue_too_fresh_1771355000776.webp", tier: .silver, lore: "Too fresh to handle.", pointMultiplier: 1.5),
    Badge(id: "chris_favorite_badge", name: "Chris' Favorite Badge", image: "/badges/chris_favorite_badge_1759173988815.webp", tier: .silver, lore: "Chris approved.", pointMultiplier: 1.5),
    Badge(id: "anchorman", name: "Anchorman", image: "/badges/anchorman_1771355025752.webp", tier: .silver, lore: "Stay classy.", pointMultiplier: 1.5),
    Badge(id: "doge", name: "Shiba Syndicate", image: "/badges/doge_1759173842640.webp", tier: .silver, lore: "Much vibe. Very wow.", pointMultiplier: 1.5),
    Badge(id: "captain", name: "Oh Captain, My Captain", image: "/badges/captain_1759173895611.webp", tier: .silver, lore: "Leading the vibes.", pointMultiplier: 1.5),
    Badge(id: "elite_rainbow_ranger", name: "Elite Rainbow Ranger", image: "/badges/elite_rainbow_ranger_1759174003980.webp", tier: .silver, lore: "Elite spectrum guardian.", pointMultiplier: 1.5),
    Badge(id: "full_throttle", name: "Full Throttle", image: "/badges/full_throttle_1759174022912.webp", tier: .silver, lore: "No speed limits here.", pointMultiplier: 1.5),
    Badge(id: "gamer", name: "360 No Scope", image: "/badges/gamer_1759173856821.webp", tier: .silver, lore: "All skill, no luck.", pointMultiplier: 1.5),
    Badge(id: "gud_meat", name: "Gud Meat", image: "/badges/gud_meat_1759173936766.webp", tier: .silver, lore: "Well done.", pointMultiplier: 1.5),
    Badge(id: "rack_em_up", name: "Rack 'Em Up", image: "/badges/rack_'em_up_1759173890603.webp", tier: .silver, lore: "Break and run.", pointMultiplier: 1.5),
    Badge(id: "high_noon_hustler", name: "High Noon Hustler", image: "/badges/high_noon_hustler_1759174007143.webp", tier: .silver, lore: "Draw fast, vibe faster.", pointMultiplier: 1.5),
    Badge(id: "homerun", name: "Homerun", image: "/badges/homerun_1759174013207.webp", tier: .silver, lore: "Out of the park.", pointMultiplier: 1.5),
    Badge(id: "pepe", name: "Pepe Posse", image: "/badges/pepe_1759173846260.webp", tier: .silver, lore: "Feels good, man.", pointMultiplier: 1.5),
    Badge(id: "shower", name: "Soaked N' Stoked", image: "/badges/shower_1759173865972.webp", tier: .silver, lore: "Clean vibes only.", pointMultiplier: 1.5),
    Badge(id: "mountain_goat", name: "Mountain GOAT", image: "/badges/mountain_goat_1759174026593.webp", tier: .silver, lore: "Peak performance.", pointMultiplier: 1.5),
    Badge(id: "no_face_no_problem", name: "No Face, No Problem", image: "/badges/no_face_no_problem_1759173948247.webp", tier: .silver, lore: "Mystery is the ultimate vibe.", pointMultiplier: 1.5),
    Badge(id: "party_in_the_back", name: "Party in the Back", image: "/badges/party_in_the_back_1759173998578.webp", tier: .silver, lore: "Business in the front.", pointMultiplier: 1.5),
    Badge(id: "power_duo", name: "Power Duo", image: "/badges/power_duo_1759173963251.webp", tier: .silver, lore: "Better together.", pointMultiplier: 1.5),
    Badge(id: "rainbow_bubble_goggles", name: "Bubble Visionary", image: "/badges/rainbow_bubble_goggles_1759173853819.webp", tier: .silver, lore: "Seeing the world through bubbles.", pointMultiplier: 1.5),
    Badge(id: "sir_vibes_a_lot", name: "Sir Vibes-a-Lot", image: "/badges/sir_vibes_a_lot_1759173980023.webp", tier: .silver, lore: "Knighted for exceptional vibes.", pointMultiplier: 1.5),
    Badge(id: "showtime", name: "Showtime", image: "/badges/showtime_1759173995136.webp", tier: .silver, lore: "The show must go on.", pointMultiplier: 1.5),
    Badge(id: "super_rare", name: "SuperRare", image: "/badges/super_rare_1759173833292.webp", tier: .silver, lore: "One of a kind.", pointMultiplier: 1.5),
    Badge(id: "patch_powerhouse", name: "Patch Powerhouse", image: "/badges/patch_powerhouse_1771354988189.webp", tier: .silver, lore: "Patched and powerful.", pointMultiplier: 1.5),
    Badge(id: "tanks_a_lot", name: "Tanks A Lot", image: "/badges/tanks_a_lot_1759173976815.webp", tier: .silver, lore: "Heavy vibes rolling in.", pointMultiplier: 1.5),
    Badge(id: "tatted_up", name: "Tatted Up", image: "/badges/tatted_up_1771355030286.webp", tier: .silver, lore: "Ink tells the story.", pointMultiplier: 1.5),
    Badge(id: "varsity_vibes", name: "Varsity Vibes", image: "/badges/varsity_vibes_1759173950723.webp", tier: .silver, lore: "Making the varsity team.", pointMultiplier: 1.5),
    Badge(id: "vibefoot_fan_club", name: "Vibefoot Fan Club", image: "/badges/vibefoot_fan_club_1759173939420.webp", tier: .silver, lore: "Fan club president.", pointMultiplier: 1.5),
    Badge(id: "nounish_vibes", name: "Nounish Vibes", image: "/badges/nounish_vibes_1759173973218.webp", tier: .silver, lore: "Nouns are a vibe.", pointMultiplier: 1.5),
    Badge(id: "ranger", name: "Vibe Ranger", image: "/badges/ranger_1759173821753.webp", tier: .silver, lore: "Patrolling the vibe frontier.", pointMultiplier: 1.5),
    Badge(id: "rainbow_visor", name: "Hue Got This", image: "/badges/rainbow_visor_1759173849941.webp", tier: .silver, lore: "Seeing clearly through color.", pointMultiplier: 1.5),
    Badge(id: "great_stacheby", name: "Great 'Stacheby", image: "/badges/great_stacheby_1759173956903.webp", tier: .silver, lore: "The great mustache gatsby.", pointMultiplier: 1.5),
    Badge(id: "hoodie_up_society", name: "Hoodie Up Society", image: "/badges/hoodie_up_society_1759174015984.webp", tier: .gold, lore: "Hood up, vibes on.", pointMultiplier: 2.0),

    // ===== LEGENDARY TIER (2×) — 13 badges =====
    Badge(id: "surfer", name: "Get Pitted", image: "/badges/surfer_1759173830462.webp", tier: .gold, lore: "So pitted.", pointMultiplier: 2.0),
    Badge(id: "astro_balls", name: "Stellar Spheres", image: "/badges/astro_balls_1759173838889.webp", tier: .gold, lore: "Cosmic spheres of power.", pointMultiplier: 2.0),
    Badge(id: "gold_member", name: "Golden Fever", image: "/badges/gold_member_1759173793799.webp", tier: .gold, lore: "Everything it touches turns gold.", pointMultiplier: 2.0),
    Badge(id: "shadow_funk_division", name: "Shadow Funk Division", image: "/badges/shadow_funk_division_1771355038766.webp", tier: .gold, lore: "Operating from the shadows.", pointMultiplier: 2.0),
    Badge(id: "straw_man", name: "Straw Man", image: "/badges/straw_man_1759173985595.webp", tier: .gold, lore: "Not just an argument.", pointMultiplier: 2.0),
    Badge(id: "king", name: "Vibetown Royalty", image: "/badges/king_1759173882056.webp", tier: .gold, lore: "Bow to the vibe king.", pointMultiplier: 2.0),
    Badge(id: "stone", name: "Marble Potential", image: "/badges/stone_1759173815165.webp", tier: .gold, lore: "Chiseled from pure potential.", pointMultiplier: 2.0),
    Badge(id: "lamp", name: "I Love Lamp", image: "/badges/lamp_1759173892925.webp", tier: .gold, lore: "Illuminating the vibes.", pointMultiplier: 2.0),
    Badge(id: "electric_rings", name: "Watt's Up", image: "/badges/electric_rings_1759173878797.webp", tier: .gold, lore: "Electrifying presence.", pointMultiplier: 2.0),
    Badge(id: "astro_bean", name: "AstroBean", image: "/badges/astro_bean_1759173824578.webp", tier: .gold, lore: "One small bean for mankind.", pointMultiplier: 2.0),
    Badge(id: "vibetown_baller", name: "Vibetown Baller", image: "/badges/vibetown_baller_1759173868839.webp", tier: .gold, lore: "Ballin' in vibetown.", pointMultiplier: 2.0),
    Badge(id: "sugar_rush", name: "Sugar Rush", image: "/badges/sugar_rush_1759173860105.webp", tier: .gold, lore: "Sweet, sweet chaos.", pointMultiplier: 2.0),

    // ===== COSMIC TIER (3x) — 3 badges =====
    Badge(id: "cosmic_guardian", name: "Cosmic Guardian", image: "/badges/cosmic_guardian1759173818340.webp", tier: .cosmic, lore: "Guardian of the cosmic vibes.", pointMultiplier: 3.0),
    Badge(id: "one_of_one", name: "One of One", image: "/badges/one_of_one_1771354994630.webp", tier: .cosmic, lore: "There is only one.", pointMultiplier: 3.0),
    Badge(id: "the_completionist", name: "The Completionist", image: "/badges/the_completionist_1771355052089.webp", tier: .cosmic, lore: "Gotta catch 'em all.", pointMultiplier: 3.0),

    // ===== COLLECTION-ONLY BADGES — 24 badges =====
    // These badges appear only in capsule drops and the pin book.
    // They are never placed on the game board.

    // -- Hatrick & High Five series (milestone rewards) --
    Badge(id: "gradient_hatrick", name: "Gradient Hatrick", image: "/badges/gradient_hatrick.webp", tier: .blue, lore: "Three gradients, one hat trick.", pointMultiplier: 1.0, collectOnly: true),
    Badge(id: "plastic_hatrick", name: "Plastic Hatrick", image: "/badges/plastic_hatrick.webp", tier: .blue, lore: "Three plastics, one hat trick.", pointMultiplier: 1.0, collectOnly: true),
    Badge(id: "robot_hatrick", name: "Robot Hatrick", image: "/badges/robot_hatrick.webp", tier: .blue, lore: "Three robots, one hat trick.", pointMultiplier: 1.0, collectOnly: true),
    Badge(id: "gradient_high_five", name: "Gradient High Five", image: "/badges/gradient_high_five.webp", tier: .silver, lore: "Five gradients, high five!", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "plastic_high_five", name: "Plastic High Five", image: "/badges/plastic_high_five.webp", tier: .silver, lore: "Five plastics, high five!", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "robot_high_five", name: "Robot High Five", image: "/badges/robot_high_five.webp", tier: .silver, lore: "Five robots, high five!", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "highkeymoments_2", name: "HighKey Moments II", image: "/badges/highkeymoments_2.webp", tier: .gold, lore: "The sequel is even better.", pointMultiplier: 3.0, collectOnly: true),

    // -- Collector milestone badges --
    Badge(id: "five_badges", name: "Collector of Epic Vibes", image: "/badges/five_badges.webp", tier: .blue, lore: "Five vibes collected.", pointMultiplier: 1.0, collectOnly: true),
    Badge(id: "ten_badges", name: "Collector of Exquisite Vibes", image: "/badges/ten_badges.webp", tier: .silver, lore: "Ten vibes and counting.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "fifteen_badges", name: "Collector of Legendary Vibes", image: "/badges/fifteen_badges.webp", tier: .silver, lore: "Fifteen vibes deep.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "twenty_badges", name: "Collector of Pristine Vibes", image: "/badges/twenty_badges.webp", tier: .gold, lore: "Twenty pristine vibes.", pointMultiplier: 3.0, collectOnly: true),
    Badge(id: "thirty_badges", name: "Collector of Transcendent Vibes", image: "/badges/thirty_badges.webp", tier: .gold, lore: "Thirty transcendent vibes.", pointMultiplier: 3.0, collectOnly: true),
    Badge(id: "forty_badges", name: "Collector of Immaculate Vibes", image: "/badges/forty_badges.webp", tier: .gold, lore: "Forty immaculate vibes.", pointMultiplier: 3.0, collectOnly: true),
    Badge(id: "fifty_badges", name: "Collector of Magnificent Vibes", image: "/badges/fifty_badges.webp", tier: .gold, lore: "Fifty magnificent vibes.", pointMultiplier: 3.0, collectOnly: true),
    Badge(id: "unfathomable_vibes", name: "Collector of Unfathomable Vibes", image: "/badges/unfathomable_vibes.webp", tier: .gold, lore: "Beyond comprehension.", pointMultiplier: 3.0, collectOnly: true),

    // -- $VIBESTR Strategic Specials (9 badges) --
    Badge(id: "vibestr_blue_tier", name: "$VIBESTR Blue Tier", image: "/badges/vibestr_blue_tier.webp", tier: .special, lore: "Entry-level VIBESTR holder.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "vibestr_bronze_tier", name: "$VIBESTR Bronze Tier", image: "/badges/vibestr_bronze_tier.webp", tier: .special, lore: "Bronze VIBESTR holder.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "vibestr_silver_tier", name: "$VIBESTR Silver Tier", image: "/badges/vibestr_silver_tier.webp", tier: .special, lore: "Silver VIBESTR holder.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "vibestr_gold_tier", name: "$VIBESTR Gold Tier", image: "/badges/vibestr_gold_tier.webp", tier: .special, lore: "Gold VIBESTR holder.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "vibestr_pink_tier", name: "$VIBESTR Pink Tier", image: "/badges/vibestr_pink_tier.webp", tier: .special, lore: "Pink VIBESTR holder.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "vibestr_purple_tier", name: "$VIBESTR Purple Tier", image: "/badges/vibestr_purple_tier.webp", tier: .special, lore: "Purple VIBESTR holder.", pointMultiplier: 2.0, collectOnly: true),
    Badge(id: "vibestr_diamond_tier", name: "$VIBESTR Diamond Tier", image: "/badges/vibestr_diamond_tier.webp", tier: .special, lore: "Diamond VIBESTR holder.", pointMultiplier: 3.0, collectOnly: true),
    Badge(id: "vibestr_cosmic_tier", name: "$VIBESTR Cosmic Tier", image: "/badges/vibestr_cosmic_tier.webp", tier: .special, lore: "Cosmic VIBESTR holder.", pointMultiplier: 3.0, collectOnly: true),
    Badge(id: "vibestr_bounty_hunter", name: "VIBE Bounty Hunter", image: "/badges/vibestr_bounty_hunter.webp", tier: .special, lore: "Hunting vibes across the galaxy.", pointMultiplier: 2.0, collectOnly: true),
]

// MARK: - Conflict Groups
// Synced with web src/lib/badges.ts — badges in the same group should never appear together

/// Maps badge IDs to conflict group numbers. Badges in the same group
/// should never appear together in the same game session.
/// A badge can belong to multiple groups (e.g. robot_lover conflicts with 3, 4, and 10).
let CONFLICT_GROUPS: [String: [Int]] = [
    // #1
    "any_gvc": [1],
    "seas_the_day": [1],
    // #2
    "chris_favorite_badge": [2],
    "super_rare": [2],
    "grayscale_seeker": [2],
    "checkmate": [2],
    "poker_face": [2],
    "rack_em_up": [2],
    "sir_vibes_a_lot": [2],
    // #3 (includes former #6)
    "one_of_one": [3],
    "visooor_enjoyooor": [3],
    "suited_up": [3],
    "party_in_the_back": [3],
    "flow_state": [3],
    "highkeymoments_1": [3],
    "gradient_lover": [3],
    "power_duo": [3],
    "pepe": [3],
    "plants": [3],
    "science_goggles": [3],
    // #4
    "full_send_maverick": [4],
    "tanks_a_lot": [4],
    "patch_powerhouse": [4],
    "the_completionist": [4],
    "varsity_vibes": [4],
    "mountain_goat": [4],
    "electric_rings": [4],
    "stone": [4],
    "shadow_funk_division": [4],
    // #5
    "pothead": [5],
    "funky_fresh": [5],
    "vibetown_social_club": [5],
    "vibefoot_fan_club": [5],
    "ladies_night": [5],
    "full_throttle": [5],
    "sugar_rush": [5],
    "astro_bean": [5],
    "plastic_lover": [5],
    "homerun": [5],
    // #7
    "king": [7],
    "nounish_vibes": [7],
    "lamp": [7],
    "kinky": [7],
    "hail_mary_heroes": [7],
    "gud_meat": [7],
    "toy_bricks": [7],
    "ranger": [7],
    "trait_maxi": [7],
    // #8
    "rainbow_bubble_goggles": [8],
    "astro_balls": [8],
    "hue_too_fresh": [8],
    "rainbow_citizen": [8],
    "yin_n_yang": [8],
    "elite_rainbow_ranger": [8],
    "rainbow_visor": [8],
    // #9
    "zoom_in_vibe_out": [9],
    "fur_the_win": [9],
    "doge": [9],
    "great_stacheby": [9],
    "showtime": [9],
    "vibetown_baller": [9],
    "no_face_no_problem": [9],
    "gold_member": [9],
    "tatted_up": [9],
    // #10
    "necks_level": [10],
    "gamer": [10],
    "cosmic_guardian": [10],
    "hoodie_up_society": [10],
    "rainbow_boombox": [10],
    "multi_type_master": [10],
    "high_noon_hustler": [10],
    // robot_lover conflicts with groups 3, 4, and 10
    "robot_lover": [3, 4, 10],
]

/// Selects badges from a shuffled tier pool while respecting conflict groups.
/// Badges whose conflict group is already used by a previously selected badge are skipped.
private func selectFromTier(_ pool: [Badge], count: Int, usedGroups: inout Set<Int>) -> [Badge] {
    var selected: [Badge] = []
    for badge in pool {
        if selected.count >= count { break }
        if let groups = CONFLICT_GROUPS[badge.id] {
            if groups.contains(where: { usedGroups.contains($0) }) { continue }
            for g in groups { usedGroups.insert(g) }
        }
        selected.append(badge)
    }
    return selected
}

// MARK: - Fisher-Yates Shuffle

/// Fisher-Yates shuffle using a seeded PRNG. Bit-compatible with TypeScript version.
private func shuffle<T>(_ array: [T], rng: inout SeededRandom) -> [T] {
    var result = array
    guard result.count > 1 else { return result }
    for i in stride(from: result.count - 1, through: 1, by: -1) {
        let j = Int(floor(rng.nextDouble() * Double(i + 1)))
        result.swapAt(i, j)
    }
    return result
}

// MARK: - Badge Selection

/// Selects 6 badges for a game session using tier distribution: 3 blue, 1 silver, 1 gold, 1 cosmic.
/// Uses Fisher-Yates shuffle with the seeded PRNG for cross-platform determinism.
/// CRITICAL: Selects cosmic FIRST to guarantee its conflict group is reserved.
/// Previously, selecting blue/silver/gold first could consume all 3 cosmic conflict groups
/// (3, 4, 10), leaving zero valid cosmic picks → only 5 tiles on the board.
func selectGameBadges(count: Int = 6, seed: Int? = nil) -> [Badge] {
    var rng: SeededRandom
    if let seed = seed {
        rng = SeededRandom(seed: seed)
    } else {
        rng = SeededRandom(seed: getDailySeed())
    }

    // Only game-board eligible badges (exclude collectOnly)
    let gameBadges = BADGES.filter { !$0.collectOnly }
    let blueBadges = shuffle(gameBadges.filter { $0.tier == .blue }, rng: &rng)
    let silverBadges = shuffle(gameBadges.filter { $0.tier == .silver }, rng: &rng)
    let goldBadges = shuffle(gameBadges.filter { $0.tier == .gold }, rng: &rng)
    let cosmicBadges = shuffle(gameBadges.filter { $0.tier == .cosmic }, rng: &rng)

    // Distribution: 3 blue, 1 silver, 1 gold, 1 cosmic = 6 tiles
    // Select cosmic FIRST, then gold, silver, blue — rarest tiers reserve their groups first
    var usedGroups = Set<Int>()
    var selected: [Badge] = []
    selected.append(contentsOf: selectFromTier(cosmicBadges, count: 1, usedGroups: &usedGroups))
    selected.append(contentsOf: selectFromTier(goldBadges, count: 1, usedGroups: &usedGroups))
    selected.append(contentsOf: selectFromTier(silverBadges, count: 1, usedGroups: &usedGroups))
    selected.append(contentsOf: selectFromTier(blueBadges, count: 3, usedGroups: &usedGroups))

    // Safety: if conflict groups somehow prevented full selection, fill remaining slots
    // without conflict group filtering to guarantee exactly `count` badges
    if selected.count < count {
        let usedIds = Set(selected.map { $0.id })
        let remaining = gameBadges.filter { !usedIds.contains($0.id) }
        var shuffledRemaining = shuffle(remaining, rng: &rng)
        while selected.count < count && !shuffledRemaining.isEmpty {
            selected.append(shuffledRemaining.removeFirst())
        }
    }

    return shuffle(selected, rng: &rng)
}

/// Selects 10 random badges for Vibe Draft pool (5 blue, 2 silver, 2 gold, 1 cosmic).
/// Cosmic selected first to prevent conflict group exhaustion.
func selectDraftPool(seed: Int? = nil) -> [Badge] {
    var rng: SeededRandom
    if let seed = seed {
        rng = SeededRandom(seed: seed)
    } else {
        rng = SeededRandom(seed: getDailySeed())
    }

    // Only game-board eligible badges (exclude collectOnly)
    let gameBadges = BADGES.filter { !$0.collectOnly }
    let blueBadges = shuffle(gameBadges.filter { $0.tier == .blue }, rng: &rng)
    let silverBadges = shuffle(gameBadges.filter { $0.tier == .silver }, rng: &rng)
    let goldBadges = shuffle(gameBadges.filter { $0.tier == .gold }, rng: &rng)
    let cosmicBadges = shuffle(gameBadges.filter { $0.tier == .cosmic }, rng: &rng)

    var usedGroups = Set<Int>()
    var pool: [Badge] = []
    pool.append(contentsOf: selectFromTier(cosmicBadges, count: 1, usedGroups: &usedGroups))
    pool.append(contentsOf: selectFromTier(goldBadges, count: 2, usedGroups: &usedGroups))
    pool.append(contentsOf: selectFromTier(silverBadges, count: 2, usedGroups: &usedGroups))
    pool.append(contentsOf: selectFromTier(blueBadges, count: 5, usedGroups: &usedGroups))

    return shuffle(pool, rng: &rng)
}

/// Selects badges for a level, respecting badge pool overrides.
/// If the level specifies a badge pool, uses those exact badges.
/// If the level requires matching a specific tier, ensures enough of that tier are in the pool.
/// Otherwise falls back to standard selectGameBadges.
func selectLevelBadges(for level: LevelDefinition) -> [Badge] {
    // Explicit badge pool override
    if let overrideIds = level.badgePoolOverride {
        let badges = overrideIds.compactMap { id in BADGES.first { $0.id == id } }
        if badges.count >= level.badgeCount {
            return Array(badges.prefix(level.badgeCount))
        }
        // Not enough badges in override, fall through to standard selection
    }

    // For tier-matching objectives, adjust the tier distribution
    if case .matchBadgeTier(let tier, _) = level.objective {
        return selectBadgesWithTierBias(tier: tier, count: level.badgeCount)
    }

    // Default: standard selection
    return selectGameBadges(count: level.badgeCount)
}

/// Selects badges with a bias toward a specific tier to ensure
/// the player can complete tier-matching objectives.
private func selectBadgesWithTierBias(tier: BadgeTier, count: Int) -> [Badge] {
    var rng = SeededRandom(seed: Int.random(in: 0..<Int.max))

    let allOfTier = shuffle(BADGES.filter { $0.tier == tier }, rng: &rng)
    let rest = shuffle(BADGES.filter { $0.tier != tier }, rng: &rng)

    var usedGroups = Set<Int>()
    var selected: [Badge] = []

    // Guarantee at least 2 of the target tier (so matches can happen)
    let targetTierCount = min(2, allOfTier.count)
    selected.append(contentsOf: selectFromTier(allOfTier, count: targetTierCount, usedGroups: &usedGroups))

    // Fill remaining from other tiers using standard cosmic-first approach
    let remaining = count - selected.count
    if remaining > 0 {
        let cosmicBadges = shuffle(rest.filter { $0.tier == .cosmic }, rng: &rng)
        let goldBadges = shuffle(rest.filter { $0.tier == .gold }, rng: &rng)
        let silverBadges = shuffle(rest.filter { $0.tier == .silver }, rng: &rng)
        let blueBadges = shuffle(rest.filter { $0.tier == .blue }, rng: &rng)

        // Distribute remaining slots
        selected.append(contentsOf: selectFromTier(cosmicBadges, count: 1, usedGroups: &usedGroups))
        selected.append(contentsOf: selectFromTier(goldBadges, count: 1, usedGroups: &usedGroups))
        selected.append(contentsOf: selectFromTier(silverBadges, count: 1, usedGroups: &usedGroups))

        if selected.count < count {
            let needed = count - selected.count
            selected.append(contentsOf: selectFromTier(blueBadges, count: needed, usedGroups: &usedGroups))
        }
    }

    // Safety fallback
    if selected.count < count {
        let usedIds = Set(selected.map { $0.id })
        var fallback = shuffle(BADGES.filter { !usedIds.contains($0.id) }, rng: &rng)
        while selected.count < count && !fallback.isEmpty {
            selected.append(fallback.removeFirst())
        }
    }

    return shuffle(selected, rng: &rng)
}

// MARK: - Tier Colors & Display Names

/// Maps each badge tier to its display color hex string.
let TIER_COLORS: [BadgeTier: String] = [
    .blue: "#E0E0E0",      // Grey/White = Common
    .silver: "#4A9EFF",     // Blue = Rare
    .gold: "#FFE048",       // Gold = Legendary
    .cosmic: "#B366FF",     // Purple = Cosmic
]

/// Maps each badge tier to its display name (synced with web).
let TIER_DISPLAY_NAMES: [BadgeTier: String] = [
    .blue: "Common",
    .silver: "Rare",
    .gold: "Legendary",
    .cosmic: "Cosmic",
]

/// Maps each badge tier to its border color (rgba string for use in styling).
let TIER_BORDER_COLORS: [BadgeTier: String] = [
    .blue: "rgba(224, 224, 224, 0.4)",
    .silver: "rgba(74, 158, 255, 0.5)",
    .gold: "rgba(255, 224, 72, 0.6)",
    .cosmic: "rgba(179, 102, 255, 0.7)",
]
