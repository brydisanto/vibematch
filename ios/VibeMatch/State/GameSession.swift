import Foundation
import Observation

// MARK: - Match Intensity

/// Drives visual effects, audio escalation, and haptic intensity
/// based on the magnitude of a turn's result.
enum MatchIntensity: Int, Comparable, Sendable {
    case normal = 0
    case big = 1
    case mega = 2
    case ultra = 3

    static func < (lhs: MatchIntensity, rhs: MatchIntensity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    static func from(score: Int, combo: Int, maxMatchSize: Int) -> MatchIntensity {
        if maxMatchSize >= 5 || combo >= 4 || score >= 1500 { return .ultra }
        if maxMatchSize >= 4 || combo >= 3 || score >= 800 { return .mega }
        if combo >= 2 || score >= 400 { return .big }
        return .normal
    }

    /// Duration in seconds that match effect visuals should persist.
    var effectDuration: TimeInterval {
        switch self {
        case .ultra: return 2.4
        case .mega:  return 1.8
        case .big:   return 1.2
        case .normal: return 1.2
        }
    }
}

// MARK: - Score Popup

/// A floating score indicator spawned at the location of a match.
/// Consumed by the SpriteKit scene or SwiftUI overlay for animation.
struct ScorePopup: Identifiable, Sendable {
    let id: UUID
    let value: Int
    let position: Position
    let combo: Int
    let timestamp: Date

    init(value: Int, position: Position, combo: Int) {
        self.id = UUID()
        self.value = value
        self.position = position
        self.combo = combo
        self.timestamp = Date()
    }
}

// MARK: - Hint Messages

private let hintMessages: [String] = [
    "psst... try these",
    "need a nudge?",
    "how about here?",
    "look over here...",
]

// MARK: - Game Session

/// The central game state coordinator. This @Observable class is the iOS equivalent
/// of the web version's `useGame()` hook. It owns all mutable game state, orchestrates
/// the game engine, and drives audio/haptic/visual feedback through integration points.
///
/// SwiftUI views and the SpriteKit scene observe this object to stay in sync.
/// All mutations happen on the main actor to guarantee UI consistency.
@MainActor
@Observable
final class GameSession {

    // MARK: - State Properties

    /// The current 8x8 board of cells.
    private(set) var board: [[Cell]] = []

    /// The player's accumulated score.
    private(set) var score: Int = 0

    /// Remaining moves before the game ends.
    private(set) var movesLeft: Int = 0

    /// Current combo level within the active cascade chain.
    private(set) var combo: Int = 0

    /// Combo carry-over from the previous turn (cross-turn momentum).
    private(set) var comboCarry: Int = 0

    /// Highest combo achieved during this game session.
    private(set) var maxCombo: Int = 0

    /// The tile the player has currently selected, or nil.
    private(set) var selectedTile: Position? = nil

    /// Current phase of the game loop.
    private(set) var gamePhase: GamePhase = .playing

    /// Active game mode.
    private(set) var gameMode: GameMode = .classic

    /// The 6 badges in play for this session.
    private(set) var gameBadges: [Badge] = []

    /// Total individual matches made this game.
    private(set) var matchCount: Int = 0

    /// Total cascade steps accumulated this game.
    private(set) var totalCascades: Int = 0

    /// Why the game ended, if it has.
    private(set) var gameOverReason: GameOverReason? = nil

    /// Whether the audio is muted.
    var isMuted: Bool = false {
        didSet { AudioEngine.shared.toggleMute() }
    }

    /// Whether a new personal best was set this game.
    private(set) var isNewHighScore: Bool = false

    /// True while animations are playing; blocks all player input.
    private(set) var isAnimating: Bool = false

    /// The most recent turn result, for the scene/UI to consume.
    private(set) var lastTurnResult: TurnResult? = nil

    /// Current match intensity level driving visual/audio/haptic feedback.
    private(set) var matchIntensity: MatchIntensity? = nil

    /// Positions to highlight as a hint for the player.
    private(set) var hintPositions: [Position] = []

    /// A playful nudge message shown before the actual hint highlights.
    private(set) var hintMessage: String? = nil

    /// Active floating score indicators.
    private(set) var scorePopups: [ScorePopup] = []

    /// Positions to apply shake animation to (invalid swap feedback).
    private(set) var invalidSwapPositions: [Position]? = nil

    /// Swap animation positions for the scene to animate before applying the result.
    private(set) var swapAnimation: (pos1: Position, pos2: Position)? = nil

    // MARK: - Private State

    /// Random number generator for board operations.
    /// Uses SystemRandomNumberGenerator for classic mode, SeededRandom for daily.
    private var rng: any RandomNumberGenerator = SystemRandomNumberGenerator()

    /// Timer that fires the hint message after 10s of inactivity.
    private var hintMessageTimer: Timer? = nil

    /// Timer that fires the hint highlight after 12s of inactivity.
    private var hintHighlightTimer: Timer? = nil

    // MARK: - Computed Properties

    /// Determines the match intensity level for a given turn result.
    func matchIntensityForResult(_ result: TurnResult) -> MatchIntensity {
        let maxMatchSize = result.matchesFound.map(\.positions.count).max() ?? 0
        return MatchIntensity.from(
            score: result.scoreGained,
            combo: result.combo,
            maxMatchSize: maxMatchSize
        )
    }

    /// The adaptive music state derived from current gameplay conditions.
    var musicState: MusicState {
        if movesLeft <= 3 && movesLeft > 0 {
            return .danger
        }
        if combo >= 4 {
            return .fire
        }
        if combo >= 2 {
            return .building
        }
        return .calm
    }

    // MARK: - Game Lifecycle

    /// Creates a new game with the specified mode, resetting all state.
    func startGame(mode: GameMode) {
        gameMode = mode

        // Select badges and configure RNG based on mode
        let seed: Int?
        switch mode {
        case .daily:
            let dailySeed = getDailySeed()
            seed = dailySeed
            var seeded = SeededRandom(seed: dailySeed)
            gameBadges = selectGameBadges(seed: dailySeed)
            // We need a RandomNumberGenerator conformance for SeededRandom.
            // For now, use the system RNG seeded boards are handled by createInitialState.
            rng = SystemRandomNumberGenerator()
            let state = createInitialState(mode: mode, gameBadges: gameBadges, rng: &rng)
            applyGameState(state)

        case .classic:
            seed = nil
            gameBadges = selectGameBadges()
            rng = SystemRandomNumberGenerator()
            let state = createInitialState(mode: mode, gameBadges: gameBadges, rng: &rng)
            applyGameState(state)
        }

        // Reset transient UI state
        scorePopups = []
        lastTurnResult = nil
        matchIntensity = nil
        isAnimating = false
        hintPositions = []
        hintMessage = nil
        invalidSwapPositions = nil
        swapAnimation = nil

        // Start hint idle timer
        resetHintTimer()

        // Audio: game start fanfare
        AudioEngine.shared.playSFX(.gameStart)
        HapticManager.shared.playTileSelect()
    }

    /// Restarts the game with the same mode.
    func resetGame() {
        startGame(mode: gameMode)
    }

    // MARK: - Tile Selection

    /// Handles a tap on a tile at the given position.
    /// Implements the full selection/swap/special-activation state machine.
    func selectTile(at pos: Position) {
        guard gamePhase == .playing, !isAnimating else { return }
        guard pos.row >= 0, pos.row < BOARD_SIZE, pos.col >= 0, pos.col < BOARD_SIZE else { return }

        // Clear hint state on any interaction
        clearHints()

        // Check if tapped tile is a special tile -- activate immediately
        let clickedCell = board[pos.row][pos.col]
        if clickedCell.isSpecial != nil {
            activateSpecialTile(at: pos)
            return
        }

        // No tile selected yet -- select this one
        guard let selected = selectedTile else {
            selectedTile = pos
            AudioEngine.shared.playSFX(.tileSelect)
            resetHintTimer()
            return
        }

        // Tapping the same tile -- deselect
        if selected == pos {
            selectedTile = nil
            AudioEngine.shared.playSFX(.tileDeselect)
            resetHintTimer()
            return
        }

        // Not adjacent -- reselect the new tile
        if !isAdjacentSwap(selected, pos) {
            selectedTile = pos
            AudioEngine.shared.playSFX(.tileSelect)
            resetHintTimer()
            return
        }

        // Adjacent tile -- attempt swap
        attemptSwap(from: selected, to: pos)
    }

    /// Handles a swipe gesture from one position to an adjacent position.
    func swipeTile(from: Position, to: Position) {
        guard gamePhase == .playing, !isAnimating else { return }
        guard isAdjacentSwap(from, to) else { return }

        // Clear hint state on any interaction
        clearHints()

        // Check if source is a special tile -- activate it
        let fromCell = board[from.row][from.col]
        if fromCell.isSpecial != nil {
            activateSpecialTile(at: from)
            return
        }

        // Attempt the swap
        attemptSwap(from: from, to: to)
    }

    // MARK: - Private: Swap Logic

    /// Attempts to swap two adjacent tiles. If the swap produces matches,
    /// triggers the animation sequence and applies the result. Otherwise
    /// plays invalid swap feedback.
    private func attemptSwap(from pos1: Position, to pos2: Position) {
        let result = processTurn(
            board: board,
            pos1: pos1,
            pos2: pos2,
            gameBadges: gameBadges,
            comboCarryIn: comboCarry,
            rng: &rng
        )

        // Clear selection regardless of outcome
        selectedTile = nil

        guard let result = result else {
            // Invalid swap -- no matches produced
            playInvalidSwapFeedback(positions: [pos1, pos2])
            resetHintTimer()
            return
        }

        // Valid swap -- animate then apply
        resetHintTimer()
        swapAnimation = (pos1: pos1, pos2: pos2)
        isAnimating = true

        // Delay to let swap animation play, then apply the turn result
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.swapAnimation = nil
                self.applyResult(result, effectPosition: pos2, costMove: true)
            }
        }
    }

    // MARK: - Private: Special Tile Activation

    /// Activates a special tile at the given position, costing one move.
    private func activateSpecialTile(at pos: Position) {
        let cell = board[pos.row][pos.col]
        guard let specialType = cell.isSpecial else { return }

        let result = triggerSpecialTile(
            board: board,
            pos: pos,
            gameBadges: gameBadges,
            rng: &rng
        )

        guard let result = result else { return }

        // Play the activation sound immediately
        playSpecialTileSound(specialType)

        // Apply the result (costs a move)
        selectedTile = nil
        isAnimating = true
        applyResult(result, effectPosition: pos, costMove: true)
    }

    // MARK: - Apply Result

    /// Applies a TurnResult to the game state with full audio/haptic/visual feedback.
    /// This is the core orchestration method -- the equivalent of useGame's applyResult.
    private func applyResult(_ result: TurnResult, effectPosition: Position, costMove: Bool) {
        // Calculate new state values
        let newScore = score + result.scoreGained
        let newMovesLeft = costMove ? movesLeft - 1 : movesLeft
        let newMatchCount = matchCount + result.matchesFound.count
        let newMaxCombo = max(maxCombo, result.combo)
        let maxMatchSize = result.matchesFound.map(\.positions.count).max() ?? 0

        // Determine match intensity
        let intensity = MatchIntensity.from(
            score: result.scoreGained,
            combo: result.combo,
            maxMatchSize: maxMatchSize
        )

        // --- Audio Feedback ---

        // Match sounds (escalated by match size)
        let matchSound: GameSound = maxMatchSize >= 5 ? .match5Plus : maxMatchSize >= 4 ? .match4 : .match3
        AudioEngine.shared.playSFX(matchSound)
        if result.combo > 1 {
            AudioEngine.shared.playSFX(.combo(level: result.combo))
        }

        // Special tile creation sounds (delayed slightly)
        for special in result.specialTilesCreated {
            Timer.scheduledTimer(withTimeInterval: 0.2, repeats: false) { [weak self] _ in
                Task { @MainActor in
                    self?.playSpecialTileSound(special.type)
                }
            }
        }

        // Cascade sounds with staggered timing
        if result.cascadeCount > 0 {
            for i in 0..<result.cascadeCount {
                let delay = 0.25 + Double(i) * 0.15
                Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
                    Task { @MainActor in
                        AudioEngine.shared.playSFX(.cascade(level: i + 1))
                    }
                }
            }
            // Staggered tile land sounds after final cascade settles
            let landBase = 0.25 + Double(result.cascadeCount) * 0.15 + 0.2
            for col in 0..<BOARD_SIZE {
                let delay = landBase + Double(col) * 0.035
                Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
                    Task { @MainActor in
                        AudioEngine.shared.playSFX(.tileLand)
                    }
                }
            }
        }

        // Shape bonus sound
        if let shapeBonus = result.shapeBonus {
            Timer.scheduledTimer(withTimeInterval: 0.15, repeats: false) { _ in
                Task { @MainActor in
                    AudioEngine.shared.playSFX(.shapeBonus(shapeBonus.type))
                }
            }
        }

        // Final move warning
        if costMove && newMovesLeft >= 1 && newMovesLeft <= 3 {
            Timer.scheduledTimer(withTimeInterval: 0.6, repeats: false) { _ in
                Task { @MainActor in
                    AudioEngine.shared.playSFX(.finalMoveWarning(movesLeft: newMovesLeft))
                }
            }
        }

        // --- Haptic Feedback ---

        HapticManager.shared.playMatch(intensity: intensity)

        // --- Adaptive Music ---

        let newMusicState: MusicState
        if newMovesLeft <= 3 && newMovesLeft > 0 {
            newMusicState = .danger
        } else if result.combo >= 4 {
            newMusicState = .fire
        } else if result.combo >= 2 {
            newMusicState = .building
        } else {
            newMusicState = .calm
        }
        AudioEngine.shared.setMusicState(newMusicState)

        // --- Match Intensity Visual Effect ---

        matchIntensity = intensity

        // Clear match intensity after the effect duration
        let effectDuration = intensity.effectDuration
        Timer.scheduledTimer(withTimeInterval: effectDuration, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.matchIntensity = nil
            }
        }

        // --- Score Popup ---

        let popup = ScorePopup(
            value: result.scoreGained,
            position: effectPosition,
            combo: result.combo
        )
        scorePopups.append(popup)

        // Remove popup after animation completes
        let popupID = popup.id
        Timer.scheduledTimer(withTimeInterval: 2.6, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.scorePopups.removeAll { $0.id == popupID }
            }
        }

        // --- Apply State ---

        board = result.board
        score = newScore
        movesLeft = newMovesLeft
        combo = result.combo
        comboCarry = result.comboCarry
        maxCombo = newMaxCombo
        selectedTile = nil
        matchCount = newMatchCount
        totalCascades = totalCascades + result.cascadeCount
        lastTurnResult = result

        // --- Game Over Check ---

        let noMovesLeft = newMovesLeft <= 0
        let noValidMoves = !noMovesLeft && !hasValidMoves(board: result.board, gameBadges: gameBadges)
        let isGameOver = noMovesLeft || noValidMoves

        if isGameOver {
            // Keep isAnimating true to block input during wind-down.
            // Transition to gameover after effects play out.
            Timer.scheduledTimer(withTimeInterval: 1.8, repeats: false) { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    AudioEngine.shared.playSFX(.gameOver)
                    self.gamePhase = .gameover
                    self.gameOverReason = noValidMoves ? .noValidMoves : .movesExhausted
                    self.isAnimating = false
                }
            }
        } else {
            // Unblock input after a brief settle delay
            Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.isAnimating = false
                }
            }
            // Restart hint timer for next idle period
            resetHintTimer()
        }
    }

    // MARK: - Hint System

    /// Cancels any pending hint timers and clears hint display state.
    private func clearHints() {
        hintMessageTimer?.invalidate()
        hintMessageTimer = nil
        hintHighlightTimer?.invalidate()
        hintHighlightTimer = nil
        hintPositions = []
        hintMessage = nil
    }

    /// Resets the hint idle timer. After 10s of inactivity a nudge message appears.
    /// At 12s the best available swap is highlighted.
    private func resetHintTimer() {
        clearHints()

        // Pre-hint: show a playful nudge message at 10 seconds
        hintMessageTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.gamePhase == .playing, !self.isAnimating else { return }
                let msg = hintMessages.randomElement() ?? "psst... try these"
                self.hintMessage = msg
                AudioEngine.shared.playSFX(.hint)
            }
        }

        // Actual hint highlight at 12 seconds (2 seconds after message)
        hintHighlightTimer = Timer.scheduledTimer(withTimeInterval: 12.0, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.gamePhase == .playing, !self.isAnimating else { return }
                if let hint = findBestHint(board: self.board, gameBadges: self.gameBadges) {
                    self.hintPositions = [hint.pos1, hint.pos2]
                }
            }
        }
    }

    // MARK: - Invalid Swap Feedback

    /// Plays audio + haptic feedback for an invalid swap and triggers
    /// a brief shake animation on the involved tiles.
    private func playInvalidSwapFeedback(positions: [Position]) {
        AudioEngine.shared.playSFX(.invalidSwap)
        HapticManager.shared.playInvalidSwap()
        AudioEngine.shared.duckMusic(duration: 0.2)

        invalidSwapPositions = positions

        // Clear shake animation after 400ms
        Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.invalidSwapPositions = nil
            }
        }
    }

    // MARK: - Audio Helpers

    /// Plays the appropriate sound effect for a special tile type.
    private func playSpecialTileSound(_ type: SpecialTileType) {
        switch type {
        case .bomb:
            AudioEngine.shared.playSFX(.bombActivate)
            HapticManager.shared.playBombExplosion()
        case .cosmicBlast:
            AudioEngine.shared.playSFX(.cosmicBlastActivate)
            HapticManager.shared.playCosmicBlast()
        case .vibestreak:
            AudioEngine.shared.playSFX(.vibestreakActivate)
            HapticManager.shared.playVibestreak()
        }
    }

    // MARK: - State Application

    /// Copies values from a GameState struct into this session's properties.
    private func applyGameState(_ state: GameState) {
        board = state.board
        score = state.score
        movesLeft = state.movesLeft
        combo = state.combo
        comboCarry = state.comboCarry
        maxCombo = state.maxCombo
        selectedTile = state.selectedTile
        gamePhase = state.gamePhase
        gameMode = state.gameMode
        gameBadges = state.gameBadges
        matchCount = state.matchCount
        totalCascades = state.totalCascades
        gameOverReason = state.gameOverReason
    }

    // MARK: - Preview Support

    #if DEBUG
    /// Creates a GameSession with preset values for SwiftUI previews.
    static func preview(score: Int = 0, movesLeft: Int = CLASSIC_MOVES, combo: Int = 0, gamePhase: GamePhase = .playing) -> GameSession {
        let session = GameSession()
        session.score = score
        session.movesLeft = movesLeft
        session.combo = combo
        session.gamePhase = gamePhase
        return session
    }
    #endif
}

