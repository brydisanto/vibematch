import Foundation

// MARK: - Seeded PRNG (mulberry32 - bit-compatible with TypeScript version)

/// A seeded pseudo-random number generator using the mulberry32 algorithm.
/// Produces identical sequences to the TypeScript implementation given the same seed.
struct SeededRandom {
    private var state: Int32

    init(seed: Int) {
        // JS `s |= 0` coerces to signed 32-bit integer
        self.state = Int32(truncatingIfNeeded: seed)
    }

    /// Returns a value in [0, 1) identical to the TypeScript `seededRandom` output.
    mutating func next() -> Double {
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

let BADGES: [Badge] = [
    // ===== BLUE TIER (1x) =====
    Badge(id: "any_gvc", name: "Any GVC", image: "/badges/any_gvc_1759173799963.webp", tier: .blue),
    Badge(id: "baller", name: "Baller", image: "/badges/baller_1759173868839.webp", tier: .blue),
    Badge(id: "billiards", name: "Billiards", image: "/badges/billiards_1759173890603.webp", tier: .blue),
    Badge(id: "checkmate", name: "Checkmate", image: "/badges/checkmate_1759173863329.webp", tier: .blue),
    Badge(id: "chris_favorite_badge", name: "Chris Favorite Badge", image: "/badges/chris_favorite_badge_1759173988815.webp", tier: .blue),
    Badge(id: "doge", name: "Doge", image: "/badges/doge_1759173842640.webp", tier: .blue),
    Badge(id: "electric_rings", name: "Electric Rings", image: "/badges/electric_rings_1759173878797.webp", tier: .blue),
    Badge(id: "flow_state", name: "Flow State", image: "/badges/flow_state_1771355010910.webp", tier: .blue),
    Badge(id: "full_send_maverick", name: "Full Send Maverick", image: "/badges/full_send_maverick_1759173982959.webp", tier: .blue),
    Badge(id: "funky_fresh", name: "Funky Fresh", image: "/badges/funky_fresh_1759174001274.webp", tier: .blue),
    Badge(id: "fur_the_win", name: "Fur The Win", image: "/badges/fur_the_win_1759173969828.webp", tier: .blue),
    Badge(id: "gradient_lover", name: "Gradient Lover", image: "/badges/gradient_lover_1759173808918.webp", tier: .blue),
    Badge(id: "grayscale_seeker", name: "Grayscale Seeker", image: "/badges/grayscale_seeker_1759173797002.webp", tier: .blue),
    Badge(id: "highkeymoments_1", name: "Highkeymoments 1", image: "/badges/highkeymoments_1_1771433768524.webp", tier: .blue),
    Badge(id: "hue_too_fresh", name: "Hue Too Fresh", image: "/badges/hue_too_fresh_1771355000776.webp", tier: .blue),
    Badge(id: "ladies_night", name: "Ladies Night", image: "/badges/ladies_night_1759173991853.webp", tier: .blue),
    Badge(id: "lamp", name: "Lamp", image: "/badges/lamp_1759173892925.webp", tier: .blue),
    Badge(id: "multi_type_master", name: "Multi Type Master", image: "/badges/multi_type_master_1759173898608.webp", tier: .blue),
    Badge(id: "nounish_vibes", name: "Nounish Vibes", image: "/badges/nounish_vibes_1759173973218.webp", tier: .blue),
    Badge(id: "pepe", name: "Pepe", image: "/badges/pepe_1759173846260.webp", tier: .blue),
    Badge(id: "plants", name: "Plants", image: "/badges/plants_1759173871973.webp", tier: .blue),
    Badge(id: "plastic_lover", name: "Plastic Lover", image: "/badges/plastic_lover_1759173806081.webp", tier: .blue),
    Badge(id: "poker_face", name: "Poker Face", image: "/badges/poker_face_1759173884906.webp", tier: .blue),
    Badge(id: "pothead", name: "Pot Head", image: "/badges/pothead_1759173827603.webp", tier: .blue),
    Badge(id: "rainbow_boombox", name: "Rainbow Boombox", image: "/badges/rainbow_boombox_1759173875165.webp", tier: .blue),
    Badge(id: "rainbow_citizen", name: "Rainbow Citizen", image: "/badges/rainbow_citizen_1759173791000.webp", tier: .blue),
    Badge(id: "robot_lover", name: "Robot Lover", image: "/badges/robot_lover_1759173802514.webp", tier: .blue),
    Badge(id: "science_goggles", name: "Science Goggles", image: "/badges/science_goggles_1759173835714.webp", tier: .blue),
    Badge(id: "shower", name: "Shower", image: "/badges/shower_1759173865972.webp", tier: .blue),
    Badge(id: "sir_vibes_a_lot", name: "Sir Vibes A Lot", image: "/badges/sir_vibes_a_lot_1759173980023.webp", tier: .blue),
    Badge(id: "stone", name: "Stone", image: "/badges/stone_1759173815165.webp", tier: .blue),
    Badge(id: "straw_man", name: "Straw Man", image: "/badges/straw_man_1759173985595.webp", tier: .blue),
    Badge(id: "super_rare", name: "Super Rare", image: "/badges/super_rare_1759173833292.webp", tier: .blue),
    Badge(id: "sweettooth", name: "Sweettooth", image: "/badges/sweettooth_1759173860105.webp", tier: .blue),
    Badge(id: "toy_bricks", name: "Toy Bricks", image: "/badges/toy_bricks_1759173887659.webp", tier: .blue),
    Badge(id: "trait_maxi", name: "Trait Maxi", image: "/badges/trait_maxi_1771355017585.webp", tier: .blue),
    Badge(id: "yin_n_yang", name: "Yin N Yang", image: "/badges/yin_n_yang_1759173942484.webp", tier: .blue),
    Badge(id: "zoom_in_vibe_out", name: "Zoom In Vibe Out", image: "/badges/zoom_in_vibe_out_1759174018930.webp", tier: .blue),

    // ===== SILVER TIER (1.5x) =====
    Badge(id: "anchorman", name: "Anchorman", image: "/badges/anchorman_1771355025752.webp", tier: .silver),
    Badge(id: "astro_bean", name: "Astro Bean", image: "/badges/astro_bean_1759173824578.webp", tier: .silver),
    Badge(id: "captain", name: "Captain", image: "/badges/captain_1759173895611.webp", tier: .silver),
    Badge(id: "elite_rainbow_ranger", name: "Elite Rainbow Ranger", image: "/badges/elite_rainbow_ranger_1759174003980.webp", tier: .silver),
    Badge(id: "full_throttle", name: "Full Throttle", image: "/badges/full_throttle_1759174022912.webp", tier: .silver),
    Badge(id: "gamer", name: "Gamer", image: "/badges/gamer_1759173856821.webp", tier: .silver),
    Badge(id: "gud_meat", name: "Gud Meat", image: "/badges/gud_meat_1759173936766.webp", tier: .silver),
    Badge(id: "hail_mary_heroes", name: "Hail Mary Heroes", image: "/badges/hail_mary_heroes_1759173953534.webp", tier: .silver),
    Badge(id: "high_noon_hustler", name: "High Noon Hustler", image: "/badges/high_noon_hustler_1759174007143.webp", tier: .silver),
    Badge(id: "homerun", name: "Homerun", image: "/badges/homerun_1759174013207.webp", tier: .silver),
    Badge(id: "hoodie_up_society", name: "Hoodie Up Society", image: "/badges/hoodie_up_society_1759174015984.webp", tier: .silver),
    Badge(id: "king", name: "King", image: "/badges/king_1759173882056.webp", tier: .silver),
    Badge(id: "mountain_goat", name: "Mountain Goat", image: "/badges/mountain_goat_1759174026593.webp", tier: .silver),
    Badge(id: "no_face_no_problem", name: "No Face No Problem", image: "/badges/no_face_no_problem_1759173948247.webp", tier: .silver),
    Badge(id: "party_in_the_back", name: "Party in the Back", image: "/badges/party_in_the_back_1759173998578.webp", tier: .silver),
    Badge(id: "power_duo", name: "Power Duo", image: "/badges/power_duo_1759173963251.webp", tier: .silver),
    Badge(id: "rainbow_bubble_goggles", name: "Rainbow Bubble Goggles", image: "/badges/rainbow_bubble_goggles_1759173853819.webp", tier: .silver),
    Badge(id: "ranger", name: "Ranger", image: "/badges/ranger_1759173821753.webp", tier: .silver),
    Badge(id: "seas_the_day", name: "Seas The Day", image: "/badges/seas_the_day_1759173945252.webp", tier: .silver),
    Badge(id: "showtime", name: "Showtime", image: "/badges/showtime_1759173995136.webp", tier: .silver),
    Badge(id: "suited_up", name: "Suited Up", image: "/badges/suited_up_1759173934070.webp", tier: .silver),
    Badge(id: "surfer", name: "Surfer", image: "/badges/surfer_1759173830462.webp", tier: .silver),
    Badge(id: "tanks_a_lot", name: "Tanks a Lot", image: "/badges/tanks_a_lot_1759173976815.webp", tier: .silver),
    Badge(id: "varsity_vibes", name: "Varsity Vibes", image: "/badges/varsity_vibes_1759173950723.webp", tier: .silver),
    Badge(id: "vibefoot_fan_club", name: "Vibefoot Fan Club", image: "/badges/vibefoot_fan_club_1759173939420.webp", tier: .silver),

    // ===== GOLD TIER (2x) =====
    Badge(id: "astro_balls", name: "Astro Balls", image: "/badges/astro_balls_1759173838889.webp", tier: .gold),
    Badge(id: "gold_member", name: "Gold Member", image: "/badges/gold_member_1759173793799.webp", tier: .gold),
    Badge(id: "great_stacheby", name: "Great Stacheby", image: "/badges/great_stacheby_1759173956903.webp", tier: .gold),
    Badge(id: "necks_level", name: "Necks Level", image: "/badges/necks_level_1759173966777.webp", tier: .gold),
    Badge(id: "patch_powerhouse", name: "Patch Powerhouse", image: "/badges/patch_powerhouse_1771354988189.webp", tier: .gold),
    Badge(id: "rainbow_visor", name: "Rainbow Visor", image: "/badges/rainbow_visor_1759173849941.webp", tier: .gold),
    Badge(id: "shadow_funk_division", name: "Shadow Funk Division", image: "/badges/shadow_funk_division_1771355038766.webp", tier: .gold),
    Badge(id: "visooor_enjoyooor", name: "Visooor Enjoyooor", image: "/badges/visooor_enjoyooor_1759174010233.webp", tier: .gold),

    // ===== COSMIC TIER (3x) =====
    Badge(id: "cosmic_guardian", name: "Cosmic Guardian", image: "/badges/cosmic_guardian1759173818340.webp", tier: .cosmic),
    Badge(id: "one_of_one", name: "One of One", image: "/badges/one_of_one_1771354994630.webp", tier: .cosmic),
]

// MARK: - Conflict Groups

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
    "varsity_vibes": [4],
    "mountain_goat": [4],
    "electric_rings": [4],
    "stone": [4],
    "shadow_funk_division": [4],
    // #5
    "pothead": [5],
    "funky_fresh": [5],
    "vibefoot_fan_club": [5],
    "ladies_night": [5],
    "full_throttle": [5],
    "astro_bean": [5],
    "plastic_lover": [5],
    "homerun": [5],
    // #7
    "king": [7],
    "nounish_vibes": [7],
    "lamp": [7],
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
    "no_face_no_problem": [9],
    "gold_member": [9],
    // #10
    "necks_level": [10],
    "gamer": [10],
    "cosmic_guardian": [10],
    "hoodie_up_society": [10],
    "rainbow_boombox": [10],
    "multi_type_master": [10],
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
        let j = Int(floor(rng.next() * Double(i + 1)))
        result.swapAt(i, j)
    }
    return result
}

// MARK: - Badge Selection

/// Selects 6 badges for a game session using tier distribution: 3 blue, 1 silver, 1 gold, 1 cosmic.
/// Uses Fisher-Yates shuffle with the seeded PRNG for cross-platform determinism.
func selectGameBadges(count: Int = 6, seed: Int? = nil) -> [Badge] {
    var rng: SeededRandom
    if let seed = seed {
        rng = SeededRandom(seed: seed)
    } else {
        rng = SeededRandom(seed: getDailySeed())
    }

    let blueBadges = shuffle(BADGES.filter { $0.tier == .blue }, rng: &rng)
    let silverBadges = shuffle(BADGES.filter { $0.tier == .silver }, rng: &rng)
    let goldBadges = shuffle(BADGES.filter { $0.tier == .gold }, rng: &rng)
    let cosmicBadges = shuffle(BADGES.filter { $0.tier == .cosmic }, rng: &rng)

    // Distribution: 3 blue, 1 silver, 1 gold, 1 cosmic = 6 tiles
    // Use shared usedGroups set across tiers to enforce conflict groups
    var usedGroups = Set<Int>()
    var selected: [Badge] = []
    selected.append(contentsOf: selectFromTier(blueBadges, count: 3, usedGroups: &usedGroups))
    selected.append(contentsOf: selectFromTier(silverBadges, count: 1, usedGroups: &usedGroups))
    selected.append(contentsOf: selectFromTier(goldBadges, count: 1, usedGroups: &usedGroups))
    selected.append(contentsOf: selectFromTier(cosmicBadges, count: 1, usedGroups: &usedGroups))

    return shuffle(selected, rng: &rng)
}

// MARK: - Tier Colors

/// Maps each badge tier to its display color hex string.
let TIER_COLORS: [BadgeTier: String] = [
    .blue: "#E0E0E0",      // Grey/White = Common
    .silver: "#4A9EFF",     // Blue = Uncommon
    .gold: "#FFE048",
    .cosmic: "#B366FF",
]

/// Maps each badge tier to its display name.
let TIER_DISPLAY_NAMES: [BadgeTier: String] = [
    .blue: "Common",
    .silver: "Uncommon",
    .gold: "Gold",
    .cosmic: "Cosmic",
]

/// Maps each badge tier to its border color (rgba string for use in styling).
let TIER_BORDER_COLORS: [BadgeTier: String] = [
    .blue: "rgba(224, 224, 224, 0.4)",
    .silver: "rgba(74, 158, 255, 0.5)",
    .gold: "rgba(255, 224, 72, 0.6)",
    .cosmic: "rgba(179, 102, 255, 0.7)",
]
