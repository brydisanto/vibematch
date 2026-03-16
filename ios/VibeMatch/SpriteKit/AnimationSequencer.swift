import SpriteKit

// MARK: - AnimationSequencer

/// Orchestrates multi-step match-3 animations on a GameScene.
/// Each method returns an SKAction or performs an effect on the scene's nodes
/// so the caller can sequence them during game logic (match, clear, gravity, etc.).
final class AnimationSequencer {

    // MARK: - Constants

    private enum Timing {
        static let swapDuration: TimeInterval = 0.25
        static let matchDuration: TimeInterval = 0.30
        static let gravityDuration: TimeInterval = 0.40
        static let invalidSwapDuration: TimeInterval = 0.40
        static let scorePopupDuration: TimeInterval = 1.2
        static let comboBannerDuration: TimeInterval = 1.8
    }

    private enum Colors {
        static let lavender = SKColor(red: 0x6C/255, green: 0x5C/255, blue: 0xE7/255, alpha: 1)
        static let gold     = SKColor(red: 0xFF/255, green: 0xE0/255, blue: 0x48/255, alpha: 1)
        static let orange   = SKColor(red: 0xFF/255, green: 0x5F/255, blue: 0x1F/255, alpha: 1)
        static let cosmic   = SKColor(red: 0xB3/255, green: 0x66/255, blue: 0xFF/255, alpha: 1)
        static let red      = SKColor(red: 1, green: 0.2, blue: 0.2, alpha: 1)
    }

    // MARK: - Properties

    private weak var scene: GameScene?

    // MARK: - Init

    init(scene: GameScene) {
        self.scene = scene
    }

    // MARK: - Swap Animation

    /// Tiles at pos1 and pos2 slide to each other's positions over 250ms.
    func animateSwap(pos1: Position, pos2: Position, completion: @escaping () -> Void) {
        guard let scene = scene,
              let tile1 = scene.tileNode(at: pos1),
              let tile2 = scene.tileNode(at: pos2) else {
            completion()
            return
        }

        let dest1 = tile2.position
        let dest2 = tile1.position

        let move1 = SKAction.move(to: dest1, duration: Timing.swapDuration)
        move1.timingMode = .easeInEaseOut
        let move2 = SKAction.move(to: dest2, duration: Timing.swapDuration)
        move2.timingMode = .easeInEaseOut

        // Bring swapping tiles to front
        tile1.zPosition = 10
        tile2.zPosition = 10

        tile1.run(move1)
        tile2.run(move2) {
            tile1.zPosition = 0
            tile2.zPosition = 0
            completion()
        }
    }

    // MARK: - Match Animation

    /// Matched tiles flash white and scale to 0 over 300ms.
    func animateMatches(positions: [Position], completion: @escaping () -> Void) {
        guard let scene = scene, !positions.isEmpty else {
            completion()
            return
        }

        let group = DispatchGroup()

        for pos in positions {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()
            tile.playMatchAnimation {
                group.leave()
            }
        }

        group.notify(queue: .main) {
            completion()
        }
    }

    // MARK: - Gravity / Drop Animation

    /// Tiles fall from their old row to their new row with a bounce ease over 400ms.
    func animateGravity(drops: [(col: Int, fromRow: Int, toRow: Int)], completion: @escaping () -> Void) {
        guard let scene = scene, !drops.isEmpty else {
            completion()
            return
        }

        let tileHeight = scene.tileNode(at: Position(row: 0, col: 0))?.size.height ?? 40
        let step = tileHeight + 2.0 // tile + padding

        let group = DispatchGroup()

        for drop in drops {
            let pos = Position(row: drop.toRow, col: drop.col)
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()
            tile.playDropAnimation(fromRow: drop.fromRow, toRow: drop.toRow, tileHeight: step) {
                group.leave()
            }
        }

        group.notify(queue: .main) {
            completion()
        }
    }

    // MARK: - Invalid Swap Animation

    /// Tiles slide toward each other then bounce back to their original positions over 400ms.
    func animateInvalidSwap(pos1: Position, pos2: Position, completion: @escaping () -> Void) {
        guard let scene = scene,
              let tile1 = scene.tileNode(at: pos1),
              let tile2 = scene.tileNode(at: pos2) else {
            completion()
            return
        }

        let originalPos1 = tile1.position
        let originalPos2 = tile2.position

        // Move partway toward each other (40% of the distance)
        let midX1 = originalPos1.x + (originalPos2.x - originalPos1.x) * 0.4
        let midY1 = originalPos1.y + (originalPos2.y - originalPos1.y) * 0.4
        let midX2 = originalPos2.x + (originalPos1.x - originalPos2.x) * 0.4
        let midY2 = originalPos2.y + (originalPos1.y - originalPos2.y) * 0.4

        let halfDuration = Timing.invalidSwapDuration / 2

        let moveOut1 = SKAction.move(to: CGPoint(x: midX1, y: midY1), duration: halfDuration)
        moveOut1.timingMode = .easeOut
        let moveBack1 = SKAction.move(to: originalPos1, duration: halfDuration)
        moveBack1.timingMode = .easeIn

        let moveOut2 = SKAction.move(to: CGPoint(x: midX2, y: midY2), duration: halfDuration)
        moveOut2.timingMode = .easeOut
        let moveBack2 = SKAction.move(to: originalPos2, duration: halfDuration)
        moveBack2.timingMode = .easeIn

        // Quick red flash to indicate invalid
        let flash = SKAction.sequence([
            SKAction.colorize(with: Colors.red, colorBlendFactor: 0.5, duration: 0.05),
            SKAction.colorize(withColorBlendFactor: 0.0, duration: 0.15)
        ])

        tile1.zPosition = 10
        tile2.zPosition = 10

        tile1.run(SKAction.sequence([moveOut1, moveBack1, flash]))
        tile2.run(SKAction.sequence([moveOut2, moveBack2, flash])) {
            tile1.zPosition = 0
            tile2.zPosition = 0
            completion()
        }
    }

    // MARK: - Special Tile Activation

    /// Plays a special activation effect depending on the special tile type.
    func animateSpecialActivation(
        position: Position,
        type: SpecialTileType,
        affectedPositions: [Position],
        completion: @escaping () -> Void
    ) {
        guard let scene = scene else {
            completion()
            return
        }

        switch type {
        case .bomb:
            animateBombExplosion(at: position, affected: affectedPositions, completion: completion)
        case .vibestreak:
            animateVibestreakClear(at: position, affected: affectedPositions, completion: completion)
        case .cosmicBlast:
            animateCosmicBlast(at: position, affected: affectedPositions, completion: completion)
        }
    }

    private func animateBombExplosion(at position: Position, affected: [Position], completion: @escaping () -> Void) {
        guard let scene = scene else { completion(); return }

        let center = scene.pointForPosition(position)

        // Expanding ring
        let ring = SKShapeNode(circleOfRadius: 5)
        ring.strokeColor = Colors.orange
        ring.lineWidth = 4
        ring.fillColor = .clear
        ring.position = center
        ring.zPosition = 50
        scene.addChild(ring)

        let expand = SKAction.scale(to: 8, duration: 0.35)
        expand.timingMode = .easeOut
        let fade = SKAction.fadeAlpha(to: 0, duration: 0.35)
        ring.run(SKAction.group([expand, fade])) {
            ring.removeFromParent()
        }

        // Flash the screen
        scene.effects.screenFlash(intensity: .big)

        // Animate affected tiles
        let group = DispatchGroup()
        for pos in affected {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            let delay = SKAction.wait(forDuration: Double.random(in: 0...0.1))
            let shake = SKAction.sequence([
                SKAction.moveBy(x: 3, y: 0, duration: 0.03),
                SKAction.moveBy(x: -6, y: 0, duration: 0.03),
                SKAction.moveBy(x: 3, y: 0, duration: 0.03),
            ])
            tile.run(SKAction.sequence([delay, shake])) {
                tile.playMatchAnimation { group.leave() }
            }
        }

        group.notify(queue: .main) { completion() }
    }

    private func animateVibestreakClear(at position: Position, affected: [Position], completion: @escaping () -> Void) {
        guard let scene = scene else { completion(); return }

        let center = scene.pointForPosition(position)

        // Horizontal and vertical line sweep
        let lineH = SKShapeNode(rectOf: CGSize(width: 4, height: 4))
        lineH.fillColor = SKColor(red: 0.29, green: 0.62, blue: 1, alpha: 1)
        lineH.strokeColor = .clear
        lineH.position = center
        lineH.zPosition = 50
        scene.addChild(lineH)

        let expandH = SKAction.scaleX(to: 80, duration: 0.3)
        expandH.timingMode = .easeOut
        let fadeH = SKAction.fadeAlpha(to: 0, duration: 0.3)
        lineH.run(SKAction.group([expandH, fadeH])) {
            lineH.removeFromParent()
        }

        // Animate affected tiles with staggered delay
        let group = DispatchGroup()
        for (i, pos) in affected.enumerated() {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()
            let delay = SKAction.wait(forDuration: Double(i) * 0.03)
            tile.run(delay) {
                tile.playMatchAnimation { group.leave() }
            }
        }

        group.notify(queue: .main) { completion() }
    }

    private func animateCosmicBlast(at position: Position, affected: [Position], completion: @escaping () -> Void) {
        guard let scene = scene else { completion(); return }

        let center = scene.pointForPosition(position)

        // Purple pulse wave
        let pulse = SKShapeNode(circleOfRadius: 8)
        pulse.fillColor = Colors.cosmic.withAlphaComponent(0.4)
        pulse.strokeColor = Colors.cosmic
        pulse.lineWidth = 3
        pulse.glowWidth = 10
        pulse.position = center
        pulse.zPosition = 50
        scene.addChild(pulse)

        let expand = SKAction.scale(to: 12, duration: 0.5)
        expand.timingMode = .easeOut
        let fade = SKAction.fadeAlpha(to: 0, duration: 0.5)
        pulse.run(SKAction.group([expand, fade])) {
            pulse.removeFromParent()
        }

        // Screen flash
        scene.effects.screenFlash(intensity: .mega)

        // All affected tiles flash cosmic purple then disappear
        let group = DispatchGroup()
        for pos in affected {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            // Brief delay based on distance from origin
            let dr = abs(pos.row - position.row)
            let dc = abs(pos.col - position.col)
            let dist = Double(dr + dc) * 0.04

            let delay = SKAction.wait(forDuration: dist)
            let purpleFlash = SKAction.sequence([
                SKAction.colorize(with: Colors.cosmic, colorBlendFactor: 0.8, duration: 0.08),
                SKAction.colorize(withColorBlendFactor: 0.0, duration: 0.08)
            ])
            tile.run(SKAction.sequence([delay, purpleFlash])) {
                tile.playMatchAnimation { group.leave() }
            }
        }

        group.notify(queue: .main) { completion() }
    }

    // MARK: - Particle Effects

    /// Spawns a burst of particles at the matched tile's position, colored by tier.
    func spawnMatchParticles(at position: Position, tier: BadgeTier) {
        guard let scene = scene else { return }

        let center = scene.pointForPosition(position)
        let particleCount = particleCountForTier(tier)
        let color = particleColorForTier(tier)

        for i in 0..<particleCount {
            let particle = SKShapeNode(circleOfRadius: CGFloat.random(in: 2...5))
            particle.fillColor = i % 3 == 0 ? Colors.gold : color
            particle.strokeColor = .clear
            particle.position = center
            particle.zPosition = 60
            scene.addChild(particle)

            let angle = CGFloat.random(in: 0...(CGFloat.pi * 2))
            let distance = CGFloat.random(in: 30...120)
            let dx = cos(angle) * distance
            let dy = sin(angle) * distance

            let move = SKAction.moveBy(x: dx, y: dy, duration: TimeInterval.random(in: 0.4...0.8))
            move.timingMode = .easeOut
            let fade = SKAction.fadeAlpha(to: 0, duration: 0.6)
            let scale = SKAction.scale(to: 0.1, duration: 0.7)

            particle.run(SKAction.group([move, fade, scale])) {
                particle.removeFromParent()
            }
        }
    }

    // MARK: - Score Popup

    /// Shows a floating score label that drifts upward and fades out.
    func showScorePopup(score: Int, combo: Int, at position: Position) {
        guard let scene = scene else { return }

        let center = scene.pointForPosition(position)

        // Background pill
        let text = "+\(score)"
        let fontSize: CGFloat = combo >= 4 ? 22 : combo >= 2 ? 18 : 15

        let label = SKLabelNode(fontNamed: "Helvetica-Bold")
        label.text = text
        label.fontSize = fontSize
        label.fontColor = Colors.gold
        label.verticalAlignmentMode = .center
        label.horizontalAlignmentMode = .center
        label.position = center
        label.zPosition = 80

        // Dark background behind text
        let bgWidth = label.frame.width + 16
        let bgHeight = label.frame.height + 8
        let bg = SKShapeNode(rectOf: CGSize(width: bgWidth, height: bgHeight), cornerRadius: bgHeight / 2)
        bg.fillColor = SKColor(white: 0, alpha: 0.7)
        bg.strokeColor = Colors.gold.withAlphaComponent(0.4)
        bg.lineWidth = 1.5
        bg.position = center
        bg.zPosition = 79

        scene.addChild(bg)
        scene.addChild(label)

        // Drift slightly to the side based on column
        let driftX = CGFloat((position.col % 3) - 1) * 14

        let moveUp = SKAction.moveBy(x: driftX, y: 60, duration: Timing.scorePopupDuration)
        moveUp.timingMode = .easeOut
        let fadeOut = SKAction.fadeAlpha(to: 0, duration: Timing.scorePopupDuration * 0.6)
        fadeOut.timingMode = .easeIn
        let delayFade = SKAction.sequence([
            SKAction.wait(forDuration: Timing.scorePopupDuration * 0.4),
            fadeOut
        ])

        let group = SKAction.group([moveUp, delayFade])

        // Pop-in scale
        label.setScale(0.5)
        bg.setScale(0.5)
        let popIn = SKAction.scale(to: 1.0, duration: 0.15)
        popIn.timingMode = .easeOut

        label.run(SKAction.sequence([popIn, group])) { label.removeFromParent() }
        bg.run(SKAction.sequence([popIn, group])) { bg.removeFromParent() }
    }

    // MARK: - Combo Banner

    /// Shows a large combo text banner that slams in and fades out.
    /// "NICE!" at 2x, "VIBES!" at 3x, "ELECTRIC!!" at 4x, "MAX STOKED!" at 5x+.
    func showComboBanner(combo: Int) {
        guard let scene = scene, combo >= 2 else { return }

        let (text, color) = comboBannerConfig(combo: combo)

        let label = SKLabelNode(fontNamed: "Helvetica-Bold")
        label.text = text
        label.fontSize = 48
        label.fontColor = color
        label.verticalAlignmentMode = .center
        label.horizontalAlignmentMode = .center
        label.position = CGPoint(x: 0, y: 40)
        label.zPosition = 90
        label.alpha = 0

        // Stroke effect via attributed string
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.boldSystemFont(ofSize: 48),
            .foregroundColor: color,
            .strokeColor: SKColor(white: 0, alpha: 0.8),
            .strokeWidth: -4
        ]
        label.attributedText = NSAttributedString(string: text, attributes: attributes)

        // Sub-label: "x{combo} COMBO"
        let subLabel = SKLabelNode(fontNamed: "Helvetica-Bold")
        subLabel.text = "x\(combo) COMBO"
        subLabel.fontSize = 20
        subLabel.fontColor = .white
        subLabel.verticalAlignmentMode = .center
        subLabel.horizontalAlignmentMode = .center
        subLabel.position = CGPoint(x: 0, y: -5)
        subLabel.zPosition = 90
        subLabel.alpha = 0

        scene.addChild(label)
        scene.addChild(subLabel)

        // Slam in: scale from 2x to 1x with overshoot
        label.setScale(2.0)
        subLabel.setScale(0.5)

        let slamIn = SKAction.group([
            SKAction.scale(to: 1.0, duration: 0.2),
            SKAction.fadeAlpha(to: 1.0, duration: 0.15)
        ])

        let hold = SKAction.wait(forDuration: Timing.comboBannerDuration * 0.5)

        let fadeOut = SKAction.group([
            SKAction.fadeAlpha(to: 0, duration: 0.4),
            SKAction.scale(to: 0.8, duration: 0.4)
        ])

        let subIn = SKAction.group([
            SKAction.scale(to: 1.0, duration: 0.25),
            SKAction.fadeAlpha(to: 1.0, duration: 0.2)
        ])

        label.run(SKAction.sequence([slamIn, hold, fadeOut])) { label.removeFromParent() }
        subLabel.run(SKAction.sequence([
            SKAction.wait(forDuration: 0.1),
            subIn,
            SKAction.wait(forDuration: Timing.comboBannerDuration * 0.5 - 0.1),
            fadeOut
        ])) { subLabel.removeFromParent() }
    }

    // MARK: - Helpers

    private func comboBannerConfig(combo: Int) -> (String, SKColor) {
        switch combo {
        case 2:         return ("NICE!", .white)
        case 3:         return ("VIBES!", Colors.orange)
        case 4:         return ("ELECTRIC!!", Colors.gold)
        default:        return ("MAX STOKED!", Colors.cosmic)
        }
    }

    private func particleCountForTier(_ tier: BadgeTier) -> Int {
        switch tier {
        case .blue:   return 8
        case .silver: return 12
        case .gold:   return 18
        case .cosmic: return 28
        }
    }

    private func particleColorForTier(_ tier: BadgeTier) -> SKColor {
        switch tier {
        case .blue:   return SKColor(red: 0x94/255, green: 0xA3/255, blue: 0xB8/255, alpha: 1)
        case .silver: return SKColor(red: 0x4A/255, green: 0x9E/255, blue: 0xFF/255, alpha: 1)
        case .gold:   return Colors.gold
        case .cosmic: return Colors.cosmic
        }
    }
}
