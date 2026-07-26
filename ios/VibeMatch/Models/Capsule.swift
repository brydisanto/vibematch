import Foundation

// MARK: - PinCapsule

/// A sealed reward earned from gameplay. Cracks open to reveal a random
/// pin from the 101-pin catalog, weighted by tier probability.
///
/// PinCapsules are awarded at score thresholds (15K, 35K, 75K) plus a bonus
/// capsule for landing a T or Cross shape match (max 1 per run). Daily
/// Challenge runs award double quantities.
struct PinCapsule: Codable, Hashable, Identifiable, Sendable {
    let id: UUID

    /// When this capsule was earned.
    let earnedAt: Date

    /// Mode the capsule was earned from. Influences card art / sparkle in UI.
    let earnedFromMode: GameMode

    /// Source trigger that earned this capsule.
    let trigger: Trigger

    /// The pin revealed when the capsule cracks. Nil until opened.
    var revealedPin: Badge?

    /// Whether the capsule has been opened.
    var isOpened: Bool { revealedPin != nil }

    enum Trigger: String, Codable, Hashable, Sendable {
        case scoreThreshold15K
        case scoreThreshold35K
        case scoreThreshold75K
        case bonusShape          // T or Cross shape, one per run max
        case dailyChampion       // +10 awarded next login
        case streak              // 3 / 7 / 30 day quests
        case purchased           // premium bonus games
    }

    init(trigger: Trigger, mode: GameMode) {
        self.id = UUID()
        self.earnedAt = .now
        self.earnedFromMode = mode
        self.trigger = trigger
        self.revealedPin = nil
    }
}

// MARK: - PinCapsule Award Calculation

/// Computes the capsules earned by a finished game. Mirrors the web's
/// score-threshold ladder and bonus-shape capsule rule.
enum PinCapsuleAward {

    /// PinCapsules earned for hitting the standard score thresholds.
    /// Mirrors web classicCapsulesForScore: a TOTAL of 1 / 2 / 3 capsules
    /// at 15K / 35K / 75K. Daily Challenge doubles the output.
    static func scorePinCapsules(for score: Int, mode: GameMode) -> [PinCapsule] {
        var triggers: [PinCapsule.Trigger] = []
        if score >= 15_000 { triggers.append(.scoreThreshold15K) }
        if score >= 35_000 { triggers.append(.scoreThreshold35K) }
        if score >= 75_000 { triggers.append(.scoreThreshold75K) }

        let perTrigger = (mode == .daily) ? 2 : 1
        var earned: [PinCapsule] = []
        for trigger in triggers {
            for _ in 0..<perTrigger {
                earned.append(PinCapsule(trigger: trigger, mode: mode))
            }
        }
        return earned
    }

    /// All capsules earned by a finished game. `bonusShapeEarned` should be
    /// the GameSession's `bonusPinCapsuleAwarded` flag (set when a T or Cross
    /// shape was landed during the run, max 1 per game).
    static func all(score: Int, mode: GameMode, bonusShapeEarned: Bool) -> [PinCapsule] {
        var capsules = scorePinCapsules(for: score, mode: mode)
        if bonusShapeEarned {
            capsules.append(PinCapsule(trigger: .bonusShape, mode: mode))
        }
        return capsules
    }
}

// MARK: - PinCapsule Pin Roll

/// Rolls a random pin from the catalog for a capsule reveal. Tier
/// distribution mirrors the web rates from product/economy spec:
///   blue 45% · silver 30% · special 13% · gold 9% · cosmic 3%.
/// Within a tier, the `dropWeight` field biases the roll (web uses this
/// for $VIBESTR tier scarcity).
enum PinCapsuleRoll {

    private static let tierWeights: [(BadgeTier, Double)] = [
        (.blue,    0.45),
        (.silver,  0.30),
        (.special, 0.13),
        (.gold,    0.09),
        (.cosmic,  0.03),
    ]

    static func roll(from catalog: [Badge], rng: inout any RandomNumberGenerator) -> Badge? {
        let pickedTier = rollTier(rng: &rng)
        let candidates = catalog.filter { $0.tier == pickedTier }
        guard !candidates.isEmpty else {
            // Fallback if the tier is empty in this catalog slice.
            return catalog.randomElement(using: &rng)
        }
        return weightedPin(from: candidates, rng: &rng)
    }

    private static func rollTier(rng: inout any RandomNumberGenerator) -> BadgeTier {
        let r = Double.random(in: 0..<1, using: &rng)
        var cumulative = 0.0
        for (tier, weight) in tierWeights {
            cumulative += weight
            if r < cumulative { return tier }
        }
        return .blue
    }

    private static func weightedPin(from candidates: [Badge], rng: inout any RandomNumberGenerator) -> Badge {
        let totalWeight = candidates.reduce(0) { $0 + max(1, $1.dropWeight) }
        let r = Int.random(in: 0..<totalWeight, using: &rng)
        var cumulative = 0
        for pin in candidates {
            cumulative += max(1, pin.dropWeight)
            if r < cumulative { return pin }
        }
        return candidates[0]
    }
}
