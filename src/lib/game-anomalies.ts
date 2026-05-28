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
//
// Per-mode tables because Frenzy plays radically differently than Classic:
//   - 60s round + bonus time refunds → 1-2 minutes of continuous matching
//   - TURBO 3x sustained multiplier window pushes legitimate score/match
//     into the 1500-3000 range that Classic players never see
//   - Cap of 30 moves doesn't apply; "matches" alone can hit 150-200
const THRESHOLDS_BY_MODE = {
    classic: {
        // Score thresholds bumped ~60% alongside the scoring system change
        // (base scores +50%, combo multiplier 0.75x → 1.0x).
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
    },
    frenzy: {
        // Frenzy scores have come in noticeably higher than pre-launch
        // projections — TURBO 3x sustained + bonus-time stacking lets
        // top players push well past Classic numbers. Thresholds are
        // tuned wider than Classic to match observed runs; tighten once
        // we have more leaderboard data to read off.
        score: 750_000,
        combo: 30,
        cascades: 200,
        bombs: 50,
        matches: 800,
        vibestreaks: 35,
        cosmicBlasts: 25,
        // TURBO 3x + cascade chains baseline legit score/match into the
        // 3000-5000 range; bot signal lives well above that.
        scorePerMatch: 6000,
        scoreImpossible: 1_200_000,
        scorePerMatchImpossible: 15000,
    },
} as const;

function thresholdsFor(mode: string) {
    // Daily inherits classic thresholds — same 30-move budget, same
    // scoring curve. Anything not classic/daily/frenzy also defaults
    // to classic for safety.
    if (mode === 'frenzy') return THRESHOLDS_BY_MODE.frenzy;
    return THRESHOLDS_BY_MODE.classic;
}

export function detectAnomalies(game: GameLogEntry): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    const T = thresholdsFor(game.gameMode);

    // HIGH — almost certainly forged
    if (game.score >= T.scoreImpossible) {
        flags.push({ id: 'score-impossible', label: 'Impossible score', severity: 'critical' });
    }
    if (game.matchCount > 0 && game.score / game.matchCount >= T.scorePerMatchImpossible) {
        flags.push({ id: 'score-per-match-impossible', label: 'Score/match ratio impossible', severity: 'critical' });
    }

    // MEDIUM — very unusual, worth reviewing
    if (game.score >= T.score && game.score < T.scoreImpossible) {
        flags.push({ id: 'score-high', label: 'Very high score', severity: 'high' });
    }
    if (game.maxCombo >= T.combo) {
        flags.push({ id: 'combo-high', label: `Combo > ${T.combo}`, severity: 'high' });
    }
    if (game.totalCascades >= T.cascades) {
        flags.push({ id: 'cascades-high', label: `Cascades > ${T.cascades}`, severity: 'medium' });
    }
    if (game.bombsCreated >= T.bombs) {
        flags.push({ id: 'bombs-high', label: `Bombs > ${T.bombs}`, severity: 'medium' });
    }
    if (game.matchCount >= T.matches) {
        flags.push({ id: 'matches-high', label: `Matches > ${T.matches}`, severity: 'medium' });
    }
    if (game.cosmicBlastsCreated >= T.cosmicBlasts) {
        flags.push({ id: 'cosmic-high', label: `Cosmic blasts > ${T.cosmicBlasts}`, severity: 'medium' });
    }
    if (game.vibestreaksCreated >= T.vibestreaks) {
        flags.push({ id: 'vibestreaks-high', label: `Vibestreaks > ${T.vibestreaks}`, severity: 'medium' });
    }

    // LOW — suspicious but could be legitimate
    if (game.matchCount > 0 &&
        game.score / game.matchCount >= T.scorePerMatch &&
        game.score / game.matchCount < T.scorePerMatchImpossible) {
        flags.push({ id: 'score-per-match-high', label: 'High score/match ratio', severity: 'low' });
    }

    // Validation flag — classic + frenzy games that weren't tied to a
    // server match token. Daily uses the daily_played marker instead so
    // it's exempt.
    if ((game.gameMode === 'classic' || game.gameMode === 'frenzy') && game.validatedMatch === false) {
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
