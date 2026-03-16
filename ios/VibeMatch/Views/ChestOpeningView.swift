import SwiftUI

// MARK: - Chest Opening Phase

private enum ChestPhase: Equatable {
    case presenting       // Chest appears with glow
    case holdToOpen       // Player taps/holds to open
    case opening          // Chest lid animation
    case revealing(Int)   // Badges fly out one by one (index of current badge)
    case summary          // All badges shown
}

// MARK: - Chest Opening View

/// Animated chest opening experience.
/// The chest appears with a tier-colored glow, the player taps to open,
/// and badges fly out one by one with reveal animations.
struct ChestOpeningView: View {
    let chest: Chest
    let rewards: [ChestReward]
    let knownBadgeIDs: Set<String>
    var onComplete: () -> Void

    @State private var phase: ChestPhase = .presenting
    @State private var chestScale: CGFloat = 0.3
    @State private var chestGlow: CGFloat = 0
    @State private var lidOpen: Bool = false
    @State private var revealedRewards: [ChestReward] = []
    @State private var currentRewardScale: CGFloat = 0
    @State private var shakeOffset: CGFloat = 0
    @State private var holdProgress: CGFloat = 0
    @State private var holdTimer: Timer? = nil

    private var chestColor: Color {
        switch chest.type {
        case .bronze: return Color(red: 0.80, green: 0.50, blue: 0.20)
        case .silver: return Color(red: 0.75, green: 0.78, blue: 0.82)
        case .gold:   return VibeColors.gold
        case .cosmic: return Color(red: 0.70, green: 0.40, blue: 1.0)
        }
    }

    var body: some View {
        ZStack {
            // Backdrop
            Color.black.opacity(0.9)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                // Chest visual
                chestVisual

                // Phase-specific content
                phaseContent

                Spacer()
            }
        }
        .onAppear { startPresentation() }
        .onDisappear { holdTimer?.invalidate() }
    }

    // MARK: - Chest Visual

    private var chestVisual: some View {
        ZStack {
            // Radial glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [chestColor.opacity(0.3 * chestGlow), .clear],
                        center: .center,
                        startRadius: 20,
                        endRadius: 140
                    )
                )
                .frame(width: 280, height: 280)
                .scaleEffect(1.0 + chestGlow * 0.2)

            // Chest body
            VStack(spacing: 0) {
                // Lid
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [chestColor, chestColor.opacity(0.6)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 140, height: 30)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(chestColor.opacity(0.8), lineWidth: 2)
                        )
                }
                .rotation3DEffect(
                    .degrees(lidOpen ? -110 : 0),
                    axis: (x: 1, y: 0, z: 0),
                    anchor: .top,
                    perspective: 0.5
                )
                .zIndex(lidOpen ? -1 : 1)

                // Body
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [chestColor.opacity(0.8), chestColor.opacity(0.4)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 140, height: 80)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(chestColor.opacity(0.6), lineWidth: 2)
                    )
                    .overlay(
                        // Lock/clasp
                        Circle()
                            .fill(chestColor)
                            .frame(width: 24, height: 24)
                            .overlay(
                                Image(systemName: lidOpen ? "lock.open.fill" : "lock.fill")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.black.opacity(0.6))
                            )
                            .offset(y: -40)
                    )
            }
            .scaleEffect(chestScale)
            .offset(x: shakeOffset)
            .shadow(color: chestColor.opacity(0.5), radius: 20)
        }
    }

    // MARK: - Phase Content

    @ViewBuilder
    private var phaseContent: some View {
        switch phase {
        case .presenting:
            Text(chest.type.rawValue.uppercased() + " CHEST")
                .font(.system(size: 20, weight: .black, design: .rounded))
                .tracking(4)
                .foregroundStyle(chestColor)
                .shadow(color: chestColor.opacity(0.5), radius: 10)
                .transition(.scale.combined(with: .opacity))

        case .holdToOpen:
            VStack(spacing: 16) {
                Text("TAP TO OPEN")
                    .font(.system(size: 16, weight: .heavy))
                    .tracking(3)
                    .foregroundStyle(chestColor)

                // Hold progress ring
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.1), lineWidth: 4)
                        .frame(width: 60, height: 60)

                    Circle()
                        .trim(from: 0, to: holdProgress)
                        .stroke(chestColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .frame(width: 60, height: 60)
                        .rotationEffect(.degrees(-90))

                    Image(systemName: "hand.tap.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(chestColor)
                }
                .onTapGesture { startOpening() }
                .onLongPressGesture(minimumDuration: 0.8, pressing: { pressing in
                    if pressing {
                        startHold()
                    } else {
                        cancelHold()
                    }
                }, perform: {
                    startOpening()
                })
            }
            .transition(.scale.combined(with: .opacity))

        case .opening:
            Text("OPENING...")
                .font(.system(size: 14, weight: .heavy))
                .tracking(3)
                .foregroundStyle(chestColor.opacity(0.6))
                .transition(.opacity)

        case .revealing(let index):
            if index < rewards.count {
                let reward = rewards[index]
                let isNew = !knownBadgeIDs.contains(reward.badge.id)

                VStack(spacing: 12) {
                    if isNew {
                        Text("NEW!")
                            .font(.system(size: 14, weight: .black))
                            .tracking(3)
                            .foregroundStyle(VibeColors.gold)
                            .shadow(color: VibeColors.gold.opacity(0.6), radius: 8)
                            .transition(.scale)
                    }

                    BadgeCard(badge: reward.badge, quantity: reward.quantity, size: 80)
                        .scaleEffect(currentRewardScale)
                        .transition(.scale.combined(with: .opacity))

                    Text("x\(reward.quantity)")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(VibeColors.textPrimary)
                }
                .onTapGesture { advanceReveal() }
            }

        case .summary:
            VStack(spacing: 20) {
                Text("CHEST REWARDS")
                    .font(.system(size: 14, weight: .heavy))
                    .tracking(3)
                    .foregroundStyle(VibeColors.textSecondary)

                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: min(rewards.count, 3)),
                    spacing: 12
                ) {
                    ForEach(rewards) { reward in
                        let isNew = !knownBadgeIDs.contains(reward.badge.id)
                        VStack(spacing: 4) {
                            if isNew {
                                Text("NEW!")
                                    .font(.system(size: 8, weight: .black))
                                    .tracking(1)
                                    .foregroundStyle(VibeColors.gold)
                            }
                            BadgeCard(badge: reward.badge, quantity: reward.quantity, size: 56)
                        }
                    }
                }

                // Craig celebration
                craigCelebration

                VibeButton("Continue", variant: .primary) {
                    onComplete()
                }
                .padding(.horizontal, 40)
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Craig Celebration

    private var craigCelebration: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(VibeColors.accentCool.opacity(0.15))
                    .frame(width: 44, height: 44)

                Image("craig")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
                    .background(
                        Circle()
                            .fill(VibeColors.accentCool.opacity(0.2))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Image(systemName: "figure.wave")
                                    .font(.system(size: 18))
                                    .foregroundStyle(VibeColors.accentCool.opacity(0.4))
                            )
                    )
            }

            Text(craigCelebrationMessage)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(VibeColors.textSecondary)
                .multilineTextAlignment(.leading)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white.opacity(0.04))
        )
    }

    private var craigCelebrationMessage: String {
        let hasNew = rewards.contains { !knownBadgeIDs.contains($0.badge.id) }
        let hasCosmic = rewards.contains { $0.badge.tier == .cosmic }

        if hasCosmic {
            return "Craig is freaking out! A COSMIC drop!"
        } else if hasNew {
            return "Craig loves new discoveries! Nice pull!"
        } else {
            return "Craig says every badge counts toward mastery!"
        }
    }

    // MARK: - Animation Sequence

    private func startPresentation() {
        withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
            chestScale = 1.0
        }
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            chestGlow = 1.0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeInOut(duration: 0.3)) {
                phase = .holdToOpen
            }
        }
    }

    private func startHold() {
        holdProgress = 0
        holdTimer?.invalidate()
        holdTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { timer in
            withAnimation(.linear(duration: 1.0 / 60.0)) {
                holdProgress += 1.0 / 48.0 // ~0.8s to fill
            }
            if holdProgress >= 1.0 {
                timer.invalidate()
                startOpening()
            }
        }
    }

    private func cancelHold() {
        holdTimer?.invalidate()
        withAnimation(.easeOut(duration: 0.2)) {
            holdProgress = 0
        }
    }

    private func startOpening() {
        holdTimer?.invalidate()

        let gen = UIImpactFeedbackGenerator(style: .heavy)
        gen.impactOccurred()

        withAnimation(.easeInOut(duration: 0.3)) {
            phase = .opening
        }

        // Shake animation
        shakeChest {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                lidOpen = true
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                startRevealing()
            }
        }
    }

    private func shakeChest(completion: @escaping () -> Void) {
        let shakeDuration = 0.6
        let shakeCount = 8

        for i in 0..<shakeCount {
            let delay = Double(i) * (shakeDuration / Double(shakeCount))
            let intensity: CGFloat = CGFloat(i + 1) * 1.5

            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                withAnimation(.easeInOut(duration: shakeDuration / Double(shakeCount) / 2)) {
                    shakeOffset = (i % 2 == 0) ? intensity : -intensity
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + shakeDuration) {
            withAnimation(.spring()) { shakeOffset = 0 }
            completion()
        }
    }

    private func startRevealing() {
        guard !rewards.isEmpty else {
            withAnimation { phase = .summary }
            return
        }
        revealReward(at: 0)
    }

    private func revealReward(at index: Int) {
        guard index < rewards.count else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.spring(response: 0.4)) {
                    phase = .summary
                }
            }
            return
        }

        currentRewardScale = 0

        withAnimation(.easeInOut(duration: 0.2)) {
            phase = .revealing(index)
        }

        let gen = UIImpactFeedbackGenerator(style: .medium)
        gen.impactOccurred()

        withAnimation(.spring(response: 0.4, dampingFraction: 0.6).delay(0.1)) {
            currentRewardScale = 1.0
        }

        revealedRewards.append(rewards[index])

        // Auto-advance after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if case .revealing(let current) = phase, current == index {
                advanceReveal()
            }
        }
    }

    private func advanceReveal() {
        if case .revealing(let index) = phase {
            revealReward(at: index + 1)
        }
    }
}

// MARK: - Preview

#Preview {
    let badge1 = Badge(id: "gvc", name: "Good Vibes", image: "badge_gvc", tier: .gold, lore: "A true vibe lord.", pointMultiplier: 2.0)
    let badge2 = Badge(id: "fire", name: "Flame", image: "badge_fire", tier: .cosmic, lore: "Hot stuff.", pointMultiplier: 3.0)
    let chest = Chest(type: .gold)
    let rewards = [
        ChestReward(badge: badge1, quantity: 3),
        ChestReward(badge: badge2, quantity: 1),
    ]

    ChestOpeningView(
        chest: chest,
        rewards: rewards,
        knownBadgeIDs: ["gvc"],
        onComplete: {}
    )
}
