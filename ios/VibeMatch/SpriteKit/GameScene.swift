import SpriteKit

// MARK: - GameSceneDelegate

/// Protocol for the game scene to communicate user interactions back to the
/// game controller / SwiftUI layer.
protocol GameSceneDelegate: AnyObject {
    /// Called when the user taps a tile to select it.
    func didSelectTile(at position: Position)
    /// Called when the user swipes from one tile to an adjacent tile.
    func didSwipeTile(from: Position, to: Position)
}

// MARK: - GameScene

/// The main SpriteKit scene that renders the 8x8 match-3 board.
/// Handles touch input (tap-to-select and swipe gestures) and delegates
/// user actions via `GameSceneDelegate`.
final class GameScene: SKScene {

    // MARK: - Constants

    private enum Board {
        static let rows = 8
        static let cols = 8
    }

    private enum Thresholds {
        /// Minimum distance in points for a swipe to register.
        static let swipe: CGFloat = 18.0
    }

    private enum Colors {
        static let background = SKColor(red: 0x1A/255, green: 0x1A/255, blue: 0x2E/255, alpha: 1)
    }

    // MARK: - Public Properties

    /// The current board state. Setting this triggers a full board re-render.
    var boardState: [[Cell]] = [] {
        didSet { renderBoard() }
    }

    /// The badges available in the current game session.
    var gameBadges: [Badge] = []

    /// The currently selected (highlighted) tile position.
    var selectedPosition: Position? {
        didSet { updateSelectionHighlight(old: oldValue, new: selectedPosition) }
    }

    /// Delegate for user interaction callbacks.
    weak var gameDelegate: GameSceneDelegate?

    // MARK: - Private Properties

    /// Root node for all tile sprites — centered in the scene.
    private let boardLayer = SKNode()

    /// The effects overlay layer for particles and screen effects.
    private let effectsLayer = EffectsLayer()

    /// 2D grid of tile nodes indexed as [row][col].
    private var tileNodes: [[TileNode?]] = Array(
        repeating: Array(repeating: nil, count: Board.cols),
        count: Board.rows
    )

    /// Computed tile size based on current scene dimensions.
    private var tileSize: CGSize {
        let boardDim = min(size.width, size.height) * 0.92
        let padding: CGFloat = 2.0
        let totalPadding = padding * CGFloat(Board.cols - 1)
        let tileDim = (boardDim - totalPadding) / CGFloat(Board.cols)
        return CGSize(width: tileDim, height: tileDim)
    }

    /// Padding between tiles.
    private var tilePadding: CGFloat { 2.0 }

    /// Touch tracking for swipe detection.
    private var touchStartPosition: CGPoint?
    private var touchStartTile: Position?
    private var didRecognizeSwipe: Bool = false

    // MARK: - Scene Lifecycle

    override func didMove(to view: SKView) {
        backgroundColor = Colors.background
        anchorPoint = CGPoint(x: 0.5, y: 0.5)

        if boardLayer.parent == nil {
            addChild(boardLayer)
        }
        if effectsLayer.parent == nil {
            effectsLayer.zPosition = 100
            addChild(effectsLayer)
        }

        layoutBoard()
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        layoutBoard()
        renderBoard()
    }

    // MARK: - Board Layout

    /// Calculates the board origin so tiles are centered in the scene.
    private var boardOrigin: CGPoint {
        let ts = tileSize
        let step = ts.width + tilePadding
        let boardWidth = step * CGFloat(Board.cols) - tilePadding
        let boardHeight = step * CGFloat(Board.rows) - tilePadding
        return CGPoint(
            x: -boardWidth / 2 + ts.width / 2,
            y: boardHeight / 2 - ts.height / 2
        )
    }

    /// Creates or re-positions the tile node grid.
    private func layoutBoard() {
        // Remove existing tile nodes
        boardLayer.removeAllChildren()
        tileNodes = Array(
            repeating: Array(repeating: nil, count: Board.cols),
            count: Board.rows
        )

        let ts = tileSize
        let origin = boardOrigin
        let step = ts.width + tilePadding

        for row in 0..<Board.rows {
            for col in 0..<Board.cols {
                let tile = TileNode(tileSize: ts)
                tile.position = CGPoint(
                    x: origin.x + CGFloat(col) * step,
                    y: origin.y - CGFloat(row) * step
                )
                tile.name = tileName(row: row, col: col)
                boardLayer.addChild(tile)
                tileNodes[row][col] = tile
            }
        }
    }

    // MARK: - Board Rendering

    /// Updates all tiles from the current `boardState`.
    private func renderBoard() {
        guard !boardState.isEmpty else { return }

        for row in 0..<min(Board.rows, boardState.count) {
            for col in 0..<min(Board.cols, boardState[row].count) {
                guard let tile = tileNodes[row][col] else { continue }
                let cell = boardState[row][col]
                let badge = gameBadges[cell.badgeIndex]
                tile.configure(cell: cell, badge: badge, row: row, col: col)
                tile.resetAppearance()
            }
        }

        // Re-apply selection highlight
        if let sel = selectedPosition {
            tileNodes[sel.row][sel.col]?.setSelected(true)
        }
    }

    // MARK: - Selection Highlight

    private func updateSelectionHighlight(old: Position?, new: Position?) {
        if let old = old, isValidPosition(old) {
            tileNodes[old.row][old.col]?.setSelected(false)
        }
        if let new = new, isValidPosition(new) {
            tileNodes[new.row][new.col]?.setSelected(true)
        }
    }

    // MARK: - Touch Handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let location = touch.location(in: boardLayer)

        touchStartPosition = location
        touchStartTile = tilePosition(at: location)
        didRecognizeSwipe = false
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first,
              let startPos = touchStartPosition,
              let startTile = touchStartTile,
              !didRecognizeSwipe else { return }

        let location = touch.location(in: boardLayer)
        let dx = location.x - startPos.x
        let dy = location.y - startPos.y
        let absDx = abs(dx)
        let absDy = abs(dy)

        // Check if the drag exceeds the swipe threshold
        guard absDx >= Thresholds.swipe || absDy >= Thresholds.swipe else { return }

        var targetRow = startTile.row
        var targetCol = startTile.col

        if absDx > absDy {
            // Horizontal swipe
            targetCol += dx > 0 ? 1 : -1
        } else {
            // Vertical swipe (SpriteKit Y is inverted vs screen)
            targetRow += dy < 0 ? 1 : -1
        }

        let targetPosition = Position(row: targetRow, col: targetCol)
        guard isValidPosition(targetPosition) else { return }

        didRecognizeSwipe = true
        gameDelegate?.didSwipeTile(from: startTile, to: targetPosition)

        // Clear touch state
        touchStartPosition = nil
        touchStartTile = nil
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        defer {
            touchStartPosition = nil
            touchStartTile = nil
        }

        // If a swipe was already recognized, do nothing on touch end.
        guard !didRecognizeSwipe else { return }

        guard let startTile = touchStartTile else { return }

        // Tap-to-select logic:
        // - If no tile is selected, select this one.
        // - If the same tile is selected, deselect it.
        // - If an adjacent tile is selected, treat as a swap.
        // - If a non-adjacent tile is selected, re-select this one.
        if let current = selectedPosition {
            if current == startTile {
                // Deselect
                gameDelegate?.didSelectTile(at: startTile)
            } else if isAdjacent(current, startTile) {
                // Swap via tap
                gameDelegate?.didSwipeTile(from: current, to: startTile)
            } else {
                // Re-select new tile
                gameDelegate?.didSelectTile(at: startTile)
            }
        } else {
            // First selection
            gameDelegate?.didSelectTile(at: startTile)
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        touchStartPosition = nil
        touchStartTile = nil
        didRecognizeSwipe = false
    }

    // MARK: - Coordinate Conversion

    /// Converts a point in the board layer's coordinate space to a board Position.
    /// Returns nil if the point is outside the grid.
    private func tilePosition(at point: CGPoint) -> Position? {
        let ts = tileSize
        let origin = boardOrigin
        let step = ts.width + tilePadding

        for row in 0..<Board.rows {
            for col in 0..<Board.cols {
                let tileCenter = CGPoint(
                    x: origin.x + CGFloat(col) * step,
                    y: origin.y - CGFloat(row) * step
                )
                let halfW = ts.width / 2
                let halfH = ts.height / 2
                if point.x >= tileCenter.x - halfW && point.x <= tileCenter.x + halfW &&
                   point.y >= tileCenter.y - halfH && point.y <= tileCenter.y + halfH {
                    return Position(row: row, col: col)
                }
            }
        }
        return nil
    }

    // MARK: - Public Accessors

    /// Returns the tile node at the given board position, if valid.
    func tileNode(at position: Position) -> TileNode? {
        guard isValidPosition(position) else { return nil }
        return tileNodes[position.row][position.col]
    }

    /// Returns the scene-space point for a board position (for positioning effects).
    func pointForPosition(_ position: Position) -> CGPoint {
        guard let tile = tileNode(at: position) else {
            return .zero
        }
        return boardLayer.convert(tile.position, to: self)
    }

    /// Provides access to the effects layer.
    var effects: EffectsLayer {
        return effectsLayer
    }

    // MARK: - Helpers

    private func tileName(row: Int, col: Int) -> String {
        "tile_\(row)_\(col)"
    }

    private func isValidPosition(_ pos: Position) -> Bool {
        pos.row >= 0 && pos.row < Board.rows && pos.col >= 0 && pos.col < Board.cols
    }

    private func isAdjacent(_ a: Position, _ b: Position) -> Bool {
        let dr = abs(a.row - b.row)
        let dc = abs(a.col - b.col)
        return (dr == 1 && dc == 0) || (dr == 0 && dc == 1)
    }
}
