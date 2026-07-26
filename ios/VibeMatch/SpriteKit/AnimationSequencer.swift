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
        static let lavender = SKColor(red: 108/255.0, green: 92/255.0, blue: 231/255.0, alpha: 1)
        static let gold     = SKColor(red: 255/255.0, green: 224/255.0, blue: 72/255.0, alpha: 1)
        static let orange   = SKColor(red: 255/255.0, green: 95/255.0, blue: 31/255.0, alpha: 1)
        static let cosmic   = SKColor(red: 179/255.0, green: 102/255.0, blue: 255/255.0, alpha: 1)
        static let red      = SKColor(red: 1, green: 0.2, blue: 0.2, alpha: 1)
    }

    // MARK: - Properties

    private weak var scene: GameScene?

    // MARK: - Init

    init(scene: GameScene) {
        self.scene = scene
    }

    // MARK: - Swap Animation

    /// Tiles at pos1 and pos2 slide to each other's positions over 250ms
    /// with particle trails following each tile.
    func animateSwap(pos1: Position, pos2: Position, completion: @escaping () -> Void) {
        guard let scene = scene,
              let tile1 = scene.tileNode(at: pos1),
              let tile2 = scene.tileNode(at: pos2) else {
            completion()
            return
        }

        let dest1 = tile2.position
        let dest2 = tile1.position
        let start1 = tile1.position
        let start2 = tile2.position

        let move1 = SKAction.move(to: dest1, duration: Timing.swapDuration)
        move1.timingMode = .easeInEaseOut
        let move2 = SKAction.move(to: dest2, duration: Timing.swapDuration)
        move2.timingMode = .easeInEaseOut

        // Bring swapping tiles to front
        tile1.zPosition = 10
        tile2.zPosition = 10

        // Spawn trail particles along the swap path
        spawnSwapTrail(from: start1, to: dest1, in: scene)
        spawnSwapTrail(from: start2, to: dest2, in: scene)

        tile1.run(move1)
        tile2.run(move2) {
            tile1.zPosition = 0
            tile2.zPosition = 0
            completion()
        }
    }

    /// Spawns a trail of small particles along a swap path.
    private func spawnSwapTrail(from start: CGPoint, to end: CGPoint, in scene: GameScene) {
        let trailCount = 5
        for i in 0..<trailCount {
            let t = CGFloat(i) / CGFloat(trailCount)
            let x = start.x + (end.x - start.x) * t
            let y = start.y + (end.y - start.y) * t

            let particle = SKShapeNode(circleOfRadius: CGFloat.random(in: 1.5...3))
            particle.fillColor = [Colors.lavender, Colors.gold, .white].randomElement()!
            particle.strokeColor = .clear
            // Convert from board layer coordinates
            let boardPos = CGPoint(x: x, y: y)
            particle.position = scene.convert(boardPos, from: scene.childNode(withName: "boardLayer") ?? scene)
            particle.position = boardPos
            particle.zPosition = 9
            particle.alpha = 0
            scene.childNode(withName: "boardLayer")?.addChild(particle) ?? scene.addChild(particle)

            let delay = Double(i) * 0.04
            let fadeIn = SKAction.fadeAlpha(to: 0.7, duration: 0.08)
            let drift = SKAction.moveBy(
                x: CGFloat.random(in: -6...6),
                y: CGFloat.random(in: -6...6),
                duration: 0.3
            )
            drift.timingMode = .easeOut
            let fadeOut = SKAction.fadeAlpha(to: 0, duration: 0.25)
            let scale = SKAction.scale(to: 0.3, duration: 0.3)

            particle.run(SKAction.sequence([
                SKAction.wait(forDuration: delay),
                fadeIn,
                SKAction.group([drift, fadeOut, scale])
            ])) {
                particle.removeFromParent()
            }
        }
    }

    // MARK: - Match Animation

    /// Matched tiles shatter with staggered timing (50ms per tile in the chain).
    func animateMatches(positions: [Position], completion: @escaping () -> Void) {
        guard let scene = scene, !positions.isEmpty else {
            completion()
            return
        }

        let group = DispatchGroup()

        for (i, pos) in positions.enumerated() {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            // Stagger destruction: 40ms per tile for a ripple effect
            let delay = SKAction.wait(forDuration: Double(i) * 0.04)
            tile.run(delay) {
                tile.playMatchAnimation {
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) {
            completion()
        }
    }

    // MARK: - Gravity / Drop Animation

    /// Tiles fall with spring physics and squash-on-landing.
    /// Staggered by row within each column for a waterfall cascade effect.
    func animateGravity(drops: [(col: Int, fromRow: Int, toRow: Int)], completion: @escaping () -> Void) {
        guard let scene = scene, !drops.isEmpty else {
            completion()
            return
        }

        let tileHeight = scene.tileNode(at: Position(row: 0, col: 0))?.size.height ?? 40
        let step = tileHeight + 2.0 // tile + padding

        // Sort drops by column then row for stagger ordering
        let sorted = drops.sorted { a, b in
            if a.col != b.col { return a.col < b.col }
            return a.fromRow < b.fromRow
        }

        let group = DispatchGroup()

        for (i, drop) in sorted.enumerated() {
            let pos = Position(row: drop.toRow, col: drop.col)
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            // Stagger by 25ms per tile for waterfall effect
            let delay = Double(i) * 0.025
            let wait = SKAction.wait(forDuration: delay)

            // Spawn sparkle trail during the drop
            let dropDistance = abs(drop.toRow - drop.fromRow)
            if dropDistance >= 2 {
                spawnCascadeSparkles(at: pos, dropDistance: dropDistance, delay: delay, in: scene)
            }

            tile.run(wait) {
                tile.playDropAnimation(fromRow: drop.fromRow, toRow: drop.toRow, tileHeight: step) {
                    group.leave()
                }
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

        // Multiple concentric expanding rings for depth
        for i in 0..<3 {
            let ring = SKShapeNode(circleOfRadius: 5)
            ring.strokeColor = i == 0 ? .white : (i == 1 ? Colors.gold : Colors.orange)
            ring.lineWidth = CGFloat(5 - i)
            ring.fillColor = .clear
            ring.position = center
            ring.zPosition = CGFloat(52 - i)
            ring.alpha = CGFloat(1.0 - Double(i) * 0.2)
            scene.addChild(ring)

            let delay = SKAction.wait(forDuration: Double(i) * 0.06)
            let expand = SKAction.scale(to: CGFloat(10 - i * 2), duration: 0.4)
            expand.timingMode = .easeOut
            let fade = SKAction.fadeAlpha(to: 0, duration: 0.4)
            ring.run(SKAction.sequence([delay, SKAction.group([expand, fade])])) {
                ring.removeFromParent()
            }
        }

        // Impact flash at center — bright white burst
        let flash = SKSpriteNode(color: .white, size: CGSize(width: 20, height: 20))
        flash.position = center
        flash.zPosition = 55
        flash.blendMode = .add
        scene.addChild(flash)
        let flashGrow = SKAction.scale(to: 4, duration: 0.1)
        let flashFade = SKAction.group([
            SKAction.scale(to: 6, duration: 0.2),
            SKAction.fadeAlpha(to: 0, duration: 0.2)
        ])
        flash.run(SKAction.sequence([flashGrow, flashFade])) { flash.removeFromParent() }

        // Debris particles scattering from center
        for _ in 0..<12 {
            let debris = SKShapeNode(circleOfRadius: CGFloat.random(in: 2...4))
            debris.fillColor = [Colors.orange, Colors.gold, .white].randomElement()!
            debris.strokeColor = .clear
            debris.position = center
            debris.zPosition = 54
            scene.addChild(debris)

            let angle = CGFloat.random(in: 0...(CGFloat.pi * 2))
            let dist = CGFloat.random(in: 50...130)
            let move = SKAction.moveBy(x: cos(angle) * dist, y: sin(angle) * dist, duration: 0.4)
            move.timingMode = .easeOut
            let fade = SKAction.fadeAlpha(to: 0, duration: 0.35)
            let spin = SKAction.rotate(byAngle: CGFloat.random(in: -4...4), duration: 0.4)
            debris.run(SKAction.group([move, fade, spin])) { debris.removeFromParent() }
        }

        // Screen flash + camera shake
        scene.effects.screenFlash(intensity: .mega)
        scene.cameraShake(amplitude: 10, duration: 0.25)

        // Staggered tile destruction — radial delay from center
        let group = DispatchGroup()
        for pos in affected {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            let dr = abs(pos.row - position.row)
            let dc = abs(pos.col - position.col)
            let dist = Double(max(dr, dc)) * 0.05

            let delay = SKAction.wait(forDuration: dist)
            let shake = SKAction.sequence([
                SKAction.moveBy(x: 4, y: 0, duration: 0.02),
                SKAction.moveBy(x: -8, y: 0, duration: 0.02),
                SKAction.moveBy(x: 4, y: 0, duration: 0.02),
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
        let beamColor = SKColor(red: 0.29, green: 0.85, blue: 1, alpha: 1)

        // Horizontal beam sweep — starts narrow, expands through the row
        let beamH = SKSpriteNode(color: beamColor, size: CGSize(width: 6, height: 6))
        beamH.position = center
        beamH.zPosition = 50
        beamH.blendMode = .add
        scene.addChild(beamH)

        let expandH = SKAction.group([
            SKAction.scaleX(to: 120, duration: 0.25),
            SKAction.scaleY(to: 3, duration: 0.15)
        ])
        expandH.timingMode = .easeOut
        let fadeH = SKAction.fadeAlpha(to: 0, duration: 0.2)
        beamH.run(SKAction.sequence([expandH, fadeH])) { beamH.removeFromParent() }

        // Vertical beam sweep
        let beamV = SKSpriteNode(color: beamColor, size: CGSize(width: 6, height: 6))
        beamV.position = center
        beamV.zPosition = 50
        beamV.blendMode = .add
        scene.addChild(beamV)

        let expandV = SKAction.group([
            SKAction.scaleY(to: 120, duration: 0.25),
            SKAction.scaleX(to: 3, duration: 0.15)
        ])
        expandV.timingMode = .easeOut
        let fadeV = SKAction.fadeAlpha(to: 0, duration: 0.2)
        beamV.run(SKAction.sequence([expandV, fadeV])) { beamV.removeFromParent() }

        // Central cross flash
        let crossFlash = SKSpriteNode(color: .white, size: CGSize(width: 12, height: 12))
        crossFlash.position = center
        crossFlash.zPosition = 52
        crossFlash.blendMode = .add
        scene.addChild(crossFlash)
        let crossGrow = SKAction.scale(to: 3, duration: 0.12)
        let crossFade = SKAction.group([
            SKAction.scale(to: 5, duration: 0.2),
            SKAction.fadeAlpha(to: 0, duration: 0.2)
        ])
        crossFlash.run(SKAction.sequence([crossGrow, crossFade])) { crossFlash.removeFromParent() }

        // Trail particles along beam paths
        for _ in 0..<8 {
            let spark = SKShapeNode(circleOfRadius: CGFloat.random(in: 1.5...3))
            spark.fillColor = [beamColor, .white, Colors.gold].randomElement()!
            spark.strokeColor = .clear
            spark.position = center
            spark.zPosition = 51
            scene.addChild(spark)

            // Random direction along horizontal or vertical axis
            let isHorizontal = Bool.random()
            let dist = CGFloat.random(in: 40...160) * (Bool.random() ? 1 : -1)
            let dx = isHorizontal ? dist : CGFloat.random(in: -10...10)
            let dy = isHorizontal ? CGFloat.random(in: -10...10) : dist
            let sparkMove = SKAction.moveBy(x: dx, y: dy, duration: 0.35)
            sparkMove.timingMode = .easeOut
            let sparkFade = SKAction.fadeAlpha(to: 0, duration: 0.3)
            spark.run(SKAction.group([sparkMove, sparkFade])) { spark.removeFromParent() }
        }

        // Screen effects
        scene.effects.screenFlash(intensity: .mega)
        scene.cameraShake(amplitude: 8, duration: 0.2)

        // Staggered tile destruction — distance-based from center
        let group = DispatchGroup()
        for pos in affected {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            let dr = abs(pos.row - position.row)
            let dc = abs(pos.col - position.col)
            let dist = Double(dr + dc) * 0.035

            let delay = SKAction.wait(forDuration: dist)
            tile.run(delay) {
                tile.playMatchAnimation { group.leave() }
            }
        }

        group.notify(queue: .main) { completion() }
    }

    private func animateCosmicBlast(at position: Position, affected: [Position], completion: @escaping () -> Void) {
        guard let scene = scene else { completion(); return }

        let center = scene.pointForPosition(position)

        // Phase 1: Central implosion — brief inward pull before explosion
        let implosion = SKShapeNode(circleOfRadius: 40)
        implosion.fillColor = Colors.cosmic.withAlphaComponent(0.3)
        implosion.strokeColor = .clear
        implosion.position = center
        implosion.zPosition = 53
        scene.addChild(implosion)

        let implode = SKAction.scale(to: 0.2, duration: 0.15)
        implode.timingMode = .easeIn
        implosion.run(implode) { implosion.removeFromParent() }

        // Phase 2: Shockwave rings (staggered)
        let afterImplode = SKAction.wait(forDuration: 0.15)
        scene.run(afterImplode) { [weak scene] in
            guard let scene = scene else { return }

            for i in 0..<3 {
                let ring = SKShapeNode(circleOfRadius: 6)
                ring.strokeColor = i == 0 ? .white : Colors.cosmic
                ring.lineWidth = CGFloat(4 - i)
                ring.fillColor = i == 0 ? Colors.cosmic.withAlphaComponent(0.15) : .clear
                ring.position = center
                ring.zPosition = CGFloat(55 - i)
                scene.addChild(ring)

                let delay = SKAction.wait(forDuration: Double(i) * 0.08)
                let expand = SKAction.scale(to: CGFloat(16 - i * 3), duration: 0.5)
                expand.timingMode = .easeOut
                let fade = SKAction.fadeAlpha(to: 0, duration: 0.5)
                ring.run(SKAction.sequence([delay, SKAction.group([expand, fade])])) {
                    ring.removeFromParent()
                }
            }

            // Central white flash burst
            let burst = SKSpriteNode(color: .white, size: CGSize(width: 16, height: 16))
            burst.position = center
            burst.zPosition = 56
            burst.blendMode = .add
            scene.addChild(burst)
            let burstGrow = SKAction.scale(to: 6, duration: 0.12)
            let burstFade = SKAction.group([
                SKAction.scale(to: 10, duration: 0.25),
                SKAction.fadeAlpha(to: 0, duration: 0.25)
            ])
            burst.run(SKAction.sequence([burstGrow, burstFade])) { burst.removeFromParent() }

            // Cosmic particle spray
            for _ in 0..<16 {
                let particle = SKShapeNode(circleOfRadius: CGFloat.random(in: 2...5))
                particle.fillColor = [Colors.cosmic, SKColor(red: 0.5, green: 0.2, blue: 1, alpha: 1), .white, Colors.gold].randomElement()!
                particle.strokeColor = .clear
                particle.position = center
                particle.zPosition = 54
                scene.addChild(particle)

                let angle = CGFloat.random(in: 0...(CGFloat.pi * 2))
                let dist = CGFloat.random(in: 60...180)
                let move = SKAction.moveBy(x: cos(angle) * dist, y: sin(angle) * dist, duration: 0.55)
                move.timingMode = .easeOut
                let spin = SKAction.rotate(byAngle: CGFloat.random(in: -5...5), duration: 0.55)
                let fade = SKAction.fadeAlpha(to: 0, duration: 0.5)
                let scale = SKAction.scale(to: 0.2, duration: 0.55)
                particle.run(SKAction.group([move, spin, fade, scale])) { particle.removeFromParent() }
            }

            // Screen effects — full intensity
            scene.effects.screenFlash(intensity: .ultra)
            scene.cameraShake(amplitude: 16, duration: 0.35)
        }

        // Staggered tile destruction — ripple outward from center
        let group = DispatchGroup()
        for pos in affected {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            let dr = abs(pos.row - position.row)
            let dc = abs(pos.col - position.col)
            let dist = Double(max(dr, dc)) * 0.06 + 0.18 // Wait for implosion + shockwave start

            let delay = SKAction.wait(forDuration: dist)
            let purpleFlash = SKAction.sequence([
                SKAction.colorize(with: Colors.cosmic, colorBlendFactor: 0.9, duration: 0.06),
                SKAction.colorize(withColorBlendFactor: 0.0, duration: 0.06)
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

    // MARK: - Cascade Sparkles

    /// Spawns sparkle particles along the path a tile drops through.
    private func spawnCascadeSparkles(at position: Position, dropDistance: Int, delay: Double, in scene: GameScene) {
        let center = scene.pointForPosition(position)
        let sparkleCount = min(dropDistance, 4)

        for i in 0..<sparkleCount {
            let sparkle = SKShapeNode(circleOfRadius: CGFloat.random(in: 1...2.5))
            sparkle.fillColor = [Colors.gold, Colors.lavender, .white].randomElement()!
            sparkle.strokeColor = .clear
            sparkle.position = CGPoint(
                x: center.x + CGFloat.random(in: -8...8),
                y: center.y + CGFloat(i) * 12
            )
            sparkle.zPosition = 5
            sparkle.alpha = 0
            scene.addChild(sparkle)

            let sparkDelay = delay + Double(i) * 0.06
            let fadeIn = SKAction.fadeAlpha(to: 0.8, duration: 0.1)
            let drift = SKAction.moveBy(
                x: CGFloat.random(in: -12...12),
                y: CGFloat.random(in: 5...20),
                duration: 0.5
            )
            drift.timingMode = .easeOut
            let fadeOut = SKAction.fadeAlpha(to: 0, duration: 0.4)
            let shrink = SKAction.scale(to: 0.2, duration: 0.5)

            sparkle.run(SKAction.sequence([
                SKAction.wait(forDuration: sparkDelay),
                fadeIn,
                SKAction.group([drift, fadeOut, shrink])
            ])) {
                sparkle.removeFromParent()
            }
        }
    }

    // MARK: - Urgency Effects

    /// Applies urgency effects to all tiles when moves are critically low.
    /// - movesLeft == 3: subtle vibrate
    /// - movesLeft == 2: stronger vibrate + slight desaturation
    /// - movesLeft == 1: intense vibrate + heavy desaturation
    func applyUrgency(movesLeft: Int) {
        guard let scene = scene, movesLeft <= 3 else {
            clearUrgency()
            return
        }

        let amplitude: CGFloat
        let speed: TimeInterval
        switch movesLeft {
        case 3:  amplitude = 0.5; speed = 0.12
        case 2:  amplitude = 1.0; speed = 0.08
        default: amplitude = 1.5; speed = 0.06
        }

        for row in 0..<8 {
            for col in 0..<8 {
                guard let tile = scene.tileNode(at: Position(row: row, col: col)) else { continue }
                tile.removeAction(forKey: "urgencyVibrate")

                // Random phase offset so tiles don't vibrate in unison
                let phase = Double.random(in: 0...0.1)
                let jitterX = SKAction.moveBy(x: amplitude, y: 0, duration: speed)
                let jitterBack = SKAction.moveBy(x: -amplitude, y: 0, duration: speed)
                let cycle = SKAction.sequence([
                    SKAction.wait(forDuration: phase),
                    jitterX, jitterBack,
                    SKAction.wait(forDuration: Double.random(in: 0.3...0.8))
                ])
                tile.run(.repeatForever(cycle), withKey: "urgencyVibrate")
            }
        }
    }

    /// Clears urgency effects from all tiles.
    func clearUrgency() {
        guard let scene = scene else { return }
        for row in 0..<8 {
            for col in 0..<8 {
                scene.tileNode(at: Position(row: row, col: col))?.removeAction(forKey: "urgencyVibrate")
            }
        }
    }

    // MARK: - Victory Celebration

    /// Plays a victory celebration: confetti burst, tile wave, and score fanfare position.
    func playVictoryCelebration(finalScore: Int, completion: @escaping () -> Void) {
        guard let scene = scene else { completion(); return }

        // 1. Confetti burst from top
        spawnConfetti(in: scene)

        // 2. Tile wave — tiles bounce upward in a wave from bottom-left to top-right
        let waveGroup = DispatchGroup()
        for row in (0..<8).reversed() {
            for col in 0..<8 {
                guard let tile = scene.tileNode(at: Position(row: row, col: col)) else { continue }
                waveGroup.enter()

                let delay = Double(7 - row + col) * 0.04 + 0.3 // Start after confetti begins
                let originalY = tile.position.y

                let wait = SKAction.wait(forDuration: delay)
                let jumpUp = SKAction.moveBy(x: 0, y: 15, duration: 0.15)
                jumpUp.timingMode = .easeOut
                let comeDown = SKAction.moveTo(y: originalY, duration: 0.2)
                comeDown.timingMode = .easeIn
                let squash = SKAction.group([
                    SKAction.scaleX(to: 1.08, duration: 0.06),
                    SKAction.scaleY(to: 0.92, duration: 0.06)
                ])
                let settle = SKAction.scale(to: 1.0, duration: 0.1)

                tile.run(SKAction.sequence([wait, jumpUp, comeDown, squash, settle])) {
                    waveGroup.leave()
                }
            }
        }

        // 3. Big score display
        let scoreLabel = SKLabelNode(fontNamed: "Helvetica-Bold")
        scoreLabel.text = "\(finalScore)"
        scoreLabel.fontSize = 64
        scoreLabel.fontColor = Colors.gold
        scoreLabel.verticalAlignmentMode = .center
        scoreLabel.horizontalAlignmentMode = .center
        scoreLabel.position = CGPoint(x: 0, y: 0)
        scoreLabel.zPosition = 100
        scoreLabel.alpha = 0
        scoreLabel.setScale(0.3)

        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.boldSystemFont(ofSize: 64),
            .foregroundColor: Colors.gold,
            .strokeColor: SKColor(white: 0, alpha: 0.8),
            .strokeWidth: -3
        ]
        scoreLabel.attributedText = NSAttributedString(string: "\(finalScore)", attributes: attributes)
        scene.addChild(scoreLabel)

        let scoreDelay = SKAction.wait(forDuration: 0.8)
        let scoreIn = SKAction.group([
            SKAction.scale(to: 1.0, duration: 0.3),
            SKAction.fadeAlpha(to: 1.0, duration: 0.2)
        ])
        let scoreHold = SKAction.wait(forDuration: 1.5)
        let scoreOut = SKAction.group([
            SKAction.scale(to: 0.8, duration: 0.4),
            SKAction.fadeAlpha(to: 0, duration: 0.4)
        ])
        scoreLabel.run(SKAction.sequence([scoreDelay, scoreIn, scoreHold, scoreOut])) {
            scoreLabel.removeFromParent()
        }

        // Complete after wave finishes
        waveGroup.notify(queue: .main) {
            // Give time for score display to finish
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                completion()
            }
        }
    }

    /// Spawns confetti particles cascading from the top of the screen.
    private func spawnConfetti(in scene: GameScene) {
        let confettiColors: [SKColor] = [
            Colors.gold,
            Colors.lavender,
            Colors.orange,
            Colors.cosmic,
            .white,
            SKColor(red: 0.29, green: 0.85, blue: 1, alpha: 1)
        ]

        let sceneWidth = scene.size.width
        let sceneHeight = scene.size.height

        for i in 0..<40 {
            let confetti = SKSpriteNode(
                color: confettiColors[i % confettiColors.count],
                size: CGSize(width: CGFloat.random(in: 4...8), height: CGFloat.random(in: 8...16))
            )
            confetti.position = CGPoint(
                x: CGFloat.random(in: -sceneWidth/2...sceneWidth/2),
                y: sceneHeight / 2 + 20
            )
            confetti.zPosition = 95
            confetti.zRotation = CGFloat.random(in: 0...(CGFloat.pi * 2))
            scene.addChild(confetti)

            let delay = Double(i) * 0.05
            let fallDist = sceneHeight + 60
            let driftX = CGFloat.random(in: -80...80)

            let fall = SKAction.moveBy(x: driftX, y: -fallDist, duration: TimeInterval.random(in: 2.0...3.5))
            fall.timingMode = .easeIn
            let spin = SKAction.rotate(byAngle: CGFloat.random(in: -8...8), duration: 3.0)
            let flutter = SKAction.sequence([
                SKAction.moveBy(x: CGFloat.random(in: -15...15), y: 0, duration: 0.3),
                SKAction.moveBy(x: CGFloat.random(in: -15...15), y: 0, duration: 0.3)
            ])

            confetti.run(SKAction.sequence([
                SKAction.wait(forDuration: delay),
                SKAction.group([fall, spin, .repeatForever(flutter)])
            ])) {
                confetti.removeFromParent()
            }
        }
    }

    // MARK: - Last-Move Slow-Mo

    /// Temporarily slows the scene's animation speed for the final move of the game.
    /// Creates a dramatic "last chance" feel. Restores normal speed after duration.
    func applyLastMoveSlowMo() {
        guard let scene = scene else { return }

        // Slow to 70% speed
        scene.speed = 0.7

        // Restore after the animations play out (match + gravity cycle ~1.2s at 0.7x = ~1.7s real)
        let restore = SKAction.sequence([
            SKAction.wait(forDuration: 1.8),
            SKAction.speed(to: 1.0, duration: 0.3)
        ])
        scene.run(restore, withKey: "slowMoRestore")
    }

    /// Restores normal animation speed (call if game state changes before slow-mo ends).
    func clearSlowMo() {
        guard let scene = scene else { return }
        scene.removeAction(forKey: "slowMoRestore")
        scene.speed = 1.0
    }

    // MARK: - New Tile Spawn

    /// Animates newly spawned tiles (tiles that appear at the top after gravity).
    /// Tiles scale up from 0 with a quick bounce.
    func animateNewTileSpawns(positions: [Position], completion: @escaping () -> Void) {
        guard let scene = scene, !positions.isEmpty else {
            completion()
            return
        }

        let group = DispatchGroup()

        for (i, pos) in positions.enumerated() {
            guard let tile = scene.tileNode(at: pos) else { continue }
            group.enter()

            // Stagger spawn by 30ms per tile
            let delay = Double(i) * 0.03
            tile.playSpawnAnimation(delay: delay) {
                group.leave()
            }
        }

        group.notify(queue: .main) {
            completion()
        }
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
        case .blue:    return 8
        case .silver:  return 12
        case .gold:    return 18
        case .special: return 18
        case .cosmic:  return 28
        }
    }

    private func particleColorForTier(_ tier: BadgeTier) -> SKColor {
        switch tier {
        case .blue:    return SKColor(red: 224/255.0, green: 224/255.0, blue: 224/255.0, alpha: 1)
        case .silver:  return SKColor(red: 74/255.0, green: 158/255.0, blue: 255/255.0, alpha: 1)
        case .gold:    return Colors.gold
        case .special: return SKColor(red: 255/255.0, green: 140/255.0, blue: 66/255.0, alpha: 1)
        case .cosmic:  return Colors.cosmic
        }
    }
}
