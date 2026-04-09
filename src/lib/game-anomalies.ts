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

const THRESHOLDS = {
    score: 200_000,
    combo: 15,
    cascades: 50,
    bombs: 20,
    matches: 500,
    vibestreaks: 15,
    cosmicBlasts: 10,
    scorePerMatch: 500,
    // Impossibility checks (if triggered, almost certainly forged)
    scoreImpossible: 400_000,
    scorePerMatchImpossible: 2000,
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
        flags.push({ id: 'combo-high', label: 'Combo > 15', severity: 'high' });
    }
    if (game.totalCascades >= THRESHOLDS.cascades) {
        flags.push({ id: 'cascades-high', label: 'Cascades > 50', severity: 'medium' });
    }
    if (game.bombsCreated >= THRESHOLDS.bombs) {
        flags.push({ id: 'bombs-high', label: 'Bombs > 20', severity: 'medium' });
    }
    if (game.matchCount >= THRESHOLDS.matches) {
        flags.push({ id: 'matches-high', label: 'Matches > 500', severity: 'medium' });
    }
    if (game.cosmicBlastsCreated >= THRESHOLDS.cosmicBlasts) {
        flags.push({ id: 'cosmic-high', label: 'Cosmic blasts > 10', severity: 'medium' });
    }
    if (game.vibestreaksCreated >= THRESHOLDS.vibestreaks) {
        flags.push({ id: 'vibestreaks-high', label: 'Vibestreaks > 15', severity: 'medium' });
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
