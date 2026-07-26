import Foundation

// MARK: - Level Objective Type

/// Defines what the player must accomplish to pass a level.
/// Each type maps cleanly to fields available in TurnResult and GameState,
/// so ObjectiveTracker can evaluate progress without touching GameEngine.
enum LevelObjectiveType: Codable, Hashable, Sendable {
    /// Reach a target score.
    case score(target: Int)

    /// Match N badges of a specific tier.
    case matchBadgeTier(tier: BadgeTier, count: Int)

    /// Create N special tiles of a given type.
    case createSpecialTile(type: SpecialTileType, count: Int)

    /// Reach a target combo multiplier.
    case reachCombo(target: Int)

    /// Land N shape bonuses of a given type.
    case landShape(type: ShapeBonusType, count: Int)

    /// Trigger N total cascades.
    case triggerCascades(count: Int)

    /// Make N total matches.
    case matchCount(count: Int)
}

// MARK: - Level Definition

/// A static, immutable definition for a single level.
/// Progress is tracked separately in LevelProgressData.
struct LevelDefinition: Codable, Hashable, Sendable, Identifiable {
    /// Level number (1-based).
    let id: Int

    /// The primary objective the player must complete for 1 star.
    let objective: LevelObjectiveType

    /// How many moves the player gets (overrides CLASSIC_MOVES).
    let movesAllowed: Int

    /// Score thresholds for [1-star, 2-star, 3-star].
    /// 1 star is awarded for completing the objective regardless of score.
    /// 2 and 3 stars require meeting these score thresholds.
    let starThresholds: (Int, Int, Int)

    /// Specific badge IDs to use, or nil for standard random selection.
    let badgePoolOverride: [String]?

    /// How many badges on the board (default 6).
    let badgeCount: Int

    /// Short description of the objective for UI display.
    let flavorText: String

    /// The numerical target extracted from the objective for progress bars.
    var targetValue: Int {
        switch objective {
        case .score(let target): return target
        case .matchBadgeTier(_, let count): return count
        case .createSpecialTile(_, let count): return count
        case .reachCombo(let target): return target
        case .landShape(_, let count): return count
        case .triggerCascades(let count): return count
        case .matchCount(let count): return count
        }
    }

    // MARK: - Codable (tuple workaround)

    enum CodingKeys: String, CodingKey {
        case id, objective, movesAllowed, star1, star2, star3
        case badgePoolOverride, badgeCount, flavorText
    }

    init(
        id: Int,
        objective: LevelObjectiveType,
        movesAllowed: Int,
        starThresholds: (Int, Int, Int),
        badgePoolOverride: [String]? = nil,
        badgeCount: Int = 6,
        flavorText: String
    ) {
        self.id = id
        self.objective = objective
        self.movesAllowed = movesAllowed
        self.starThresholds = starThresholds
        self.badgePoolOverride = badgePoolOverride
        self.badgeCount = badgeCount
        self.flavorText = flavorText
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        objective = try c.decode(LevelObjectiveType.self, forKey: .objective)
        movesAllowed = try c.decode(Int.self, forKey: .movesAllowed)
        let s1 = try c.decode(Int.self, forKey: .star1)
        let s2 = try c.decode(Int.self, forKey: .star2)
        let s3 = try c.decode(Int.self, forKey: .star3)
        starThresholds = (s1, s2, s3)
        badgePoolOverride = try c.decodeIfPresent([String].self, forKey: .badgePoolOverride)
        badgeCount = try c.decode(Int.self, forKey: .badgeCount)
        flavorText = try c.decode(String.self, forKey: .flavorText)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(objective, forKey: .objective)
        try c.encode(movesAllowed, forKey: .movesAllowed)
        try c.encode(starThresholds.0, forKey: .star1)
        try c.encode(starThresholds.1, forKey: .star2)
        try c.encode(starThresholds.2, forKey: .star3)
        try c.encodeIfPresent(badgePoolOverride, forKey: .badgePoolOverride)
        try c.encode(badgeCount, forKey: .badgeCount)
        try c.encode(flavorText, forKey: .flavorText)
    }

    // MARK: - Hashable (tuple workaround)

    static func == (lhs: LevelDefinition, rhs: LevelDefinition) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
