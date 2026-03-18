import Foundation
import Observation

// MARK: - Chest Tier (Extended)

/// Extension adding detailed drop configuration to ChestType.
/// These are the core economy levers for the chest system.
///
/// Design philosophy: Chests are EARNED through gameplay performance and achievements,
/// NEVER purchased. This ensures badges retain their meaning as skill/dedication markers
/// rather than becoming pay-to-win commodities. The NFT community values earned scarcity.
///
/// All values are [PLACEHOLDER] until playtested. The key tuning question is:
/// "Does opening a bronze chest feel worth the effort, and does a cosmic chest feel legendary?"
extension ChestType {

    /// Range of badge drops per chest opening.
    /// Higher tiers give more drops, increasing the excitement of each opening.
    var badgeCountRange: ClosedRange<Int> {
        switch self {
        case .bronze: return 1...2
        case .silver: return 2...3
        case .gold:   return 3...4
        case .cosmic: return 4...6
        }
    }

    /// The lowest badge tier guaranteed to appear in at least one drop.
    /// This is the "floor" — players always get at least this quality.
    var guaranteedMinTier: BadgeTier {
        switch self {
        case .bronze: return .blue
        case .silver: return .blue
        case .gold:   return .silver
        case .cosmic: return .gold
        }
    }

    /// Chance that any individual drop slot rolls a cosmic badge.
    /// [PLACEHOLDER] — tune so cosmic badges feel rare but not impossible.
    /// Target: ~1 cosmic per 20 gold chests, ~1 per 3 cosmic chests.
    var cosmicChance: Double {
        switch self {
        case .bronze: return 0.00   // [PLACEHOLDER] Never from bronze
        case .silver: return 0.05   // [PLACEHOLDER] 5% per slot
        case .gold:   return 0.15   // [PLACEHOLDER] 15% per slot
        case .cosmic: return 0.40   // [PLACEHOLDER] 40% per slot
        }
    }

    /// Chance that any individual drop slot rolls a gold badge.
    var goldChance: Double {
        switch self {
        case .bronze: return 0.05   // [PLACEHOLDER]
        case .silver: return 0.15   // [PLACEHOLDER]
        case .gold:   return 0.35   // [PLACEHOLDER]
        case .cosmic: return 0.30   // [PLACEHOLDER]
        }
    }

    /// Chance that any individual drop slot rolls a silver badge.
    var silverChance: Double {
        switch self {
        case .bronze: return 0.25   // [PLACEHOLDER]
        case .silver: return 0.35   // [PLACEHOLDER]
        case .gold:   return 0.30   // [PLACEHOLDER]
        case .cosmic: return 0.20   // [PLACEHOLDER]
        }
    }

    /// Display name for UI.
    var displayName: String {
        switch self {
        case .bronze: return "Bronze Chest"
        case .silver: return "Silver Chest"
        case .gold:   return "Gold Chest"
        case .cosmic: return "Cosmic Chest"
        }
    }

    /// SF Symbol icon name.
    var iconName: String {
        switch self {
        case .bronze: return "shippingbox"
        case .silver: return "shippingbox.fill"
        case .gold:   return "archivebox.fill"
        case .cosmic: return "sparkles"
        }
    }
}

// MARK: - Chest Trigger

/// Defines the gameplay event that earned a chest.
/// Every trigger is performance or achievement based — NEVER purchased.
///
/// Design rationale: By tying chests to specific gameplay moments, we create
/// "micro-celebrations" that punctuate the session. The player scores 5000 and
/// gets a chest — that's an emotional peak that reinforces the core loop.
enum ChestTrigger: Codable, Hashable, Sendable {
    /// Reached a score threshold in a single game.
    case scoreThreshold(Int)

    /// Achieved a combo chain of the given length.
    case comboAchievement(Int)

    /// Maintained a daily play streak of this many days.
    case dailyStreak(Int)

    /// Landed a specific shape bonus during gameplay.
    case shapeBonus(ShapeBonusType)

    /// Achieved a perfect 3-star rating on a level.
    case perfectGame

    /// Reached a collection milestone (25/50/75/100 unique badges).
    case collectionMilestone(Int)

    /// Created a specific special tile type for the first time.
    case firstSpecialTile(SpecialTileType)

    /// Triggered a cascade chain of the given depth.
    case cascadeChain(Int)

    /// Completed a weekly challenge.
    case weeklyChallenge

    /// Achievement system awarded this chest.
    case achievement(String)

    /// Human-readable description of how the chest was earned.
    var displayReason: String {
        switch self {
        case .scoreThreshold(let score):
            return "Scored \(score)+ points"
        case .comboAchievement(let combo):
            return "Hit \(combo)x combo"
        case .dailyStreak(let days):
            return "\(days)-day play streak"
        case .shapeBonus(let shape):
            return "Landed a \(shape.rawValue)-shape match"
        case .perfectGame:
            return "Perfect game"
        case .collectionMilestone(let count):
            return "Discovered \(count) badges"
        case .firstSpecialTile(let tile):
            return "First \(tile.rawValue) tile"
        case .cascadeChain(let depth):
            return "\(depth)+ cascade chain"
        case .weeklyChallenge:
            return "Weekly challenge complete"
        case .achievement(let name):
            return "Achievement: \(name)"
        }
    }
}

// MARK: - Earned Chest

/// A chest with full provenance: what earned it, when, and its tier.
/// Extends the base Chest model with trigger tracking for the UI to show
/// "how you earned this" context.
struct EarnedChest: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let tier: ChestType
    let trigger: ChestTrigger
    let earnedAt: Date

    init(tier: ChestType, trigger: ChestTrigger, earnedAt: Date = .now) {
        self.id = UUID()
        self.tier = tier
        self.trigger = trigger
        self.earnedAt = earnedAt
    }
}

// MARK: - Chest Drop Result

/// The result of opening a single chest: all badge drops with metadata.
struct ChestOpenResult: Sendable {
    let chest: EarnedChest
    let rewards: [ChestRewardDrop]
    let newDiscoveries: [String]  // Badge IDs discovered for the first time

    /// Total badges received across all drops.
    var totalBadgesReceived: Int {
        rewards.reduce(0) { $0 + $1.quantity }
    }
}

/// A single badge drop from a chest opening.
struct ChestRewardDrop: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let badgeId: String
    let badgeName: String
    let badgeTier: BadgeTier
    let quantity: Int
    let isNewDiscovery: Bool

    init(badge: Badge, quantity: Int, isNewDiscovery: Bool) {
        self.id = UUID()
        self.badgeId = badge.id
        self.badgeName = badge.name
        self.badgeTier = badge.tier
        self.quantity = quantity
        self.isNewDiscovery = isNewDiscovery
    }
}

// MARK: - Game Result

/// Summary of a completed game session, used to evaluate chest-earning triggers
/// and update achievement progress.
struct GameResult: Codable, Hashable, Sendable {
    let score: Int
    let maxCombo: Int
    let cascadeCount: Int
    let matchCount: Int
    let shapeBonuses: [ShapeBonusType]
    let specialTilesCreated: [SpecialTileType]
    let movesUsed: Int
    let stars: Int  // 0-3 star rating

    /// Per-badge match counts for mastery tracking. [badgeId: timesMatched]
    let badgeMatchCounts: [String: Int]
}

// MARK: - Lifetime Stats

/// Cumulative player statistics across all games. Used for threshold-based
/// chest triggers and achievement tracking.
struct LifetimeStats: Codable, Hashable, Sendable {
    var totalScore: Int = 0
    var totalGamesPlayed: Int = 0
    var totalMatchesMade: Int = 0
    var totalCascades: Int = 0
    var highestCombo: Int = 0
    var highestScore: Int = 0
    var totalStarsEarned: Int = 0
    var perfectGames: Int = 0
    var currentDailyStreak: Int = 0
    var longestDailyStreak: Int = 0
    var lastPlayedDate: Date?
    var totalChestsOpened: Int = 0
    var totalChestsEarned: Int = 0

    // Shape bonus lifetime counts
    var lShapesLanded: Int = 0
    var tShapesLanded: Int = 0
    var crossShapesLanded: Int = 0
    // Special tile lifetime counts
    var bombsCreated: Int = 0
    var vibestreaksCreated: Int = 0
    var cosmicBlastsCreated: Int = 0

    /// Whether first special tiles have been created (for one-time triggers).
    var hasCreatedBomb: Bool = false
    var hasCreatedVibestreak: Bool = false
    var hasCreatedCosmicBlast: Bool = false

    /// Whether first shape bonuses have been earned (for one-time triggers).
    var hasLandedL: Bool = false
    var hasLandedT: Bool = false
    var hasLandedCross: Bool = false
}

// MARK: - Chest System

/// Manages chest earning, inventory, and opening.
///
/// Core design contract: Chests are ONLY earned through gameplay performance and
/// achievements. There is no purchase path. This is a deliberate ethical choice —
/// the badges are the community's IP and their value comes from being earned,
/// not bought.
///
/// The chest system sits between the core gameplay loop (moment-to-moment) and the
/// collection system (long-term progression). It converts gameplay performance into
/// tangible collection rewards, creating the "session loop" closure.
@Observable
final class ChestSystem {

    // MARK: - State

    /// Earned but unopened chests.
    private(set) var pendingChests: [EarnedChest] = []

    /// Lifetime player statistics for cumulative achievement tracking.
    private(set) var lifetimeStats: LifetimeStats = LifetimeStats()

    /// Reference to the collection manager for discovery checks during chest opening.
    private let collectionManager: CollectionManager

    /// Reference to the badge catalog for drop resolution.
    private let badgeCatalog: [Badge]

    /// Badges grouped by tier for efficient drop rolling.
    private let badgesByTier: [BadgeTier: [Badge]]

    /// Maximum pending chests before oldest are auto-opened.
    /// [PLACEHOLDER] — 20 feels generous without creating UI clutter.
    let maxPendingChests = 20

    var pendingChestCount: Int { pendingChests.count }

    init(collectionManager: CollectionManager, badgeCatalog: [Badge] = BADGES) {
        self.collectionManager = collectionManager
        self.badgeCatalog = badgeCatalog
        self.badgesByTier = Dictionary(grouping: badgeCatalog, by: \.tier)
        load()
    }

    // MARK: - Chest Earning

    /// Evaluates a completed game result and awards any earned chests.
    /// Called after every game session by the game flow controller.
    ///
    /// Returns all chests earned from this game session. The caller is responsible
    /// for presenting the chest-earned UI.
    func checkAchievements(afterGame result: GameResult) -> [EarnedChest] {
        var earned: [EarnedChest] = []

        // Update lifetime stats first
        updateLifetimeStats(with: result)

        // -- Score thresholds --
        // [PLACEHOLDER] thresholds need tuning against actual score distributions
        if result.score >= 25000 {
            earned.append(EarnedChest(tier: .gold, trigger: .scoreThreshold(25000)))
        } else if result.score >= 10000 {
            earned.append(EarnedChest(tier: .silver, trigger: .scoreThreshold(10000)))
        } else if result.score >= 5000 {
            earned.append(EarnedChest(tier: .bronze, trigger: .scoreThreshold(5000)))
        }

        // -- Combo achievements --
        if result.maxCombo >= 6 {
            earned.append(EarnedChest(tier: .silver, trigger: .comboAchievement(6)))
        } else if result.maxCombo >= 4 {
            earned.append(EarnedChest(tier: .bronze, trigger: .comboAchievement(4)))
        }

        // -- Cascade chains --
        if result.cascadeCount >= 5 {
            earned.append(EarnedChest(tier: .silver, trigger: .cascadeChain(5)))
        } else if result.cascadeCount >= 3 {
            earned.append(EarnedChest(tier: .bronze, trigger: .cascadeChain(3)))
        }

        // -- Perfect game --
        if result.stars == 3 {
            earned.append(EarnedChest(tier: .silver, trigger: .perfectGame))
        }

        // -- Shape bonuses (first-time triggers) --
        for shape in result.shapeBonuses {
            switch shape {
            case .l where !lifetimeStats.hasLandedL:
                earned.append(EarnedChest(tier: .bronze, trigger: .shapeBonus(.l)))
                lifetimeStats.hasLandedL = true
            case .t where !lifetimeStats.hasLandedT:
                earned.append(EarnedChest(tier: .bronze, trigger: .shapeBonus(.t)))
                lifetimeStats.hasLandedT = true
            case .cross where !lifetimeStats.hasLandedCross:
                earned.append(EarnedChest(tier: .silver, trigger: .shapeBonus(.cross)))
                lifetimeStats.hasLandedCross = true
            default:
                break
            }
        }

        // -- Special tile first creation --
        for tile in result.specialTilesCreated {
            switch tile {
            case .bomb where !lifetimeStats.hasCreatedBomb:
                earned.append(EarnedChest(tier: .bronze, trigger: .firstSpecialTile(.bomb)))
                lifetimeStats.hasCreatedBomb = true
            case .vibestreak where !lifetimeStats.hasCreatedVibestreak:
                earned.append(EarnedChest(tier: .bronze, trigger: .firstSpecialTile(.vibestreak)))
                lifetimeStats.hasCreatedVibestreak = true
            case .cosmicBlast where !lifetimeStats.hasCreatedCosmicBlast:
                earned.append(EarnedChest(tier: .silver, trigger: .firstSpecialTile(.cosmicBlast)))
                lifetimeStats.hasCreatedCosmicBlast = true
            default:
                break
            }
        }

        // -- Collection milestones --
        let discovered = collectionManager.totalDiscovered
        for milestone in [25, 50, 75, 100] {
            // Check if we just crossed the milestone this game
            let previousDiscovered = discovered - result.badgeMatchCounts.filter {
                collectionManager.badge($0.key)?.firstDiscoveredAt ?? .distantPast > Date(timeIntervalSinceNow: -60)
            }.count
            if previousDiscovered < milestone && discovered >= milestone {
                let tier: ChestType = milestone >= 75 ? .gold : (milestone >= 50 ? .silver : .bronze)
                earned.append(EarnedChest(tier: tier, trigger: .collectionMilestone(milestone)))
            }
        }

        // -- Daily streak --
        let streak = lifetimeStats.currentDailyStreak
        if streak == 7 {
            earned.append(EarnedChest(tier: .gold, trigger: .dailyStreak(7)))
        } else if streak == 30 {
            earned.append(EarnedChest(tier: .cosmic, trigger: .dailyStreak(30)))
        }

        // Add all earned chests to pending
        for chest in earned {
            addChest(chest)
        }

        save()
        return earned
    }

    /// Directly awards a chest (used by achievement system or external triggers).
    func awardChest(tier: ChestType, trigger: ChestTrigger) -> EarnedChest {
        let chest = EarnedChest(tier: tier, trigger: trigger)
        addChest(chest)
        save()
        return chest
    }

    private func addChest(_ chest: EarnedChest) {
        pendingChests.append(chest)
        lifetimeStats.totalChestsEarned += 1

        // If over capacity, keep newest and discard oldest
        if pendingChests.count > maxPendingChests {
            pendingChests = Array(pendingChests.suffix(maxPendingChests))
        }
    }

    // MARK: - Chest Opening

    /// Opens a chest and resolves all badge drops.
    ///
    /// Drop algorithm:
    /// 1. Determine number of drops from tier's badgeCountRange
    /// 2. For each drop slot, roll tier using chest tier's probability distribution
    /// 3. Select a random badge from that tier
    /// 4. Bias toward undiscovered badges: if the player hasn't found all badges of
    ///    a tier, there's a 60% chance [PLACEHOLDER] we pick an undiscovered one
    /// 5. The first drop is always an undiscovered badge if any exist (discovery guarantee)
    /// 6. Add all drops to the collection
    ///
    /// The "always one new badge" guarantee is critical for maintaining discovery excitement.
    /// Without it, veteran players would get diminishing returns from chests, eroding
    /// motivation. The guarantee means every chest opening has at least one moment of "ooh!"
    func openChest(_ chest: EarnedChest) -> ChestOpenResult {
        guard let index = pendingChests.firstIndex(where: { $0.id == chest.id }) else {
            // Chest not found — return empty result
            return ChestOpenResult(chest: chest, rewards: [], newDiscoveries: [])
        }

        pendingChests.remove(at: index)
        lifetimeStats.totalChestsOpened += 1

        // Determine number of drops
        let dropCount = Int.random(in: chest.tier.badgeCountRange)

        var rewards: [ChestRewardDrop] = []
        var newDiscoveries: [String] = []
        var usedBadgeIds: Set<String> = []  // Avoid duplicate drops in same chest

        for dropIndex in 0..<dropCount {
            // Roll badge tier for this slot
            let rolledTier = rollBadgeTier(chestTier: chest.tier)

            // Select a specific badge
            let badge: Badge
            let isFirstDrop = dropIndex == 0
            let undiscovered = undiscoveredBadgesForTier(rolledTier, excluding: usedBadgeIds)

            if isFirstDrop && !undiscovered.isEmpty {
                // First drop guarantee: always a new badge if possible
                badge = undiscovered.randomElement()!
            } else if !undiscovered.isEmpty && Double.random(in: 0..<1) < 0.6 {
                // 60% bias toward undiscovered badges [PLACEHOLDER]
                badge = undiscovered.randomElement()!
            } else {
                // Random from all badges of this tier
                let candidates = badgesForTier(rolledTier, excluding: usedBadgeIds)
                if let picked = candidates.randomElement() {
                    badge = picked
                } else {
                    // Fallback: any badge of this tier (allow repeats)
                    guard let fallback = badgesByTier[rolledTier]?.randomElement() else { continue }
                    badge = fallback
                }
            }

            usedBadgeIds.insert(badge.id)

            // Determine quantity (higher tier chests can give more copies)
            let quantity = rollDropQuantity(chestTier: chest.tier, badgeTier: rolledTier)

            let isNew = !collectionManager.isDiscovered(badge.id)
            if isNew {
                newDiscoveries.append(badge.id)
            }

            // Add to collection
            collectionManager.addBadge(badge.id, quantity: quantity)

            rewards.append(ChestRewardDrop(
                badge: badge,
                quantity: quantity,
                isNewDiscovery: isNew
            ))
        }

        save()

        return ChestOpenResult(
            chest: chest,
            rewards: rewards,
            newDiscoveries: newDiscoveries
        )
    }

    // MARK: - Drop Rolling

    /// Rolls a badge tier for a single drop slot based on the chest tier's probability table.
    /// Uses a weighted random roll: cosmic% -> gold% -> silver% -> remaining = blue.
    private func rollBadgeTier(chestTier: ChestType) -> BadgeTier {
        let roll = Double.random(in: 0..<1)

        let cosmicThreshold = chestTier.cosmicChance
        let goldThreshold = cosmicThreshold + chestTier.goldChance
        let silverThreshold = goldThreshold + chestTier.silverChance

        if roll < cosmicThreshold {
            return .cosmic
        } else if roll < goldThreshold {
            return .gold
        } else if roll < silverThreshold {
            return .silver
        } else {
            return .blue
        }
    }

    /// Rolls how many copies of a badge drop from a single slot.
    /// [PLACEHOLDER] — quantities are conservative to prevent inflation.
    ///
    /// Design constraint: Badge quantity matters for trading. If copies are too common,
    /// trading loses meaning. If too rare, trading feels impossible. Target: average
    /// player has 2-4 copies of common badges and 1-2 of rare badges after 20 sessions.
    private func rollDropQuantity(chestTier: ChestType, badgeTier: BadgeTier) -> Int {
        switch (chestTier, badgeTier) {
        case (.cosmic, .blue):   return Int.random(in: 2...3)
        case (.cosmic, .silver): return Int.random(in: 1...3)
        case (.cosmic, .gold):   return Int.random(in: 1...2)
        case (.cosmic, .cosmic): return 1
        case (.gold, .blue):     return Int.random(in: 1...3)
        case (.gold, .silver):   return Int.random(in: 1...2)
        case (.gold, .gold):     return 1
        case (.gold, .cosmic):   return 1
        case (.silver, .blue):   return Int.random(in: 1...2)
        case (.silver, .silver): return 1
        case (.silver, _):       return 1
        case (.bronze, _):       return 1
        }
    }

    /// Returns undiscovered badges of a specific tier, excluding already-used IDs.
    private func undiscoveredBadgesForTier(_ tier: BadgeTier, excluding used: Set<String>) -> [Badge] {
        (badgesByTier[tier] ?? []).filter { badge in
            !collectionManager.isDiscovered(badge.id) && !used.contains(badge.id)
        }
    }

    /// Returns all badges of a tier, excluding already-used IDs.
    private func badgesForTier(_ tier: BadgeTier, excluding used: Set<String>) -> [Badge] {
        (badgesByTier[tier] ?? []).filter { !used.contains($0.id) }
    }

    // MARK: - Lifetime Stats Update

    private func updateLifetimeStats(with result: GameResult) {
        lifetimeStats.totalScore += result.score
        lifetimeStats.totalGamesPlayed += 1
        lifetimeStats.totalMatchesMade += result.matchCount
        lifetimeStats.totalCascades += result.cascadeCount
        lifetimeStats.totalStarsEarned += result.stars

        if result.score > lifetimeStats.highestScore {
            lifetimeStats.highestScore = result.score
        }
        if result.maxCombo > lifetimeStats.highestCombo {
            lifetimeStats.highestCombo = result.maxCombo
        }
        if result.stars == 3 {
            lifetimeStats.perfectGames += 1
        }

        // Shape bonus counts
        for shape in result.shapeBonuses {
            switch shape {
            case .l:      lifetimeStats.lShapesLanded += 1
            case .t:      lifetimeStats.tShapesLanded += 1
            case .cross:  lifetimeStats.crossShapesLanded += 1
            }
        }

        // Special tile counts
        for tile in result.specialTilesCreated {
            switch tile {
            case .bomb:        lifetimeStats.bombsCreated += 1
            case .vibestreak:  lifetimeStats.vibestreaksCreated += 1
            case .cosmicBlast: lifetimeStats.cosmicBlastsCreated += 1
            }
        }

        // Daily streak tracking
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)

        if let lastPlayed = lifetimeStats.lastPlayedDate {
            let lastDay = calendar.startOfDay(for: lastPlayed)
            let dayDiff = calendar.dateComponents([.day], from: lastDay, to: today).day ?? 0

            if dayDiff == 1 {
                // Consecutive day — increment streak
                lifetimeStats.currentDailyStreak += 1
            } else if dayDiff > 1 {
                // Streak broken — reset
                lifetimeStats.currentDailyStreak = 1
            }
            // dayDiff == 0 means same day — don't change streak
        } else {
            // First ever game
            lifetimeStats.currentDailyStreak = 1
        }

        lifetimeStats.lastPlayedDate = .now

        if lifetimeStats.currentDailyStreak > lifetimeStats.longestDailyStreak {
            lifetimeStats.longestDailyStreak = lifetimeStats.currentDailyStreak
        }
    }

    // MARK: - Persistence

    // TODO: Server-side chest inventory for anti-cheat.
    // A malicious player could edit UserDefaults to add cosmic chests.
    // For production, chest earning should be server-validated:
    //   1. Client sends game result to server
    //   2. Server validates score/combo/cascade plausibility
    //   3. Server awards chests and returns them to client
    //   4. Chest opening rolls happen server-side
    // Local storage is fine for prototype/offline play.

    private static let chestsKey = "chest_system_pending"
    private static let statsKey = "chest_system_lifetime_stats"

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        if let data = try? encoder.encode(pendingChests) {
            UserDefaults.standard.set(data, forKey: Self.chestsKey)
        }
        if let data = try? encoder.encode(lifetimeStats) {
            UserDefaults.standard.set(data, forKey: Self.statsKey)
        }
    }

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        if let data = UserDefaults.standard.data(forKey: Self.chestsKey),
           let decoded = try? decoder.decode([EarnedChest].self, from: data) {
            pendingChests = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.statsKey),
           let decoded = try? decoder.decode(LifetimeStats.self, from: data) {
            lifetimeStats = decoded
        }
    }

    /// Resets all chest data. Destructive — debug/testing only.
    func reset() {
        pendingChests = []
        lifetimeStats = LifetimeStats()
        UserDefaults.standard.removeObject(forKey: Self.chestsKey)
        UserDefaults.standard.removeObject(forKey: Self.statsKey)
    }
}
