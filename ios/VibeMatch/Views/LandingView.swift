import SwiftUI

// MARK: - Landing View
//
// Faithful SwiftUI port of the web LandingPageQuest
// (src/components/LandingPageQuest.tsx). Mirrors the web's enamel-pin
// arcade aesthetic exactly:
//
//   • FloatingBadges pin-wall background (drift up + slow spin, atmospheric)
//   • Gold-edged HeaderRail (pins discovered / streak)
//   • PIN DROP shaka logo (logo-v3.png) with idle bob + gold glow
//   • Classic enamel card (gold rim, 30 MOVES circle, gold PLAY)
//   • Daily Challenge enamel card (cosmic rim, ★ circle, cosmic PLAY)
//   • Daily Plays energy bar (gold → orange → red as plays deplete)
//   • BottomNav (Profile / Pins / Quests / Leaders / Rules)
//
// Game modes match web exactly: Classic + Daily Challenge only.

struct LandingView: View {
    var onStartClassic: () -> Void
    var onStartDaily: () -> Void
    var onOpenPinBook: () -> Void
    var onOpenLeaderboard: () -> Void
    var onOpenAchievements: () -> Void
    var onShowInstructions: () -> Void = {}
    var onOpenProfile: () -> Void = {}
    var onOpenBuyPrizeGames: () -> Void = {}

    var capsuleCount: Int = 0
    var pinsCollected: Int = 0
    var classicPlays: Int = 0
    var bonusPrizeGames: Int = 0
    var streak: Int = 0

    private let totalBadges = BADGES.count
    private let baseCap = 10

    private var totalCap: Int { baseCap + bonusPrizeGames }
    private var remaining: Int { max(0, totalCap - classicPlays) }
    private var remainingPct: Double {
        totalCap > 0 ? Double(remaining) / Double(totalCap) : 0
    }
    private var isEmpty: Bool { remaining == 0 }
    private var isLow: Bool { !isEmpty && remaining <= 3 }
    private var prizeAccent: Color {
        if isEmpty { return ArcadeTokens.red }
        if isLow { return ArcadeTokens.orange }
        return ArcadeTokens.gold
    }
    private var prizeAccentDeep: Color {
        if isEmpty { return ArcadeTokens.redDeep }
        if isLow { return ArcadeTokens.orangeDeep }
        return ArcadeTokens.goldDeep
    }
    private var prizeAccentLight: Color {
        if isEmpty { return ArcadeTokens.redLight }
        if isLow { return ArcadeTokens.orangeLight }
        return ArcadeTokens.goldLight
    }

    var body: some View {
        ZStack {
            FloatingBadgesBackground()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    HeaderRail(
                        pinsCollected: pinsCollected,
                        totalBadges: totalBadges,
                        streak: streak,
                        onOpenProfile: onOpenProfile
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                    pinDropLogo
                        .padding(.top, 26)
                        .padding(.bottom, 14)

                    VStack(spacing: 14) {
                        classicCard
                        dailyCard
                        prizeBar
                    }
                    .padding(.horizontal, 16)

                    BottomNav(
                        capsuleCount: capsuleCount,
                        onProfile: onOpenProfile,
                        onPins: onOpenPinBook,
                        onQuests: onOpenAchievements,
                        onLeaders: onOpenLeaderboard,
                        onRules: onShowInstructions
                    )
                    .padding(.horizontal, 12)
                    .padding(.top, 18)
                    .padding(.bottom, 36)
                }
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .ignoresSafeArea(.container, edges: .bottom)
    }

    // MARK: - Logo

    @State private var logoBob: CGFloat = 0

    private var pinDropLogo: some View {
        Image("PinDropLogo")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(maxWidth: 280)
            .shadow(color: ArcadeTokens.gold.opacity(0.45), radius: 26, y: 10)
            .shadow(color: ArcadeTokens.orange.opacity(0.25), radius: 32, y: 14)
            .offset(y: logoBob)
            .onAppear {
                withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) {
                    logoBob = -7
                }
            }
    }

    // MARK: - Classic card

    private var classicCard: some View {
        Button(action: onStartClassic) {
            EnamelCard(rim: ArcadeTokens.gold, dim: ArcadeTokens.goldDim, deep: ArcadeTokens.goldDeep) {
                HStack(spacing: 14) {
                    EnamelCircle(
                        rim: ArcadeTokens.gold,
                        light: ArcadeTokens.goldLight,
                        deep: ArcadeTokens.goldDeep,
                        border: Color(pinHex: "2A1A0A")
                    ) {
                        VStack(spacing: 0) {
                            Text("30")
                                .font(.custom("Brice-Black", size: 34))
                                .foregroundStyle(Color(pinHex: "1A0633"))
                                .shadow(color: .white.opacity(0.35), radius: 0, y: 1)
                            Text("MOVES")
                                .font(.custom("Mundial-Bold", size: 8))
                                .tracking(1.2)
                                .foregroundStyle(Color(pinHex: "1A0633"))
                                .padding(.top, -2)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Classic")
                            .font(.custom("Brice-Black", size: 19))
                            .foregroundStyle(ArcadeTokens.gold)
                            .shadow(color: .black.opacity(0.5), radius: 0, y: 2)
                        Text("PIN DROP")
                            .font(.custom("Brice-Black", size: 28))
                            .tracking(0.4)
                            .foregroundStyle(ArcadeTokens.gold)
                            .shadow(color: .black.opacity(0.55), radius: 0, y: 2)
                        Text("Match pins. Score big.")
                            .font(.custom("Mundial-Regular", size: 11))
                            .foregroundStyle(.white.opacity(0.55))
                            .padding(.top, 3)
                    }

                    Spacer(minLength: 0)

                    ChunkyButton(
                        label: "PLAY",
                        color: ArcadeTokens.gold,
                        deep: ArcadeTokens.goldDeep,
                        textColor: Color(pinHex: "1A0633")
                    )
                    .frame(maxHeight: .infinity, alignment: .bottom)
                }
                .padding(14)
            }
            .rotationEffect(.degrees(-0.6))
        }
        .buttonStyle(LandingPressStyle())
    }

    // MARK: - Daily card

    private var dailyCard: some View {
        Button(action: onStartDaily) {
            EnamelCard(rim: ArcadeTokens.cosmic, dim: ArcadeTokens.cosmicLight, deep: ArcadeTokens.cosmicDeep) {
                HStack(spacing: 14) {
                    EnamelCircle(
                        rim: ArcadeTokens.cosmic,
                        light: ArcadeTokens.cosmicLight,
                        deep: ArcadeTokens.cosmicDeep,
                        border: Color(pinHex: "1a0a2e")
                    ) {
                        Text("★")
                            .font(.custom("Brice-Black", size: 38))
                            .foregroundStyle(Color(pinHex: "1A0633"))
                            .shadow(color: .white.opacity(0.3), radius: 0, y: 1)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("The Daily")
                            .font(.custom("Brice-Black", size: 19))
                            .foregroundStyle(ArcadeTokens.cosmic)
                            .shadow(color: .black.opacity(0.5), radius: 0, y: 2)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text("CHALLENGE")
                            .font(.custom("Brice-Black", size: 22))
                            .tracking(0.4)
                            .foregroundStyle(ArcadeTokens.cosmic)
                            .shadow(color: .black.opacity(0.55), radius: 0, y: 2)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .fixedSize(horizontal: false, vertical: true)
                        HStack(spacing: 6) {
                            Text("1 shot per day. Same board for all.")
                                .font(.custom("Mundial-Regular", size: 10))
                                .foregroundStyle(.white.opacity(0.55))
                            if streak > 0 {
                                Text("🔥\(streak)")
                                    .font(.custom("Mundial-Bold", size: 9))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .foregroundStyle(ArcadeTokens.orange)
                                    .background(ArcadeTokens.orange.opacity(0.13))
                                    .overlay(
                                        Capsule().strokeBorder(ArcadeTokens.orange.opacity(0.33), lineWidth: 1)
                                    )
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.top, 3)
                    }

                    Spacer(minLength: 0)

                    ChunkyButton(
                        label: "PLAY",
                        color: ArcadeTokens.cosmic,
                        deep: ArcadeTokens.cosmicDeep,
                        textColor: .white
                    )
                    .frame(maxHeight: .infinity, alignment: .bottom)
                }
                .padding(14)
            }
            .rotationEffect(.degrees(0.5))
        }
        .buttonStyle(LandingPressStyle())
    }

    // MARK: - Prize Games energy bar

    private var prizeBar: some View {
        Button(action: onOpenBuyPrizeGames) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    PrizeCoinView(spinning: isEmpty)
                        .frame(width: 30, height: 30)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(isEmpty ? "OUT OF PLAYS" : "DAILY PLAYS")
                            .font(.custom("Brice-Black", size: 14))
                            .tracking(0.8)
                            .foregroundStyle(prizeAccent)
                            .shadow(color: .black.opacity(0.5), radius: 0, y: 1)
                        Text("\(remaining) of \(totalCap) remaining\(bonusPrizeGames > 0 ? " · +\(bonusPrizeGames) bonus" : "")")
                            .font(.custom("Mundial-Regular", size: 9))
                            .foregroundStyle(.white.opacity(0.45))
                    }

                    Spacer()

                    ChunkyButton(
                        label: isEmpty ? "RESTOCK" : "+ RESTOCK",
                        color: prizeAccent,
                        deep: prizeAccentDeep,
                        textColor: (isEmpty || isLow) ? .white : Color(pinHex: "1A0633"),
                        fontSize: 10,
                        paddingH: 10,
                        paddingV: 6,
                        dropDepth: 4
                    )
                }

                EnergyBar(
                    pct: remainingPct,
                    segments: totalCap,
                    accent: prizeAccent,
                    accentLight: prizeAccentLight
                )
                .frame(height: 12)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                LinearGradient(
                    colors: [Color(pinHex: "1a0e03"), Color(pinHex: "0a0502")],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .padding(2)
            .background(
                LinearGradient(
                    colors: [prizeAccent, prizeAccentDeep],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.25), .clear],
                            startPoint: .top,
                            endPoint: .center
                        ),
                        lineWidth: 1
                    )
                    .padding(0.5)
            )
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(prizeAccentDeep)
                    .offset(y: 3)
                    .opacity(0.95)
            )
            .shadow(color: isEmpty ? ArcadeTokens.red.opacity(0.55) : prizeAccent.opacity(0.18), radius: 18)
            .shadow(color: .black.opacity(0.5), radius: 12, y: 6)
            .padding(.bottom, 4)
        }
        .buttonStyle(LandingPressStyle())
    }
}

// MARK: - Press Style

private struct LandingPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1.0)
            .offset(y: configuration.isPressed ? 2 : 0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// Arcade primitives (ArcadeTokens, EnamelCard, EnamelCircle, ChunkyButton,
// Color(pinHex:)) live in Views/Components/ArcadeUI.swift and are shared
// across the landing, HUD, GameOver, Pin Book, and Capsule Reveal.

// MARK: - Energy bar

private struct EnergyBar: View {
    let pct: Double
    let segments: Int
    let accent: Color
    let accentLight: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                // Track
                Capsule()
                    .fill(Color.black.opacity(0.45))
                    .overlay(
                        Capsule()
                            .stroke(Color.black.opacity(0.6), lineWidth: 1)
                    )

                // Fill
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [accent, accentLight],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geo.size.width * pct)
                    .shadow(color: accent.opacity(0.85), radius: 6)

                // Top inner highlight
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [.white.opacity(0.3), .clear],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
                    .frame(height: 6)
                    .padding(.horizontal, 1)
                    .padding(.top, 1)
                    .allowsHitTesting(false)

                // Segment ticks
                ForEach(1..<max(segments, 1), id: \.self) { i in
                    Rectangle()
                        .fill(Color.black.opacity(0.45))
                        .frame(width: 1)
                        .position(
                            x: geo.size.width * Double(i) / Double(segments),
                            y: geo.size.height / 2
                        )
                }
            }
        }
    }
}

// MARK: - Header Rail

private struct HeaderRail: View {
    let pinsCollected: Int
    let totalBadges: Int
    let streak: Int
    var onOpenProfile: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onOpenProfile) {
                HStack(spacing: 8) {
                    Image("GVCShaka")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 22, height: 22)
                    Text("PIN HUNTER")
                        .font(.custom("Brice-Black", size: 11))
                        .tracking(1.6)
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(LandingPressStyle())

            Spacer()

            HStack(spacing: 5) {
                Image(systemName: "circle.grid.2x2.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(ArcadeTokens.gold)
                Text("\(pinsCollected)/\(totalBadges)")
                    .font(.custom("Mundial-Bold", size: 12))
                    .foregroundStyle(.white)
            }

            if streak > 0 {
                HStack(spacing: 3) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(ArcadeTokens.orange)
                    Text("\(streak)")
                        .font(.custom("Mundial-Bold", size: 12))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(
            LinearGradient(
                colors: [Color(pinHex: "1A0633").opacity(0.92), Color(pinHex: "0a0414").opacity(0.95)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(ArcadeTokens.gold.opacity(0.45), lineWidth: 1)
        )
        .overlay(
            // 2px gold top edge
            Rectangle()
                .fill(ArcadeTokens.gold)
                .frame(height: 2)
                .frame(maxHeight: .infinity, alignment: .top),
            alignment: .top
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.55), radius: 14, y: 6)
    }
}

// MARK: - Bottom Nav

private struct BottomNav: View {
    let capsuleCount: Int
    var onProfile: () -> Void
    var onPins: () -> Void
    var onQuests: () -> Void
    var onLeaders: () -> Void
    var onRules: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            navItem(icon: "person.crop.circle.fill", label: "PROFILE", action: onProfile)
            navItem(icon: "square.grid.2x2.fill", label: "PINS", badge: capsuleCount, action: onPins)
            navItem(icon: "crown.fill", label: "QUESTS", action: onQuests)
            navItem(icon: "trophy.fill", label: "LEADERS", action: onLeaders)
            navItem(icon: "questionmark.circle.fill", label: "RULES", action: onRules)
        }
        .padding(.vertical, 10)
        .background(
            LinearGradient(
                colors: [Color(pinHex: "1A0633").opacity(0.88), Color(pinHex: "0a0414").opacity(0.92)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(ArcadeTokens.gold.opacity(0.2), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.55), radius: 14, y: 6)
    }

    private func navItem(icon: String, label: String, badge: Int? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: 19, weight: .regular))
                        .foregroundStyle(.white.opacity(0.72))
                        .padding(.horizontal, 4)
                    if let badge, badge > 0 {
                        Text("\(badge)")
                            .font(.custom("Mundial-Bold", size: 9))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(ArcadeTokens.gold)
                            .clipShape(Capsule())
                            .offset(x: 8, y: -4)
                            .shadow(color: ArcadeTokens.gold.opacity(0.5), radius: 4)
                    }
                }
                Text(label)
                    .font(.custom("Mundial-Bold", size: 9))
                    .tracking(1.5)
                    .foregroundStyle(.white.opacity(0.55))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(LandingPressStyle())
    }
}

// MARK: - Prize Coin

private struct PrizeCoinView: View {
    var spinning: Bool
    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [ArcadeTokens.goldLight, ArcadeTokens.gold, ArcadeTokens.goldDeep],
                        center: UnitPoint(x: 0.3, y: 0.3),
                        startRadius: 2,
                        endRadius: 16
                    )
                )
                .overlay(Circle().stroke(ArcadeTokens.goldDeep, lineWidth: 1.5))
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.4), lineWidth: 1)
                        .padding(3)
                )
            Text("$")
                .font(.custom("Brice-Black", size: 14))
                .foregroundStyle(Color(pinHex: "1A0633"))
        }
        .rotation3DEffect(.degrees(rotation), axis: (x: 0, y: 1, z: 0))
        .shadow(color: ArcadeTokens.gold.opacity(0.5), radius: 6)
        .onAppear {
            if spinning {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
        }
    }
}

// MARK: - Floating Badges Background
//
// Mirrors web FloatingBadges.tsx: dozens of pins drift up while slowly
// rotating. Density (55 mobile) and atmospheric opacity make it read as
// background, not content. INK_DARKEST base + soft center vignette.

private struct FloatingBadgesBackground: View {
    private struct FloatingBadge: Identifiable {
        let id: Int
        let assetName: String
        let xPct: CGFloat
        let yStart: CGFloat
        let yEnd: CGFloat
        let size: CGFloat
        let duration: Double
        let delay: Double
        let rotationStart: Double
        let rotationDelta: Double
    }

    private static let pool: [String] = [
        "any_gvc_1759173799963",
        "full_send_maverick_1759173982959",
        "funky_fresh_1759174001274",
        "gradient_lover_1759173808918",
        "visooor_enjoyooor_1759174010233",
        "ladies_night_1759173991853",
        "multi_type_master_1759173898608",
        "vibetown_social_club_1759173960008",
        "plastic_lover_1759173806081",
        "hail_mary_heroes_1759173953534",
        "pothead_1759173827603",
        "rainbow_boombox_1759173875165",
        "checkmate_1759173863329",
        "fur_the_win_1759173969828",
        "poker_face_1759173884906",
        "rainbow_citizen_1759173791000",
        "yin_n_yang_1759173942484",
        "science_goggles_1759173835714",
        "doge_1759173842640",
        "captain_1759173895611",
        "gamer_1759173856821",
        "pepe_1759173846260",
        "mountain_goat_1759174026593",
        "surfer_1759173830462",
        "astro_balls_1759173838889",
        "gold_member_1759173793799",
        "king_1759173882056",
        "rainbow_visor_1759173849941",
        "lamp_1759173892925",
        "one_of_one_1771354994630",
        "electric_rings_1759173878797",
        "sugar_rush_1759173860105",
        "stone_1759173815165",
    ]

    private let badges: [FloatingBadge]
    private let startDate = Date()

    init(count: Int = 55) {
        var seed = SystemRandomNumberGenerator()
        var arr: [FloatingBadge] = []
        for i in 0..<count {
            let asset = Self.pool[i % Self.pool.count]
            let rotStart = Double.random(in: 0...360, using: &seed)
            let rotDelta = (Bool.random(using: &seed) ? 90.0 : -90.0)
            // Production-tuned ranges (mirror FloatingBadges.tsx):
            //   x:        -10..110%   (slight overscan)
            //   yStart:   1.10..2.10  vh (start below the fold)
            //   yEnd:    -0.40..-0.80 vh (exit off the top)
            //   size:     60..160 px (mobile)
            //   duration: 20..60 s
            //   delay:   -60..0  s (so animation feels seeded mid-flight)
            arr.append(FloatingBadge(
                id: i,
                assetName: asset,
                xPct: CGFloat.random(in: -0.10...1.10, using: &seed),
                yStart: CGFloat.random(in: 1.10...2.10, using: &seed),
                yEnd: CGFloat.random(in: -0.80 ... -0.40, using: &seed),
                size: CGFloat.random(in: 60...160, using: &seed),
                duration: Double.random(in: 20...60, using: &seed),
                delay: Double.random(in: -60.0...0.0, using: &seed),
                rotationStart: rotStart,
                rotationDelta: rotDelta
            ))
        }
        badges = arr
    }

    var body: some View {
        ZStack {
            // Vibrant purple base — matches web PURPLE_BG (#7B3FA8) exactly.
            // No darkening overlay; the pin wall should sit on saturated
            // purple just like the web landing.
            ArcadeTokens.purpleBG

            GeometryReader { geo in
                TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { ctx in
                    let now = ctx.date.timeIntervalSince(startDate)
                    ZStack {
                        ForEach(badges) { badge in
                            badgeView(badge, geoSize: geo.size, now: now)
                        }
                    }
                }
            }

            // Soft center-readable vignette — matches web's
            //   radial-gradient(circle at center, transparent 28%, rgba(60,20,90,0.28) 100%)
            // Just enough to anchor the foreground without dimming the wall.
            RadialGradient(
                colors: [
                    .clear,
                    PinHex("3c145a").opacity(0.28),
                ],
                center: .center,
                startRadius: 80,
                endRadius: 700
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private func badgeView(_ b: FloatingBadge, geoSize: CGSize, now: TimeInterval) -> some View {
        let raw = (now + b.delay) / b.duration
        let progress = CGFloat(raw - floor(raw))
        let yNorm = b.yStart + (b.yEnd - b.yStart) * progress
        let rot = b.rotationStart + b.rotationDelta * Double(progress)

        let x = b.xPct * geoSize.width
        let y = yNorm * geoSize.height

        return Image(b.assetName)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: b.size, height: b.size)
            .clipShape(Circle())
            // Web boxShadow: 0 8px 22px rgba(0,0,0,0.55)
            .shadow(color: .black.opacity(0.55), radius: 11, y: 8)
            .rotationEffect(.degrees(rot))
            .position(x: x, y: y)
            // Full opacity — web doesn't dim badges, they're meant to read clearly
    }
}

// MARK: - Preview

#Preview {
    LandingView(
        onStartClassic: {},
        onStartDaily: {},
        onOpenPinBook: {},
        onOpenLeaderboard: {},
        onOpenAchievements: {},
        capsuleCount: 3,
        pinsCollected: 17,
        classicPlays: 4,
        streak: 7
    )
}
