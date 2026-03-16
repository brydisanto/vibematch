import SpriteKit

// MARK: - TileNode

/// An SKNode subclass representing a single tile on the match-3 board.
/// Displays a badge placeholder with tier-colored border, special tile overlays,
/// and supports selection highlight and match/drop animations.
final class TileNode: SKSpriteNode {

    // MARK: - Constants

    private enum Colors {
        static let blue    = SKColor(red: 0x94/255, green: 0xA3/255, blue: 0xB8/255, alpha: 1)
        static let silver  = SKColor(red: 0x4A/255, green: 0x9E/255, blue: 0xFF/255, alpha: 1)
        static let gold    = SKColor(red: 0xFF/255, green: 0xE0/255, blue: 0x48/255, alpha: 1)
        static let cosmic  = SKColor(red: 0xB3/255, green: 0x66/255, blue: 0xFF/255, alpha: 1)
        static let lavender = SKColor(red: 0x6C/255, green: 0x5C/255, blue: 0xE7/255, alpha: 1)
        static let darkBase = SKColor(red: 0x1A/255, green: 0x1A/255, blue: 0x2E/255, alpha: 1)
    }

    private enum Layout {
        static let borderWidth: CGFloat = 2.0
        static let cornerRadius: CGFloat = 6.0
        static let badgeInset: CGFloat = 4.0
    }

    // MARK: - Child Nodes

    /// The colored rectangle placeholder for the badge image.
    private let badgePlaceholder: SKSpriteNode
    /// Label showing the badge name on top of the placeholder.
    private let badgeLabel: SKLabelNode
    /// Border shape drawn as a rounded rectangle outline.
    private let borderNode: SKShapeNode
    /// Selection highlight outline, hidden by default.
    private let selectionRing: SKShapeNode
    /// Overlay node for special tile indicators (bomb, vibestreak, cosmic).
    private let specialOverlay: SKNode

    // MARK: - State

    private(set) var boardRow: Int = 0
    private(set) var boardCol: Int = 0
    private var isCurrentlySelected: Bool = false

    // MARK: - Init

    init(tileSize: CGSize) {
        // Badge placeholder — filled with a tier color, slightly inset.
        let insetSize = CGSize(
            width: tileSize.width - Layout.badgeInset * 2,
            height: tileSize.height - Layout.badgeInset * 2
        )
        badgePlaceholder = SKSpriteNode(color: .darkGray, size: insetSize)
        badgePlaceholder.zPosition = 1

        // Badge name label centered on the placeholder.
        badgeLabel = SKLabelNode(fontNamed: "Helvetica-Bold")
        badgeLabel.fontSize = max(8, tileSize.width * 0.15)
        badgeLabel.fontColor = .white
        badgeLabel.verticalAlignmentMode = .center
        badgeLabel.horizontalAlignmentMode = .center
        badgeLabel.zPosition = 2
        badgeLabel.numberOfLines = 2
        badgeLabel.preferredMaxLayoutWidth = insetSize.width - 4

        // Border outline
        let borderRect = CGRect(
            x: -tileSize.width / 2,
            y: -tileSize.height / 2,
            width: tileSize.width,
            height: tileSize.height
        )
        let borderPath = UIBezierPath(roundedRect: borderRect, cornerRadius: Layout.cornerRadius)
        borderNode = SKShapeNode(path: borderPath.cgPath)
        borderNode.strokeColor = Colors.blue
        borderNode.lineWidth = Layout.borderWidth
        borderNode.fillColor = .clear
        borderNode.zPosition = 3

        // Selection ring — slightly larger outline that pulses.
        let selRect = borderRect.insetBy(dx: -2, dy: -2)
        let selPath = UIBezierPath(roundedRect: selRect, cornerRadius: Layout.cornerRadius + 2)
        selectionRing = SKShapeNode(path: selPath.cgPath)
        selectionRing.strokeColor = Colors.lavender
        selectionRing.lineWidth = 3.0
        selectionRing.fillColor = .clear
        selectionRing.zPosition = 5
        selectionRing.isHidden = true
        selectionRing.alpha = 0.0

        // Special overlay container
        specialOverlay = SKNode()
        specialOverlay.zPosition = 4

        super.init(texture: nil, color: .clear, size: tileSize)

        addChild(badgePlaceholder)
        addChild(badgeLabel)
        addChild(borderNode)
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
    /// Call this whenever the board state changes for this position.
    func configure(cell: Cell, badge: Badge, row: Int, col: Int) {
        boardRow = row
        boardCol = col

        // Update placeholder color to a hue derived from the badge id
        // so each badge type looks distinct, with tier brightness.
        let hue = badgeHue(for: badge.id)
        let saturation: CGFloat = 0.65
        let brightness: CGFloat
        switch badge.tier {
        case .blue:    brightness = 0.45
        case .silver:  brightness = 0.60
        case .gold:    brightness = 0.75
        case .cosmic:  brightness = 0.90
        }
        badgePlaceholder.color = SKColor(hue: hue, saturation: saturation, brightness: brightness, alpha: 1.0)

        // Update label
        badgeLabel.text = badge.name

        // Update border color based on tier
        borderNode.strokeColor = tierColor(for: badge.tier)

        // Update special overlay
        configureSpecialOverlay(cell.isSpecial)
    }

    // MARK: - Selection

    /// Shows or hides the selection highlight with a pulse animation.
    func setSelected(_ selected: Bool) {
        guard selected != isCurrentlySelected else { return }
        isCurrentlySelected = selected

        selectionRing.removeAllActions()

        if selected {
            selectionRing.isHidden = false
            selectionRing.alpha = 1.0
            let fadeOut = SKAction.fadeAlpha(to: 0.4, duration: 0.5)
            let fadeIn = SKAction.fadeAlpha(to: 1.0, duration: 0.5)
            let pulse = SKAction.sequence([fadeOut, fadeIn])
            selectionRing.run(.repeatForever(pulse), withKey: "selectionPulse")
        } else {
            let fadeOut = SKAction.fadeAlpha(to: 0.0, duration: 0.15)
            selectionRing.run(fadeOut) { [weak self] in
                self?.selectionRing.isHidden = true
            }
        }
    }

    // MARK: - Animations

    /// Plays a match animation: flash white and scale to zero.
    func playMatchAnimation(completion: (() -> Void)? = nil) {
        let flash = SKAction.sequence([
            SKAction.colorize(with: .white, colorBlendFactor: 1.0, duration: 0.1),
            SKAction.colorize(withColorBlendFactor: 0.0, duration: 0.1)
        ])
        let shrink = SKAction.scale(to: 0.0, duration: 0.3)
        shrink.timingMode = .easeIn
        let fadeOut = SKAction.fadeAlpha(to: 0.0, duration: 0.3)

        let group = SKAction.group([flash, shrink, fadeOut])
        run(group) {
            completion?()
        }
    }

    /// Plays a drop animation from a higher row to this tile's current position.
    func playDropAnimation(fromRow: Int, toRow: Int, tileHeight: CGFloat, completion: (() -> Void)? = nil) {
        let rowDiff = CGFloat(toRow - fromRow)
        let dropDistance = rowDiff * tileHeight

        // Start at the offset position
        let originalY = position.y
        position.y = originalY + dropDistance

        // Animate down with bounce easing
        let moveDown = SKAction.moveTo(y: originalY, duration: 0.4)
        moveDown.timingMode = .easeIn

        // Slight bounce at the end
        let overshoot = SKAction.moveTo(y: originalY - 4, duration: 0.08)
        overshoot.timingMode = .easeOut
        let settleBack = SKAction.moveTo(y: originalY, duration: 0.08)
        settleBack.timingMode = .easeOut

        let sequence = SKAction.sequence([moveDown, overshoot, settleBack])
        run(sequence) {
            completion?()
        }
    }

    /// Resets scale and alpha after animations.
    func resetAppearance() {
        setScale(1.0)
        alpha = 1.0
        badgePlaceholder.colorBlendFactor = 0.0
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
        let glowSize = self.size.width * 0.9
        let glow = SKShapeNode(circleOfRadius: glowSize / 2)
        glow.fillColor = SKColor(red: 1, green: 0, blue: 0, alpha: 0.25)
        glow.strokeColor = SKColor(red: 1, green: 0.2, blue: 0.2, alpha: 0.8)
        glow.lineWidth = 2.0
        glow.glowWidth = 6.0
        specialOverlay.addChild(glow)

        // Pulsing red glow
        let dim = SKAction.fadeAlpha(to: 0.4, duration: 0.6)
        let bright = SKAction.fadeAlpha(to: 1.0, duration: 0.6)
        glow.run(.repeatForever(.sequence([dim, bright])), withKey: "bombPulse")

        // Crosshair lines
        let hLine = SKShapeNode(rectOf: CGSize(width: size.width * 0.6, height: 1.5))
        hLine.fillColor = SKColor(red: 1, green: 0.88, blue: 0.28, alpha: 0.8)
        hLine.strokeColor = .clear
        specialOverlay.addChild(hLine)

        let vLine = SKShapeNode(rectOf: CGSize(width: 1.5, height: size.height * 0.6))
        vLine.fillColor = SKColor(red: 1, green: 0.88, blue: 0.28, alpha: 0.8)
        vLine.strokeColor = .clear
        specialOverlay.addChild(vLine)
    }

    private func configureVibestreakOverlay() {
        // Rainbow border cycling through colors
        let borderRect = CGRect(
            x: -size.width / 2 + 1,
            y: -size.height / 2 + 1,
            width: size.width - 2,
            height: size.height - 2
        )
        let path = UIBezierPath(roundedRect: borderRect, cornerRadius: Layout.cornerRadius)
        let rainbowBorder = SKShapeNode(path: path.cgPath)
        rainbowBorder.strokeColor = SKColor(red: 0.29, green: 0.62, blue: 1, alpha: 0.9)
        rainbowBorder.lineWidth = 3.0
        rainbowBorder.fillColor = .clear
        specialOverlay.addChild(rainbowBorder)

        // Cycle colors: blue -> gold -> purple -> blue
        let toGold = SKAction.customAction(withDuration: 0.8) { node, elapsed in
            let t = elapsed / 0.8
            guard let shape = node as? SKShapeNode else { return }
            shape.strokeColor = SKColor(
                red: 0.29 + t * 0.71,
                green: 0.62 + t * 0.26,
                blue: 1.0 - t * 0.72,
                alpha: 0.9
            )
        }
        let toPurple = SKAction.customAction(withDuration: 0.8) { node, elapsed in
            let t = elapsed / 0.8
            guard let shape = node as? SKShapeNode else { return }
            shape.strokeColor = SKColor(
                red: 1.0 - t * 0.30,
                green: 0.88 - t * 0.48,
                blue: 0.28 + t * 0.72,
                alpha: 0.9
            )
        }
        let toBlue = SKAction.customAction(withDuration: 0.8) { node, elapsed in
            let t = elapsed / 0.8
            guard let shape = node as? SKShapeNode else { return }
            shape.strokeColor = SKColor(
                red: 0.70 - t * 0.41,
                green: 0.40 + t * 0.22,
                blue: 1.0,
                alpha: 0.9
            )
        }
        rainbowBorder.run(.repeatForever(.sequence([toGold, toPurple, toBlue])), withKey: "rainbow")
    }

    private func configureCosmicOverlay() {
        let glow = SKShapeNode(circleOfRadius: size.width * 0.5)
        glow.fillColor = SKColor(red: 0.70, green: 0.40, blue: 1.0, alpha: 0.15)
        glow.strokeColor = SKColor(red: 0.70, green: 0.40, blue: 1.0, alpha: 0.6)
        glow.lineWidth = 2.0
        glow.glowWidth = 8.0
        specialOverlay.addChild(glow)

        // Purple pulsing
        let scaleUp = SKAction.scale(to: 1.15, duration: 0.7)
        scaleUp.timingMode = .easeInEaseOut
        let scaleDown = SKAction.scale(to: 0.95, duration: 0.7)
        scaleDown.timingMode = .easeInEaseOut
        glow.run(.repeatForever(.sequence([scaleUp, scaleDown])), withKey: "cosmicPulse")
    }

    // MARK: - Helpers

    private func tierColor(for tier: BadgeTier) -> SKColor {
        switch tier {
        case .blue:   return Colors.blue
        case .silver: return Colors.silver
        case .gold:   return Colors.gold
        case .cosmic: return Colors.cosmic
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
