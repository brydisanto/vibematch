import Foundation

// MARK: - Match

/// Represents a group of 3+ aligned cells of the same badge that were
/// matched during a turn.
struct Match: Hashable, Codable, Sendable {
    /// The board positions that form this match.
    let positions: [Position]

    /// The badge that was matched.
    let badge: Badge

    /// The number of tiles in this match (always >= 3).
    let matchLength: Int

    /// Whether this match runs horizontally (true) or vertically (false).
    var isHorizontal: Bool {
        guard positions.count >= 2 else { return true }
        return positions[0].row == positions[1].row
    }
}
