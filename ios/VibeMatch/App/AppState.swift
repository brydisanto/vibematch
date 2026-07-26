import Foundation
import Observation
import UIKit

// MARK: - App View

/// The top-level navigation destinations in the app.
enum AppView: String, Codable, Hashable, Sendable {
    case landing
    case playing
    case collection
    case trading
    case levelMap
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
    /// Whether the player has uploaded a custom avatar image.
    /// The image itself lives on disk via `AvatarStore`; this flag persists
    /// the achievement-bearing state even if the image file is later removed.
    var hasUploadedAvatar: Bool
    var highScore: Int
    var gamesPlayed: Int
    var collection: BadgeCollection
    var chests: [Chest]
    var achievements: [PlayerAchievement]

    /// Pin Capsules earned but not yet cracked open. Surfaced in the HUD
    /// badge count and the Pin Book "capsules waiting" banner.
    var unopenedCapsules: [PinCapsule]

    /// Current consecutive-day play streak.
    var streak: Int

    /// Calendar day the streak was last advanced. Nil before first play.
    var lastPlayDate: Date?

    static let empty = PlayerProfile(
        displayName: "Player",
        avatarID: nil,
        hasUploadedAvatar: false,
        highScore: 0,
        gamesPlayed: 0,
        collection: BadgeCollection(),
        chests: [],
        achievements: [],
        unopenedCapsules: [],
        streak: 0,
        lastPlayDate: nil
    )

    // Backward-compat: if an older profile is decoded without hasUploadedAvatar,
    // default it to false.
    init(
        displayName: String,
        avatarID: String? = nil,
        hasUploadedAvatar: Bool = false,
        highScore: Int = 0,
        gamesPlayed: Int = 0,
        collection: BadgeCollection = BadgeCollection(),
        chests: [Chest] = [],
        achievements: [PlayerAchievement] = [],
        unopenedCapsules: [PinCapsule] = [],
        streak: Int = 0,
        lastPlayDate: Date? = nil
    ) {
        self.displayName = displayName
        self.avatarID = avatarID
        self.hasUploadedAvatar = hasUploadedAvatar
        self.highScore = highScore
        self.gamesPlayed = gamesPlayed
        self.collection = collection
        self.chests = chests
        self.achievements = achievements
        self.unopenedCapsules = unopenedCapsules
        self.streak = streak
        self.lastPlayDate = lastPlayDate
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        displayName = try c.decode(String.self, forKey: .displayName)
        avatarID = try c.decodeIfPresent(String.self, forKey: .avatarID)
        hasUploadedAvatar = try c.decodeIfPresent(Bool.self, forKey: .hasUploadedAvatar) ?? false
        highScore = try c.decode(Int.self, forKey: .highScore)
        gamesPlayed = try c.decode(Int.self, forKey: .gamesPlayed)
        collection = try c.decode(BadgeCollection.self, forKey: .collection)
        chests = try c.decode([Chest].self, forKey: .chests)
        achievements = try c.decode([PlayerAchievement].self, forKey: .achievements)
        unopenedCapsules = try c.decodeIfPresent([PinCapsule].self, forKey: .unopenedCapsules) ?? []
        streak = try c.decodeIfPresent(Int.self, forKey: .streak) ?? 0
        lastPlayDate = try c.decodeIfPresent(Date.self, forKey: .lastPlayDate)
    }

    // MARK: - Daily Streak

    /// Advances the daily streak for a play happening now. Returns the streak
    /// milestones (3 / 7 / 30 / 100 days) newly reached by this tick so the
    /// caller can award quest capsules. Idempotent within a calendar day.
    mutating func tickStreak(now: Date = .now, calendar: Calendar = .current) -> [Int] {
        let today = calendar.startOfDay(for: now)
        if let last = lastPlayDate {
            let lastDay = calendar.startOfDay(for: last)
            let dayDiff = calendar.dateComponents([.day], from: lastDay, to: today).day ?? 0
            if dayDiff == 0 {
                return []            // already played today — no change
            } else if dayDiff == 1 {
                streak += 1          // consecutive day
            } else {
                streak = 1           // streak broken — restart
            }
        } else {
            streak = 1               // first ever play
        }
        lastPlayDate = today

        let milestones = [3, 7, 30, 100]
        return milestones.contains(streak) ? [streak] : []
    }

    /// Quest capsules awarded for reaching a daily-streak milestone. Higher
    /// milestones grant more capsules; Daily Challenge doubles the haul.
    func streakCapsules(forMilestone days: Int, mode: GameMode) -> [PinCapsule] {
        let base: Int
        switch days {
        case 3:   base = 1
        case 7:   base = 2
        case 30:  base = 3
        case 100: base = 5
        default:  base = 0
        }
        let count = (mode == .daily) ? base * 2 : base
        return (0..<count).map { _ in PinCapsule(trigger: .streak, mode: mode) }
    }
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

    /// The game mode selected when navigating to the playing view.
    var selectedGameMode: GameMode = .classic

    /// The current player's profile and collection data.
    var playerProfile: PlayerProfile = .empty

    /// User-configurable settings.
    var settings: AppSettings = .defaults

    /// Authentication status.
    var authState: AuthState = .unauthenticated

    /// The active game state, if a game is in progress.
    var activeGame: GameState?

    /// Progression manager for levels, XP, energy, and currency.
    let progression = ProgressionManager()

    // MARK: - Navigation

    /// Navigate to a new top-level view.
    func navigate(to view: AppView) {
        currentView = view
    }

    /// Start a game with the given mode. Consumes energy if required.
    /// Returns false if insufficient energy.
    @discardableResult
    func startGame(mode: GameMode) -> Bool {
        guard progression.canPlay(mode: mode) else { return false }
        progression.consumeEnergy(for: mode)
        selectedGameMode = mode
        currentView = .playing
        return true
    }

    /// Start a specific level.
    @discardableResult
    func startLevel(_ levelId: Int) -> Bool {
        return startGame(mode: .level(levelId))
    }

    // MARK: - Avatar

    /// Cached avatar image. Loaded from disk lazily; nil means no custom avatar.
    /// Mutating this triggers @Observable updates so avatar views refresh.
    private(set) var avatarImage: UIImage? = nil

    /// Loads the saved avatar from disk into memory. Call once on app startup.
    func loadAvatar() {
        avatarImage = AvatarStore.load()
    }

    /// Saves a new avatar image. Persists to disk, updates the profile's
    /// hasUploadedAvatar flag, and refreshes the in-memory cache.
    /// Returns true on success.
    @discardableResult
    func setAvatar(_ image: UIImage) -> Bool {
        guard AvatarStore.save(image) else { return false }

        // Reload from disk to get the downscaled/compressed version we actually stored.
        avatarImage = AvatarStore.load()

        if !playerProfile.hasUploadedAvatar {
            playerProfile.hasUploadedAvatar = true
            save()
        }
        return true
    }

    /// Removes the custom avatar. The hasUploadedAvatar flag stays true so
    /// the achievement, once earned, remains earned.
    func clearAvatar() {
        AvatarStore.clear()
        avatarImage = nil
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
