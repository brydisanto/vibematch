# VibeMatch Project Handoff

Welcome to **VibeMatch**, a fast-paced, match-3 web game built with Next.js, React, and Tailwind CSS.

## Project Origin & Purpose
VibeMatch was created as a high-fidelity, highly polished puzzle game playable directly in the browser. It features:
- A custom 6x6 grid where players match 3 or more badges to score points.
- Complex chain-reaction physics (cascades) and animated score popups.
- Full retro-themed audio design (BGM and SFX via Web Audio API).
- Global cross-device authentication and cloud leaderboard synchronizing.

## Current State
The game is fully playable and deployed to Vercel production (`vibematch.gg`).
- **Core Loop:** 100% complete. Game correctly identifies adjacent swaps, processes matches, handles cascades, drops new pieces, and decrements moves.
- **Game Modes:** 
  - **Classic**: 30 moves, play as many times as you want.
  - **Daily Challenge**: 1 strict attempt per day per user account, with a locked seed so everyone gets the same board.
- **Leaderboards**: Fully operational. Split into All Time (Classic), Weekly (Classic re-sets), and Daily Challenge.
- **Authentication**: Fully working custom system utilizing cookies (`auth.ts`) and `@vercel/kv` for database storage. Guest users can log in from the Game Over screen to instantly publish their score.

## Development Setup
This absolute minimum requirements to spin the app up locally:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   You will need to pull the `.env.local` variables from Vercel. These include your `KV_REST_API_URL` and `KV_REST_API_TOKEN` which are required to run the database wrapper locally.
   
3. **Run Dev Server:**
   ```bash
   npm run dev
   ```
   **Known Local Network Bug:** If you run this on a macOS environment using Node 18+ and experience 20-30 second hangs when contacting the database, it's due to a known IPv6 loopback routing issue. We've patched this by adding `dns.setDefaultResultOrder('ipv4first')` manually in `/scripts/dev.sh` and `next.config.js`.

## Deployment
VibeMatch is hosted on Vercel. Pushing to the `main` branch automatically triggers a production deployment. 

The application utilizes Edge Network features heavily. We use `Cache-Control: public, s-maxage=15, stale-while-revalidate=60` headers on API endpoints to serve data instantly and perform background reconnections to the KV store. If you modify database fields, remember that it may take up to 60 seconds for the edge cache to flush.

## Next Steps / Roadmap Ideas
- Explore building the locked "$VIBESTR RUSH" game mode.
- Adding actual Web3 integrations or user-mintable items.
- Adding additional particle effects or soundpacks.

If jumping into this project as a new developer, start by reviewing `ai-context.md` (or `claude.md`) for deep-dive technical conventions and system diagrams.
