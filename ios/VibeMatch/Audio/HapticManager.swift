import CoreHaptics
import UIKit

// MARK: - HapticManager

/// Core Haptics integration for VibeMatch.
/// All haptic patterns are designed to sync with audio playback timestamps.
final class HapticManager {

    // MARK: - Singleton

    static let shared = HapticManager()

    // MARK: - Properties

    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool = false

    /// User toggle for haptic feedback.
    var isEnabled: Bool = true {
        didSet {
            if isEnabled && engine == nil {
                prepare()
            }
        }
    }

    // MARK: - Init

    private init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        if supportsHaptics {
            prepare()
        }
    }

    // MARK: - Engine Lifecycle

    /// Start the haptic engine and configure stop/reset callbacks.
    func prepare() {
        guard supportsHaptics else { return }

        do {
            engine = try CHHapticEngine()

            // The engine stopped due to external event (audio session interruption, app backgrounded).
            engine?.stoppedHandler = { [weak self] reason in
                print("[HapticManager] Engine stopped: \(reason.rawValue)")
                self?.engine = nil
            }

            // The engine was reset (server died). Recreate and restart.
            engine?.resetHandler = { [weak self] in
                print("[HapticManager] Engine reset — restarting")
                do {
                    try self?.engine?.start()
                } catch {
                    print("[HapticManager] Failed to restart after reset: \(error)")
                    self?.engine = nil
                }
            }

            try engine?.start()
        } catch {
            print("[HapticManager] Failed to create/start haptic engine: \(error)")
            engine = nil
        }
    }

    /// Ensure the engine is running before playing a pattern.
    private func ensureEngine() -> CHHapticEngine? {
        guard supportsHaptics, isEnabled else { return nil }

        if engine == nil {
            prepare()
        }

        return engine
    }

    // MARK: - Tile Interaction

    /// Light tap for tile selection (intensity 0.4, sharpness 0.6).
    func playTileSelect() {
        guard let engine = ensureEngine() else { return }

        let events = [
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.4),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
                ],
                relativeTime: 0
            )
        ]

        playPattern(events: events, on: engine)
    }

    /// Double sharp negative tap for invalid swap feedback.
    func playInvalidSwap() {
        guard let engine = ensureEngine() else { return }

        let events = [
            // First sharp tap
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                ],
                relativeTime: 0
            ),
            // Second sharp tap — slightly weaker, 80ms later
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.5),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                ],
                relativeTime: 0.08
            )
        ]

        playPattern(events: events, on: engine)
    }

    // MARK: - Match Patterns

    /// Match haptic scaled by intensity tier.
    /// - normal: single medium tap
    /// - big: double tap with slight delay
    /// - mega: triple escalating taps
    /// - ultra: triple escalating taps + sustained rumble tail
    func playMatch(intensity: MatchIntensity) {
        guard let engine = ensureEngine() else { return }

        var events: [CHHapticEvent] = []

        switch intensity {
        case .normal:
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.5),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ],
                relativeTime: 0
            ))

        case .big:
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ],
                relativeTime: 0
            ))
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.8),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
                ],
                relativeTime: 0.06
            ))

        case .mega:
            let intensities: [Float] = [0.5, 0.7, 1.0]
            let sharpnesses: [Float] = [0.4, 0.6, 0.8]
            for i in 0..<3 {
                events.append(CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensities[i]),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpnesses[i])
                    ],
                    relativeTime: TimeInterval(i) * 0.05
                ))
            }

        case .ultra:
            // Escalating transient taps
            let intensities: [Float] = [0.5, 0.7, 1.0]
            let sharpnesses: [Float] = [0.4, 0.6, 0.8]
            for i in 0..<3 {
                events.append(CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensities[i]),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpnesses[i])
                    ],
                    relativeTime: TimeInterval(i) * 0.05
                ))
            }
            // Sustained rumble tail
            events.append(CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
                ],
                relativeTime: 0.15,
                duration: 0.3
            ))
        }

        playPattern(events: events, on: engine)
    }

    // MARK: - Combo Patterns

    /// Escalating buzz patterns that increase with combo level.
    /// Each level adds another transient hit and increases intensity.
    func playCombo(level: Int) {
        guard let engine = ensureEngine() else { return }

        let clampedLevel = max(1, min(6, level))
        var events: [CHHapticEvent] = []

        // Number of hits scales with level (2 at level 1, up to 5 at level 6)
        let hitCount = min(clampedLevel + 1, 5)
        let baseIntensity: Float = 0.3 + Float(clampedLevel) * 0.1
        let spacing: TimeInterval = 0.04

        for i in 0..<hitCount {
            let intensity = min(1.0, baseIntensity + Float(i) * 0.1)
            let sharpness: Float = 0.4 + Float(clampedLevel) * 0.08

            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: min(1.0, sharpness))
                ],
                relativeTime: TimeInterval(i) * spacing
            ))
        }

        // At level 4+, add a continuous buzz tail
        if clampedLevel >= 4 {
            let tailIntensity: Float = min(1.0, 0.5 + Float(clampedLevel - 4) * 0.2)
            events.append(CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: tailIntensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
                ],
                relativeTime: TimeInterval(hitCount) * spacing,
                duration: 0.2
            ))
        }

        playPattern(events: events, on: engine)
    }

    // MARK: - Special Tile Patterns

    /// Sharp heavy impact for bomb explosion (intensity 1.0).
    func playBombExplosion() {
        guard let engine = ensureEngine() else { return }

        let events = [
            // Initial sharp impact
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8)
                ],
                relativeTime: 0
            ),
            // Sustained rumble aftershock
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
                ],
                relativeTime: 0.05,
                duration: 0.35
            )
        ]

        // Decay curve on the rumble: ramp intensity from 0.7 to 0.1 over 350ms
        let decayCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.05, value: 1.0),
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.40, value: 0.1)
            ],
            relativeTime: 0
        )

        playPattern(events: events, parameterCurves: [decayCurve], on: engine)
    }

    /// Continuous sweep ramp for vibestreak activation (0.3 to 0.9 over 400ms).
    func playVibestreak() {
        guard let engine = ensureEngine() else { return }

        let events = [
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ],
                relativeTime: 0,
                duration: 0.4
            )
        ]

        // Intensity ramp: 0.3 -> 0.9 over 400ms
        let rampCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 0.33),
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.4, value: 1.0)
            ],
            relativeTime: 0
        )

        // Sharpness sweep: low to high
        let sharpnessCurve = CHHapticParameterCurve(
            parameterID: .hapticSharpnessControl,
            controlPoints: [
                CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 0.3),
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.4, value: 0.8)
            ],
            relativeTime: 0
        )

        playPattern(events: events, parameterCurves: [rampCurve, sharpnessCurve], on: engine)
    }

    /// Long rumble for cosmic blast (0.8 intensity, 500ms).
    func playCosmicBlast() {
        guard let engine = ensureEngine() else { return }

        let events = [
            // Initial sharp transient
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.7)
                ],
                relativeTime: 0
            ),
            // Long rumble
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.8),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.4)
                ],
                relativeTime: 0.03,
                duration: 0.5
            )
        ]

        // Decay the rumble over its duration
        let decayCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.03, value: 1.0),
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.53, value: 0.2)
            ],
            relativeTime: 0
        )

        playPattern(events: events, parameterCurves: [decayCurve], on: engine)
    }

    // MARK: - Game Flow Patterns

    /// Descending intensity pattern for game over — feels like deflation.
    func playGameOver() {
        guard let engine = ensureEngine() else { return }

        var events: [CHHapticEvent] = []

        // Four descending taps matching the descending melody (G5-E5-C5-G4)
        let intensities: [Float] = [0.8, 0.6, 0.4, 0.3]
        let timings: [TimeInterval] = [0.0, 0.15, 0.30, 0.45]
        let sharpnesses: [Float] = [0.7, 0.5, 0.3, 0.2]

        for i in 0..<4 {
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensities[i]),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpnesses[i])
                ],
                relativeTime: timings[i]
            ))
        }

        // Final sustained low rumble — fading out
        events.append(CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.1)
            ],
            relativeTime: 0.50,
            duration: 0.5
        ))

        playPattern(events: events, on: engine)
    }

    /// Ascending celebration series for victory.
    func playVictory() {
        guard let engine = ensureEngine() else { return }

        var events: [CHHapticEvent] = []

        // Six ascending taps matching the victory fanfare
        let intensities: [Float] = [0.4, 0.5, 0.6, 0.7, 0.8, 1.0]
        let sharpnesses: [Float] = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

        for i in 0..<6 {
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensities[i]),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpnesses[i])
                ],
                relativeTime: TimeInterval(i) * 0.06
            ))
        }

        // Celebration sustained buzz at the end
        events.append(CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.7)
            ],
            relativeTime: 0.36,
            duration: 0.3
        ))

        playPattern(events: events, on: engine)
    }

    // MARK: - Cascade

    /// Increasing intensity per cascade level — each cascade feels bigger than the last.
    func playCascade(level: Int) {
        guard let engine = ensureEngine() else { return }

        let clampedLevel = max(1, min(5, level))
        let baseIntensity: Float = 0.3 + Float(clampedLevel) * 0.12
        let sharpness: Float = 0.4 + Float(clampedLevel) * 0.1

        var events: [CHHapticEvent] = []

        // Ascending triple tap like the audio cascade
        for i in 0..<3 {
            let tapIntensity = min(1.0, baseIntensity + Float(i) * 0.1)
            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: tapIntensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: min(1.0, sharpness))
                ],
                relativeTime: TimeInterval(i) * 0.04
            ))
        }

        playPattern(events: events, on: engine)
    }

    // MARK: - Collection Patterns

    /// Building anticipation rumble for chest opening.
    func playChestOpen() {
        guard let engine = ensureEngine() else { return }

        let events = [
            // Low rumble building up
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
                ],
                relativeTime: 0,
                duration: 0.35
            ),
            // Sharp reveal impact
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.7)
                ],
                relativeTime: 0.35
            )
        ]

        // Build intensity from 0.3 to 0.7 during the rumble
        let buildCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 0.4),
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.35, value: 1.0)
            ],
            relativeTime: 0
        )

        playPattern(events: events, parameterCurves: [buildCurve], on: engine)
    }

    /// Badge reveal with tier-appropriate impact weight (heavier for rarer tiers).
    func playBadgeReveal(tier: BadgeTier) {
        guard let engine = ensureEngine() else { return }

        let intensity: Float
        let sharpness: Float
        let hasTail: Bool

        switch tier {
        case .blue:
            intensity = 0.4; sharpness = 0.5; hasTail = false
        case .silver:
            intensity = 0.6; sharpness = 0.6; hasTail = false
        case .gold:
            intensity = 0.8; sharpness = 0.7; hasTail = true
        case .cosmic:
            intensity = 1.0; sharpness = 0.8; hasTail = true
        }

        var events = [
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
                ],
                relativeTime: 0
            )
        ]

        if hasTail {
            // Sustained rumble tail proportional to rarity
            let tailDuration: TimeInterval
            let tailIntensity: Float
            switch tier {
            case .gold: tailDuration = 0.2; tailIntensity = 0.4
            case .cosmic: tailDuration = 0.4; tailIntensity = 0.6
            default: tailDuration = 0; tailIntensity = 0
            }
            if tailDuration > 0 {
                events.append(CHHapticEvent(
                    eventType: .hapticContinuous,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: tailIntensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
                    ],
                    relativeTime: 0.05,
                    duration: tailDuration
                ))
            }
        }

        playPattern(events: events, on: engine)
    }

    // MARK: - Pattern Player Utility

    private func playPattern(
        events: [CHHapticEvent],
        parameterCurves: [CHHapticParameterCurve] = [],
        on engine: CHHapticEngine
    ) {
        do {
            let pattern = try CHHapticPattern(events: events, parameterCurves: parameterCurves)
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            print("[HapticManager] Failed to play haptic pattern: \(error)")
        }
    }
}
