import Foundation

// MARK: - Energy State

/// Tracks the player's energy (hearts) for gating game sessions.
///
/// - 5 hearts max
/// - 1 heart regens every 20 minutes
/// - Classic and Level games cost 1 heart
/// - Daily mode is FREE
struct EnergyState: Codable, Sendable {
    var currentEnergy: Int = Self.maxEnergy
    var lastRegenTimestamp: Date = .now

    static let maxEnergy = 5
    static let regenIntervalSeconds: TimeInterval = 20 * 60 // 20 minutes

    /// Recalculate energy based on elapsed time since last regen.
    mutating func recalculate() {
        guard currentEnergy < Self.maxEnergy else {
            lastRegenTimestamp = .now
            return
        }
        let elapsed = Date.now.timeIntervalSince(lastRegenTimestamp)
        let regened = Int(elapsed / Self.regenIntervalSeconds)
        if regened > 0 {
            currentEnergy = min(Self.maxEnergy, currentEnergy + regened)
            // Advance timestamp by the number of regens applied (not to .now)
            // so partial progress toward the next regen is preserved.
            lastRegenTimestamp = lastRegenTimestamp.addingTimeInterval(
                Double(regened) * Self.regenIntervalSeconds
            )
        }
        // If we're now full, snap timestamp to now.
        if currentEnergy >= Self.maxEnergy {
            lastRegenTimestamp = .now
        }
    }

    /// Seconds until the next heart regenerates (0 if full).
    var secondsUntilNextRegen: TimeInterval {
        guard currentEnergy < Self.maxEnergy else { return 0 }
        let elapsed = Date.now.timeIntervalSince(lastRegenTimestamp)
        return max(0, Self.regenIntervalSeconds - elapsed)
    }

    /// Formatted time until next regen (e.g. "12:45").
    var regenCountdownFormatted: String {
        let total = Int(secondsUntilNextRegen)
        let minutes = total / 60
        let seconds = total % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    /// Consume 1 energy. Returns true if successful, false if empty.
    mutating func consume() -> Bool {
        recalculate()
        guard currentEnergy > 0 else { return false }
        currentEnergy -= 1
        return true
    }

    /// Refill to max energy immediately.
    mutating func refillFull() {
        currentEnergy = Self.maxEnergy
        lastRegenTimestamp = .now
    }

    /// Add a specific number of hearts (capped at max).
    mutating func addHearts(_ count: Int) {
        recalculate()
        currentEnergy = min(Self.maxEnergy, currentEnergy + count)
        if currentEnergy >= Self.maxEnergy {
            lastRegenTimestamp = .now
        }
    }

    /// Whether the player has enough energy to play.
    var canPlay: Bool {
        var copy = self
        copy.recalculate()
        return copy.currentEnergy > 0
    }
}
