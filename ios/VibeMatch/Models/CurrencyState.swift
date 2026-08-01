import Foundation

// MARK: - Currency State

/// Tracks the player's Vibe Coins balance.
///
/// Earn (slow):
///   - Daily login: 10 coins
///   - Level first clear: 25 coins
///   - 3-star a level: 15 bonus coins
///   - Achievement completion: 10-50 coins (scales with chest tier)
///   - 7-day streak: 100 coins
///
/// Buy via IAP (fast):
///   - 100 coins: $0.99
///   - 500 coins: $3.99
///   - 1,200 coins: $7.99
///   - 3,000 coins: $14.99
///
/// Spend on:
///   - Heart refill (5 hearts): 50 coins
///   - Single heart: 15 coins
///   - +5 extra moves at game over: 30 coins
struct CurrencyState: Codable, Sendable {
    var balance: Int = 0

    // MARK: - Costs

    static let heartRefillCost = 50
    static let singleHeartCost = 15
    static let extraMovesCost = 30

    // MARK: - Earn Amounts

    static let dailyLoginReward = 10
    static let firstClearReward = 25
    static let threeStarBonus = 15
    static let weekStreakBonus = 100

    /// Reward for completing an achievement, scaled by chest tier.
    static func achievementReward(chestTier: String) -> Int {
        switch chestTier {
        case "bronze": return 10
        case "silver": return 20
        case "gold": return 35
        case "cosmic": return 50
        default: return 10
        }
    }

    // MARK: - Transactions

    /// Add coins to the balance.
    mutating func earn(_ amount: Int) {
        balance += amount
    }

    /// Spend coins if the player can afford it. Returns true if successful.
    mutating func spend(_ amount: Int) -> Bool {
        guard balance >= amount else { return false }
        balance -= amount
        return true
    }

    /// Whether the player can afford a given cost.
    func canAfford(_ cost: Int) -> Bool {
        balance >= cost
    }
}
