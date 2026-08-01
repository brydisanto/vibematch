import Foundation

/// Per-turn breakdown for the move-history view. Captures the metrics
/// we care about so players can later see "what did I do to get that 5x".
///
/// Mirrors the web `MoveLogEntry` interface in src/lib/gameEngine.ts.
/// Only resolved (non-invalid) turns produce an entry — invalid swap
/// attempts are excluded since they don't consume a move.
struct MoveLogEntry: Identifiable, Hashable, Sendable, Codable {
    var id: Int { moveNum }

    /// 1..CLASSIC_MOVES — display number for the row.
    let moveNum: Int

    /// Points earned this turn (after all multipliers).
    let pointsGained: Int

    /// Number of distinct matches this turn.
    let matchesFound: Int

    /// Cascade chain length triggered by this turn.
    let cascadeCount: Int

    /// Peak combo multiplier reached during this turn's chain.
    let maxCombo: Int

    /// Highest-tier shape bonus landed this turn (L / T / cross), if any.
    let shapeBonus: ShapeBonusType?

    /// Power tiles spawned by this turn's match.
    let specialsCreated: [SpecialTileType]

    /// Power tiles detonated this turn (chain reactions count separately).
    let specialsTriggered: [SpecialTileType]

    /// Tier of the highest-tier pin matched this turn.
    let topTier: BadgeTier?

    /// Display name of the top-tier pin (e.g. "Citizen of Vibetown").
    let topTierName: String?
}
