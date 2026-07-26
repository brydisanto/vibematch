import SwiftUI

// MARK: - Pin Drop Design Tokens
//
// Canonical GVC brand palette. Values match the web design system at
// vibematch.app. Stored under the `VibeColors` enum name to preserve
// the existing call sites across the codebase.

enum VibeColors {
    /// INK_DARKEST: #0a0418 — primary app background.
    static let background = Color(red: 0.039, green: 0.016, blue: 0.094)

    /// INK card: #160a2a — secondary background fill.
    static let surface = Color(red: 0.086, green: 0.039, blue: 0.165)

    /// GOLD: #FFE048 — primary CTA, score, capsule accent.
    static let primary = Color(red: 1.0, green: 0.878, blue: 0.282)

    /// GOLD_LIGHT: #FFF4B0 — highlights, gradients.
    static let primaryLight = Color(red: 1.0, green: 0.957, blue: 0.690)

    /// GOLD_DEEP: #8B6914 — chunky-button bottom shadow.
    static let primaryDeep = Color(red: 0.545, green: 0.412, blue: 0.078)

    /// COSMIC: #B366FF — daily challenge, secondary actions.
    static let cosmic = Color(red: 0.702, green: 0.400, blue: 1.0)

    /// COSMIC_DEEP: #6B1FC0 — cosmic depth shadow.
    static let cosmicDeep = Color(red: 0.420, green: 0.122, blue: 0.753)

    /// ORANGE: #FF5F1F — streak, alerts, hero gradient bottom.
    static let orange = Color(red: 1.0, green: 0.373, blue: 0.122)

    /// Primary text: #F8F7FF — high-contrast on ink backgrounds.
    static let textPrimary = Color(red: 0.973, green: 0.969, blue: 1.0)

    /// Secondary text: #9B97B0 — muted captions, labels.
    static let textSecondary = Color(red: 0.608, green: 0.592, blue: 0.690)

    /// Card surface: deep cosmic with low opacity for HUD plates.
    static let card = Color(red: 0.165, green: 0.063, blue: 0.275).opacity(0.85)

    /// Danger red: #EF4444 — used sparingly for failure states.
    static let danger = Color(red: 0.937, green: 0.267, blue: 0.267)

    /// HUD border: cosmic at high opacity for glow stroke.
    static let hudBorder = cosmic

    /// Card gradient top: cosmic depth.
    static let cardGradientTop = Color(red: 0.227, green: 0.063, blue: 0.376)

    /// Card gradient bottom: near-black ink.
    static let cardGradientBottom = Color(red: 0.043, green: 0.012, blue: 0.078)

    // MARK: Legacy aliases
    // Kept temporarily so existing call sites in LandingView, GameHUDView,
    // and TileNode continue to compile during the Pin Drop migration.
    static let accentWarm = orange
    static let accentCool = cosmic
    static let gold = primary
}

// MARK: - HUD Card Modifier

/// A dark cosmic-bordered card matching the web HudCard component.
struct HUDCardStyle: ViewModifier {
    var borderColor: Color = VibeColors.hudBorder
    var glowColor: Color = VibeColors.hudBorder.opacity(0.2)

    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [VibeColors.cardGradientTop, VibeColors.cardGradientBottom],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(borderColor.opacity(0.8), lineWidth: 2.5)
            )
            .shadow(color: glowColor, radius: 10, x: 0, y: 4)
            .shadow(color: .black.opacity(0.6), radius: 8, x: 0, y: 4)
    }
}

extension View {
    func hudCard(borderColor: Color = VibeColors.hudBorder, glowColor: Color = VibeColors.hudBorder.opacity(0.2)) -> some View {
        modifier(HUDCardStyle(borderColor: borderColor, glowColor: glowColor))
    }
}

// MARK: - Pin Drop Brand Background

/// Canonical Pin Drop background: ink fill + faint grid texture + gold/orange
/// bottom gradient. Use as the root background on every screen.
struct PinDropBackground: View {
    var body: some View {
        ZStack {
            VibeColors.background

            // Faint grid texture (10% white stroke @ 1px, 40px cells)
            Canvas { ctx, size in
                let spacing: CGFloat = 40
                let strokeColor = Color.white.opacity(0.10)
                var x: CGFloat = 0
                while x <= size.width {
                    var path = Path()
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                    ctx.stroke(path, with: .color(strokeColor), lineWidth: 1)
                    x += spacing
                }
                var y: CGFloat = 0
                while y <= size.height {
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                    ctx.stroke(path, with: .color(strokeColor), lineWidth: 1)
                    y += spacing
                }
            }
            .allowsHitTesting(false)

            // Gold to orange bottom gradient bloom
            LinearGradient(
                colors: [
                    .clear,
                    VibeColors.primary.opacity(0.10),
                    VibeColors.orange.opacity(0.18),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
        }
        .ignoresSafeArea()
    }
}
