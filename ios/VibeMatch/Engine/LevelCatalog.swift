import Foundation

// MARK: - Level Catalog

/// Static definitions for all levels in the game.
/// Pure data — no logic, no side effects.
///
/// Difficulty curve:
///   Levels 1-5:   Tutorial — score objectives, 28-30 moves
///   Levels 6-10:  Introduction — combos, cascades, special tiles, 25-28 moves
///   Levels 11-15: Intermediate — badge tiers, shapes, 23-25 moves
///   Levels 16-20: Advanced — vibestreaks, T-shapes, 22-24 moves
///   Levels 21-25: Hard — multi-target, tight moves, 20-22 moves
///   Levels 26-30: Expert — cosmic blasts, cross shapes, curated pools, 18-22 moves
enum LevelCatalog {

    /// All level definitions, indexed from 1.
    static let levels: [LevelDefinition] = [

        // =====================================================================
        // TUTORIAL (1-5): Learn the basics
        // =====================================================================

        LevelDefinition(
            id: 1,
            objective: .score(target: 1500),
            movesAllowed: 30,
            starThresholds: (1500, 2500, 4000),
            flavorText: "Score 1,500 points"
        ),
        LevelDefinition(
            id: 2,
            objective: .score(target: 2000),
            movesAllowed: 30,
            starThresholds: (2000, 3500, 5000),
            flavorText: "Score 2,000 points"
        ),
        LevelDefinition(
            id: 3,
            objective: .matchCount(count: 12),
            movesAllowed: 28,
            starThresholds: (2000, 3500, 5500),
            flavorText: "Make 12 matches"
        ),
        LevelDefinition(
            id: 4,
            objective: .score(target: 2500),
            movesAllowed: 28,
            starThresholds: (2500, 4000, 6000),
            flavorText: "Score 2,500 points"
        ),
        LevelDefinition(
            id: 5,
            objective: .score(target: 3500),
            movesAllowed: 26,
            starThresholds: (3500, 5000, 7000),
            flavorText: "Score 3,500 points"
        ),

        // =====================================================================
        // INTRODUCTION (6-10): Combos, cascades, special tiles
        // =====================================================================

        LevelDefinition(
            id: 6,
            objective: .reachCombo(target: 3),
            movesAllowed: 28,
            starThresholds: (3000, 4500, 6500),
            flavorText: "Reach a 3x combo"
        ),
        LevelDefinition(
            id: 7,
            objective: .triggerCascades(count: 3),
            movesAllowed: 26,
            starThresholds: (3000, 5000, 7000),
            flavorText: "Trigger 3 cascades"
        ),
        LevelDefinition(
            id: 8,
            objective: .score(target: 5000),
            movesAllowed: 25,
            starThresholds: (5000, 7000, 9500),
            flavorText: "Score 5,000 points"
        ),
        LevelDefinition(
            id: 9,
            objective: .createSpecialTile(type: .bomb, count: 2),
            movesAllowed: 26,
            starThresholds: (3500, 5500, 8000),
            flavorText: "Create 2 Bombs"
        ),
        LevelDefinition(
            id: 10,
            objective: .reachCombo(target: 4),
            movesAllowed: 25,
            starThresholds: (4000, 6500, 9000),
            flavorText: "Reach a 4x combo"
        ),

        // =====================================================================
        // INTERMEDIATE (11-15): Badge tiers, shapes
        // =====================================================================

        LevelDefinition(
            id: 11,
            objective: .matchBadgeTier(tier: .gold, count: 6),
            movesAllowed: 25,
            starThresholds: (4000, 6000, 8500),
            flavorText: "Match 6 Legendary badges"
        ),
        LevelDefinition(
            id: 12,
            objective: .score(target: 6000),
            movesAllowed: 24,
            starThresholds: (6000, 8000, 11000),
            flavorText: "Score 6,000 points"
        ),
        LevelDefinition(
            id: 13,
            objective: .landShape(type: .L, count: 1),
            movesAllowed: 25,
            starThresholds: (4000, 6500, 9000),
            flavorText: "Land an L-shape match"
        ),
        LevelDefinition(
            id: 14,
            objective: .triggerCascades(count: 5),
            movesAllowed: 24,
            starThresholds: (4500, 7000, 10000),
            flavorText: "Trigger 5 cascades"
        ),
        LevelDefinition(
            id: 15,
            objective: .score(target: 7500),
            movesAllowed: 23,
            starThresholds: (7500, 10000, 13000),
            flavorText: "Score 7,500 points"
        ),

        // =====================================================================
        // ADVANCED (16-20): Vibestreaks, T-shapes, higher bars
        // =====================================================================

        LevelDefinition(
            id: 16,
            objective: .createSpecialTile(type: .vibestreak, count: 1),
            movesAllowed: 24,
            starThresholds: (5000, 7500, 10000),
            flavorText: "Create a Laser Party"
        ),
        LevelDefinition(
            id: 17,
            objective: .landShape(type: .T, count: 1),
            movesAllowed: 24,
            starThresholds: (5000, 7500, 10500),
            flavorText: "Land a T-shape match"
        ),
        LevelDefinition(
            id: 18,
            objective: .matchBadgeTier(tier: .silver, count: 10),
            movesAllowed: 23,
            starThresholds: (5000, 8000, 11000),
            flavorText: "Match 10 Rare badges"
        ),
        LevelDefinition(
            id: 19,
            objective: .reachCombo(target: 5),
            movesAllowed: 23,
            starThresholds: (5500, 8500, 12000),
            flavorText: "Reach a 5x combo"
        ),
        LevelDefinition(
            id: 20,
            objective: .score(target: 10000),
            movesAllowed: 22,
            starThresholds: (10000, 13000, 17000),
            flavorText: "Score 10,000 points"
        ),

        // =====================================================================
        // HARD (21-25): Multi-target, tight moves
        // =====================================================================

        LevelDefinition(
            id: 21,
            objective: .createSpecialTile(type: .bomb, count: 3),
            movesAllowed: 22,
            starThresholds: (6000, 9000, 12500),
            flavorText: "Create 3 Bombs"
        ),
        LevelDefinition(
            id: 22,
            objective: .landShape(type: .L, count: 2),
            movesAllowed: 22,
            starThresholds: (5500, 8500, 12000),
            flavorText: "Land 2 L-shape matches"
        ),
        LevelDefinition(
            id: 23,
            objective: .triggerCascades(count: 7),
            movesAllowed: 22,
            starThresholds: (6000, 9000, 13000),
            flavorText: "Trigger 7 cascades"
        ),
        LevelDefinition(
            id: 24,
            objective: .matchBadgeTier(tier: .cosmic, count: 5),
            movesAllowed: 22,
            starThresholds: (6500, 9500, 13500),
            flavorText: "Match 5 Cosmic badges"
        ),
        LevelDefinition(
            id: 25,
            objective: .score(target: 12000),
            movesAllowed: 20,
            starThresholds: (12000, 15000, 19000),
            flavorText: "Score 12,000 points"
        ),

        // =====================================================================
        // EXPERT (26-30): Cosmic blasts, cross shapes, curated pools
        // =====================================================================

        LevelDefinition(
            id: 26,
            objective: .createSpecialTile(type: .cosmicBlast, count: 1),
            movesAllowed: 22,
            starThresholds: (7000, 10500, 14000),
            flavorText: "Create a Cosmic Blast"
        ),
        LevelDefinition(
            id: 27,
            objective: .landShape(type: .cross, count: 1),
            movesAllowed: 22,
            starThresholds: (7000, 10500, 14500),
            flavorText: "Land a Cross-shape match"
        ),
        LevelDefinition(
            id: 28,
            objective: .reachCombo(target: 6),
            movesAllowed: 20,
            starThresholds: (7500, 11000, 15000),
            flavorText: "Reach a 6x combo"
        ),
        LevelDefinition(
            id: 29,
            objective: .matchCount(count: 30),
            movesAllowed: 22,
            starThresholds: (8000, 12000, 16000),
            flavorText: "Make 30 matches"
        ),
        LevelDefinition(
            id: 30,
            objective: .score(target: 15000),
            movesAllowed: 18,
            starThresholds: (15000, 18000, 22000),
            flavorText: "Score 15,000 points"
        ),
    ]

    /// Total number of levels available.
    static var totalLevels: Int { levels.count }

    /// Look up a level by ID (1-based). Returns nil if out of range.
    static func level(_ id: Int) -> LevelDefinition? {
        guard id >= 1, id <= levels.count else { return nil }
        return levels[id - 1]
    }
}
