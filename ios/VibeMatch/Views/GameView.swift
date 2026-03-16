import SwiftUI
import SpriteKit

// MARK: - Game View

/// The main game screen that hosts the SpriteKit game board with a SwiftUI HUD overlay.
/// Once the GameScene SpriteKit scene is available, it will be embedded via SpriteView.
struct GameView: View {
    @State private var session = GameSession()
    @State private var showPauseMenu = false
    private let initialMode: GameMode
    var onGoHome: () -> Void

    init(mode: GameMode, onGoHome: @escaping () -> Void) {
        self.initialMode = mode
        self.onGoHome = onGoHome
    }

    var body: some View {
        ZStack {
            // Background
            VibeColors.background.ignoresSafeArea()

            // Game board area -- placeholder until SpriteKit scene is connected
            gameBoardPlaceholder

            // HUD overlay
            VStack(spacing: 0) {
                // Top bar: back + logo + mute/pause
                topBar
                    .padding(.horizontal, 12)
                    .padding(.top, 4)

                // HUD cards
                GameHUDView(session: session)
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
                    onGoHome: onGoHome
                )
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: session.gamePhase)
        .animation(.easeInOut(duration: 0.2), value: showPauseMenu)
        .onAppear {
            session.startGame(mode: initialMode)
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Back button
            circleButton(icon: "chevron.left") {
                onGoHome()
            }

            Spacer()

            // Logo
            Text("VIBEMATCH")
                .font(.system(size: 18, weight: .black, design: .rounded))
                .tracking(2)
                .foregroundStyle(
                    LinearGradient(
                        colors: [VibeColors.primaryLight, VibeColors.primary],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .shadow(color: VibeColors.primary.opacity(0.4), radius: 8)

            Spacer()

            // Mute + Pause
            HStack(spacing: 10) {
                circleButton(icon: session.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill") {
                    session.isMuted.toggle()
                }
                circleButton(icon: "pause.fill") {
                    showPauseMenu = true
                }
            }
        }
    }

    private func circleButton(icon: String, action: @escaping () -> Void) -> some View {
        Button {
            let gen = UIImpactFeedbackGenerator(style: .light)
            gen.impactOccurred()
            action()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(Color.black.opacity(0.6))
                        .overlay(
                            Circle()
                                .strokeBorder(VibeColors.gold.opacity(0.5), lineWidth: 1.5)
                        )
                )
        }
        .buttonStyle(VibePressStyle())
    }

    // MARK: - Game Board Placeholder

    private var gameBoardPlaceholder: some View {
        GeometryReader { geo in
            let boardSize = min(geo.size.width - 16, geo.size.height - 280, 680)
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.03))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(VibeColors.primary.opacity(0.15), lineWidth: 1)
                    )

                VStack(spacing: 12) {
                    Image(systemName: "gamecontroller.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(VibeColors.primary.opacity(0.3))
                    Text("SpriteKit Game Board")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(VibeColors.textSecondary.opacity(0.5))
                    Text("Connect GameScene via SpriteView")
                        .font(.system(size: 11))
                        .foregroundStyle(VibeColors.textSecondary.opacity(0.3))
                }
            }
            .frame(width: boardSize, height: boardSize)
            .position(x: geo.size.width / 2, y: geo.size.height / 2 + 40)
        }
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

// MARK: - Preview

#Preview {
    GameView(mode: .classic, onGoHome: {})
}
