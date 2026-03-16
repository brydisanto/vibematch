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

    init(badgeIndex: Int, isSpecial: SpecialTileType? = nil, isEmpty: Bool = false) {
        self.badgeIndex = badgeIndex
        self.isSpecial = isSpecial
        self.isEmpty = isEmpty
    }
}
