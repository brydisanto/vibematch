import Foundation

// MARK: - Badge Tier

/// Rarity tier for pins. Names follow the canonical web catalog so badge
/// IDs port one-to-one between platforms. User-facing rarity names map as:
/// blue → Common · silver → Rare · special → Special · gold → Legendary · cosmic → Cosmic.
enum BadgeTier: String, Codable, Hashable, Sendable, CaseIterable {
    case blue
    case silver
    case special
    case gold
    case cosmic

    /// The scoring multiplier for this tier. Mirrors web `pointMultiplier`.
    var pointMultiplier: Double {
        switch self {
        case .blue:    return 1.0
        case .silver:  return 1.5
        case .special: return 2.0
        case .gold:    return 2.0
        case .cosmic:  return 3.0
        }
    }

    /// User-facing rarity label shown in Pin Book.
    var displayName: String {
        switch self {
        case .blue:    return "Common"
        case .silver:  return "Rare"
        case .special: return "Special"
        case .gold:    return "Legendary"
        case .cosmic:  return "Cosmic"
        }
    }

    /// Tier color hex used for borders, glows, and Pin Book tab accents.
    var colorHex: String {
        switch self {
        case .blue:    return "#7BB6FF"
        case .silver:  return "#D9D9D9"
        case .special: return "#5BE0C2"
        case .gold:    return "#FFE048"
        case .cosmic:  return "#B366FF"
        }
    }
}

// MARK: - Badge

/// A pin from the Pin Drop catalog. Plays as a tile on the board when
/// `collectOnly` is false, otherwise only ever appears as a capsule reward.
struct Badge: Hashable, Codable, Identifiable, Sendable {
    /// Unique pin identifier, matches the web catalog (e.g. "any_gvc").
    let id: String

    /// Human-readable display name.
    let name: String

    /// Relative path to the pin image asset, e.g. "/badges/any_gvc_1759173799963.webp".
    /// On iOS the basename (minus extension) doubles as the Asset Catalog name.
    let image: String

    /// Rarity tier.
    let tier: BadgeTier

    /// Flavor text shown in Pin Book entries. May be empty for ported pins.
    var lore: String = ""

    /// Scoring multiplier. Defaults to the tier multiplier, can be overridden
    /// for promotional or event pins.
    var pointMultiplier: Double = 1.0

    /// If true, this pin only ever appears in capsule drops or Pin Book —
    /// never on the game board. Used for tiered milestones, $VIBESTR tier
    /// pins, Hatrick / High Five / Bounty Hunter awards.
    var collectOnly: Bool = false

    /// Relative drop weight within tier for capsule rolls. Higher = more common.
    /// Server-side only — used to make near-impossible $VIBESTR Cosmic tier
    /// effectively a 1-in-thousands pull.
    var dropWeight: Int = 1

    /// Asset Catalog name. Strips the `/badges/` prefix and file extension
    /// from the canonical image path.
    var assetName: String {
        let stripped = image
            .replacingOccurrences(of: "/badges/", with: "")
            .replacingOccurrences(of: ".webp", with: "")
            .replacingOccurrences(of: ".png", with: "")
        return stripped
    }
}
