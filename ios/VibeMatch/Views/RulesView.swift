import SwiftUI

// MARK: - Rules View (How to Play)

/// How to Play modal mirroring the web InstructionsModal: a 3-slide
/// carousel (The Basics, Power Moves, Score Big) over a dimmed backdrop,
/// with dot indicators, prev/next arrows, and a gold Got It dismiss on
/// the final slide.
struct RulesView: View {
    var onClose: () -> Void

    @State private var page = 0

    private static let slideLabels = ["The Basics", "Power Moves", "Score Big"]
    private static let blue = Color(pinHex: "4A9EFF")

    var body: some View {
        ZStack {
            Color.black.opacity(0.85)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            modalCard
                .padding(.horizontal, 16)
                .padding(.vertical, 32)
        }
    }

    // MARK: Modal card

    private var modalCard: some View {
        VStack(spacing: 0) {
            header

            TabView(selection: $page) {
                slideScroll { basicsSlide }.tag(0)
                slideScroll { powerMovesSlide }.tag(1)
                slideScroll { scoringSlide }.tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.spring(response: 0.4, dampingFraction: 0.85), value: page)

            footer
        }
        .frame(maxWidth: 520, maxHeight: 700)
        .background(
            LinearGradient(
                stops: [
                    .init(color: Color(pinHex: "1a0a30"), location: 0.0),
                    .init(color: Color(pinHex: "110321"), location: 0.3),
                    .init(color: Color(pinHex: "21083B"), location: 0.7),
                    .init(color: Color(pinHex: "1a0a30"), location: 1.0),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 28))
        .overlay(
            RoundedRectangle(cornerRadius: 28)
                .strokeBorder(ArcadeTokens.cosmic.opacity(0.25), lineWidth: 1.5)
        )
        .shadow(color: ArcadeTokens.cosmic.opacity(0.12), radius: 30)
        .shadow(color: .black.opacity(0.5), radius: 25, y: 12)
    }

    private func slideScroll<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ScrollView(showsIndicators: false) {
            content()
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(ArcadeTokens.cosmic.opacity(0.15))
                Image(systemName: "sparkles")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(ArcadeTokens.gold)
            }
            .frame(width: 32, height: 32)

            VStack(alignment: .leading, spacing: 1) {
                Text("How to Play")
                    .font(.custom("Brice-Black", size: 18))
                    .foregroundStyle(.white)
                Text("\(Self.slideLabels[page]) (\(page + 1)/3)")
                    .font(.custom("Mundial-Regular", size: 10))
                    .foregroundStyle(.white.opacity(0.3))
            }

            Spacer()

            Button(action: onClose) {
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.06))
                        .overlay(Circle().strokeBorder(.white.opacity(0.1), lineWidth: 1))
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white.opacity(0.5))
                }
                .frame(width: 32, height: 32)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(ArcadeTokens.cosmic.opacity(0.12))
                .frame(height: 1)
        }
    }

    // MARK: Footer

    private var footer: some View {
        HStack {
            navArrow(systemName: "chevron.left", enabled: page > 0) {
                withAnimation { page = max(0, page - 1) }
            }

            Spacer()

            HStack(spacing: 10) {
                ForEach(0..<3, id: \.self) { i in
                    Capsule()
                        .fill(
                            i == page
                                ? AnyShapeStyle(LinearGradient(
                                    colors: [ArcadeTokens.cosmic, ArcadeTokens.gold],
                                    startPoint: .leading, endPoint: .trailing))
                                : AnyShapeStyle(Color.white.opacity(0.18))
                        )
                        .frame(width: i == page ? 28 : 8, height: 8)
                        .shadow(color: i == page ? ArcadeTokens.cosmic.opacity(0.4) : .clear, radius: 6)
                        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: page)
                        .onTapGesture { withAnimation { page = i } }
                }
            }

            Spacer()

            if page < 2 {
                navArrow(systemName: "chevron.right", enabled: true) {
                    withAnimation { page = min(2, page + 1) }
                }
            } else {
                Button(action: onClose) {
                    Text("Got It!")
                        .font(.custom("Brice-Black", size: 14))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 20)
                        .frame(height: 40)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(LinearGradient(
                                    colors: [ArcadeTokens.gold, Color(pinHex: "FFD000")],
                                    startPoint: .topLeading, endPoint: .bottomTrailing))
                        )
                        .shadow(color: ArcadeTokens.gold.opacity(0.3), radius: 10)
                }
                .buttonStyle(VibePressStyle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(ArcadeTokens.cosmic.opacity(0.1))
                .frame(height: 1)
        }
    }

    private func navArrow(systemName: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(enabled ? ArcadeTokens.cosmic.opacity(0.12) : .white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(
                                enabled ? ArcadeTokens.cosmic.opacity(0.25) : .white.opacity(0.06),
                                lineWidth: 1
                            )
                    )
                Image(systemName: systemName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .frame(width: 40, height: 40)
            .opacity(enabled ? 1 : 0.2)
        }
        .disabled(!enabled)
    }

    // MARK: Slide 1 - The Basics

    private var basicsSlide: some View {
        VStack(spacing: 12) {
            slideTitle(
                icon: "square.grid.3x3.fill",
                color: Self.blue,
                title: "The Basics",
                subtitle: "Everything you need to start matching"
            )

            ruleCard(icon: "square.grid.3x3.fill", color: Self.blue, title: "The Board") {
                styledBody("6 pin types on an 8x8 grid. You've got ", [
                    ("30 moves", ArcadeTokens.gold),
                    (" to stack the highest score possible.", nil),
                ])
            }

            ruleCard(icon: "hand.tap.fill", color: ArcadeTokens.cosmic, title: "Swap It") {
                styledBody("Tap a pin, then tap one ", [
                    ("next to it", .white.opacity(0.8)),
                    (" to swap. No match? It bounces back.", nil),
                ])
            }

            ruleCard(icon: "sparkles", color: ArcadeTokens.gold, title: "Match 3+") {
                styledBody("Line up ", [
                    ("3 or more", .white.opacity(0.8)),
                    (" of the same pin in a row or column. They clear, you score. That's the vibe.", nil),
                ])
            }

            ruleCard(icon: "arrow.down", color: ArcadeTokens.orange, title: "Cascades") {
                styledBody("When pins clear, new ones drop in from above. If they land into another match, that's a ", [
                    ("cascade", ArcadeTokens.orange),
                    (". Each cascade boosts your score multiplier for the rest of the turn.", nil),
                ])
            }
        }
    }

    // MARK: Slide 2 - Power Moves

    private var powerMovesSlide: some View {
        VStack(spacing: 12) {
            slideTitle(
                icon: "flame.fill",
                color: ArcadeTokens.orange,
                title: "Power Moves",
                subtitle: "Bigger matches unlock fire abilities"
            )

            powerTileRow(
                icon: "circle.circle.fill", color: ArcadeTokens.orange,
                name: "Bomb", chip: "MATCH 4",
                detail: "Blows up a 3x3 area around it"
            )
            powerTileRow(
                icon: "bolt.fill", color: ArcadeTokens.gold,
                name: "Laser Party", chip: "MATCH 5",
                detail: "Wipes the full row + column"
            )
            powerTileRow(
                icon: "star.fill", color: ArcadeTokens.cosmic,
                name: "Cosmic Blast", chip: "MATCH 6+",
                detail: "Clears every tile of that pin type from the whole board"
            )

            ruleCard(icon: "star.fill", color: ArcadeTokens.cosmic, title: "Cosmic Tier Upgrade") {
                VStack(alignment: .leading, spacing: 4) {
                    styledBody("", [
                        ("Cosmic pins", ArcadeTokens.cosmic),
                        (" are rare and powerful: matching them upgrades the special tile they spawn by one level.", nil),
                    ])
                    styledBody("Cosmic match-4: spawns a ", [
                        ("Laser Party", ArcadeTokens.gold),
                        (" (instead of a Bomb)", nil),
                    ])
                    styledBody("Cosmic match-5: spawns a ", [
                        ("Cosmic Blast", ArcadeTokens.cosmic),
                        (" (instead of a Laser Party)", nil),
                    ])
                }
            }

            ruleCard(icon: "flame.fill", color: ArcadeTokens.orange, title: "Chain Reactions") {
                styledBody("Tap a special tile to set it off. If the blast hits ", [
                    ("another special tile", .white.opacity(0.8)),
                    (", they chain together for massive clears!", nil),
                ])
            }

            ruleCard(icon: "target", color: Self.blue, title: "Shape Bonuses") {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        shapeChip("L = 1.5x", color: Self.blue)
                        shapeChip("T = 2.5x", color: ArcadeTokens.gold)
                        shapeChip("Cross = 4x", color: ArcadeTokens.cosmic)
                    }
                    styledBody("", [
                        ("T", ArcadeTokens.gold),
                        (" and ", nil),
                        ("Cross", ArcadeTokens.cosmic),
                        (" shapes also grant ", nil),
                        ("+1 Pin Capsule!", .white.opacity(0.8)),
                    ])
                }
            }
        }
    }

    // MARK: Slide 3 - Score Big

    private var scoringSlide: some View {
        VStack(spacing: 12) {
            slideTitle(
                icon: "trophy.fill",
                color: ArcadeTokens.gold,
                title: "Score Big",
                subtitle: "Play smart, stack points, earn rewards"
            )

            // Scoring formula
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(ArcadeTokens.gold)
                    Text("HOW SCORING WORKS")
                        .font(.custom("Brice-Black", size: 10))
                        .tracking(2)
                        .foregroundStyle(ArcadeTokens.gold)
                }
                HStack(spacing: 8) {
                    formulaChip("Base", color: .white, bg: .white.opacity(0.1))
                    Text("x").foregroundStyle(.white.opacity(0.3))
                    formulaChip("Tier", color: ArcadeTokens.gold, bg: ArcadeTokens.gold.opacity(0.12))
                    Text("x").foregroundStyle(.white.opacity(0.3))
                    formulaChip("Combo", color: ArcadeTokens.orange, bg: ArcadeTokens.orange.opacity(0.12))
                }
                .frame(maxWidth: .infinity)
                HStack(spacing: 8) {
                    baseScoreCell("150", label: "Match-3")
                    baseScoreCell("450", label: "Match-4")
                    baseScoreCell("900", label: "Match-5+")
                }
            }
            .padding(14)
            .background(cardBackground(ArcadeTokens.gold))

            // Tier multipliers
            VStack(alignment: .leading, spacing: 8) {
                Text("TIER MULTIPLIERS")
                    .font(.custom("Brice-Black", size: 11))
                    .tracking(1.5)
                    .foregroundStyle(.white.opacity(0.7))
                FlowChips(items: [
                    ("Common", "1x", Color(pinHex: BadgeTier.blue.colorHex)),
                    ("Rare", "1.5x", Color(pinHex: BadgeTier.silver.colorHex)),
                    ("Special", "2x", Color(pinHex: BadgeTier.special.colorHex)),
                    ("Legendary", "2x", Color(pinHex: BadgeTier.gold.colorHex)),
                    ("Cosmic", "3x", Color(pinHex: BadgeTier.cosmic.colorHex)),
                ])
            }
            .padding(14)
            .background(cardBackground(ArcadeTokens.cosmic))

            ruleCard(icon: "chart.line.uptrend.xyaxis", color: ArcadeTokens.orange, title: "Combos & Cascades") {
                VStack(alignment: .leading, spacing: 4) {
                    styledBody("A single swap can chain into multiple matches as tiles fall. Each extra match is a ", [
                        ("cascade", ArcadeTokens.orange),
                        (", and every cascade multiplies your score by an extra ", nil),
                        ("+100%", ArcadeTokens.gold),
                        (".", nil),
                    ])
                    styledBody("Finish a turn with lots of cascades and the ", [
                        ("momentum carries over", .white.opacity(0.8)),
                        (" into the next turn:", nil),
                    ])
                    styledBody("3 cascades: next turn starts at ", [("+1", ArcadeTokens.gold), (" combo", nil)])
                    styledBody("4 cascades: next turn starts at ", [("+2", ArcadeTokens.gold), (" combo", nil)])
                    styledBody("5+ cascades: next turn starts at ", [("+3", ArcadeTokens.gold), (" combo", nil)])
                }
            }

            ruleCard(icon: "circle.circle.fill", color: ArcadeTokens.cosmic, title: "Tile Scores") {
                VStack(alignment: .leading, spacing: 3) {
                    styledBody("", [("Bomb:", ArcadeTokens.orange), (" 500 + 50 per tile cleared", nil)])
                    styledBody("", [("Laser Party:", ArcadeTokens.gold), (" 750 + 60 per tile", nil)])
                    styledBody("", [("Cosmic Blast:", ArcadeTokens.cosmic), (" 1000 + 75 per tile", nil)])
                }
            }

            ruleCard(icon: "gift.fill", color: ArcadeTokens.gold, title: "Pin Capsule") {
                VStack(alignment: .leading, spacing: 4) {
                    styledBody("Score ", [
                        ("15K+", ArcadeTokens.gold), (" to win 1 Capsule, ", nil),
                        ("35K+", ArcadeTokens.gold), (" for 2, ", nil),
                        ("75K+", ArcadeTokens.gold), (" for 3!", nil),
                    ])
                    styledBody("", [
                        ("T", .white.opacity(0.8)), (" and ", nil),
                        ("Cross", .white.opacity(0.8)), (" shapes also grant ", nil),
                        ("+1 bonus capsule", ArcadeTokens.gold), (".", nil),
                    ])
                    styledBody("Capsules are earnable during your first ", [
                        ("10 games", ArcadeTokens.gold),
                        (" each day, plus the Daily Challenge.", nil),
                    ])
                }
            }

            ruleCard(icon: "lightbulb.fill", color: ArcadeTokens.cosmic, title: "Pro Tip") {
                styledBody("Hunt for Legendary and Cosmic pins first: they multiply everything. Set up cascades with high-tier pins and you'll blast past 15K.", [])
            }
        }
    }

    // MARK: Shared slide components

    private func slideTitle(icon: String, color: Color, title: String, subtitle: String) -> some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(LinearGradient(
                        colors: [color.opacity(0.19), color.opacity(0.08)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(color.opacity(0.25), lineWidth: 1.5)
                    )
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 56, height: 56)
            .shadow(color: color.opacity(0.25), radius: 16)

            VStack(spacing: 3) {
                Text(title)
                    .font(.custom("Brice-Black", size: 24))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.custom("Mundial-Regular", size: 12))
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity)
    }

    private func ruleCard<Content: View>(
        icon: String,
        color: Color,
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(color.opacity(0.09))
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 36, height: 36)
            .shadow(color: color.opacity(0.13), radius: 8)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.custom("Brice-Black", size: 13))
                    .foregroundStyle(color)
                content()
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground(color))
    }

    private func cardBackground(_ color: Color) -> some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(LinearGradient(
                colors: [color.opacity(0.07), color.opacity(0.02)],
                startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(color.opacity(0.15), lineWidth: 1)
            )
    }

    private func powerTileRow(icon: String, color: Color, name: String, chip: String, detail: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(color.opacity(0.09))
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 44, height: 44)
            .shadow(color: color.opacity(0.13), radius: 10)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(name)
                        .font(.custom("Brice-Black", size: 13))
                        .foregroundStyle(color)
                    Text(chip)
                        .font(.custom("Mundial-Bold", size: 9))
                        .foregroundStyle(color.opacity(0.8))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(color.opacity(0.15)))
                }
                Text(detail)
                    .font(.custom("Mundial-Regular", size: 11))
                    .foregroundStyle(.white.opacity(0.5))
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground(color))
    }

    private func shapeChip(_ label: String, color: Color) -> some View {
        Text(label)
            .font(.custom("Mundial-Bold", size: 10))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(color.opacity(0.25), lineWidth: 1)
                    )
            )
    }

    private func formulaChip(_ label: String, color: Color, bg: Color) -> some View {
        Text(label)
            .font(.custom("Mundial-Bold", size: 12))
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(bg))
    }

    private func baseScoreCell(_ value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.custom("Brice-Black", size: 14))
                .foregroundStyle(.white.opacity(0.8))
            Text(label)
                .font(.custom("Mundial-Regular", size: 9))
                .foregroundStyle(.white.opacity(0.35))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(.white.opacity(0.05)))
    }

    /// Body text with inline color highlights: a leading plain run followed
    /// by (text, color) segments. Nil color renders the default body style.
    private func styledBody(_ lead: String, _ segments: [(String, Color?)]) -> some View {
        var result = AttributedString()
        var leadRun = AttributedString(lead)
        leadRun.foregroundColor = .white.opacity(0.55)
        result.append(leadRun)
        for (text, color) in segments {
            var run = AttributedString(text)
            run.foregroundColor = color ?? .white.opacity(0.55)
            if color != nil {
                run.font = .custom("Mundial-Bold", size: 11.5)
            }
            result.append(run)
        }
        return Text(result)
            .font(.custom("Mundial-Regular", size: 11.5))
            .lineSpacing(3)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Flow chips row

/// Simple wrapping chip row for the tier multiplier list.
private struct FlowChips: View {
    let items: [(String, String, Color)]

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(items, id: \.0) { name, mult, color in
                HStack(spacing: 6) {
                    Circle()
                        .fill(color)
                        .frame(width: 8, height: 8)
                        .shadow(color: color, radius: 3)
                    Text(name)
                        .font(.custom("Mundial-Bold", size: 10))
                        .foregroundStyle(color)
                    Text(mult)
                        .font(.custom("Mundial-Regular", size: 10))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(color.opacity(0.07))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(color.opacity(0.25), lineWidth: 1)
                        )
                )
            }
        }
    }
}

/// Minimal wrapping layout for chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Preview

#Preview {
    RulesView(onClose: {})
        .preferredColorScheme(.dark)
}
