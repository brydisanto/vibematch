# VibeMatch - Agent Handoff Documentation

Welcome to **VibeMatch**, a modern, responsive, highly-polished Match-3 puzzle game built with the Next.js App Router, Tailwind CSS 4, Framer Motion, and the Web Audio API.

This document serves as a guide for AI agents and developers jumping into the codebase to understand its architecture, design decisions, and state management.

---

## 🎯 Project Overview
VibeMatch is heavily inspired by titles like *Royal Match* and *Candy Crush*, blending snappy interactions, robust cascading combo mechanics, and highly stylized UI components. It features both a **Classic Mode** (survival) and a **Daily Mode** (seeded RNG for global leaderboards).

### Key Features:
- **Immersive Visuals:** Enamel pin-styled badges, dynamic combo fire effects, screen shakes, edge glows, and particle bursts powered by Framer Motion.
- **Procedural Audio:** A custom Web Audio API engine (`lib/sounds.ts`) that generates escalating synths, explosions, and a 4-chord chillwave background loop entirely from scratch without external audio files.
- **Robust Engine:** A pure TypeScript logic core (`lib/gameEngine.ts`) that perfectly separates state and rendering, handling 3-match, 4-match (bombs), 5-match (cosmic blasts), and cross-matches (vibestreaks).
- **Mobile-First Layout:** The game board uses a strict `aspect-square` calculation derived from viewport minimums (`vmin`/`vh`/`vw` math) to ensure perfect rendering across all mobile and desktop screens without squishing or clipping.

---

## 🏗️ Architecture & Stack

- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind CSS 4, CSS Modules/Globals
- **Animation:** Framer Motion (`AnimatePresence`, `layout`, spring physics)
- **Language:** TypeScript
- **Audio:** Native Web Audio API (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`)

---

## 📂 Directory Structure

### `src/app/`
- **`page.tsx`**: The main entry point. It manages the global view state (`landing` vs `playing`), renders the HUD and GameBoard, and handles complex flexbox spatial calculations to ensure the board remains square on mobile securely.
- **`globals.css`**: Contains custom Tailwind utilities, critical animation keyframes (like `board-shake`, `combo-fire`), and specific CSS resets.

### `src/components/`
- **`GameBoard.tsx`**: The core interactive grid. It maps the `Cell[][]` state from the engine to `motion.button` tiles. It is responsible for rendering special tile overlays (Bombs, Cosmic Blasts), triggering Match Particle Effects, and resolving floating scoring text.
- **`GameHUD.tsx`**: The Heads-Up Display showing Score, Moves, and Combos. Designed with pseudo-3D "enamel" card aesthetics. It can conditionally split into Top (Metrics) and Bottom (High Scores) sections for mobile.
- **`LandingPage.tsx`**: The primary menu, handling username inputs, mode selection, and launching the game sequence.
- **`GameOver.tsx`, `InstructionsModal.tsx`, `LeaderboardModal.tsx`**: State-driven overlay components.

### `src/lib/` (The Brains)
- **`gameEngine.ts`**: The pure-logic Match-3 engine. It knows nothing about React.
  - Implements `createBoard`, `swapTiles`, `findAllMatches`, `applyGravity`, and the complex `processTurn` which calculates cascades recursively.
  - Generates `SpecialTileType` mutations ("bomb", "vibestreak", "cosmic_blast").
- **`useGame.ts`**: The React glue. It wraps `gameEngine` in `useState`, handling asynchronous delays for animations, dispatching sounds from `sounds.ts`, and orchestrating Haptic Feedback (`navigator.vibrate()`). It manages the lifecycle of the `scorePopups` array.
- **`sounds.ts`**: The procedural Sound Engine. 
  - Exposes hooks for escalating combo pitches, bomb rumbles, and cascade sparkles via oscillators (sine, square, sawtooth, triangle).
  - Maintains the `startBGM()` loop (a slow, detuned sweeping chord progression) and a global `isMuted` toggle state.
- **`badges.ts`**: Contains the inventory of tiles ("badges"), their point multipliers by tier (Blue, Silver, Gold, Cosmic), and the seeded Random Number Generator logic used for Daily Mode.

---

## 🛠️ Common Workflows & Gotchas

### 1. Board Aspect Ratio (The CSS vs React Fight)
Mobile browsers notoriously struggle with `aspect-ratio: 1/1` within `flex-grow` / `flex-shrink` columns when vertical space is constrained. 
- **Solution:** In `page.tsx`, the GameBoard container uses an explicit inline sizing calculation:
  `height: "min(100vw - 16px, calc(100vh - 280px), 680px)"`
  This guarantees the board takes the maximum possible safe space *without* exceeding its container or warping its square shape. Never default back to `h-full w-full aspect-square` without these bounds.

### 2. Rendering Floating Scores
Floating scores (`+150`) during cascades are rendered by `GameBoard.tsx` mapping over the `scorePopups` array. 
- **Gotcha:** `useGame.ts` regulates *when* these are added. To prevent overlap when massive combo texts (e.g. "ULTRA!!") appear on screen, `useGame.ts` limits standard yellow score popups to `intensity === "normal"` triggers only.

### 3. Procedural Audio Engine
Because `sounds.ts` relies on `window.AudioContext`, you must wrap interactions in user-gestures to prevent the browser from blocking audio playback. `startBGM()` is successfully triggered directly from the `handleStartGame` click event in `page.tsx`.

### 4. Special Tile Application
Special tiles trigger sequentially. If a player matches a Bomb, `gameEngine.ts` handles the immediate removal. If a player *clicks* a bomb directly, `triggerSpecialTile` is invoked, which simulates an artificial match center on the clicked tile, blowing up adjacent tiles and initiating standard gravity sweeps.

---

## 🚀 Adding New Features
If an agent is requested to add a new game element (e.g. "Ice Blocks" or a new "Special Badge"), they should:
1. Update `Cell` interfaces in `gameEngine.ts` to include the new boolean state.
2. Update `processTurn` and `applyGravity` in `gameEngine.ts` to handle the logic.
3. Update `GameBoard.tsx` to render the visual SVG/image overlay for the new state.
4. Update `sounds.ts` to add a new bespoke synth method for the new mechanic.
