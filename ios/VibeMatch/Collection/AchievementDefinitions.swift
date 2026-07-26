import Foundation

// MARK: - Achievement Requirement

/// Defines what a player must do to complete an achievement.
/// Each requirement type maps to a specific field in LifetimeStats or CollectionManager,
/// making evaluation straightforward and testable.
enum AchievementRequirement: Codable, Hashable, Sendable {
    // Score-based
    case singleGameScore(Int)
    case lifetimeScore(Int)
    case dailyModeScore(Int)              // Score threshold in Daily Challenge mode

    // Combo-based
    case singleGameCombo(Int)
    case lifetimeHighestCombo(Int)

    // Cascade-based
    case singleGameCascades(Int)

    // Special tiles
    case createSpecialTile(SpecialTileType)
    case singleGameBombsCreated(Int)      // Bombs created in a single game
    case lifetimeBombsCreated(Int)
    case lifetimeVibestreaksCreated(Int)
    case lifetimeCosmicBlastsCreated(Int)

    // Shape bonuses
    case landShapeBonus(ShapeBonusType)
    case singleGameLShapes(Int)           // L-shapes in a single game
    case singleGameTShapes(Int)           // T-shapes in a single game
    case singleGameCrossShapes(Int)       // Cross-shapes in a single game
    case singleGameShapeTrifecta          // All 3 shape types in one game
    case lifetimeLShapes(Int)
    case lifetimeTShapes(Int)
    case lifetimeCrossShapes(Int)

    // Collection
    case uniqueBadgesDiscovered(Int)
    case firstBadgeOfTier(BadgeTier)      // First pin collected of a specific tier
    case allBadgesOfTier(BadgeTier, Int)  // All N badges of a tier collected
    case totalFoundOfTier(BadgeTier, Int) // Lifetime pulls of a tier (counts duplicates)
    case badgeMatchMastery(MatchMasteryLevel)        // Any single badge at this level
    case badgesAtMatchMastery(MatchMasteryLevel, Int) // N badges at this level

    // Profile / engagement
    case hasUploadedAvatar                // Uploaded a profile picture

    // Streaks
    case dailyStreak(Int)

    // Games played
    case gamesPlayed(Int)
    case gamesPlayedToday(Int)            // Games played in a single day (daily cap)
    case perfectGames(Int)

    // Chests / Capsules
    case chestsOpened(Int)

    // Referrals
    case referralCount(Int)

    // Special (server-verified)
    case dailyChampion                    // Finish #1 on Daily Challenge
}

// MARK: - Achievement Category

/// Groups achievements for UI organization and tab filtering.
/// Aligned with web: Journey (FTUE progression) and Mastery (long-term goals).
enum AchievementCategory: String, Codable, Hashable, Sendable, CaseIterable {
    case journey = "Journey"
    case mastery = "Mastery"
    case score = "Score"
    case combo = "Combo"
    case cascade = "Cascade"
    case daily = "Daily"
    case specialTiles = "Special Tiles"
    case shapes = "Shapes"
    case streaks = "Streaks"
    case collection = "Collection"
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
    let capsuleReward: Int     // Number of capsules awarded on completion (synced with web)
    var order: Int = 0         // Display order within category (unused; defaulted)
    let requirement: AchievementRequirement

    /// The numerical goal for progress tracking.
    /// Extracted from the requirement for uniform progress bar display.
    var goal: Int {
        switch requirement {
        case .singleGameScore(let n),
             .lifetimeScore(let n),
             .dailyModeScore(let n),
             .singleGameCombo(let n),
             .lifetimeHighestCombo(let n),
             .singleGameCascades(let n),
             .singleGameBombsCreated(let n),
             .lifetimeBombsCreated(let n),
             .lifetimeVibestreaksCreated(let n),
             .lifetimeCosmicBlastsCreated(let n),
             .singleGameLShapes(let n),
             .singleGameTShapes(let n),
             .singleGameCrossShapes(let n),
             .lifetimeLShapes(let n),
             .lifetimeTShapes(let n),
             .lifetimeCrossShapes(let n),
             .uniqueBadgesDiscovered(let n),
             .dailyStreak(let n),
             .gamesPlayed(let n),
             .gamesPlayedToday(let n),
             .perfectGames(let n),
             .chestsOpened(let n),
             .referralCount(let n):
            return n
        case .badgesAtMatchMastery(_, let count):
            return count
        case .allBadgesOfTier(_, let count):
            return count
        case .totalFoundOfTier(_, let count):
            return count
        case .createSpecialTile, .landShapeBonus, .badgeMatchMastery,
             .firstBadgeOfTier, .singleGameShapeTrifecta, .dailyChampion,
             .hasUploadedAvatar:
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
            capsuleReward: 1,
            requirement: .singleGameScore(1000)
        ),
        AchievementDefinition(
            id: "score_getting_warmed_up",
            name: "Getting Warmed Up",
            description: "Score 3,000 points in a single game",
            icon: "star.fill",
            category: .score,
            capsuleReward: 1,
            requirement: .singleGameScore(3000)
        ),
        AchievementDefinition(
            id: "score_vibe_check",
            name: "Vibe Check",
            description: "Score 5,000 points in a single game",
            icon: "star.circle",
            category: .score,
            capsuleReward: 2,
            requirement: .singleGameScore(5000)
        ),
        AchievementDefinition(
            id: "score_vibe_master",
            name: "Vibe Master",
            description: "Score 10,000 points in a single game",
            icon: "star.circle.fill",
            category: .score,
            capsuleReward: 2,
            requirement: .singleGameScore(10000)
        ),
        AchievementDefinition(
            id: "score_cosmic_energy",
            name: "Cosmic Energy",
            description: "Score 25,000 points in a single game",
            icon: "sparkles",
            category: .score,
            capsuleReward: 3,
            requirement: .singleGameScore(25000)
        ),
        AchievementDefinition(
            id: "score_transcendent",
            name: "Transcendent",
            description: "Score 50,000 points in a single game",
            icon: "sun.max.fill",
            category: .score,
            capsuleReward: 5,
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
            capsuleReward: 1,
            requirement: .singleGameCombo(2)
        ),
        AchievementDefinition(
            id: "combo_on_a_roll",
            name: "On a Roll",
            description: "Reach a 3x combo in a single game",
            icon: "bolt.fill",
            category: .combo,
            capsuleReward: 1,
            requirement: .singleGameCombo(3)
        ),
        AchievementDefinition(
            id: "combo_chain_reaction",
            name: "Chain Reaction",
            description: "Reach a 4x combo in a single game",
            icon: "bolt.circle",
            category: .combo,
            capsuleReward: 2,
            requirement: .singleGameCombo(4)
        ),
        AchievementDefinition(
            id: "combo_unstoppable",
            name: "Unstoppable",
            description: "Reach a 6x combo in a single game",
            icon: "bolt.circle.fill",
            category: .combo,
            capsuleReward: 2,
            requirement: .singleGameCombo(6)
        ),
        AchievementDefinition(
            id: "combo_maximum_overdrive",
            name: "Maximum Overdrive",
            description: "Reach a 10x combo in a single game",
            icon: "bolt.shield.fill",
            category: .combo,
            capsuleReward: 3,
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
            capsuleReward: 1,
            requirement: .singleGameCascades(3)
        ),
        AchievementDefinition(
            id: "cascade_domino_effect",
            name: "Domino Effect",
            description: "Trigger 5 cascades in a single game",
            icon: "arrow.down.circle.fill",
            category: .cascade,
            capsuleReward: 2,
            requirement: .singleGameCascades(5)
        ),
        AchievementDefinition(
            id: "cascade_king",
            name: "Cascade King",
            description: "Trigger 8 cascades in a single game",
            icon: "crown",
            category: .cascade,
            capsuleReward: 3,
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
            capsuleReward: 1,
            requirement: .createSpecialTile(.bomb)
        ),
        AchievementDefinition(
            id: "special_streak",
            name: "Laser Party",
            description: "Create your first Laser Party tile",
            icon: "line.horizontal.3",
            category: .specialTiles,
            capsuleReward: 1,
            requirement: .createSpecialTile(.vibestreak)
        ),
        AchievementDefinition(
            id: "special_cosmic_power",
            name: "Cosmic Power",
            description: "Create your first Cosmic Blast tile",
            icon: "sparkle",
            category: .specialTiles,
            capsuleReward: 2,
            requirement: .createSpecialTile(.cosmicBlast)
        ),
        AchievementDefinition(
            id: "special_bomb_squad",
            name: "Bomb Squad",
            description: "Create 25 Bomb tiles across all games",
            icon: "flame.fill",
            category: .specialTiles,
            capsuleReward: 2,
            requirement: .lifetimeBombsCreated(25)
        ),
        AchievementDefinition(
            id: "special_streak_master",
            name: "Laser Party Master",
            description: "Create 25 Laser Party tiles across all games",
            icon: "line.3.horizontal",
            category: .specialTiles,
            capsuleReward: 2,
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
            capsuleReward: 1,
            requirement: .landShapeBonus(.L)
        ),
        AchievementDefinition(
            id: "shape_t_time",
            name: "T-Time",
            description: "Land your first T-shape match",
            icon: "t.square",
            category: .shapes,
            capsuleReward: 1,
            requirement: .landShapeBonus(.T)
        ),
        AchievementDefinition(
            id: "shape_cross_master",
            name: "Cross Master",
            description: "Land your first cross-shape match",
            icon: "plus.square",
            category: .shapes,
            capsuleReward: 2,
            requirement: .landShapeBonus(.cross)
        ),
        AchievementDefinition(
            id: "shape_l_veteran",
            name: "L-Veteran",
            description: "Land 50 L-shape matches across all games",
            icon: "l.square.fill",
            category: .shapes,
            capsuleReward: 3,
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
            capsuleReward: 1,
            requirement: .uniqueBadgesDiscovered(10)
        ),
        AchievementDefinition(
            id: "collection_collector",
            name: "Collector",
            description: "Discover 25 unique badges",
            icon: "rectangle.grid.2x2.fill",
            category: .collection,
            capsuleReward: 2,
            requirement: .uniqueBadgesDiscovered(25)
        ),
        AchievementDefinition(
            id: "collection_connoisseur",
            name: "Connoisseur",
            description: "Discover 50 unique badges",
            icon: "rectangle.grid.3x2",
            category: .collection,
            capsuleReward: 3,
            requirement: .uniqueBadgesDiscovered(50)
        ),
        AchievementDefinition(
            id: "collection_archivist",
            name: "Archivist",
            description: "Discover 75 unique badges",
            icon: "rectangle.grid.3x2.fill",
            category: .collection,
            capsuleReward: 3,
            requirement: .uniqueBadgesDiscovered(75)
        ),
        AchievementDefinition(
            id: "collection_completionist",
            name: "Completionist",
            description: "Discover all 100 badges",
            icon: "checkmark.seal.fill",
            category: .collection,
            capsuleReward: 5,
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
            capsuleReward: 1,
            requirement: .dailyStreak(3)
        ),
        AchievementDefinition(
            id: "streak_dedicated",
            name: "Dedicated",
            description: "Play for 7 days in a row",
            icon: "calendar.badge.clock",
            category: .streaks,
            capsuleReward: 2,
            requirement: .dailyStreak(7)
        ),
        AchievementDefinition(
            id: "streak_committed",
            name: "Committed",
            description: "Play for 30 days in a row",
            icon: "calendar.circle",
            category: .streaks,
            capsuleReward: 3,
            requirement: .dailyStreak(30)
        ),
        AchievementDefinition(
            id: "streak_legend",
            name: "Legend",
            description: "Play for 100 days in a row",
            icon: "calendar.circle.fill",
            category: .streaks,
            capsuleReward: 5,
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
            capsuleReward: 1,
            requirement: .gamesPlayed(1)
        ),
        AchievementDefinition(
            id: "daily_ten_games",
            name: "Getting Hooked",
            description: "Play 10 games total",
            icon: "play.circle.fill",
            category: .daily,
            capsuleReward: 1,
            requirement: .gamesPlayed(10)
        ),
        AchievementDefinition(
            id: "daily_fifty_games",
            name: "Dedicated Player",
            description: "Play 50 games total",
            icon: "gamecontroller",
            category: .daily,
            capsuleReward: 2,
            requirement: .gamesPlayed(50)
        ),
        AchievementDefinition(
            id: "daily_hundred_games",
            name: "Centurion",
            description: "Play 100 games total",
            icon: "gamecontroller.fill",
            category: .daily,
            capsuleReward: 3,
            requirement: .gamesPlayed(100)
        ),
        AchievementDefinition(
            id: "daily_perfect_first",
            name: "Perfectionist",
            description: "Earn 3 stars on any level",
            icon: "star.leadinghalf.filled",
            category: .daily,
            capsuleReward: 1,
            requirement: .perfectGames(1)
        ),
        AchievementDefinition(
            id: "daily_ten_perfects",
            name: "Consistently Perfect",
            description: "Earn 3 stars on 10 different games",
            icon: "rosette",
            category: .daily,
            capsuleReward: 3,
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
            capsuleReward: 1,
            requirement: .badgeMatchMastery(.bronze)
        ),
        AchievementDefinition(
            id: "mastery_gold_first",
            name: "Gold Standard",
            description: "Reach Gold mastery on any badge",
            icon: "shield.fill",
            category: .mastery,
            capsuleReward: 2,
            requirement: .badgeMatchMastery(.gold)
        ),
        AchievementDefinition(
            id: "mastery_animated_first",
            name: "Badge Expert",
            description: "Reach Animated (max) mastery on any badge",
            icon: "shield.lefthalf.filled",
            category: .mastery,
            capsuleReward: 3,
            requirement: .badgeMatchMastery(.animated)
        ),
        AchievementDefinition(
            id: "mastery_animated_ten",
            name: "Master Curator",
            description: "Reach Animated mastery on 10 different badges",
            icon: "shield.checkered",
            category: .mastery,
            capsuleReward: 5,
            requirement: .badgesAtMatchMastery(.animated, 10)
        ),
        AchievementDefinition(
            id: "mastery_chest_opener",
            name: "Treasure Hunter",
            description: "Open 50 chests total",
            icon: "shippingbox.fill",
            category: .general,
            capsuleReward: 3,
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

        case .dailyModeScore(let target):
            let value = stats.highestDailyScore
            return (value, value >= target)

        case .singleGameCombo(let target):
            let value = stats.highestCombo
            return (value, value >= target)

        case .lifetimeHighestCombo(let target):
            let value = stats.highestCombo
            return (value, value >= target)

        case .singleGameCascades(let target):
            let value = stats.bestSingleGameCascades
            return (value, value >= target)

        case .createSpecialTile(let type):
            let created: Bool
            switch type {
            case .bomb:        created = stats.hasCreatedBomb
            case .vibestreak:  created = stats.hasCreatedVibestreak
            case .cosmicBlast: created = stats.hasCreatedCosmicBlast
            }
            return (created ? 1 : 0, created)

        case .singleGameBombsCreated(let target):
            let value = stats.bestSingleGameBombs
            return (value, value >= target)

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
            case .L:      landed = stats.hasLandedL
            case .T:      landed = stats.hasLandedT
            case .cross:  landed = stats.hasLandedCross
            }
            return (landed ? 1 : 0, landed)

        case .singleGameLShapes(let target):
            let value = stats.bestSingleGameLShapes
            return (value, value >= target)

        case .singleGameTShapes(let target):
            let value = stats.bestSingleGameTShapes
            return (value, value >= target)

        case .singleGameCrossShapes(let target):
            let value = stats.bestSingleGameCrossShapes
            return (value, value >= target)

        case .singleGameShapeTrifecta:
            let achieved = stats.hasAchievedShapeTrifecta
            return (achieved ? 1 : 0, achieved)

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

        case .firstBadgeOfTier(let tier):
            let hasTier = collectionManager.discoveredBadges.values.contains {
                $0.badge.tier == tier
            }
            return (hasTier ? 1 : 0, hasTier)

        case .allBadgesOfTier(let tier, let count):
            let collected = collectionManager.discoveredBadges.values.filter {
                $0.badge.tier == tier
            }.count
            return (collected, collected >= count)

        case .totalFoundOfTier(let tier, let count):
            let value = stats.totalFoundByTier[tier] ?? 0
            return (value, value >= count)

        case .hasUploadedAvatar:
            let uploaded = stats.hasUploadedAvatar
            return (uploaded ? 1 : 0, uploaded)


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

        case .gamesPlayedToday(let target):
            let value = stats.gamesPlayedToday
            return (value, value >= target)

        case .perfectGames(let target):
            let value = stats.perfectGames
            return (value, value >= target)

        case .chestsOpened(let target):
            let value = stats.totalChestsOpened
            return (value, value >= target)

        case .referralCount(let target):
            let value = stats.referrals
            return (value, value >= target)

        case .dailyChampion:
            let achieved = stats.hasDailyChampion
            return (achieved ? 1 : 0, achieved)
        }
    }

    // MARK: - Reward Claiming

    /// Claims the capsule reward for a completed achievement.
    /// Awards N capsules (as bronze chests) based on the achievement's capsuleReward.
    /// Returns all earned chests, or empty array if the achievement isn't ready to claim.
    func claimReward(for achievementId: String) -> [EarnedChest] {
        guard let definition = ACHIEVEMENT_LOOKUP[achievementId],
              var prog = progress[achievementId],
              prog.isCompleted,
              !prog.isRewardClaimed else {
            return []
        }

        prog.isRewardClaimed = true
        progress[achievementId] = prog
        save()

        // Award N capsules as individual chests (matching web's capsule reward system)
        var chests: [EarnedChest] = []
        for _ in 0..<definition.capsuleReward {
            let chest = chestSystem.awardChest(
                tier: .bronze,
                trigger: .achievement(definition.name)
            )
            chests.append(chest)
        }
        return chests
    }

    /// Claims all unclaimed achievement rewards at once.
    /// Returns all earned chests.
    func claimAllRewards() -> [EarnedChest] {
        var chests: [EarnedChest] = []
        for achievement in unclaimedAchievements {
            chests.append(contentsOf: claimReward(for: achievement.id))
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
