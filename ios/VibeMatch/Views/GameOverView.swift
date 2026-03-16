import SwiftUI

// MARK: - Rank Configuration

private struct RankConfig {
    let threshold: Int
    let label: String
    let color: Color
    let accentColor: Color
    let icon: String
    let stars: Int
}

private let rankConfigs: [RankConfig] = [
    RankConfig(threshold: 20000, label: "COSMIC",  color: Color(red: 0.70, green: 0.40, blue: 1.0), accentColor: Color(red: 0.10, green: 0.02, blue: 0.20), icon: "sparkles", stars: 3),
    RankConfig(threshold: 15000, label: "GOLD",    color: VibeColors.gold, accentColor: Color(red: 0.17, green: 0.10, blue: 0.0), icon: "medal.fill", stars: 3),
    RankConfig(threshold: 10000, label: "SILVER",  color: Color(red: 0.89, green: 0.91, blue: 0.94), accentColor: Color(red: 0.10, green: 0.13, blue: 0.17), icon: "medal.fill", stars: 2),
    RankConfig(threshold: 5000,  label: "BRONZE",  color: Color(red: 0.80, green: 0.50, blue: 0.20), accentColor: Color(red: 0.18, green: 0.09, blue: 0.02), icon: "medal.fill", stars: 2),
    RankConfig(threshold: 0,     label: "WOOD",    color: Color(red: 0.63, green: 0.32, blue: 0.18), accentColor: Color(red: 0.17, green: 0.07, blue: 0.02), icon: "leaf.fill", stars: 1),
]

private func getRank(for score: Int) -> RankConfig {
    rankConfigs.first { score >= $0.threshold } ?? rankConfigs.last!
}

// MARK: - Game Over View

/// Full-screen overlay shown when the game ends.
/// Features animated score counter, rank medallion, star rating,
/// game stats, badge breakdown, and action buttons.
struct GameOverView: View {
    let session: GameSession
    var onPlayAgain: () -> Void
    var onGoHome: () -> Void

    @State private var displayScore: Int = 0
    @State private var showContent = false
    @State private var showRank = false
    @State private var showStats = false
    @State private var showButtons = false
    @State private var scoreFinished = false
    @State private var medallionRotation: Double = 0

    private var rank: RankConfig { getRank(for: session.score) }

    var body: some View {
        ZStack {
            // Backdrop
            Color.black.opacity(0.85)
                .ignoresSafeArea()
                .background(.ultraThinMaterial.opacity(0.3))

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 40)

                    // Rank medallion
                    if showRank {
                        rankMedallion
                            .transition(.scale(scale: 0.3).combined(with: .opacity))
                    }

                    Spacer().frame(height: 8)

                    // Rank label
                    if showRank {
                        Text(rank.label)
                            .font(.system(size: 24, weight: .black, design: .rounded))
                            .tracking(4)
                            .foregroundStyle(rank.color)
                            .shadow(color: rank.color.opacity(0.5), radius: 16)
                            .transition(.scale(scale: 0.5).combined(with: .opacity))
                    }

                    Spacer().frame(height: 4)

                    // Game over reason
                    if let reason = session.gameOverReason {
                        Text(reason == .noValidMoves ? "No valid moves remaining" : "Out of moves")
                            .font(.system(size: 11, weight: .medium))
                            .tracking(1)
                            .foregroundStyle(Color.white.opacity(0.35))
                    }

                    Spacer().frame(height: 16)

                    // Animated score
                    scoreDisplay
                        .opacity(showContent ? 1 : 0)

                    // New high score badge
                    if session.isNewHighScore && scoreFinished {
                        newHighScoreBadge
                            .transition(.scale.combined(with: .opacity))
                    }

                    Spacer().frame(height: 8)

                    // Star rating
                    if showRank {
                        starRating
                            .transition(.scale(scale: 0.5).combined(with: .opacity))
                    }

                    // Rank progress bar
                    if showStats {
                        rankProgressBar
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    Spacer().frame(height: 20)

                    // Stats grid
                    if showStats {
                        statsGrid
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    Spacer().frame(height: 20)

                    // Badge breakdown
                    if showStats && !session.gameBadges.isEmpty {
                        badgeSection
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    Spacer().frame(height: 12)

                    // Craig reaction
                    if showStats {
                        craigReaction
                            .transition(.scale.combined(with: .opacity))
                    }

                    Spacer().frame(height: 24)

                    // Action buttons
                    if showButtons {
                        actionButtons
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    Spacer().frame(height: 40)
                }
                .padding(.horizontal, 24)
            }
            .scrollIndicators(.hidden)
        }
        .onAppear { startRevealSequence() }
    }

    // MARK: - Reveal Sequence

    private func startRevealSequence() {
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7).delay(0.2)) {
            showContent = true
        }
        withAnimation(.spring(response: 0.6, dampingFraction: 0.6).delay(0.4)) {
            showRank = true
        }

        // Start score counter after rank appears
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            animateScoreCounter()
        }

        withAnimation(.spring(response: 0.5).delay(2.2)) {
            showStats = true
        }
        withAnimation(.spring(response: 0.5).delay(2.6)) {
            showButtons = true
        }

        // Medallion rotation
        withAnimation(.linear(duration: 15).repeatForever(autoreverses: false)) {
            medallionRotation = 360
        }
    }

    // MARK: - Score Counter Animation

    private func animateScoreCounter() {
        let target = session.score
        let duration: Double = 1.8
        let startTime = Date()

        Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { timer in
            let elapsed = Date().timeIntervalSince(startTime)
            let progress = min(elapsed / duration, 1.0)
            // Ease out quart
            let eased = 1.0 - pow(1.0 - progress, 4)
            displayScore = Int(eased * Double(target))

            if progress >= 1.0 {
                timer.invalidate()
                displayScore = target
                withAnimation(.spring(response: 0.3)) {
                    scoreFinished = true
                }
            }
        }
    }

    // MARK: - Rank Medallion

    private var rankMedallion: some View {
        ZStack {
            // Outer glow halo
            Circle()
                .fill(
                    RadialGradient(
                        colors: [rank.color.opacity(0.15), .clear],
                        center: .center,
                        startRadius: 20,
                        endRadius: 70
                    )
                )
                .frame(width: 140, height: 140)
                .scaleEffect(scoreFinished ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 3).repeatForever(autoreverses: true), value: scoreFinished)

            // Spinning ring
            Circle()
                .strokeBorder(
                    AngularGradient(
                        colors: [rank.color, rank.color.opacity(0.1), rank.color],
                        center: .center
                    ),
                    lineWidth: 2
                )
                .frame(width: 100, height: 100)
                .rotationEffect(.degrees(medallionRotation))

            // Shield body
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [rank.accentColor, rank.color.opacity(0.15)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 80, height: 80)

                Circle()
                    .strokeBorder(rank.color, lineWidth: 2)
                    .frame(width: 80, height: 80)

                // Rank icon
                Image(systemName: rank.icon)
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(rank.color)
                    .shadow(color: rank.color.opacity(0.6), radius: 8)
            }
        }
    }

    // MARK: - Score Display

    private var scoreDisplay: some View {
        Text(displayScore.formatted(.number))
            .font(.system(size: 52, weight: .black, design: .rounded))
            .foregroundStyle(rank.color)
            .shadow(color: rank.color.opacity(0.4), radius: 20)
            .scaleEffect(scoreFinished ? 1.05 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.5), value: scoreFinished)
            .contentTransition(.numericText())
    }

    // MARK: - New High Score Badge

    private var newHighScoreBadge: some View {
        Text("NEW BEST!")
            .font(.system(size: 11, weight: .black))
            .tracking(2)
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 1, green: 0.27, blue: 0), VibeColors.orange],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            )
            .shadow(color: VibeColors.orange.opacity(0.6), radius: 12)
    }

    // MARK: - Star Rating

    private var starRating: some View {
        HStack(spacing: 8) {
            ForEach(1...3, id: \.self) { star in
                Image(systemName: star <= rank.stars ? "star.fill" : "star")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(
                        star <= rank.stars
                            ? VibeColors.gold
                            : Color.white.opacity(0.15)
                    )
                    .shadow(color: star <= rank.stars ? VibeColors.gold.opacity(0.4) : .clear, radius: 6)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - Rank Progress Bar

    private var rankProgressBar: some View {
        let currentIdx = rankConfigs.firstIndex(where: { session.score >= $0.threshold }) ?? rankConfigs.count - 1
        let nextRank = currentIdx > 0 ? rankConfigs[currentIdx - 1] : nil

        return VStack(spacing: 6) {
            if let nextRank {
                let prevThreshold = rank.threshold
                let needed = nextRank.threshold - prevThreshold
                let progress = min(Double(session.score - prevThreshold) / Double(needed), 1.0)
                let remaining = nextRank.threshold - session.score

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.08))
                            .frame(height: 8)

                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [rank.color, nextRank.color],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geo.size.width * progress, height: 8)
                            .shadow(color: nextRank.color.opacity(0.4), radius: 4)
                    }
                }
                .frame(height: 8)

                HStack {
                    Text(rank.label)
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(rank.color)

                    Spacer()

                    Text("\(remaining.formatted(.number)) to \(nextRank.label)")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.white.opacity(0.35))

                    Spacer()

                    Text(nextRank.label)
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(nextRank.color)
                }
            } else {
                Text("MAX RANK")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(2)
                    .foregroundStyle(rank.color)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        HStack(spacing: 12) {
            statCard(label: "MATCHES", value: "\(session.matchCount)", icon: "target", color: .white)
            statCard(label: "BEST COMBO", value: "x\(session.maxCombo)", icon: "flame.fill", color: Color(red: 1.0, green: 0.37, blue: 0.12))
            statCard(label: "CASCADES", value: "\(session.totalCascades)", icon: "bolt.fill", color: Color(red: 0.29, green: 0.62, blue: 1.0))
        }
    }

    private func statCard(label: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(color.opacity(0.5))

            Text(label)
                .font(.system(size: 9, weight: .heavy))
                .tracking(1.5)
                .foregroundStyle(Color.white.opacity(0.35))

            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    // MARK: - Badge Section

    private var badgeSection: some View {
        VStack(spacing: 12) {
            // Section header
            HStack {
                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(height: 1)
                Text("BADGES PLAYED")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(2)
                    .foregroundStyle(Color.white.opacity(0.3))
                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(height: 1)
            }

            // Badge grid
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(sortedBadges) { badge in
                    BadgeCard(badge: badge, showName: true, size: 52)
                }
            }
        }
    }

    private var sortedBadges: [Badge] {
        let tierOrder: [BadgeTier: Int] = [.cosmic: 0, .gold: 1, .silver: 2, .blue: 3]
        return session.gameBadges
            .prefix(6)
            .sorted { (tierOrder[$0.tier] ?? 4) < (tierOrder[$1.tier] ?? 4) }
    }

    // MARK: - Craig Reaction

    private var craigReaction: some View {
        VStack(spacing: 8) {
            // Craig image with fallback
            ZStack {
                Circle()
                    .fill(VibeColors.accentCool.opacity(0.1))
                    .frame(width: 60, height: 60)

                Image("craig")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 50, height: 50)
                    .clipShape(Circle())
                    .background(
                        Circle()
                            .fill(VibeColors.accentCool.opacity(0.2))
                            .frame(width: 50, height: 50)
                            .overlay(
                                Image(systemName: "figure.wave")
                                    .font(.system(size: 24))
                                    .foregroundStyle(VibeColors.accentCool.opacity(0.5))
                            )
                    )
            }

            Text(craigMessage)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(VibeColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 8)
    }

    private var craigMessage: String {
        switch session.score {
        case 20000...:  return "Craig is blown away! Cosmic vibes only!"
        case 15000...:  return "Craig says: \"Pure gold, fam!\""
        case 10000...:  return "Craig approves! Silver tier energy!"
        case 5000...:   return "Craig nods: \"Not bad, keep vibin'!\""
        default:        return "Craig believes in you! Try again!"
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: 12) {
            // Primary row
            HStack(spacing: 12) {
                VibeButton("Home", icon: "house.fill", variant: .secondary) {
                    onGoHome()
                }

                VibeButton("Share", icon: "square.and.arrow.up", variant: .secondary) {
                    shareScore()
                }

                if session.gameMode == .classic {
                    VibeButton("Rematch", icon: "arrow.counterclockwise", variant: .primary) {
                        onPlayAgain()
                    }
                }
            }
        }
    }

    // MARK: - Share

    private func shareScore() {
        let modeLabel = session.gameMode == .daily ? "Daily Challenge" : "Classic"
        let text = "I scored \(session.score.formatted(.number)) on VibeMatch \(modeLabel)! Rank: \(rank.label) | Best Combo: x\(session.maxCombo) #VibeMatch"

        let activityVC = UIActivityViewController(
            activityItems: [text],
            applicationActivities: nil
        )

        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            // Handle iPad popover
            activityVC.popoverPresentationController?.sourceView = rootVC.view
            activityVC.popoverPresentationController?.sourceRect = CGRect(
                x: rootVC.view.bounds.midX,
                y: rootVC.view.bounds.maxY - 100,
                width: 0,
                height: 0
            )
            rootVC.present(activityVC, animated: true)
        }
    }
}

// MARK: - Preview

#Preview {
    GameOverView(
        session: .preview(score: 12750, movesLeft: 0, gamePhase: .gameover),
        onPlayAgain: {},
        onGoHome: {}
    )
}
