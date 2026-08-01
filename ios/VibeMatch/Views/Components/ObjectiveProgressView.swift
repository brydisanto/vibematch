import SwiftUI

// MARK: - Objective Progress View

/// Compact in-game progress bar showing objective status during level mode.
/// Displays text like "Create 2/3 Bombs" with a fill bar.
struct ObjectiveProgressView: View {
    let tracker: ObjectiveTracker

    var body: some View {
        HStack(spacing: 8) {
            // Checkmark or target icon
            Image(systemName: tracker.isComplete ? "checkmark.circle.fill" : "target")
                .font(.system(size: 14))
                .foregroundStyle(tracker.isComplete ? .green : VibeColors.accentCool)

            // Objective text + progress
            VStack(alignment: .leading, spacing: 2) {
                Text(tracker.objectiveText)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(VibeColors.textPrimary)

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(VibeColors.textSecondary.opacity(0.2))
                            .frame(height: 4)

                        RoundedRectangle(cornerRadius: 2)
                            .fill(tracker.isComplete ? Color.green : VibeColors.accentCool)
                            .frame(
                                width: geo.size.width * tracker.progressRatio,
                                height: 4
                            )
                            .animation(.spring(response: 0.3), value: tracker.progressRatio)
                    }
                }
                .frame(height: 4)
            }

            // Numeric progress
            Text(tracker.progressText)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(tracker.isComplete ? .green : VibeColors.textSecondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(VibeColors.background.opacity(0.8))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(
                            (tracker.isComplete ? Color.green : VibeColors.hudBorder).opacity(0.4),
                            lineWidth: 1
                        )
                )
        )
    }
}

// MARK: - Coin Balance View

/// Displays the player's Vibe Coin balance.
struct CoinBalanceView: View {
    let balance: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "bitcoinsign.circle.fill")
                .font(.system(size: 14))
                .foregroundStyle(VibeColors.gold)
            Text("\(balance)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(VibeColors.gold)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(
            Capsule()
                .fill(VibeColors.background.opacity(0.7))
                .overlay(
                    Capsule()
                        .strokeBorder(VibeColors.gold.opacity(0.3), lineWidth: 1)
                )
        )
    }
}
