import SwiftUI

// MARK: - Collection Filter

private enum CollectionFilter: String, CaseIterable {
    case all = "All"
    case blue = "Common"
    case silver = "Silver"
    case gold = "Gold"
    case cosmic = "Cosmic"

    var badgeTier: BadgeTier? {
        switch self {
        case .all: return nil
        case .blue: return .blue
        case .silver: return .silver
        case .gold: return .gold
        case .cosmic: return .cosmic
        }
    }

    var color: Color {
        switch self {
        case .all: return VibeColors.textPrimary
        case .blue: return BadgeTier.blue.displayColor
        case .silver: return BadgeTier.silver.displayColor
        case .gold: return BadgeTier.gold.displayColor
        case .cosmic: return BadgeTier.cosmic.displayColor
        }
    }
}

// MARK: - Collection Tab

private enum CollectionTab: String, CaseIterable {
    case badges = "Badges"
    case chests = "Chests"
}

// MARK: - Collection View

/// Badge collection screen showing all discovered and undiscovered badges.
/// Supports filtering by tier, viewing badge details, and managing chests.
struct CollectionView: View {
    let collection: BadgeCollection
    let allBadges: [Badge]
    let chests: [Chest]
    var onOpenChest: ((Chest) -> Void)? = nil
    var onDismiss: () -> Void

    @State private var selectedTab: CollectionTab = .badges
    @State private var selectedFilter: CollectionFilter = .all
    @State private var selectedBadge: CollectedBadge? = nil
    @State private var showBadgeDetail = false

    private var totalBadges: Int { allBadges.count }
    private var discoveredCount: Int { collection.uniqueCount }

    var body: some View {
        ZStack {
            VibeColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                header

                // Tab picker
                tabPicker

                // Content
                switch selectedTab {
                case .badges:
                    badgeContent
                case .chests:
                    chestsContent
                }
            }
        }
        .sheet(isPresented: $showBadgeDetail) {
            if let badge = selectedBadge {
                BadgeDetailSheet(collected: badge)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button {
                let gen = UIImpactFeedbackGenerator(style: .light)
                gen.impactOccurred()
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(VibeColors.textSecondary)
                    .frame(width: 40, height: 40)
            }

            Spacer()

            VStack(spacing: 2) {
                Text("COLLECTION")
                    .font(.system(size: 18, weight: .black, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(VibeColors.textPrimary)

                Text("\(discoveredCount)/\(totalBadges) Badges Discovered")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(VibeColors.textSecondary)
            }

            Spacer()

            // Spacer for symmetry
            Color.clear.frame(width: 40, height: 40)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    // MARK: - Tab Picker

    private var tabPicker: some View {
        HStack(spacing: 0) {
            ForEach(CollectionTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 6) {
                        HStack(spacing: 6) {
                            Text(tab.rawValue)
                                .font(.system(size: 14, weight: selectedTab == tab ? .bold : .medium))
                                .foregroundStyle(selectedTab == tab ? VibeColors.textPrimary : VibeColors.textSecondary)

                            if tab == .chests && !unopenedChests.isEmpty {
                                Text("\(unopenedChests.count)")
                                    .font(.system(size: 10, weight: .heavy))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(VibeColors.accentWarm)
                                    .clipShape(Capsule())
                            }
                        }

                        Rectangle()
                            .fill(selectedTab == tab ? VibeColors.primary : Color.clear)
                            .frame(height: 2)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Badge Content

    private var badgeContent: some View {
        VStack(spacing: 0) {
            // Filter chips
            filterChips
                .padding(.vertical, 12)

            // Collection progress bar
            progressBar
                .padding(.horizontal, 24)
                .padding(.bottom, 12)

            // Badge grid
            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                    spacing: 16
                ) {
                    ForEach(filteredBadges, id: \.id) { badge in
                        let collected = collection.badges[badge.id]
                        let isDiscovered = collected != nil

                        Button {
                            if let collected {
                                selectedBadge = collected
                                showBadgeDetail = true
                            }
                        } label: {
                            BadgeCard(
                                badge: badge,
                                quantity: collected?.quantity,
                                isDiscovered: isDiscovered,
                                showName: true,
                                size: 56
                            )
                        }
                        .buttonStyle(VibePressStyle())
                        .disabled(!isDiscovered)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 40)
            }
        }
    }

    // MARK: - Filter Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CollectionFilter.allCases, id: \.self) { filter in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            selectedFilter = filter
                        }
                    } label: {
                        Text(filter.rawValue)
                            .font(.system(size: 12, weight: selectedFilter == filter ? .bold : .medium))
                            .foregroundStyle(selectedFilter == filter ? .white : filter.color.opacity(0.7))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(
                                Capsule()
                                    .fill(selectedFilter == filter ? filter.color.opacity(0.3) : Color.white.opacity(0.05))
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(
                                                selectedFilter == filter ? filter.color.opacity(0.6) : Color.white.opacity(0.1),
                                                lineWidth: 1
                                            )
                                    )
                            )
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        let progress = totalBadges > 0 ? Double(discoveredCount) / Double(totalBadges) : 0

        return VStack(spacing: 4) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.08))

                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [VibeColors.primary, VibeColors.primaryLight],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * progress)
                }
            }
            .frame(height: 6)
        }
    }

    private var filteredBadges: [Badge] {
        guard let tier = selectedFilter.badgeTier else { return allBadges }
        return allBadges.filter { $0.tier == tier }
    }

    // MARK: - Chests Content

    private var chestsContent: some View {
        ScrollView {
            if unopenedChests.isEmpty {
                VStack(spacing: 16) {
                    Spacer().frame(height: 60)
                    Image(systemName: "shippingbox.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(VibeColors.textSecondary.opacity(0.3))
                    Text("No chests to open")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(VibeColors.textSecondary)
                    Text("Keep playing to earn reward chests!")
                        .font(.system(size: 13))
                        .foregroundStyle(VibeColors.textSecondary.opacity(0.6))
                }
                .frame(maxWidth: .infinity)
            } else {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 2),
                    spacing: 16
                ) {
                    ForEach(unopenedChests) { chest in
                        ChestItemCard(chest: chest) {
                            onOpenChest?(chest)
                        }
                    }
                }
                .padding(16)
            }
        }
    }

    private var unopenedChests: [Chest] {
        chests.filter { !$0.isOpened }
    }
}

// MARK: - Chest Item Card

private struct ChestItemCard: View {
    let chest: Chest
    let onTap: () -> Void

    private var chestColor: Color {
        switch chest.type {
        case .bronze: return Color(red: 0.80, green: 0.50, blue: 0.20)
        case .silver: return Color(red: 0.75, green: 0.78, blue: 0.82)
        case .gold:   return VibeColors.gold
        case .cosmic: return Color(red: 0.70, green: 0.40, blue: 1.0)
        }
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [chestColor.opacity(0.3), .clear],
                                center: .center,
                                startRadius: 10,
                                endRadius: 50
                            )
                        )
                        .frame(width: 80, height: 80)

                    Image(systemName: "shippingbox.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(chestColor)
                        .shadow(color: chestColor.opacity(0.5), radius: 8)
                }

                Text(chest.type.rawValue.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(2)
                    .foregroundStyle(chestColor)

                Text("\(chest.type.dropCount) badges")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(VibeColors.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .strokeBorder(chestColor.opacity(0.3), lineWidth: 1.5)
                    )
            )
        }
        .buttonStyle(VibePressStyle())
    }
}

// MARK: - Badge Detail Sheet

private struct BadgeDetailSheet: View {
    let collected: CollectedBadge

    @Environment(\.dismiss) private var dismiss

    private var badge: Badge { collected.badge }

    var body: some View {
        ZStack {
            VibeColors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 20)

                    // Badge display
                    BadgeCard(badge: badge, quantity: collected.quantity, size: 100)

                    // Name and tier
                    VStack(spacing: 4) {
                        Text(badge.name)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(VibeColors.textPrimary)

                        Text(badge.tier.displayName.uppercased())
                            .font(.system(size: 12, weight: .heavy))
                            .tracking(2)
                            .foregroundStyle(badge.tier.displayColor)
                    }

                    // Lore
                    Text(badge.lore)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(VibeColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)

                    // Stats
                    HStack(spacing: 24) {
                        VStack(spacing: 4) {
                            Text("OWNED")
                                .font(.system(size: 9, weight: .heavy))
                                .tracking(1.5)
                                .foregroundStyle(VibeColors.textSecondary)
                            Text("\(collected.quantity)")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundStyle(VibeColors.textPrimary)
                        }

                        VStack(spacing: 4) {
                            Text("MULTIPLIER")
                                .font(.system(size: 9, weight: .heavy))
                                .tracking(1.5)
                                .foregroundStyle(VibeColors.textSecondary)
                            Text("x\(String(format: "%.1f", badge.pointMultiplier))")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundStyle(badge.tier.displayColor)
                        }

                        VStack(spacing: 4) {
                            Text("MASTERY")
                                .font(.system(size: 9, weight: .heavy))
                                .tracking(1.5)
                                .foregroundStyle(VibeColors.textSecondary)
                            Text(masteryLabel)
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundStyle(masteryColor)
                        }
                    }
                    .padding(.top, 8)

                    // Mastery progress
                    masteryProgress
                        .padding(.horizontal, 32)

                    Spacer().frame(height: 20)
                }
            }
        }
    }

    private var masteryLabel: String {
        switch collected.masteryLevel {
        case .none:   return "--"
        case .bronze: return "I"
        case .silver: return "II"
        case .gold:   return "III"
        case .cosmic: return "IV"
        }
    }

    private var masteryColor: Color {
        switch collected.masteryLevel {
        case .none:   return VibeColors.textSecondary
        case .bronze: return Color(red: 0.80, green: 0.50, blue: 0.20)
        case .silver: return Color(red: 0.75, green: 0.78, blue: 0.82)
        case .gold:   return VibeColors.gold
        case .cosmic: return Color(red: 0.70, green: 0.40, blue: 1.0)
        }
    }

    private var masteryProgress: some View {
        let nextLevel = MasteryLevel(rawValue: collected.masteryLevel.rawValue + 1)
        let nextRequired = nextLevel?.requiredQuantity ?? collected.masteryLevel.requiredQuantity
        let currentRequired = collected.masteryLevel.requiredQuantity
        let range = max(nextRequired - currentRequired, 1)
        let progress = Double(collected.quantity - currentRequired) / Double(range)

        return VStack(spacing: 6) {
            Text("MASTERY TRACK")
                .font(.system(size: 9, weight: .heavy))
                .tracking(2)
                .foregroundStyle(VibeColors.textSecondary)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.08))
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [masteryColor, masteryColor.opacity(0.5)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * min(max(progress, 0), 1))
                }
            }
            .frame(height: 6)

            if let nextLevel {
                Text("\(collected.quantity)/\(nextLevel.requiredQuantity) to next mastery")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(VibeColors.textSecondary.opacity(0.7))
            } else {
                Text("MAX MASTERY")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Color(red: 0.70, green: 0.40, blue: 1.0))
            }
        }
    }
}

// MARK: - Preview

#Preview {
    let sampleBadge = Badge(id: "gvc", name: "Good Vibes", image: "badge_gvc", tier: .gold, lore: "A true vibe lord.", pointMultiplier: 2.0)
    let collection = BadgeCollection(badges: [
        "gvc": CollectedBadge(badge: sampleBadge, quantity: 12, masteryLevel: .silver)
    ])
    CollectionView(
        collection: collection,
        allBadges: [sampleBadge],
        chests: [],
        onDismiss: {}
    )
}
