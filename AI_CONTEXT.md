# VibeMatch Technical AI Context

This file serves as the system architecture prompt (`claude.md` or `.cursorrules` equivalent) for any AI agent modifying the **VibeMatch** codebase.

## 1. Tech Stack Overview
- **Framework:** Next.js 14+ (App Router).
- **Styling:** Tailwind CSS with extensive use of arbitrary values (e.g. `w-[320px]`, `bg-[#111]`) and complex gradient overlays.
- **Animations:** Framer Motion (`framer-motion`) handles all modal pop-ins, score particle effects, match combos, and flying tiles.
- **Icons:** `lucide-react`
- **Database:** Vercel KV (`@vercel/kv`), essentially a serverless Redis, handles authentication tokens, profile data, and leaderboards.

## 2. Directory Structure & Key Files
- `src/app/page.tsx`: The primary App View controller. It manages transitions between `LandingPage`, `GameBoard`, and `GameOver`. It holds the global `useGame()` instance and the `userProfile` session state.
- `src/lib/gameEngine.ts`: The absolute brain of the game. It controls pure logic, grid creation, swap validation, pathfinding for 3-in-a-row matches, recursive cascade detection, and score multiplication. It has **zero React dependencies** intentionally.
- `src/lib/useGame.ts`: The React hook bridge. It consumes `gameEngine.ts`, manages the `useState` transition timings, pushes floating "Score Popups" into the DOM, and fires sound effects.
- `src/lib/badges.ts`: The dictionary of all valid game pieces (badges), their image URLs, their tier (blue, silver, gold, cosmic), and point multipliers.
- `src/components/GameBoard.tsx` & `Tile.tsx`: The visual presentation layer of the grid. `Tile.tsx` relies heavily on absolute positioning and CSS transitions via Framer Motion to slide pieces into place (e.g., swapping or dropping from above).

## 3. Database & Authentication
- **Auth Flow:** The app uses a custom roll-your-own JWT-style encrypted cookie. `src/lib/auth.ts` exports `encrypt`/`decrypt` and `hashPassword` (using Web Crypto API padding limits for Edge compatibility—do not switch this to bcrypt, it will break on Vercel Edge).
- **Cookies:** `cookie_vibematch_session` stores the logged-in username. `POST /api/auth/session` reads this.
- **KV Storage Keys:**
  - `user_auth:{username}`: Stores user credentials and hash.
  - `user:{username}`: Stores public display name and `avatarUrl`.
  - `classic_leaderboard`: Global sorted set (ZSET) of all-time scores.
  - `classic_weekly:{monday_date}`: Weekly rolling ZSET of high scores.
  - `daily_leaderboard:{iso_date}`: Daily challenge ZSET.
  - `daily_played:{username}:{iso_date}`: Boolean flag enforcing the 1-play per day constraint.

## 4. Known Gotchas & Quirks
- **Vercel Edge Caching:** Next.js routes under `src/app/api/` heavily utilize `Cache-Control: public, s-maxage=15, stale-while-revalidate=60`. Because of this, if a user updates their profile and you immediately render `LeaderboardModal`, the server will serve the *cached* old avatar. **DO NOT REMOVE THE CACHE.** Instead, use Optimistic UI (e.g., injecting the local user's active avatar state over their leaderboard row) as done in `LeaderboardModal.tsx`.
- **Node.js Local DNS Bug:** If working locally on macOS, `fetch()` calls to Vercel KV might hang for exactly 20-30 seconds. This is an IPv6 routing bug in Node 18+. To bypass this in development, `next.config.js` manually invokes `dns.setDefaultResultOrder('ipv4first')`. 
- **Audio Context on iOS/Safari:** All sounds use `src/lib/sounds.ts` which orchestrates Web Audio API oscillators and buffers. iOS **strictly requires** audio layers to be unlocked via a direct user-interaction (a raw `onClick`). Always call `unlockAudio()` in the topmost click handler before triggering state changes that eventually generate sound.
- **Image Preloading:** `LandingPage.tsx` features a silent background loop `new window.Image().src = badge.image` which downloads all 100+ assets into the browser cache within 1 second of visiting the site. If you add new game assets, ensure they route through `badges.ts` so they inherit this zero-latency loading.

## 5. UI Philosophy
- Do not use generic, flat buttons. VibeMatch leverages deep, multi-layered "enamel pin" styling. 
- Elements should have rich outer glowing drop shadows, inner highlights, and a gradient background. Check `HudCard` in `GameHUD.tsx` or the Mode select buttons in `LandingPage.tsx` for reference.
- Any new features must respect the retro, highly tactile design language. 

By reading this document, you are ready to modify, debug, or extend VibeMatch. Good luck.
