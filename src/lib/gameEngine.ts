import { Badge, selectGameBadges, getDailySeed, seededRandom } from "./badges";

// ===== TYPES =====

export interface Position {
    row: number;
    col: number;
}

export interface Cell {
    badge: Badge;
    id: string; // unique ID for animation tracking
    isSpecial?: SpecialTileType;
    isNew?: boolean;
    isMatched?: boolean;
    dropDistance?: number; // rows this tile dropped during gravity (for animation)
    // For cosmic_blast specials: the badge id whose tiles get cleared on
    // detonation. Set to the source match's badge so the player's "clear all
    // of this type" semantic is preserved even if the spawn cell's visible
    // badge was swapped to avoid an immediate self-trigger cascade.
    cosmicTargetBadgeId?: string;
}

export type SpecialTileType = "bomb" | "vibestreak" | "cosmic_blast";

export interface Match {
    positions: Position[];
    badge: Badge;
    isHorizontal: boolean;
}

export type GameMode = "classic" | "daily" | "frenzy";

export type GameOverReason = "moves_exhausted" | "no_valid_moves" | "time_expired" | null;

/**
 * Minimal, deterministic record of a player action — used by the
 * server-authoritative replay system (Phase 2: client-side logging
 * only; Phase 3+ will replay these against a server-issued seed to
 * compute an authoritative score). Two shapes:
 *   - swap: the two adjacent tiles the player swapped
 *   - tap:  a double-tap activation on a special tile
 * Both are sufficient inputs for processTurn / triggerSpecialTile to
 * reproduce the game given the same seed + gameBadges.
 *
 * Optional behavioral signals appended per move so the server can
 * derive timing distributions without holding the full event stream:
 *   - t        ms since game start, captured at the moment the move
 *              resolved. Lets us compute inter-move stddev + game
 *              duration. Human play stddev ≈ 800-3000ms; bot play
 *              clusters tight (sub-300ms stddev).
 *   - trusted  whether the originating PointerEvent had isTrusted
 *              === true. Synthetic dispatchEvent calls produce
 *              isTrusted: false — a strong synthetic-input signal.
 */
export type MoveAction =
    | { kind: 'swap'; from: Position; to: Position; t?: number; trusted?: boolean }
    | { kind: 'tap'; at: Position; t?: number; trusted?: boolean };

/**
 * Per-turn record for the move-history view. Captures the metrics we
 * care about so players can later see "what did I do to get that 5x".
 * Only resolved (non-invalid) turns produce an entry — invalid swap
 * attempts are excluded since they don't consume a move.
 */
export interface MoveLogEntry {
    moveNum: number;                                              // 1..CLASSIC_MOVES
    pointsGained: number;
    matchesFound: number;
    cascadeCount: number;
    maxCombo: number;                                             // combo peak during this turn's chain
    shapeBonus: 'L' | 'T' | 'cross' | null;
    specialsCreated: SpecialTileType[];
    specialsTriggered: SpecialTileType[];
    topTier: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special' | null;
    topTierName: string | null;
}

export interface GameState {
    board: Cell[][];
    score: number;
    movesLeft: number;
    combo: number;
    maxCombo: number;
    comboCarry: number;
    selectedTile: Position | null;
    gameBadges: Badge[];
    gameMode: GameMode;
    gamePhase: "playing" | "animating" | "gameover";
    matchCount: number;
    totalCascades: number;
    dailySeed?: number;
    gameOverReason: GameOverReason;
    bonusCapsuleAwarded: boolean;
    // Frenzy-only. All numbers are milliseconds / Unix timestamps.
    // frenzyStartedAt and frenzyEndsAt stay null until the first valid
    // swap so board-load latency doesn't steal time. frenzyEndsAt is an
    // absolute timestamp — the HUD computes "remaining" live as
    // (frenzyEndsAt - now) so we don't tick state every 250ms and
    // interrupt mid-cascade tile animations. heatActiveUntil null = no
    // heat.
    frenzyEndsAt: number | null;
    frenzyBonusMsEarned: number;
    frenzyStartedAt: number | null;
    frenzyLastMatchAt: number | null;
    frenzyConsecutiveQuickMatches: number;
    frenzyHeatActiveUntil: number | null;
    /** Per-turn breakdown for the in-game and post-game move-history
     *  view. Newest entries appended; one entry per resolved turn. */
    moveLog: MoveLogEntry[];
    /** Replay-grade record of every player action that consumed a move
     *  (valid swaps + tap-activated specials). Sent to the server with
     *  logGame so a future server-authoritative replay pass can
     *  recompute the score deterministically. Currently the server
     *  stores this but doesn't replay it yet — Phase 2 of the
     *  server-authoritative score scope. */
    moveSequence: MoveAction[];
    /** Stateful RNG closure for THIS game. Threads through processTurn /
     *  triggerSpecialTile / applyGravity so every tile refill is
     *  deterministic from the match's server-issued seed. Optional
     *  because legacy GameState (DemoClient's synthetic HUD state,
     *  in-flight games at deploy time) won't have it — engine fns fall
     *  back to Math.random when this is undefined. */
    rng?: Rng;
}

/** Stateful per-game random number source. Returns [0, 1). Mutates
 *  internal state on each call so successive invocations produce a
 *  deterministic sequence given a seed. */
export type Rng = () => number;

/** Build a per-game RNG from the server-issued seed (or fall back to
 *  Math.random when no seed is provided). The `+ 1000` offset matches
 *  the original board-fill seed transform so the FIRST tiles produced
 *  by this RNG match what createBoard used to generate locally. */
export function makeGameRng(seed?: number): Rng {
    return seed !== undefined ? seededRandom(seed + 1000) : Math.random;
}

const BOARD_SIZE = 8;
export const CLASSIC_MOVES = 30;

// ===== FRENZY =====
// Frenzy is the 60-second speed mode. Time is the only resource. Bigger
// matches and combo chains award bonus seconds; players never run out of
// moves. Anti-cheat: server rejects scores submitted faster than
// FRENZY_MIN_ROUND_MS (allows for the no-input grace before the clock
// starts and the final cascade resolving).
export const FRENZY_INITIAL_MS = 60_000;
export const FRENZY_MAX_MS = 150_000;          // 2:30 cap on snowballing
export const FRENZY_MIN_ROUND_MS = 8_000;       // server-side anti-cheat floor
export const FRENZY_HEAT_WINDOW_MS = 5_000;     // window between matches for heat
export const FRENZY_HEAT_TRIGGER_COUNT = 3;     // quick matches to trigger heat 2x
export const FRENZY_HEAT_DURATION_MS = 5_000;   // how long the next-match-doubles bonus lasts

/** Returns ms of bonus time for a single match resolution. Inputs come
 *  from processTurn's TurnResult so the hook can layer this on without
 *  the engine needing to know about a clock. */
export function computeFrenzyBonusMs(opts: {
    largestMatchSize: number;
    spawnedSpecial: boolean;
    comboPeak: number;
}): number {
    let bonus = 0;
    if (opts.largestMatchSize >= 5 || opts.spawnedSpecial) bonus += 2_000;
    else if (opts.largestMatchSize === 4) bonus += 1_000;
    if (opts.comboPeak >= 6) bonus += 5_000;
    else if (opts.comboPeak >= 4) bonus += 2_000;
    return bonus;
}

/** Score -> capsule mapping. Tuned ladder: 30k/60k/100k for 1/2/3 capsules.
 *  Cap at 3 keeps the economy bounded even on a god run. */
export function frenzyCapsulesForScore(score: number): number {
    if (score >= 100_000) return 3;
    if (score >= 60_000) return 2;
    if (score >= 30_000) return 1;
    return 0;
}

let cellIdCounter = 0;
function nextCellId(): string {
    return `cell_${cellIdCounter++}`;
}

// ===== BOARD CREATION =====

/**
 * Build the starting state for a new game.
 *
 * @param mode game mode (classic, daily, frenzy, etc.)
 * @param draftedBadges optional pre-drafted badge pool (Vibe Draft mode)
 * @param explicitSeed optional seed override. When provided, both badge
 *        selection (when no draft) AND the board layout RNG use this seed,
 *        so the server can deterministically reconstruct the same state
 *        at replay time. When undefined, falls back to: daily → derive
 *        from today's date, anything else → fresh Math.random.
 */
export function createInitialState(mode: GameMode, draftedBadges?: Badge[], explicitSeed?: number): GameState {
    const seed = explicitSeed !== undefined
        ? explicitSeed
        : (mode === "daily" ? getDailySeed() : undefined);
    const gameBadges = draftedBadges ?? selectGameBadges(6, seed);

    // ONE rng per game. createBoard burns ~64 calls populating the
    // initial board; subsequent applyGravity calls continue advancing
    // the same closure so the live game's tile sequence is deterministic
    // from the seed. Replay creates its own RNG with the same seed and
    // gets an identical sequence.
    const rng = makeGameRng(seed);
    const board = createBoard(gameBadges, rng);

    return {
        board,
        score: 0,
        // Frenzy ignores movesLeft entirely. Leaving the field at the
        // classic default keeps existing readers (HUD, anti-cheat) from
        // having to do null checks.
        movesLeft: CLASSIC_MOVES,
        combo: 0,
        maxCombo: 0,
        comboCarry: 0,
        selectedTile: null,
        gameBadges,
        gameMode: mode,
        gamePhase: "playing",
        matchCount: 0,
        totalCascades: 0,
        // `dailySeed` is the legacy field name; we reuse it as the
        // canonical "what seed built this match" identifier across all
        // modes now that the server issues seeds for Classic too.
        dailySeed: seed,
        gameOverReason: null,
        bonusCapsuleAwarded: false,
        frenzyEndsAt: null,
        frenzyBonusMsEarned: 0,
        frenzyStartedAt: null,
        frenzyLastMatchAt: null,
        frenzyConsecutiveQuickMatches: 0,
        frenzyHeatActiveUntil: null,
        moveLog: [],
        moveSequence: [],
        rng,
    };
}

export function createBoard(badges: Badge[], rngOrSeed?: Rng | number): Cell[][] {
    // Back-compat: original signature took a `seed: number`. New callers
    // pass an Rng closure directly so the initial board fill and later
    // applyGravity refills share state. Both shapes are supported here.
    const rng: Rng = typeof rngOrSeed === 'function'
        ? rngOrSeed
        : (typeof rngOrSeed === 'number' ? seededRandom(rngOrSeed + 1000) : Math.random);

    const board: Cell[][] = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            let badge: Badge;

            // Keep generating until we don't create an initial match
            do {
                badge = badges[Math.floor(rng() * badges.length)];
            } while (wouldCreateMatch(board, row, col, badge));

            board[row][col] = {
                badge,
                id: nextCellId(),
            };
        }
    }

    return board;
}

function wouldCreateMatch(
    board: Cell[][],
    row: number,
    col: number,
    badge: Badge
): boolean {
    // Check horizontal: 2 to the left
    if (
        col >= 2 &&
        board[row][col - 1]?.badge.id === badge.id &&
        board[row][col - 2]?.badge.id === badge.id
    ) {
        return true;
    }

    // Check vertical: 2 above
    if (
        row >= 2 &&
        board[row - 1]?.[col]?.badge.id === badge.id &&
        board[row - 2]?.[col]?.badge.id === badge.id
    ) {
        return true;
    }

    return false;
}

/**
 * Checks all 3-tile windows (horizontal and vertical) that pass through
 * (row, col) to see if placing `badgeId` there would form a 3-in-a-row.
 * Used when placing a freshly-created special to avoid it being eaten by
 * an immediate match on the same turn.
 */
function wouldFormMatchAt(
    board: Cell[][],
    row: number,
    col: number,
    badgeId: string
): boolean {
    // Horizontal: each length-3 window containing col
    const hStart = Math.max(0, col - 2);
    const hEnd = Math.min(BOARD_SIZE - 3, col);
    for (let start = hStart; start <= hEnd; start++) {
        let allMatch = true;
        for (let c = start; c < start + 3; c++) {
            const id = c === col ? badgeId : board[row]?.[c]?.badge?.id;
            if (id !== badgeId) { allMatch = false; break; }
        }
        if (allMatch) return true;
    }
    // Vertical: each length-3 window containing row
    const vStart = Math.max(0, row - 2);
    const vEnd = Math.min(BOARD_SIZE - 3, row);
    for (let start = vStart; start <= vEnd; start++) {
        let allMatch = true;
        for (let r = start; r < start + 3; r++) {
            const id = r === row ? badgeId : board[r]?.[col]?.badge?.id;
            if (id !== badgeId) { allMatch = false; break; }
        }
        if (allMatch) return true;
    }
    return false;
}

// ===== SWAP =====

export function isAdjacentSwap(a: Position, b: Position): boolean {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export function swapTiles(board: Cell[][], a: Position, b: Position): Cell[][] {
    const newBoard = board.map((row) => [...row]);
    const temp = newBoard[a.row][a.col];
    newBoard[a.row][a.col] = newBoard[b.row][b.col];
    newBoard[b.row][b.col] = temp;
    return newBoard;
}

// ===== MATCH DETECTION =====

export function findAllMatches(board: Cell[][]): Match[] {
    const matches: Match[] = [];
    const matched = new Set<string>();

    // Horizontal matches. Specials participate in matches normally — matching
    // a special also detonates it. Freshly placed specials get a non-matching
    // badge at placement time (see processTurn) so they don't get instantly eaten.
    for (let row = 0; row < BOARD_SIZE; row++) {
        let runStart = 0;
        for (let col = 1; col <= BOARD_SIZE; col++) {
            if (
                col < BOARD_SIZE &&
                board[row][col].badge.id === board[row][runStart].badge.id
            ) {
                continue;
            }

            const runLength = col - runStart;
            if (runLength >= 3) {
                const positions: Position[] = [];
                for (let c = runStart; c < col; c++) {
                    const key = `${row},${c}`;
                    if (!matched.has(key)) {
                        matched.add(key);
                    }
                    positions.push({ row, col: c });
                }
                matches.push({
                    positions,
                    badge: board[row][runStart].badge,
                    isHorizontal: true,
                });
            }
            runStart = col;
        }
    }

    // Vertical matches — same logic as horizontal.
    for (let col = 0; col < BOARD_SIZE; col++) {
        let runStart = 0;
        for (let row = 1; row <= BOARD_SIZE; row++) {
            if (
                row < BOARD_SIZE &&
                board[row][col].badge.id === board[runStart][col].badge.id
            ) {
                continue;
            }

            const runLength = row - runStart;
            if (runLength >= 3) {
                const positions: Position[] = [];
                for (let r = runStart; r < row; r++) {
                    const key = `${r},${col}`;
                    if (!matched.has(key)) {
                        matched.add(key);
                    }
                    positions.push({ row: r, col });
                }
                matches.push({
                    positions,
                    badge: board[runStart][col].badge,
                    isHorizontal: false,
                });
            }
            runStart = row;
        }
    }

    return matches;
}

// ===== SHAPE DETECTION =====

export type ShapeBonus = { type: 'L' | 'T' | 'cross'; multiplier: number } | null;

export function detectShapes(matches: Match[]): ShapeBonus {
    const horizontal = matches.filter(m => m.isHorizontal);
    const vertical = matches.filter(m => !m.isHorizontal);

    let bestShape: ShapeBonus = null;

    for (const h of horizontal) {
        for (const v of vertical) {
            // Must be the same badge type
            if (h.badge.id !== v.badge.id) continue;

            // Find shared positions
            const shared: Position[] = [];
            for (const hp of h.positions) {
                for (const vp of v.positions) {
                    if (hp.row === vp.row && hp.col === vp.col) {
                        shared.push(hp);
                    }
                }
            }

            if (shared.length !== 1) continue;

            const sp = shared[0];

            // Determine if the shared tile is at an end or middle of each run
            const hPositions = h.positions;
            const vPositions = v.positions;

            const hFirst = hPositions[0];
            const hLast = hPositions[hPositions.length - 1];
            const vFirst = vPositions[0];
            const vLast = vPositions[vPositions.length - 1];

            const isHEnd = (sp.row === hFirst.row && sp.col === hFirst.col) ||
                           (sp.row === hLast.row && sp.col === hLast.col);
            const isVEnd = (sp.row === vFirst.row && sp.col === vFirst.col) ||
                           (sp.row === vLast.row && sp.col === vLast.col);

            const isHMiddle = !isHEnd;
            const isVMiddle = !isVEnd;

            let detected: ShapeBonus = null;

            if (isHMiddle && isVMiddle) {
                // Cross: shared tile is in the middle of BOTH runs
                detected = { type: 'cross', multiplier: 4 };
            } else if (isHMiddle || isVMiddle) {
                // T-shape: shared tile is in the middle of exactly one run
                detected = { type: 'T', multiplier: 2.5 };
            } else {
                // L-shape: shared tile is at the end of both runs
                detected = { type: 'L', multiplier: 1.5 };
            }

            // Keep highest-tier shape (cross > T > L)
            if (detected) {
                if (!bestShape || detected.multiplier > bestShape.multiplier) {
                    bestShape = detected;
                }
            }
        }
    }

    return bestShape;
}

// ===== SPECIAL TILES =====

export function getSpecialTileForMatch(match: Match): SpecialTileType | null {
    const len = match.positions.length;
    if (len === 4) return match.badge.tier === "cosmic" ? "vibestreak" : "bomb";
    if (len === 5) return match.badge.tier === "cosmic" ? "cosmic_blast" : "vibestreak";
    if (len >= 6) return "cosmic_blast";
    return null;
}

// Apply special tile effects
export function applySpecialTile(
    board: Cell[][],
    pos: Position,
    specialType: SpecialTileType
): Position[] {
    const affected: Position[] = [];

    switch (specialType) {
        case "bomb": {
            // Clear 3×3 area
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = pos.row + dr;
                    const c = pos.col + dc;
                    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                        affected.push({ row: r, col: c });
                    }
                }
            }
            break;
        }
        case "vibestreak": {
            // Clear entire row + column
            for (let c = 0; c < BOARD_SIZE; c++) {
                affected.push({ row: pos.row, col: c });
            }
            for (let r = 0; r < BOARD_SIZE; r++) {
                if (r !== pos.row) {
                    affected.push({ row: r, col: pos.col });
                }
            }
            break;
        }
        case "cosmic_blast": {
            // Clear all tiles of the cosmic blast's target badge. The target
            // is set at spawn time to the source match's badge, so detonation
            // clears the type the player just matched — not whatever random
            // badge gravity dropped under the cosmic overlay.
            const cell = board[pos.row][pos.col];
            const targetBadge = cell.cosmicTargetBadgeId ?? cell.badge.id;
            // Diagnostic: if cosmicTargetBadgeId went missing, log it so we
            // can catch state-preservation bugs without players reporting
            // weird "wrong tiles cleared" results. Falls back to the
            // visible badge so detonation always does SOMETHING.
            if (typeof window !== "undefined" && !cell.cosmicTargetBadgeId) {
                console.warn("[cosmic_blast] cosmicTargetBadgeId missing on detonation", {
                    pos,
                    visibleBadge: cell.badge.id,
                    fallback: targetBadge,
                });
            }
            const seen = new Set<string>();
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (board[r][c].badge.id === targetBadge) {
                        affected.push({ row: r, col: c });
                        seen.add(`${r},${c}`);
                    }
                }
            }
            // Always include the cosmic blast cell itself, even if its visible
            // badge differs from the target (which it will when we swapped to
            // avoid auto-trigger). Otherwise the spent special tile lingers
            // on the board.
            const selfKey = `${pos.row},${pos.col}`;
            if (!seen.has(selfKey)) {
                affected.push({ row: pos.row, col: pos.col });
            }
            break;
        }
    }

    return affected;
}

// ===== SPECIAL TILE SCORING =====

export function calculateSpecialTileScore(type: SpecialTileType, tilesCleared: number): number {
    switch (type) {
        case "bomb":
            return 500 + (tilesCleared * 50);
        case "cosmic_blast":
            return 1000 + (tilesCleared * 75);
        case "vibestreak":
            return 750 + (tilesCleared * 60);
    }
}

// ===== GRAVITY & FILL =====

export function applyGravity(
    board: Cell[][],
    gameBadges: Badge[],
    /**
     * Badge ids to exclude from new-tile generation for this single
     * gravity cycle. Used after a cosmic_blast detonates: the player
     * cleared every tile of that pin type, and the documented behavior
     * is that they're all gone. Without this, gravity would refill
     * empty cells with random badges including the just-cleared type,
     * leaving new tiles of "that pin type" on the board and breaking
     * the cosmic-blast feel. Only applies to the immediate post-blast
     * refill; subsequent cascades repopulate normally.
     */
    excludedBadgeIds?: Set<string>,
    /**
     * Per-game RNG threaded from createInitialState. When supplied,
     * tile refills draw deterministically from the seeded sequence so
     * replays can reproduce the exact tile drops. When undefined,
     * falls back to Math.random for backwards compatibility with
     * legacy callers (DemoClient + any in-flight game whose GameState
     * predates the rng field).
     */
    rng?: Rng
): Cell[][] {
    // Snapshot the badge that WAS at each cell before clearing. Used to
    // prevent gravity from refilling a just-cleared cell with the same
    // badge that was sitting there — without this, bombs and lasers
    // visibly "miss" 1-3 cells per detonation because of random refill
    // collision (1/6 chance per cell). Captured before the new-board
    // copy because the matched flag is what tells us which cells need
    // fresh tiles.
    const previousBadgeAtCell: (string | undefined)[][] = board.map(row =>
        row.map(cell => (cell.isMatched ? cell.badge.id : undefined)),
    );
    // Use the per-game RNG (or Math.random fallback) so the same seed
    // produces the same refill sequence across live play and server
    // replay.
    const r: Rng = rng ?? Math.random;
    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    // Filter the refill pool. Falls back to the full pool if filtering
    // would leave us with nothing to draw from (defensive — shouldn't
    // happen in practice with 6 game badges and at most 1-2 exclusions
    // per cycle).
    const refillPool = excludedBadgeIds && excludedBadgeIds.size > 0
        ? gameBadges.filter(b => !excludedBadgeIds.has(b.id))
        : gameBadges;
    const effectivePool = refillPool.length > 0 ? refillPool : gameBadges;

    for (let col = 0; col < BOARD_SIZE; col++) {
        // Collect non-matched tiles from bottom to top, tracking original rows
        const remaining: { cell: Cell; originalRow: number }[] = [];
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (!newBoard[row][col].isMatched) {
                remaining.push({ cell: newBoard[row][col], originalRow: row });
            }
        }

        const numNewTiles = BOARD_SIZE - remaining.length;

        // Fill from bottom
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            const idx = BOARD_SIZE - 1 - row;
            if (idx < remaining.length) {
                const { cell, originalRow } = remaining[idx];
                const drop = row - originalRow; // how many rows this tile fell
                newBoard[row][col] = { ...cell, isNew: false, dropDistance: drop > 0 ? drop : 0 };
            } else {
                // Per-cell exclusion: skip the badge that was at this
                // exact cell before clearing, so the player visually
                // perceives that the cell did in fact change. Falls
                // back to the full pool if exclusion leaves nothing.
                const previousBadgeId = previousBadgeAtCell[row][col];
                const cellPool = previousBadgeId
                    ? effectivePool.filter(b => b.id !== previousBadgeId)
                    : effectivePool;
                const pickFrom = cellPool.length > 0 ? cellPool : effectivePool;
                const badge = pickFrom[Math.floor(r() * pickFrom.length)];
                // New tiles enter from above: distance = their target row + 1
                // (relative to the top of the visible board)
                newBoard[row][col] = {
                    badge,
                    id: nextCellId(),
                    isNew: true,
                    dropDistance: numNewTiles,
                };
            }
        }
    }

    return newBoard;
}

/**
 * Scan a freshly matched-marked board for cosmic_blast cells that are about
 * to be cleared. Their cosmicTargetBadgeId gets passed to applyGravity so
 * the immediate refill excludes those badge types — keeping the cosmic
 * blast's "clears every tile of that pin type" promise visually intact.
 *
 * Detection key: a matched cell that still carries cosmicTargetBadgeId.
 * Only cosmic_blast specials ever set that field, so this catches every
 * cosmic blast that detonated in the current iteration without needing
 * to thread state through the cascade loop.
 */
function collectCosmicTargetsFromMatched(board: Cell[][]): Set<string> {
    const targets = new Set<string>();
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = board[r][c];
            if (cell.isMatched && cell.cosmicTargetBadgeId) {
                targets.add(cell.cosmicTargetBadgeId);
            }
        }
    }
    return targets;
}

// ===== SCORING =====

export function calculateMatchScore(
    matches: Match[],
    combo: number
): number {
    let total = 0;

    for (const match of matches) {
        const len = match.positions.length;
        let baseScore: number;

        if (len === 3) baseScore = 150;
        else if (len === 4) baseScore = 450;
        else baseScore = 900;

        // Apply tier multiplier (use the highest tier in the match)
        const tierMultiplier = match.badge.pointMultiplier;

        // Apply combo multiplier (1.0x per combo level — deep cascades pay big).
        // Bumped from 0.75x alongside the base-score increase to make skilled
        // chain play feel meaningfully more rewarding than baseline matching.
        const comboMultiplier = 1 + (combo * 1.0);

        total += Math.floor(baseScore * tierMultiplier * comboMultiplier);
    }

    return total;
}

// ===== GAME OVER CHECK =====

export function hasValidMoves(board: Cell[][]): boolean {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            // Try swapping right
            if (col < BOARD_SIZE - 1) {
                const testBoard = swapTiles(board, { row, col }, { row, col: col + 1 });
                if (findAllMatches(testBoard).length > 0) return true;
            }
            // Try swapping down
            if (row < BOARD_SIZE - 1) {
                const testBoard = swapTiles(board, { row, col }, { row: row + 1, col });
                if (findAllMatches(testBoard).length > 0) return true;
            }
        }
    }
    return false;
}

// ===== HINT =====

export interface HintResult {
    pos1: Position;
    pos2: Position;
}

export function findBestHint(board: Cell[][]): HintResult | null {
    let bestHint: HintResult | null = null;
    let bestScore = 0;

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const trySwap = (pos2: Position) => {
                const testBoard = swapTiles(board, { row, col }, pos2);
                const matches = findAllMatches(testBoard);
                if (matches.length > 0) {
                    const score = matches.reduce((s, m) => s + m.positions.length, 0);
                    if (score > bestScore) {
                        bestScore = score;
                        bestHint = { pos1: { row, col }, pos2 };
                    }
                }
            };
            if (col < BOARD_SIZE - 1) trySwap({ row, col: col + 1 });
            if (row < BOARD_SIZE - 1) trySwap({ row: row + 1, col });
        }
    }

    return bestHint;
}

// ===== PROCESS TURN =====

export interface TurnResult {
    board: Cell[][];
    scoreGained: number;
    matchesFound: Match[];
    combo: number;
    comboCarry: number;
    // `isInitial` is true only for specials produced by the player's
    // own match (first iteration of the cascade loop). Cascade-side-effect
    // specials — e.g. a 6-in-a-row that randomly forms when bomb-cleared
    // cells get filled with fresh tiles — get `isInitial: false` so FTUE
    // hints don't fire for moves the player didn't actually make.
    specialTilesCreated: { pos: Position; type: SpecialTileType; isInitial: boolean }[];
    specialTilesTriggered: { pos: Position; type: SpecialTileType }[];
    cascadeCount: number;
    shapeBonus: ShapeBonus;
}

export function processTurn(
    board: Cell[][],
    pos1: Position,
    pos2: Position,
    gameBadges: Badge[],
    comboCarryIn: number = 0,
    rng?: Rng
): TurnResult | null {
    // Swap tiles
    let currentBoard = swapTiles(board, pos1, pos2);

    // Check for matches
    const initialMatches = findAllMatches(currentBoard);
    if (initialMatches.length === 0) {
        return null; // Invalid move — no match formed
    }

    let totalScore = 0;
    // Start combo from carried-over value (cross-turn momentum)
    let combo = comboCarryIn;
    let totalMatches: Match[] = [];
    const specialTilesCreated: { pos: Position; type: SpecialTileType; isInitial: boolean }[] = [];
    const specialTilesTriggered: { pos: Position; type: SpecialTileType }[] = [];
    let cascadeCount = 0;

    // Geometric shape bonus — picks the BEST shape (cross > T > L by
    // multiplier) across every cascade iteration, not just the initial
    // post-swap matches. Cascade-formed shapes were previously invisible
    // here, which made Cross That Off / Shape Trifecta effectively
    // unachievable: forming a true cross from a direct swap requires
    // the swap to be the center of an already-near-complete + pattern,
    // which is vanishingly rare. Most crosses players actually see on
    // the board form when gravity drops cosmics into a + arrangement
    // mid-cascade — counting those gives the shape system its
    // intended hit rate.
    let shapeBonus: ShapeBonus = null;

    // Track which positions have pending specials (prevents overwrites)
    const pendingSpecials = new Map<string, SpecialTileType>();

    // Process cascades (cap at 50 to prevent infinite loops from 2x2 gravity fills)
    const MAX_CASCADES = 50;
    let matches = initialMatches;
    while (matches.length > 0 && cascadeCount < MAX_CASCADES) {
        totalMatches = [...totalMatches, ...matches];

        // Detect shapes on THIS iteration's matches. Keep the best across
        // the whole turn — players get the highest-tier shape they
        // happen to form, regardless of whether it was the direct swap
        // or a refill cascade.
        const iterShape = detectShapes(matches);
        if (iterShape && (!shapeBonus || iterShape.multiplier > shapeBonus.multiplier)) {
            shapeBonus = iterShape;
        }

        // Determine which specials to create from this iteration's matches.
        // Store them by a stable cell ID so they survive gravity shifts.
        // We also track sourceBadge so cosmic_blast knows which badge type
        // to clear on detonation (the type the player just matched).
        const iterationSpecials: { cellId: string; type: SpecialTileType; sourceBadge: Badge }[] = [];
        for (const match of matches) {
            const specialType = getSpecialTileForMatch(match);
            if (specialType) {
                const midIdx = Math.floor(match.positions.length / 2);
                const midPos = match.positions[midIdx];
                const cellId = currentBoard[midPos.row][midPos.col].id;
                // Only keep the highest-tier special per cell
                const posKey = `${midPos.row},${midPos.col}`;
                if (!pendingSpecials.has(posKey)) {
                    iterationSpecials.push({ cellId, type: specialType, sourceBadge: match.badge });
                    pendingSpecials.set(posKey, specialType);
                    // cascadeCount === 0 → this iteration is processing the
                    // player's initial swap match; anything later is a
                    // cascade side-effect.
                    specialTilesCreated.push({ pos: midPos, type: specialType, isInitial: cascadeCount === 0 });
                }
            }
        }

        // Score this cascade
        totalScore += calculateMatchScore(matches, combo);
        combo++;

        // Mark matched tiles
        const matchedPositions = new Set<string>();
        for (const match of matches) {
            for (const pos of match.positions) {
                matchedPositions.add(`${pos.row},${pos.col}`);
            }
        }

        // Check for special tile activations in matched cells (pre-existing specials)
        // Use a queue to handle chain reactions (special triggers another special)
        const detonationQueue = [...matchedPositions];
        const detonated = new Set<string>();
        while (detonationQueue.length > 0) {
            const posKey = detonationQueue.shift()!;
            if (detonated.has(posKey)) continue;
            const [r, c] = posKey.split(",").map(Number);
            const cell = currentBoard[r][c];
            if (cell.isSpecial) {
                detonated.add(posKey);
                specialTilesTriggered.push({ pos: { row: r, col: c }, type: cell.isSpecial });
                const affected = applySpecialTile(currentBoard, { row: r, col: c }, cell.isSpecial);
                for (const aPos of affected) {
                    const aKey = `${aPos.row},${aPos.col}`;
                    matchedPositions.add(aKey);
                    // If the affected cell also has a special, queue it for chain detonation
                    if (!detonated.has(aKey) && currentBoard[aPos.row]?.[aPos.col]?.isSpecial) {
                        detonationQueue.push(aKey);
                    }
                }
                totalScore += calculateSpecialTileScore(cell.isSpecial, affected.length);
            }
        }

        // Track where specials should be placed (by position before gravity).
        // We record the row/col of each special so we can place it on the
        // NEW cell that fills that position after gravity.
        const specialPlacements: { row: number; col: number; type: SpecialTileType; sourceBadge: Badge }[] = [];
        for (const special of iterationSpecials) {
            // Find the current position of this cell
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (currentBoard[r][c].id === special.cellId) {
                        specialPlacements.push({ row: r, col: c, type: special.type, sourceBadge: special.sourceBadge });
                    }
                }
            }
        }

        // Remove ALL matched tiles (including those earning specials — full gravity fill)
        currentBoard = currentBoard.map((row, r) =>
            row.map((cell, c) => {
                if (matchedPositions.has(`${r},${c}`)) {
                    return { ...cell, isMatched: true, isSpecial: undefined };
                }
                return { ...cell, isMatched: false };
            })
        );

        // Apply gravity and fill. Exclude any badge types whose cosmic
        // blast just detonated, so the refill doesn't sneak the just-
        // cleared type back onto the board.
        const cosmicTargetsThisIter = collectCosmicTargetsFromMatched(currentBoard);
        currentBoard = applyGravity(currentBoard, gameBadges, cosmicTargetsThisIter, rng);

        // Place specials on the cells that now occupy the original positions.
        // After gravity, these positions have new tiles — assign the special to them.
        // Pick a badge that does NOT form an immediate 3-in-a-row at the special's
        // position so the special isn't eaten in the next cascade iteration.
        // (It can still be matched deliberately on a later turn.)
        for (const sp of specialPlacements) {
            if (sp.row < BOARD_SIZE && sp.col < BOARD_SIZE) {
                const currentCell = currentBoard[sp.row][sp.col];
                let chosenBadge = currentCell.badge;
                if (wouldFormMatchAt(currentBoard, sp.row, sp.col, chosenBadge.id)) {
                    // Try the other game badges until one doesn't form a match.
                    for (const candidate of gameBadges) {
                        if (candidate.id === chosenBadge.id) continue;
                        if (!wouldFormMatchAt(currentBoard, sp.row, sp.col, candidate.id)) {
                            chosenBadge = candidate;
                            break;
                        }
                    }
                }
                currentBoard[sp.row][sp.col] = {
                    ...currentCell,
                    badge: chosenBadge,
                    isSpecial: sp.type,
                    isMatched: false,
                    // Cosmic Blast: remember the source match's badge so
                    // detonation clears that type, regardless of what the
                    // visible (non-conflicting) badge ended up being.
                    cosmicTargetBadgeId: sp.type === "cosmic_blast" ? sp.sourceBadge.id : undefined,
                };
            }
        }

        // Check for new matches from cascade.
        matches = findAllMatches(currentBoard);

        // Also check if any newly-placed specials are part of the new matches
        // and trigger them immediately in the next iteration
        if (matches.length > 0) cascadeCount++;
    }

    // Chain reaction bonus — flat reward for deep cascades
    if (cascadeCount >= 8) totalScore += 2500;
    else if (cascadeCount >= 5) totalScore += 1000;
    else if (cascadeCount >= 3) totalScore += 500;

    // Apply shape bonus multiplier to total score
    if (shapeBonus) {
        totalScore = Math.floor(totalScore * shapeBonus.multiplier);
    }

    // Combo carry: momentum from big combos persists across turns
    const comboCarryOut = combo >= 5 ? 3 : combo >= 4 ? 2 : combo >= 3 ? 1 : 0;

    return {
        board: currentBoard,
        scoreGained: totalScore,
        matchesFound: totalMatches,
        combo,
        comboCarry: comboCarryOut,
        specialTilesCreated,
        specialTilesTriggered,
        cascadeCount,
        shapeBonus,
    };
}

// ===== TRIGGER SPECIAL TILE (click-to-activate) =====

export function triggerSpecialTile(
    board: Cell[][],
    pos: Position,
    gameBadges: Badge[],
    rng?: Rng
): TurnResult | null {
    const cell = board[pos.row][pos.col];
    if (!cell.isSpecial) return null;

    let currentBoard = board.map(row => row.map(c => ({ ...c })));
    const specialType = cell.isSpecial;

    // Get affected positions
    const affected = applySpecialTile(currentBoard, pos, specialType);

    // Mark affected tiles as matched
    const matchedPositions = new Set<string>();
    for (const aPos of affected) {
        matchedPositions.add(`${aPos.row},${aPos.col}`);
    }
    // Also clear the special tile itself
    matchedPositions.add(`${pos.row},${pos.col}`);

    // Chain: any special tile caught in the blast also activates
    const chainedSpecials = new Set<string>([`${pos.row},${pos.col}`]);
    const specialTilesTriggered: { pos: Position; type: SpecialTileType }[] = [
        { pos, type: specialType },
    ];
    for (const posKey of matchedPositions) {
        const [r, c] = posKey.split(",").map(Number);
        const affectedCell = currentBoard[r][c];
        const key = `${r},${c}`;
        if (affectedCell.isSpecial && !chainedSpecials.has(key)) {
            chainedSpecials.add(key);
            specialTilesTriggered.push({ pos: { row: r, col: c }, type: affectedCell.isSpecial });
            const chainAffected = applySpecialTile(currentBoard, { row: r, col: c }, affectedCell.isSpecial);
            for (const chainPos of chainAffected) {
                matchedPositions.add(`${chainPos.row},${chainPos.col}`);
            }
        }
    }

    // Score: initial special + all chained specials
    let totalScore = calculateSpecialTileScore(specialType, affected.length);
    for (const key of chainedSpecials) {
        if (key === `${pos.row},${pos.col}`) continue; // already scored above
        const [r, c] = key.split(",").map(Number);
        const chainedCell = currentBoard[r][c];
        if (chainedCell.isSpecial) {
            const chainAffected = applySpecialTile(currentBoard, { row: r, col: c }, chainedCell.isSpecial);
            totalScore += calculateSpecialTileScore(chainedCell.isSpecial, chainAffected.length);
        }
    }
    let combo = 1;
    let cascadeCount = 0;

    // Remove matched tiles
    currentBoard = currentBoard.map((row, r) =>
        row.map((c, col) => ({
            ...c,
            isMatched: matchedPositions.has(`${r},${col}`),
            isSpecial: matchedPositions.has(`${r},${col}`) ? undefined : c.isSpecial,
        }))
    );

    // Apply gravity. Exclude any cosmic blast targets that were part of
    // the initial detonation — see collectCosmicTargetsFromMatched.
    const initialCosmicTargets = collectCosmicTargetsFromMatched(currentBoard);
    currentBoard = applyGravity(currentBoard, gameBadges, initialCosmicTargets, rng);

    // Process any resulting cascades
    const MAX_CASCADES = 50;
    let matches = findAllMatches(currentBoard);
    while (matches.length > 0 && cascadeCount < MAX_CASCADES) {
        combo++;
        cascadeCount++;
        totalScore += calculateMatchScore(matches, combo);

        const cascadeMatched = new Set<string>();
        for (const match of matches) {
            for (const p of match.positions) {
                cascadeMatched.add(`${p.row},${p.col}`);
            }
        }

        // Check special tile activations in cascade
        const cascadeDetonated = new Set<string>();
        for (const posKey of cascadeMatched) {
            const [r, c] = posKey.split(",").map(Number);
            if (currentBoard[r][c].isSpecial && !cascadeDetonated.has(posKey)) {
                cascadeDetonated.add(posKey);
                specialTilesTriggered.push({ pos: { row: r, col: c }, type: currentBoard[r][c].isSpecial! });
                const chainAffected = applySpecialTile(currentBoard, { row: r, col: c }, currentBoard[r][c].isSpecial!);
                for (const chainPos of chainAffected) {
                    cascadeMatched.add(`${chainPos.row},${chainPos.col}`);
                }
                totalScore += calculateSpecialTileScore(currentBoard[r][c].isSpecial!, chainAffected.length);
            }
        }

        currentBoard = currentBoard.map((row, r) =>
            row.map((c, col) => ({
                ...c,
                isMatched: cascadeMatched.has(`${r},${col}`),
            }))
        );

        // Same exclusion pattern for cascade gravity calls.
        const cascadeCosmicTargets = collectCosmicTargetsFromMatched(currentBoard);
        currentBoard = applyGravity(currentBoard, gameBadges, cascadeCosmicTargets, rng);
        matches = findAllMatches(currentBoard);
    }

    // Build a synthetic match for effects — include all cleared positions
    const allAffected = Array.from(matchedPositions).map(k => {
        const [r, c] = k.split(",").map(Number);
        return { row: r, col: c };
    });
    const syntheticMatch: Match = {
        positions: allAffected,
        badge: cell.badge,
        isHorizontal: true,
    };

    // Combo carry: momentum from big combos persists across turns
    const comboCarryOut = combo >= 5 ? 3 : combo >= 4 ? 2 : combo >= 3 ? 1 : 0;

    return {
        board: currentBoard,
        scoreGained: totalScore,
        matchesFound: [syntheticMatch],
        combo,
        comboCarry: comboCarryOut,
        specialTilesCreated: [],
        specialTilesTriggered,
        cascadeCount,
        shapeBonus: null,
    };
}

// ===== PHASE 3 REPLAY =====
// Pure server-side game reconstruction. Given the same inputs the
// client built its game from — mode, seed, optional drafted badges —
// plus the moveSequence the client persisted, replay the engine
// deterministically and return the canonical score + per-game stats.
//
// `/api/scores` POST loads (matchToken.seed, matchstats.moveSequence)
// from KV and runs this against the engine that the live client also
// uses, so any score / stat discrepancy is a forgery or a bug, not
// a replay-vs-live divergence.

export interface ReplayInputs {
    mode: GameMode;
    /** Seed used by createInitialState. Required for Classic / Frenzy
     *  matches; optional for Daily (engine derives from date). */
    seed?: number;
    /** Vibe Draft selections, when applicable. Passed through to
     *  createInitialState so the same gameBadges array gets built. */
    draftedBadges?: Badge[];
    /** The deterministic player-action log persisted alongside the
     *  match (replay:<user>:<matchId>.moveSequence). */
    moves: MoveAction[];
}

export interface ReplayResult {
    /** Final score after replaying every move. The leaderboard value
     *  that the server compares against the client's submitted score. */
    finalScore: number;
    /** Stats that mirror what the client accumulates into
     *  matchstats:<user>:<matchId>. Used by behavioral guardrails. */
    maxCombo: number;
    matchCount: number;
    totalCascades: number;
    bombsCreated: number;
    vibestreaksCreated: number;
    cosmicBlastsCreated: number;
    crossCount: number;
    shapesLanded: { type: string; count: number }[];
    /** How many moves we actually consumed (invalid swaps are skipped
     *  with no state change, matching the live client). Useful for
     *  spotting truncation / mid-game disconnects. */
    movesConsumed: number;
}

/**
 * Replays a moveSequence against a fresh initial state, returning the
 * canonical score + per-game stats.
 *
 * Mirrors the per-turn logic the client runs in useGame.applyResultState
 * (and applyResult for tap-activated specials), minus all the visual /
 * audio side effects. The engine functions called here — processTurn,
 * triggerSpecialTile — are the same ones the live client uses, so
 * given identical inputs they produce identical outputs.
 */
export function replayMoveSequence(opts: ReplayInputs): ReplayResult {
    const initial = createInitialState(opts.mode, opts.draftedBadges, opts.seed);
    let board = initial.board;
    const gameBadges = initial.gameBadges;
    let movesLeft = initial.movesLeft;
    let comboCarry = 0;
    // Critical for determinism: pull the same per-game RNG createInitialState
    // built and thread it through every engine call. Without this, tile
    // refills inside applyGravity diverge from the live game and the
    // replay scores ~5-50× lower than what was actually played (which is
    // exactly the false-positive pattern shadow mode was surfacing).
    const rng = initial.rng;

    let finalScore = 0;
    let maxCombo = 0;
    let matchCount = 0;
    let totalCascades = 0;
    let bombsCreated = 0;
    let vibestreaksCreated = 0;
    let cosmicBlastsCreated = 0;
    let crossCount = 0;
    const shapesMap = new Map<'L' | 'T' | 'cross', number>();
    let movesConsumed = 0;

    for (const move of opts.moves) {
        let result: TurnResult | null = null;

        if (move.kind === 'swap') {
            // Adjacency / format are validated by the route before this
            // function is called, so we trust the move shape here.
            result = processTurn(board, move.from, move.to, gameBadges, comboCarry, rng);
        } else if (move.kind === 'tap') {
            result = triggerSpecialTile(board, move.at, gameBadges, rng);
        }

        // Invalid swap (no match formed) or tap on a non-special cell —
        // engine returns null, client's behavior is "no move consumed,
        // bounce-back animation." Mirror that here.
        if (!result) continue;

        board = result.board;
        finalScore += result.scoreGained;
        comboCarry = result.comboCarry;
        if (result.combo > maxCombo) maxCombo = result.combo;
        matchCount += result.matchesFound.length;
        totalCascades += result.cascadeCount;

        for (const s of result.specialTilesCreated) {
            if (s.type === 'bomb') bombsCreated++;
            else if (s.type === 'vibestreak') vibestreaksCreated++;
            else if (s.type === 'cosmic_blast') cosmicBlastsCreated++;
        }

        if (result.shapeBonus?.type) {
            const t = result.shapeBonus.type;
            shapesMap.set(t, (shapesMap.get(t) || 0) + 1);
            if (t === 'cross') crossCount++;
        }

        movesConsumed++;
        // Classic / Daily are move-capped; Frenzy (when merged) is time-
        // capped and can produce 150+ moves in a god run. We use a
        // string-typed mode set so this compiles on both `main` (which
        // has only classic | daily) and the Frenzy feature branch.
        const moveCappedModes: string[] = ['classic', 'daily'];
        if (moveCappedModes.includes(opts.mode as string)) {
            movesLeft--;
            if (movesLeft <= 0) break;
        }
    }

    return {
        finalScore,
        maxCombo,
        matchCount,
        totalCascades,
        bombsCreated,
        vibestreaksCreated,
        cosmicBlastsCreated,
        crossCount,
        shapesLanded: Array.from(shapesMap.entries()).map(([type, count]) => ({ type, count })),
        movesConsumed,
    };
}
