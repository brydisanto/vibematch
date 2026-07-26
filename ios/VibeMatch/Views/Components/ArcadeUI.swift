import SwiftUI

// MARK: - Arcade Tokens
//
// Mirrors src/lib/arcade-tokens.ts. The canonical color set used across
// every Pin Drop surface: cards, buttons, HUD, modals, particles.

enum ArcadeTokens {
    static let gold       = Color(pinHex: "FFE048")
    static let goldDim    = Color(pinHex: "c9a84c")
    static let goldDeep   = Color(pinHex: "8B6914")
    static let goldLight  = Color(pinHex: "FFF4B0")

    static let cosmic       = Color(pinHex: "B366FF")
    static let cosmicDeep   = Color(pinHex: "6B1FC0")
    static let cosmicLight  = Color(pinHex: "D8A0FF")

    static let orange       = Color(pinHex: "FF5F1F")
    static let orangeDeep   = Color(pinHex: "5A1A08")
    static let orangeLight  = Color(pinHex: "FFAA55")

    static let red       = Color(pinHex: "FF3B30")
    static let redDeep   = Color(pinHex: "6A0A05")
    static let redLight  = Color(pinHex: "FF8A70")

    static let green     = Color(pinHex: "2EFF2E")
    static let pink      = Color(pinHex: "FF6B9D")
    static let pinkDeep  = Color(pinHex: "8E2A52")

    static let purpleBG    = Color(pinHex: "7B3FA8")
    static let inkDarkest  = Color(pinHex: "0a0418")
    static let inkDeep     = Color(pinHex: "120421")
    static let inkPanel    = Color(pinHex: "180630")
    static let inkPanelHi  = Color(pinHex: "2D0B4E")
}

// MARK: - EnamelCard
//
// Mirrors src/components/arcade/EnamelCard.tsx. Use for any chunky
// surface: mode cards, HUD panels, prize strips, modals.

struct EnamelCard<Content: View>: View {
    let rim: Color
    var dim: Color? = nil
    let deep: Color
    var cornerRadius: CGFloat = 18
    var dropDepth: CGFloat = 6
    @ViewBuilder var content: () -> Content

    private var middle: Color { dim ?? rim.opacity(0.7) }
    private var innerRadius: CGFloat { cornerRadius - 3 }

    var body: some View {
        content()
            .background(
                ZStack {
                    LinearGradient(
                        colors: [Color(pinHex: "2A1A0A"), Color(pinHex: "1A1005"), Color(pinHex: "0a0502")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    RadialGradient(
                        colors: [rim.opacity(0.18), .clear],
                        center: UnitPoint(x: 0.2, y: 0.15),
                        startRadius: 0,
                        endRadius: 160
                    )
                    RadialGradient(
                        colors: [rim.opacity(0.13), .clear],
                        center: UnitPoint(x: 0.85, y: 0.85),
                        startRadius: 0,
                        endRadius: 180
                    )
                    LinearGradient(
                        colors: [rim.opacity(0.12), .clear],
                        startPoint: .top,
                        endPoint: .center
                    )
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: innerRadius))
            .padding(3)
            .background(
                LinearGradient(
                    stops: [
                        .init(color: rim, location: 0.0),
                        .init(color: middle, location: 0.4),
                        .init(color: deep, location: 1.0),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.4), .clear],
                            startPoint: .top,
                            endPoint: .center
                        ),
                        lineWidth: 1
                    )
                    .padding(0.5)
            )
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(deep)
                    .offset(y: dropDepth)
            )
            .shadow(color: rim.opacity(0.20), radius: 30)
            .shadow(color: .black.opacity(0.5), radius: 16, y: 12)
            .padding(.bottom, dropDepth)
    }
}

// MARK: - EnamelCircle
//
// 3D enamel-pin medallion. Used for the 30 MOVES / star / HUD score badges.

struct EnamelCircle<Content: View>: View {
    let rim: Color
    let light: Color
    let deep: Color
    var border: Color = Color(pinHex: "2A1A0A")
    var size: CGFloat = 78
    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [light, rim, deep],
                        center: UnitPoint(x: 0.35, y: 0.30),
                        startRadius: 2,
                        endRadius: size * 0.55
                    )
                )
                .overlay(
                    Circle()
                        .stroke(deep.opacity(0.55), lineWidth: size * 0.08)
                        .blur(radius: 4)
                        .offset(y: 4)
                        .mask(Circle())
                )
                .overlay(
                    Circle()
                        .trim(from: 0.55, to: 0.95)
                        .stroke(Color.white.opacity(0.35), lineWidth: 3)
                        .rotationEffect(.degrees(180))
                        .blur(radius: 1.5)
                        .padding(size * 0.05)
                )
                .overlay(Circle().stroke(border, lineWidth: 3))

            content()
        }
        .frame(width: size, height: size)
        .shadow(color: .black.opacity(0.5), radius: 6, y: 4)
    }
}

// MARK: - ChunkyButton
//
// Mirrors src/components/arcade/ChunkyButton.tsx. Solid drop plate +
// soft black shadow + top white highlight. Use for any tappable action.

struct ChunkyButton: View {
    let label: String
    let color: Color
    let deep: Color
    var textColor: Color = Color(pinHex: "1A0633")
    var fontSize: CGFloat = 12
    var paddingH: CGFloat = 14
    var paddingV: CGFloat = 9
    var dropDepth: CGFloat = 5
    var cornerRadius: CGFloat = 13

    var body: some View {
        Text(label)
            .font(.custom("Brice-Black", size: fontSize))
            .tracking(1.6)
            .foregroundStyle(textColor)
            .shadow(color: .white.opacity(0.25), radius: 0, y: 1)
            .padding(.horizontal, paddingH)
            .padding(.vertical, paddingV)
            .background(
                LinearGradient(
                    colors: [color, deep],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.4), .clear],
                            startPoint: .top,
                            endPoint: .center
                        ),
                        lineWidth: 1
                    )
                    .padding(0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(deep)
                    .offset(y: dropDepth)
            )
            .shadow(color: .black.opacity(0.4), radius: 8, y: dropDepth + 3)
            .padding(.bottom, dropDepth)
    }
}

// MARK: - Color(hex:)

extension Color {
    /// Pin Drop hex initializer. Renamed from `init(hex:)` to avoid an
    /// ambiguity with SwiftUI's iOS 17 `Color(hex:)` overload that takes
    /// a UInt and treats the label as extraneous.
    init(pinHex hex: String) {
        var hexValue = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if hexValue.count == 3 {
            hexValue = hexValue.map { "\($0)\($0)" }.joined()
        }
        var rgb: UInt64 = 0
        Scanner(string: hexValue).scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

/// Convenience for the previous `Color(hex:)` call sites — use the
/// `pinHex:` label form to avoid SwiftUI's hex overload.
func PinHex(_ hex: String) -> Color {
    Color(pinHex: hex)
}
