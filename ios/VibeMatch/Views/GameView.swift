import SwiftUI
import SpriteKit

// MARK: - Game View

/// The main game screen that hosts the SpriteKit game board with a SwiftUI HUD overlay.
/// Once the GameScene SpriteKit scene is available, it will be embedded via SpriteView.
struct GameView: View {
    @Environment(AppState.self) private var appState
    @State private var session = GameSession()
    @State private var showPauseMenu = false
    @State private var showMoveLog = false
    @State private var showPinBook = false
    @State private var trackLabel: String?
    @State private var trackLabelDismissal: DispatchWorkItem?
    @State private var logoBob: CGFloat = 0
    @State private var sceneRef: GameScene?
    @State private var sceneBridge = GameSceneBridge()
    private let initialMode: GameMode
    var onGoHome: () -> Void
    var progression: ProgressionManager?

    init(mode: GameMode, onGoHome: @escaping () -> Void, progression: ProgressionManager? = nil) {
        self.initialMode = mode
        self.onGoHome = onGoHome
        self.progression = progression
    }

    var body: some View {
        ZStack {
            // Background — mirrors web: vibematchbg2.jpg (object-cover) over #0a0015 base.
            VibeColors.background.ignoresSafeArea()
            GeometryReader { geo in
                Image("GameBackground")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                    .ignoresSafeArea()
            }
            .ignoresSafeArea()
            // Darken slightly so the board + HUD pop, matching web contrast.
            Color.black.opacity(0.25).ignoresSafeArea()

            // Game board (SpriteKit)
            gameBoard

            // HUD overlay
            VStack(spacing: 0) {
                // Top bar: back + logo + mute/pause. zIndex keeps the
                // bobbing logo above the HUD cards, matching web stacking.
                topBar
                    .padding(.horizontal, 12)
                    .padding(.top, 4)
                    .zIndex(10)

                // HUD cards
                GameHUDView(session: session, onTapScore: { showMoveLog = true })
                    .padding(.horizontal, 12)
                    .padding(.top, 4)

                Spacer()
            }

            // Moves warning vignette
            if session.movesLeft <= 5 && session.gamePhase == .playing {
                movesWarningVignette
            }

            // Pause menu
            if showPauseMenu {
                pauseOverlay
            }

            // Game over
            if session.gamePhase == .gameover {
                GameOverView(
                    session: session,
                    onPlayAgain: {
                        session.resetGame()
                    },
                    onGoHome: onGoHome,
                    onNextLevel: nextLevelAction,
                    progression: progression
                )
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
        .fullScreenCover(isPresented: $showMoveLog) {
            MoveLogView(
                moveLog: session.moveLog,
                totalScore: session.score,
                isPostGame: session.gamePhase == .gameover,
                onClose: { showMoveLog = false }
            )
            .background(BackgroundClearView())
        }
        .sheet(isPresented: $showPinBook) {
            CollectionView(
                collection: appState.playerProfile.collection,
                allBadges: BADGES,
                chests: appState.playerProfile.chests,
                onOpenChest: nil,
                onDismiss: { showPinBook = false }
            )
        }
        .animation(.easeInOut(duration: 0.3), value: session.gamePhase)
        .animation(.easeInOut(duration: 0.2), value: showPauseMenu)
        .onAppear {
            sceneBridge.session = session
            session.startGame(mode: initialMode)
            withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) {
                logoBob = -7
            }
        }
        .onChange(of: session.board) { _, newBoard in
            sceneRef?.boardState = newBoard
        }
        .onChange(of: session.gameBadges) { _, newBadges in
            sceneRef?.gameBadges = newBadges
        }
        .onChange(of: session.selectedTile) { _, newSel in
            sceneRef?.selectedPosition = newSel
        }
        .onChange(of: session.swapAnimation) { _, anim in
            guard let anim else { return }
            if anim.invalid {
                sceneRef?.playInvalidSwap(from: anim.pos1, to: anim.pos2)
            } else {
                sceneRef?.playSwapAnimation(from: anim.pos1, to: anim.pos2)
            }
        }
        .onChange(of: session.matchIntensity) { _, intensity in
            guard let intensity else { return }
            let effectIntensity = mapMatchIntensity(intensity)
            let matches = session.lastTurnResult?.matchesFound ?? []
            let positions = matches.flatMap(\.positions)

            // Dominant matched tier drives the burst tint, web parity:
            // a gold-tier match scatters gold, cosmic scatters cosmic.
            var tierCounts: [BadgeTier: Int] = [:]
            for match in matches {
                tierCounts[match.badge.tier, default: 0] += match.positions.count
            }
            let dominantTier = tierCounts.max(by: { $0.value < $1.value })?.key

            sceneRef?.playMatchVisualEffects(
                intensity: effectIntensity,
                matchedPositions: positions,
                dominantTier: dominantTier,
                at: positions.first
            )
        }
    }

    /// Maps the session's match intensity to the SpriteKit effect intensity.
    private func mapMatchIntensity(_ m: MatchIntensity) -> EffectIntensity {
        switch m {
        case .normal: return .normal
        case .big:    return .big
        case .mega:   return .mega
        case .ultra:  return .ultra
        }
    }

    /// Action to start the next level, if available.
    private var nextLevelAction: (() -> Void)? {
        guard let num = initialMode.levelNumber,
              let _ = LevelCatalog.level(num + 1) else { return nil }
        return {
            session.startGame(mode: .level(num + 1))
        }
    }

    // MARK: - Top Bar

    /// Top bar mirrors web layout: Back + Pin Book left, logo center,
    /// Track + Mute + Menu right. Web spec: w-10 h-10 rounded-full
    /// bg-[#111]/90 border-2 border-[color].
    private var topBar: some View {
        ZStack {
            HStack(spacing: 8) {
                circleButton(icon: "chevron.left", rim: ArcadeTokens.goldDim) {
                    onGoHome()
                }
                circleButton(
                    icon: "book.fill",
                    rim: ArcadeTokens.cosmic,
                    badge: appState.playerProfile.unopenedCapsules.count
                ) {
                    showPinBook = true
                }
                Spacer(minLength: 0)
                circleButton(icon: "music.note", rim: ArcadeTokens.cosmic) {
                    switchTrack()
                }
                circleButton(
                    icon: session.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill",
                    rim: ArcadeTokens.goldDim
                ) {
                    session.isMuted.toggle()
                }
                circleButton(icon: "line.3.horizontal", rim: ArcadeTokens.cosmic) {
                    showPauseMenu = true
                }
            }

            // PIN DROP shaka logo centered, no hit-test blocking
            Image("PinDropLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 84)
                .offset(y: logoBob + 20)
                .shadow(color: .black.opacity(0.85), radius: 18, y: 12)
                .allowsHitTesting(false)
        }
        .frame(height: 48)
        // Track-name toast under the right buttons, matching the web's
        // inline label next to the music button (auto-dismisses ~2.5s).
        .overlay(alignment: .topTrailing) {
            if let trackLabel {
                HStack(spacing: 6) {
                    Image(systemName: session.isMuted ? "speaker.slash.fill" : "music.note")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(ArcadeTokens.cosmic)
                    Text(trackLabel)
                        .font(.custom("Mundial-Bold", size: 13))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(pinHex: "2A2333").opacity(0.95))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(ArcadeTokens.cosmic.opacity(0.5), lineWidth: 1)
                        )
                )
                .shadow(color: .black.opacity(0.4), radius: 8, y: 3)
                .offset(y: 52)
                .transition(.opacity.combined(with: .move(edge: .top)).combined(with: .scale(scale: 0.9)))
                .allowsHitTesting(false)
            }
        }
    }

    /// Cycles to the next BGM track and shows the track-name toast.
    private func switchTrack() {
        let name = AudioEngine.shared.switchBGMTrack()
        trackLabelDismissal?.cancel()
        withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
            trackLabel = name
        }
        let dismiss = DispatchWorkItem {
            withAnimation(.easeOut(duration: 0.2)) {
                trackLabel = nil
            }
        }
        trackLabelDismissal = dismiss
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: dismiss)
    }

    private func circleButton(
        icon: String,
        rim: Color,
        badge: Int = 0,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            let gen = UIImpactFeedbackGenerator(style: .light)
            gen.impactOccurred()
            action()
        } label: {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(pinHex: "180630"), Color(pinHex: "0a0414")],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [rim.opacity(0.9), rim.opacity(0.55)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1.5
                    )
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(rim.opacity(0.95))
                    .shadow(color: rim.opacity(0.5), radius: 4)

                // Unopened-capsule count badge (top-right)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(VibeColors.cosmic))
                        .overlay(Capsule().stroke(.white.opacity(0.6), lineWidth: 0.5))
                        .offset(x: 14, y: -14)
                }
            }
            .frame(width: 40, height: 40)
            .shadow(color: .black.opacity(0.5), radius: 6, y: 3)
        }
        .buttonStyle(VibePressStyle())
    }

    // MARK: - Game Board (SpriteKit)

    private var gameBoard: some View {
        GeometryReader { geo in
            let boardSize = min(geo.size.width - 16, geo.size.height - 280, 680)
            ZStack {
                // The scene is created in onAppear: assigning @State during
                // view rendering gets dropped by SwiftUI, which left sceneRef
                // nil and froze the board after its initial render.
                if let scene = sceneRef {
                    SpriteView(scene: scene, options: [.allowsTransparency])
                        .frame(width: boardSize, height: boardSize)
                        .background(Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }

                // Floating "+score" / combo callouts above the board.
                ScorePopupOverlay(session: session, boardSize: boardSize)
                    .frame(width: boardSize, height: boardSize)
                    .allowsHitTesting(false)
            }
            .frame(width: boardSize, height: boardSize)
            // Inner dark panel, matches web bg-[#111]/95 behind the grid.
            .padding(6)
            .background(
                PinHex("111111").opacity(0.95)
                    .overlay(
                        // Inset top white-highlight for the enamel reflection
                        LinearGradient(
                            colors: [.white.opacity(0.06), .clear],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 13))
            // Gold metallic rim, matches web 3-stop gradient.
            .padding(3)
            .background(
                LinearGradient(
                    stops: [
                        .init(color: ArcadeTokens.gold, location: 0.0),
                        .init(color: ArcadeTokens.goldDim, location: 0.4),
                        .init(color: ArcadeTokens.goldDeep, location: 1.0),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.4), .clear],
                            startPoint: .top,
                            endPoint: .center
                        ),
                        lineWidth: 1
                    )
                    .padding(0.5)
            )
            .shadow(color: ArcadeTokens.goldDeep, radius: 0, y: 2)
            .shadow(color: .black.opacity(0.5), radius: 8, y: 4)
            .shadow(color: .black.opacity(0.4), radius: 25, y: 8)
            // Combo-reactive glow escalates with cascade streaks (web parity).
            .shadow(color: boardGlowColor, radius: boardGlowRadius, x: 0, y: 0)
            .position(x: geo.size.width / 2, y: geo.size.height / 2 + 40)
            .onAppear {
                if sceneRef == nil {
                    sceneRef = makeScene(size: CGSize(width: boardSize, height: boardSize))
                }
            }
        }
    }

    /// Board border gradient colors — escalate with combo (web: gold → orange → cosmic)
    private var boardBorderColors: [Color] {
        if session.combo >= 4 {
            return [VibeColors.primary.opacity(0.6), VibeColors.orange.opacity(0.5), VibeColors.primary.opacity(0.6)]
        } else if session.combo >= 2 {
            return [VibeColors.orange.opacity(0.5), VibeColors.gold.opacity(0.4), VibeColors.orange.opacity(0.5)]
        } else {
            return [VibeColors.gold.opacity(0.4), VibeColors.orange.opacity(0.25), VibeColors.gold.opacity(0.4)]
        }
    }

    private var boardGlowColor: Color {
        if session.combo >= 4 { return VibeColors.primary.opacity(0.4) }
        else if session.combo >= 2 { return VibeColors.orange.opacity(0.3) }
        else { return VibeColors.gold.opacity(0.2) }
    }

    private var boardGlowRadius: CGFloat {
        if session.combo >= 4 { return 30 }
        else if session.combo >= 2 { return 20 }
        else { return 12 }
    }

    private func makeScene(size: CGSize) -> GameScene {
        let scene = GameScene(size: size)
        scene.scaleMode = .resizeFill
        scene.backgroundColor = .clear
        scene.gameDelegate = sceneBridge
        // Initial sync
        scene.gameBadges = session.gameBadges
        scene.boardState = session.board
        scene.selectedPosition = session.selectedTile
        return scene
    }

    // MARK: - Warning Vignette

    private var movesWarningVignette: some View {
        Rectangle()
            .fill(
                RadialGradient(
                    colors: [
                        .clear,
                        session.movesLeft <= 3
                            ? Color.red.opacity(0.25)
                            : VibeColors.orange.opacity(0.15)
                    ],
                    center: .center,
                    startRadius: 150,
                    endRadius: 500
                )
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: session.movesLeft)
    }

    // MARK: - Pause Overlay

    private var pauseOverlay: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()
                .onTapGesture { showPauseMenu = false }

            VStack(spacing: 20) {
                Text("PAUSED")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .tracking(4)
                    .foregroundStyle(VibeColors.textPrimary)

                VStack(spacing: 12) {
                    VibeButton("Resume", icon: "play.fill", variant: .primary) {
                        showPauseMenu = false
                    }
                    VibeButton("Home", icon: "house.fill", variant: .secondary) {
                        onGoHome()
                    }
                }
                .padding(.horizontal, 40)
            }
            .padding(32)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(VibeColors.background)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .strokeBorder(VibeColors.primary.opacity(0.3), lineWidth: 1)
                    )
            )
            .shadow(color: .black.opacity(0.5), radius: 30)
        }
    }
}

// MARK: - GameScene Bridge

/// Bridges GameScene delegate callbacks to the GameSession.
/// Needed because GameSceneDelegate is a class protocol (AnyObject)
/// and GameSession is @MainActor @Observable.
@MainActor
final class GameSceneBridge: GameSceneDelegate {
    var session: GameSession?

    nonisolated func didSelectTile(at position: Position) {
        Task { @MainActor [weak self] in
            self?.session?.selectTile(at: position)
        }
    }

    nonisolated func didSwipeTile(from: Position, to: Position) {
        Task { @MainActor [weak self] in
            self?.session?.swipeTile(from: from, to: to)
        }
    }
}

// MARK: - Preview

#Preview {
    GameView(mode: .classic, onGoHome: {})
}

// MARK: - Background Clear (for transparent fullScreenCover)

/// Allows a fullScreenCover sheet to show the dimmed playfield behind it
/// instead of a solid system background.
private struct BackgroundClearView: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        DispatchQueue.main.async {
            view.superview?.superview?.backgroundColor = .clear
        }
        return view
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}

// MARK: - Score Popup Overlay

/// SwiftUI overlay that renders floating "+score" popups above the board,
/// positioned at the matched tile coordinate. Mirrors the web's score
/// popup behaviour: float up ~80pt over 1.2s, scale + fade.
private struct ScorePopupOverlay: View {
    let session: GameSession
    let boardSize: CGFloat

    /// Tile size used by GameScene (`boardDim * 0.92 / 8` matches SpriteKit
    /// layout closely enough for popup placement). Returns the size of a
    /// single tile in points within the board frame.
    private var tileSize: CGFloat {
        let usable = boardSize * 0.92
        let padding: CGFloat = 2.0 * 7
        return (usable - padding) / 8
    }

    var body: some View {
        ZStack {
            ForEach(session.scorePopups) { popup in
                ScorePopupBubble(popup: popup)
                    .position(positionFor(popup.position))
            }
        }
    }

    private func positionFor(_ p: Position) -> CGPoint {
        // SpriteKit's board is centered; mirror that.
        let usable = boardSize * 0.92
        let pad: CGFloat = 2.0
        let cellWithPad = tileSize + pad
        let originX = (boardSize - usable) / 2 + tileSize / 2
        let originY = (boardSize - usable) / 2 + tileSize / 2
        let x = originX + CGFloat(p.col) * cellWithPad
        let y = originY + CGFloat(p.row) * cellWithPad
        return CGPoint(x: x, y: y)
    }
}

private struct ScorePopupBubble: View {
    let popup: ScorePopup
    @State private var rise: CGFloat = 0
    @State private var opacity: Double = 0
    @State private var scale: CGFloat = 0.6

    private var label: String { "+\(popup.value.formatted(.number))" }

    private var color: Color {
        switch popup.combo {
        case 0...1: return VibeColors.primaryLight
        case 2:     return VibeColors.primary
        case 3:     return VibeColors.orange
        default:    return VibeColors.cosmic
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if popup.combo >= 2 {
                Text("x\(popup.combo + 1)")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1)
                    .foregroundStyle(color.opacity(0.9))
            }
            Text(label)
                .font(.system(size: popup.value >= 1000 ? 22 : 18, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .shadow(color: color.opacity(0.9), radius: 8)
                .shadow(color: .black.opacity(0.8), radius: 2, y: 1)
        }
        .offset(y: -rise)
        .opacity(opacity)
        .scaleEffect(scale)
        .onAppear {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) {
                opacity = 1
                scale = 1.0
            }
            withAnimation(.easeOut(duration: 1.4)) {
                rise = 80
            }
            withAnimation(.easeIn(duration: 0.5).delay(0.9)) {
                opacity = 0
            }
        }
    }
}


