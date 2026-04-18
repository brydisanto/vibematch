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
}

export type SpecialTileType = "bomb" | "vibestreak" | "cosmic_blast";

export interface Match {
    positions: Position[];
    badge: Badge;
    isHorizontal: boolean;
}

export type GameMode = "classic" | "daily";

export type GameOverReason = "moves_exhausted" | "no_valid_moves" | null;

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
}

const BOARD_SIZE = 8;
const CLASSIC_MOVES = 30;

let cellIdCounter = 0;
function nextCellId(): string {
    return `cell_${cellIdCounter++}`;
}

// ===== BOARD CREATION =====

export function createInitialState(mode: GameMode, draftedBadges?: Badge[]): GameState {
    const seed = mode === "daily" ? getDailySeed() : undefined;
    const gameBadges = draftedBadges ?? selectGameBadges(6, seed);

    const board = createBoard(gameBadges, seed);

    return {
        board,
        score: 0,
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
        dailySeed: seed,
        gameOverReason: null,
        bonusCapsuleAwarded: false,
    };
}

export function createBoard(badges: Badge[], seed?: number): Cell[][] {
    const rng = seed !== undefined
        ? seededRandom(seed + 1000)
        : Math.random;

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
            // Clear all tiles of the same badge type
            const targetBadge = board[pos.row][pos.col].badge.id;
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (board[r][c].badge.id === targetBadge) {
                        affected.push({ row: r, col: c });
                    }
                }
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
    gameBadges: Badge[]
): Cell[][] {
    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));

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
                // Generate new tile — drops from above the board
                const badge = gameBadges[Math.floor(Math.random() * gameBadges.length)];
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

// ===== SCORING =====

export function calculateMatchScore(
    matches: Match[],
    combo: number
): number {
    let total = 0;

    for (const match of matches) {
        const len = match.positions.length;
        let baseScore: number;

        if (len === 3) baseScore = 100;
        else if (len === 4) baseScore = 300;
        else baseScore = 600;

        // Apply tier multiplier (use the highest tier in the match)
        const tierMultiplier = match.badge.pointMultiplier;

        // Apply combo multiplier (0.75x per combo level — deep cascades are very rewarding)
        const comboMultiplier = 1 + (combo * 0.75);

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
    specialTilesCreated: { pos: Position; type: SpecialTileType }[];
    specialTilesTriggered: { pos: Position; type: SpecialTileType }[];
    cascadeCount: number;
    shapeBonus: ShapeBonus;
}

export function processTurn(
    board: Cell[][],
    pos1: Position,
    pos2: Position,
    gameBadges: Badge[],
    comboCarryIn: number = 0
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
    const specialTilesCreated: { pos: Position; type: SpecialTileType }[] = [];
    const specialTilesTriggered: { pos: Position; type: SpecialTileType }[] = [];
    let cascadeCount = 0;

    // Detect geometric shapes from initial matches
    const shapeBonus = detectShapes(initialMatches);

    // Track which positions have pending specials (prevents overwrites)
    const pendingSpecials = new Map<string, SpecialTileType>();

    // Process cascades (cap at 50 to prevent infinite loops from 2x2 gravity fills)
    const MAX_CASCADES = 50;
    let matches = initialMatches;
    while (matches.length > 0 && cascadeCount < MAX_CASCADES) {
        totalMatches = [...totalMatches, ...matches];

        // Determine which specials to create from this iteration's matches.
        // Store them by a stable cell ID so they survive gravity shifts.
        const iterationSpecials: { cellId: string; type: SpecialTileType }[] = [];
        for (const match of matches) {
            const specialType = getSpecialTileForMatch(match);
            if (specialType) {
                const midIdx = Math.floor(match.positions.length / 2);
                const midPos = match.positions[midIdx];
                const cellId = currentBoard[midPos.row][midPos.col].id;
                // Only keep the highest-tier special per cell
                const posKey = `${midPos.row},${midPos.col}`;
                if (!pendingSpecials.has(posKey)) {
                    iterationSpecials.push({ cellId, type: specialType });
                    pendingSpecials.set(posKey, specialType);
                    specialTilesCreated.push({ pos: midPos, type: specialType });
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
        const specialPlacements: { row: number; col: number; type: SpecialTileType }[] = [];
        for (const special of iterationSpecials) {
            // Find the current position of this cell
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (currentBoard[r][c].id === special.cellId) {
                        specialPlacements.push({ row: r, col: c, type: special.type });
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

        // Apply gravity and fill
        currentBoard = applyGravity(currentBoard, gameBadges);

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
    gameBadges: Badge[]
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

    // Apply gravity
    currentBoard = applyGravity(currentBoard, gameBadges);

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

        currentBoard = applyGravity(currentBoard, gameBadges);
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
