import SwiftUI

// MARK: - Energy Bar View

/// Displays the player's energy (hearts) with a countdown timer
/// for the next regen when not full.
struct EnergyBarView: View {
    let energy: EnergyState
    let onRefill: (() -> Void)?

    @State private var displayEnergy: Int
    @State private var countdown: String = ""
    @State private var timer: Timer?

    init(energy: EnergyState, onRefill: (() -> Void)? = nil) {
        self.energy = energy
        self.onRefill = onRefill
        self._displayEnergy = State(initialValue: energy.currentEnergy)
    }

    var body: some View {
        HStack(spacing: 4) {
            // Hearts
            ForEach(0..<EnergyState.maxEnergy, id: \.self) { index in
                Image(systemName: index < displayEnergy ? "heart.fill" : "heart")
                    .font(.system(size: 16))
                    .foregroundStyle(index < displayEnergy ? VibeColors.accentWarm : VibeColors.textSecondary.opacity(0.4))
            }

            // Countdown or full indicator
            if displayEnergy < EnergyState.maxEnergy {
                Text(countdown)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(VibeColors.textSecondary)
                    .frame(minWidth: 36)
            }

            // Refill button
            if let onRefill, displayEnergy < EnergyState.maxEnergy {
                Button {
                    onRefill()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(VibeColors.accentCool)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(VibeColors.background.opacity(0.7))
                .overlay(
                    Capsule()
                        .strokeBorder(VibeColors.hudBorder.opacity(0.3), lineWidth: 1)
                )
        )
        .onAppear { startTimer() }
        .onDisappear { stopTimer() }
        .onChange(of: energy.currentEnergy) { _, newValue in
            withAnimation(.spring(response: 0.3)) {
                displayEnergy = newValue
            }
        }
    }

    private func startTimer() {
        updateCountdown()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            updateCountdown()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func updateCountdown() {
        var e = energy
        e.recalculate()
        displayEnergy = e.currentEnergy
        if e.currentEnergy < EnergyState.maxEnergy {
            let total = Int(e.secondsUntilNextRegen)
            let minutes = total / 60
            let seconds = total % 60
            countdown = String(format: "%d:%02d", minutes, seconds)
        } else {
            countdown = ""
        }
    }
}

#Preview {
    ZStack {
        VibeColors.background.ignoresSafeArea()
        VStack(spacing: 20) {
            EnergyBarView(energy: EnergyState(currentEnergy: 5, lastRegenTimestamp: .now))
            EnergyBarView(energy: EnergyState(currentEnergy: 3, lastRegenTimestamp: .now))
            EnergyBarView(energy: EnergyState(currentEnergy: 0, lastRegenTimestamp: .now), onRefill: {})
        }
    }
}
