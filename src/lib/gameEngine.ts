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

    // Horizontal matches
    for (let row = 0; row < BOARD_SIZE; row++) {
        let runStart = 0;
        for (let col = 1; col <= BOARD_SIZE; col++) {
            if (
                col < BOARD_SIZE &&
                board[row][col].badge.id === board[row][runStart].badge.id &&
                !board[row][col].isSpecial // Don't match specials in runs
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

    // Vertical matches
    for (let col = 0; col < BOARD_SIZE; col++) {
        let runStart = 0;
        for (let row = 1; row <= BOARD_SIZE; row++) {
            if (
                row < BOARD_SIZE &&
                board[row][col].badge.id === board[runStart][col].badge.id &&
                !board[row][col].isSpecial
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
    if (len === 4) return "bomb";
    if (len === 5) return "vibestreak";
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
        // Collect non-matched tiles from bottom to top
        const remaining: Cell[] = [];
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (!newBoard[row][col].isMatched) {
                remaining.push(newBoard[row][col]);
            }
        }

        // Fill from bottom
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            const idx = BOARD_SIZE - 1 - row;
            if (idx < remaining.length) {
                newBoard[row][col] = remaining[idx];
                newBoard[row][col].isNew = false;
            } else {
                // Generate new tile
                const badge = gameBadges[Math.floor(Math.random() * gameBadges.length)];
                newBoard[row][col] = {
                    badge,
                    id: nextCellId(),
                    isNew: true,
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

        // Apply combo multiplier
        const comboMultiplier = 1 + (combo * 0.5);

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
    let cascadeCount = 0;

    // Detect geometric shapes from initial matches
    const shapeBonus = detectShapes(initialMatches);

    // Process cascades (cap at 50 to prevent infinite loops from 2x2 gravity fills)
    const MAX_CASCADES = 50;
    let matches = initialMatches;
    while (matches.length > 0 && cascadeCount < MAX_CASCADES) {
        totalMatches = [...totalMatches, ...matches];

        // Check for special tiles to create
        for (const match of matches) {
            const specialType = getSpecialTileForMatch(match);
            if (specialType) {
                // Place special tile at the midpoint of the match
                const midIdx = Math.floor(match.positions.length / 2);
                const specialPos = match.positions[midIdx];
                specialTilesCreated.push({ pos: specialPos, type: specialType });
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

        // Check for special tile activations in matched cells
        for (const posKey of matchedPositions) {
            const [r, c] = posKey.split(",").map(Number);
            const cell = currentBoard[r][c];
            if (cell.isSpecial) {
                const affected = applySpecialTile(currentBoard, { row: r, col: c }, cell.isSpecial);
                for (const aPos of affected) {
                    matchedPositions.add(`${aPos.row},${aPos.col}`);
                }
                // Bonus for special activation, scaled by type
                totalScore += calculateSpecialTileScore(cell.isSpecial, affected.length);
            }
        }

        // Remove matched tiles
        currentBoard = currentBoard.map((row, r) =>
            row.map((cell, c) => ({
                ...cell,
                isMatched: matchedPositions.has(`${r},${c}`),
            }))
        );

        // Apply gravity and fill
        currentBoard = applyGravity(currentBoard, gameBadges);

        // Place special tiles that were earned
        for (const special of specialTilesCreated) {
            if (
                special.pos.row < BOARD_SIZE &&
                special.pos.col < BOARD_SIZE
            ) {
                currentBoard[special.pos.row][special.pos.col] = {
                    ...currentBoard[special.pos.row][special.pos.col],
                    isSpecial: special.type,
                };
            }
        }

        // Check for new matches from cascade
        matches = findAllMatches(currentBoard);
        if (matches.length > 0) cascadeCount++;
    }

    // Apply shape bonus multiplier to total score
    if (shapeBonus) {
        totalScore = Math.floor(totalScore * shapeBonus.multiplier);
    }

    // Combo decay: carry over up to 2 for next turn (rewards big cascades without snowballing)
    const comboCarryOut = combo >= 4 ? 2 : combo >= 3 ? 1 : 0;

    return {
        board: currentBoard,
        scoreGained: totalScore,
        matchesFound: totalMatches,
        combo,
        comboCarry: comboCarryOut,
        specialTilesCreated,
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
    for (const posKey of matchedPositions) {
        const [r, c] = posKey.split(",").map(Number);
        const affectedCell = currentBoard[r][c];
        const key = `${r},${c}`;
        if (affectedCell.isSpecial && !chainedSpecials.has(key)) {
            chainedSpecials.add(key);
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
        for (const posKey of cascadeMatched) {
            const [r, c] = posKey.split(",").map(Number);
            if (currentBoard[r][c].isSpecial) {
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

    // Combo decay: carry over up to 2 for next turn (rewards big cascades without snowballing)
    const comboCarryOut = combo >= 4 ? 2 : combo >= 3 ? 1 : 0;

    return {
        board: currentBoard,
        scoreGained: totalScore,
        matchesFound: [syntheticMatch],
        combo,
        comboCarry: comboCarryOut,
        specialTilesCreated: [],
        cascadeCount,
        shapeBonus: null,
    };
}
