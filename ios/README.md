# VibeMatch iOS

Native iOS match-3 game built with SwiftUI and SpriteKit.

## Requirements

- Xcode 15.0+
- iOS 17.0+ deployment target
- Swift 5.9

## Setup

### Option A: XcodeGen (recommended)

1. Install XcodeGen:
   ```bash
   brew install xcodegen
   ```

2. Generate the Xcode project:
   ```bash
   cd ios
   xcodegen generate
   ```

3. Open the project:
   ```bash
   open VibeMatch.xcodeproj
   ```

### Option B: Swift Package

Open the `VibeMatch` folder directly in Xcode as a Swift Package:

```bash
open ios/VibeMatch
```

## Project Structure

```
ios/
  project.yml              # XcodeGen project spec
  VibeMatch/
    Package.swift           # Swift Package Manager manifest
    Info.plist              # App configuration
    App/                    # App entry point
    Views/                  # SwiftUI views
    Engine/                 # Game engine logic
    Models/                 # Data models
    State/                  # Game state management
    SpriteKit/              # SpriteKit scenes and nodes
    Audio/                  # Audio engine
    Collection/             # Collection system
    Resources/
      Assets.xcassets/      # Image assets
      Colors.xcassets/      # Brand color definitions
```

## Brand Colors

| Name            | Hex       | Usage              |
|-----------------|-----------|-------------------|
| AccentColor     | `#6C5CE7` | Electric Lavender |
| BackgroundColor | `#1A1A2E` | Deep Indigo       |
| CardBackground  | `#3D3A50` | Card surfaces     |
