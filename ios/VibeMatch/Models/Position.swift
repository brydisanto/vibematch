import Foundation

// MARK: - Position

/// A row/col coordinate on the game board.
/// Used to identify cell locations for matching, swapping, and animations.
struct Position: Hashable, Codable, Equatable, Sendable {
    let row: Int
    let col: Int
}
