import Foundation
import Observation

// MARK: - Trade Badge

/// A badge entry in a trade offer: which badge and how many copies.
struct TradeBadge: Codable, Hashable, Sendable, Identifiable {
    let badgeId: String
    let quantity: Int

    var id: String { badgeId }
}

// MARK: - Trade Offer (Extended)

/// A peer-to-peer badge trade offer inspired by Monopoly Go's sticker trading.
///
/// Design philosophy: Trading transforms the collection from a solo grind into a
/// social activity. The Monopoly Go model works because it creates natural conversation:
/// "I have 3 extra Pepes, anyone need one? Looking for Cosmic Guardian."
///
/// Key design decisions:
/// - 24-hour expiry prevents stale offers clogging the marketplace
/// - 5 active offer cap prevents spam and forces intentional trades
/// - "Keep at least 1" rule prevents accidental collection loss
/// - Open offers (no specific recipient) enable marketplace-style discovery
struct TradeOfferRecord: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let offererPlayerId: String
    let recipientPlayerId: String?  // nil = open offer visible to all players
    let offeredBadges: [TradeBadge]
    let requestedBadges: [TradeBadge]
    var status: TradeStatus
    let createdAt: Date
    let expiresAt: Date

    /// Human-readable summary for notifications/history.
    var summary: String {
        let offerText = offeredBadges.map { "\($0.quantity)x \($0.badgeId)" }.joined(separator: ", ")
        let requestText = requestedBadges.map { "\($0.quantity)x \($0.badgeId)" }.joined(separator: ", ")
        return "Offering [\(offerText)] for [\(requestText)]"
    }

    /// Whether this trade has expired based on current time.
    var isExpired: Bool {
        Date.now > expiresAt
    }

    /// Whether this trade can still be acted upon.
    var isActionable: Bool {
        status == .pending && !isExpired
    }

    init(
        offererPlayerId: String,
        recipientPlayerId: String? = nil,
        offeredBadges: [TradeBadge],
        requestedBadges: [TradeBadge],
        expiresIn: TimeInterval = 24 * 60 * 60  // 24 hours default
    ) {
        self.id = UUID()
        self.offererPlayerId = offererPlayerId
        self.recipientPlayerId = recipientPlayerId
        self.offeredBadges = offeredBadges
        self.requestedBadges = requestedBadges
        self.status = .pending
        self.createdAt = .now
        self.expiresAt = Date.now.addingTimeInterval(expiresIn)
    }
}

// MARK: - Trade Validation Error

/// Errors that can occur when creating or accepting a trade.
/// Each error has a player-facing message so the UI can explain what went wrong.
enum TradeError: Error, Sendable, CustomStringConvertible {
    case insufficientBadges(badgeId: String, have: Int, need: Int)
    case wouldLoseLastCopy(badgeId: String)
    case tooManyActiveOffers(current: Int, max: Int)
    case offerExpired
    case offerNotActionable(status: TradeStatus)
    case cannotTradeWithSelf
    case emptyOffer
    case badgeNotFound(badgeId: String)

    var description: String {
        switch self {
        case .insufficientBadges(let id, let have, let need):
            return "Not enough copies of \(id) (have \(have), need \(need))"
        case .wouldLoseLastCopy(let id):
            return "Can't trade your last copy of \(id)"
        case .tooManyActiveOffers(let current, let max):
            return "Too many active offers (\(current)/\(max))"
        case .offerExpired:
            return "This trade offer has expired"
        case .offerNotActionable(let status):
            return "This trade is \(status.rawValue) and can't be acted on"
        case .cannotTradeWithSelf:
            return "Can't trade with yourself"
        case .emptyOffer:
            return "Trade must include at least one badge on each side"
        case .badgeNotFound(let id):
            return "Badge \(id) not found in collection"
        }
    }
}

// MARK: - Trade History Entry

/// A completed or cancelled trade for the player's trade history.
struct TradeHistoryEntry: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let offer: TradeOfferRecord
    let resolvedAt: Date
    let resolution: TradeStatus  // accepted, declined, expired, cancelled

    init(offer: TradeOfferRecord, resolution: TradeStatus) {
        self.id = UUID()
        self.offer = offer
        self.resolvedAt = .now
        self.resolution = resolution
    }
}

// MARK: - Trading Manager

/// Manages peer-to-peer badge trading.
///
/// For the prototype, all trade state is local. In production, this must be
/// server-authoritative to prevent cheating (duplicating badges, accepting
/// trades after trading away the badges, etc.).
///
/// The Monopoly Go inspiration means:
/// - Players can post open offers to a shared marketplace
/// - Players can send targeted offers to specific friends
/// - Wish lists help matchmaking: "I need X, who has extras?"
/// - The social loop drives retention: "Come back to check if your trade was accepted"
///
/// TODO: Server-side trading implementation plan:
///   1. Trade offers stored in a server database (Firestore, custom backend, etc.)
///   2. Both players must confirm within the expiry window
///   3. Server validates badge ownership at acceptance time (not creation time)
///   4. Atomic swap: server deducts from offerer and adds to acceptor in one transaction
///   5. Push notifications for trade events (new offer, accepted, expired)
///   6. Rate limiting: max 20 trades per day to prevent bot exploitation
///   7. Anti-cheat: flag accounts that trade exclusively with one other account
@Observable
final class TradingManager {

    // MARK: - Configuration

    /// Maximum number of simultaneous active trade offers.
    /// [PLACEHOLDER] — 5 feels right for a small community. Scale up as playerbase grows.
    static let maxActiveOffers = 5

    /// Default trade expiry duration (24 hours).
    static let defaultExpiryDuration: TimeInterval = 24 * 60 * 60

    // MARK: - State

    /// The current player's ID.
    let playerId: String

    /// All active (pending) trade offers created by this player.
    private(set) var activeOffers: [TradeOfferRecord] = []

    /// Trade offers received from other players (pending action).
    private(set) var incomingOffers: [TradeOfferRecord] = []

    /// Completed/cancelled trade history.
    private(set) var tradeHistory: [TradeHistoryEntry] = []

    /// Badge IDs the player is looking for. Visible to potential traders
    /// to facilitate matchmaking.
    var wishList: Set<String> = [] {
        didSet { save() }
    }

    /// Reference to the collection manager for ownership validation.
    private let collectionManager: CollectionManager

    /// Number of currently active (non-expired, pending) outgoing offers.
    var activeOfferCount: Int {
        expireStaleOffers()
        return activeOffers.filter { $0.isActionable }.count
    }

    /// Whether the player can create a new trade offer.
    var canCreateOffer: Bool {
        activeOfferCount < Self.maxActiveOffers
    }

    init(playerId: String, collectionManager: CollectionManager) {
        self.playerId = playerId
        self.collectionManager = collectionManager
        load()
        expireStaleOffers()
    }

    // MARK: - Wish List

    /// Add a badge ID to the wish list.
    func addToWishList(_ badgeId: String) {
        wishList.insert(badgeId)
    }

    /// Remove a badge ID from the wish list.
    func removeFromWishList(_ badgeId: String) {
        wishList.remove(badgeId)
    }

    /// Returns true if a badge is on the wish list.
    func isOnWishList(_ badgeId: String) -> Bool {
        wishList.contains(badgeId)
    }

    // MARK: - Create Offer

    /// Creates a new trade offer.
    ///
    /// Validation:
    /// - Player must own enough copies of each offered badge (minus 1 for keep-at-least-1 rule)
    /// - Must not exceed max active offers
    /// - Must include at least one badge on each side
    /// - Cannot trade with self
    ///
    /// Returns the created offer on success, throws TradeError on failure.
    func createOffer(
        offered: [TradeBadge],
        requested: [TradeBadge],
        recipient: String? = nil
    ) throws -> TradeOfferRecord {
        // Validate non-empty
        guard !offered.isEmpty && !requested.isEmpty else {
            throw TradeError.emptyOffer
        }

        // Validate not trading with self
        if let recipient = recipient, recipient == playerId {
            throw TradeError.cannotTradeWithSelf
        }

        // Validate active offer count
        let currentActive = activeOffers.filter { $0.isActionable }.count
        guard currentActive < Self.maxActiveOffers else {
            throw TradeError.tooManyActiveOffers(current: currentActive, max: Self.maxActiveOffers)
        }

        // Validate ownership of offered badges
        // Must have enough copies AND keep at least 1
        for badge in offered {
            let tradeable = collectionManager.tradeableQuantity(for: badge.badgeId)
            guard tradeable >= badge.quantity else {
                let owned = collectionManager.badge(badge.badgeId)?.quantity ?? 0
                if owned > 0 && owned <= badge.quantity {
                    throw TradeError.wouldLoseLastCopy(badgeId: badge.badgeId)
                } else {
                    throw TradeError.insufficientBadges(
                        badgeId: badge.badgeId,
                        have: owned,
                        need: badge.quantity
                    )
                }
            }
        }

        let offer = TradeOfferRecord(
            offererPlayerId: playerId,
            recipientPlayerId: recipient,
            offeredBadges: offered,
            requestedBadges: requested
        )

        activeOffers.append(offer)
        save()
        return offer
    }

    // MARK: - Accept Offer

    /// Accepts an incoming trade offer, executing the badge swap.
    ///
    /// Validates that:
    /// - The offer is still actionable (pending and not expired)
    /// - The offerer still has the offered badges (re-validated at accept time)
    /// - The acceptor has the requested badges (with keep-at-least-1 rule)
    ///
    /// Returns true if the trade executed successfully.
    func acceptOffer(_ offer: TradeOfferRecord) throws -> Bool {
        guard offer.isActionable else {
            if offer.isExpired {
                throw TradeError.offerExpired
            }
            throw TradeError.offerNotActionable(status: offer.status)
        }

        // Validate acceptor owns the requested badges
        for badge in offer.requestedBadges {
            let tradeable = collectionManager.tradeableQuantity(for: badge.badgeId)
            guard tradeable >= badge.quantity else {
                let owned = collectionManager.badge(badge.badgeId)?.quantity ?? 0
                if owned > 0 && owned <= badge.quantity {
                    throw TradeError.wouldLoseLastCopy(badgeId: badge.badgeId)
                } else {
                    throw TradeError.insufficientBadges(
                        badgeId: badge.badgeId,
                        have: owned,
                        need: badge.quantity
                    )
                }
            }
        }

        // TODO: In production, this must be an atomic server transaction.
        // The current local implementation has a race condition: between validation
        // and execution, the player could trade away badges in another offer.
        // Server-side: use a database transaction that locks both players' inventories.

        // Execute the swap: remove offered badges from offerer's perspective
        // (In prototype, we only manage the local player's collection)

        // Acceptor gives up the requested badges
        for badge in offer.requestedBadges {
            let removed = collectionManager.removeBadge(badge.badgeId, quantity: badge.quantity)
            guard removed else {
                // Rollback would be needed in production — for prototype, fail loudly
                assertionFailure("Failed to remove badge during trade execution")
                return false
            }
        }

        // Acceptor receives the offered badges
        for badge in offer.offeredBadges {
            collectionManager.addBadge(badge.badgeId, quantity: badge.quantity)
        }

        // Update offer status
        updateOfferStatus(offer.id, to: .accepted)

        // Remove from wish list if we received a wished-for badge
        for badge in offer.offeredBadges {
            wishList.remove(badge.badgeId)
        }

        save()
        return true
    }

    // MARK: - Decline Offer

    /// Declines an incoming trade offer.
    func declineOffer(_ offer: TradeOfferRecord) {
        updateOfferStatus(offer.id, to: .declined)
        save()
    }

    // MARK: - Cancel Offer

    /// Cancels an outgoing trade offer created by this player.
    func cancelOffer(_ offer: TradeOfferRecord) {
        guard offer.offererPlayerId == playerId else { return }
        updateOfferStatus(offer.id, to: .cancelled)
        save()
    }

    // MARK: - Offer Management

    /// Expire all stale offers that have passed their expiry time.
    @discardableResult
    private func expireStaleOffers() -> Int {
        var expiredCount = 0

        for i in activeOffers.indices {
            if activeOffers[i].status == .pending && activeOffers[i].isExpired {
                activeOffers[i].status = .expired
                tradeHistory.append(TradeHistoryEntry(
                    offer: activeOffers[i],
                    resolution: .expired
                ))
                expiredCount += 1
            }
        }

        for i in incomingOffers.indices {
            if incomingOffers[i].status == .pending && incomingOffers[i].isExpired {
                incomingOffers[i].status = .expired
                expiredCount += 1
            }
        }

        if expiredCount > 0 {
            activeOffers.removeAll { $0.status != .pending }
            incomingOffers.removeAll { $0.status != .pending }
            save()
        }

        return expiredCount
    }

    /// Updates the status of an offer across all lists.
    private func updateOfferStatus(_ offerId: UUID, to status: TradeStatus) {
        if let index = activeOffers.firstIndex(where: { $0.id == offerId }) {
            activeOffers[index].status = status
            tradeHistory.append(TradeHistoryEntry(
                offer: activeOffers[index],
                resolution: status
            ))
            activeOffers.remove(at: index)
        }

        if let index = incomingOffers.firstIndex(where: { $0.id == offerId }) {
            incomingOffers[index].status = status
            incomingOffers.remove(at: index)
        }
    }

    /// Simulates receiving a trade offer from another player.
    /// In production, this would come from a push notification / server poll.
    func receiveOffer(_ offer: TradeOfferRecord) {
        guard offer.recipientPlayerId == nil || offer.recipientPlayerId == playerId else {
            return  // Not for us
        }
        incomingOffers.append(offer)
        save()
    }

    // MARK: - Queries

    /// Returns badges the player has duplicates of (tradeable surplus).
    /// Useful for suggesting what to offer in trades.
    var tradeableBadges: [CollectedBadgeRecord] {
        collectionManager.discoveredBadges.values
            .filter { $0.quantity > 1 }
            .sorted { $0.quantity > $1.quantity }
    }

    /// Returns badges on the wish list that the player hasn't discovered yet.
    var missingWishListBadges: [String] {
        wishList.filter { !collectionManager.isDiscovered($0) }.sorted()
    }

    /// Returns badges on the wish list that the player has but wants more copies of.
    var wantMoreWishListBadges: [String] {
        wishList.filter { collectionManager.isDiscovered($0) }.sorted()
    }

    /// Checks if a potential trade is valid without creating it.
    /// Returns nil if valid, or a TradeError describing the problem.
    func validateOffer(offered: [TradeBadge], requested: [TradeBadge]) -> TradeError? {
        guard !offered.isEmpty && !requested.isEmpty else {
            return .emptyOffer
        }

        for badge in offered {
            let tradeable = collectionManager.tradeableQuantity(for: badge.badgeId)
            if tradeable < badge.quantity {
                let owned = collectionManager.badge(badge.badgeId)?.quantity ?? 0
                if owned > 0 && owned <= badge.quantity {
                    return .wouldLoseLastCopy(badgeId: badge.badgeId)
                }
                return .insufficientBadges(
                    badgeId: badge.badgeId,
                    have: owned,
                    need: badge.quantity
                )
            }
        }

        let currentActive = activeOffers.filter { $0.isActionable }.count
        if currentActive >= Self.maxActiveOffers {
            return .tooManyActiveOffers(current: currentActive, max: Self.maxActiveOffers)
        }

        return nil
    }

    // MARK: - Persistence

    // TODO: Server-side trading is critical for production.
    // Local-only trading has these problems:
    //   - No actual peer-to-peer connectivity
    //   - No ownership verification across devices
    //   - Easy to cheat by editing UserDefaults
    //   - No push notifications for trade events
    //
    // Migration path:
    //   1. Firebase Firestore for trade offer storage
    //   2. Cloud Functions for atomic trade execution
    //   3. FCM push notifications for trade events
    //   4. Server-side ownership validation at accept time
    //   5. Trade history stored server-side for dispute resolution

    private static let activeOffersKey = "trading_active_offers"
    private static let incomingOffersKey = "trading_incoming_offers"
    private static let historyKey = "trading_history"
    private static let wishListKey = "trading_wish_list"

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        if let data = try? encoder.encode(activeOffers) {
            UserDefaults.standard.set(data, forKey: Self.activeOffersKey)
        }
        if let data = try? encoder.encode(incomingOffers) {
            UserDefaults.standard.set(data, forKey: Self.incomingOffersKey)
        }
        if let data = try? encoder.encode(tradeHistory) {
            UserDefaults.standard.set(data, forKey: Self.historyKey)
        }
        if let data = try? encoder.encode(wishList) {
            UserDefaults.standard.set(data, forKey: Self.wishListKey)
        }
    }

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        if let data = UserDefaults.standard.data(forKey: Self.activeOffersKey),
           let decoded = try? decoder.decode([TradeOfferRecord].self, from: data) {
            activeOffers = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.incomingOffersKey),
           let decoded = try? decoder.decode([TradeOfferRecord].self, from: data) {
            incomingOffers = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.historyKey),
           let decoded = try? decoder.decode([TradeHistoryEntry].self, from: data) {
            tradeHistory = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.wishListKey),
           let decoded = try? decoder.decode(Set<String>.self, from: data) {
            wishList = decoded
        }
    }

    /// Resets all trading data. Destructive — debug/testing only.
    func reset() {
        activeOffers = []
        incomingOffers = []
        tradeHistory = []
        wishList = []
        UserDefaults.standard.removeObject(forKey: Self.activeOffersKey)
        UserDefaults.standard.removeObject(forKey: Self.incomingOffersKey)
        UserDefaults.standard.removeObject(forKey: Self.historyKey)
        UserDefaults.standard.removeObject(forKey: Self.wishListKey)
    }
}
