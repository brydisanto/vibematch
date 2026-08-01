import UIKit

// MARK: - AvatarStore

/// Handles filesystem persistence of the player's custom avatar image.
///
/// Stored as a JPEG in the app's Documents directory at `avatar.jpg`.
/// UserDefaults is unsuitable for image data — even a modest avatar (~200KB)
/// inflates every profile read/write.
enum AvatarStore {

    /// Maximum dimension of the stored avatar. Larger uploads are downscaled.
    private static let maxDimension: CGFloat = 512

    /// JPEG compression quality (0.0-1.0). 0.85 is the sweet spot: visually
    /// indistinguishable from the source, ~1/4 the file size.
    private static let compressionQuality: CGFloat = 0.85

    private static var avatarURL: URL? {
        guard let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }
        return docsDir.appendingPathComponent("avatar.jpg")
    }

    // MARK: - Save

    /// Saves an image as the player's avatar. Downscales to fit `maxDimension`
    /// and compresses as JPEG. Returns true on success.
    @discardableResult
    static func save(_ image: UIImage) -> Bool {
        guard let url = avatarURL else { return false }

        let resized = downscale(image, maxDimension: maxDimension)
        guard let data = resized.jpegData(compressionQuality: compressionQuality) else {
            return false
        }

        do {
            try data.write(to: url, options: .atomic)
            return true
        } catch {
            print("[AvatarStore] Failed to save avatar: \(error)")
            return false
        }
    }

    // MARK: - Load

    /// Loads the saved avatar, if any.
    static func load() -> UIImage? {
        guard let url = avatarURL,
              FileManager.default.fileExists(atPath: url.path),
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        return UIImage(data: data)
    }

    /// Whether an uploaded avatar exists on disk.
    static var hasAvatar: Bool {
        guard let url = avatarURL else { return false }
        return FileManager.default.fileExists(atPath: url.path)
    }

    // MARK: - Delete

    /// Removes the stored avatar.
    @discardableResult
    static func clear() -> Bool {
        guard let url = avatarURL,
              FileManager.default.fileExists(atPath: url.path) else {
            return true
        }
        do {
            try FileManager.default.removeItem(at: url)
            return true
        } catch {
            print("[AvatarStore] Failed to clear avatar: \(error)")
            return false
        }
    }

    // MARK: - Helpers

    /// Downscales an image so its largest dimension equals `maxDimension`.
    /// Preserves aspect ratio; returns the original if it's already small enough.
    private static func downscale(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let longest = max(size.width, size.height)
        guard longest > maxDimension else { return image }

        let scale = maxDimension / longest
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
