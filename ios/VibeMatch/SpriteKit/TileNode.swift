import SpriteKit

// MARK: - TileNode

/// An SKNode subclass representing a single tile on the match-3 board.
/// Matches the web's gem-like tile styling: tier-colored border, badge-tinted fill,
/// inner highlight/shadow for 3D depth, and special tile overlays.
final class TileNode: SKSpriteNode {

    // MARK: - Constants

    private enum Colors {
        /// Common tier: #E0E0E0
        static let blue    = SKColor(red: 224/255.0, green: 224/255.0, blue: 224/255.0, alpha: 1)
        /// Rare tier: #4A9EFF
        static let silver  = SKColor(red: 74/255.0, green: 158/255.0, blue: 255/255.0, alpha: 1)
        /// Legendary tier: #FFE048
        static let gold    = SKColor(red: 255/255.0, green: 224/255.0, blue: 72/255.0, alpha: 1)
        /// Strategic Specials tier: #FF8C42
        static let special = SKColor(red: 255/255.0, green: 140/255.0, blue: 66/255.0, alpha: 1)
        /// Cosmic tier: #B366FF
        static let cosmic  = SKColor(red: 179/255.0, green: 102/255.0, blue: 255/255.0, alpha: 1)
        /// Selection ring: gold #FFE048
        static let selection = SKColor(red: 255/255.0, green: 224/255.0, blue: 72/255.0, alpha: 1)
    }

    private enum Layout {
        static let borderWidth: CGFloat = 2.0
        static let cornerRadius: CGFloat = 8.0
        static let badgeInset: CGFloat = 3.0
    }

    // MARK: - Child Nodes

    /// Background fill with tier-tinted color (the main tile body).
    private let tileBackground: SKShapeNode
    /// The colored rectangle placeholder shown until the pin texture loads.
    private let badgePlaceholder: SKSpriteNode
    /// Pin art sprite that displays the actual badge .webp.
    private let badgeSprite: SKSpriteNode
    /// Label fallback shown when no asset is available for this pin id.
    private let badgeLabel: SKLabelNode
    /// Border shape drawn as a rounded rectangle outline.
    private let borderNode: SKShapeNode
    /// Inner highlight for gem-like 3D depth effect.
    private let innerHighlight: SKShapeNode
    /// Selection highlight outline, hidden by default.
    private let selectionRing: SKShapeNode
    /// Overlay node for special tile indicators (bomb, vibestreak, cosmic).
    private let specialOverlay: SKNode

    // MARK: - State

    private(set) var boardRow: Int = 0
    private(set) var boardCol: Int = 0
    private var isCurrentlySelected: Bool = false
    /// Track configured badge to skip redundant reconfiguration.
    private var configuredBadgeId: String?
    private var configuredSpecial: SpecialTileType?

    // MARK: - Init

    init(tileSize: CGSize) {
        let tileRect = CGRect(
            x: -tileSize.width / 2,
            y: -tileSize.height / 2,
            width: tileSize.width,
            height: tileSize.height
        )
        let tilePath = UIBezierPath(roundedRect: tileRect, cornerRadius: Layout.cornerRadius)

        // Tile background fill
        tileBackground = SKShapeNode(path: tilePath.cgPath)
        tileBackground.fillColor = SKColor(red: 0.08, green: 0.04, blue: 0.15, alpha: 1)
        tileBackground.strokeColor = .clear
        tileBackground.zPosition = 0

        // Badge placeholder — filled with a tier color, slightly inset
        let insetSize = CGSize(
            width: tileSize.width - Layout.badgeInset * 2,
            height: tileSize.height - Layout.badgeInset * 2
        )
        badgePlaceholder = SKSpriteNode(color: .darkGray, size: insetSize)
        badgePlaceholder.zPosition = 1

        // Pin art sprite — texture is set in configure().
        badgeSprite = SKSpriteNode(texture: nil, size: insetSize)
        badgeSprite.zPosition = 2

        // Badge name label fallback shown when no asset is available
        badgeLabel = SKLabelNode(fontNamed: "Helvetica-Bold")
        badgeLabel.fontSize = max(8, tileSize.width * 0.16)
        badgeLabel.fontColor = .white
        badgeLabel.verticalAlignmentMode = .center
        badgeLabel.horizontalAlignmentMode = .center
        badgeLabel.zPosition = 2
        badgeLabel.numberOfLines = 2
        badgeLabel.preferredMaxLayoutWidth = insetSize.width - 4
        badgeLabel.isHidden = true

        // Border outline
        borderNode = SKShapeNode(path: tilePath.cgPath)
        borderNode.strokeColor = Colors.blue
        borderNode.lineWidth = Layout.borderWidth
        borderNode.fillColor = .clear
        borderNode.zPosition = 3

        // Inner highlight — subtle top-edge white glow for gem emboss effect
        let highlightRect = tileRect.insetBy(dx: 2, dy: 2)
        let highlightPath = UIBezierPath(roundedRect: highlightRect, cornerRadius: Layout.cornerRadius - 1)
        innerHighlight = SKShapeNode(path: highlightPath.cgPath)
        innerHighlight.strokeColor = SKColor(white: 1, alpha: 0.12)
        innerHighlight.lineWidth = 1.0
        innerHighlight.fillColor = .clear
        innerHighlight.zPosition = 3

        // Selection ring — slightly larger outline that pulses
        let selRect = tileRect.insetBy(dx: -3, dy: -3)
        let selPath = UIBezierPath(roundedRect: selRect, cornerRadius: Layout.cornerRadius + 3)
        selectionRing = SKShapeNode(path: selPath.cgPath)
        selectionRing.strokeColor = Colors.selection
        selectionRing.lineWidth = 3.0
        selectionRing.fillColor = .clear
        selectionRing.zPosition = 5
        selectionRing.isHidden = true
        selectionRing.alpha = 0.0

        // Special overlay container
        specialOverlay = SKNode()
        specialOverlay.zPosition = 4

        super.init(texture: nil, color: .clear, size: tileSize)

        addChild(tileBackground)
        addChild(badgePlaceholder)
        addChild(badgeSprite)
        addChild(badgeLabel)
        addChild(borderNode)
        addChild(innerHighlight)
        addChild(selectionRing)
        addChild(specialOverlay)

        isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Configuration

    /// Configures this tile to display the given cell and badge.
    /// Skips reconfiguration if the badge and special type haven't changed.
    func configure(cell: Cell, badge: Badge, row: Int, col: Int) {
        boardRow = row
        boardCol = col

        // Skip redundant reconfiguration
        if configuredBadgeId == badge.id && configuredSpecial == cell.isSpecial {
            return
        }
        configuredBadgeId = badge.id
        configuredSpecial = cell.isSpecial

        let hue = badgeHue(for: badge.id)
        let tc = tierColor(for: badge.tier)
        let borderAlpha: CGFloat

        // Web-matching tier visual properties
        let saturation: CGFloat
        let brightness: CGFloat
        switch badge.tier {
        case .blue:
            saturation = 0.35; brightness = 0.30; borderAlpha = 0.5
        case .silver:
            saturation = 0.55; brightness = 0.40; borderAlpha = 0.6
        case .gold:
            saturation = 0.60; brightness = 0.50; borderAlpha = 0.7
        case .special:
            saturation = 0.60; brightness = 0.50; borderAlpha = 0.7
        case .cosmic:
            saturation = 0.65; brightness = 0.55; borderAlpha = 0.8
        }

        // Tile background: tier-tinted dark fill (web: ${tierColor}40 background)
        tileBackground.fillColor = SKColor(hue: hue, saturation: saturation * 0.4, brightness: 0.12, alpha: 1)

        // Badge placeholder: stronger hue for the inner badge area
        badgePlaceholder.color = SKColor(hue: hue, saturation: saturation, brightness: brightness, alpha: 1.0)

        // Try to load the pin art texture from the Asset Catalog.
        // The image name matches Badge.assetName (e.g. "any_gvc_1759173799963").
        if let image = UIImage(named: badge.assetName) {
            badgeSprite.texture = SKTexture(image: image)
            badgeSprite.isHidden = false
            badgeLabel.isHidden = true
        } else {
            badgeSprite.texture = nil
            badgeSprite.isHidden = true
            badgeLabel.isHidden = false
            badgeLabel.text = badge.name
            badgeLabel.fontColor = tc.withAlphaComponent(0.9)
        }

        // Border: tier color at tier-specific alpha (web: rgba border)
        borderNode.strokeColor = tc.withAlphaComponent(borderAlpha)
        borderNode.lineWidth = badge.tier == .cosmic ? 2.5 : Layout.borderWidth

        // Inner highlight varies by tier
        innerHighlight.strokeColor = SKColor(white: 1, alpha: badge.tier == .gold ? 0.18 : 0.10)

        // Special tile overlay
        configureSpecialOverlay(cell.isSpecial)
    }

    // MARK: - Selection

    /// Shows or hides the selection highlight with a pulse animation.
    /// Web: outline 3px, scale 1.05-1.08, 0.6s infinite
    func setSelected(_ selected: Bool) {
        guard selected != isCurrentlySelected else { return }
        isCurrentlySelected = selected

        selectionRing.removeAllActions()

        if selected {
            selectionRing.isHidden = false
            selectionRing.alpha = 0.8

            let scaleUp = SKAction.group([
                SKAction.fadeAlpha(to: 1.0, duration: 0.3),
                SKAction.scale(to: 1.05, duration: 0.3)
            ])
            let scaleDown = SKAction.group([
                SKAction.fadeAlpha(to: 0.5, duration: 0.3),
                SKAction.scale(to: 1.0, duration: 0.3)
            ])
            let pulse = SKAction.sequence([scaleUp, scaleDown])
            selectionRing.run(.repeatForever(pulse), withKey: "selectionPulse")
        } else {
            let fadeOut = SKAction.fadeAlpha(to: 0.0, duration: 0.15)
            selectionRing.run(fadeOut) { [weak self] in
                self?.selectionRing.isHidden = true
                self?.selectionRing.setScale(1.0)
            }
        }
    }

    // MARK: - Animations

    /// Plays a match destruction animation: glow bloom, squash, then shatter into fragments.
    func playMatchAnimation(completion: (() -> Void)? = nil) {
        guard let parentNode = parent else {
            completion?()
            return
        }

        // Phase 1: Glow bloom (0.12s) — tile brightens and scales up slightly
        let bloom = SKAction.group([
            SKAction.colorize(with: .white, colorBlendFactor: 0.9, duration: 0.12),
            SKAction.scale(to: 1.15, duration: 0.12)
        ])

        // Phase 2: Squash compress (0.05s) — tile compresses before bursting
        let squash = SKAction.group([
            SKAction.scaleX(to: 1.3, duration: 0.05),
            SKAction.scaleY(to: 0.7, duration: 0.05)
        ])

        // Phase 3: Burst — spawn fragment shards, then shrink tile to zero
        let burst = SKAction.run { [weak self] in
            guard let self = self else { return }
            self.spawnShatterFragments(in: parentNode)
        }

        let shrink = SKAction.group([
            SKAction.scale(to: 0.0, duration: 0.15),
            SKAction.fadeAlpha(to: 0.0, duration: 0.15)
        ])
        shrink.timingMode = .easeIn

        let sequence = SKAction.sequence([bloom, squash, burst, shrink])
        run(sequence) {
            completion?()
        }
    }

    /// Spawns 5-8 fragment shards that scatter outward with rotation and fade.
    private func spawnShatterFragments(in parentNode: SKNode) {
        let fragmentCount = Int.random(in: 5...8)
        let tileColor = badgePlaceholder.color
        let fragmentSize = size.width * 0.22

        for i in 0..<fragmentCount {
            let fragment = SKSpriteNode(color: tileColor, size: CGSize(width: fragmentSize, height: fragmentSize))
            fragment.position = parentNode.convert(position, from: parentNode)
            fragment.position = self.position
            fragment.zPosition = zPosition + 5

            // Slight color variation
            if i % 3 == 0 {
                fragment.color = .white
                fragment.colorBlendFactor = 0.6
            }

            parentNode.addChild(fragment)

            // Random outward velocity
            let angle = CGFloat.random(in: 0...(CGFloat.pi * 2))
            let speed = CGFloat.random(in: 40...140)
            let dx = cos(angle) * speed
            let dy = sin(angle) * speed
            let duration = TimeInterval.random(in: 0.3...0.6)

            let scatter = SKAction.moveBy(x: dx, y: dy, duration: duration)
            scatter.timingMode = .easeOut

            // Gravity pull
            let gravity = SKAction.moveBy(x: 0, y: -30, duration: duration)

            let spin = SKAction.rotate(byAngle: CGFloat.random(in: -6...6), duration: duration)
            let fade = SKAction.fadeAlpha(to: 0, duration: duration * 0.8)
            let scale = SKAction.scale(to: CGFloat.random(in: 0.1...0.4), duration: duration)

            let group = SKAction.group([scatter, gravity, spin, fade, scale])
            fragment.run(group) {
                fragment.removeFromParent()
            }
        }

        // Dust puff — tiny particles at the center
        for _ in 0..<4 {
            let dust = SKShapeNode(circleOfRadius: CGFloat.random(in: 1.5...3))
            dust.fillColor = SKColor(white: 1, alpha: 0.6)
            dust.strokeColor = .clear
            dust.position = self.position
            dust.zPosition = zPosition + 4
            parentNode.addChild(dust)

            let drift = SKAction.moveBy(
                x: CGFloat.random(in: -20...20),
                y: CGFloat.random(in: -10...25),
                duration: 0.4
            )
            drift.timingMode = .easeOut
            let dustFade = SKAction.fadeAlpha(to: 0, duration: 0.35)
            dust.run(SKAction.group([drift, dustFade])) {
                dust.removeFromParent()
            }
        }
    }

    /// Plays a drop animation with spring physics and squash-on-landing.
    func playDropAnimation(fromRow: Int, toRow: Int, tileHeight: CGFloat, completion: (() -> Void)? = nil) {
        let rowDiff = CGFloat(toRow - fromRow)
        let dropDistance = rowDiff * tileHeight
        let originalY = position.y
        position.y = originalY + dropDistance

        // Slight rotation wobble during fall
        let wobbleAngle = CGFloat.random(in: -0.04...0.04)

        // Total duration scales with distance but caps out
        let baseDuration = min(0.45, 0.25 + Double(abs(toRow - fromRow)) * 0.04)

        // Main drop with accelerating ease
        let totalDuration = baseDuration
        let dropDuration = totalDuration * 0.65
        let bounceDuration = totalDuration * 0.35

        let moveDown = SKAction.moveTo(y: originalY, duration: dropDuration)
        moveDown.timingMode = .easeIn

        let wobble = SKAction.rotate(toAngle: wobbleAngle, duration: dropDuration)
        let dropPhase = SKAction.group([moveDown, wobble])

        // Squash-on-landing: compress vertically, stretch horizontally
        let squashDown = SKAction.group([
            SKAction.scaleX(to: 1.12, duration: bounceDuration * 0.25),
            SKAction.scaleY(to: 0.88, duration: bounceDuration * 0.25),
            SKAction.moveTo(y: originalY - 3, duration: bounceDuration * 0.25)
        ])

        // Spring back with overshoot
        let springUp = SKAction.group([
            SKAction.scaleX(to: 0.96, duration: bounceDuration * 0.3),
            SKAction.scaleY(to: 1.06, duration: bounceDuration * 0.3),
            SKAction.moveTo(y: originalY + 4, duration: bounceDuration * 0.3)
        ])

        // Settle to rest
        let settle = SKAction.group([
            SKAction.scale(to: 1.0, duration: bounceDuration * 0.45),
            SKAction.moveTo(y: originalY, duration: bounceDuration * 0.45),
            SKAction.rotate(toAngle: 0, duration: bounceDuration * 0.45)
        ])

        let sequence = SKAction.sequence([dropPhase, squashDown, springUp, settle])
        run(sequence) {
            completion?()
        }
    }

    /// Resets scale and alpha after animations, and clears dirty-check
    /// so the next configure() call applies fresh visuals.
    func resetAppearance() {
        removeAction(forKey: "idleBreathing")
        setScale(1.0)
        alpha = 1.0
        zRotation = 0
        badgePlaceholder.colorBlendFactor = 0.0
        configuredBadgeId = nil
        configuredSpecial = nil
        startIdleBreathing()
    }

    // MARK: - Idle Breathing

    /// Starts a gentle breathing animation: subtle scale pulse + slight bob.
    /// Special tiles breathe more intensely with a shimmer overlay.
    func startIdleBreathing() {
        removeAction(forKey: "idleBreathing")

        // Offset the phase so all 64 tiles don't pulse in sync
        let phaseDelay = Double(boardRow * 8 + boardCol) * 0.08

        // Gentle scale breathing: 1.0 -> 1.02 -> 1.0 over ~2.5s
        let breatheUp = SKAction.scale(to: 1.018, duration: 1.2)
        breatheUp.timingMode = .easeInEaseOut
        let breatheDown = SKAction.scale(to: 1.0, duration: 1.3)
        breatheDown.timingMode = .easeInEaseOut
        let breatheCycle = SKAction.sequence([breatheUp, breatheDown])

        let delay = SKAction.wait(forDuration: phaseDelay.truncatingRemainder(dividingBy: 2.5))
        let idleAction = SKAction.sequence([delay, .repeatForever(breatheCycle)])
        run(idleAction, withKey: "idleBreathing")

        // Special tiles get an extra shimmer
        if configuredSpecial != nil {
            startSpecialShimmer()
        }
    }

    /// Adds a subtle shimmer sweep across special tiles.
    private func startSpecialShimmer() {
        let shimmer = SKSpriteNode(color: .white, size: CGSize(width: size.width * 0.15, height: size.height))
        shimmer.alpha = 0.0
        shimmer.zPosition = 8
        shimmer.position = CGPoint(x: -size.width / 2, y: 0)
        shimmer.blendMode = .add
        addChild(shimmer)

        let sweepDuration: TimeInterval = 1.8
        let pause: TimeInterval = 3.0

        let fadeIn = SKAction.fadeAlpha(to: 0.25, duration: 0.2)
        let sweep = SKAction.moveTo(x: size.width / 2, duration: sweepDuration)
        sweep.timingMode = .easeInEaseOut
        let fadeOut = SKAction.fadeAlpha(to: 0, duration: 0.2)
        let reset = SKAction.moveTo(x: -size.width / 2, duration: 0)
        let wait = SKAction.wait(forDuration: pause)

        let cycle = SKAction.sequence([fadeIn, sweep, fadeOut, reset, wait])
        shimmer.run(.repeatForever(cycle), withKey: "shimmer")
    }

    /// Stops idle breathing (call before match/drop animations).
    func stopIdleBreathing() {
        removeAction(forKey: "idleBreathing")
    }

    // MARK: - Spawn Animation

    /// Plays a scale-up-from-zero with bounce for newly spawned tiles
    /// (tiles that appear at the top after gravity fills empty cells).
    func playSpawnAnimation(delay: TimeInterval = 0, completion: (() -> Void)? = nil) {
        setScale(0)
        alpha = 0

        let wait = SKAction.wait(forDuration: delay)
        let scaleUp = SKAction.scale(to: 1.1, duration: 0.12)
        scaleUp.timingMode = .easeOut
        let settle = SKAction.scale(to: 1.0, duration: 0.08)
        settle.timingMode = .easeInEaseOut
        let fadeIn = SKAction.fadeAlpha(to: 1.0, duration: 0.12)

        let spawn = SKAction.sequence([
            wait,
            SKAction.group([SKAction.sequence([scaleUp, settle]), fadeIn])
        ])
        run(spawn) {
            completion?()
        }
    }

    // MARK: - Hint Glow

    /// Plays a pulsing golden glow to hint at a valid move.
    func playHintGlow() {
        removeAction(forKey: "hintGlow")

        let glowNode = SKShapeNode(rectOf: CGSize(width: size.width + 6, height: size.height + 6), cornerRadius: Layout.cornerRadius + 2)
        glowNode.fillColor = .clear
        glowNode.strokeColor = SKColor(red: 1, green: 0.88, blue: 0.28, alpha: 1) // Gold
        glowNode.lineWidth = 3
        glowNode.zPosition = 9
        glowNode.alpha = 0
        glowNode.name = "hintGlowNode"
        addChild(glowNode)

        let fadeIn = SKAction.fadeAlpha(to: 0.8, duration: 0.4)
        fadeIn.timingMode = .easeInEaseOut
        let fadeOut = SKAction.fadeAlpha(to: 0.2, duration: 0.4)
        fadeOut.timingMode = .easeInEaseOut
        let pulse = SKAction.repeatForever(SKAction.sequence([fadeIn, fadeOut]))

        // Also gently scale the tile itself
        let scaleUp = SKAction.scale(to: 1.06, duration: 0.5)
        scaleUp.timingMode = .easeInEaseOut
        let scaleDown = SKAction.scale(to: 1.0, duration: 0.5)
        scaleDown.timingMode = .easeInEaseOut
        let scalePulse = SKAction.repeatForever(SKAction.sequence([scaleUp, scaleDown]))

        glowNode.run(pulse)
        run(scalePulse, withKey: "hintGlow")
    }

    /// Removes the hint glow effect.
    func removeHintGlow() {
        removeAction(forKey: "hintGlow")
        setScale(1.0)
        childNode(withName: "hintGlowNode")?.removeFromParent()
    }

    // MARK: - Anticipatory Lean

    /// Tilts the tile slightly toward a direction to preview a swap.
    /// Call with nil to reset.
    func applyLean(toward direction: Position?) {
        removeAction(forKey: "lean")

        guard let dir = direction else {
            // Reset to neutral
            let reset = SKAction.group([
                SKAction.rotate(toAngle: 0, duration: 0.1),
                SKAction.move(to: CGPoint(x: position.x, y: position.y), duration: 0)
            ])
            run(reset, withKey: "lean")
            return
        }

        // Calculate lean angle and offset based on direction
        let leanAngle: CGFloat
        let offsetX: CGFloat
        let offsetY: CGFloat

        // Direction is the delta (target - source)
        let dr = dir.row
        let dc = dir.col

        if dc != 0 {
            // Horizontal lean
            leanAngle = CGFloat(dc) * -0.06  // Tilt opposite to lean direction
            offsetX = CGFloat(dc) * 3
            offsetY = 0
        } else {
            // Vertical lean
            leanAngle = CGFloat(dr) * 0.06
            offsetX = 0
            offsetY = CGFloat(-dr) * 3  // SpriteKit Y is inverted
        }

        let lean = SKAction.group([
            SKAction.rotate(toAngle: leanAngle, duration: 0.1),
        ])
        lean.timingMode = .easeOut
        run(lean, withKey: "lean")
    }

    // MARK: - Special Overlays

    private func configureSpecialOverlay(_ specialType: SpecialTileType?) {
        specialOverlay.removeAllChildren()
        specialOverlay.removeAllActions()

        guard let specialType = specialType else { return }

        switch specialType {
        case .bomb:
            configureBombOverlay()
        case .vibestreak:
            configureVibestreakOverlay()
        case .cosmicBlast:
            configureCosmicOverlay()
        }
    }

    private func configureBombOverlay() {
        // Web: border #FF3333 3-4px, crosshairs gold, red glow pulse 600ms
        let glowSize = self.size.width * 0.9
        let glow = SKShapeNode(circleOfRadius: glowSize / 2)
        glow.fillColor = SKColor(red: 1, green: 0, blue: 0, alpha: 0.2)
        glow.strokeColor = SKColor(red: 1, green: 0.2, blue: 0.2, alpha: 0.8)
        glow.lineWidth = 3.0
        specialOverlay.addChild(glow)

        let dim = SKAction.fadeAlpha(to: 0.4, duration: 0.3)
        let bright = SKAction.fadeAlpha(to: 1.0, duration: 0.3)
        glow.run(.repeatForever(.sequence([dim, bright])), withKey: "bombPulse")

        // Gold crosshair
        let hLine = SKShapeNode(rectOf: CGSize(width: size.width * 0.6, height: 2))
        hLine.fillColor = SKColor(red: 1, green: 0.88, blue: 0.28, alpha: 0.9)
        hLine.strokeColor = .clear
        specialOverlay.addChild(hLine)

        let vLine = SKShapeNode(rectOf: CGSize(width: 2, height: size.height * 0.6))
        vLine.fillColor = SKColor(red: 1, green: 0.88, blue: 0.28, alpha: 0.9)
        vLine.strokeColor = .clear
        specialOverlay.addChild(vLine)
    }

    private func configureVibestreakOverlay() {
        // Web: cyan #4AE0FF border, pulsing, laser scan lines
        let borderRect = CGRect(
            x: -size.width / 2 + 1,
            y: -size.height / 2 + 1,
            width: size.width - 2,
            height: size.height - 2
        )
        let path = UIBezierPath(roundedRect: borderRect, cornerRadius: Layout.cornerRadius)
        let cyanBorder = SKShapeNode(path: path.cgPath)
        cyanBorder.strokeColor = SKColor(red: 0.29, green: 0.88, blue: 1.0, alpha: 0.9)
        cyanBorder.lineWidth = 3.0
        cyanBorder.fillColor = .clear
        specialOverlay.addChild(cyanBorder)

        // Simple alpha pulse instead of per-frame SKColor allocation
        let dim = SKAction.fadeAlpha(to: 0.4, duration: 0.6)
        dim.timingMode = .easeInEaseOut
        let bright = SKAction.fadeAlpha(to: 1.0, duration: 0.6)
        bright.timingMode = .easeInEaseOut
        cyanBorder.run(.repeatForever(.sequence([dim, bright])), withKey: "vibestreakPulse")
    }

    private func configureCosmicOverlay() {
        // Web: conic-gradient swirl purple→pink→purple→blue, rotating
        let glow = SKShapeNode(circleOfRadius: size.width * 0.5)
        glow.fillColor = SKColor(red: 0.70, green: 0.40, blue: 1.0, alpha: 0.12)
        glow.strokeColor = SKColor(red: 0.70, green: 0.40, blue: 1.0, alpha: 0.7)
        glow.lineWidth = 2.0
        specialOverlay.addChild(glow)

        // Rotating glow
        let rotate = SKAction.rotate(byAngle: .pi * 2, duration: 3.0)
        glow.run(.repeatForever(rotate), withKey: "cosmicRotate")

        // Pulsing scale
        let scaleUp = SKAction.scale(to: 1.12, duration: 0.8)
        scaleUp.timingMode = .easeInEaseOut
        let scaleDown = SKAction.scale(to: 0.92, duration: 0.8)
        scaleDown.timingMode = .easeInEaseOut
        glow.run(.repeatForever(.sequence([scaleUp, scaleDown])), withKey: "cosmicPulse")
    }

    // MARK: - Helpers

    private func tierColor(for tier: BadgeTier) -> SKColor {
        switch tier {
        case .blue:    return Colors.blue
        case .silver:  return Colors.silver
        case .gold:    return Colors.gold
        case .special: return Colors.special
        case .cosmic:  return Colors.cosmic
        }
    }

    /// Generates a deterministic hue from a badge ID string.
    private func badgeHue(for id: String) -> CGFloat {
        var hash: UInt32 = 0
        for char in id.unicodeScalars {
            hash = hash &* 31 &+ char.value
        }
        return CGFloat(hash % 360) / 360.0
    }
}
