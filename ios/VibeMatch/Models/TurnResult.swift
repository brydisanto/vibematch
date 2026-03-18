import Foundation

// MARK: - Shape Bonus

/// A bonus awarded when matches form a recognizable shape (L, T, or cross).
enum ShapeBonusType: String, Codable, Hashable, Sendable {
    case L
    case T
    case cross
}

/// A detected shape bonus with its scoring multiplier and affected positions.
struct ShapeBonus: Codable, Hashable, Sendable {
    let type: ShapeBonusType
    let multiplier: Double
    let positions: [Position]
}

// MARK: - Special Tile Creation

/// Records the creation of a special tile during a turn, including
/// where it was placed and what type it is.
struct SpecialTileCreated: Codable, Hashable, Sendable {
    let type: SpecialTileType
    let position: Position
}

// MARK: - Turn Result

/// The outcome of processing a single player move (swap or special tile activation).
/// Contains the updated board and all scoring/animation metadata the UI needs.
struct TurnResult: Codable, Sendable {
    /// The board state after all matches, cascades, and gravity fills.
    let board: [[Cell]]

    /// All matches found during this turn, including cascade matches.
    let matchesFound: [Match]

    /// Total score earned this turn (before being added to GameState.score).
    let scoreGained: Int

    /// The final combo value after all cascades resolved.
    let combo: Int

    /// Combo carry-over value for the next turn.
    let comboCarry: Int

    /// Number of cascade steps (gravity refills that triggered new matches).
    let cascadeCount: Int

    /// Special tiles that were created during this turn.
    let specialTilesCreated: [SpecialTileCreated]

    /// Shape bonus detected during this turn, if any.
    let shapeBonus: ShapeBonus?
}
