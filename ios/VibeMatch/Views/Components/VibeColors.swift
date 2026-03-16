import SwiftUI

// MARK: - Design Tokens

/// Central definition of all VibeMatch brand colors, matching the web design system.
enum VibeColors {
    /// Dark background: #1A1A2E
    static let background = Color(red: 0.10, green: 0.10, blue: 0.18)

    /// Electric Lavender primary: #6C5CE7
    static let primary = Color(red: 0.42, green: 0.36, blue: 0.91)

    /// Lighter lavender: #A29BFE
    static let primaryLight = Color(red: 0.64, green: 0.61, blue: 1.0)

    /// Coral accent: #FD79A8
    static let accentWarm = Color(red: 0.99, green: 0.47, blue: 0.66)

    /// Teal accent (Craig's jacket): #00CEC9
    static let accentCool = Color(red: 0.0, green: 0.81, blue: 0.79)

    /// Primary text: #F8F7FF
    static let textPrimary = Color(red: 0.97, green: 0.97, blue: 1.0)

    /// Secondary text: #9B97B0
    static let textSecondary = Color(red: 0.61, green: 0.59, blue: 0.69)

    /// Card background: #3D3A50 at 80% opacity
    static let card = Color(red: 0.24, green: 0.23, blue: 0.31).opacity(0.8)

    /// Score gold: #FFE048
    static let gold = Color(red: 1.0, green: 0.88, blue: 0.28)

    /// Warning orange: #FF8C00
    static let orange = Color(red: 1.0, green: 0.55, blue: 0.0)

    /// Danger red: #EF4444
    static let danger = Color(red: 0.94, green: 0.27, blue: 0.27)

    /// HUD purple border: rgba(179, 102, 255, 0.8)
    static let hudBorder = Color(red: 0.70, green: 0.40, blue: 1.0)

    /// Deep card gradient start: #3A1061
    static let cardGradientTop = Color(red: 0.23, green: 0.06, blue: 0.38)

    /// Deep card gradient end: #110321
    static let cardGradientBottom = Color(red: 0.07, green: 0.01, blue: 0.13)
}

// MARK: - HUD Card Modifier

/// A dark card with a glowing border, matching the web HudCard component.
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
