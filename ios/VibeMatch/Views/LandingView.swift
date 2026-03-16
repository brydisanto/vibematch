import SwiftUI

// MARK: - Landing View

/// The main menu / landing screen for VibeMatch.
/// Features the brand logo, Craig mascot, mode selection buttons,
/// and a subtle animated gradient background.
struct LandingView: View {
    var onStartClassic: () -> Void
    var onStartDaily: () -> Void
    var onOpenCollection: () -> Void
    var onOpenLeaderboard: () -> Void
    var onOpenSettings: () -> Void

    var streak: Int = 0

    @State private var gradientPhase: CGFloat = 0
    @State private var logoScale: CGFloat = 0.8
    @State private var logoOpacity: CGFloat = 0
    @State private var buttonsOffset: CGFloat = 40
    @State private var buttonsOpacity: CGFloat = 0
    @State private var craigBob: Bool = false

    var body: some View {
        ZStack {
            // Animated background
            animatedBackground

            VStack(spacing: 0) {
                Spacer()
                    .frame(minHeight: 20, maxHeight: 60)

                // Logo + subtitle
                brandHeader
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)

                Spacer()
                    .frame(minHeight: 12, maxHeight: 32)

                // Craig mascot
                craigMascot
                    .offset(y: craigBob ? -6 : 6)

                Spacer()
                    .frame(minHeight: 16, maxHeight: 40)

                // Streak counter
                if streak > 0 {
                    streakBadge
                        .transition(.scale.combined(with: .opacity))
                }

                // Mode buttons
                VStack(spacing: 14) {
                    VibeButton("Classic", icon: "play.fill", variant: .primary) {
                        onStartClassic()
                    }

                    VibeButton("Daily Vibe", icon: "calendar", variant: .secondary) {
                        onStartDaily()
                    }
                }
                .padding(.horizontal, 32)
                .offset(y: buttonsOffset)
                .opacity(buttonsOpacity)

                Spacer()
                    .frame(minHeight: 24, maxHeight: 60)

                // Bottom navigation row
                bottomNav
                    .offset(y: buttonsOffset)
                    .opacity(buttonsOpacity)

                Spacer()
                    .frame(minHeight: 16, maxHeight: 32)
            }
        }
        .ignoresSafeArea()
        .onAppear {
            // Entrance animations
            withAnimation(.easeOut(duration: 0.6)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.2)) {
                buttonsOffset = 0
                buttonsOpacity = 1.0
            }
            // Craig gentle bobbing
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                craigBob = true
            }
            // Start gradient animation
            startGradientAnimation()
        }
    }

    // MARK: - Animated Background

    private var animatedBackground: some View {
        ZStack {
            VibeColors.background

            // Radial gradient that shifts position over time
            RadialGradient(
                colors: [
                    VibeColors.primary.opacity(0.15),
                    VibeColors.accentWarm.opacity(0.05),
                    .clear
                ],
                center: UnitPoint(
                    x: 0.5 + 0.3 * cos(gradientPhase),
                    y: 0.3 + 0.2 * sin(gradientPhase * 0.7)
                ),
                startRadius: 50,
                endRadius: 400
            )

            // Second subtler gradient for depth
            RadialGradient(
                colors: [
                    VibeColors.accentCool.opacity(0.08),
                    .clear
                ],
                center: UnitPoint(
                    x: 0.5 - 0.2 * sin(gradientPhase * 1.3),
                    y: 0.7 + 0.15 * cos(gradientPhase)
                ),
                startRadius: 30,
                endRadius: 300
            )
        }
        .ignoresSafeArea()
    }

    private func startGradientAnimation() {
        // Use a timer to gently shift gradient. The animation system handles smoothing.
        Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { _ in
            withAnimation(.linear(duration: 1.0 / 30.0)) {
                gradientPhase += 0.008
            }
        }
    }

    // MARK: - Brand Header

    private var brandHeader: some View {
        VStack(spacing: 6) {
            Text("VIBEMATCH")
                .font(.system(size: 42, weight: .black, design: .rounded))
                .tracking(3)
                .foregroundStyle(
                    LinearGradient(
                        colors: [VibeColors.primaryLight, VibeColors.primary],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .shadow(color: VibeColors.primary.opacity(0.5), radius: 20, x: 0, y: 4)

            Text("GOOD VIBES CLUB")
                .font(.system(size: 13, weight: .bold))
                .tracking(4)
                .foregroundStyle(VibeColors.textSecondary)
        }
    }

    // MARK: - Craig Mascot

    private var craigMascot: some View {
        ZStack {
            // Glow behind Craig
            Circle()
                .fill(
                    RadialGradient(
                        colors: [VibeColors.accentCool.opacity(0.2), .clear],
                        center: .center,
                        startRadius: 20,
                        endRadius: 100
                    )
                )
                .frame(width: 200, height: 200)

            // Craig image with fallback
            Image("craig")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 180, height: 180)
                .background(
                    // Fallback colored rectangle if image not found
                    RoundedRectangle(cornerRadius: 24)
                        .fill(
                            LinearGradient(
                                colors: [
                                    VibeColors.accentWarm.opacity(0.3),
                                    VibeColors.accentCool.opacity(0.3)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 160, height: 160)
                        .overlay(
                            VStack(spacing: 4) {
                                Image(systemName: "figure.wave")
                                    .font(.system(size: 48))
                                    .foregroundStyle(VibeColors.accentCool)
                                Text("Craig")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(VibeColors.textSecondary)
                            }
                        )
                )
        }
    }

    // MARK: - Streak Badge

    private var streakBadge: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .foregroundStyle(VibeColors.orange)
            Text("\(streak) Day Streak")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(VibeColors.orange)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(VibeColors.orange.opacity(0.12))
                .overlay(
                    Capsule()
                        .strokeBorder(VibeColors.orange.opacity(0.3), lineWidth: 1)
                )
        )
        .padding(.bottom, 16)
    }

    // MARK: - Bottom Navigation

    private var bottomNav: some View {
        HStack(spacing: 32) {
            bottomNavButton(icon: "square.grid.2x2.fill", label: "Collection") {
                onOpenCollection()
            }
            bottomNavButton(icon: "trophy.fill", label: "Leaderboard") {
                onOpenLeaderboard()
            }
            bottomNavButton(icon: "gearshape.fill", label: "Settings") {
                onOpenSettings()
            }
        }
        .padding(.horizontal, 24)
    }

    private func bottomNavButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(VibeColors.textSecondary)
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(VibeColors.textSecondary.opacity(0.7))
            }
            .frame(width: 72, height: 56)
        }
        .buttonStyle(VibePressStyle())
    }
}

// MARK: - Preview

#Preview {
    LandingView(
        onStartClassic: {},
        onStartDaily: {},
        onOpenCollection: {},
        onOpenLeaderboard: {},
        onOpenSettings: {},
        streak: 5
    )
}
