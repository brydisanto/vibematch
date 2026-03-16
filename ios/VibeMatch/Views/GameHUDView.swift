import SwiftUI

// MARK: - Game HUD View

/// Heads-up display overlaid on the game board.
/// Shows score, moves remaining (with conic progress ring), combo tier,
/// and mute/pause controls. Animates on value changes.
struct GameHUDView: View {
    let session: GameSession

    @State private var scoreBump = false
    @State private var movesBump = false
    @State private var comboBump = false
    @State private var previousScore: Int = 0
    @State private var previousMoves: Int = 30
    @State private var previousCombo: Int = 0

    var body: some View {
        VStack(spacing: 8) {
            // Main metrics row
            HStack(spacing: 8) {
                scoreCard
                movesCard
                comboCard
            }

            // Final moves warning banner
            if session.movesLeft <= 3 && session.movesLeft > 0 && session.gamePhase == .playing {
                finalMovesBanner
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3), value: session.movesLeft <= 3)
        .onChange(of: session.score) { _, newValue in
            if newValue != previousScore && newValue > 0 {
                triggerBump($scoreBump)
            }
            previousScore = newValue
        }
        .onChange(of: session.movesLeft) { _, newValue in
            if newValue != previousMoves {
                triggerBump($movesBump)
            }
            previousMoves = newValue
        }
        .onChange(of: session.combo) { _, newValue in
            if newValue != previousCombo && newValue > 0 {
                triggerBump($comboBump)
            }
            previousCombo = newValue
        }
    }

    // MARK: - Score Card

    private var scoreCard: some View {
        VStack(spacing: 4) {
            Text("SCORE")
                .font(.system(size: 9, weight: .heavy))
                .tracking(2)
                .foregroundStyle(VibeColors.primaryLight.opacity(0.7))

            Text(formattedScore)
                .font(.system(size: 24, weight: .black, design: .rounded))
                .foregroundStyle(VibeColors.gold)
                .shadow(color: VibeColors.gold.opacity(0.4), radius: 8)
                .scaleEffect(scoreBump ? 1.15 : 1.0)
                .animation(.spring(response: 0.25, dampingFraction: 0.5), value: scoreBump)
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity)
        .hudCard()
    }

    private var formattedScore: String {
        if session.score <= 0 { return "\u{2014}" }
        return session.score.formatted(.number)
    }

    // MARK: - Moves Card

    private var movesCard: some View {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)

        return VStack(spacing: 4) {
            Text("MOVES")
                .font(.system(size: 9, weight: .heavy))
                .tracking(2)
                .foregroundStyle(VibeColors.primaryLight.opacity(0.7))

            ZStack {
                // Conic progress ring
                Circle()
                    .stroke(Color.white.opacity(0.1), lineWidth: 4)
                    .frame(width: 50, height: 50)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        AngularGradient(
                            colors: movesGradientColors,
                            center: .center,
                            startAngle: .degrees(0),
                            endAngle: .degrees(360)
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .frame(width: 50, height: 50)
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.3), value: session.movesLeft)

                Text("\(session.movesLeft)")
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .foregroundStyle(movesTextColor)
                    .shadow(color: movesTextColor.opacity(0.5), radius: session.movesLeft <= 3 ? 10 : 4)
                    .scaleEffect(movesBump ? 1.2 : 1.0)
                    .animation(.spring(response: 0.25, dampingFraction: 0.5), value: movesBump)
                    .contentTransition(.numericText())
            }
        }
        .frame(maxWidth: .infinity)
        .hudCard(borderColor: movesBorderColor, glowColor: movesBorderColor.opacity(0.3))
    }

    private var movesGradientColors: [Color] {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)
        if progress > 0.6 {
            return [VibeColors.gold, VibeColors.gold.opacity(0.6)]
        } else if progress > 0.35 {
            return [VibeColors.orange, VibeColors.gold]
        } else if progress > 0.15 {
            return [Color(red: 1.0, green: 0.37, blue: 0.12), VibeColors.orange]
        } else {
            return [VibeColors.danger, VibeColors.orange]
        }
    }

    private var movesBorderColor: Color {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)
        if progress > 0.6 { return VibeColors.gold }
        else if progress > 0.35 { return VibeColors.orange }
        else if progress > 0.15 { return Color(red: 1.0, green: 0.37, blue: 0.12) }
        else { return VibeColors.danger }
    }

    private var movesTextColor: Color {
        if session.movesLeft <= 3 { return VibeColors.danger }
        else if session.movesLeft <= 5 { return VibeColors.orange }
        else { return .white }
    }

    // MARK: - Combo Card

    private var comboCard: some View {
        VStack(spacing: 4) {
            Text("COMBO")
                .font(.system(size: 9, weight: .heavy))
                .tracking(2)
                .foregroundStyle(VibeColors.primaryLight.opacity(0.7))

            if session.combo > 0 {
                VStack(spacing: 2) {
                    Text("x\(session.combo)")
                        .font(.system(size: 24, weight: .black, design: .rounded))
                        .foregroundStyle(comboColor)
                        .shadow(color: comboColor.opacity(0.5), radius: 8)
                        .scaleEffect(comboBump ? 1.2 : 1.0)
                        .animation(.spring(response: 0.25, dampingFraction: 0.5), value: comboBump)
                        .contentTransition(.numericText())

                    Text(comboTierLabel)
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1.5)
                        .foregroundStyle(comboColor.opacity(0.8))
                }
            } else {
                Text("\u{2014}")
                    .font(.system(size: 24, weight: .black, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.3))
            }
        }
        .frame(maxWidth: .infinity)
        .hudCard()
    }

    private var comboColor: Color {
        switch session.combo {
        case 5...:  return Color(red: 0.70, green: 0.40, blue: 1.0) // Cosmic purple
        case 4:     return Color(red: 1.0, green: 0.37, blue: 0.12)  // Hot orange
        case 3:     return VibeColors.gold
        case 2:     return VibeColors.primaryLight
        default:    return Color.white.opacity(0.6)
        }
    }

    private var comboTierLabel: String {
        switch session.combo {
        case 7...:  return "LEGENDARY!"
        case 5...6: return "INSANE!"
        case 4:     return "VIBES!"
        case 3:     return "NICE!"
        case 2:     return "COOL"
        default:    return ""
        }
    }

    // MARK: - Final Moves Banner

    private var finalMovesBanner: some View {
        Text(session.movesLeft == 1 ? "FINAL MOVE!" : "FINAL MOVES!")
            .font(.system(size: 14, weight: .black, design: .rounded))
            .tracking(3)
            .foregroundStyle(VibeColors.gold)
            .shadow(color: VibeColors.gold.opacity(0.8), radius: 12)
            .shadow(color: .black.opacity(0.8), radius: 2, y: 2)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                VibeColors.cardGradientTop.opacity(0.95),
                                VibeColors.cardGradientBottom.opacity(0.95)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        Capsule()
                            .strokeBorder(VibeColors.gold.opacity(0.6), lineWidth: 2)
                    )
            )
            .shadow(color: VibeColors.gold.opacity(0.4), radius: 20)
    }

    // MARK: - Helpers

    private func triggerBump(_ binding: Binding<Bool>) {
        binding.wrappedValue = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            binding.wrappedValue = false
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        VibeColors.background.ignoresSafeArea()
        VStack {
            GameHUDView(session: .preview(score: 12450, movesLeft: 3, combo: 4))
                .padding()
            Spacer()
        }
    }
}
