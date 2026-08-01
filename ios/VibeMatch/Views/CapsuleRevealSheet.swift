import SwiftUI

/// Modal sheet that reveals the pins inside a batch of capsules. Each
/// capsule animates from sealed → cracked → pin revealed in sequence.
/// Plays the Pin Drop celebration treatment when a new pin is added to
/// the player's collection.
struct CapsuleRevealSheet: View {
    let revealedPins: [Badge]
    var onDone: () -> Void

    @State private var visibleIndex: Int = 0
    @State private var entryScale: CGFloat = 0.5
    @State private var glow: Double = 0.0

    var body: some View {
        ZStack {
            // Background ink + grid
            PinDropBackground()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Button { onDone() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(VibeColors.textSecondary)
                            .frame(width: 40, height: 40)
                    }
                    Spacer()
                    VStack(spacing: 2) {
                        Text("PIN CAPSULES")
                            .font(.system(size: 18, weight: .black, design: .rounded))
                            .tracking(3)
                            .foregroundStyle(VibeColors.textPrimary)
                        Text("\(revealedPins.count) Cracked")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(VibeColors.textSecondary)
                    }
                    Spacer()
                    Color.clear.frame(width: 40, height: 40)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)

                Spacer()

                // Pin grid that fills in one-by-one
                LazyVGrid(columns: gridColumns, spacing: 16) {
                    ForEach(Array(revealedPins.enumerated()), id: \.offset) { index, pin in
                        revealedPinCard(pin: pin, isVisible: index <= visibleIndex)
                    }
                }
                .padding(.horizontal, 20)

                Spacer()

                Button(action: onDone) {
                    Text(visibleIndex >= revealedPins.count - 1 ? "Done" : "Reveal all")
                        .font(.system(size: 16, weight: .black))
                        .tracking(1)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(
                                    LinearGradient(
                                        colors: [VibeColors.primaryLight, VibeColors.primary],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .shadow(color: VibeColors.primaryDeep.opacity(0.6), radius: 0, y: 4)
                        )
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 30)
                .onTapGesture {
                    if visibleIndex < revealedPins.count - 1 {
                        revealAllRemaining()
                    }
                }
            }
        }
        .onAppear { startReveal() }
    }

    // MARK: - Layout

    private var gridColumns: [GridItem] {
        let count = revealedPins.count
        if count <= 4 {
            return Array(repeating: GridItem(.flexible(), spacing: 16), count: count)
        } else if count <= 9 {
            return Array(repeating: GridItem(.flexible(), spacing: 16), count: 3)
        } else {
            return Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)
        }
    }

    private func revealedPinCard(pin: Badge, isVisible: Bool) -> some View {
        ZStack {
            // Tier-glow halo
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(pinHex: pin.tier.colorHex).opacity(isVisible ? 0.6 : 0), .clear],
                        center: .center,
                        startRadius: 4,
                        endRadius: 60
                    )
                )

            // Pin art
            Image(pin.assetName)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 64, height: 64)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .strokeBorder(Color(pinHex: pin.tier.colorHex), lineWidth: 2.5)
                )
                .shadow(color: Color(pinHex: pin.tier.colorHex).opacity(0.6), radius: 12)

            // Capsule overlay while not yet revealed
            if !isVisible {
                Image(systemName: "capsule.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(VibeColors.primary)
                    .rotationEffect(.degrees(-25))
                    .opacity(0.85)
            }
        }
        .frame(height: 88)
        .scaleEffect(isVisible ? 1.0 : 0.7)
        .opacity(isVisible ? 1.0 : 0.4)
        .animation(.spring(response: 0.4, dampingFraction: 0.65), value: isVisible)
    }

    // MARK: - Reveal Timing

    private func startReveal() {
        guard !revealedPins.isEmpty else { return }
        visibleIndex = 0
        let interval: TimeInterval = 0.35
        for i in 1..<revealedPins.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * interval) {
                if visibleIndex < i { visibleIndex = i }
            }
        }
    }

    private func revealAllRemaining() {
        visibleIndex = max(visibleIndex, revealedPins.count - 1)
    }
}

// Color(pinHex:) lives in Views/Components/ArcadeUI.swift
