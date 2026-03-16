import Foundation
import Observation

// MARK: - App View

/// The top-level navigation destinations in the app.
enum AppView: String, Codable, Hashable, Sendable {
    case landing
    case playing
    case collection
    case trading
}

// MARK: - Authentication State

/// The player's authentication status.
enum AuthState: Codable, Hashable, Sendable {
    case unauthenticated
    case authenticating
    case authenticated(playerID: String)

    var isAuthenticated: Bool {
        if case .authenticated = self { return true }
        return false
    }

    var playerID: String? {
        if case .authenticated(let id) = self { return id }
        return nil
    }
}

// MARK: - Player Profile

/// Basic player profile information stored locally.
struct PlayerProfile: Codable, Sendable {
    var displayName: String
    var avatarID: String?
    var highScore: Int
    var gamesPlayed: Int
    var collection: BadgeCollection
    var chests: [Chest]
    var achievements: [PlayerAchievement]

    static let empty = PlayerProfile(
        displayName: "Player",
        avatarID: nil,
        highScore: 0,
        gamesPlayed: 0,
        collection: BadgeCollection(),
        chests: [],
        achievements: []
    )
}

// MARK: - App Settings

/// User-configurable settings persisted to UserDefaults.
struct AppSettings: Codable, Sendable {
    /// Sound effects volume (0.0 to 1.0).
    var sfxVolume: Double

    /// Background music volume (0.0 to 1.0).
    var musicVolume: Double

    /// Whether haptic feedback is enabled.
    var hapticsEnabled: Bool

    static let defaults = AppSettings(
        sfxVolume: 0.8,
        musicVolume: 0.5,
        hapticsEnabled: true
    )
}

// MARK: - App State

/// The root observable state for the entire application.
/// Injected into the SwiftUI environment so all views can access
/// shared app-level state.
@Observable
final class AppState {
    /// Which top-level view is currently displayed.
    var currentView: AppView = .landing

    /// The current player's profile and collection data.
    var playerProfile: PlayerProfile = .empty

    /// User-configurable settings.
    var settings: AppSettings = .defaults

    /// Authentication status.
    var authState: AuthState = .unauthenticated

    /// The active game state, if a game is in progress.
    var activeGame: GameState?

    // MARK: - Navigation

    /// Navigate to a new top-level view.
    func navigate(to view: AppView) {
        currentView = view
    }

    // MARK: - Persistence

    private static let settingsKey = "app_settings"
    private static let profileKey = "player_profile"

    /// Save settings and profile to UserDefaults.
    func save() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(settings) {
            UserDefaults.standard.set(data, forKey: Self.settingsKey)
        }
        if let data = try? encoder.encode(playerProfile) {
            UserDefaults.standard.set(data, forKey: Self.profileKey)
        }
    }

    /// Load settings and profile from UserDefaults.
    func load() {
        let decoder = JSONDecoder()
        if let data = UserDefaults.standard.data(forKey: Self.settingsKey),
           let decoded = try? decoder.decode(AppSettings.self, from: data) {
            settings = decoded
        }
        if let data = UserDefaults.standard.data(forKey: Self.profileKey),
           let decoded = try? decoder.decode(PlayerProfile.self, from: data) {
            playerProfile = decoded
        }
    }
}
