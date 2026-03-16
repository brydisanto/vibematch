import Foundation

// MARK: - Badge Tier

/// Rarity tier for badges. Each tier has a point multiplier applied during scoring.
///
/// - blue: Common tier (1x multiplier)
/// - silver: Uncommon tier (1.5x multiplier)
/// - gold: Rare tier (2x multiplier)
/// - cosmic: Legendary tier (3x multiplier)
enum BadgeTier: String, Codable, Hashable, Sendable, CaseIterable {
    case blue
    case silver
    case gold
    case cosmic

    /// The scoring multiplier for this tier.
    var pointMultiplier: Double {
        switch self {
        case .blue:    return 1.0
        case .silver:  return 1.5
        case .gold:    return 2.0
        case .cosmic:  return 3.0
        }
    }
}

// MARK: - Badge

/// A collectable badge that appears on the game board as a tile.
/// Each badge has a unique identity, display metadata, and a rarity tier
/// that influences scoring.
struct Badge: Hashable, Codable, Identifiable, Sendable {
    /// Unique identifier for this badge (e.g. "any_gvc", "baller").
    let id: String

    /// Human-readable display name.
    let name: String

    /// Relative path to the badge image asset.
    let image: String

    /// Rarity tier controlling the point multiplier.
    let tier: BadgeTier

    /// Flavor text / lore description.
    let lore: String

    /// Scoring multiplier derived from the tier.
    /// Stored explicitly so it can be overridden for promotional badges.
    let pointMultiplier: Double
}
