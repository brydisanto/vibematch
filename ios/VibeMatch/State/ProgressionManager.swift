import Foundation
import Observation

// MARK: - Progression Manager

/// Central manager for all player progression systems:
/// - Level progression (content levels 1-30+)
/// - Player XP and level
/// - Energy (hearts)
/// - Currency (Vibe Coins)
///
/// Follows the same @Observable + UserDefaults pattern as ChestSystem.
@Observable
final class ProgressionManager {

    // MARK: - State

    private(set) var levelProgress: LevelProgressData = LevelProgressData()
    private(set) var playerXP: PlayerXPData = PlayerXPData()
    private(set) var energy: EnergyState = EnergyState()
    private(set) var currency: CurrencyState = CurrencyState()

    init() {
        load()
    }

    // MARK: - Energy

    /// Whether the player can start a game in the given mode.
    /// Daily mode is always free.
    func canPlay(mode: GameMode) -> Bool {
        if case .daily = mode { return true }
        var e = energy
        e.recalculate()
        return e.currentEnergy > 0
    }

    /// Consume 1 energy for starting a game. Returns false if insufficient.
    /// Daily mode skips energy cost.
    @discardableResult
    func consumeEnergy(for mode: GameMode) -> Bool {
        if case .daily = mode { return true }
        energy.recalculate()
        let success = energy.consume()
        if success { save() }
        return success
    }

    /// Refill all energy using Vibe Coins.
    /// Returns true if the purchase succeeded.
    @discardableResult
    func refillEnergyWithCoins() -> Bool {
        guard currency.spend(CurrencyState.heartRefillCost) else { return false }
        energy.refillFull()
        save()
        return true
    }

    /// Buy a single heart with Vibe Coins.
    @discardableResult
    func buySingleHeart() -> Bool {
        guard currency.spend(CurrencyState.singleHeartCost) else { return false }
        energy.addHearts(1)
        save()
        return true
    }

    /// Refresh energy calculation (call on app foreground).
    func refreshEnergy() {
        energy.recalculate()
    }

    // MARK: - Level Completion

    /// Record a level completion. Returns the result if the objective was met.
    func completeLevel(
        _ levelId: Int,
        score: Int,
        objectiveMet: Bool
    ) -> LevelResult? {
        guard objectiveMet,
              let level = LevelCatalog.level(levelId) else { return nil }

        let stars = calculateStars(score: score, level: level)
        let isFirstClear = !levelProgress.isCompleted(levelId)

        let result = LevelResult(
            levelId: levelId,
            stars: stars,
            score: score,
            completedAt: .now
        )

        // Update best result (keep the better of existing vs new).
        if let existing = levelProgress.levelResults[levelId] {
            if stars > existing.stars || (stars == existing.stars && score > existing.score) {
                levelProgress.levelResults[levelId] = result
            }
        } else {
            levelProgress.levelResults[levelId] = result
        }

        // Unlock next level.
        if levelId >= levelProgress.highestUnlockedLevel {
            levelProgress.highestUnlockedLevel = min(levelId + 1, LevelCatalog.totalLevels)
        }

        // Award coins for level completion.
        if isFirstClear {
            currency.earn(CurrencyState.firstClearReward)
        }
        if stars >= 3 {
            currency.earn(CurrencyState.threeStarBonus)
        }

        save()
        return result
    }

    /// Calculate star rating for a level attempt.
    private func calculateStars(score: Int, level: LevelDefinition) -> Int {
        if score >= level.starThresholds.2 { return 3 }
        if score >= level.starThresholds.1 { return 2 }
        return 1 // Completing the objective = at least 1 star.
    }

    // MARK: - XP

    /// Award XP based on game results. Returns XP gained and level-up info.
    @discardableResult
    func awardXP(
        score: Int,
        stars: Int,
        maxCombo: Int,
        isFirstClear: Bool
    ) -> (xpGained: Int, leveledUp: Bool, newLevel: Int) {
        let xp = XPCalculator.calculate(
            score: score,
            stars: stars,
            maxCombo: maxCombo,
            isFirstClear: isFirstClear
        )

        let result = playerXP.addXP(xp)

        // Level-up reward: refill energy + bonus coins.
        if result.leveledUp {
            energy.refillFull()
            currency.earn(result.newLevel * 5) // Scaling coin reward per level
        }

        save()
        return result
    }

    // MARK: - Currency

    /// Award daily login coins.
    func claimDailyLogin() {
        currency.earn(CurrencyState.dailyLoginReward)
        save()
    }

    /// Award streak bonus coins.
    func claimStreakBonus() {
        currency.earn(CurrencyState.weekStreakBonus)
        save()
    }

    /// Award coins for achievement completion.
    func awardAchievementCoins(chestTier: ChestType) {
        let amount = CurrencyState.achievementReward(chestTier: chestTier.rawValue)
        currency.earn(amount)
        save()
    }

    /// Purchase extra moves at game over. Returns true if affordable.
    func purchaseExtraMoves() -> Bool {
        guard currency.spend(CurrencyState.extraMovesCost) else { return false }
        save()
        return true
    }

    /// Add coins from IAP purchase.
    func addPurchasedCoins(_ amount: Int) {
        currency.earn(amount)
        save()
    }

    // MARK: - Queries

    /// Whether a level is unlocked.
    func isLevelUnlocked(_ id: Int) -> Bool {
        levelProgress.isUnlocked(id)
    }

    /// Stars earned on a specific level.
    func starsForLevel(_ id: Int) -> Int {
        levelProgress.starsForLevel(id)
    }

    /// Total stars across all levels.
    var totalStars: Int {
        levelProgress.totalStars
    }

    /// Current player level.
    var playerLevel: Int {
        playerXP.currentLevel
    }

    /// Current coin balance.
    var coinBalance: Int {
        currency.balance
    }

    // MARK: - Persistence

    private static let levelKey = "progression_levels"
    private static let xpKey = "progression_xp"
    private static let energyKey = "progression_energy"
    private static let currencyKey = "progression_currency"

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(levelProgress) {
            UserDefaults.standard.set(data, forKey: Self.levelKey)
        }
        if let data = try? encoder.encode(playerXP) {
            UserDefaults.standard.set(data, forKey: Self.xpKey)
        }
        if let data = try? encoder.encode(energy) {
            UserDefaults.standard.set(data, forKey: Self.energyKey)
        }
        if let data = try? encoder.encode(currency) {
            UserDefaults.standard.set(data, forKey: Self.currencyKey)
        }
    }

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = UserDefaults.standard.data(forKey: Self.levelKey),
           let decoded = try? decoder.decode(LevelProgressData.self, from: data) {
            levelProgress = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.xpKey),
           let decoded = try? decoder.decode(PlayerXPData.self, from: data) {
            playerXP = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.energyKey),
           let decoded = try? decoder.decode(EnergyState.self, from: data) {
            energy = decoded
            energy.recalculate()
        }
        if let data = UserDefaults.standard.data(forKey: Self.currencyKey),
           let decoded = try? decoder.decode(CurrencyState.self, from: data) {
            currency = decoded
        }
    }

    /// Reset all progression. Destructive — debug/testing only.
    func reset() {
        levelProgress = LevelProgressData()
        playerXP = PlayerXPData()
        energy = EnergyState()
        currency = CurrencyState()
        UserDefaults.standard.removeObject(forKey: Self.levelKey)
        UserDefaults.standard.removeObject(forKey: Self.xpKey)
        UserDefaults.standard.removeObject(forKey: Self.energyKey)
        UserDefaults.standard.removeObject(forKey: Self.currencyKey)
    }
}
