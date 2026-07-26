import SwiftUI

// MARK: - Game HUD View
//
// Heads-up display overlay during play. Three EnamelCard panels:
// SCORE (gold-rimmed) · MOVES (rim shifts gold→orange→red as moves drain)
// · COMBO (cosmic-rimmed, lights up on combo). Uses Brice/Mundial fonts.

struct GameHUDView: View {
    let session: GameSession
    var onTapScore: () -> Void = {}

    @State private var scoreBump = false
    @State private var movesBump = false
    @State private var comboBump = false
    @State private var previousScore: Int = 0
    @State private var previousMoves: Int = 30
    @State private var previousCombo: Int = 0

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Button(action: onTapScore) {
                    scoreCard
                }
                .buttonStyle(.plain)
                movesCard
                comboCard
            }

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
        EnamelCard(rim: ArcadeTokens.gold, dim: ArcadeTokens.goldDim, deep: ArcadeTokens.goldDeep, cornerRadius: 14, dropDepth: 4) {
            VStack(spacing: 4) {
                HStack(spacing: 4) {
                    Text("SCORE")
                        .font(.custom("Brice-Black", size: 10))
                        .tracking(2)
                        .foregroundStyle(ArcadeTokens.gold.opacity(0.85))
                    Image(systemName: "list.bullet.rectangle.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(ArcadeTokens.gold.opacity(0.6))
                }

                Text(formattedScore)
                    .font(.custom("Brice-Black", size: 22))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [ArcadeTokens.goldLight, ArcadeTokens.gold],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: ArcadeTokens.gold.opacity(0.55), radius: 6)
                    .shadow(color: .black.opacity(0.6), radius: 0, y: 1)
                    .scaleEffect(scoreBump ? 1.15 : 1.0)
                    .animation(.spring(response: 0.25, dampingFraction: 0.5), value: scoreBump)
                    .contentTransition(.numericText())
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
        }
    }

    private var formattedScore: String {
        if session.score <= 0 { return "0" }
        return session.score.formatted(.number)
    }

    // MARK: - Moves Card

    private var movesCard: some View {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)
        return EnamelCard(rim: movesRim, dim: movesDim, deep: movesDeep, cornerRadius: 14, dropDepth: 4) {
            VStack(spacing: 4) {
                Text("MOVES")
                    .font(.custom("Brice-Black", size: 9))
                    .tracking(2)
                    .foregroundStyle(movesRim.opacity(0.85))

                ZStack {
                    Circle()
                        .stroke(Color.black.opacity(0.4), lineWidth: 4)
                        .frame(width: 46, height: 46)

                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(
                            AngularGradient(
                                colors: [movesRim, movesRim.opacity(0.7)],
                                center: .center
                            ),
                            style: StrokeStyle(lineWidth: 4, lineCap: .round)
                        )
                        .frame(width: 46, height: 46)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeOut(duration: 0.3), value: session.movesLeft)
                        .shadow(color: movesRim.opacity(0.7), radius: 4)

                    Text("\(session.movesLeft)")
                        .font(.custom("Brice-Black", size: 20))
                        .foregroundStyle(.white)
                        .shadow(color: movesRim.opacity(0.7), radius: session.movesLeft <= 3 ? 10 : 4)
                        .scaleEffect(movesBump ? 1.2 : 1.0)
                        .animation(.spring(response: 0.25, dampingFraction: 0.5), value: movesBump)
                        .contentTransition(.numericText())
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .padding(.horizontal, 10)
        }
    }

    private var movesRim: Color {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)
        if progress > 0.6 { return ArcadeTokens.gold }
        if progress > 0.35 { return ArcadeTokens.orange }
        if progress > 0.15 { return Color(pinHex: "FF5F1F") }
        return ArcadeTokens.red
    }
    private var movesDim: Color {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)
        if progress > 0.6 { return ArcadeTokens.goldDim }
        if progress > 0.35 { return ArcadeTokens.orangeLight }
        return ArcadeTokens.redLight
    }
    private var movesDeep: Color {
        let progress = CGFloat(session.movesLeft) / CGFloat(CLASSIC_MOVES)
        if progress > 0.6 { return ArcadeTokens.goldDeep }
        if progress > 0.35 { return ArcadeTokens.orangeDeep }
        return ArcadeTokens.redDeep
    }

    // MARK: - Combo Card

    private var comboCard: some View {
        EnamelCard(rim: comboRim, dim: comboDim, deep: comboDeep, cornerRadius: 14, dropDepth: 4) {
            VStack(spacing: 4) {
                Text("COMBO")
                    .font(.custom("Brice-Black", size: 9))
                    .tracking(2)
                    .foregroundStyle(comboRim.opacity(0.85))

                if session.combo > 0 {
                    VStack(spacing: 0) {
                        Text("x\(session.combo)")
                            .font(.custom("Brice-Black", size: 24))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.white, comboRim],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .shadow(color: comboRim.opacity(0.7), radius: 8)
                            .shadow(color: .black.opacity(0.6), radius: 0, y: 1)
                            .scaleEffect(comboBump ? 1.2 : 1.0)
                            .animation(.spring(response: 0.25, dampingFraction: 0.5), value: comboBump)
                            .contentTransition(.numericText())
                        if !comboTierLabel.isEmpty {
                            Text(comboTierLabel)
                                .font(.custom("Mundial-Bold", size: 8))
                                .tracking(1.5)
                                .foregroundStyle(comboRim.opacity(0.85))
                        }
                    }
                } else {
                    Text("—")
                        .font(.custom("Brice-Black", size: 24))
                        .foregroundStyle(Color.white.opacity(0.3))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
        }
    }

    private var comboRim: Color {
        switch session.combo {
        case 5...:  return ArcadeTokens.cosmic
        case 4:     return ArcadeTokens.orange
        case 3:     return ArcadeTokens.gold
        case 2:     return ArcadeTokens.goldLight
        default:    return ArcadeTokens.cosmic.opacity(0.55)   // dormant cosmic
        }
    }
    private var comboDim: Color {
        switch session.combo {
        case 5...:  return ArcadeTokens.cosmicLight
        case 4:     return ArcadeTokens.orangeLight
        case 3:     return ArcadeTokens.goldDim
        case 2:     return ArcadeTokens.goldLight
        default:    return ArcadeTokens.cosmicLight.opacity(0.35)
        }
    }
    private var comboDeep: Color {
        switch session.combo {
        case 5...:  return ArcadeTokens.cosmicDeep
        case 4:     return ArcadeTokens.orangeDeep
        case 3:     return ArcadeTokens.goldDeep
        case 2:     return ArcadeTokens.goldDeep
        default:    return ArcadeTokens.cosmicDeep
        }
    }

    private var comboTierLabel: String {
        switch session.combo {
        case 7...:  return "LEGENDARY"
        case 5...6: return "INSANE"
        case 4:     return "VIBES"
        case 3:     return "NICE"
        case 2:     return "COOL"
        default:    return ""
        }
    }

    // MARK: - Final Moves Banner

    private var finalMovesBanner: some View {
        Text(session.movesLeft == 1 ? "FINAL MOVE" : "FINAL MOVES")
            .font(.custom("Brice-Black", size: 14))
            .tracking(3.5)
            .foregroundStyle(ArcadeTokens.gold)
            .shadow(color: ArcadeTokens.gold.opacity(0.9), radius: 12)
            .shadow(color: .black.opacity(0.85), radius: 2, y: 2)
            .padding(.horizontal, 22)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Color(pinHex: "180630").opacity(0.95), Color(pinHex: "0a0414").opacity(0.95)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            )
            .overlay(
                Capsule().strokeBorder(ArcadeTokens.gold.opacity(0.7), lineWidth: 2)
            )
            .shadow(color: ArcadeTokens.gold.opacity(0.45), radius: 22)
    }

    // MARK: - Helpers

    private func triggerBump(_ binding: Binding<Bool>) {
        binding.wrappedValue = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            binding.wrappedValue = false
        }
    }
}
