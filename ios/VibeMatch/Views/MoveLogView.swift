import SwiftUI

/// Move Breakdown sheet — the post-move analysis surface the player
/// opens by tapping the SCORE card during play. Mirrors the web
/// `MoveLogModal.tsx`: rollup stats at top (avg / best / longest chain),
/// then a reverse-chronological list of move rows. Each row collapses
/// to one line and expands to show match count, cascade depth, combo
/// peak, and the dominant pin tier.

struct MoveLogView: View {
    let moveLog: [MoveLogEntry]
    let totalScore: Int
    var isPostGame: Bool = false
    var onClose: () -> Void

    @State private var expandedMoveNum: Int? = nil

    // MARK: - Derived stats

    private var topMoveNums: Set<Int> {
        let sorted = moveLog
            .filter { $0.pointsGained > 0 }
            .sorted { $0.pointsGained > $1.pointsGained }
            .prefix(3)
        return Set(sorted.map { $0.moveNum })
    }

    private var avgPerMove: Int {
        guard !moveLog.isEmpty else { return 0 }
        let sum = moveLog.reduce(0) { $0 + $1.pointsGained }
        return Int(round(Double(sum) / Double(moveLog.count)))
    }

    private var biggestMove: MoveLogEntry? {
        moveLog.max(by: { $0.pointsGained < $1.pointsGained })
    }

    private var longestChain: Int {
        moveLog.reduce(0) { max($0, $1.cascadeCount) }
    }

    private var orderedForDisplay: [MoveLogEntry] {
        Array(moveLog.reversed())  // newest first
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.black.opacity(0.85)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            VStack(spacing: 0) {
                header
                if !moveLog.isEmpty { rollupStats }
                Divider()
                    .background(ArcadeTokens.cosmic.opacity(0.18))
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 8) {
                        if moveLog.isEmpty {
                            Text(isPostGame ? "No moves played." : "No moves yet — make your first match.")
                                .font(.custom("Mundial-Regular", size: 13))
                                .foregroundStyle(.white.opacity(0.4))
                                .padding(.vertical, 36)
                        } else {
                            ForEach(orderedForDisplay) { entry in
                                MoveRow(
                                    entry: entry,
                                    expanded: expandedMoveNum == entry.moveNum,
                                    isTopMove: topMoveNums.contains(entry.moveNum),
                                    onToggle: {
                                        withAnimation(.easeInOut(duration: 0.18)) {
                                            expandedMoveNum = expandedMoveNum == entry.moveNum ? nil : entry.moveNum
                                        }
                                    }
                                )
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                if !moveLog.isEmpty { legendFooter }
            }
            .background(
                LinearGradient(
                    colors: [
                        PinHex("1a0a30"),
                        PinHex("110321"),
                        PinHex("21083B"),
                        PinHex("1a0a30"),
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
            .shadow(color: ArcadeTokens.cosmic.opacity(0.18), radius: 60)
            .shadow(color: .black.opacity(0.5), radius: 40, y: 25)
            .padding(.horizontal, 16)
            .padding(.vertical, 32)
            .frame(maxWidth: 500)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(
                        LinearGradient(
                            colors: [ArcadeTokens.cosmic.opacity(0.25), ArcadeTokens.cosmic.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 36, height: 36)
                Image(systemName: "list.bullet.rectangle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(ArcadeTokens.gold)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text("MOVE BREAKDOWN")
                    .font(.custom("Brice-Black", size: 16))
                    .tracking(1.4)
                    .foregroundStyle(.white)
                Text("\(moveLog.count) \(moveLog.count == 1 ? "MOVE" : "MOVES") · \(totalScore.formatted(.number)) PTS")
                    .font(.custom("Mundial-Bold", size: 10))
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.4))
            }

            Spacer()

            Button(action: onClose) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.08))
                    Circle()
                        .strokeBorder(.white.opacity(0.1), lineWidth: 1)
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white.opacity(0.55))
                }
                .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 14)
    }

    // MARK: - Rollup

    private var rollupStats: some View {
        HStack(spacing: 8) {
            statCell(label: "AVG / MOVE", value: avgPerMove.formatted(.number), color: .white)
            statCell(label: "BEST MOVE", value: biggestMove.map { "+\($0.pointsGained.formatted(.number))" } ?? "—", color: ArcadeTokens.gold)
            statCell(label: "LONGEST CHAIN", value: longestChain > 0 ? String(longestChain) : "—", color: PinHex("4A9EFF"))
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    private func statCell(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.custom("Mundial-Bold", size: 9))
                .tracking(1.3)
                .foregroundStyle(.white.opacity(0.4))
            Text(value)
                .font(.custom("Brice-Black", size: 16))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Legend

    private var legendFooter: some View {
        HStack(spacing: 14) {
            legendItem(icon: "flame.fill", label: "COMBO", color: ArcadeTokens.orange)
            legendItem(icon: "square.3.layers.3d.top.filled", label: "CASCADE", color: PinHex("4A9EFF"))
            legendItem(icon: "star.fill", label: "SHAPE", color: ArcadeTokens.cosmic)
            legendItem(icon: "burst.fill", label: "POWER", color: .red.opacity(0.8))
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .overlay(
            Rectangle()
                .fill(ArcadeTokens.cosmic.opacity(0.10))
                .frame(height: 1),
            alignment: .top
        )
    }

    private func legendItem(icon: String, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9))
                .foregroundStyle(color)
            Text(label)
                .font(.custom("Mundial-Bold", size: 8))
                .tracking(1.0)
                .foregroundStyle(.white.opacity(0.3))
        }
    }
}

// MARK: - Move Row

private struct MoveRow: View {
    let entry: MoveLogEntry
    let expanded: Bool
    let isTopMove: Bool
    var onToggle: () -> Void

    private var isHuge: Bool { entry.pointsGained >= 2000 }
    private var isBig: Bool { entry.pointsGained >= 800 }
    private var tierColor: Color {
        entry.topTier.map { Color(pinHex: $0.colorHex) } ?? .white.opacity(0.3)
    }
    private var tierLabel: String? { entry.topTier?.displayName }

    var body: some View {
        Button(action: onToggle) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    // Move # badge
                    VStack(spacing: 0) {
                        Text("#")
                            .font(.custom("Mundial-Regular", size: 9))
                            .foregroundStyle(.white.opacity(0.4))
                        Text("\(entry.moveNum)")
                            .font(.custom("Brice-Black", size: 13))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 36, height: 36)
                    .background(ArcadeTokens.cosmic.opacity(0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(ArcadeTokens.cosmic.opacity(0.22), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    // Tier swatch
                    RoundedRectangle(cornerRadius: 3)
                        .fill(tierColor)
                        .frame(width: 14, height: 14)
                        .shadow(color: tierColor.opacity(0.4), radius: 4)

                    // Points + chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("+\(entry.pointsGained.formatted(.number))")
                            .font(.custom("Brice-Black", size: isHuge ? 19 : isBig ? 17 : 15))
                            .foregroundStyle(isBig ? ArcadeTokens.gold : .white)
                            .shadow(color: isHuge ? ArcadeTokens.gold.opacity(0.5) : .clear, radius: 10)

                        HStack(spacing: 8) {
                            if entry.maxCombo >= 2 {
                                chip(icon: "flame.fill", text: "×\(entry.maxCombo)", color: ArcadeTokens.orange)
                            }
                            if entry.cascadeCount >= 1 {
                                chip(icon: "square.3.layers.3d.top.filled", text: "\(entry.cascadeCount)", color: PinHex("4A9EFF"))
                            }
                            if let shape = entry.shapeBonus {
                                chip(icon: "star.fill", text: shapeLabel(shape), color: ArcadeTokens.cosmic)
                            }
                            ForEach(Array(entry.specialsCreated.enumerated()), id: \.offset) { _, s in
                                specialChip(s, suffix: "+")
                            }
                            ForEach(Array(entry.specialsTriggered.enumerated()), id: \.offset) { _, s in
                                specialChip(s, suffix: "!")
                            }
                        }
                    }

                    Spacer(minLength: 0)

                    if isTopMove {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(ArcadeTokens.gold)
                            .frame(width: 24, height: 24)
                            .background(ArcadeTokens.gold.opacity(0.18))
                            .clipShape(Circle())
                            .overlay(Circle().strokeBorder(ArcadeTokens.gold.opacity(0.4), lineWidth: 1))
                    }

                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.3))
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                }

                if expanded {
                    expandedDetails
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                isHuge
                    ? AnyShapeStyle(LinearGradient(
                        colors: [ArcadeTokens.gold.opacity(0.10), ArcadeTokens.cosmic.opacity(0.06)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    : AnyShapeStyle(Color.white.opacity(isBig ? 0.04 : 0.025))
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        isHuge ? ArcadeTokens.gold.opacity(0.35) : Color.white.opacity(0.06),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private func chip(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 9))
            Text(text).font(.custom("Mundial-Bold", size: 10))
        }
        .foregroundStyle(color)
    }

    private func specialChip(_ type: SpecialTileType, suffix: String) -> some View {
        let (icon, color) = specialIcon(type)
        return HStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 9))
            Text(suffix).font(.custom("Mundial-Bold", size: 10))
        }
        .foregroundStyle(color)
    }

    private func specialIcon(_ type: SpecialTileType) -> (String, Color) {
        switch type {
        case .bomb:        return ("burst.fill", .red.opacity(0.85))
        case .vibestreak:  return ("bolt.fill", PinHex("4A9EFF"))
        case .cosmicBlast: return ("sparkles", ArcadeTokens.cosmic)
        }
    }

    private func shapeLabel(_ shape: ShapeBonusType) -> String {
        switch shape {
        case .L:     return "L SHAPE"
        case .T:     return "T SHAPE"
        case .cross: return "CROSS"
        }
    }

    private var expandedDetails: some View {
        VStack(spacing: 6) {
            Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1)
            HStack(spacing: 16) {
                detailItem(label: "Matches", value: "\(entry.matchesFound)")
                detailItem(label: "Cascades", value: "\(entry.cascadeCount)")
            }
            HStack(spacing: 16) {
                detailItem(label: "Combo peak", value: "×\(max(1, entry.maxCombo))")
                detailItem(label: "Tier", value: tierLabel ?? "—", valueColor: tierColor)
            }
        }
    }

    private func detailItem(label: String, value: String, valueColor: Color = .white.opacity(0.9)) -> some View {
        HStack(spacing: 4) {
            Text(label + ":")
                .font(.custom("Mundial-Regular", size: 11))
                .foregroundStyle(.white.opacity(0.4))
            Text(value)
                .font(.custom("Mundial-Bold", size: 11))
                .foregroundStyle(valueColor)
        }
        .frame(maxWidth: .infinity)
    }
}
