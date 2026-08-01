import SwiftUI

/// Pin Drop iOS app entry point.
@main
struct PinDropApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(.dark)
                .onAppear {
                    appState.load()
                }
        }
    }
}

/// Root navigation router. Switches the displayed view based on
/// AppState.currentView. The router holds the pending GameMode so the
/// landing screen can request a game and the game screen can launch it
/// with the right mode.
struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var pendingMode: GameMode = .classic
    @State private var showRules = false

    var body: some View {
        rootContent
            .onAppear(perform: handleDebugAutostart)
    }

    /// Debug-only autostart for simulator screenshotting; compiled out of
    /// release builds:
    ///   xcrun simctl launch booted com.goodvibesclub.pindrop -autostart classic
    ///   xcrun simctl launch booted com.goodvibesclub.pindrop -autostart daily
    private func handleDebugAutostart() {
        #if DEBUG
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "-autostart"), i + 1 < args.count {
            pendingMode = (args[i + 1] == "daily") ? .daily : .classic
            appState.currentView = .playing
        }
        #endif
    }

    private var rootContent: some View {
        ZStack {
            Group {
                switch appState.currentView {
                case .landing:
                    LandingView(
                        onStartClassic: {
                            pendingMode = .classic
                            startSession(mode: .classic)
                        },
                        onStartDaily: {
                            pendingMode = .daily
                            startSession(mode: .daily)
                        },
                        onOpenPinBook: { appState.currentView = .collection },
                        onOpenLeaderboard: { appState.currentView = .collection },
                        onOpenAchievements: { appState.currentView = .collection },
                        onShowInstructions: {
                            withAnimation(.easeOut(duration: 0.2)) { showRules = true }
                        },
                        onOpenProfile: { /* TODO: profile sheet */ },
                        onOpenBuyPrizeGames: { /* TODO: prize games shop */ },
                        capsuleCount: appState.playerProfile.unopenedCapsules.count,
                        pinsCollected: appState.playerProfile.collection.uniqueCount,
                        classicPlays: appState.playerProfile.gamesPlayed,
                        bonusPrizeGames: 0,
                        streak: appState.playerProfile.streak
                    )
                case .playing:
                    GameView(
                        mode: pendingMode,
                        onGoHome: { appState.currentView = .landing }
                    )
                case .collection:
                    CollectionView(
                        collection: appState.playerProfile.collection,
                        allBadges: BADGES,
                        chests: appState.playerProfile.chests,
                        onOpenChest: nil,
                        onDismiss: { appState.currentView = .landing }
                    )
                case .trading:
                    PinBookPlaceholder(onBack: { appState.currentView = .landing })
                case .levelMap:
                    LevelMapView(
                        progression: appState.progression,
                        onSelectLevel: { levelId in
                            pendingMode = .level(levelId)
                            startSession(mode: .level(levelId))
                        },
                        onGoHome: { appState.currentView = .landing }
                    )
                }
            }

            // How to Play modal over whatever screen is active, mirroring
            // the web's InstructionsModal overlay presentation.
            if showRules {
                RulesView(onClose: {
                    withAnimation(.easeOut(duration: 0.2)) { showRules = false }
                })
                .transition(.opacity.combined(with: .scale(scale: 0.92)))
                .zIndex(50)
            }
        }
    }

    /// Bookkeeping for game start: tick the daily streak, award milestone
    /// capsules if any, then route to the game.
    private func startSession(mode: GameMode) {
        let milestones = appState.playerProfile.tickStreak()
        for days in milestones {
            let capsules = appState.playerProfile.streakCapsules(forMilestone: days, mode: mode)
            appState.playerProfile.unopenedCapsules.append(contentsOf: capsules)
        }
        appState.save()
        appState.currentView = .playing
    }
}

private struct PinBookPlaceholder: View {
    var onBack: () -> Void
    var body: some View {
        VStack(spacing: 20) {
            Text("PIN BOOK")
                .font(.system(size: 40, weight: .black))
                .tracking(4)
                .foregroundStyle(VibeColors.primary)
            Text("Your collection lands here next")
                .foregroundStyle(VibeColors.textSecondary)
            Button("Back") { onBack() }
                .padding(.top, 12)
        }
    }
}
