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
        /// Deep cosmic purple matching web: #1a0533
        static let background = SKColor(red: 26/255.0, green: 5/255.0, blue: 51/255.0, alpha: 1)
    }

    // MARK: - Public Properties

    /// The current board state. Setting this triggers a diff-based animated
    /// transition: tiles whose underlying badge changed scale-out + scale-in
    /// (the match/respawn micro-animation) while unchanged tiles stay put.
    /// This is what gives the board its smooth "alive" feel rather than the
    /// snap that happens when textures are swapped synchronously.
    var boardState: [[Cell]] = [] {
        didSet { renderBoard(animated: !oldValue.isEmpty) }
    }

    /// The badges available in the current game session.
    var gameBadges: [Badge] = [] {
        didSet { renderBoard() }
    }

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

    /// Camera node for combo-reactive zoom and shake effects.
    private let cameraNode = SKCameraNode()

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
        // Background stays transparent so the SwiftUI gold-rimmed frame
        // around the SpriteView is what reads as the board surface. Set
        // here for safety in case the host's adapter clears get reset.
        backgroundColor = .clear
        anchorPoint = CGPoint(x: 0.5, y: 0.5)

        // Set up camera for zoom and shake effects
        if camera == nil {
            cameraNode.position = CGPoint(x: 0, y: 0)
            addChild(cameraNode)
            camera = cameraNode
        }

        if boardLayer.parent == nil {
            addChild(boardLayer)
        }
        if effectsLayer.parent == nil {
            effectsLayer.zPosition = 100
            addChild(effectsLayer)
        }

        layoutBoard()
        renderBoard()
    }

    // MARK: - Camera Effects

    /// Zooms the camera based on combo level. Higher combos = tighter zoom.
    /// Smoothly transitions between zoom levels.
    func setCameraZoom(for combo: Int) {
        let targetScale: CGFloat
        switch combo {
        case 0...1:  targetScale = 1.0
        case 2...3:  targetScale = 0.97    // subtle tighten
        case 4...5:  targetScale = 0.94    // noticeable
        default:     targetScale = 0.90    // intense
        }

        cameraNode.removeAction(forKey: "cameraZoom")
        let zoom = SKAction.scale(to: targetScale, duration: 0.4)
        zoom.timingMode = .easeInEaseOut
        cameraNode.run(zoom, withKey: "cameraZoom")
    }

    /// Resets camera zoom back to default.
    func resetCameraZoom() {
        cameraNode.removeAction(forKey: "cameraZoom")
        let reset = SKAction.scale(to: 1.0, duration: 0.6)
        reset.timingMode = .easeInEaseOut
        cameraNode.run(reset, withKey: "cameraZoom")
    }

    // MARK: - Board Entry Cascade

    /// Animates all tiles cascading in from above when the game starts.
    /// Tiles rain in column by column with staggered timing.
    func playBoardEntryCascade(completion: (() -> Void)? = nil) {
        let group = DispatchGroup()

        for col in 0..<Board.cols {
            for row in 0..<Board.rows {
                guard let tile = tileNodes[row][col] else { continue }
                group.enter()

                let originalPos = tile.position
                // Start off-screen above
                tile.position = CGPoint(x: originalPos.x, y: originalPos.y + size.height * 0.6)
                tile.alpha = 0
                tile.setScale(0.8)

                // Stagger: column-first, then row within column
                let delay = Double(col) * 0.06 + Double(row) * 0.03

                let wait = SKAction.wait(forDuration: delay)
                let fadeIn = SKAction.fadeAlpha(to: 1.0, duration: 0.15)
                let scaleUp = SKAction.scale(to: 1.0, duration: 0.3)

                // Drop with spring bounce
                let drop = SKAction.moveTo(y: originalPos.y, duration: 0.35)
                drop.timingMode = .easeIn

                let squash = SKAction.group([
                    SKAction.scaleX(to: 1.08, duration: 0.06),
                    SKAction.scaleY(to: 0.92, duration: 0.06),
                    SKAction.moveTo(y: originalPos.y - 2, duration: 0.06)
                ])
                let spring = SKAction.group([
                    SKAction.scale(to: 1.0, duration: 0.1),
                    SKAction.moveTo(y: originalPos.y, duration: 0.1)
                ])

                tile.run(SKAction.sequence([
                    wait,
                    SKAction.group([fadeIn, scaleUp, drop]),
                    squash,
                    spring
                ])) {
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) {
            completion?()
        }
    }

    // MARK: - Hint Glow

    /// Shows a hint glow on tiles at the given positions.
    func showHintGlow(at positions: [Position]) {
        clearHintGlow()
        for pos in positions {
            tileNode(at: pos)?.playHintGlow()
        }
    }

    /// Clears all hint glow effects.
    func clearHintGlow() {
        for row in 0..<Board.rows {
            for col in 0..<Board.cols {
                tileNodes[row][col]?.removeHintGlow()
            }
        }
    }

    /// Shakes the camera with configurable amplitude and frequency.
    func cameraShake(amplitude: CGFloat, duration: TimeInterval, frequency: TimeInterval = 0.03) {
        cameraNode.removeAction(forKey: "cameraShake")

        let shakeCount = Int(duration / frequency)
        var actions: [SKAction] = []

        for i in 0..<shakeCount {
            let damping = 1.0 - (CGFloat(i) / CGFloat(shakeCount))
            let dx = CGFloat.random(in: -amplitude...amplitude) * damping
            let dy = CGFloat.random(in: -amplitude...amplitude) * damping
            actions.append(SKAction.moveBy(x: dx, y: dy, duration: frequency))
        }
        actions.append(SKAction.move(to: .zero, duration: frequency))

        cameraNode.run(SKAction.sequence(actions), withKey: "cameraShake")
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

    // MARK: - Visual Effects Hooks

    /// Triggers the layered match-feel effects: subtle screen flash for any
    /// match, board shake for mega+, plus a particle burst at the dominant
    /// match position when provided. Called from the SwiftUI host whenever
    /// the session emits a new match intensity.
    func playMatchVisualEffects(
        intensity: EffectIntensity,
        matchedPositions: [Position] = [],
        dominantTier: BadgeTier? = nil,
        at boardPos: Position? = nil
    ) {
        effectsLayer.triggerMatchEffects(intensity: intensity)
        if let pos = boardPos {
            spawnMatchBurst(at: pos, intensity: intensity)
        }

        // Per-matched-tile clear feedback, web parity: the tile itself
        // plays a scale-up burst (match-burst keyframes), a white-hot
        // flash overlays the cell (tile-match-flash), and a tier-tinted
        // mini ring scatters. Fires on the pre-apply board during the
        // session's hit-stop window, so the clear reads before the
        // cascade replaces the tiles.
        let tierColor = dominantTier.map { skColor(hex: $0.colorHex) }
        for pos in matchedPositions {
            playTileClearBurst(at: pos, tint: tierColor)
        }

        // Camera shake on the heavier hits. Mirrors the web board-shake
        // which only fires for mega (0.25s) and ultra (0.4s).
        switch intensity {
        case .mega:
            cameraShake(amplitude: 7, duration: 0.25)
        case .ultra:
            cameraShake(amplitude: 12, duration: 0.4)
        default:
            break
        }
    }

    /// Clear feedback for a single matched cell: node burst + white flash
    /// + tier-tinted mini particles.
    private func playTileClearBurst(at pos: Position, tint: SKColor?) {
        guard isValidPosition(pos), let tile = tileNodes[pos.row][pos.col] else { return }

        // 1. Match-burst on the tile node itself, mirroring web keyframes
        //    scale 1 -> 1.55 (18%) -> 1.2 (45%) -> 0 (100%) over 0.42s.
        //    Idle breathing also animates scale; stop it so they don't fight.
        tile.removeAction(forKey: "idleBreathing")
        tile.removeAction(forKey: "match_burst")
        let up = SKAction.scale(to: 1.55, duration: 0.076)
        up.timingMode = .easeOut
        let mid = SKAction.scale(to: 1.2, duration: 0.113)
        let collapse = SKAction.group([
            SKAction.scale(to: 0.01, duration: 0.231),
            SKAction.fadeAlpha(to: 0.0, duration: 0.231),
        ])
        collapse.timingMode = .easeIn
        tile.run(.sequence([up, mid, collapse]), withKey: "match_burst")

        // 2. White-hot flash on the effects plane above the board,
        //    web tile-match-flash: scale 0.6 -> 1.5 (20%), hold to 55%,
        //    fade to 0.4 by 100% over 0.55s. Survives the tile being
        //    replaced by the refill so the clear stays readable.
        let cellPoint = boardLayer.convert(gridPosition(row: pos.row, col: pos.col), to: self)
        let ts = tileSize
        let flash = SKShapeNode(rectOf: ts, cornerRadius: ts.width * 0.22)
        flash.fillColor = .white
        flash.strokeColor = .clear
        flash.position = cellPoint
        flash.zPosition = 90
        flash.alpha = 0
        flash.setScale(0.6)
        addChild(flash)
        let flashIn = SKAction.group([
            SKAction.scale(to: 1.5, duration: 0.11),
            SKAction.fadeAlpha(to: 1.0, duration: 0.11),
        ])
        flashIn.timingMode = .easeOut
        let hold = SKAction.group([
            SKAction.scale(to: 1.4, duration: 0.19),
            SKAction.fadeAlpha(to: 0.85, duration: 0.19),
        ])
        let flashOut = SKAction.group([
            SKAction.scale(to: 0.4, duration: 0.25),
            SKAction.fadeAlpha(to: 0.0, duration: 0.25),
        ])
        flashOut.timingMode = .easeIn
        flash.run(.sequence([flashIn, hold, flashOut, .removeFromParent()]))

        // 3. Tier-tinted mini ring burst so the player reads WHICH tier
        //    popped without any text (web MatchParticles).
        let color = tint ?? SKColor(red: 1.0, green: 0.95, blue: 0.5, alpha: 1.0)
        for i in 0..<6 {
            let particle = SKShapeNode(circleOfRadius: 3)
            particle.fillColor = color
            particle.strokeColor = .clear
            particle.position = cellPoint
            particle.zPosition = 85
            addChild(particle)
            let angle = (CGFloat(i) / 6.0) * 2 * .pi + .pi / 6
            let dist = CGFloat.random(in: 26...40)
            let target = CGPoint(x: cellPoint.x + cos(angle) * dist,
                                 y: cellPoint.y + sin(angle) * dist)
            let move = SKAction.move(to: target, duration: 0.45)
            move.timingMode = .easeOut
            let fade = SKAction.fadeAlpha(to: 0, duration: 0.45)
            let shrink = SKAction.scale(to: 0.2, duration: 0.45)
            particle.run(.sequence([.group([move, fade, shrink]), .removeFromParent()]))
        }
    }

    /// SKColor from a hex string like "#FFE048" or "FFE048".
    private func skColor(hex: String) -> SKColor {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        var rgb: UInt64 = 0
        Scanner(string: value).scanHexInt64(&rgb)
        return SKColor(
            red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
            green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
            blue: CGFloat(rgb & 0xFF) / 255.0,
            alpha: 1.0
        )
    }

    /// Grid-space position of a cell within boardLayer.
    private func gridPosition(row: Int, col: Int) -> CGPoint {
        let ts = tileSize
        let origin = boardOrigin
        let step = ts.width + tilePadding
        return CGPoint(
            x: origin.x + CGFloat(col) * step,
            y: origin.y - CGFloat(row) * step
        )
    }

    /// Quick 8-particle ring burst at the given board position. Particles
    /// scatter outward and fade over 600ms with intensity-tinted color.
    private func spawnMatchBurst(at pos: Position, intensity: EffectIntensity) {
        guard isValidPosition(pos), let tile = tileNodes[pos.row][pos.col] else { return }
        let origin = boardLayer.convert(tile.position, to: self)

        let palette: [SKColor]
        switch intensity {
        case .normal: palette = [SKColor(red: 1.0, green: 0.95, blue: 0.5, alpha: 1.0)]
        case .big:    palette = [.yellow, SKColor.orange]
        case .mega:   palette = [SKColor.orange, SKColor(red: 1, green: 0.55, blue: 0.18, alpha: 1)]
        case .ultra:  palette = [SKColor(red: 0.70, green: 0.40, blue: 1.0, alpha: 1.0), SKColor(red: 1, green: 0.45, blue: 0.78, alpha: 1)]
        }

        let count = intensity == .ultra ? 16 : (intensity == .mega ? 12 : 8)
        let radiusMax: CGFloat = intensity == .ultra ? 90 : (intensity == .mega ? 70 : 55)

        for i in 0..<count {
            let particle = SKShapeNode(circleOfRadius: 4)
            particle.fillColor = palette[i % palette.count]
            particle.strokeColor = .clear
            particle.position = origin
            particle.zPosition = 80
            addChild(particle)

            let angle = (CGFloat(i) / CGFloat(count)) * 2 * .pi
            let dist = radiusMax * CGFloat.random(in: 0.7...1.0)
            let target = CGPoint(x: origin.x + cos(angle) * dist,
                                 y: origin.y + sin(angle) * dist)

            let move = SKAction.move(to: target, duration: 0.55)
            move.timingMode = .easeOut
            let fade = SKAction.fadeAlpha(to: 0, duration: 0.55)
            let shrink = SKAction.scale(to: 0.3, duration: 0.55)
            let group = SKAction.group([move, fade, shrink])
            particle.run(.sequence([group, .removeFromParent()]))
        }
    }

    // MARK: - Swap Animation

    /// Animates two tile sprites swapping positions over `duration`. Used
    /// when the player initiates a valid swap; the session waits ~250ms
    /// before applying the post-match board so the user actually sees
    /// the swap motion.
    ///
    /// Tile content stays put (we don't reconfigure during the animation);
    /// only the SKNode positions slide. When `boardState` later updates
    /// to the post-match state, the diff-render path takes over.
    func playSwapAnimation(from pos1: Position, to pos2: Position, duration: TimeInterval = 0.24) {
        guard isValidPosition(pos1), isValidPosition(pos2),
              let tileA = tileNodes[pos1.row][pos1.col],
              let tileB = tileNodes[pos2.row][pos2.col] else { return }

        let posA = tileA.position
        let posB = tileB.position

        // Exchange grid ownership immediately: each cell must own the node
        // that ends up sitting at its location, otherwise every later
        // configure() writes content to the wrong visual position and the
        // two cells render each other's tiles from then on.
        tileNodes[pos1.row][pos1.col] = tileB
        tileNodes[pos2.row][pos2.col] = tileA
        // Also resync the badge-id diff cache to follow the exchange.
        let cached1 = lastRenderedBadgeIds[pos1.row][pos1.col]
        lastRenderedBadgeIds[pos1.row][pos1.col] = lastRenderedBadgeIds[pos2.row][pos2.col]
        lastRenderedBadgeIds[pos2.row][pos2.col] = cached1

        let moveA = SKAction.move(to: posB, duration: duration)
        moveA.timingMode = .easeInEaseOut
        let moveB = SKAction.move(to: posA, duration: duration)
        moveB.timingMode = .easeInEaseOut

        // Tiles pop a touch on the way to sell the lift-and-place feel.
        let liftA = SKAction.sequence([
            SKAction.scale(to: 1.08, duration: duration * 0.4),
            SKAction.scale(to: 1.0, duration: duration * 0.6),
        ])
        let liftB = SKAction.sequence([
            SKAction.scale(to: 1.08, duration: duration * 0.4),
            SKAction.scale(to: 1.0, duration: duration * 0.6),
        ])

        tileA.run(SKAction.group([moveA, liftA]))
        tileB.run(SKAction.group([moveB, liftB]))
    }

    /// Plays a bounce animation on two tiles for an invalid swap attempt.
    /// They shift toward each other ~25% then snap back.
    func playInvalidSwap(from pos1: Position, to pos2: Position) {
        guard isValidPosition(pos1), isValidPosition(pos2),
              let tileA = tileNodes[pos1.row][pos1.col],
              let tileB = tileNodes[pos2.row][pos2.col] else { return }
        let dx = (tileB.position.x - tileA.position.x) * 0.25
        let dy = (tileB.position.y - tileA.position.y) * 0.25
        let nudgeA = SKAction.sequence([
            SKAction.moveBy(x: dx, y: dy, duration: 0.10),
            SKAction.moveBy(x: -dx, y: -dy, duration: 0.10),
            SKAction.moveBy(x: dx * 0.4, y: dy * 0.4, duration: 0.06),
            SKAction.moveBy(x: -dx * 0.4, y: -dy * 0.4, duration: 0.06),
        ])
        let nudgeB = SKAction.sequence([
            SKAction.moveBy(x: -dx, y: -dy, duration: 0.10),
            SKAction.moveBy(x: dx, y: dy, duration: 0.10),
            SKAction.moveBy(x: -dx * 0.4, y: -dy * 0.4, duration: 0.06),
            SKAction.moveBy(x: dx * 0.4, y: dy * 0.4, duration: 0.06),
        ])
        tileA.run(nudgeA)
        tileB.run(nudgeB)
    }

    // MARK: - Board Rendering

    /// Tracks the badge id displayed by each tile so we can detect changes
    /// between board updates and animate only the cells that actually
    /// flipped to a different pin.
    private var lastRenderedBadgeIds: [[String]] = Array(
        repeating: Array(repeating: "", count: Board.cols),
        count: Board.rows
    )

    /// Updates all tiles from the current `boardState`. When `animated` is
    /// true and a tile's badge id changed, the tile plays a quick
    /// scale-out + scale-in around the texture swap so swaps and cascade
    /// refills don't feel like a snap-cut.
    private func renderBoard(animated: Bool = false) {
        guard !boardState.isEmpty, !gameBadges.isEmpty else { return }

        for row in 0..<min(Board.rows, boardState.count) {
            for col in 0..<min(Board.cols, boardState[row].count) {
                guard let tile = tileNodes[row][col] else { continue }
                let cell = boardState[row][col]
                guard cell.badgeIndex >= 0, cell.badgeIndex < gameBadges.count else { continue }
                let badge = gameBadges[cell.badgeIndex]

                let prevId = lastRenderedBadgeIds[row][col]
                let changed = prevId != badge.id

                #if DEBUG
                if cell.isSpecial != nil {
                    let path = (animated && changed && cell.dropDistance > 0) ? "drop"
                        : (animated && changed && !prevId.isEmpty) ? "diff"
                        : "direct"
                    print("[renderBoard] special \(cell.isSpecial!.rawValue) at (\(row),\(col)) path=\(path) changed=\(changed) dd=\(cell.dropDistance)")
                }
                #endif

                if animated && changed && cell.dropDistance > 0 {
                    // Gravity drop, web tile-drop parity: the tile starts
                    // dropDistance rows above its cell, falls in 0.195s,
                    // overshoots 3pt past the target, bounces back 2pt,
                    // then settles. New tiles fade 0.85 -> 1 on the way.
                    // Column stagger 0.02s gives the refill a sweep.
                    dropTileIn(tile, cell: cell, badge: badge, row: row, col: col)
                } else if animated && changed && !prevId.isEmpty {
                    // Content changed in place (no fall data): quick
                    // shrink-out, configure, pop-in. Stagger by row so the
                    // change reads top-to-bottom.
                    let delay = TimeInterval(row) * 0.03
                    let shrink = SKAction.scale(to: 0.0, duration: 0.12)
                    shrink.timingMode = .easeIn
                    let configure = SKAction.run { [weak tile] in
                        tile?.configure(cell: cell, badge: badge, row: row, col: col)
                        tile?.resetAppearance()
                        tile?.setScale(0.0)
                        tile?.alpha = 1.0
                    }
                    let pop = SKAction.scale(to: 1.0, duration: 0.18)
                    pop.timingMode = .easeOut
                    let wait = SKAction.wait(forDuration: delay)
                    tile.removeAction(forKey: "match_burst")
                    tile.removeAction(forKey: "diff_swap")
                    tile.run(.sequence([wait, shrink, configure, pop]), withKey: "diff_swap")
                } else {
                    // A still-running clear burst would re-shrink the tile
                    // after resetAppearance restores it; cancel it first.
                    tile.removeAction(forKey: "match_burst")
                    tile.configure(cell: cell, badge: badge, row: row, col: col)
                    tile.resetAppearance()
                }

                lastRenderedBadgeIds[row][col] = badge.id
            }
        }

        // Re-apply selection highlight
        if let sel = selectedPosition {
            tileNodes[sel.row][sel.col]?.setSelected(true)
        }
    }

    /// Drops a tile in from above its cell with the web's bounce profile:
    /// translateY(-drop) -> +3pt overshoot at 65% -> -2pt at 82% -> settle,
    /// 0.3s total, delayed col * 0.02s. Gravity leg accelerates (easeIn).
    private func dropTileIn(_ tile: TileNode, cell: Cell, badge: Badge, row: Int, col: Int) {
        let target = gridPosition(row: row, col: col)
        let step = tileSize.width + tilePadding

        tile.removeAction(forKey: "match_burst")
        tile.removeAction(forKey: "diff_swap")
        tile.removeAction(forKey: "drop")
        tile.configure(cell: cell, badge: badge, row: row, col: col)
        tile.resetAppearance()
        tile.setScale(1.0)
        tile.alpha = cell.isNew ? 0.85 : 1.0
        tile.position = CGPoint(
            x: target.x,
            y: target.y + CGFloat(cell.dropDistance) * step
        )

        let delay = SKAction.wait(forDuration: TimeInterval(col) * 0.02)
        let fall = SKAction.moveTo(y: target.y - 3, duration: 0.195)
        fall.timingMode = .easeIn
        let fadeIn = SKAction.fadeAlpha(to: 1.0, duration: 0.14)
        let bounceUp = SKAction.moveTo(y: target.y + 2, duration: 0.051)
        bounceUp.timingMode = .easeOut
        let settle = SKAction.moveTo(y: target.y, duration: 0.054)
        settle.timingMode = .easeInEaseOut
        tile.run(
            .sequence([delay, .group([fall, fadeIn]), bounceUp, settle]),
            withKey: "drop"
        )
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

        // Anticipatory lean: before swipe threshold, tilt the tile toward drag direction
        let leanThreshold: CGFloat = 6.0
        if absDx >= leanThreshold || absDy >= leanThreshold {
            if absDx > absDy {
                let dc = dx > 0 ? 1 : -1
                tileNode(at: startTile)?.applyLean(toward: Position(row: 0, col: dc))
            } else {
                let dr = dy < 0 ? 1 : -1
                tileNode(at: startTile)?.applyLean(toward: Position(row: dr, col: 0))
            }
        }

        // Check if the drag exceeds the swipe threshold
        guard absDx >= Thresholds.swipe || absDy >= Thresholds.swipe else { return }

        // Clear lean before executing swap
        tileNode(at: startTile)?.applyLean(toward: nil)

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
            // Clear any lean on the start tile
            if let startTile = touchStartTile {
                tileNode(at: startTile)?.applyLean(toward: nil)
            }
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
        if let startTile = touchStartTile {
            tileNode(at: startTile)?.applyLean(toward: nil)
        }
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
