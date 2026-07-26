import SwiftUI

// MARK: - Level Map View

/// Scrollable level selector showing all available levels with
/// star ratings, lock states, and objective previews.
struct LevelMapView: View {
    let progression: ProgressionManager
    let onSelectLevel: (Int) -> Void
    let onGoHome: () -> Void

    @State private var scrollTarget: Int?

    var body: some View {
        ZStack {
            VibeColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                header

                // Level list
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(LevelCatalog.levels) { level in
                                LevelNodeView(
                                    level: level,
                                    stars: progression.starsForLevel(level.id),
                                    isUnlocked: progression.isLevelUnlocked(level.id),
                                    isNext: level.id == progression.levelProgress.highestUnlockedLevel
                                ) {
                                    onSelectLevel(level.id)
                                }
                                .id(level.id)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 16)
                    }
                    .onAppear {
                        // Scroll to the highest unlocked level
                        let target = progression.levelProgress.highestUnlockedLevel
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation {
                                proxy.scrollTo(target, anchor: .center)
                            }
                        }
                    }
                }
            }
        }
    }

    private var header: some View {
        HStack {
            Button {
                onGoHome()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(VibeColors.textSecondary)
            }

            Spacer()

            VStack(spacing: 2) {
                Text("LEVELS")
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .tracking(2)
                    .foregroundStyle(VibeColors.textPrimary)
                Text("\(progression.totalStars) / \(LevelCatalog.totalLevels * 3) Stars")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(VibeColors.textSecondary)
            }

            Spacer()

            // Balance placeholder for symmetry
            CoinBalanceView(balance: progression.coinBalance)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}

// MARK: - Level Node View

/// A single level node in the level map.
struct LevelNodeView: View {
    let level: LevelDefinition
    let stars: Int
    let isUnlocked: Bool
    let isNext: Bool
    let onTap: () -> Void

    var body: some View {
        Button {
            if isUnlocked { onTap() }
        } label: {
            HStack(spacing: 14) {
                // Level number circle
                ZStack {
                    Circle()
                        .fill(circleColor)
                        .frame(width: 48, height: 48)

                    if isUnlocked {
                        Text("\(level.id)")
                            .font(.system(size: 20, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                    } else {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }
                .overlay(
                    isNext ? Circle()
                        .strokeBorder(VibeColors.accentCool, lineWidth: 2.5)
                        .frame(width: 52, height: 52)
                    : nil
                )

                // Level info
                VStack(alignment: .leading, spacing: 4) {
                    Text("Level \(level.id)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(isUnlocked ? VibeColors.textPrimary : VibeColors.textSecondary.opacity(0.5))

                    Text(level.flavorText)
                        .font(.system(size: 12))
                        .foregroundStyle(isUnlocked ? VibeColors.textSecondary : VibeColors.textSecondary.opacity(0.3))

                    if stars > 0 {
                        HStack(spacing: 2) {
                            Text("Moves: \(level.movesAllowed)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(VibeColors.textSecondary.opacity(0.6))
                        }
                    }
                }

                Spacer()

                // Stars
                if isUnlocked {
                    HStack(spacing: 2) {
                        ForEach(0..<3, id: \.self) { i in
                            Image(systemName: i < stars ? "star.fill" : "star")
                                .font(.system(size: 14))
                                .foregroundStyle(i < stars ? VibeColors.gold : VibeColors.textSecondary.opacity(0.3))
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(
                        isNext
                            ? VibeColors.primary.opacity(0.12)
                            : (isUnlocked ? VibeColors.card : VibeColors.background.opacity(0.5))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(
                                isNext
                                    ? VibeColors.accentCool.opacity(0.5)
                                    : VibeColors.hudBorder.opacity(isUnlocked ? 0.2 : 0.05),
                                lineWidth: 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(!isUnlocked)
        .opacity(isUnlocked ? 1.0 : 0.5)
    }

    private var circleColor: Color {
        if !isUnlocked { return VibeColors.textSecondary.opacity(0.3) }
        if stars == 3 { return VibeColors.gold.opacity(0.8) }
        if stars > 0 { return VibeColors.primary }
        return VibeColors.primary.opacity(0.6)
    }
}

// MARK: - Preview

#Preview {
    LevelMapView(
        progression: ProgressionManager(),
        onSelectLevel: { _ in },
        onGoHome: {}
    )
}
