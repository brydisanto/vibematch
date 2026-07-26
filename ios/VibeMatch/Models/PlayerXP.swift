import Foundation

// MARK: - Player XP Data

/// Tracks the player's experience points and level.
/// Uses triangular number thresholds so each level requires slightly more XP.
///
/// Cumulative XP for level N = 100 * N * (N+1) / 2
/// Level 2: 300 XP (~1 game)
/// Level 10: 5,500 XP (~10 games)
/// Level 50: 127,500 XP (~250 games)
/// Level 100: 505,000 XP (~1000 games)
struct PlayerXPData: Codable, Sendable {
    var totalXP: Int = 0
    var currentLevel: Int = 1

    static let maxLevel = 100

    /// Cumulative XP required to reach a given level.
    static func xpRequiredForLevel(_ level: Int) -> Int {
        guard level > 1 else { return 0 }
        return 100 * (level - 1) * level / 2
    }

    /// Determine the player level for a given total XP.
    static func levelForXP(_ xp: Int) -> Int {
        guard xp > 0 else { return 1 }
        // Inverse of triangular: level = floor(1 + (-1 + sqrt(1 + 8*xp/100)) / 2)
        let n = (1.0 + sqrt(1.0 + 8.0 * Double(xp) / 100.0)) / 2.0
        return min(maxLevel, max(1, Int(floor(n))))
    }

    /// XP earned within the current level (progress toward next).
    var xpIntoCurrentLevel: Int {
        totalXP - Self.xpRequiredForLevel(currentLevel)
    }

    /// XP needed to advance from current level to next.
    var xpNeededForNextLevel: Int {
        guard currentLevel < Self.maxLevel else { return 1 }
        return Self.xpRequiredForLevel(currentLevel + 1) - Self.xpRequiredForLevel(currentLevel)
    }

    /// Progress ratio (0.0 to 1.0) toward the next level.
    var progress: Double {
        guard xpNeededForNextLevel > 0 else { return 1.0 }
        return min(1.0, Double(xpIntoCurrentLevel) / Double(xpNeededForNextLevel))
    }

    /// Award XP and recalculate level. Returns (xpGained, didLevelUp, newLevel).
    mutating func addXP(_ amount: Int) -> (xpGained: Int, leveledUp: Bool, newLevel: Int) {
        let oldLevel = currentLevel
        totalXP += amount
        currentLevel = Self.levelForXP(totalXP)
        return (amount, currentLevel > oldLevel, currentLevel)
    }
}

// MARK: - XP Calculation

/// Calculates XP earned from a game result.
struct XPCalculator {
    /// Base XP: score / 10
    /// +50 per star earned
    /// +25 per combo above 3
    /// +100 for first-time level clear
    static func calculate(
        score: Int,
        stars: Int,
        maxCombo: Int,
        isFirstClear: Bool
    ) -> Int {
        var xp = score / 10
        xp += stars * 50
        if maxCombo > 3 {
            xp += (maxCombo - 3) * 25
        }
        if isFirstClear {
            xp += 100
        }
        return xp
    }
}
