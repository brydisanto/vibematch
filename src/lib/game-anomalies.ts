/**
 * Shared anomaly detection logic for game log entries.
 * Used by both the admin user detail page and the global anomalies dashboard.
 *
 * Thresholds are heuristics — tune over time as you learn what "normal"
 * looks like for your player base.
 */

export interface GameLogEntry {
    username?: string;
    timestamp: number;
    gameMode: string;
    score: number;
    matchCount: number;
    maxCombo: number;
    totalCascades: number;
    bombsCreated: number;
    vibestreaksCreated: number;
    cosmicBlastsCreated: number;
    crossCount: number;
    gameOverReason?: string;
    matchId?: string | null;
    validatedMatch?: boolean;
}

export interface AnomalyFlag {
    id: string;
    label: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

// Thresholds tuned around what team testers (mauxfaux et al) actually
// produce on a great run. Original numbers were too aggressive — players
// in the 90th-percentile of skill on a hot streak can:
//   - score 320K+ on a lucky board (hard cap is 30 moves but cascades +
//     power tile chains can push a single move to 8K-25K under the
//     post-bump scoring curve)
//   - chain 15+ cascades on a single move when power tiles compound
//   - rack up 25+ bombs across a deep cascade run
// Floor anything that requires rule-bending math (e.g. score/match ratios
// far above what power-tile detonations can mathematically produce) at
// the "impossible" tier — those almost certainly indicate a forged log.
const THRESHOLDS = {
    // Score thresholds bumped ~60% alongside the scoring system change
    // (base scores +50%, combo multiplier 0.75x → 1.0x). Without this
    // bump, legitimate high-skill runs under the new scoring curve would
    // start flagging as "very high score".
    score: 480_000,
    combo: 25,
    cascades: 100,
    bombs: 35,
    matches: 800,
    vibestreaks: 25,
    cosmicBlasts: 20,
    scorePerMatch: 1300,
    // Impossibility checks (if triggered, almost certainly forged)
    scoreImpossible: 800_000,
    scorePerMatchImpossible: 4800,
} as const;

export function detectAnomalies(game: GameLogEntry): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];

    // HIGH — almost certainly forged
    if (game.score >= THRESHOLDS.scoreImpossible) {
        flags.push({ id: 'score-impossible', label: 'Impossible score', severity: 'critical' });
    }
    if (game.matchCount > 0 && game.score / game.matchCount >= THRESHOLDS.scorePerMatchImpossible) {
        flags.push({ id: 'score-per-match-impossible', label: 'Score/match ratio impossible', severity: 'critical' });
    }

    // MEDIUM — very unusual, worth reviewing
    if (game.score >= THRESHOLDS.score && game.score < THRESHOLDS.scoreImpossible) {
        flags.push({ id: 'score-high', label: 'Very high score', severity: 'high' });
    }
    if (game.maxCombo >= THRESHOLDS.combo) {
        flags.push({ id: 'combo-high', label: `Combo > ${THRESHOLDS.combo}`, severity: 'high' });
    }
    if (game.totalCascades >= THRESHOLDS.cascades) {
        flags.push({ id: 'cascades-high', label: `Cascades > ${THRESHOLDS.cascades}`, severity: 'medium' });
    }
    if (game.bombsCreated >= THRESHOLDS.bombs) {
        flags.push({ id: 'bombs-high', label: `Bombs > ${THRESHOLDS.bombs}`, severity: 'medium' });
    }
    if (game.matchCount >= THRESHOLDS.matches) {
        flags.push({ id: 'matches-high', label: `Matches > ${THRESHOLDS.matches}`, severity: 'medium' });
    }
    if (game.cosmicBlastsCreated >= THRESHOLDS.cosmicBlasts) {
        flags.push({ id: 'cosmic-high', label: `Cosmic blasts > ${THRESHOLDS.cosmicBlasts}`, severity: 'medium' });
    }
    if (game.vibestreaksCreated >= THRESHOLDS.vibestreaks) {
        flags.push({ id: 'vibestreaks-high', label: `Vibestreaks > ${THRESHOLDS.vibestreaks}`, severity: 'medium' });
    }

    // LOW — suspicious but could be legitimate
    if (game.matchCount > 0 &&
        game.score / game.matchCount >= THRESHOLDS.scorePerMatch &&
        game.score / game.matchCount < THRESHOLDS.scorePerMatchImpossible) {
        flags.push({ id: 'score-per-match-high', label: 'High score/match ratio', severity: 'low' });
    }

    // Validation flag — classic-mode games that weren't tied to a server match token
    if (game.gameMode === 'classic' && game.validatedMatch === false) {
        flags.push({ id: 'no-match-token', label: 'No match token', severity: 'low' });
    }

    return flags;
}

export function highestSeverity(flags: AnomalyFlag[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (flags.length === 0) return 'none';
    const order = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    let max: keyof typeof order = 'low';
    for (const f of flags) {
        if (order[f.severity] > order[max]) max = f.severity;
    }
    return max;
}
