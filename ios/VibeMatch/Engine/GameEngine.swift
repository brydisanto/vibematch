import Foundation

// MARK: - Constants

let BASE_SCORES: [Int: Int] = [
    3: 100,
    4: 300,
    5: 600,
]
// 6+ uses 1000
let BASE_SCORE_6_PLUS = 1000

let TIER_MULTIPLIERS: [BadgeTier: Double] = [
    .blue: 1.0,
    .silver: 1.5,
    .gold: 2.0,
    .cosmic: 3.0,
]

let SHAPE_MULTIPLIERS: [ShapeBonusType: Double] = [
    .L: 1.5,
    .T: 2.5,
    .cross: 4.0,
]

// MARK: - Cell ID Generator

private var cellIdCounter: Int = 0

private func nextCellId() -> String {
    let id = "cell_\(cellIdCounter)"
    cellIdCounter += 1
    return id
}

// MARK: - Board Creation

/// Creates a board with no initial matches. Uses the provided random number generator for determinism.
func createBoard(badges: [Badge], rng: inout any RandomNumberGenerator) -> [[Cell]] {
    var board: [[Cell]] = Array(repeating: [], count: BOARD_SIZE)

    for row in 0..<BOARD_SIZE {
        board[row] = []
        for col in 0..<BOARD_SIZE {
            var badgeIndex: Int
            repeat {
                badgeIndex = Int.random(in: 0..<badges.count, using: &rng)
            } while wouldCreateMatch(board: board, row: row, col: col, badgeIndex: badgeIndex)

            board[row].append(Cell(badgeIndex: badgeIndex, isSpecial: nil, isEmpty: false))
        }
    }

    return board
}

/// Checks whether placing a badge at (row, col) would create a 3-in-a-row match
/// with the already-placed tiles to the left or above.
func wouldCreateMatch(board: [[Cell]], row: Int, col: Int, badgeIndex: Int) -> Bool {
    // Check horizontal: 2 to the left
    if col >= 2 &&
        board[row][col - 1].badgeIndex == badgeIndex &&
        board[row][col - 2].badgeIndex == badgeIndex {
        return true
    }

    // Check vertical: 2 above
    if row >= 2 &&
        board[row - 1][col].badgeIndex == badgeIndex &&
        board[row - 2][col].badgeIndex == badgeIndex {
        return true
    }

    return false
}

// MARK: - Swap

/// Returns true if positions a and b are orthogonally adjacent (no diagonals).
func isAdjacentSwap(_ a: Position, _ b: Position) -> Bool {
    let dr = abs(a.row - b.row)
    let dc = abs(a.col - b.col)
    return (dr == 1 && dc == 0) || (dr == 0 && dc == 1)
}

/// Returns a new board with the tiles at positions a and b swapped.
func swapTiles(board: [[Cell]], _ a: Position, _ b: Position) -> [[Cell]] {
    var newBoard = board
    let temp = newBoard[a.row][a.col]
    newBoard[a.row][a.col] = newBoard[b.row][b.col]
    newBoard[b.row][b.col] = temp
    return newBoard
}

// MARK: - Match Detection

/// Scans the board for all horizontal and vertical matches of 3 or more same-badge tiles.
/// Special tiles are excluded from extending runs.
func findAllMatches(board: [[Cell]], gameBadges: [Badge]) -> [Match] {
    var matches: [Match] = []

    // Horizontal matches
    for row in 0..<BOARD_SIZE {
        var runStart = 0
        for col in 1...BOARD_SIZE {
            if col < BOARD_SIZE &&
                board[row][col].badgeIndex == board[row][runStart].badgeIndex &&
                board[row][col].isSpecial == nil {
                continue
            }

            let runLength = col - runStart
            if runLength >= 3 {
                var positions: [Position] = []
                for c in runStart..<col {
                    positions.append(Position(row: row, col: c))
                }
                matches.append(Match(
                    positions: positions,
                    badge: gameBadges[board[row][runStart].badgeIndex],
                    matchLength: runLength
                ))
            }
            runStart = col
        }
    }

    // Vertical matches
    for col in 0..<BOARD_SIZE {
        var runStart = 0
        for row in 1...BOARD_SIZE {
            if row < BOARD_SIZE &&
                board[row][col].badgeIndex == board[runStart][col].badgeIndex &&
                board[row][col].isSpecial == nil {
                continue
            }

            let runLength = row - runStart
            if runLength >= 3 {
                var positions: [Position] = []
                for r in runStart..<row {
                    positions.append(Position(row: r, col: col))
                }
                matches.append(Match(
                    positions: positions,
                    badge: gameBadges[board[runStart][col].badgeIndex],
                    matchLength: runLength
                ))
            }
            runStart = row
        }
    }

    return matches
}

// MARK: - Shape Detection

/// Detects geometric shapes (L, T, cross) formed by intersecting matches.
/// Returns the highest-multiplier shape found, or nil if none.
func detectShapes(matches: [Match]) -> ShapeBonus? {
    // Determine which matches are horizontal vs vertical by checking positions
    let horizontal = matches.filter { m in
        guard m.positions.count >= 2 else { return false }
        return m.positions[0].row == m.positions[1].row
    }
    let vertical = matches.filter { m in
        guard m.positions.count >= 2 else { return false }
        return m.positions[0].col == m.positions[1].col
    }

    var bestShape: ShapeBonus? = nil

    // Check for L, T, cross shapes from intersecting horizontal and vertical matches
    for h in horizontal {
        for v in vertical {
            // Must be the same badge type
            if h.badge.id != v.badge.id { continue }

            // Find shared positions
            var shared: [Position] = []
            for hp in h.positions {
                for vp in v.positions {
                    if hp.row == vp.row && hp.col == vp.col {
                        shared.append(hp)
                    }
                }
            }

            if shared.count != 1 { continue }
            let sp = shared[0]

            let hFirst = h.positions[0]
            let hLast = h.positions[h.positions.count - 1]
            let vFirst = v.positions[0]
            let vLast = v.positions[v.positions.count - 1]

            let isHEnd = (sp.row == hFirst.row && sp.col == hFirst.col) ||
                         (sp.row == hLast.row && sp.col == hLast.col)
            let isVEnd = (sp.row == vFirst.row && sp.col == vFirst.col) ||
                         (sp.row == vLast.row && sp.col == vLast.col)

            let isHMiddle = !isHEnd
            let isVMiddle = !isVEnd

            let detected: ShapeBonus?
            let allPositions = h.positions + v.positions.filter { vp in
                !(vp.row == sp.row && vp.col == sp.col)
            }

            if isHMiddle && isVMiddle {
                detected = ShapeBonus(type: .cross, multiplier: SHAPE_MULTIPLIERS[.cross]!, positions: allPositions)
            } else if isHMiddle || isVMiddle {
                detected = ShapeBonus(type: .T, multiplier: SHAPE_MULTIPLIERS[.T]!, positions: allPositions)
            } else {
                detected = ShapeBonus(type: .L, multiplier: SHAPE_MULTIPLIERS[.L]!, positions: allPositions)
            }

            if let det = detected {
                if bestShape == nil || det.multiplier > bestShape!.multiplier {
                    bestShape = det
                }
            }
        }
    }

    return bestShape
}

// MARK: - Special Tiles

/// Determines what special tile type a match of given length earns.
/// 4-match = bomb, 5-match = vibestreak, 6+ = cosmic_blast. Returns nil for 3-matches.
func getSpecialTileType(for matchLength: Int) -> SpecialTileType? {
    if matchLength == 4 { return .bomb }
    if matchLength == 5 { return .vibestreak }
    if matchLength >= 6 { return .cosmicBlast }
    return nil
}

/// Returns the set of positions affected by activating a special tile at the given position.
/// - bomb: 3x3 area around the position
/// - vibestreak: entire row + entire column
/// - cosmicBlast: all tiles matching the badge type at the position
func applySpecialTile(board: [[Cell]], pos: Position, specialType: SpecialTileType) -> [Position] {
    var affected: [Position] = []

    switch specialType {
    case .bomb:
        // Clear 3x3 area
        for dr in -1...1 {
            for dc in -1...1 {
                let r = pos.row + dr
                let c = pos.col + dc
                if r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE {
                    affected.append(Position(row: r, col: c))
                }
            }
        }

    case .vibestreak:
        // Clear entire row + column
        for c in 0..<BOARD_SIZE {
            affected.append(Position(row: pos.row, col: c))
        }
        for r in 0..<BOARD_SIZE {
            if r != pos.row {
                affected.append(Position(row: r, col: pos.col))
            }
        }

    case .cosmicBlast:
        // Clear all tiles of the same badge type
        let targetBadge = board[pos.row][pos.col].badgeIndex
        for r in 0..<BOARD_SIZE {
            for c in 0..<BOARD_SIZE {
                if board[r][c].badgeIndex == targetBadge {
                    affected.append(Position(row: r, col: c))
                }
            }
        }
    }

    return affected
}

// MARK: - Scoring

/// Calculates score for a set of matches with the current combo level.
/// Base scores: 3-match=100, 4-match=300, 5-match=600, 6+-match=1000.
/// Combo multiplier: 1 + combo * 0.5.
/// Tier multiplier comes from the badge's pointMultiplier.
func calculateMatchScore(matches: [Match], combo: Int) -> Int {
    var total = 0

    for match in matches {
        let len = match.positions.count
        let baseScore: Int
        if len == 3 {
            baseScore = 100
        } else if len == 4 {
            baseScore = 300
        } else if len == 5 {
            baseScore = 600
        } else {
            baseScore = 1000
        }

        let tierMultiplier = match.badge.pointMultiplier
        let comboMultiplier = 1.0 + Double(combo) * 0.5

        total += Int(floor(Double(baseScore) * tierMultiplier * comboMultiplier))
    }

    return total
}

/// Calculates bonus score for activating a special tile.
/// bomb: 500 + cleared*50, cosmic_blast: 1000 + cleared*75, vibestreak: 750 + cleared*60.
func calculateSpecialTileScore(type: SpecialTileType, tilesCleared: Int) -> Int {
    switch type {
    case .bomb:
        return 500 + (tilesCleared * 50)
    case .cosmicBlast:
        return 1000 + (tilesCleared * 75)
    case .vibestreak:
        return 750 + (tilesCleared * 60)
    }
}

// MARK: - Gravity

/// Drops tiles down to fill gaps left by matched tiles, then fills remaining empty cells
/// from the top with new random badges.
/// A cell is considered "matched" (to be removed) if its isEmpty flag is true.
func applyGravity(board: [[Cell]], gameBadges: [Badge], rng: inout any RandomNumberGenerator) -> [[Cell]] {
    var newBoard = board

    for col in 0..<BOARD_SIZE {
        // Collect non-matched tiles from bottom to top
        var remaining: [Cell] = []
        for row in stride(from: BOARD_SIZE - 1, through: 0, by: -1) {
            if !newBoard[row][col].isEmpty {
                remaining.append(newBoard[row][col])
            }
        }

        // Fill from bottom
        for row in stride(from: BOARD_SIZE - 1, through: 0, by: -1) {
            let idx = BOARD_SIZE - 1 - row
            if idx < remaining.count {
                newBoard[row][col] = remaining[idx]
            } else {
                // Generate new tile
                let badgeIndex = Int.random(in: 0..<gameBadges.count, using: &rng)
                newBoard[row][col] = Cell(badgeIndex: badgeIndex, isSpecial: nil, isEmpty: false)
            }
        }
    }

    return newBoard
}

// MARK: - Process Turn

/// The main turn processor. Swaps two tiles, finds matches, applies gravity, and cascades
/// until no more matches are found. Tracks combos with carry-over between turns.
/// Returns nil if the swap does not produce any matches (invalid move).
func processTurn(
    board: [[Cell]],
    pos1: Position,
    pos2: Position,
    gameBadges: [Badge],
    comboCarryIn: Int = 0,
    rng: inout any RandomNumberGenerator
) -> TurnResult? {
    // Swap tiles
    var currentBoard = swapTiles(board: board, pos1, pos2)

    // Check for matches
    let initialMatches = findAllMatches(board: currentBoard, gameBadges: gameBadges)
    if initialMatches.isEmpty {
        return nil // Invalid move -- no match formed
    }

    var totalScore = 0
    // Start combo from carried-over value (cross-turn momentum)
    var combo = comboCarryIn
    var totalMatches: [Match] = []
    var specialTilesCreated: [SpecialTileCreated] = []
    var cascadeCount = 0

    // Detect geometric shapes from initial matches
    let shapeBonus = detectShapes(matches: initialMatches)

    // Process cascades
    var matches = initialMatches
    while !matches.isEmpty {
        totalMatches.append(contentsOf: matches)

        // Check for special tiles to create
        for match in matches {
            if let specialType = getSpecialTileType(for: match.positions.count) {
                let midIdx = match.positions.count / 2
                let specialPos = match.positions[midIdx]
                specialTilesCreated.append(SpecialTileCreated(type: specialType, position: specialPos))
            }
        }

        // Score this cascade
        totalScore += calculateMatchScore(matches: matches, combo: combo)
        combo += 1

        // Mark matched tiles
        var matchedPositions = Set<String>()
        for match in matches {
            for pos in match.positions {
                matchedPositions.insert("\(pos.row),\(pos.col)")
            }
        }

        // Check for special tile activations in matched cells.
        // We must process newly-added positions too (chain reactions), so we use a queue.
        var specialQueue = Array(matchedPositions)
        var specialIdx = 0
        while specialIdx < specialQueue.count {
            let posKey = specialQueue[specialIdx]
            specialIdx += 1
            let parts = posKey.split(separator: ",").map { Int($0)! }
            let r = parts[0]
            let c = parts[1]
            let cell = currentBoard[r][c]
            if let special = cell.isSpecial {
                let affected = applySpecialTile(board: currentBoard, pos: Position(row: r, col: c), specialType: special)
                for aPos in affected {
                    let key = "\(aPos.row),\(aPos.col)"
                    if !matchedPositions.contains(key) {
                        matchedPositions.insert(key)
                        specialQueue.append(key)
                    }
                }
                totalScore += calculateSpecialTileScore(type: special, tilesCleared: affected.count)
            }
        }

        // Remove matched tiles (mark as empty)
        for row in 0..<BOARD_SIZE {
            for col in 0..<BOARD_SIZE {
                if matchedPositions.contains("\(row),\(col)") {
                    currentBoard[row][col] = Cell(badgeIndex: currentBoard[row][col].badgeIndex, isSpecial: nil, isEmpty: true)
                }
            }
        }

        // Apply gravity and fill
        currentBoard = applyGravity(board: currentBoard, gameBadges: gameBadges, rng: &rng)

        // Place special tiles that were earned
        for special in specialTilesCreated {
            if special.position.row < BOARD_SIZE && special.position.col < BOARD_SIZE {
                currentBoard[special.position.row][special.position.col] = Cell(
                    badgeIndex: currentBoard[special.position.row][special.position.col].badgeIndex,
                    isSpecial: special.type,
                    isEmpty: false
                )
            }
        }

        // Check for new matches from cascade
        matches = findAllMatches(board: currentBoard, gameBadges: gameBadges)
        if !matches.isEmpty {
            cascadeCount += 1
        }
    }

    // Apply shape bonus multiplier to total score
    if let shape = shapeBonus {
        totalScore = Int(floor(Double(totalScore) * shape.multiplier))
    }

    // Combo decay: carry over combo minus 1 for next turn, capped at 4
    let comboCarryOut = min(max(combo - 1, 0), 4)

    return TurnResult(
        board: currentBoard,
        matchesFound: totalMatches,
        scoreGained: totalScore,
        combo: combo,
        comboCarry: comboCarryOut,
        cascadeCount: cascadeCount,
        specialTilesCreated: specialTilesCreated,
        shapeBonus: shapeBonus
    )
}

// MARK: - Trigger Special Tile

/// Directly activates a special tile at the given position (click-to-activate).
/// Processes the activation, chains any other special tiles caught in the blast,
/// applies gravity, and cascades. Returns nil if the position has no special tile.
func triggerSpecialTile(
    board: [[Cell]],
    pos: Position,
    gameBadges: [Badge],
    rng: inout any RandomNumberGenerator
) -> TurnResult? {
    let cell = board[pos.row][pos.col]
    guard let specialType = cell.isSpecial else { return nil }

    var currentBoard = board

    // Get affected positions
    let affected = applySpecialTile(board: currentBoard, pos: pos, specialType: specialType)

    // Mark affected tiles as matched
    var matchedPositions = Set<String>()
    for aPos in affected {
        matchedPositions.insert("\(aPos.row),\(aPos.col)")
    }
    // Also clear the special tile itself
    matchedPositions.insert("\(pos.row),\(pos.col)")

    // Check if any affected tiles are also special -- chain them (queue-based for Swift)
    var chainQueue = Array(matchedPositions)
    var chainIdx = 0
    while chainIdx < chainQueue.count {
        let posKey = chainQueue[chainIdx]
        chainIdx += 1
        let parts = posKey.split(separator: ",").map { Int($0)! }
        let r = parts[0]
        let c = parts[1]
        let affectedCell = currentBoard[r][c]
        if let chainSpecial = affectedCell.isSpecial, !(r == pos.row && c == pos.col) {
            let chainAffected = applySpecialTile(board: currentBoard, pos: Position(row: r, col: c), specialType: chainSpecial)
            for chainPos in chainAffected {
                let key = "\(chainPos.row),\(chainPos.col)"
                if !matchedPositions.contains(key) {
                    matchedPositions.insert(key)
                    chainQueue.append(key)
                }
            }
        }
    }

    // Score the special activation
    var totalScore = calculateSpecialTileScore(type: specialType, tilesCleared: affected.count)
    var combo = 1
    var cascadeCount = 0

    // Remove matched tiles
    for row in 0..<BOARD_SIZE {
        for col in 0..<BOARD_SIZE {
            let key = "\(row),\(col)"
            if matchedPositions.contains(key) {
                currentBoard[row][col] = Cell(
                    badgeIndex: currentBoard[row][col].badgeIndex,
                    isSpecial: nil,
                    isEmpty: true
                )
            }
        }
    }

    // Apply gravity
    currentBoard = applyGravity(board: currentBoard, gameBadges: gameBadges, rng: &rng)

    // Process any resulting cascades
    var matches = findAllMatches(board: currentBoard, gameBadges: gameBadges)
    while !matches.isEmpty {
        combo += 1
        cascadeCount += 1
        totalScore += calculateMatchScore(matches: matches, combo: combo)

        var cascadeMatched = Set<String>()
        for match in matches {
            for p in match.positions {
                cascadeMatched.insert("\(p.row),\(p.col)")
            }
        }

        // Check special tile activations in cascade (queue-based for Swift)
        var cascadeQueue = Array(cascadeMatched)
        var cascadeQueueIdx = 0
        while cascadeQueueIdx < cascadeQueue.count {
            let posKey = cascadeQueue[cascadeQueueIdx]
            cascadeQueueIdx += 1
            let parts = posKey.split(separator: ",").map { Int($0)! }
            let r = parts[0]
            let c = parts[1]
            if let cascadeSpecial = currentBoard[r][c].isSpecial {
                let chainAffected = applySpecialTile(board: currentBoard, pos: Position(row: r, col: c), specialType: cascadeSpecial)
                for chainPos in chainAffected {
                    let key = "\(chainPos.row),\(chainPos.col)"
                    if !cascadeMatched.contains(key) {
                        cascadeMatched.insert(key)
                        cascadeQueue.append(key)
                    }
                }
                totalScore += calculateSpecialTileScore(type: cascadeSpecial, tilesCleared: chainAffected.count)
            }
        }

        for row in 0..<BOARD_SIZE {
            for col in 0..<BOARD_SIZE {
                if cascadeMatched.contains("\(row),\(col)") {
                    currentBoard[row][col] = Cell(
                        badgeIndex: currentBoard[row][col].badgeIndex,
                        isSpecial: nil,
                        isEmpty: true
                    )
                }
            }
        }

        currentBoard = applyGravity(board: currentBoard, gameBadges: gameBadges, rng: &rng)
        matches = findAllMatches(board: currentBoard, gameBadges: gameBadges)
    }

    // Build a synthetic match for the activation result
    let syntheticMatch = Match(
        positions: affected,
        badge: gameBadges[cell.badgeIndex],
        matchLength: affected.count
    )

    // Combo decay: carry over combo minus 1 for next turn, capped at 4
    let comboCarryOut = min(max(combo - 1, 0), 4)

    return TurnResult(
        board: currentBoard,
        matchesFound: [syntheticMatch],
        scoreGained: totalScore,
        combo: combo,
        comboCarry: comboCarryOut,
        cascadeCount: cascadeCount,
        specialTilesCreated: [],
        shapeBonus: nil
    )
}

// MARK: - Valid Moves Check

/// Returns true if any valid swap exists on the board that would produce at least one match.
func hasValidMoves(board: [[Cell]], gameBadges: [Badge]) -> Bool {
    for row in 0..<BOARD_SIZE {
        for col in 0..<BOARD_SIZE {
            // Try swapping right
            if col < BOARD_SIZE - 1 {
                let testBoard = swapTiles(board: board, Position(row: row, col: col), Position(row: row, col: col + 1))
                if !findAllMatches(board: testBoard, gameBadges: gameBadges).isEmpty {
                    return true
                }
            }
            // Try swapping down
            if row < BOARD_SIZE - 1 {
                let testBoard = swapTiles(board: board, Position(row: row, col: col), Position(row: row + 1, col: col))
                if !findAllMatches(board: testBoard, gameBadges: gameBadges).isEmpty {
                    return true
                }
            }
        }
    }
    return false
}

// MARK: - Hint

struct HintResult {
    let pos1: Position
    let pos2: Position
}

/// Finds the best available swap by trying all possible adjacent swaps and returning
/// the one that produces the most total matched positions.
func findBestHint(board: [[Cell]], gameBadges: [Badge]) -> HintResult? {
    var bestHint: HintResult? = nil
    var bestScore = 0

    for row in 0..<BOARD_SIZE {
        for col in 0..<BOARD_SIZE {
            let trySwap = { (pos2: Position) in
                let testBoard = swapTiles(board: board, Position(row: row, col: col), pos2)
                let matches = findAllMatches(board: testBoard, gameBadges: gameBadges)
                if !matches.isEmpty {
                    let score = matches.reduce(0) { $0 + $1.positions.count }
                    if score > bestScore {
                        bestScore = score
                        bestHint = HintResult(pos1: Position(row: row, col: col), pos2: pos2)
                    }
                }
            }
            if col < BOARD_SIZE - 1 {
                trySwap(Position(row: row, col: col + 1))
            }
            if row < BOARD_SIZE - 1 {
                trySwap(Position(row: row + 1, col: col))
            }
        }
    }

    return bestHint
}

// MARK: - Initial State

/// Creates a fresh GameState for the given mode with a match-free board.
func createInitialState(mode: GameMode, gameBadges: [Badge], rng: inout any RandomNumberGenerator) -> GameState {
    let board = createBoard(badges: gameBadges, rng: &rng)

    return GameState(
        board: board,
        score: 0,
        movesLeft: CLASSIC_MOVES,
        combo: 0,
        comboCarry: 0,
        maxCombo: 0,
        selectedTile: nil,
        gamePhase: .playing,
        gameMode: mode,
        gameBadges: gameBadges,
        matchCount: 0,
        totalCascades: 0,
        gameOverReason: nil,
        bonusCapsuleAwarded: false
    )
}
