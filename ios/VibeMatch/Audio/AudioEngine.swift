import AVFoundation

// MARK: - GameSound Enum

/// Every SFX in VibeMatch is triggered through this enum.
/// No hardcoded asset paths — all sounds resolve through the synthesizer or (future) asset loader.
enum GameSound: Hashable {
    // Core match
    case match3
    case match4
    case match5Plus

    // Tile interaction
    case tileSelect
    case tileDeselect
    case invalidSwap
    case tileSwap
    case tileLand

    // Special tiles
    case bombActivate
    case vibestreakActivate
    case cosmicBlastActivate
    case specialCreate

    // Combo (tiered)
    case combo(level: Int)

    // Shape bonus
    case shapeBonus(ShapeBonusType)

    // Cascade
    case cascade(level: Int)

    // Game flow
    case gameStart
    case gameOver
    case victory
    case newHighScore
    case finalMoveWarning(movesLeft: Int)

    // UI
    case uiClick
    case menuOpen
    case menuClose

    // Collection
    case chestAppear
    case chestOpen
    case badgeReveal(BadgeTier)
    case newBadgeDiscovered

    // Hint
    case hint

    // Milestone
    case milestone

    /// Stable string key for caching and dictionary lookup.
    var cacheKey: String {
        switch self {
        case .match3: return "match3"
        case .match4: return "match4"
        case .match5Plus: return "match5Plus"
        case .tileSelect: return "tileSelect"
        case .tileDeselect: return "tileDeselect"
        case .invalidSwap: return "invalidSwap"
        case .tileSwap: return "tileSwap"
        case .tileLand: return "tileLand"
        case .bombActivate: return "bombActivate"
        case .vibestreakActivate: return "vibestreakActivate"
        case .cosmicBlastActivate: return "cosmicBlastActivate"
        case .specialCreate: return "specialCreate"
        case .combo(let level): return "combo_\(min(level, 6))"
        case .shapeBonus(let type): return "shapeBonus_\(type.rawValue)"
        case .cascade(let level): return "cascade_\(min(level, 5))"
        case .gameStart: return "gameStart"
        case .gameOver: return "gameOver"
        case .victory: return "victory"
        case .newHighScore: return "newHighScore"
        case .finalMoveWarning(let moves): return "finalMoveWarning_\(min(max(moves, 1), 3))"
        case .uiClick: return "uiClick"
        case .menuOpen: return "menuOpen"
        case .menuClose: return "menuClose"
        case .chestAppear: return "chestAppear"
        case .chestOpen: return "chestOpen"
        case .badgeReveal(let tier): return "badgeReveal_\(tier.rawValue)"
        case .newBadgeDiscovered: return "newBadgeDiscovered"
        case .hint: return "hint"
        case .milestone: return "milestone"
        }
    }
}

// MARK: - MusicState Enum

enum MusicState: Equatable {
    /// Stem A: 1.0, B: 0.0, C: 0.3
    case calm
    /// Stem A: 1.0, B: 0.6, C: 0.6
    case building
    /// Stem A: 1.0, B: 1.0, C: 1.0
    case fire
    /// Stem A: 0.5, B: 0.0, C: 0.8
    case danger
    /// Fade all stems out
    case defeat
}

// MARK: - AudioEngine

/// Main audio manager for VibeMatch, built on AVAudioEngine.
///
/// Architecture:
/// ```
/// AVAudioSession (.ambient, mixWithOthers)
///   |
/// AVAudioEngine
///   +-- SFX Bus (AVAudioMixerNode, gain 0.8)
///   |     +-- Player Pool (12 pre-allocated AVAudioPlayerNodes)
///   |     +-- Reverb Send (AVAudioUnitReverb, short warm room)
///   +-- Music Bus (AVAudioMixerNode, gain 0.3)
///   |     +-- Stem A (pad/harmony — always playing)
///   |     +-- Stem B (melody — enters at combo >= 2)
///   |     +-- Stem C (rhythm — intensity driven by moves)
///   +-- Master Bus (AVAudioMixerNode, gain 1.0)
/// ```
final class AudioEngine {

    // MARK: - Singleton

    static let shared = AudioEngine()

    // MARK: - Engine Components

    private let engine = AVAudioEngine()

    // Bus mixers
    private let sfxBus = AVAudioMixerNode()
    private let musicBus = AVAudioMixerNode()
    private let masterBus = AVAudioMixerNode()

    // SFX voice pool
    private let voicePoolSize = 12
    private var sfxPlayers: [AVAudioPlayerNode] = []
    private var nextPlayerIndex = 0

    // Reverb send for SFX
    private let reverb = AVAudioUnitReverb()

    // Music stems
    private let stemA = AVAudioPlayerNode() // Pad / harmony — always playing
    private let stemB = AVAudioPlayerNode() // Melody — enters at combo >= 2
    private let stemC = AVAudioPlayerNode() // Rhythm — intensity driven

    // Stem volume mixers (individual gain control for adaptive mixing)
    private let stemAMixer = AVAudioMixerNode()
    private let stemBMixer = AVAudioMixerNode()
    private let stemCMixer = AVAudioMixerNode()

    // Sound synthesizer
    private let synthesizer = SoundSynthesizer()

    // MARK: - State

    private(set) var currentMusicState: MusicState = .calm
    private var isMuted = false
    private var sfxVolume: Float = 0.8
    private var musicVolume: Float = 0.3
    private var isEngineRunning = false

    // Music ducking
    private var duckWorkItem: DispatchWorkItem?

    // MARK: - Audio Format

    private var sfxFormat: AVAudioFormat {
        return synthesizer.format
    }

    // MARK: - Init

    private init() {
        setupNotifications()
        setupEngine()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Engine Setup

    /// Build the full audio graph and configure AVAudioSession.
    func setupEngine() {
        configureAudioSession()
        buildAudioGraph()
        startEngine()
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            // .ambient: respects silent switch, mixes with other apps
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("[AudioEngine] Failed to configure AVAudioSession: \(error)")
        }
    }

    private func buildAudioGraph() {
        // Attach all nodes to the engine
        engine.attach(masterBus)
        engine.attach(sfxBus)
        engine.attach(musicBus)
        engine.attach(reverb)

        // Attach SFX voice pool
        sfxPlayers.removeAll()
        for _ in 0..<voicePoolSize {
            let player = AVAudioPlayerNode()
            engine.attach(player)
            sfxPlayers.append(player)
        }

        // Attach music stem players and their mixers
        engine.attach(stemA)
        engine.attach(stemB)
        engine.attach(stemC)
        engine.attach(stemAMixer)
        engine.attach(stemBMixer)
        engine.attach(stemCMixer)

        // Configure reverb: short warm room preset
        reverb.loadFactoryPreset(.smallRoom)
        reverb.wetDryMix = 20 // 20% wet — subtle warmth, not a cave

        let mainMixerFormat = engine.mainMixerNode.outputFormat(forBus: 0)

        // Connect topology:
        // SFX players -> sfxBus
        // sfxBus -> reverb -> masterBus
        // sfxBus -> masterBus (dry path handled by mixer, reverb is a parallel send)

        for player in sfxPlayers {
            engine.connect(player, to: sfxBus, format: sfxFormat)
        }

        // SFX bus routes through reverb to master (reverb wetDryMix handles blend)
        engine.connect(sfxBus, to: reverb, format: mainMixerFormat)
        engine.connect(reverb, to: masterBus, format: mainMixerFormat)

        // Music stems -> individual mixers -> musicBus -> masterBus
        engine.connect(stemA, to: stemAMixer, format: sfxFormat)
        engine.connect(stemB, to: stemBMixer, format: sfxFormat)
        engine.connect(stemC, to: stemCMixer, format: sfxFormat)
        engine.connect(stemAMixer, to: musicBus, format: mainMixerFormat)
        engine.connect(stemBMixer, to: musicBus, format: mainMixerFormat)
        engine.connect(stemCMixer, to: musicBus, format: mainMixerFormat)
        engine.connect(musicBus, to: masterBus, format: mainMixerFormat)

        // Master bus -> engine main mixer -> output
        engine.connect(masterBus, to: engine.mainMixerNode, format: mainMixerFormat)

        // Set initial bus gains
        sfxBus.outputVolume = sfxVolume
        musicBus.outputVolume = musicVolume
        masterBus.outputVolume = 1.0

        // Set initial stem volumes for .calm state
        applyMusicState(.calm, animated: false)
    }

    private func startEngine() {
        guard !engine.isRunning else {
            isEngineRunning = true
            return
        }
        do {
            engine.prepare()
            try engine.start()
            isEngineRunning = true
        } catch {
            print("[AudioEngine] Failed to start AVAudioEngine: \(error)")
            isEngineRunning = false
        }
    }

    // MARK: - SFX Playback

    /// Play a one-shot SFX from the voice pool with pitch and volume randomization.
    /// Pitch: +/- 50 cents (semitone / 2). Volume: +/- 2dB.
    func playSFX(_ sound: GameSound) {
        guard !isMuted, isEngineRunning else { return }

        guard let buffer = synthesizer.buffer(for: sound) else {
            print("[AudioEngine] No buffer for sound: \(sound.cacheKey)")
            return
        }

        let player = sfxPlayers[nextPlayerIndex]
        nextPlayerIndex = (nextPlayerIndex + 1) % voicePoolSize

        // Stop any currently playing sound on this player node
        player.stop()

        // Pitch randomization: +/- 50 cents
        // 50 cents = 2^(50/1200) ~= 1.02930
        let centsOffset = Float.random(in: -50...50)
        let pitchMultiplier = powf(2.0, centsOffset / 1200.0)
        player.rate = pitchMultiplier

        // Volume randomization: +/- 2dB
        // dB to linear: 10^(dB/20)
        let dbOffset = Float.random(in: -2...2)
        let volumeMultiplier = powf(10.0, dbOffset / 20.0)
        player.volume = min(1.0, volumeMultiplier)

        // Schedule and play
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        player.play()
    }

    // MARK: - Music Ducking

    /// Ramp music bus volume to 0.15 over 50ms, then recover to set level after duration.
    func duckMusic(duration: TimeInterval = 0.4) {
        guard !isMuted else { return }

        // Cancel any pending recovery
        duckWorkItem?.cancel()

        // Duck: ramp to 0.15 over ~50ms (AVAudioEngine doesn't have built-in ramp,
        // so we set the value directly — the mixer smooths small changes)
        musicBus.outputVolume = 0.15

        // Schedule recovery
        let recoverItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            // Ramp back up over ~500ms using a simple linear interpolation
            self.animateVolume(on: self.musicBus, to: self.musicVolume, duration: 0.5)
        }
        duckWorkItem = recoverItem
        DispatchQueue.main.asyncAfter(deadline: .now() + duration, execute: recoverItem)
    }

    // MARK: - Adaptive Music

    /// Set the adaptive music state. Stem volumes crossfade smoothly.
    func setMusicState(_ state: MusicState) {
        guard state != currentMusicState else { return }
        currentMusicState = state
        applyMusicState(state, animated: true)
    }

    private func applyMusicState(_ state: MusicState, animated: Bool) {
        let stemAVol: Float
        let stemBVol: Float
        let stemCVol: Float

        switch state {
        case .calm:
            stemAVol = 1.0; stemBVol = 0.0; stemCVol = 0.3
        case .building:
            stemAVol = 1.0; stemBVol = 0.6; stemCVol = 0.6
        case .fire:
            stemAVol = 1.0; stemBVol = 1.0; stemCVol = 1.0
        case .danger:
            stemAVol = 0.5; stemBVol = 0.0; stemCVol = 0.8
        case .defeat:
            stemAVol = 0.0; stemBVol = 0.0; stemCVol = 0.0
        }

        if animated {
            let duration: TimeInterval = 1.0
            animateVolume(on: stemAMixer, to: stemAVol, duration: duration)
            animateVolume(on: stemBMixer, to: stemBVol, duration: duration)
            animateVolume(on: stemCMixer, to: stemCVol, duration: duration)
        } else {
            stemAMixer.outputVolume = stemAVol
            stemBMixer.outputVolume = stemBVol
            stemCMixer.outputVolume = stemCVol
        }
    }

    // MARK: - Volume Controls

    /// Set SFX bus volume (0.0 to 1.0).
    func setSFXVolume(_ volume: Float) {
        sfxVolume = max(0, min(1, volume))
        if !isMuted {
            sfxBus.outputVolume = sfxVolume
        }
    }

    /// Set music bus volume (0.0 to 1.0).
    func setMusicVolume(_ volume: Float) {
        musicVolume = max(0, min(1, volume))
        if !isMuted {
            musicBus.outputVolume = musicVolume
        }
    }

    /// Toggle global mute. Silences both SFX and music buses.
    @discardableResult
    func toggleMute() -> Bool {
        isMuted.toggle()

        if isMuted {
            sfxBus.outputVolume = 0
            musicBus.outputVolume = 0
            // Stop all voice pool players to free resources
            for player in sfxPlayers {
                player.stop()
            }
        } else {
            sfxBus.outputVolume = sfxVolume
            musicBus.outputVolume = musicVolume
        }

        return isMuted
    }

    /// Returns the current mute state.
    var muted: Bool { isMuted }

    // MARK: - Volume Animation

    /// Animate a mixer node's outputVolume over a duration using a dispatch timer.
    /// AVAudioMixerNode.outputVolume has no built-in ramp, so we step it manually.
    private func animateVolume(on mixer: AVAudioMixerNode, to target: Float, duration: TimeInterval) {
        let steps = 20
        let stepDuration = duration / Double(steps)
        let startVolume = mixer.outputVolume
        let delta = target - startVolume

        for step in 0...steps {
            let fraction = Float(step) / Float(steps)
            let value = startVolume + delta * fraction
            DispatchQueue.main.asyncAfter(deadline: .now() + stepDuration * Double(step)) {
                mixer.outputVolume = value
            }
        }
    }

    // MARK: - Lifecycle

    /// Call when the app enters background.
    func handleEnterBackground() {
        guard isEngineRunning else { return }
        engine.pause()
        isEngineRunning = false
    }

    /// Call when the app enters foreground.
    func handleEnterForeground() {
        guard !isEngineRunning else { return }
        configureAudioSession()
        startEngine()
    }

    // MARK: - Notifications

    private func setupNotifications() {
        let nc = NotificationCenter.default

        // Audio interruption (phone calls, Siri)
        nc.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )

        // Route change (headphones unplugged)
        nc.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance()
        )

        // App lifecycle
        nc.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        nc.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSession.interruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            // System interrupted audio (phone call, Siri, etc.)
            // Engine is automatically paused by the system.
            isEngineRunning = false

        case .ended:
            // Interruption ended. Check if we should resume.
            if let optionsValue = userInfo[AVAudioSession.interruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                    configureAudioSession()
                    startEngine()
                }
            }

        @unknown default:
            break
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSession.routeChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        switch reason {
        case .oldDeviceUnavailable:
            // Headphones were unplugged. Pause all audio to avoid unexpected speaker playback.
            // This matches the standard iOS behavior — music apps pause when headphones disconnect.
            for player in sfxPlayers {
                player.stop()
            }
            stemA.pause()
            stemB.pause()
            stemC.pause()

        case .newDeviceAvailable:
            // New output device connected (e.g., headphones plugged in).
            // No action needed — audio continues on new route automatically.
            break

        default:
            break
        }
    }

    @objc private func appDidEnterBackground() {
        handleEnterBackground()
    }

    @objc private func appWillEnterForeground() {
        handleEnterForeground()
    }
}
