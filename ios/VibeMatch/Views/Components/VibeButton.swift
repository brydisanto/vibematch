import SwiftUI

// MARK: - Button Variant

enum VibeButtonVariant {
    case primary    // GOLD chunky CTA (Classic / Play Again)
    case cosmic     // COSMIC chunky CTA (Daily Challenge / cosmic secondary)
    case secondary  // outlined
    case danger     // red
}

// MARK: - VibeButton

/// Reusable branded button with haptic feedback, press animation, and the
/// canonical Pin Drop "chunky" bottom shadow on filled variants.
struct VibeButton: View {
    let title: String
    let icon: String?
    let variant: VibeButtonVariant
    let action: () -> Void

    init(
        _ title: String,
        icon: String? = nil,
        variant: VibeButtonVariant = .primary,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.variant = variant
        self.action = action
    }

    private var fillColor: Color {
        switch variant {
        case .primary:   return VibeColors.primary
        case .cosmic:    return VibeColors.cosmic
        case .secondary: return .clear
        case .danger:    return Color(red: 0.9, green: 0.2, blue: 0.2)
        }
    }

    private var deepShadowColor: Color {
        switch variant {
        case .primary:   return VibeColors.primaryDeep
        case .cosmic:    return VibeColors.cosmicDeep
        case .secondary: return .clear
        case .danger:    return Color(red: 0.5, green: 0.05, blue: 0.05)
        }
    }

    private var foregroundColor: Color {
        switch variant {
        case .primary:   return .black            // gold needs dark text
        case .cosmic:    return .white
        case .secondary: return VibeColors.textPrimary
        case .danger:    return .white
        }
    }

    private var borderColor: Color {
        switch variant {
        case .primary:   return .clear
        case .cosmic:    return .clear
        case .secondary: return VibeColors.primary.opacity(0.55)
        case .danger:    return .clear
        }
    }

    var body: some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            action()
        } label: {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(.system(size: 16, weight: .black))
                    .tracking(1.2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                ZStack {
                    if variant == .primary || variant == .cosmic || variant == .danger {
                        // Chunky 4px bottom shadow
                        RoundedRectangle(cornerRadius: 16)
                            .fill(deepShadowColor)
                            .offset(y: 4)
                    }
                    RoundedRectangle(cornerRadius: 16)
                        .fill(fillColor)
                }
            )
            .foregroundStyle(foregroundColor)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(borderColor, lineWidth: variant == .secondary ? 1.5 : 0)
            )
        }
        .buttonStyle(VibePressStyle())
    }
}

// MARK: - Press Style

/// Custom button style that scales down on press for tactile feedback.
struct VibePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .offset(y: configuration.isPressed ? 2 : 0)
            .opacity(configuration.isPressed ? 0.92 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        VibeColors.background.ignoresSafeArea()
        VStack(spacing: 16) {
            VibeButton("Play Classic", icon: "play.fill", variant: .primary) {}
            VibeButton("Daily Challenge", icon: "calendar", variant: .cosmic) {}
            VibeButton("Pin Book", icon: "square.grid.2x2.fill", variant: .secondary) {}
            VibeButton("Reset Progress", icon: "trash", variant: .danger) {}
        }
        .padding(24)
    }
}
