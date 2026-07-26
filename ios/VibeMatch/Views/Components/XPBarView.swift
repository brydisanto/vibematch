import SwiftUI

// MARK: - XP Bar View

/// Displays the player's current level and XP progress toward the next level.
struct XPBarView: View {
    let playerXP: PlayerXPData

    var body: some View {
        HStack(spacing: 8) {
            // Level badge
            ZStack {
                Circle()
                    .fill(VibeColors.primary)
                    .frame(width: 32, height: 32)
                Text("\(playerXP.currentLevel)")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }

            // XP progress bar
            VStack(alignment: .leading, spacing: 2) {
                Text("Level \(playerXP.currentLevel)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(VibeColors.textSecondary)

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(VibeColors.textSecondary.opacity(0.2))
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: 3)
                            .fill(
                                LinearGradient(
                                    colors: [VibeColors.primary, VibeColors.primaryLight],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geo.size.width * playerXP.progress, height: 6)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: 100)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(VibeColors.background.opacity(0.7))
                .overlay(
                    Capsule()
                        .strokeBorder(VibeColors.hudBorder.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - XP Gain Animation View

/// Shows XP earned after a game with an animated fill.
struct XPGainView: View {
    let xpGained: Int
    let previousProgress: Double
    let newProgress: Double
    let newLevel: Int
    let didLevelUp: Bool

    @State private var animatedProgress: Double = 0

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Level \(newLevel)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(VibeColors.primaryLight)
                Spacer()
                Text("+\(xpGained) XP")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(VibeColors.accentCool)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(VibeColors.textSecondary.opacity(0.2))
                        .frame(height: 8)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [VibeColors.primary, VibeColors.primaryLight],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * animatedProgress, height: 8)
                }
            }
            .frame(height: 8)

            if didLevelUp {
                Text("LEVEL UP!")
                    .font(.system(size: 16, weight: .black, design: .rounded))
                    .foregroundStyle(VibeColors.gold)
            }
        }
        .onAppear {
            animatedProgress = previousProgress
            withAnimation(.easeInOut(duration: 1.0).delay(0.3)) {
                animatedProgress = didLevelUp ? 1.0 : newProgress
            }
            if didLevelUp {
                withAnimation(.easeInOut(duration: 0.5).delay(1.3)) {
                    animatedProgress = newProgress
                }
            }
        }
    }
}

#Preview {
    ZStack {
        VibeColors.background.ignoresSafeArea()
        VStack(spacing: 20) {
            XPBarView(playerXP: PlayerXPData(totalXP: 450, currentLevel: 3))
            XPGainView(xpGained: 550, previousProgress: 0.3, newProgress: 0.7, newLevel: 3, didLevelUp: false)
                .padding(.horizontal)
            XPGainView(xpGained: 800, previousProgress: 0.8, newProgress: 0.2, newLevel: 5, didLevelUp: true)
                .padding(.horizontal)
        }
    }
}
