import SwiftUI
import PhotosUI

// MARK: - AvatarPickerView

/// Tappable avatar that lets the player upload a profile picture via PhotosPicker.
/// Falls back to a default silhouette + initial when no avatar is set.
///
/// Usage:
/// ```swift
/// AvatarPickerView(size: 80)
///     .environment(appState)
/// ```
struct AvatarPickerView: View {
    @Environment(AppState.self) private var appState

    /// Rendered diameter in points.
    var size: CGFloat = 80

    /// Optional ring color around the avatar (brand accent).
    var ringColor: Color = Color(red: 108/255, green: 92/255, blue: 231/255) // lavender

    @State private var pickerItem: PhotosPickerItem?
    @State private var isLoading = false
    @State private var loadError: String?

    var body: some View {
        PhotosPicker(
            selection: $pickerItem,
            matching: .images,
            photoLibrary: .shared()
        ) {
            avatarContent
        }
        .onChange(of: pickerItem) { _, newItem in
            guard let newItem else { return }
            Task { await loadImage(from: newItem) }
        }
        .alert("Couldn't load image", isPresented: Binding(
            get: { loadError != nil },
            set: { if !$0 { loadError = nil } }
        )) {
            Button("OK", role: .cancel) { loadError = nil }
        } message: {
            Text(loadError ?? "")
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var avatarContent: some View {
        ZStack {
            Circle()
                .fill(Color(red: 26/255, green: 5/255, blue: 51/255)) // deep cosmic purple
                .frame(width: size, height: size)

            if let image = appState.avatarImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                // Fallback: first letter of display name over a gradient silhouette
                Text(initial)
                    .font(.system(size: size * 0.4, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.85))
            }

            Circle()
                .strokeBorder(ringColor, lineWidth: 2)
                .frame(width: size, height: size)

            if isLoading {
                Circle()
                    .fill(Color.black.opacity(0.5))
                    .frame(width: size, height: size)
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
            }

            // Camera badge in the corner to signal "tap to change"
            Image(systemName: "camera.fill")
                .font(.system(size: size * 0.18, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: size * 0.3, height: size * 0.3)
                .background(
                    Circle().fill(ringColor)
                )
                .offset(x: size * 0.32, y: size * 0.32)
        }
    }

    private var initial: String {
        let name = appState.playerProfile.displayName
        return name.first.map { String($0).uppercased() } ?? "?"
    }

    // MARK: - Image Loading

    private func loadImage(from item: PhotosPickerItem) async {
        isLoading = true
        defer { isLoading = false }

        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                loadError = "That file isn't a supported image format."
                pickerItem = nil
                return
            }
            let success = await MainActor.run { appState.setAvatar(image) }
            if !success {
                loadError = "Couldn't save the image. Try a different one."
            }
            pickerItem = nil
        } catch {
            loadError = error.localizedDescription
            pickerItem = nil
        }
    }
}

// MARK: - Preview

#Preview {
    let appState = AppState()
    return AvatarPickerView(size: 120)
        .environment(appState)
        .padding()
        .background(Color(red: 0.1, green: 0.05, blue: 0.2))
}
