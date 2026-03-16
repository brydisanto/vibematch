import Foundation
import Observation

// MARK: - Match-Based Mastery

/// Mastery frame progression based on total times a badge has been matched in gameplay.
/// This is separate from the quantity-based MasteryLevel in CollectionModels — mastery
/// rewards skill and engagement, not hoarding duplicates.
///
/// Thresholds are [PLACEHOLDER] — tune after playtesting to ensure the average player
/// hits bronze within 3-5 sessions and holographic feels like a genuine achievement.
///
/// | Level | Matches | Frame        | Player Feel                          |
/// |-------|---------|--------------|--------------------------------------|
/// | 0     | 0       | none         | Just discovered, no investment yet   |
/// | 1     | 10      | bronze       | "I've used this badge a bunch"       |
/// | 2     | 25      | silver       | "This is becoming my go-to"          |
/// | 3     | 50      | gold         | "I've mastered this one"             |
/// | 4     | 100     | holographic  | "Flex-worthy, visible in trades"     |
/// | 5     | 200     | animated     | "Completionist status, social proof" |
enum MatchMasteryLevel: Int, Codable, Hashable, Sendable, CaseIterable, Comparable {
    case none = 0
    case bronze = 1
    case silver = 2
    case gold = 3
    case holographic = 4
    case animated = 5

    /// Total match count required to reach this mastery level.
    /// [PLACEHOLDER] — all thresholds need playtest validation.
    var requiredMatches: Int {
        switch self {
        case .none:        return 0
        case .bronze:      return 10
        case .silver:      return 25
        case .gold:        return 50
        case .holographic: return 100
        case .animated:    return 200
        }
    }

    /// Human-readable display name for the mastery frame.
    var displayName: String {
        switch self {
        case .none:        return "Undiscovered"
        case .bronze:      return "Bronze"
        case .silver:      return "Silver"
        case .gold:        return "Gold"
        case .holographic: return "Holographic"
        case .animated:    return "Animated"
        }
    }

    /// The next mastery level, or nil if already at max.
    var next: MatchMasteryLevel? {
        MatchMasteryLevel(rawValue: rawValue + 1)
    }

    /// Matches remaining to reach the next level, given a current count.
    /// Returns nil if already at max mastery.
    func matchesUntilNext(currentCount: Int) -> Int? {
        guard let nextLevel = next else { return nil }
        return max(0, nextLevel.requiredMatches - currentCount)
    }

    /// Compute the mastery level for a given total match count.
    static func level(forMatchCount count: Int) -> MatchMasteryLevel {
        for level in allCases.reversed() {
            if count >= level.requiredMatches {
                return level
            }
        }
        return .none
    }

    static func < (lhs: MatchMasteryLevel, rhs: MatchMasteryLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

// MARK: - Extended Collected Badge

/// Extended badge record that tracks match-based mastery in addition to quantity.
/// This enriches the base CollectedBadge from CollectionModels with gameplay-driven
/// progression data.
struct CollectedBadgeRecord: Codable, Hashable, Identifiable, Sendable {
    /// The badge definition.
    let badge: Badge

    /// How many copies the player owns (from chests and trades).
    var quantity: Int

    /// Quantity-based mastery level (from CollectionModels).
    var masteryLevel: MasteryLevel

    /// Total number of times this badge has been matched in gameplay.
    var totalTimesMatched: Int

    /// Match-based mastery level (bronze frame -> animated).
    var matchMastery: MatchMasteryLevel

    /// When the player first discovered this badge.
    let firstDiscoveredAt: Date

    var id: String { badge.id }

    /// Progress toward the next match mastery level, as 0.0 to 1.0.
    /// Returns 1.0 if already at max mastery.
    var matchMasteryProgress: Double {
        guard let next = matchMastery.next else { return 1.0 }
        let currentThreshold = matchMastery.requiredMatches
        let nextThreshold = next.requiredMatches
        let range = nextThreshold - currentThreshold
        guard range > 0 else { return 1.0 }
        let progress = totalTimesMatched - currentThreshold
        return min(1.0, Double(progress) / Double(range))
    }

    init(badge: Badge, quantity: Int = 1, firstDiscoveredAt: Date = .now) {
        self.badge = badge
        self.quantity = quantity
        self.masteryLevel = BadgeCollection.computeMastery(for: quantity)
        self.totalTimesMatched = 0
        self.matchMastery = .none
        self.firstDiscoveredAt = firstDiscoveredAt
    }
}

// MARK: - First Discovery Bonus

/// Bonus awarded when a player discovers a badge for the first time.
/// Designed to make every new discovery feel like an event.
///
/// [PLACEHOLDER] — bonus values need tuning. The intent is that discovering
/// a cosmic badge feels meaningfully more exciting than a blue badge.
struct FirstDiscoveryBonus: Sendable {
    let badgeId: String
    let badgeName: String
    let tier: BadgeTier
    let bonusScore: Int

    /// Score bonus for discovering a badge, scaled by tier.
    static func bonusScore(for tier: BadgeTier) -> Int {
        switch tier {
        case .blue:   return 100   // [PLACEHOLDER]
        case .silver: return 250   // [PLACEHOLDER]
        case .gold:   return 500   // [PLACEHOLDER]
        case .cosmic: return 1000  // [PLACEHOLDER]
        }
    }
}

// MARK: - Collection Manager

/// Manages the player's badge collection, mastery progression, and persistence.
///
/// Design rationale: The collection is the long-term retention loop. Every game session
/// feeds into it (match counts update mastery, chests add new badges). The "X/100 Discovered"
/// counter and mastery frames give players two orthogonal axes of progression — breadth
/// (collect them all) and depth (master your favorites).
///
/// Persistence: UserDefaults JSON for prototype. This is a known limitation —
/// UserDefaults is synchronous and has a ~4MB practical limit on some platforms.
/// TODO: Migrate to CloudKit or server-side persistence for production. The collection
/// is the player's most valuable data and must survive device changes.
@Observable
final class CollectionManager {

    // MARK: - State

    /// All discovered badges, keyed by badge ID.
    /// Using a dictionary for O(1) lookup during gameplay when match counts update.
    private(set) var discoveredBadges: [String: CollectedBadgeRecord] = [:]

    /// Total number of badges that exist in the game (from the catalog).
    let totalBadges: Int

    /// Number of unique badges the player has discovered.
    var totalDiscovered: Int { discoveredBadges.count }

    /// Formatted collection progress string for UI display.
    var collectionProgressText: String {
        "\(totalDiscovered)/\(totalBadges) Discovered"
    }

    /// Collection completion percentage (0.0 to 1.0).
    var collectionCompletionRatio: Double {
        guard totalBadges > 0 else { return 0.0 }
        return Double(totalDiscovered) / Double(totalBadges)
    }

    /// All collected badges sorted by discovery date (newest first).
    var badgesByDiscoveryDate: [CollectedBadgeRecord] {
        discoveredBadges.values.sorted { $0.firstDiscoveredAt > $1.firstDiscoveredAt }
    }

    /// All collected badges sorted by match mastery level (highest first).
    var badgesByMastery: [CollectedBadgeRecord] {
        discoveredBadges.values.sorted {
            if $0.matchMastery != $1.matchMastery {
                return $0.matchMastery > $1.matchMastery
            }
            return $0.totalTimesMatched > $1.totalTimesMatched
        }
    }

    /// All collected badges sorted by tier (rarest first).
    var badgesByTier: [CollectedBadgeRecord] {
        let tierOrder: [BadgeTier] = [.cosmic, .gold, .silver, .blue]
        return discoveredBadges.values.sorted { a, b in
            let aIndex = tierOrder.firstIndex(of: a.badge.tier) ?? 0
            let bIndex = tierOrder.firstIndex(of: b.badge.tier) ?? 0
            if aIndex != bIndex { return aIndex < bIndex }
            return a.badge.name < b.badge.name
        }
    }

    /// Number of badges at each match mastery level — useful for achievement tracking.
    var masteryDistribution: [MatchMasteryLevel: Int] {
        var counts: [MatchMasteryLevel: Int] = [:]
        for record in discoveredBadges.values {
            counts[record.matchMastery, default: 0] += 1
        }
        return counts
    }

    /// Number of badges at max match mastery (animated).
    var fullyMasteredCount: Int {
        discoveredBadges.values.filter { $0.matchMastery == .animated }.count
    }

    // MARK: - Initialization

    /// Reference to the full badge catalog for lookup and total count.
    private let badgeCatalog: [Badge]

    /// Lookup table for quick badge resolution by ID.
    private let badgeLookup: [String: Badge]

    init(badgeCatalog: [Badge] = BADGES) {
        self.badgeCatalog = badgeCatalog
        self.totalBadges = badgeCatalog.count
        self.badgeLookup = Dictionary(uniqueKeysWithValues: badgeCatalog.map { ($0.id, $0) })
        load()
    }

    // MARK: - Badge Discovery

    /// Discovers a badge for the first time, adding it to the collection.
    /// Returns a FirstDiscoveryBonus if this is genuinely new, or nil if already discovered.
    ///
    /// Design note: The discovery bonus is intentionally generous — we want players to feel
    /// excited every time they see a new badge. The tier scaling means cosmic discoveries
    /// are 10x more exciting than blue ones, reinforcing the rarity hierarchy.
    @discardableResult
    func discoverBadge(_ badgeId: String) -> FirstDiscoveryBonus? {
        // Already discovered — no bonus
        guard discoveredBadges[badgeId] == nil else { return nil }

        guard let badge = badgeLookup[badgeId] else {
            // Badge ID not in catalog — defensive guard against bad data
            assertionFailure("Attempted to discover unknown badge ID: \(badgeId)")
            return nil
        }

        let record = CollectedBadgeRecord(badge: badge, quantity: 1)
        discoveredBadges[badgeId] = record
        save()

        return FirstDiscoveryBonus(
            badgeId: badge.id,
            badgeName: badge.name,
            tier: badge.tier,
            bonusScore: FirstDiscoveryBonus.bonusScore(for: badge.tier)
        )
    }

    // MARK: - Add Badges (from Chests / Rewards)

    /// Adds badge copies to the collection. If not yet discovered, discovers it first.
    /// Returns a FirstDiscoveryBonus if this was a new discovery, nil otherwise.
    ///
    /// Called when opening chests or receiving trade rewards.
    @discardableResult
    func addBadge(_ badgeId: String, quantity: Int = 1) -> FirstDiscoveryBonus? {
        guard quantity > 0 else { return nil }

        var bonus: FirstDiscoveryBonus? = nil

        if var existing = discoveredBadges[badgeId] {
            existing.quantity += quantity
            existing.masteryLevel = BadgeCollection.computeMastery(for: existing.quantity)
            discoveredBadges[badgeId] = existing
        } else {
            // New discovery through chest/trade
            guard let badge = badgeLookup[badgeId] else {
                assertionFailure("Attempted to add unknown badge ID: \(badgeId)")
                return nil
            }
            let record = CollectedBadgeRecord(badge: badge, quantity: quantity)
            discoveredBadges[badgeId] = record
            bonus = FirstDiscoveryBonus(
                badgeId: badge.id,
                badgeName: badge.name,
                tier: badge.tier,
                bonusScore: FirstDiscoveryBonus.bonusScore(for: badge.tier)
            )
        }

        save()
        return bonus
    }

    /// Removes badge copies from the collection. Used by the trading system.
    /// Returns false if the player doesn't have enough copies (keeps at least 1).
    func removeBadge(_ badgeId: String, quantity: Int) -> Bool {
        guard var record = discoveredBadges[badgeId] else { return false }
        // Must keep at least 1 copy of every discovered badge
        guard record.quantity - quantity >= 1 else { return false }

        record.quantity -= quantity
        record.masteryLevel = BadgeCollection.computeMastery(for: record.quantity)
        discoveredBadges[badgeId] = record
        save()
        return true
    }

    /// Returns how many tradeable copies the player has (total minus 1, since we keep 1).
    func tradeableQuantity(for badgeId: String) -> Int {
        guard let record = discoveredBadges[badgeId] else { return 0 }
        return max(0, record.quantity - 1)
    }

    // MARK: - Match Count / Mastery Progression

    /// Increments the match count for a badge after a game session.
    /// Called by the game engine post-game with match statistics per badge.
    ///
    /// Returns the new MatchMasteryLevel if mastery leveled up, nil otherwise.
    /// The caller can use this to trigger a mastery-up celebration animation.
    @discardableResult
    func incrementMatchCount(_ badgeId: String, by count: Int) -> MatchMasteryLevel? {
        guard count > 0 else { return nil }
        guard var record = discoveredBadges[badgeId] else {
            // Badge was matched in a game but not yet in collection —
            // auto-discover it. This handles the case where a badge appears
            // on the board before the player has "collected" it via a chest.
            discoverBadge(badgeId)
            guard var newRecord = discoveredBadges[badgeId] else { return nil }
            let previousMastery = newRecord.matchMastery
            newRecord.totalTimesMatched += count
            newRecord.matchMastery = MatchMasteryLevel.level(forMatchCount: newRecord.totalTimesMatched)
            discoveredBadges[badgeId] = newRecord
            save()
            return newRecord.matchMastery > previousMastery ? newRecord.matchMastery : nil
        }

        let previousMastery = record.matchMastery
        record.totalTimesMatched += count
        record.matchMastery = MatchMasteryLevel.level(forMatchCount: record.totalTimesMatched)
        discoveredBadges[badgeId] = record
        save()

        // Return the new level only if mastery actually increased
        return record.matchMastery > previousMastery ? record.matchMastery : nil
    }

    /// Batch update match counts after a game session.
    /// Takes a dictionary of [badgeId: matchCount] from the game result.
    /// Returns a list of (badgeId, newMasteryLevel) for badges that leveled up.
    func updateMatchCounts(_ matchCounts: [String: Int]) -> [(badgeId: String, newLevel: MatchMasteryLevel)] {
        var levelUps: [(badgeId: String, newLevel: MatchMasteryLevel)] = []
        for (badgeId, count) in matchCounts {
            if let newLevel = incrementMatchCount(badgeId, by: count) {
                levelUps.append((badgeId: badgeId, newLevel: newLevel))
            }
        }
        return levelUps
    }

    // MARK: - Queries

    /// Returns the collected badge record for a given ID, or nil if not discovered.
    func badge(_ badgeId: String) -> CollectedBadgeRecord? {
        discoveredBadges[badgeId]
    }

    /// Returns true if the player has discovered this badge.
    func isDiscovered(_ badgeId: String) -> Bool {
        discoveredBadges[badgeId] != nil
    }

    /// Returns all undiscovered badge IDs from the catalog.
    var undiscoveredBadgeIds: [String] {
        badgeCatalog.filter { discoveredBadges[$0.id] == nil }.map(\.id)
    }

    /// Returns all undiscovered badges from the catalog.
    var undiscoveredBadges: [Badge] {
        badgeCatalog.filter { discoveredBadges[$0.id] == nil }
    }

    // MARK: - Persistence (UserDefaults / JSON)

    // TODO: Replace UserDefaults with CloudKit or server-side persistence.
    // The collection is the player's most valuable progression data.
    // UserDefaults is fine for prototype but has these risks:
    //   - No cross-device sync
    //   - No backup/restore beyond iCloud device backup
    //   - ~4MB practical limit (should be fine for 100 badges)
    //   - No conflict resolution for multi-device play
    //
    // Migration plan:
    //   1. Add CloudKit container with CKRecord per CollectedBadgeRecord
    //   2. Sync on app launch and after each mutation
    //   3. Keep UserDefaults as local cache / offline fallback
    //   4. Server-authoritative for trading (anti-cheat)

    private static let storageKey = "collection_manager_badges"

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(discoveredBadges) else {
            assertionFailure("Failed to encode badge collection")
            return
        }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let decoded = try? decoder.decode([String: CollectedBadgeRecord].self, from: data) else {
            return
        }
        discoveredBadges = decoded
    }

    /// Resets the entire collection. Destructive — intended for debug/testing only.
    func resetCollection() {
        discoveredBadges = [:]
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }
}
