import Foundation

// MARK: - Achievement Requirement

/// Defines what a player must do to complete an achievement.
/// Each requirement type maps to a specific field in LifetimeStats or CollectionManager,
/// making evaluation straightforward and testable.
enum AchievementRequirement: Codable, Hashable, Sendable {
    // Score-based
    case singleGameScore(Int)
    case lifetimeScore(Int)

    // Combo-based
    case singleGameCombo(Int)
    case lifetimeHighestCombo(Int)

    // Cascade-based
    case singleGameCascades(Int)

    // Special tiles
    case createSpecialTile(SpecialTileType)
    case lifetimeBombsCreated(Int)
    case lifetimeVibestreaksCreated(Int)
    case lifetimeCosmicBlastsCreated(Int)

    // Shape bonuses
    case landShapeBonus(ShapeBonusType)
    case lifetimeLShapes(Int)
    case lifetimeTShapes(Int)
    case lifetimeCrossShapes(Int)
    // Collection
    case uniqueBadgesDiscovered(Int)
    case badgeMatchMastery(MatchMasteryLevel)        // Any single badge at this level
    case badgesAtMatchMastery(MatchMasteryLevel, Int) // N badges at this level

    // Streaks
    case dailyStreak(Int)

    // Games played
    case gamesPlayed(Int)
    case perfectGames(Int)

    // Chests
    case chestsOpened(Int)
}

// MARK: - Achievement Category

/// Groups achievements for UI organization and tab filtering.
enum AchievementCategory: String, Codable, Hashable, Sendable, CaseIterable {
    case score = "Score"
    case combo = "Combo"
    case cascade = "Cascade"
    case specialTiles = "Special Tiles"
    case shapes = "Shapes"
    case collection = "Collection"
    case streaks = "Streaks"
    case daily = "Daily"
    case mastery = "Mastery"
    case general = "General"
}

// MARK: - Achievement Definition

/// A static achievement definition. Immutable — progress is tracked separately
/// in AchievementTracker.
///
/// Each achievement answers the question: "What memorable gameplay moment does this
/// celebrate?" Achievements that don't correspond to a satisfying player moment
/// should be cut — they're noise, not reward.
struct AchievementDefinition: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let name: String
    let description: String
    let icon: String           // SF Symbol name
    let category: AchievementCategory
    let chestReward: ChestType
    let requirement: AchievementRequirement

    /// The numerical goal for progress tracking.
    /// Extracted from the requirement for uniform progress bar display.
    var goal: Int {
        switch requirement {
        case .singleGameScore(let n),
             .lifetimeScore(let n),
             .singleGameCombo(let n),
             .lifetimeHighestCombo(let n),
             .singleGameCascades(let n),
             .lifetimeBombsCreated(let n),
             .lifetimeVibestreaksCreated(let n),
             .lifetimeCosmicBlastsCreated(let n),
             .lifetimeLShapes(let n),
             .lifetimeTShapes(let n),
             .lifetimeCrossShapes(let n),
             .uniqueBadgesDiscovered(let n),
             .dailyStreak(let n),
             .gamesPlayed(let n),
             .perfectGames(let n),
             .chestsOpened(let n):
            return n
        case .badgesAtMatchMastery(_, let count):
            return count
        case .createSpecialTile, .landShapeBonus, .badgeMatchMastery:
            return 1
        }
    }
}

// MARK: - Achievement Progress

/// Tracks a player's progress toward a single achievement.
struct AchievementProgress: Codable, Hashable, Identifiable, Sendable {
    let achievementId: String
    var currentProgress: Int
    var isCompleted: Bool
    var isRewardClaimed: Bool
    var completedAt: Date?

    var id: String { achievementId }

    /// Progress as a ratio from 0.0 to 1.0 for UI display.
    func progressRatio(goal: Int) -> Double {
        guard goal > 0 else { return 0.0 }
        return min(1.0, Double(currentProgress) / Double(goal))
    }

    init(achievementId: String) {
        self.achievementId = achievementId
        self.currentProgress = 0
        self.isCompleted = false
        self.isRewardClaimed = false
        self.completedAt = nil
    }
}

// MARK: - Achievement Definitions Catalog

/// All achievements in the game, organized by category.
///
/// Naming convention: achievement names are player-facing and should feel like
/// accolades — short, punchy, and evocative. Descriptions explain what to do.
///
/// Balance notes:
/// - Bronze chests for easy/introductory achievements (first 1-3 sessions)
/// - Silver chests for moderate skill/dedication (5-10 sessions)
/// - Gold chests for significant milestones (20+ sessions)
/// - Cosmic chests for exceptional dedication (50+ sessions or rare skill)
///
/// All numerical thresholds are [PLACEHOLDER] until validated against real score
/// distributions from playtesting.
let ALL_ACHIEVEMENTS: [AchievementDefinition] = {
    var achievements: [AchievementDefinition] = []

    // =========================================================================
    // SCORE ACHIEVEMENTS
    // Player feel: "I'm getting better at this game"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "score_first_steps",
            name: "First Steps",
            description: "Score 1,000 points in a single game",
            icon: "star",
            category: .score,
            chestReward: .bronze,
            requirement: .singleGameScore(1000)
        ),
        AchievementDefinition(
            id: "score_getting_warmed_up",
            name: "Getting Warmed Up",
            description: "Score 3,000 points in a single game",
            icon: "star.fill",
            category: .score,
            chestReward: .bronze,
            requirement: .singleGameScore(3000)
        ),
        AchievementDefinition(
            id: "score_vibe_check",
            name: "Vibe Check",
            description: "Score 5,000 points in a single game",
            icon: "star.circle",
            category: .score,
            chestReward: .silver,
            requirement: .singleGameScore(5000)
        ),
        AchievementDefinition(
            id: "score_vibe_master",
            name: "Vibe Master",
            description: "Score 10,000 points in a single game",
            icon: "star.circle.fill",
            category: .score,
            chestReward: .silver,
            requirement: .singleGameScore(10000)
        ),
        AchievementDefinition(
            id: "score_cosmic_energy",
            name: "Cosmic Energy",
            description: "Score 25,000 points in a single game",
            icon: "sparkles",
            category: .score,
            chestReward: .gold,
            requirement: .singleGameScore(25000)
        ),
        AchievementDefinition(
            id: "score_transcendent",
            name: "Transcendent",
            description: "Score 50,000 points in a single game",
            icon: "sun.max.fill",
            category: .score,
            chestReward: .cosmic,
            requirement: .singleGameScore(50000)
        ),
    ])

    // =========================================================================
    // COMBO ACHIEVEMENTS
    // Player feel: "That chain was insane"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "combo_getting_started",
            name: "Getting Started",
            description: "Reach a 2x combo in a single game",
            icon: "bolt",
            category: .combo,
            chestReward: .bronze,
            requirement: .singleGameCombo(2)
        ),
        AchievementDefinition(
            id: "combo_on_a_roll",
            name: "On a Roll",
            description: "Reach a 3x combo in a single game",
            icon: "bolt.fill",
            category: .combo,
            chestReward: .bronze,
            requirement: .singleGameCombo(3)
        ),
        AchievementDefinition(
            id: "combo_chain_reaction",
            name: "Chain Reaction",
            description: "Reach a 4x combo in a single game",
            icon: "bolt.circle",
            category: .combo,
            chestReward: .silver,
            requirement: .singleGameCombo(4)
        ),
        AchievementDefinition(
            id: "combo_unstoppable",
            name: "Unstoppable",
            description: "Reach a 6x combo in a single game",
            icon: "bolt.circle.fill",
            category: .combo,
            chestReward: .silver,
            requirement: .singleGameCombo(6)
        ),
        AchievementDefinition(
            id: "combo_maximum_overdrive",
            name: "Maximum Overdrive",
            description: "Reach a 10x combo in a single game",
            icon: "bolt.shield.fill",
            category: .combo,
            chestReward: .gold,
            requirement: .singleGameCombo(10)
        ),
    ])

    // =========================================================================
    // CASCADE ACHIEVEMENTS
    // Player feel: "The board just exploded on its own"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "cascade_lucky_break",
            name: "Lucky Break",
            description: "Trigger 3 cascades in a single game",
            icon: "arrow.down.circle",
            category: .cascade,
            chestReward: .bronze,
            requirement: .singleGameCascades(3)
        ),
        AchievementDefinition(
            id: "cascade_domino_effect",
            name: "Domino Effect",
            description: "Trigger 5 cascades in a single game",
            icon: "arrow.down.circle.fill",
            category: .cascade,
            chestReward: .silver,
            requirement: .singleGameCascades(5)
        ),
        AchievementDefinition(
            id: "cascade_king",
            name: "Cascade King",
            description: "Trigger 8 cascades in a single game",
            icon: "crown",
            category: .cascade,
            chestReward: .gold,
            requirement: .singleGameCascades(8)
        ),
    ])

    // =========================================================================
    // SPECIAL TILE ACHIEVEMENTS
    // Player feel: "I just unlocked a new power"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "special_demolition",
            name: "Demolition",
            description: "Create your first Bomb tile",
            icon: "flame",
            category: .specialTiles,
            chestReward: .bronze,
            requirement: .createSpecialTile(.bomb)
        ),
        AchievementDefinition(
            id: "special_streak",
            name: "Streak!",
            description: "Create your first VibeStreak tile",
            icon: "line.horizontal.3",
            category: .specialTiles,
            chestReward: .bronze,
            requirement: .createSpecialTile(.vibestreak)
        ),
        AchievementDefinition(
            id: "special_cosmic_power",
            name: "Cosmic Power",
            description: "Create your first Cosmic Blast tile",
            icon: "sparkle",
            category: .specialTiles,
            chestReward: .silver,
            requirement: .createSpecialTile(.cosmicBlast)
        ),
        AchievementDefinition(
            id: "special_bomb_squad",
            name: "Bomb Squad",
            description: "Create 25 Bomb tiles across all games",
            icon: "flame.fill",
            category: .specialTiles,
            chestReward: .silver,
            requirement: .lifetimeBombsCreated(25)
        ),
        AchievementDefinition(
            id: "special_streak_master",
            name: "Streak Master",
            description: "Create 25 VibeStreak tiles across all games",
            icon: "line.3.horizontal",
            category: .specialTiles,
            chestReward: .silver,
            requirement: .lifetimeVibestreaksCreated(25)
        ),
    ])

    // =========================================================================
    // SHAPE ACHIEVEMENTS
    // Player feel: "I spotted the pattern and nailed it"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "shape_l_shaped",
            name: "L-Shaped",
            description: "Land your first L-shape match",
            icon: "l.square",
            category: .shapes,
            chestReward: .bronze,
            requirement: .landShapeBonus(.l)
        ),
        AchievementDefinition(
            id: "shape_t_time",
            name: "T-Time",
            description: "Land your first T-shape match",
            icon: "t.square",
            category: .shapes,
            chestReward: .bronze,
            requirement: .landShapeBonus(.t)
        ),
        AchievementDefinition(
            id: "shape_cross_master",
            name: "Cross Master",
            description: "Land your first cross-shape match",
            icon: "plus.square",
            category: .shapes,
            chestReward: .silver,
            requirement: .landShapeBonus(.cross)
        ),
        AchievementDefinition(
            id: "shape_l_veteran",
            name: "L-Veteran",
            description: "Land 50 L-shape matches across all games",
            icon: "l.square.fill",
            category: .shapes,
            chestReward: .gold,
            requirement: .lifetimeLShapes(50)
        ),
    ])

    // =========================================================================
    // COLLECTION ACHIEVEMENTS
    // Player feel: "I'm building something impressive"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "collection_starter",
            name: "Starter Collection",
            description: "Discover 10 unique badges",
            icon: "rectangle.grid.2x2",
            category: .collection,
            chestReward: .bronze,
            requirement: .uniqueBadgesDiscovered(10)
        ),
        AchievementDefinition(
            id: "collection_collector",
            name: "Collector",
            description: "Discover 25 unique badges",
            icon: "rectangle.grid.2x2.fill",
            category: .collection,
            chestReward: .silver,
            requirement: .uniqueBadgesDiscovered(25)
        ),
        AchievementDefinition(
            id: "collection_connoisseur",
            name: "Connoisseur",
            description: "Discover 50 unique badges",
            icon: "rectangle.grid.3x2",
            category: .collection,
            chestReward: .gold,
            requirement: .uniqueBadgesDiscovered(50)
        ),
        AchievementDefinition(
            id: "collection_archivist",
            name: "Archivist",
            description: "Discover 75 unique badges",
            icon: "rectangle.grid.3x2.fill",
            category: .collection,
            chestReward: .gold,
            requirement: .uniqueBadgesDiscovered(75)
        ),
        AchievementDefinition(
            id: "collection_completionist",
            name: "Completionist",
            description: "Discover all 100 badges",
            icon: "checkmark.seal.fill",
            category: .collection,
            chestReward: .cosmic,
            requirement: .uniqueBadgesDiscovered(100)
        ),
    ])

    // =========================================================================
    // STREAK ACHIEVEMENTS
    // Player feel: "I'm committed to this game"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "streak_regular",
            name: "Regular",
            description: "Play for 3 days in a row",
            icon: "calendar",
            category: .streaks,
            chestReward: .bronze,
            requirement: .dailyStreak(3)
        ),
        AchievementDefinition(
            id: "streak_dedicated",
            name: "Dedicated",
            description: "Play for 7 days in a row",
            icon: "calendar.badge.clock",
            category: .streaks,
            chestReward: .silver,
            requirement: .dailyStreak(7)
        ),
        AchievementDefinition(
            id: "streak_committed",
            name: "Committed",
            description: "Play for 30 days in a row",
            icon: "calendar.circle",
            category: .streaks,
            chestReward: .gold,
            requirement: .dailyStreak(30)
        ),
        AchievementDefinition(
            id: "streak_legend",
            name: "Legend",
            description: "Play for 100 days in a row",
            icon: "calendar.circle.fill",
            category: .streaks,
            chestReward: .cosmic,
            requirement: .dailyStreak(100)
        ),
    ])

    // =========================================================================
    // DAILY / GENERAL ACHIEVEMENTS
    // Player feel: "I'm part of the community"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "daily_first_vibe",
            name: "Daily Vibe",
            description: "Complete your first game",
            icon: "play.circle",
            category: .daily,
            chestReward: .bronze,
            requirement: .gamesPlayed(1)
        ),
        AchievementDefinition(
            id: "daily_ten_games",
            name: "Getting Hooked",
            description: "Play 10 games total",
            icon: "play.circle.fill",
            category: .daily,
            chestReward: .bronze,
            requirement: .gamesPlayed(10)
        ),
        AchievementDefinition(
            id: "daily_fifty_games",
            name: "Dedicated Player",
            description: "Play 50 games total",
            icon: "gamecontroller",
            category: .daily,
            chestReward: .silver,
            requirement: .gamesPlayed(50)
        ),
        AchievementDefinition(
            id: "daily_hundred_games",
            name: "Centurion",
            description: "Play 100 games total",
            icon: "gamecontroller.fill",
            category: .daily,
            chestReward: .gold,
            requirement: .gamesPlayed(100)
        ),
        AchievementDefinition(
            id: "daily_perfect_first",
            name: "Perfectionist",
            description: "Earn 3 stars on any level",
            icon: "star.leadinghalf.filled",
            category: .daily,
            chestReward: .bronze,
            requirement: .perfectGames(1)
        ),
        AchievementDefinition(
            id: "daily_ten_perfects",
            name: "Consistently Perfect",
            description: "Earn 3 stars on 10 different games",
            icon: "rosette",
            category: .daily,
            chestReward: .gold,
            requirement: .perfectGames(10)
        ),
    ])

    // =========================================================================
    // MASTERY ACHIEVEMENTS
    // Player feel: "I've truly mastered this badge"
    // =========================================================================

    achievements.append(contentsOf: [
        AchievementDefinition(
            id: "mastery_bronze_first",
            name: "Bronze Devotee",
            description: "Reach Bronze mastery on any badge",
            icon: "shield",
            category: .mastery,
            chestReward: .bronze,
            requirement: .badgeMatchMastery(.bronze)
        ),
        AchievementDefinition(
            id: "mastery_gold_first",
            name: "Gold Standard",
            description: "Reach Gold mastery on any badge",
            icon: "shield.fill",
            category: .mastery,
            chestReward: .silver,
            requirement: .badgeMatchMastery(.gold)
        ),
        AchievementDefinition(
            id: "mastery_animated_first",
            name: "Badge Expert",
            description: "Reach Animated (max) mastery on any badge",
            icon: "shield.lefthalf.filled",
            category: .mastery,
            chestReward: .gold,
            requirement: .badgeMatchMastery(.animated)
        ),
        AchievementDefinition(
            id: "mastery_animated_ten",
            name: "Master Curator",
            description: "Reach Animated mastery on 10 different badges",
            icon: "shield.checkered",
            category: .mastery,
            chestReward: .cosmic,
            requirement: .badgesAtMatchMastery(.animated, 10)
        ),
        AchievementDefinition(
            id: "mastery_chest_opener",
            name: "Treasure Hunter",
            description: "Open 50 chests total",
            icon: "shippingbox.fill",
            category: .general,
            chestReward: .gold,
            requirement: .chestsOpened(50)
        ),
    ])

    return achievements
}()

// MARK: - Achievement Lookup

/// Dictionary for O(1) achievement lookup by ID.
let ACHIEVEMENT_LOOKUP: [String: AchievementDefinition] = {
    Dictionary(uniqueKeysWithValues: ALL_ACHIEVEMENTS.map { ($0.id, $0) })
}()

/// Achievements grouped by category for UI display.
let ACHIEVEMENTS_BY_CATEGORY: [AchievementCategory: [AchievementDefinition]] = {
    Dictionary(grouping: ALL_ACHIEVEMENTS, by: \.category)
}()

// MARK: - Achievement Tracker

/// Evaluates player stats against achievement definitions and tracks progress.
///
/// This is a pure evaluation engine — it takes stats in and returns progress out.
/// It does not own any state beyond the progress records, which are persisted
/// via UserDefaults for the prototype.
///
/// Design note: Achievements are evaluated lazily (on demand) rather than via
/// real-time event listeners. This simplifies the architecture at the cost of
/// requiring explicit evaluation calls after state changes. For 35 achievements,
/// the evaluation cost is negligible.
@Observable
final class AchievementTracker {

    // MARK: - State

    /// Progress for each achievement, keyed by achievement ID.
    private(set) var progress: [String: AchievementProgress] = [:]

    /// Reference to lifetime stats for evaluation.
    private let chestSystem: ChestSystem

    /// Reference to collection manager for collection-based achievements.
    private let collectionManager: CollectionManager

    /// Achievements completed but rewards not yet claimed.
    var unclaimedAchievements: [AchievementDefinition] {
        ALL_ACHIEVEMENTS.filter { def in
            guard let prog = progress[def.id] else { return false }
            return prog.isCompleted && !prog.isRewardClaimed
        }
    }

    /// Total achievements completed.
    var completedCount: Int {
        progress.values.filter(\.isCompleted).count
    }

    /// Total achievements available.
    var totalCount: Int { ALL_ACHIEVEMENTS.count }

    /// Overall achievement completion ratio.
    var completionRatio: Double {
        guard totalCount > 0 else { return 0.0 }
        return Double(completedCount) / Double(totalCount)
    }

    init(chestSystem: ChestSystem, collectionManager: CollectionManager) {
        self.chestSystem = chestSystem
        self.collectionManager = collectionManager
        load()
        initializeProgress()
    }

    /// Ensures every achievement has a progress entry.
    private func initializeProgress() {
        for achievement in ALL_ACHIEVEMENTS {
            if progress[achievement.id] == nil {
                progress[achievement.id] = AchievementProgress(achievementId: achievement.id)
            }
        }
    }

    // MARK: - Evaluation

    /// Evaluates all achievements against current stats.
    /// Returns a list of achievement IDs that were newly completed this evaluation.
    ///
    /// Call this after every game session and after chest openings.
    @discardableResult
    func evaluate() -> [String] {
        let stats = chestSystem.lifetimeStats
        var newlyCompleted: [String] = []

        for achievement in ALL_ACHIEVEMENTS {
            guard var prog = progress[achievement.id], !prog.isCompleted else { continue }

            let (currentValue, isComplete) = evaluateRequirement(
                achievement.requirement,
                stats: stats
            )

            prog.currentProgress = currentValue

            if isComplete {
                prog.isCompleted = true
                prog.completedAt = .now
                newlyCompleted.append(achievement.id)
            }

            progress[achievement.id] = prog
        }

        if !newlyCompleted.isEmpty {
            save()
        }

        return newlyCompleted
    }

    /// Evaluates a single requirement against current stats.
    /// Returns (currentProgress, isComplete).
    private func evaluateRequirement(
        _ requirement: AchievementRequirement,
        stats: LifetimeStats
    ) -> (Int, Bool) {
        switch requirement {
        case .singleGameScore(let target):
            let value = stats.highestScore
            return (value, value >= target)

        case .lifetimeScore(let target):
            let value = stats.totalScore
            return (value, value >= target)

        case .singleGameCombo(let target):
            let value = stats.highestCombo
            return (value, value >= target)

        case .lifetimeHighestCombo(let target):
            let value = stats.highestCombo
            return (value, value >= target)

        case .singleGameCascades(let target):
            // We track lifetime cascades; single-game cascades require per-game tracking.
            // For now, use lifetime total as a proxy. This will over-count but never
            // under-count relative to the single-game best.
            // TODO: Track single-game best cascades in LifetimeStats.
            let value = stats.totalCascades
            return (min(value, target), value >= target)

        case .createSpecialTile(let type):
            let created: Bool
            switch type {
            case .bomb:        created = stats.hasCreatedBomb
            case .vibestreak:  created = stats.hasCreatedVibestreak
            case .cosmicBlast: created = stats.hasCreatedCosmicBlast
            }
            return (created ? 1 : 0, created)

        case .lifetimeBombsCreated(let target):
            let value = stats.bombsCreated
            return (value, value >= target)

        case .lifetimeVibestreaksCreated(let target):
            let value = stats.vibestreaksCreated
            return (value, value >= target)

        case .lifetimeCosmicBlastsCreated(let target):
            let value = stats.cosmicBlastsCreated
            return (value, value >= target)

        case .landShapeBonus(let type):
            let landed: Bool
            switch type {
            case .l:      landed = stats.hasLandedL
            case .t:      landed = stats.hasLandedT
            case .cross:  landed = stats.hasLandedCross
            }
            return (landed ? 1 : 0, landed)

        case .lifetimeLShapes(let target):
            let value = stats.lShapesLanded
            return (value, value >= target)

        case .lifetimeTShapes(let target):
            let value = stats.tShapesLanded
            return (value, value >= target)

        case .lifetimeCrossShapes(let target):
            let value = stats.crossShapesLanded
            return (value, value >= target)

        case .uniqueBadgesDiscovered(let target):
            let value = collectionManager.totalDiscovered
            return (value, value >= target)

        case .badgeMatchMastery(let targetLevel):
            let hasAny = collectionManager.discoveredBadges.values.contains {
                $0.matchMastery >= targetLevel
            }
            return (hasAny ? 1 : 0, hasAny)

        case .badgesAtMatchMastery(let targetLevel, let count):
            let atLevel = collectionManager.discoveredBadges.values.filter {
                $0.matchMastery >= targetLevel
            }.count
            return (atLevel, atLevel >= count)

        case .dailyStreak(let target):
            let value = stats.longestDailyStreak
            return (value, value >= target)

        case .gamesPlayed(let target):
            let value = stats.totalGamesPlayed
            return (value, value >= target)

        case .perfectGames(let target):
            let value = stats.perfectGames
            return (value, value >= target)

        case .chestsOpened(let target):
            let value = stats.totalChestsOpened
            return (value, value >= target)
        }
    }

    // MARK: - Reward Claiming

    /// Claims the chest reward for a completed achievement.
    /// Returns the earned chest, or nil if the achievement isn't ready to claim.
    func claimReward(for achievementId: String) -> EarnedChest? {
        guard let definition = ACHIEVEMENT_LOOKUP[achievementId],
              var prog = progress[achievementId],
              prog.isCompleted,
              !prog.isRewardClaimed else {
            return nil
        }

        prog.isRewardClaimed = true
        progress[achievementId] = prog
        save()

        return chestSystem.awardChest(
            tier: definition.chestReward,
            trigger: .achievement(definition.name)
        )
    }

    /// Claims all unclaimed achievement rewards at once.
    /// Returns all earned chests.
    func claimAllRewards() -> [EarnedChest] {
        var chests: [EarnedChest] = []
        for achievement in unclaimedAchievements {
            if let chest = claimReward(for: achievement.id) {
                chests.append(chest)
            }
        }
        return chests
    }

    // MARK: - Queries

    /// Returns the progress for a specific achievement.
    func progressFor(_ achievementId: String) -> AchievementProgress? {
        progress[achievementId]
    }

    /// Returns all achievements in a category with their current progress.
    func achievementsInCategory(_ category: AchievementCategory) -> [(AchievementDefinition, AchievementProgress)] {
        let definitions = ACHIEVEMENTS_BY_CATEGORY[category] ?? []
        return definitions.compactMap { def in
            guard let prog = progress[def.id] else { return nil }
            return (def, prog)
        }
    }

    // MARK: - Persistence

    private static let storageKey = "achievement_tracker_progress"

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(progress) else { return }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let decoded = try? decoder.decode([String: AchievementProgress].self, from: data) else {
            return
        }
        progress = decoded
    }

    /// Resets all achievement progress. Destructive — debug/testing only.
    func reset() {
        progress = [:]
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
        initializeProgress()
    }
}
