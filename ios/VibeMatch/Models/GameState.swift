import Foundation

// MARK: - Constants

/// The board is an 8x8 grid.
let BOARD_SIZE = 8

/// Classic mode starts with 30 moves.
let CLASSIC_MOVES = 30

// MARK: - Game Phase

/// The current phase of the game loop.
///
/// - playing: Waiting for the player to make a move.
/// - animating: A match/cascade animation is in progress; input is blocked.
/// - gameover: The game has ended.
enum GamePhase: String, Codable, Hashable, Sendable {
    case playing
    case animating
    case gameover
}

// MARK: - Game Mode

/// The game mode determines board generation and scoring rules.
///
/// - classic: Standard mode with a fixed move count.
/// - daily: Seeded daily challenge so all players get the same board.
enum GameMode: String, Codable, Hashable, Sendable {
    case classic
    case daily
}

// MARK: - Game Over Reason

/// Why the game ended, if it has.
///
/// - movesExhausted: The player ran out of moves.
/// - noValidMoves: No legal swaps remain on the board.
enum GameOverReason: String, Codable, Hashable, Sendable {
    case movesExhausted = "moves_exhausted"
    case noValidMoves = "no_valid_moves"
}

// MARK: - Game State

/// The complete snapshot of a game in progress (or completed).
/// This is the single source of truth that the game engine mutates
/// and the UI observes.
struct GameState: Codable, Sendable {
    var board: [[Cell]]
    var score: Int
    var movesLeft: Int
    var combo: Int
    var comboCarry: Int
    var maxCombo: Int
    var selectedTile: Position?
    var gamePhase: GamePhase
    var gameMode: GameMode
    var gameBadges: [Badge]
    var matchCount: Int
    var totalCascades: Int
    var gameOverReason: GameOverReason?
    var bonusCapsuleAwarded: Bool
}
