import AVFoundation

// MARK: - SoundSynthesizer
// Procedural sound generation for placeholder SFX.
// Every buffer here is a synthesized stand-in. Replace each with a professionally
// designed sample once audio production is complete.

final class SoundSynthesizer {

    // MARK: - Constants

    static let sampleRate: Double = 44100.0
    private static let format = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: sampleRate,
        channels: 1,
        interleaved: false
    )!

    // MARK: - Cache

    /// Pre-generated buffers keyed by a canonical string for each GameSound variant.
    private var cache: [String: AVAudioPCMBuffer] = [:]

    // MARK: - Init

    init() {
        generateAll()
    }

    // MARK: - Public API

    /// Returns a cached buffer for the given sound, or nil if not yet generated.
    func buffer(for sound: GameSound) -> AVAudioPCMBuffer? {
        return cache[sound.cacheKey]
    }

    /// The shared audio format used by all synthesized buffers.
    var format: AVAudioFormat {
        return Self.format
    }

    // MARK: - Generation Dispatch

    private func generateAll() {
        // Core match
        // TODO: Replace match3 with professional ascending chime sample
        cache[GameSound.match3.cacheKey] = generateMatch3()
        // TODO: Replace match4 with professional chord + sparkle sample
        cache[GameSound.match4.cacheKey] = generateMatch4()
        // TODO: Replace match5Plus with professional epic fanfare sample
        cache[GameSound.match5Plus.cacheKey] = generateMatch5()

        // Tile interaction
        // TODO: Replace tileSelect with professional soft click sample
        cache[GameSound.tileSelect.cacheKey] = generateTileSelect()
        // TODO: Replace tileDeselect with professional soft release sample
        cache[GameSound.tileDeselect.cacheKey] = generateTileDeselect()
        // TODO: Replace invalidSwap with professional negative feedback sample
        cache[GameSound.invalidSwap.cacheKey] = generateInvalidSwap()
        // TODO: Replace tileSwap with professional whoosh/swap sample
        cache[GameSound.tileSwap.cacheKey] = generateTileSwap()
        // TODO: Replace tileLand with professional percussive landing sample
        cache[GameSound.tileLand.cacheKey] = generateTileLand()

        // Special tiles
        // TODO: Replace bombActivate with professional explosion sample
        cache[GameSound.bombActivate.cacheKey] = generateBombExplosion()
        // TODO: Replace vibestreakActivate with professional electric zap sample
        cache[GameSound.vibestreakActivate.cacheKey] = generateVibestreak()
        // TODO: Replace cosmicBlastActivate with professional ethereal sweep sample
        cache[GameSound.cosmicBlastActivate.cacheKey] = generateCosmicBlast()
        // TODO: Replace specialCreate with professional power-up creation sample
        cache[GameSound.specialCreate.cacheKey] = generateSpecialCreate()

        // Combo tiers 1-6
        for level in 1...6 {
            // TODO: Replace combo tier \(level) with professional escalating combo sample
            cache[GameSound.combo(level: level).cacheKey] = generateCombo(level: level)
        }

        // Shape bonuses
        // TODO: Replace shape bonus sounds with professional chord stab samples
        cache[GameSound.shapeBonus(.L).cacheKey] = generateShapeBonus(shape: .L)
        cache[GameSound.shapeBonus(.T).cacheKey] = generateShapeBonus(shape: .T)
        cache[GameSound.shapeBonus(.cross).cacheKey] = generateShapeBonus(shape: .cross)
        cache[GameSound.shapeBonus(.square).cacheKey] = generateShapeBonus(shape: .square)

        // Cascade levels 1-5
        for level in 1...5 {
            // TODO: Replace cascade level \(level) with professional cascading sparkle sample
            cache[GameSound.cascade(level: level).cacheKey] = generateCascade(level: level)
        }

        // Game flow
        // TODO: Replace gameStart with professional session opener sample
        cache[GameSound.gameStart.cacheKey] = generateGameStart()
        // TODO: Replace gameOver with professional descending defeat sample
        cache[GameSound.gameOver.cacheKey] = generateGameOver()
        // TODO: Replace victory with professional celebration fanfare sample
        cache[GameSound.victory.cacheKey] = generateVictory()
        // TODO: Replace newHighScore with professional high-score celebration sample
        cache[GameSound.newHighScore.cacheKey] = generateNewHighScore()
        // TODO: Replace finalMoveWarning with professional heartbeat tension samples
        for moves in 1...3 {
            cache[GameSound.finalMoveWarning(movesLeft: moves).cacheKey] =
                generateFinalMoveWarning(movesLeft: moves)
        }

        // UI
        // TODO: Replace uiClick with professional UI click sample (PCM, zero-latency)
        cache[GameSound.uiClick.cacheKey] = generateUIClick()
        // TODO: Replace menuOpen with professional menu open sample
        cache[GameSound.menuOpen.cacheKey] = generateMenuOpen()
        // TODO: Replace menuClose with professional menu close sample
        cache[GameSound.menuClose.cacheKey] = generateMenuClose()

        // Collection
        // TODO: Replace chestAppear with professional chest appearance sample
        cache[GameSound.chestAppear.cacheKey] = generateChestAppear()
        // TODO: Replace chestOpen with professional chest opening sample
        cache[GameSound.chestOpen.cacheKey] = generateChestOpen()
        // TODO: Replace badgeReveal with professional badge reveal samples per tier
        cache[GameSound.badgeReveal(.common).cacheKey] = generateBadgeReveal(tier: .common)
        cache[GameSound.badgeReveal(.uncommon).cacheKey] = generateBadgeReveal(tier: .uncommon)
        cache[GameSound.badgeReveal(.rare).cacheKey] = generateBadgeReveal(tier: .rare)
        cache[GameSound.badgeReveal(.epic).cacheKey] = generateBadgeReveal(tier: .epic)
        cache[GameSound.badgeReveal(.legendary).cacheKey] = generateBadgeReveal(tier: .legendary)
        // TODO: Replace newBadgeDiscovered with professional discovery fanfare sample
        cache[GameSound.newBadgeDiscovered.cacheKey] = generateNewBadgeDiscovered()

        // Hint
        // TODO: Replace hint with professional gentle nudge sample
        cache[GameSound.hint.cacheKey] = generateHint()

        // Milestone
        // TODO: Replace milestone with professional milestone victory sting sample
        cache[GameSound.milestone.cacheKey] = generateMilestone()
    }

    // MARK: - Buffer Factory

    private func makeBuffer(duration: TimeInterval) -> AVAudioPCMBuffer {
        let frameCount = AVAudioFrameCount(Self.sampleRate * duration)
        let buffer = AVAudioPCMBuffer(pcmFormat: Self.format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount
        return buffer
    }

    // MARK: - DSP Primitives

    /// Write a sine tone into the buffer starting at sampleOffset, with ADSR envelope.
    private func addTone(
        to buffer: AVAudioPCMBuffer,
        frequency: Float,
        amplitude: Float,
        startSample: Int,
        sampleCount: Int,
        waveform: Waveform = .sine,
        attackSamples: Int = 882,  // 20ms at 44100
        releaseSamples: Int = 882
    ) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let sr = Float(Self.sampleRate)
        let totalFrames = Int(buffer.frameLength)

        for i in 0..<sampleCount {
            let index = startSample + i
            guard index < totalFrames else { break }

            let phase = Float(i) / sr * frequency
            var sample: Float

            switch waveform {
            case .sine:
                sample = sinf(2.0 * .pi * phase)
            case .sawtooth:
                let p = phase - floorf(phase)
                sample = 2.0 * p - 1.0
            case .square:
                let p = phase - floorf(phase)
                sample = p < 0.5 ? 1.0 : -1.0
            case .triangle:
                let p = phase - floorf(phase)
                sample = 4.0 * abs(p - 0.5) - 1.0
            }

            // ADSR envelope (attack / sustain / release)
            var envelope: Float = 1.0
            if i < attackSamples {
                envelope = Float(i) / Float(attackSamples)
            } else if i > sampleCount - releaseSamples {
                let releaseIndex = i - (sampleCount - releaseSamples)
                envelope = 1.0 - Float(releaseIndex) / Float(releaseSamples)
            }
            envelope = max(0, min(1, envelope))

            data[index] += sample * amplitude * envelope
        }
    }

    /// Write white noise into the buffer with a decay envelope.
    private func addNoise(
        to buffer: AVAudioPCMBuffer,
        amplitude: Float,
        startSample: Int,
        sampleCount: Int,
        decayPower: Float = 1.0
    ) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let totalFrames = Int(buffer.frameLength)

        for i in 0..<sampleCount {
            let index = startSample + i
            guard index < totalFrames else { break }
            let progress = Float(i) / Float(sampleCount)
            let envelope = powf(1.0 - progress, decayPower)
            let noise = Float.random(in: -1.0...1.0)
            data[index] += noise * amplitude * envelope
        }
    }

    /// Apply a simple single-pole low-pass filter in-place.
    private func applyLowPass(to buffer: AVAudioPCMBuffer, cutoffHz: Float) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let frameCount = Int(buffer.frameLength)
        let rc = 1.0 / (2.0 * Float.pi * cutoffHz)
        let dt = 1.0 / Float(Self.sampleRate)
        let alpha = dt / (rc + dt)

        var prev: Float = 0
        for i in 0..<frameCount {
            prev = prev + alpha * (data[i] - prev)
            data[i] = prev
        }
    }

    /// Clamp all samples to [-1, 1].
    private func clamp(_ buffer: AVAudioPCMBuffer) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let frameCount = Int(buffer.frameLength)
        for i in 0..<frameCount {
            data[i] = max(-1.0, min(1.0, data[i]))
        }
    }

    // MARK: - Sound Generators

    // -- Match 3: C5-E5-G5 ascending sawtooth tones with low-pass for warmth --
    private func generateMatch3() -> AVAudioPCMBuffer {
        let duration = 0.35
        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)

        // C5 (523Hz), E5 (659Hz), G5 (784Hz) — staggered
        addTone(to: buffer, frequency: 523, amplitude: 0.25, startSample: 0,
                sampleCount: Int(0.12 * Double(sr)), waveform: .sawtooth)
        addTone(to: buffer, frequency: 659, amplitude: 0.25, startSample: Int(0.06 * Double(sr)),
                sampleCount: Int(0.12 * Double(sr)), waveform: .sawtooth)
        addTone(to: buffer, frequency: 784, amplitude: 0.30, startSample: Int(0.12 * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .sawtooth)

        applyLowPass(to: buffer, cutoffHz: 3000)
        clamp(buffer)
        return buffer
    }

    // -- Match 4: C5-E5-G5-C6 ascending chord + sparkle noise --
    private func generateMatch4() -> AVAudioPCMBuffer {
        let duration = 0.45
        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 523, amplitude: 0.22, startSample: 0,
                sampleCount: Int(0.15 * Double(sr)), waveform: .sawtooth)
        addTone(to: buffer, frequency: 659, amplitude: 0.20, startSample: Int(0.05 * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
        addTone(to: buffer, frequency: 784, amplitude: 0.22, startSample: Int(0.10 * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .sawtooth)
        addTone(to: buffer, frequency: 1047, amplitude: 0.28, startSample: Int(0.15 * Double(sr)),
                sampleCount: Int(0.20 * Double(sr)), waveform: .sine)
        addNoise(to: buffer, amplitude: 0.06, startSample: Int(0.10 * Double(sr)),
                 sampleCount: Int(0.15 * Double(sr)))

        applyLowPass(to: buffer, cutoffHz: 4000)
        clamp(buffer)
        return buffer
    }

    // -- Match 5+: C5-E5-G5-C6-E6 arpeggio with sub bass and noise tail --
    private func generateMatch5() -> AVAudioPCMBuffer {
        let duration = 0.55
        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)

        let notes: [(Float, Double)] = [
            (523, 0.0), (659, 0.04), (784, 0.08), (1047, 0.12), (1319, 0.16)
        ]
        for (freq, delay) in notes {
            addTone(to: buffer, frequency: freq, amplitude: 0.22,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.15 * Double(sr)), waveform: .sawtooth)
        }
        // Sub bass thump
        addTone(to: buffer, frequency: 80, amplitude: 0.25,
                startSample: Int(0.08 * Double(sr)),
                sampleCount: Int(0.30 * Double(sr)), waveform: .sine)
        // Noise shimmer
        addNoise(to: buffer, amplitude: 0.08,
                 startSample: Int(0.12 * Double(sr)),
                 sampleCount: Int(0.25 * Double(sr)))

        applyLowPass(to: buffer, cutoffHz: 5000)
        clamp(buffer)
        return buffer
    }

    // -- Tile Select: soft click (800Hz + 1200Hz sine pips) --
    private func generateTileSelect() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.10)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 800, amplitude: 0.15, startSample: 0,
                sampleCount: Int(0.08 * Double(sr)), waveform: .sine,
                attackSamples: 44, releaseSamples: Int(0.04 * Double(sr)))
        addTone(to: buffer, frequency: 1200, amplitude: 0.10,
                startSample: Int(0.02 * Double(sr)),
                sampleCount: Int(0.05 * Double(sr)), waveform: .sine,
                attackSamples: 44, releaseSamples: Int(0.03 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Tile Deselect: single soft tone (600Hz) --
    private func generateTileDeselect() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.08)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 600, amplitude: 0.12, startSample: 0,
                sampleCount: Int(0.06 * Double(sr)), waveform: .sine,
                attackSamples: 44, releaseSamples: Int(0.03 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Invalid Swap: two short descending square tones --
    private func generateInvalidSwap() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.25)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 150, amplitude: 0.12, startSample: 0,
                sampleCount: Int(0.15 * Double(sr)), waveform: .square,
                attackSamples: 44, releaseSamples: Int(0.08 * Double(sr)))
        addTone(to: buffer, frequency: 100, amplitude: 0.08,
                startSample: Int(0.05 * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .square,
                attackSamples: 44, releaseSamples: Int(0.08 * Double(sr)))

        applyLowPass(to: buffer, cutoffHz: 1500)
        clamp(buffer)
        return buffer
    }

    // -- Tile Swap: short whoosh (noise filtered) --
    private func generateTileSwap() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.12)
        let sr = Int(Self.sampleRate)

        addNoise(to: buffer, amplitude: 0.10, startSample: 0,
                 sampleCount: Int(0.10 * Double(sr)), decayPower: 2.0)
        addTone(to: buffer, frequency: 500, amplitude: 0.06, startSample: 0,
                sampleCount: Int(0.08 * Double(sr)), waveform: .sine,
                attackSamples: 44, releaseSamples: Int(0.05 * Double(sr)))

        applyLowPass(to: buffer, cutoffHz: 2500)
        clamp(buffer)
        return buffer
    }

    // -- Tile Land: short percussive sine pip --
    private func generateTileLand() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.03)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 420, amplitude: 0.15, startSample: 0,
                sampleCount: Int(0.015 * Double(sr)), waveform: .sine,
                attackSamples: 22, releaseSamples: Int(0.01 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Bomb Explosion: low sine sweep (200Hz->60Hz) + noise burst --
    private func generateBombExplosion() -> AVAudioPCMBuffer {
        let duration = 0.50
        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)
        guard let data = buffer.floatChannelData?[0] else { return buffer }

        // Frequency sweep from 200Hz down to 60Hz
        let sweepSamples = Int(0.40 * Double(sr))
        for i in 0..<sweepSamples {
            let progress = Float(i) / Float(sweepSamples)
            let freq = 200.0 - 140.0 * progress  // 200 -> 60
            let phase = Float(i) / Float(sr) * freq
            let envelope = (1.0 - progress) * 0.35
            data[i] += sinf(2.0 * .pi * phase) * envelope
        }

        // Square sub-rumble at 80Hz
        addTone(to: buffer, frequency: 80, amplitude: 0.15, startSample: 0,
                sampleCount: Int(0.35 * Double(sr)), waveform: .square)
        // Sawtooth growl at 120Hz
        addTone(to: buffer, frequency: 120, amplitude: 0.12,
                startSample: Int(0.05 * Double(sr)),
                sampleCount: Int(0.20 * Double(sr)), waveform: .sawtooth)
        // Noise burst
        addNoise(to: buffer, amplitude: 0.18, startSample: 0,
                 sampleCount: Int(0.30 * Double(sr)), decayPower: 1.5)

        applyLowPass(to: buffer, cutoffHz: 2000)
        clamp(buffer)
        return buffer
    }

    // -- Vibestreak: bandpass noise + descending pitch sweep + sub bass --
    private func generateVibestreak() -> AVAudioPCMBuffer {
        let duration = 0.40
        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)
        guard let data = buffer.floatChannelData?[0] else { return buffer }

        // Descending sawtooth sweep from 1200Hz to 200Hz
        let sweepSamples = Int(0.30 * Double(sr))
        for i in 0..<sweepSamples {
            let progress = Float(i) / Float(sweepSamples)
            let freq: Float = 1200.0 * powf(200.0 / 1200.0, progress)
            let phase = Float(i) / Float(sr) * freq
            let p = phase - floorf(phase)
            let saw = 2.0 * p - 1.0
            let envelope = (1.0 - progress) * 0.18
            data[i] += saw * envelope
        }

        // Noise burst (filtered afterwards)
        addNoise(to: buffer, amplitude: 0.15, startSample: 0,
                 sampleCount: Int(0.15 * Double(sr)), decayPower: 2.0)
        // Sub bass hit
        addTone(to: buffer, frequency: 60, amplitude: 0.30, startSample: 0,
                sampleCount: Int(0.20 * Double(sr)), waveform: .sine)

        applyLowPass(to: buffer, cutoffHz: 3000)
        clamp(buffer)
        return buffer
    }

    // -- Cosmic Blast: ascending harmonic series + sub bass + noise --
    private func generateCosmicBlast() -> AVAudioPCMBuffer {
        let duration = 0.60
        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)

        for i in 0..<8 {
            let freq = Float(400 + i * 200)
            addTone(to: buffer, frequency: freq, amplitude: 0.10,
                    startSample: Int(Double(i) * 0.03 * Double(sr)),
                    sampleCount: Int(0.25 * Double(sr)), waveform: .sine)
        }
        addTone(to: buffer, frequency: 60, amplitude: 0.25, startSample: 0,
                sampleCount: Int(0.50 * Double(sr)), waveform: .sine)
        addNoise(to: buffer, amplitude: 0.10,
                 startSample: Int(0.05 * Double(sr)),
                 sampleCount: Int(0.40 * Double(sr)))

        applyLowPass(to: buffer, cutoffHz: 4000)
        clamp(buffer)
        return buffer
    }

    // -- Special Create: bright power-up chime --
    private func generateSpecialCreate() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.30)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 880, amplitude: 0.20, startSample: 0,
                sampleCount: Int(0.10 * Double(sr)), waveform: .triangle)
        addTone(to: buffer, frequency: 1109, amplitude: 0.20,
                startSample: Int(0.05 * Double(sr)),
                sampleCount: Int(0.10 * Double(sr)), waveform: .triangle)
        addTone(to: buffer, frequency: 1319, amplitude: 0.25,
                startSample: Int(0.10 * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .sine)
        addNoise(to: buffer, amplitude: 0.04,
                 startSample: Int(0.08 * Double(sr)),
                 sampleCount: Int(0.12 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Combo Tiers 1-6: escalating frequency base with added harmonics --
    private func generateCombo(level: Int) -> AVAudioPCMBuffer {
        let clampedLevel = max(1, min(6, level))
        let baseFreq = Float(300 + clampedLevel * 200)

        if clampedLevel >= 6 {
            // Tier 6+: Glitched chaos — rapid random frequency square wave + noise
            let buffer = makeBuffer(duration: 0.45)
            let sr = Int(Self.sampleRate)
            guard let data = buffer.floatChannelData?[0] else { return buffer }

            // Rapid random-frequency square wave segments
            var sampleIndex = 0
            let totalSamples = Int(0.36 * Double(sr))
            for _ in 0..<12 {
                let segLen = totalSamples / 12
                let freq = Float.random(in: 50...2000)
                for j in 0..<segLen {
                    guard sampleIndex < totalSamples else { break }
                    let phase = Float(j) / Float(sr) * freq
                    let p = phase - floorf(phase)
                    let sq: Float = p < 0.5 ? 1.0 : -1.0
                    let envelope = 1.0 - Float(sampleIndex) / Float(totalSamples)
                    // Hard clip distortion
                    let distorted = max(-1.0, min(1.0, sq * 3.33))
                    data[sampleIndex] += distorted * 0.15 * envelope
                    sampleIndex += 1
                }
            }
            addNoise(to: buffer, amplitude: 0.12, startSample: 0,
                     sampleCount: Int(0.30 * Double(sr)), decayPower: 1.0)

            applyLowPass(to: buffer, cutoffHz: 5000)
            clamp(buffer)
            return buffer
        }

        if clampedLevel >= 5 {
            // Tier 5: Detuned chorus + rising 4-note arpeggio
            let buffer = makeBuffer(duration: 0.40)
            let sr = Int(Self.sampleRate)

            // Detuned pair
            addTone(to: buffer, frequency: baseFreq * 2.0 + 3.0, amplitude: 0.12,
                    startSample: 0, sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: baseFreq * 2.0 - 3.0, amplitude: 0.12,
                    startSample: 0, sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            // Rising arpeggio
            let multipliers: [Float] = [1.0, 1.25, 1.5, 2.0]
            for (i, mult) in multipliers.enumerated() {
                addTone(to: buffer, frequency: baseFreq * mult, amplitude: 0.12,
                        startSample: Int((0.10 + Double(i) * 0.03) * Double(sr)),
                        sampleCount: Int(0.10 * Double(sr)), waveform: .sine)
            }

            applyLowPass(to: buffer, cutoffHz: 4500)
            clamp(buffer)
            return buffer
        }

        if clampedLevel >= 4 {
            // Tier 4: Two detuned sawtooth oscillators + high octave sine
            let buffer = makeBuffer(duration: 0.35)
            let sr = Int(Self.sampleRate)

            addTone(to: buffer, frequency: baseFreq + 3.0, amplitude: 0.14,
                    startSample: 0, sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: baseFreq - 3.0, amplitude: 0.14,
                    startSample: 0, sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: baseFreq * 2.0, amplitude: 0.18,
                    startSample: Int(0.05 * Double(sr)),
                    sampleCount: Int(0.20 * Double(sr)), waveform: .sine)

            applyLowPass(to: buffer, cutoffHz: 4000)
            clamp(buffer)
            return buffer
        }

        if clampedLevel >= 3 {
            // Tier 3: Sawtooth base + fifth + high octave
            let buffer = makeBuffer(duration: 0.30)
            let sr = Int(Self.sampleRate)

            addTone(to: buffer, frequency: baseFreq, amplitude: 0.14,
                    startSample: 0, sampleCount: Int(0.20 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: baseFreq * 1.5, amplitude: 0.10,
                    startSample: 0, sampleCount: Int(0.20 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: baseFreq * 2.0, amplitude: 0.18,
                    startSample: Int(0.05 * Double(sr)),
                    sampleCount: Int(0.20 * Double(sr)), waveform: .sine)

            applyLowPass(to: buffer, cutoffHz: 3500)
            clamp(buffer)
            return buffer
        }

        // Tier 1-2: Basic sawtooth sweep + octave sine
        let buffer = makeBuffer(duration: 0.28)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: baseFreq, amplitude: 0.14,
                startSample: 0, sampleCount: Int(0.20 * Double(sr)), waveform: .sawtooth)
        addTone(to: buffer, frequency: baseFreq * 2.0, amplitude: 0.18,
                startSample: Int(0.05 * Double(sr)),
                sampleCount: Int(0.20 * Double(sr)), waveform: .sine)

        applyLowPass(to: buffer, cutoffHz: 3000)
        clamp(buffer)
        return buffer
    }

    // -- Shape Bonus: chord stabs per shape type --
    private func generateShapeBonus(shape: ShapeBonusType) -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.30)
        let sr = Int(Self.sampleRate)

        switch shape {
        case .L:
            // C major triad: C4-E4-G4
            addTone(to: buffer, frequency: 262, amplitude: 0.18, startSample: 0,
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: 330, amplitude: 0.18, startSample: 0,
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: 392, amplitude: 0.18, startSample: 0,
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
        case .T:
            // C major 7th: C4-E4-G4-B4
            addTone(to: buffer, frequency: 262, amplitude: 0.15, startSample: 0,
                    sampleCount: Int(0.20 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: 330, amplitude: 0.15, startSample: 0,
                    sampleCount: Int(0.20 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: 392, amplitude: 0.15, startSample: 0,
                    sampleCount: Int(0.20 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: 494, amplitude: 0.15, startSample: 0,
                    sampleCount: Int(0.20 * Double(sr)), waveform: .triangle)
        case .cross:
            // Power chord: C4-G4-C5 sawtooth + shimmer noise
            addTone(to: buffer, frequency: 262, amplitude: 0.16, startSample: 0,
                    sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: 392, amplitude: 0.16, startSample: 0,
                    sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            addTone(to: buffer, frequency: 523, amplitude: 0.16, startSample: 0,
                    sampleCount: Int(0.25 * Double(sr)), waveform: .sawtooth)
            addNoise(to: buffer, amplitude: 0.05, startSample: 0,
                     sampleCount: Int(0.20 * Double(sr)))
            applyLowPass(to: buffer, cutoffHz: 3000)
        case .square:
            // Two octave C: C4-C5
            addTone(to: buffer, frequency: 262, amplitude: 0.20, startSample: 0,
                    sampleCount: Int(0.15 * Double(sr)), waveform: .sine)
            addTone(to: buffer, frequency: 523, amplitude: 0.20, startSample: 0,
                    sampleCount: Int(0.15 * Double(sr)), waveform: .sine)
        }

        clamp(buffer)
        return buffer
    }

    // -- Cascade: ascending sparkle, pitch increases per level --
    private func generateCascade(level: Int) -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.25)
        let sr = Int(Self.sampleRate)
        let baseFreq = Float(700 + level * 200)

        addTone(to: buffer, frequency: baseFreq, amplitude: 0.15,
                startSample: 0, sampleCount: Int(0.08 * Double(sr)), waveform: .sine)
        addTone(to: buffer, frequency: baseFreq * 1.25, amplitude: 0.15,
                startSample: Int(0.04 * Double(sr)),
                sampleCount: Int(0.08 * Double(sr)), waveform: .sine)
        addTone(to: buffer, frequency: baseFreq * 1.5, amplitude: 0.18,
                startSample: Int(0.08 * Double(sr)),
                sampleCount: Int(0.10 * Double(sr)), waveform: .sine)

        clamp(buffer)
        return buffer
    }

    // -- Game Start: ascending 4-note arpeggio C4-E4-G4-C5 --
    private func generateGameStart() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.55)
        let sr = Int(Self.sampleRate)
        let notes: [(Float, Double)] = [(262, 0.0), (330, 0.08), (392, 0.16), (523, 0.24)]

        for (freq, delay) in notes {
            addTone(to: buffer, frequency: freq, amplitude: 0.30,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
            // Reverb-like tail
            addTone(to: buffer, frequency: freq, amplitude: 0.08,
                    startSample: Int((delay + 0.05) * Double(sr)),
                    sampleCount: Int(0.25 * Double(sr)), waveform: .triangle)
        }

        clamp(buffer)
        return buffer
    }

    // -- Game Over: descending G5-E5-C5-G4 --
    private func generateGameOver() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.70)
        let sr = Int(Self.sampleRate)
        let notes: [(Float, Double, Double)] = [
            (784, 0.0, 0.20), (659, 0.15, 0.20), (523, 0.30, 0.20), (392, 0.45, 0.40)
        ]

        for (freq, delay, dur) in notes {
            addTone(to: buffer, frequency: freq, amplitude: 0.20,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(dur * Double(sr)), waveform: .sine)
        }

        clamp(buffer)
        return buffer
    }

    // -- Victory: ascending 6-note fanfare --
    private func generateVictory() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.65)
        let sr = Int(Self.sampleRate)
        let notes: [Float] = [523, 659, 784, 1047, 1319, 1568]

        for (i, freq) in notes.enumerated() {
            let delay = Double(i) * 0.06
            addTone(to: buffer, frequency: freq, amplitude: 0.22,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: freq, amplitude: 0.15,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.12 * Double(sr)), waveform: .sine)
        }
        addNoise(to: buffer, amplitude: 0.06,
                 startSample: Int(0.30 * Double(sr)),
                 sampleCount: Int(0.25 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- New High Score: same as victory but with extra shimmer --
    private func generateNewHighScore() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.75)
        let sr = Int(Self.sampleRate)
        let notes: [Float] = [523, 659, 784, 1047, 1319, 1568]

        for (i, freq) in notes.enumerated() {
            let delay = Double(i) * 0.06
            addTone(to: buffer, frequency: freq, amplitude: 0.25,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
            addTone(to: buffer, frequency: freq, amplitude: 0.18,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.12 * Double(sr)), waveform: .sine)
        }
        // Extra shimmer tail
        addNoise(to: buffer, amplitude: 0.08,
                 startSample: Int(0.30 * Double(sr)),
                 sampleCount: Int(0.35 * Double(sr)))
        // Sustained high note
        addTone(to: buffer, frequency: 1568, amplitude: 0.12,
                startSample: Int(0.36 * Double(sr)),
                sampleCount: Int(0.30 * Double(sr)), waveform: .sine)

        clamp(buffer)
        return buffer
    }

    // -- Final Move Warning: heartbeat thump-thump, speed based on movesLeft --
    private func generateFinalMoveWarning(movesLeft: Int) -> AVAudioPCMBuffer {
        let gap: Double
        if movesLeft <= 1 { gap = 0.30 }
        else if movesLeft <= 2 { gap = 0.50 }
        else { gap = 0.80 }

        let buffer = makeBuffer(duration: gap + 0.25)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 80, amplitude: 0.40, startSample: 0,
                sampleCount: Int(0.15 * Double(sr)), waveform: .sine,
                attackSamples: 44, releaseSamples: Int(0.10 * Double(sr)))
        addTone(to: buffer, frequency: 80, amplitude: 0.40,
                startSample: Int(gap * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .sine,
                attackSamples: 44, releaseSamples: Int(0.10 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- UI Click: ultra-short 1000Hz sine pip --
    private func generateUIClick() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.01)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 1000, amplitude: 0.25, startSample: 0,
                sampleCount: Int(0.006 * Double(sr)), waveform: .sine,
                attackSamples: 22, releaseSamples: Int(0.004 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Menu Open: ascending two-note chime --
    private func generateMenuOpen() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.20)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 600, amplitude: 0.15, startSample: 0,
                sampleCount: Int(0.08 * Double(sr)), waveform: .sine)
        addTone(to: buffer, frequency: 900, amplitude: 0.18,
                startSample: Int(0.06 * Double(sr)),
                sampleCount: Int(0.10 * Double(sr)), waveform: .sine)

        clamp(buffer)
        return buffer
    }

    // -- Menu Close: descending two-note chime --
    private func generateMenuClose() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.20)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 900, amplitude: 0.15, startSample: 0,
                sampleCount: Int(0.08 * Double(sr)), waveform: .sine)
        addTone(to: buffer, frequency: 600, amplitude: 0.18,
                startSample: Int(0.06 * Double(sr)),
                sampleCount: Int(0.10 * Double(sr)), waveform: .sine)

        clamp(buffer)
        return buffer
    }

    // -- Chest Appear: mysterious shimmer --
    private func generateChestAppear() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.40)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 440, amplitude: 0.12, startSample: 0,
                sampleCount: Int(0.30 * Double(sr)), waveform: .triangle)
        addTone(to: buffer, frequency: 554, amplitude: 0.10,
                startSample: Int(0.05 * Double(sr)),
                sampleCount: Int(0.25 * Double(sr)), waveform: .triangle)
        addNoise(to: buffer, amplitude: 0.04, startSample: 0,
                 sampleCount: Int(0.30 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Chest Open: building anticipation reveal --
    private func generateChestOpen() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.60)
        let sr = Int(Self.sampleRate)

        // Building rumble
        addTone(to: buffer, frequency: 100, amplitude: 0.15, startSample: 0,
                sampleCount: Int(0.30 * Double(sr)), waveform: .sine)
        addNoise(to: buffer, amplitude: 0.08, startSample: 0,
                 sampleCount: Int(0.25 * Double(sr)), decayPower: 0.5)
        // Reveal chime
        addTone(to: buffer, frequency: 784, amplitude: 0.22,
                startSample: Int(0.30 * Double(sr)),
                sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
        addTone(to: buffer, frequency: 1047, amplitude: 0.25,
                startSample: Int(0.38 * Double(sr)),
                sampleCount: Int(0.18 * Double(sr)), waveform: .sine)

        clamp(buffer)
        return buffer
    }

    // -- Badge Reveal: tier-appropriate impact --
    private func generateBadgeReveal(tier: BadgeTier) -> AVAudioPCMBuffer {
        let duration: Double
        let amplitude: Float
        let noteCount: Int

        switch tier {
        case .common:
            duration = 0.25; amplitude = 0.15; noteCount = 2
        case .uncommon:
            duration = 0.30; amplitude = 0.20; noteCount = 3
        case .rare:
            duration = 0.40; amplitude = 0.25; noteCount = 4
        case .epic:
            duration = 0.50; amplitude = 0.30; noteCount = 5
        case .legendary:
            duration = 0.65; amplitude = 0.35; noteCount = 6
        }

        let buffer = makeBuffer(duration: duration)
        let sr = Int(Self.sampleRate)
        let notes: [Float] = [523, 659, 784, 1047, 1319, 1568]

        for i in 0..<noteCount {
            let delay = Double(i) * 0.06
            addTone(to: buffer, frequency: notes[i], amplitude: amplitude,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.12 * Double(sr)), waveform: .triangle)
        }

        if tier == .legendary || tier == .epic {
            addNoise(to: buffer, amplitude: 0.06,
                     startSample: Int(Double(noteCount) * 0.06 * Double(sr)),
                     sampleCount: Int(0.15 * Double(sr)))
        }

        clamp(buffer)
        return buffer
    }

    // -- New Badge Discovered: bright discovery fanfare --
    private func generateNewBadgeDiscovered() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.50)
        let sr = Int(Self.sampleRate)

        let notes: [(Float, Double)] = [
            (659, 0.0), (784, 0.06), (1047, 0.12), (1319, 0.20)
        ]
        for (freq, delay) in notes {
            addTone(to: buffer, frequency: freq, amplitude: 0.25,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.15 * Double(sr)), waveform: .triangle)
        }
        addNoise(to: buffer, amplitude: 0.05,
                 startSample: Int(0.20 * Double(sr)),
                 sampleCount: Int(0.20 * Double(sr)))

        clamp(buffer)
        return buffer
    }

    // -- Hint: gentle two-note nudge E5-G5 --
    private func generateHint() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.30)
        let sr = Int(Self.sampleRate)

        addTone(to: buffer, frequency: 659, amplitude: 0.18, startSample: 0,
                sampleCount: Int(0.10 * Double(sr)), waveform: .triangle)
        addTone(to: buffer, frequency: 784, amplitude: 0.18,
                startSample: Int(0.15 * Double(sr)),
                sampleCount: Int(0.10 * Double(sr)), waveform: .triangle)

        clamp(buffer)
        return buffer
    }

    // -- Milestone: victory sting C5-E5-G5-C6-E6 --
    private func generateMilestone() -> AVAudioPCMBuffer {
        let buffer = makeBuffer(duration: 0.50)
        let sr = Int(Self.sampleRate)

        let notes: [(Float, Double)] = [
            (523, 0.0), (659, 0.06), (784, 0.12), (1047, 0.18), (1319, 0.24)
        ]
        for (freq, delay) in notes {
            addTone(to: buffer, frequency: freq, amplitude: 0.22,
                    startSample: Int(delay * Double(sr)),
                    sampleCount: Int(0.12 * Double(sr)), waveform: .sine)
        }

        clamp(buffer)
        return buffer
    }
}

// MARK: - Waveform Type

enum Waveform {
    case sine
    case sawtooth
    case square
    case triangle
}
