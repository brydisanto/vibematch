import Foundation

// MARK: - Mastery Level

/// Mastery level for a badge in the player's collection.
/// Earned by collecting enough duplicates of the same badge.
enum MasteryLevel: Int, Codable, Hashable, Sendable, CaseIterable, Comparable {
    case none = 0
    case bronze = 1
    case silver = 2
    case gold = 3
    case cosmic = 4

    /// Number of badge copies required to reach this mastery level.
    var requiredQuantity: Int {
        switch self {
        case .none:   return 0
        case .bronze: return 3
        case .silver: return 10
        case .gold:   return 25
        case .cosmic: return 50
        }
    }

    static func < (lhs: MasteryLevel, rhs: MasteryLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

// MARK: - Collected Badge

/// A badge in the player's collection, tracking quantity and mastery progress.
struct CollectedBadge: Codable, Hashable, Identifiable, Sendable {
    /// The badge definition.
    let badge: Badge

    /// How many copies the player owns.
    var quantity: Int

    /// Current mastery level (derived from quantity thresholds).
    var masteryLevel: MasteryLevel

    var id: String { badge.id }
}

// MARK: - Badge Collection

/// The player's full badge collection, including all collected badges
/// and aggregate statistics.
struct BadgeCollection: Codable, Sendable {
    /// All badges the player has collected, keyed by badge ID.
    var badges: [String: CollectedBadge]

    /// Total number of unique badges discovered.
    var uniqueCount: Int {
        badges.count
    }

    /// Total number of badge copies across all badges.
    var totalCount: Int {
        badges.values.reduce(0) { $0 + $1.quantity }
    }

    init(badges: [String: CollectedBadge] = [:]) {
        self.badges = badges
    }

    /// Add copies of a badge to the collection, updating mastery automatically.
    mutating func addBadge(_ badge: Badge, quantity: Int = 1) {
        if var existing = badges[badge.id] {
            existing.quantity += quantity
            existing.masteryLevel = Self.computeMastery(for: existing.quantity)
            badges[badge.id] = existing
        } else {
            let newQuantity = quantity
            badges[badge.id] = CollectedBadge(
                badge: badge,
                quantity: newQuantity,
                masteryLevel: Self.computeMastery(for: newQuantity)
            )
        }
    }

    /// Compute the mastery level for a given quantity.
    static func computeMastery(for quantity: Int) -> MasteryLevel {
        for level in MasteryLevel.allCases.reversed() {
            if quantity >= level.requiredQuantity {
                return level
            }
        }
        return .none
    }
}

// MARK: - Chest Type

/// The type of reward chest. Higher tiers contain rarer badge drops.
///
/// - bronze: Common chest, mostly blue-tier badges.
/// - silver: Uncommon chest, guaranteed silver+ badge.
/// - gold: Rare chest, guaranteed gold+ badge with higher quantities.
/// - cosmic: Legendary chest, guaranteed cosmic badge drop.
enum ChestType: String, Codable, Hashable, Sendable, CaseIterable {
    case bronze
    case silver
    case gold
    case cosmic

    /// Number of badge drops this chest contains.
    var dropCount: Int {
        switch self {
        case .bronze: return 2
        case .silver: return 3
        case .gold:   return 4
        case .cosmic: return 5
        }
    }
}

// MARK: - Chest Reward

/// A single drop from opening a chest: a badge and how many copies.
struct ChestReward: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let badge: Badge
    let quantity: Int

    init(badge: Badge, quantity: Int) {
        self.id = UUID()
        self.badge = badge
        self.quantity = quantity
    }
}

// MARK: - Chest

/// A reward chest earned through gameplay achievements or purchases.
/// Must be "opened" to reveal its badge rewards.
struct Chest: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let type: ChestType

    /// When the chest was earned.
    let earnedAt: Date

    /// Pre-determined rewards (generated server-side or at earn time).
    /// Nil until the chest is opened.
    var rewards: [ChestReward]?

    /// Whether this chest has been opened.
    var isOpened: Bool {
        rewards != nil
    }

    init(type: ChestType, earnedAt: Date = .now) {
        self.id = UUID()
        self.type = type
        self.earnedAt = earnedAt
        self.rewards = nil
    }
}

// MARK: - Trade Offer

/// A peer-to-peer badge trade offer (similar to Monopoly Go trading).
/// One player offers badges and requests specific badges in return.
struct TradeOffer: Codable, Hashable, Identifiable, Sendable {
    let id: UUID

    /// The player who created the trade offer.
    let fromPlayerID: String

    /// The player receiving the offer, or nil for open marketplace offers.
    let toPlayerID: String?

    /// Badges being offered (badge ID -> quantity).
    let offering: [String: Int]

    /// Badges being requested in return (badge ID -> quantity).
    let requesting: [String: Int]

    /// When the trade was created.
    let createdAt: Date

    /// When the trade expires. Nil means no expiration.
    let expiresAt: Date?

    /// Current status of the trade.
    var status: TradeStatus

    init(
        fromPlayerID: String,
        toPlayerID: String? = nil,
        offering: [String: Int],
        requesting: [String: Int],
        expiresAt: Date? = nil
    ) {
        self.id = UUID()
        self.fromPlayerID = fromPlayerID
        self.toPlayerID = toPlayerID
        self.offering = offering
        self.requesting = requesting
        self.createdAt = .now
        self.expiresAt = expiresAt
        self.status = .pending
    }
}

/// The lifecycle status of a trade offer.
enum TradeStatus: String, Codable, Hashable, Sendable {
    case pending
    case accepted
    case declined
    case expired
    case cancelled
}

// MARK: - Player Achievement

/// Tracks a player's progress toward an achievement that awards chests.
struct PlayerAchievement: Codable, Hashable, Identifiable, Sendable {
    let id: String

    /// Human-readable name.
    let name: String

    /// Description of what the player needs to do.
    let description: String

    /// Current progress toward the goal.
    var progress: Int

    /// Target value to complete the achievement.
    let goal: Int

    /// The type of chest awarded on completion.
    let chestReward: ChestType

    /// Whether the achievement has been completed and reward claimed.
    var isClaimed: Bool

    /// Whether the achievement goal has been met.
    var isComplete: Bool {
        progress >= goal
    }
}
