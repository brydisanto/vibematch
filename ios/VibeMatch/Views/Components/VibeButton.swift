import SwiftUI

// MARK: - Button Variant

enum VibeButtonVariant {
    case primary
    case secondary
    case danger
}

// MARK: - VibeButton

/// Reusable branded button with haptic feedback and press animation.
/// Supports primary (lavender fill), secondary (outlined), and danger (red) variants.
struct VibeButton: View {
    let title: String
    let icon: String?
    let variant: VibeButtonVariant
    let action: () -> Void

    @State private var isPressed = false

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

    private var backgroundColor: Color {
        switch variant {
        case .primary: return VibeColors.primary
        case .secondary: return .clear
        case .danger: return Color(red: 0.9, green: 0.2, blue: 0.2)
        }
    }

    private var foregroundColor: Color {
        switch variant {
        case .primary: return .white
        case .secondary: return VibeColors.textSecondary
        case .danger: return .white
        }
    }

    private var borderColor: Color {
        switch variant {
        case .primary: return .clear
        case .secondary: return VibeColors.textSecondary.opacity(0.4)
        case .danger: return .clear
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
                    .font(.system(size: 16, weight: .bold))
                    .tracking(1.2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(backgroundColor)
            .foregroundStyle(foregroundColor)
            .clipShape(RoundedRectangle(cornerRadius: 16))
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
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        VibeColors.background.ignoresSafeArea()
        VStack(spacing: 16) {
            VibeButton("Play Classic", icon: "play.fill", variant: .primary) {}
            VibeButton("Daily Vibe", icon: "calendar", variant: .secondary) {}
            VibeButton("Reset Progress", icon: "trash", variant: .danger) {}
        }
        .padding(24)
    }
}
