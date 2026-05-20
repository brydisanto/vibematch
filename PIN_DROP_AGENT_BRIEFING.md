# Pin Drop — Agent Briefing

A complete, self-contained reference for any agent working with Pin Drop. Covers how the game works, every mechanic, every reward path, and the constraints around them. Source of truth as of 2026-05-19.

Production URL: https://pindropgame.com
Player game guide (in-app): https://pindropgame.com/game-guide

---

## 1. What Pin Drop Is

Pin Drop is a match-3 puzzle game built around the Good Vibes Club (GVC) Badge IP. Players swap adjacent tiles on an 8x8 grid to match three or more pins of the same type. Successful matches award points, can spawn power tiles, can trigger cascading chain reactions, and pay out Pin Capsules at score milestones. Capsules crack open to reveal one of 101 collectible pins. The full game economy is built around skill-based scoring and a long-term collection chase.

Every "pin" in Pin Drop corresponds to a real GVC Badge from the canonical 101-pin catalog. Inside the game environment they are always referred to as Pins, never Badges.

---

## 2. Game Modes

There are two playable modes.

**Classic**
- Standard mode. Available with 10 free plays per day.
- Players can purchase additional Bonus Games with $VIBESTR (up to 15 more per day, for a hard cap of 25 plays per day).
- 30 moves per game.
- Pays out Pin Capsules based on score thresholds.

**Daily Challenge**
- One identical board for every player worldwide, seeded by the date.
- One attempt per day, no retries. The server locks the player in the moment they start.
- Pure skill comparison. Identical conditions for everyone.
- Pays out double the capsules of Classic mode at the same score thresholds.
- The day's #1 finisher wins a Champion Bonus on top of the standard rewards.
- Resets at noon ET (America/New_York, follows DST).

---

## 3. The Core Loop

Every game runs the same shape.

1. Player starts the game. The board fills with 6 randomly drafted pins from the 101 catalog (one Cosmic, one Legendary, one Silver/Rare, three Commons). Pins of the same type can match each other.
2. Player gets 30 moves. Each move is a swap between two adjacent tiles (up, down, left, or right; no diagonals).
3. If the swap creates a match of 3 or more pins of the same type, those pins clear, the player scores points, and new pins fall in from the top.
4. New pins falling in may form new matches. These are called cascades and stack a multiplier on top of the base score.
5. Matches of 4, 5, or 6+ pins also leave a power tile on the board. Power tiles can be activated later by tapping them or swapping them.
6. Special tile arrangements (L, T, Cross shapes) trigger shape bonuses with their own multipliers.
7. Once 30 moves are spent, or no valid matches remain on the board, the game ends.
8. Final score determines how many Pin Capsules the player earns.

If the swap does not create a match, it reverts for free without costing the move.

If the player stays idle for 8 seconds, the game highlights one valid swap as an idle hint. Fires once per game.

---

## 4. Scoring System

Every match stacks three multipliers: match length, pin tier, and cascade depth. They compound.

### Base score (match length)

| Match | Base score | Side effect |
|---|---|---|
| 3 in a row | 150 | none |
| 4 in a row | 450 | spawns a Bomb power tile |
| 5 in a row | 900 | spawns a Laser Party power tile |
| 6 or more in a row | 900 | spawns a Cosmic Blast power tile |

### Tier multiplier (pin tier)

The multiplier comes from the pin tier being matched. The highest tier in a match determines the multiplier applied.

| Tier | Multiplier |
|---|---|
| Common | 1.0x |
| Silver (Rare) | 1.5x |
| Gold (Legendary) | 2.0x |
| Cosmic | 3.0x |

### Combo multiplier (cascade depth)

Each cascade level adds +100% to the running multiplier on that turn.

| Cascade depth | Multiplier |
|---|---|
| Initial match (no cascade) | 1.0x |
| 1st cascade | 2.0x |
| 2nd cascade | 3.0x |
| 3rd cascade | 4.0x |
| ...and climbing | (1 + cascades) x |

### Cascade flat bonuses

In addition to the multiplier, deep cascades pay flat bonuses on top of the total score for that turn:
- 3 cascades in one turn: +500 flat
- 5 cascades in one turn: +1,000 flat
- 8 cascades in one turn: +2,500 flat

### Shape bonus multipliers

If two separate matches share a tile and form a recognized shape, the entire turn's score is additionally multiplied:

| Shape | Multiplier | Description |
|---|---|---|
| L-Shape | 1.5x | Two lines meet at a shared corner tile |
| T-Shape | 2.5x | A line meets the middle of another |
| Cross | 4.0x | Two lines cross at the middle of both |

T and Cross also each award a free bonus Pin Capsule, capped at 1 bonus capsule per game (only the first T or Cross of the game pays out).

### Combo momentum (cross-turn carry)

End a turn with deep cascades and some momentum carries into the next swap as a head start.

| Cascades ending the turn | Next turn starts at combo |
|---|---|
| 3 cascades | +1 |
| 4 cascades | +2 |
| 5 or more cascades | +3 |

### Full formula

```
turn_score = match_total + cascade_flat_bonus

match_total = sum over each match of:
    base(match_length) × tier_multiplier(highest tier in match) × combo_multiplier(cascade_depth)

if shape_bonus_present:
    turn_score *= shape_multiplier (1.5 / 2.5 / 4.0)
```

Skilled chain play scores 10 to 20x what casual matching does. The ceiling for elite single-game runs is around 100,000+ points. The hard server-side anti-cheat ceiling is 800,000.

---

## 5. Power Tiles

Match 4 or more pins of the same type and you spawn a power tile on the board. Power tiles sit there until activated (tap or swap). Chaining power tiles together in a single turn is the highest-value move in the game.

| Power tile | Spawned by | Effect |
|---|---|---|
| Bomb | 4-match | Clears a 3x3 area around itself |
| Laser Party | 5-match | Clears the entire row AND entire column where it sits |
| Cosmic Blast | 6+ match | Clears every tile of one specific pin type from the board, wherever it appears |

**Cosmic tier rule:** When a Cosmic-tier pin is the match source, the power tile it spawns gets upgraded one tier. A Cosmic 4-match skips the Bomb and creates a Laser Party. A Cosmic 5-match skips the Laser and creates a Cosmic Blast.

**Chain reactions:** A Bomb next to a Laser detonates both at once. A Cosmic Blast next to anything is usually game-defining. Two power tiles on the board, the next move should almost always put them together.

---

## 6. Pin Capsules

The capsule is the central reward loop.

### Earning capsules from a Classic game

| Final Score | Capsules earned (Classic) |
|---|---|
| Below 15,000 | 0 |
| 15,000 to 29,999 | 1 |
| 30,000 to 49,999 | 2 |
| 50,000 or more | 3 |

### Earning capsules from Daily Challenge

Daily pays out double at every threshold:

| Final Score | Capsules earned (Daily) |
|---|---|
| Below 15,000 | 0 |
| 15,000 to 29,999 | 2 |
| 30,000 to 49,999 | 4 |
| 50,000 or more | 6 |

Plus the day's #1 finisher receives the Daily Champion Bonus on top.

### Other capsule sources

- **Shape bonuses:** Landing a T or Cross shape in a match drops 1 bonus capsule. Capped at 1 bonus capsule per game.
- **Quests/Achievements:** Most quest unlocks pay out capsules (1 to 3 per quest depending on difficulty).
- **Streaks:** 3-day = +2, 7-day = +2, 30-day = +3.
- **Referrals:** +2 to the referrer, +2 to the new player, capped at 50 capsules total lifetime.

### Opening capsules

Capsules sit in the player's inventory until opened. Players can open one at a time, or use "Open All" to bulk-open everything. Each capsule cracks open to reveal one specific pin.

Capsule open flow:
1. Player taps to open.
2. Server rolls a tier (weighted: Common most likely, Cosmic rarest).
3. Within that tier, server picks a specific pin. Rarer pins within a tier (e.g. Diamond Cosmic VIBESTR badges in the Special tier) also have lower in-tier weights.
4. Pin is shown to the player, then collected to their Pinbook.

If the pulled pin is a duplicate (already owned), the duplicate is added to the player's stack and fuels the Reroll system.

---

## 7. The 101 Pin Catalog

There are 101 unique pins to collect across 5 rarity tiers.

| Tier | Pin count | Score multiplier |
|---|---|---|
| Common | 19 | 1.0x |
| Rare (Silver) | 51 | 1.5x |
| Special | 9 | varies (typically 1.0x to 1.5x) |
| Legendary (Gold) | 19 | 2.0x |
| Cosmic | 3 | 3.0x |

The Special tier contains $VIBESTR-related pins. Some Special pins (Diamond Cosmic VIBESTR) are weighted to drop much less often than others within the tier.

Each pin has its own unique artwork from the GVC team. Each game randomly drafts 6 pins from the 101 to fill the board.

---

## 8. The Collector Ladder

The Collector Ladder is a prestige title earned by unique-pin collection percentage. It is purely cosmetic status, not a gating mechanic. Everyone starts at Plastic and climbs as their collection % grows.

| Title | Unique pins % | Pin count threshold |
|---|---|---|
| Plastic | 0%+ | starting tier |
| Grailscale | 10%+ | ~11 pins |
| Collectooor | 25%+ | ~26 pins |
| 69K Gold | 50%+ | ~51 pins |
| Shadow Funk | 75%+ | ~76 pins |
| Cosmic | 90%+ | ~91 pins |
| One-Of-One | 100% | all 101 pins |

One-Of-One is the holographic rainbow status reserved for clearing the entire catalog. Cosmic is rendered with a purple glow.

---

## 9. Quests (Achievements)

55+ quests across two tracks.

### Journey track

Teaches mechanics. Quests for early-game milestones like:
- First combo
- First bomb spawned
- First capsule earned
- First T or Cross shape
- 3-day streak
- First Cosmic pin found
- Score thresholds (5K, 10K, 25K)

### Mastery track

The long game. Quests for endgame and total collection:
- Full tier sets (collect every Common, every Silver, etc.)
- Lifetime tier-find counters ("Find 200 Commons", "Find 10 Cosmics", etc.)
- Big single-game score walls (25K, 50K, 69K, 100K)
- Hall of Vibes: 100,000 points in a single game
- 50 cascades in a single game
- 30-day streak (Committed)
- Reach 50% / 75% / 100% collection completion
- Referral tiers (Ambassador at 1, Recruiter at 5, Commander at 10)

Every quest pays out Pin Capsules. Unlocks are permanent.

### Quest payouts

Typical capsule rewards:
- Easy/Journey: 1 capsule
- Mid Mastery: 2 capsules
- Hard Mastery (full tier sets, 100K runs, etc.): 3 capsules

---

## 10. Rerolls (Duplicates to Fresh Capsules)

Players can convert duplicate pins back into fresh capsules. Rarer dupes are worth more.

| Tier of duplicate | Dupes needed | Reward |
|---|---|---|
| Common | 5 | 1 fresh capsule |
| Rare (Silver) | 4 | 1 fresh capsule |
| Special | 3 | 1 fresh capsule |
| Legendary (Gold) | 2 | 1 fresh capsule |
| Cosmic | 1 | 1 fresh capsule |

Reroll costs 200 $VIBESTR per operation.

**Safety rule:** Reroll never takes the player's last copy of any pin. Collection % can only go up. Completed tier sets stay sealed.

---

## 11. Leaderboards

Four leaderboards.

| Board | Tracks | Reset |
|---|---|---|
| All-Time | Highest single-game Classic score, ever | Never |
| Weekly | Best Classic score this week | Every Monday at 00:00 UTC |
| Daily | Today's Daily Challenge score | Daily at noon ET |
| Pins | Unique-pin collection % | Updates live |

Each board surfaces the player ahead of the signed-in user ("X points to beat player Y") so the next move always feels actionable. The Pins board ranks by completion percentage and uses unique pin count as a tiebreaker.

There is also infrastructure for a 5th "promo" leaderboard tab that activates during partnership campaigns. It is currently inactive.

---

## 12. Streaks and Referrals

### Streaks

Play any mode on any given day and the streak climbs by 1. Skip a day, the streak resets to 1.

| Streak length | Reward |
|---|---|
| 3 days (Streak Starter) | +2 capsules |
| 7 days (Devoted) | +2 capsules |
| 30 days (Committed) | +3 capsules |

### Referrals

Each player has a unique referral link from their profile. Every signup through the link credits both sides.

| Side | Reward |
|---|---|
| Referrer | +2 capsules per signup |
| New player | +2 capsules |

Lifetime cap: 50 capsules per player from referrals.

The same referral link feeds the Ambassador, Recruiter, and Commander quest line (at 1, 5, and 10 referrals).

---

## 13. $VIBESTR Integration

$VIBESTR is the GVC ecosystem token. It plugs into Pin Drop in two specific ways.

**Bonus Games**
- After hitting the 10-game daily Classic cap, players can purchase additional Bonus Games with $VIBESTR.
- Maximum total plays per day: 25 (10 free + 15 bonus).
- Pricing: 1 play = 150 $VIBESTR, 5-pack = 600 $VIBESTR (120/play, 20% off), 10-pack = 1000 $VIBESTR (100/play, 33% off, best value).
- Outcomes never change based on what is spent. Every pin is earnable for free.

**Rerolls**
- Each Reroll operation costs 200 $VIBESTR (fixed fee regardless of tier burned).
- Used to convert duplicates into fresh capsules.

**Free-path parity disclaimer (required everywhere $VIBESTR appears):**
> Every pin is earnable for free. Use of $VIBESTR does not increase the probability of any specific outcome.

This disclaimer is mandatory on the Buy Bonus Games modal, the Reroll modal, the in-game drawer, and the game guide footer. Tyler's framing rules.

---

## 14. Rewards / Launch Event

### GVC NFT Raffle (Launch event)

During the launch event, multiple GVC NFTs are up for grabs for top Pin collectors. Players who complete the Pinbook (100%, all 101 pins) before **June 5th**, or otherwise progress the furthest by collection %, are entered into an exclusive raffle.

### Pin Drop Badge (Evergreen)

Any player who collects all 101 pins and completes the entire Pinbook (100%) unlocks an exclusive Pin Drop Badge. No end date.

**Eligibility note:** To receive the Pin Drop Badge, players must connect a wallet that is also tied to their GVC profile.

---

## 15. Tips and Tricks (from the in-game guide)

These are the strategies surfaced to players in the game guide. Useful for an agent answering player questions about how to score better.

1. **Hunt shapes before clearing.** A T or Cross setup on the next cascade is worth 2 to 4x a clean 3-match. Scan the board for intersections before taking the obvious move.
2. **Chain power tiles.** A Bomb next to a Laser detonates both at once. A Cosmic Blast next to anything is usually game-defining. Two power tiles on the board, put them together.
3. **4-matches are never wasted.** A 4-match always leaves a Bomb. A 5-match leaves a Laser. They sit on the board until used. Late game, the stockpile becomes the final-cascade multiplier stack.
4. **Daily ≠ Classic.** Classic allows up to 25 games per day (10 free + 15 Bonus). Daily allows just one. Scan the whole board before the first move. Plan the last 10 moves. Slower play wins.
5. **Open capsules immediately.** Every pin pulled ticks up a lifetime tier-find counter for quests. Hoarding sealed capsules just slows quest progress.
6. **Watch the Quests rail.** The desktop landing shows the three quests closest to completion. If one is at 9/10, that is the next obvious move.

---

## 16. Anti-Cheat and Server Constraints

For agents that need to understand the technical constraints around scoring:

- Every Classic game starts with a server-generated match token. Score submissions are validated against that token.
- Anomaly thresholds are calibrated against what skilled players actually produce in production:
  - Score > 480,000: flagged as "very high"
  - Score > 800,000: flagged as critical (almost certainly forged)
  - Combo > 25: flagged
  - Cascade count > 100 in one game: flagged
  - Bombs created > 35 in one game: flagged
  - Score-per-match ratio > 1,300: flagged low priority
  - Score-per-match ratio > 4,800: critical
- Max plausible single-game score (server-enforced rejection): 800,000.
- Forged scores get flagged before they hit the leaderboards.
- Banned users cannot log in, start games, or submit scores.
- All admin actions are audit-logged.

---

## 17. Rate Limits

For agents building tools that interact with the API:

| Action | Limit per user per minute |
|---|---|
| Track game (start) | 12 |
| Log game (end) | 12 |
| Earn capsule | 6 |
| Bonus capsule | 3 |
| Open capsule | 600 |
| Collect pin | 600 |
| Achievement unlock | 20 |

429 responses include a `Retry-After` header. Clients should respect it and retry on the next available window.

---

## 18. Partnership / Promo Pin System

Pin Drop has scaffolding for time-bound partnership pins (currently inert).

When a promo is activated:
- One additional pin enters the game, outside the canonical 101.
- 3% of capsule pulls drop the promo pin (independent of the normal tier roll, no impact on the existing tier weights).
- The promo pin appears on the home-screen background and as game tiles, treated as Common (1.0x score multiplier).
- Players track their accumulation via a 5th leaderboard tab in the Leaderboard modal, labelled with the partner name.
- Promo pins never enter the Pinbook. They live in a separate KV path. The official 101 catalog stays unchanged.

When a promo is retired:
- The 5th tab disappears from the modal.
- Future capsules ignore the promo branch.
- Historical counts persist in KV for archive purposes.

Activation is controlled by a `NEXT_PUBLIC_PROMO_ACTIVE` environment variable. The system is currently OFF.

---

## 19. Brand and Voice Notes

For any agent writing copy or generating content for Pin Drop:

- **Always refer to badges as "Pins" inside the game environment.** The IP source material is the GVC Badge collection, but in-game they are Pins.
- **Tone:** declarative, builder-first, casual but considered. Avoid corporate marketing speak.
- **Do not use em dashes (—).** Use periods + new sentences, commas, or parentheses instead.
- **Do not use "it's not X, it's Y" phrasing** or its variants ("Y, not X", "X. Not Y.", "X aren't just Y. They're Z.", "None of X. All of Y.", "On the surface X. But under the hood Y."). Make positive direct statements instead.
- **Emojis:** out of code, UI, and documentation. Allowed sparingly in social writing where it matches Bryan's natural voice (🤘 most commonly, at section breaks or sign-offs).
- **Legal:** wherever $VIBESTR purchase or reward surfaces appear, the free-path parity disclaimer is mandatory.

---

## 20. Glossary

- **Pin:** The in-game term for a GVC Badge. There are 101 unique pins.
- **Pinbook:** The in-game collection view showing which pins the player has found.
- **Pin Capsule:** The reward container earned from gameplay. Each cracks open to reveal one pin.
- **Bonus Games:** Additional Classic plays beyond the daily 10, purchasable with $VIBESTR.
- **Combo:** The cascade depth multiplier within a single turn.
- **Momentum:** Combo carry-over from one turn to the next.
- **Power tile:** Bomb, Laser Party, or Cosmic Blast.
- **Vibetown:** The world/setting that GVC inhabits.
- **$VIBESTR:** The GVC ecosystem token (ERC-20 on Ethereum mainnet).
- **GVC:** Good Vibes Club, the parent IP and community.
- **Pin Drop Badge:** Evergreen reward for 100% Pinbook completion.

---

## Quick Facts Cheat Sheet

| Question | Answer |
|---|---|
| How many pins total? | 101 |
| How many tiers? | 5 (Common, Rare, Special, Legendary, Cosmic) |
| Free games per day? | 10 Classic + 1 Daily Challenge |
| Max games per day? | 25 Classic (10 free + 15 Bonus) + 1 Daily |
| Moves per game? | 30 |
| Board size? | 8x8 |
| Pins on board per game? | 6 randomly drafted from the 101 |
| First capsule threshold? | 15,000 points |
| Top capsule threshold? | 50,000 points (3 capsules in Classic, 6 in Daily) |
| Hall of Vibes? | 100,000+ in a single game |
| Anti-cheat ceiling? | 800,000 |
| Idle hint? | Fires after 8 seconds of inactivity, once per game |
| Cosmic pin spawn upgrade? | Cosmic 4-match → Laser. Cosmic 5-match → Cosmic Blast. |
| Daily Champion bonus? | Awarded to the #1 Daily Challenge finisher each day |
| Reroll cost? | 200 $VIBESTR + tiered dupe count (1 to 5) |
| Streak rewards? | 3-day (+2), 7-day (+2), 30-day (+3) |
| Referral rewards? | +2 each side, 50-capsule lifetime cap |
| Pin Drop Badge requirement? | 100% Pinbook + wallet tied to GVC profile |

---

End of briefing.
