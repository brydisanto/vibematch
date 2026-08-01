import Foundation

// MARK: - Special Tile Type

/// The type of special tile created by large matches or cascades.
///
/// - bomb: Clears a 3x3 area around the tile.
/// - vibestreak: Clears an entire row or column.
/// - cosmicBlast: Clears all tiles of a matching badge from the board.
enum SpecialTileType: String, Codable, Hashable, Sendable {
    case bomb
    case vibestreak
    case cosmicBlast = "cosmic_blast"

    /// Player-facing display name. Internal engine still uses "vibestreak";
    /// the player sees "Laser Party" (synced with web rename).
    var displayName: String {
        switch self {
        case .bomb:        return "Bomb"
        case .vibestreak:  return "Laser Party"
        case .cosmicBlast: return "Cosmic Blast"
        }
    }
}

// MARK: - Cell

/// A single cell on the game board. Uses `badgeIndex` as an index into the
/// session's `gameBadges` array, matching the web engine's representation.
struct Cell: Hashable, Codable, Sendable {
    /// Index into the gameBadges array for the badge displayed in this cell.
    let badgeIndex: Int

    /// If non-nil, this cell is a special tile that triggers an area effect
    /// when matched or tapped.
    var isSpecial: SpecialTileType?

    /// True if this cell has been cleared and is waiting for gravity fill.
    var isEmpty: Bool

    /// Rows this tile fell during the last gravity pass. Animation metadata
    /// mirroring the web engine's `dropDistance`; drives the drop-from-above
    /// bounce in GameScene.
    var dropDistance: Int

    /// True if this tile entered from above the board in the last gravity
    /// pass (web engine's `isNew`).
    var isNew: Bool

    init(
        badgeIndex: Int,
        isSpecial: SpecialTileType? = nil,
        isEmpty: Bool = false,
        dropDistance: Int = 0,
        isNew: Bool = false
    ) {
        self.badgeIndex = badgeIndex
        self.isSpecial = isSpecial
        self.isEmpty = isEmpty
        self.dropDistance = dropDistance
        self.isNew = isNew
    }

    /// Backward-compatible decoding: boards persisted before the animation
    /// metadata existed decode with zeroed drop fields.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        badgeIndex = try c.decode(Int.self, forKey: .badgeIndex)
        isSpecial = try c.decodeIfPresent(SpecialTileType.self, forKey: .isSpecial)
        isEmpty = try c.decodeIfPresent(Bool.self, forKey: .isEmpty) ?? false
        dropDistance = try c.decodeIfPresent(Int.self, forKey: .dropDistance) ?? 0
        isNew = try c.decodeIfPresent(Bool.self, forKey: .isNew) ?? false
    }
}
