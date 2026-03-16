import SwiftUI

// MARK: - Badge Card

/// Reusable badge display showing image, name, tier border, and optional quantity.
/// Used in collection grid, chest reveals, and game over stats.
struct BadgeCard: View {
    let badge: Badge
    var quantity: Int? = nil
    var isDiscovered: Bool = true
    var showName: Bool = true
    var size: CGFloat = 72

    private var tierColor: Color {
        badge.tier.displayColor
    }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                // Tier glow ring
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [tierColor.opacity(0.3), .clear],
                            center: .center,
                            startRadius: size * 0.3,
                            endRadius: size * 0.6
                        )
                    )
                    .frame(width: size * 1.2, height: size * 1.2)

                if isDiscovered {
                    // Badge image with tier border
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [tierColor.opacity(0.15), Color.black],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: size, height: size)

                        // Try to load the badge image; fall back to an initial letter
                        Image(badge.image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: size - 8, height: size - 8)
                            .clipShape(Circle())

                        Circle()
                            .strokeBorder(tierColor, lineWidth: 2.5)
                            .frame(width: size, height: size)
                    }

                    // Quantity badge
                    if let quantity, quantity > 1 {
                        Text("\(quantity)")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(tierColor)
                            .clipShape(Capsule())
                            .offset(x: size * 0.32, y: -size * 0.32)
                    }

                    // Multiplier tag
                    if badge.pointMultiplier > 1 {
                        Text("x\(Int(badge.pointMultiplier))")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(badge.tier == .gold ? .black : .white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(tierColor)
                            .clipShape(Capsule())
                            .offset(x: size * 0.3, y: size * 0.3)
                    }
                } else {
                    // Undiscovered silhouette
                    ZStack {
                        Circle()
                            .fill(Color.white.opacity(0.05))
                            .frame(width: size, height: size)

                        Image(systemName: "questionmark")
                            .font(.system(size: size * 0.35, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.15))

                        Circle()
                            .strokeBorder(Color.white.opacity(0.1), lineWidth: 2)
                            .frame(width: size, height: size)
                    }
                }
            }

            if showName {
                Text(isDiscovered ? badge.name : "???")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isDiscovered ? tierColor.opacity(0.8) : Color.white.opacity(0.2))
                    .lineLimit(1)
                    .frame(width: size + 12)

                // Tier pill
                Text(badge.tier.displayName)
                    .font(.system(size: 8, weight: .heavy))
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(tierColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(tierColor.opacity(0.12))
                    .clipShape(Capsule())
            }
        }
    }
}

// MARK: - BadgeTier Display Extensions

extension BadgeTier {
    /// Brand color for each badge tier.
    var displayColor: Color {
        switch self {
        case .blue:   return Color(red: 0.29, green: 0.62, blue: 1.0)  // #4A9EFF
        case .silver: return Color(red: 0.89, green: 0.91, blue: 0.94) // #E2E8F0
        case .gold:   return Color(red: 1.0, green: 0.88, blue: 0.28)  // #FFE048
        case .cosmic: return Color(red: 0.70, green: 0.40, blue: 1.0)  // #B366FF
        }
    }

    /// Human-readable tier name.
    var displayName: String {
        switch self {
        case .blue:   return "Common"
        case .silver: return "Silver"
        case .gold:   return "Gold"
        case .cosmic: return "Cosmic"
        }
    }
}

// MARK: - Preview

#Preview {
    let sampleBadge = Badge(
        id: "preview_badge",
        name: "Good Vibes",
        image: "badge_gvc",
        tier: .gold,
        lore: "A badge of good vibes.",
        pointMultiplier: 2.0
    )
    ZStack {
        VibeColors.background.ignoresSafeArea()
        HStack(spacing: 20) {
            BadgeCard(badge: sampleBadge, quantity: 5)
            BadgeCard(badge: sampleBadge, isDiscovered: false)
        }
    }
}
