# Pin Drop iOS

Native iOS port of Pin Drop, the Good Vibes Club match-3 game live at [vibematch.app](https://vibematch.app). SwiftUI for chrome, SpriteKit for the board.

> The on-disk directory and Swift module are still named `VibeMatch` to keep imports stable. The Xcode target, bundle ID, and display name all read **Pin Drop**.

## Requirements

- Xcode 15.0 or later
- iOS 17.0 deployment target
- Swift 5.9

## Setup

### XcodeGen (recommended)

```bash
brew install xcodegen
cd ios
xcodegen generate
open PinDrop.xcodeproj
```

### Swift Package (read-only sanity check)

```bash
open ios/VibeMatch
```

## Layout

```
ios/
  project.yml              XcodeGen spec, produces PinDrop.xcodeproj
  README.md
  VibeMatch/               Swift source root (module name retained)
    Package.swift          PinDrop SPM manifest
    Info.plist             App configuration
    App/                   Entry point + AppState
    Views/                 SwiftUI screens
    Engine/                Game engine + pin catalog
    Models/                Cell, Match, GameState, TurnResult, Position, Badge
    State/                 GameSession
    SpriteKit/             SKScene + TileNode + EffectsLayer
    Audio/                 AVAudioEngine + Core Haptics
    Collection/            Pin Book + capsule + achievements
    Resources/
      Assets.xcassets/     Pin art, logos, launch image
      Colors.xcassets/     Brand color definitions
```

## Brand palette

| Token          | Hex       | Usage                              |
|----------------|-----------|------------------------------------|
| `background`   | `#0a0418` | App background (INK_DARKEST)       |
| `primary`      | `#FFE048` | GOLD primary CTA, score, capsule   |
| `primaryLight` | `#FFF4B0` | Highlights, gradient tops          |
| `primaryDeep`  | `#8B6914` | Chunky-button bottom shadow        |
| `cosmic`       | `#B366FF` | Daily challenge, secondary CTAs    |
| `cosmicDeep`   | `#6B1FC0` | Cosmic depth shadow                |
| `orange`       | `#FF5F1F` | Streak, alerts, hero bottom bloom  |

See `Views/Components/VibeColors.swift` for canonical definitions.

## Parity targets

The iOS app aims to match production web fidelity in:

- 101-pin catalog across 5 tiers (Common 19, Rare 51, Special 9, Legendary 19, Cosmic 3)
- Power tiles → Bomb, Laser Party, Cosmic Blast
- Capsule rewards at 15K / 30K / 50K thresholds plus bonus shape capsule
- Daily Challenge with seeded board
- Cross-turn combo carry
- Server-authoritative replay via MoveAction log
