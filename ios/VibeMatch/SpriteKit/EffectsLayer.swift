import SpriteKit

// MARK: - Effect Intensity

/// Intensity levels for visual effects, escalating with match size and combo.
enum EffectIntensity: Int, Comparable {
    case normal = 0
    case big    = 1
    case mega   = 2
    case ultra  = 3

    static func < (lhs: EffectIntensity, rhs: EffectIntensity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    /// Derives intensity from a combo count.
    static func from(combo: Int) -> EffectIntensity {
        switch combo {
        case 0...1:  return .normal
        case 2...3:  return .big
        case 4...5:  return .mega
        default:     return .ultra
        }
    }
}

// MARK: - EffectsLayer

/// A dedicated SKNode layer for particle effects and screen overlays.
/// Sits above the board tiles and below UI elements.
/// Manages board glow, screen flashes, hot streak orbit particles,
/// and combo-reactive visual escalation.
final class EffectsLayer: SKNode {

    // MARK: - Constants

    private enum Colors {
        static let lavender   = SKColor(red: 108/255.0, green: 92/255.0, blue: 231/255.0, alpha: 1)
        static let darkBase   = SKColor(red: 26/255.0, green: 5/255.0, blue: 51/255.0, alpha: 1)
        static let gold       = SKColor(red: 255/255.0, green: 224/255.0, blue: 72/255.0, alpha: 1)
        static let orange     = SKColor(red: 255/255.0, green: 95/255.0, blue: 31/255.0, alpha: 1)
        static let cosmic     = SKColor(red: 179/255.0, green: 102/255.0, blue: 255/255.0, alpha: 1)
        static let flashWhite = SKColor(white: 1.0, alpha: 0.12)
        static let flashGold  = SKColor(red: 1, green: 0.88, blue: 0.28, alpha: 0.18)
        static let flashOrange = SKColor(red: 1, green: 0.37, blue: 0.12, alpha: 0.22)
        static let flashCosmic = SKColor(red: 0.70, green: 0.40, blue: 1, alpha: 0.28)
    }

    // MARK: - Child Nodes

    /// Full-scene overlay for screen flash effects.
    private let flashOverlay: SKSpriteNode

    /// Glow rectangle behind the board that escalates with combo.
    private let boardGlow: SKShapeNode

    /// Container for hot streak orbit particles.
    private let orbitContainer: SKNode

    /// Container for ambient floating particles.
    private let ambientContainer: SKNode

    /// Tracks currently active orbit particles for cleanup.
    private var activeOrbitParticles: [SKNode] = []

    /// Whether ambient particles are currently active.
    private var ambientActive = false

    // MARK: - Init

    override init() {
        // Flash overlay — covers the full scene, invisible by default.
        flashOverlay = SKSpriteNode(color: .clear, size: .zero)
        flashOverlay.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        flashOverlay.zPosition = 50
        flashOverlay.alpha = 0

        // Board glow — a soft rectangle behind the board.
        boardGlow = SKShapeNode()
        boardGlow.fillColor = Colors.lavender.withAlphaComponent(0.0)
        boardGlow.strokeColor = .clear
        boardGlow.zPosition = -1
        boardGlow.alpha = 0

        orbitContainer = SKNode()
        orbitContainer.zPosition = 40

        ambientContainer = SKNode()
        ambientContainer.zPosition = -2

        super.init()

        addChild(flashOverlay)
        addChild(boardGlow)
        addChild(orbitContainer)
        addChild(ambientContainer)
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Scene Size Updates

    /// Call this when the scene resizes so the flash overlay covers the full area.
    func updateSize(_ sceneSize: CGSize) {
        flashOverlay.size = sceneSize

        // Update board glow shape to roughly match the board area.
        let boardDim = min(sceneSize.width, sceneSize.height) * 0.96
        let rect = CGRect(
            x: -boardDim / 2,
            y: -boardDim / 2,
            width: boardDim,
            height: boardDim
        )
        let path = UIBezierPath(roundedRect: rect, cornerRadius: 16)
        boardGlow.path = path.cgPath
    }

    // MARK: - Board Glow

    /// Updates the board glow effect based on the current combo level.
    /// - normal (combo 0-1): no glow
    /// - hot (combo 2-3): subtle warm orange glow
    /// - fire (combo 4+): intense pulsing fire glow
    func updateBoardGlow(combo: Int) {
        boardGlow.removeAction(forKey: "glowPulse")

        if combo < 2 {
            // No glow
            let fadeOut = SKAction.fadeAlpha(to: 0, duration: 0.5)
            boardGlow.run(fadeOut, withKey: "glowTransition")
            return
        }

        let intensity = EffectIntensity.from(combo: combo)
        let glowColor: SKColor
        let glowAlpha: CGFloat
        let pulseRange: ClosedRange<CGFloat>

        switch intensity {
        case .normal:
            glowColor = Colors.lavender
            glowAlpha = 0.05
            pulseRange = 0.03...0.07
        case .big:
            glowColor = Colors.orange.withAlphaComponent(0.15)
            glowAlpha = 0.12
            pulseRange = 0.08...0.16
        case .mega:
            glowColor = Colors.orange.withAlphaComponent(0.25)
            glowAlpha = 0.20
            pulseRange = 0.14...0.26
        case .ultra:
            glowColor = Colors.cosmic.withAlphaComponent(0.30)
            glowAlpha = 0.28
            pulseRange = 0.20...0.36
        }

        boardGlow.fillColor = glowColor

        let fadeIn = SKAction.fadeAlpha(to: glowAlpha, duration: 0.3)
        boardGlow.run(fadeIn, withKey: "glowTransition")

        // Pulsing
        let pulseDim = SKAction.fadeAlpha(to: pulseRange.lowerBound, duration: 0.6)
        pulseDim.timingMode = .easeInEaseOut
        let pulseBright = SKAction.fadeAlpha(to: pulseRange.upperBound, duration: 0.6)
        pulseBright.timingMode = .easeInEaseOut
        boardGlow.run(.repeatForever(.sequence([pulseDim, pulseBright])), withKey: "glowPulse")
    }

    // MARK: - Screen Flash

    /// Triggers a full-screen flash effect at the given intensity.
    func screenFlash(intensity: EffectIntensity) {
        let color: SKColor
        let peakAlpha: CGFloat
        let duration: TimeInterval

        switch intensity {
        case .normal:
            color = Colors.flashWhite
            peakAlpha = 0.08
            duration = 0.25
        case .big:
            color = Colors.flashGold
            peakAlpha = 0.15
            duration = 0.3
        case .mega:
            color = Colors.flashOrange
            peakAlpha = 0.22
            duration = 0.35
        case .ultra:
            color = Colors.flashCosmic
            peakAlpha = 0.30
            duration = 0.45
        }

        flashOverlay.color = color
        flashOverlay.removeAction(forKey: "flash")

        let flashIn = SKAction.fadeAlpha(to: peakAlpha, duration: duration * 0.2)
        flashIn.timingMode = .easeOut
        let flashOut = SKAction.fadeAlpha(to: 0, duration: duration * 0.8)
        flashOut.timingMode = .easeIn

        flashOverlay.run(SKAction.sequence([flashIn, flashOut]), withKey: "flash")
    }

    // MARK: - Hot Streak Orbit Particles

    /// Spawns orbiting ember particles around the board edges.
    /// Call when combo >= 4. Intensity controls count, speed, and color.
    func showHotStreakParticles(combo: Int) {
        // Clean up existing orbit particles
        clearOrbitParticles()

        guard combo >= 4 else { return }

        let isUltra = combo >= 6
        let count = isUltra ? 12 : 8
        let colors: [SKColor] = [Colors.orange, Colors.gold, SKColor(red: 1, green: 0.55, blue: 0, alpha: 1)]

        for i in 0..<count {
            let size = CGFloat(isUltra ? 4 + (i % 3) * 2 : 3 + (i % 2) * 2)
            let particle = SKShapeNode(circleOfRadius: size / 2)
            particle.fillColor = colors[i % colors.count]
            particle.strokeColor = .clear
            particle.zPosition = 42

            // Position along the bottom edge, spread out.
            let xFraction = CGFloat(i) / CGFloat(count)
            let sceneWidth = (scene?.size.width ?? 400) * 0.9
            let startX = -sceneWidth / 2 + xFraction * sceneWidth
            let startY = -(scene?.size.height ?? 400) / 2 * 0.85

            particle.position = CGPoint(x: startX, y: startY)
            orbitContainer.addChild(particle)
            activeOrbitParticles.append(particle)

            // Float upward with sideways drift, then fade out and repeat.
            let travelY = CGFloat(60 + (i % 4) * 25)
            let driftX = CGFloat((i % 2 == 0 ? -1 : 1) * ((i % 3) + 1) * 6)
            let duration = TimeInterval(1.4 + Double(i % 3) * 0.3)
            let delay = TimeInterval(Double(i) * 0.18).truncatingRemainder(dividingBy: 1.2)

            let wait = SKAction.wait(forDuration: delay)
            let rise = SKAction.moveBy(x: driftX, y: travelY, duration: duration)
            rise.timingMode = .easeOut
            let fade = SKAction.fadeAlpha(to: 0, duration: duration * 0.7)
            let combined = SKAction.group([rise, fade])

            let reset = SKAction.group([
                SKAction.moveTo(y: startY, duration: 0),
                SKAction.moveTo(x: startX, duration: 0),
                SKAction.fadeAlpha(to: 1, duration: 0)
            ])

            let cycle = SKAction.sequence([wait, combined, reset])
            particle.run(.repeatForever(cycle), withKey: "orbitCycle")
        }
    }

    /// Removes all active orbit particles.
    func clearOrbitParticles() {
        for particle in activeOrbitParticles {
            particle.removeAllActions()
            particle.removeFromParent()
        }
        activeOrbitParticles.removeAll()
    }

    // MARK: - Combo-Reactive Update

    /// Master update method. Call each time the combo changes to adjust all
    /// effects layers in sync.
    func updateForCombo(_ combo: Int) {
        updateBoardGlow(combo: combo)

        if combo >= 4 {
            showHotStreakParticles(combo: combo)
        } else {
            clearOrbitParticles()
        }
    }

    // MARK: - Convenience Triggers

    /// Triggers effects appropriate for a match at the given intensity.
    func triggerMatchEffects(intensity: EffectIntensity) {
        screenFlash(intensity: intensity)

        if intensity >= .big {
            boardShake(intensity: intensity)
        }
    }

    // MARK: - Board Shake

    /// Shakes the scene camera for big matches. Uses camera-based shake for smooth results.
    /// Also triggers on big matches (combo >= 2) at lower intensity for more juice.
    private func boardShake(intensity: EffectIntensity) {
        guard let gameScene = scene as? GameScene else { return }

        let amplitude: CGFloat
        let duration: TimeInterval
        let frequency: TimeInterval

        switch intensity {
        case .normal:
            return
        case .big:
            amplitude = 5
            duration = 0.2
            frequency = 0.03
        case .mega:
            amplitude = 12
            duration = 0.3
            frequency = 0.025
        case .ultra:
            amplitude = 20
            duration = 0.45
            frequency = 0.02
        }

        gameScene.cameraShake(amplitude: amplitude, duration: duration, frequency: frequency)
    }

    // MARK: - Ambient Background Particles

    /// Starts ambient floating particles that drift slowly behind the board.
    /// Creates a subtle sense of life and depth. Call once when the game starts.
    func startAmbientParticles() {
        guard !ambientActive else { return }
        ambientActive = true

        let particleCount = 18
        let sceneWidth = (scene?.size.width ?? 400)
        let sceneHeight = (scene?.size.height ?? 800)

        let particleColors: [SKColor] = [
            Colors.lavender.withAlphaComponent(0.15),
            Colors.gold.withAlphaComponent(0.1),
            SKColor.white.withAlphaComponent(0.08),
            Colors.cosmic.withAlphaComponent(0.1)
        ]

        for i in 0..<particleCount {
            let size = CGFloat.random(in: 1.5...4)
            let particle = SKShapeNode(circleOfRadius: size)
            particle.fillColor = particleColors[i % particleColors.count]
            particle.strokeColor = .clear
            particle.zPosition = -1

            // Random starting position across the scene
            let startX = CGFloat.random(in: -sceneWidth/2...sceneWidth/2)
            let startY = CGFloat.random(in: -sceneHeight/2...sceneHeight/2)
            particle.position = CGPoint(x: startX, y: startY)
            particle.alpha = 0

            ambientContainer.addChild(particle)

            // Each particle drifts upward with gentle horizontal sway
            let cycleDuration = TimeInterval.random(in: 6...12)
            let driftY = CGFloat.random(in: 60...150)
            let swayX = CGFloat.random(in: -30...30)
            let startDelay = Double(i) * 0.5

            let fadeIn = SKAction.fadeAlpha(to: CGFloat.random(in: 0.15...0.4), duration: 1.5)
            let drift = SKAction.moveBy(x: swayX, y: driftY, duration: cycleDuration)
            drift.timingMode = .easeInEaseOut
            let pulse = SKAction.sequence([
                SKAction.scale(to: CGFloat.random(in: 1.2...1.6), duration: cycleDuration / 2),
                SKAction.scale(to: 1.0, duration: cycleDuration / 2)
            ])
            let fadeOut = SKAction.fadeAlpha(to: 0, duration: 1.5)

            let resetPos = SKAction.run {
                particle.position = CGPoint(
                    x: CGFloat.random(in: -sceneWidth/2...sceneWidth/2),
                    y: CGFloat.random(in: -sceneHeight/2...(sceneHeight * -0.1))
                )
            }

            let cycle = SKAction.sequence([
                SKAction.wait(forDuration: startDelay),
                fadeIn,
                SKAction.group([drift, pulse]),
                fadeOut,
                resetPos
            ])
            particle.run(.repeatForever(cycle))
        }
    }

    /// Stops ambient particles.
    func stopAmbientParticles() {
        ambientContainer.removeAllChildren()
        ambientActive = false
    }

    // MARK: - Urgency Overlay

    /// Applies a pulsing red vignette when moves are critically low.
    func setUrgencyOverlay(movesLeft: Int) {
        removeAction(forKey: "urgencyPulse")

        if movesLeft > 3 {
            // Clear urgency
            flashOverlay.removeAction(forKey: "urgencyGlow")
            flashOverlay.run(SKAction.fadeAlpha(to: 0, duration: 0.3), withKey: "urgencyFade")
            return
        }

        let pulseAlpha: CGFloat
        let pulseSpeed: TimeInterval
        let urgencyColor: SKColor

        switch movesLeft {
        case 3:
            urgencyColor = SKColor(red: 1, green: 0.3, blue: 0.1, alpha: 1)
            pulseAlpha = 0.06
            pulseSpeed = 1.2
        case 2:
            urgencyColor = SKColor(red: 1, green: 0.2, blue: 0.1, alpha: 1)
            pulseAlpha = 0.10
            pulseSpeed = 0.8
        default:
            urgencyColor = SKColor(red: 1, green: 0.1, blue: 0.05, alpha: 1)
            pulseAlpha = 0.15
            pulseSpeed = 0.5
        }

        flashOverlay.color = urgencyColor

        let pulseIn = SKAction.fadeAlpha(to: pulseAlpha, duration: pulseSpeed)
        pulseIn.timingMode = .easeInEaseOut
        let pulseOut = SKAction.fadeAlpha(to: pulseAlpha * 0.3, duration: pulseSpeed)
        pulseOut.timingMode = .easeInEaseOut

        flashOverlay.run(.repeatForever(.sequence([pulseIn, pulseOut])), withKey: "urgencyPulse")
    }
}
