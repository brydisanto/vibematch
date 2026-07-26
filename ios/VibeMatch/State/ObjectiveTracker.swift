import Foundation
import Observation

// MARK: - Objective Tracker

/// Tracks progress toward a level's objective during gameplay.
/// Updated after each turn with TurnResult data. Does NOT modify GameEngine —
/// purely observes results.
@Observable
final class ObjectiveTracker {
    /// The current level's objective, or nil if not in level mode.
    private(set) var objective: LevelObjectiveType?

    /// Current progress value toward the objective.
    private(set) var currentProgress: Int = 0

    /// The target value to complete the objective.
    private(set) var targetValue: Int = 0

    /// Whether the objective has been met.
    private(set) var isComplete: Bool = false

    /// Human-readable description of the objective for UI.
    private(set) var objectiveText: String = ""

    // MARK: - Configuration

    /// Set up tracking for a level's objective. Call at game start.
    func configure(for level: LevelDefinition) {
        objective = level.objective
        currentProgress = 0
        targetValue = level.targetValue
        isComplete = false
        objectiveText = describeObjective(level.objective)
    }

    /// Reset tracker (for non-level modes).
    func clear() {
        objective = nil
        currentProgress = 0
        targetValue = 0
        isComplete = false
        objectiveText = ""
    }

    // MARK: - Update

    /// Called after each turn to update objective progress.
    /// `cumulativeScore` is the game's total score including this turn's contribution.
    func updateAfterTurn(
        result: TurnResult,
        cumulativeScore: Int,
        gameBadges: [Badge]
    ) {
        guard let objective, !isComplete else { return }

        switch objective {
        case .score(let target):
            currentProgress = cumulativeScore
            isComplete = currentProgress >= target

        case .matchBadgeTier(let tier, let count):
            let tierMatches = result.matchesFound.filter { $0.badge.tier == tier }
            currentProgress += tierMatches.count
            isComplete = currentProgress >= count

        case .createSpecialTile(let type, let count):
            let created = result.specialTilesCreated.filter { $0.type == type }
            currentProgress += created.count
            isComplete = currentProgress >= count

        case .reachCombo(let target):
            // Combo is a high-water mark — take the max across all turns.
            currentProgress = max(currentProgress, result.combo)
            isComplete = currentProgress >= target

        case .landShape(let type, let count):
            if let bonus = result.shapeBonus, bonus.type == type {
                currentProgress += 1
            }
            isComplete = currentProgress >= count

        case .triggerCascades(let count):
            currentProgress += result.cascadeCount
            isComplete = currentProgress >= count

        case .matchCount(let count):
            currentProgress += result.matchesFound.count
            isComplete = currentProgress >= count
        }
    }

    // MARK: - Description

    /// Generate a human-readable objective string for UI display.
    private func describeObjective(_ obj: LevelObjectiveType) -> String {
        switch obj {
        case .score(let target):
            return "Score \(target.formatted())+"
        case .matchBadgeTier(let tier, let count):
            let tierName: String = tier.displayName
            return "Match \(count) \(tierName) badges"
        case .createSpecialTile(let type, let count):
            return "Create \(count) \(type.displayName)\(count > 1 ? "s" : "")"
        case .reachCombo(let target):
            return "Reach \(target)x combo"
        case .landShape(let type, let count):
            let name: String
            switch type {
            case .L: name = "L-shape"
            case .T: name = "T-shape"
            case .cross: name = "Cross"
            }
            return "Land \(count) \(name)\(count > 1 ? "s" : "")"
        case .triggerCascades(let count):
            return "Trigger \(count) cascade\(count > 1 ? "s" : "")"
        case .matchCount(let count):
            return "Make \(count) matches"
        }
    }

    /// Compact progress string for HUD (e.g., "2/3 Bombs").
    var progressText: String {
        "\(currentProgress)/\(targetValue)"
    }

    /// Progress ratio (0.0 to 1.0) for UI bar.
    var progressRatio: Double {
        guard targetValue > 0 else { return 0 }
        return min(1.0, Double(currentProgress) / Double(targetValue))
    }
}
