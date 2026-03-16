import SwiftUI

/// The main entry point for the VibeMatch iOS application.
@main
struct VibeMatchApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
        }
    }
}

/// Placeholder root view. Will be replaced by the navigation router
/// once view modules are built out.
struct ContentView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            switch appState.currentView {
            case .landing:
                Text("VibeMatch")
                    .font(.largeTitle.bold())
            case .playing:
                Text("Game Board")
            case .collection:
                Text("Badge Collection")
            case .trading:
                Text("Trading Post")
            }
        }
    }
}
