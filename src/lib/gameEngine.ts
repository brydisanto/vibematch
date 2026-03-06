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

export interface GameState {
    board: Cell[][];
    score: number;
    movesLeft: number;
    combo: number;
    maxCombo: number;
    selectedTile: Position | null;
    gameBadges: Badge[];
    gameMode: GameMode;
    gamePhase: "playing" | "animating" | "gameover";
    matchCount: number;
    dailySeed?: number;
}

const BOARD_SIZE = 8;
const CLASSIC_MOVES = 30;

let cellIdCounter = 0;
function nextCellId(): string {
    return `cell_${cellIdCounter++}`;
}

// ===== BOARD CREATION =====

export function createInitialState(mode: GameMode): GameState {
    const seed = mode === "daily" ? getDailySeed() : undefined;
    const gameBadges = selectGameBadges(6, seed);
    const board = createBoard(gameBadges, seed);

    return {
        board,
        score: 0,
        movesLeft: CLASSIC_MOVES,
        combo: 0,
        maxCombo: 0,
        selectedTile: null,
        gameBadges,
        gameMode: mode,
        gamePhase: "playing",
        matchCount: 0,
        dailySeed: seed,
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

// ===== SPECIAL TILES =====

export function getSpecialTileForMatch(match: Match): SpecialTileType | null {
    const len = match.positions.length;
    if (len === 4) return "bomb";
    if (len >= 5) return "cosmic_blast";
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

// ===== PROCESS TURN =====

export interface TurnResult {
    board: Cell[][];
    scoreGained: number;
    matchesFound: Match[];
    combo: number;
    specialTilesCreated: { pos: Position; type: SpecialTileType }[];
    cascadeCount: number;
}

export function processTurn(
    board: Cell[][],
    pos1: Position,
    pos2: Position,
    gameBadges: Badge[]
): TurnResult | null {
    // Swap tiles
    let currentBoard = swapTiles(board, pos1, pos2);

    // Check for matches
    const initialMatches = findAllMatches(currentBoard);
    if (initialMatches.length === 0) {
        return null; // Invalid move — no match formed
    }

    let totalScore = 0;
    let combo = 0;
    let totalMatches: Match[] = [];
    const specialTilesCreated: { pos: Position; type: SpecialTileType }[] = [];
    let cascadeCount = 0;

    // Process cascades
    let matches = initialMatches;
    while (matches.length > 0) {
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
                totalScore += 200; // Bonus for special activation
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

    return {
        board: currentBoard,
        scoreGained: totalScore,
        matchesFound: totalMatches,
        combo,
        specialTilesCreated,
        cascadeCount,
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

    // Check if any affected tiles are also special — chain them
    for (const posKey of matchedPositions) {
        const [r, c] = posKey.split(",").map(Number);
        const affectedCell = currentBoard[r][c];
        if (affectedCell.isSpecial && !(r === pos.row && c === pos.col)) {
            const chainAffected = applySpecialTile(currentBoard, { row: r, col: c }, affectedCell.isSpecial);
            for (const chainPos of chainAffected) {
                matchedPositions.add(`${chainPos.row},${chainPos.col}`);
            }
        }
    }

    // Score the special activation
    let totalScore = 200 + (affected.length * 25);
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
    let matches = findAllMatches(currentBoard);
    while (matches.length > 0) {
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
                totalScore += 200;
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

    // Build a synthetic match for effects
    const syntheticMatch: Match = {
        positions: affected,
        badge: cell.badge,
        isHorizontal: true,
    };

    return {
        board: currentBoard,
        scoreGained: totalScore,
        matchesFound: [syntheticMatch],
        combo,
        specialTilesCreated: [],
        cascadeCount,
    };
}
