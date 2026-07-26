import Foundation

// MARK: - Level Result

/// The outcome of completing a single level attempt.
struct LevelResult: Codable, Hashable, Sendable {
    let levelId: Int
    let stars: Int
    let score: Int
    let completedAt: Date
}

// MARK: - Level Progress Data

/// Tracks the player's overall level progression.
/// Persisted via ProgressionManager.
struct LevelProgressData: Codable, Sendable {
    /// The highest level the player can access.
    var highestUnlockedLevel: Int = 1

    /// Best result per level (keyed by level ID).
    var levelResults: [Int: LevelResult] = [:]

    /// Total stars earned across all levels.
    var totalStars: Int {
        levelResults.values.reduce(0) { $0 + $1.stars }
    }

    /// Stars earned on a specific level (0 if not completed).
    func starsForLevel(_ id: Int) -> Int {
        levelResults[id]?.stars ?? 0
    }

    /// Whether a level is unlocked and playable.
    func isUnlocked(_ id: Int) -> Bool {
        id <= highestUnlockedLevel
    }

    /// Whether a level has been completed at least once.
    func isCompleted(_ id: Int) -> Bool {
        levelResults[id] != nil
    }

    /// Best score on a specific level.
    func bestScore(for id: Int) -> Int {
        levelResults[id]?.score ?? 0
    }
}
