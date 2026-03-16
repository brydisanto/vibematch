# VibeMatch Progression Systems: Pin Book + League System
## Game Design Document v1.0 | March 2026

---

## Table of Contents
1. [Design Pillars](#design-pillars)
2. [System 1: Pin Book (Collection Metagame)](#system-1-pin-book)
3. [System 2: Vibe League (Competitive Ranking)](#system-2-vibe-league)
4. [Priority & Implementation Order](#priority--implementation-order)
5. [Anti-Patterns & Gotchas](#anti-patterns--gotchas)

---

## Design Pillars

Before diving into mechanics, these are the non-negotiable player experiences both systems must serve:

1. **Collector's Pride** -- The Good Vibes Club community already loves badges. Every system must feed that identity. Progression = showing off your collection.
2. **One More Game** -- Every session must end with a reason to play the next one. Not tomorrow -- right now.
3. **Fair Competition** -- No pay-to-win, no purchased advantages. Skill and dedication are the only currencies.
4. **Lightweight Backend** -- Everything must work within Vercel KV's key-value model. No relational queries, no complex joins.

---

## System 1: Pin Book

### Purpose
Transform the existing 74 badge designs into a persistent collection metagame. The player already sees these badges every game -- now they *own* them.

### Player Fantasy
"I'm building the ultimate Good Vibes collection. Every game gets me closer to completing my Pin Book."

### Core Mechanic: Vibe Chests

After completing a game (Classic or Daily), the player earns a **Vibe Chest** based on their score. Opening the chest reveals a random pin from the 74 badge catalog.

#### Chest Earn Thresholds

The existing rank system (GameOver.tsx) already defines score tiers. Chests align with these:

| Score Threshold | Chest Tier    | Pins Inside | Drop Quality           |
|-----------------|---------------|-------------|------------------------|
| 0 - 2,499       | No chest      | 0           | --                     |
| 2,500 - 4,999   | Bronze Chest  | 1           | Mostly Common          |
| 5,000 - 9,999   | Silver Chest  | 1           | Common + Uncommon      |
| 10,000 - 14,999 | Gold Chest    | 2           | Guaranteed 1 Uncommon+ |
| 15,000 - 19,999 | Cosmic Chest  | 2           | Guaranteed 1 Gold+     |
| 20,000+         | Legendary Chest| 3          | Guaranteed 1 Cosmic    |

**Rationale for thresholds**: Based on the scoring engine (100 per 3-match, 300 per 4-match, 600 per 5-match, with tier and combo multipliers across 30 moves), a casual player averages 3,000-6,000 per game. A skilled player hits 10,000-15,000. The "no chest below 2,500" floor exists to prevent AFK/spam games from generating drops. The 2,500 floor is reachable by any player who makes reasonable matches -- roughly 8-10 basic 3-matches with no combos.

`[PLACEHOLDER]` -- All thresholds should be tuned after 50+ playtests. The critical metric is: "Does a casual player earn at least 1 chest per 2 games?" If not, lower the Bronze threshold.

#### Rarity Distribution (Drop Tables)

Pins map directly to the existing 4 badge tiers:

| Pin Rarity | Badge Tier | Count in Catalog | In-Game Tier Name |
|------------|------------|------------------|-------------------|
| Common     | blue       | 37               | Common            |
| Uncommon   | silver     | 25               | Uncommon          |
| Gold       | gold       | 8                | Gold              |
| Cosmic     | cosmic     | 2                | Cosmic            |

**Drop probabilities per chest tier:**

| Chest Tier  | Common | Uncommon | Gold  | Cosmic |
|-------------|--------|----------|-------|--------|
| Bronze      | 75%    | 20%      | 4.5%  | 0.5%   |
| Silver      | 55%    | 35%      | 8%    | 2%     |
| Gold*       | 40%    | 35%      | 20%   | 5%     |
| Cosmic*     | 25%    | 30%      | 35%   | 10%    |
| Legendary*  | 15%    | 25%      | 40%   | 20%    |

*Multi-pin chests: The first pin uses the guaranteed minimum rarity, remaining pins roll from the table above.*

**Why these numbers**: With 74 total pins and the above rates, a player opening ~3 Bronze chests per day would take approximately 40-60 sessions to collect all Commons, 80-120 for all Uncommons, and 200+ for all Golds. Cosmics are the "white whale" -- completing the full book is a multi-month achievement. This is intentional for a community game with long-term retention goals.

`[PLACEHOLDER]` -- Run Monte Carlo simulation: generate 1000 player profiles at 2 chests/day for 30 days. Verify median collection is 40-55% complete. If higher, tighten Gold/Cosmic rates. If lower, loosen Common/Uncommon.

#### Duplicate Handling: Vibe Shards

When a player receives a pin they already own, it converts to **Vibe Shards**:

| Duplicate Rarity | Shards Received |
|------------------|-----------------|
| Common           | 1               |
| Uncommon         | 3               |
| Gold             | 8               |
| Cosmic           | 25              |

**Shard Redemption** (the pity system):

| Pin Rarity to Craft | Shard Cost |
|----------------------|------------|
| Common (specific)    | 5          |
| Uncommon (specific)  | 15         |
| Gold (specific)      | 50         |
| Cosmic (specific)    | 150        |

**Why specific crafting, not random**: This community already trades NFTs. They understand targeted acquisition. A random shard-to-pin conversion would feel worse than the chest itself. Let them pick exactly which pin they want. This also eliminates the "last pin" frustration -- when you have 73/74, you can target the final one.

`[PLACEHOLDER]` -- Shard economy needs validation. Key question: does a player who opens only Bronze chests accumulate enough shards from Common duplicates to eventually craft Gold/Cosmic pins? Target: a dedicated player (2 games/day, 30 days) should be able to craft 1 Gold pin purely from shard accumulation. Math: ~60 chests, ~40 duplicates at avg 1.5 shards = 60 shards. Gold costs 50. This checks out.

#### Pin Book UI Concept

```
+--------------------------------------------------+
|  PIN BOOK                          37/74 Collected|
|                                                    |
|  [COMMON]  ============================== 30/37   |
|  [UNCOMMON] ===================           15/25   |
|  [GOLD]     ========                       4/8    |
|  [COSMIC]   ==                              1/2   |
|                                                    |
|  +------+ +------+ +------+ +------+ +------+    |
|  | [img]| | [img]| | [img]| | [?? ]| | [?? ]|    |
|  | Pepe | | Doge | |Baller| |  ??  | |  ??  |    |
|  |  x3  | |  x1  | |  x2  | |      | |      |    |
|  +------+ +------+ +------+ +------+ +------+    |
|  ... (scrollable grid, 5 columns)                  |
|                                                    |
|  Vibe Shards: 23                                   |
+--------------------------------------------------+
```

- Collected pins show their badge image, name, and how many times obtained (x1, x2, etc.)
- Uncollected pins show a darkened silhouette with "??" -- preserving discovery excitement
- Tapping a collected pin shows the badge lore (already in badges.ts)
- Tapping an uncollected pin shows rarity and shard cost to craft
- Progress bars per tier provide clear "next goal" visibility
- Sort options: by tier, by recently collected, by name

### Pin Book: Chest Opening Flow

This is the single most important moment in the system. It needs to feel like an event.

```
Game Over screen (existing)
    |
    v
[Score qualifies for chest? Show chest icon with tier glow]
    |
    v
[Player taps "Open Chest"]
    |
    v
[Chest shake animation -> burst open]
    |
    v
[Pin reveal: badge slides up from glow, tier ring animates in]
    |
    v
[NEW! badge -> celebration particles, "Added to Pin Book!"]
[DUPLICATE badge -> "Already collected! +3 Vibe Shards"]
    |
    v
[If multi-pin chest: "Next pin..." -> repeat reveal]
    |
    v
[Summary: "Pin Book: 38/74 (+1 new)" or "Vibe Shards: 26 (+3)"]
```

### Pin Book: Data Model (Vercel KV)

```
KEY                              VALUE (JSON)
---                              -----
pinbook:{username_lower}         {
                                   "pins": {
                                     "pepe": 3,        // badge_id: times_obtained
                                     "doge": 1,
                                     "cosmic_guardian": 1
                                   },
                                   "shards": 23,
                                   "totalChestsOpened": 47,
                                   "lastChestDate": "2026-03-13"
                                 }
```

**Why a single key per user**: Vercel KV charges per operation. A single JSON blob for the entire pin book means one GET and one SET per chest opening. The 74-pin object is small (~2KB). No need for per-pin keys.

**Important**: The `pins` object only stores collected pins. Uncollected pins are derived client-side by diffing against the full BADGES array from badges.ts.

#### Chest Earning Rate Limit

To prevent score-farming:
- **Classic mode**: Unlimited chests per day (but each game takes 5-10 minutes, so natural rate limit of ~6-12/hour)
- **Daily mode**: 1 game per day (already enforced), so max 1 chest per day from Daily

No artificial cap needed for Classic. The time investment IS the cap.

---

## System 2: Vibe League

### Purpose
Transform the flat leaderboard into a competitive ranking that creates stakes every game, social comparison within skill bands, and a reason to improve over weeks/months.

### Player Fantasy
"I'm climbing the ranks. I'm in Gold league now -- can I make Cosmic before the season ends?"

### League Tiers

| League         | VP Range      | Icon Color  | Player Segment              |
|----------------|---------------|-------------|-----------------------------|
| Chill          | 0 - 299       | #8B8B8B     | New/very casual players     |
| Groovy         | 300 - 699     | #4A9EFF     | Regular casual players      |
| Vibin          | 700 - 1,199   | #00D68F     | Engaged players             |
| Fire           | 1,200 - 1,799 | #FF5F1F     | Skilled players             |
| Gold Vibes     | 2,000 - 2,999 | #FFE048     | Dedicated competitive       |
| Cosmic         | 3,000+        | #B366FF     | Top tier, prestige          |

**VP = Vibe Points** (the ranking currency, separate from game score)

**Why 6 tiers, not more**: With an expected active player base of 50-200 (NFT community), more tiers would feel empty. 6 tiers means each league has enough players to feel populated. If the community grows beyond 500 active, add a 7th "Legendary" tier at 4,000+.

### VP Gain/Loss Formula

After each Classic game:

```
VP_change = base_vp + performance_bonus - league_tax

Where:
  base_vp = floor(score / 500)
  performance_bonus:
    - Score >= 15,000:  +15 VP (Cosmic-rank game)
    - Score >= 10,000:  +10 VP (Silver-rank game)
    - Score >= 5,000:   +5 VP  (Bronze-rank game)
    - Score < 5,000:    +0 VP
  league_tax (prevents inflation at high leagues):
    - Chill:       0 VP
    - Groovy:      -2 VP per game
    - Vibin:       -4 VP per game
    - Fire:        -6 VP per game
    - Gold Vibes:  -8 VP per game
    - Cosmic:      -10 VP per game
```

**Minimum VP change per game: 0** (you never lose VP from playing a game -- you only decay from not playing, see below)

**Example scenarios:**

| Scenario                              | Score  | base_vp | bonus | tax | Total VP |
|---------------------------------------|--------|---------|-------|-----|----------|
| Chill player, casual game             | 3,200  | 6       | 0     | 0   | +6       |
| Groovy player, decent game            | 6,500  | 13      | 5     | -2  | +16      |
| Fire player, great game               | 12,000 | 24      | 10    | -6  | +28      |
| Gold Vibes player, mediocre game      | 4,000  | 8       | 0     | -8  | +0 (min) |
| Cosmic player, amazing game           | 18,000 | 36      | 15    | -10 | +41      |

**Why no VP loss from games**: This is a casual community game, not ranked Apex Legends. Losing VP from playing would discourage people from playing when they're "having a bad day." The league tax creates downward pressure without punishment. If a Gold Vibes player plays 5 mediocre games, they get +0 VP each time but don't lose any. They only drop if they stop playing (decay, below).

`[PLACEHOLDER]` -- The base_vp divisor (500) needs testing. Target: a Groovy player averaging 6,000 per game should gain ~14 VP per game, reaching Vibin after ~30 games (~5-7 days of active play). Adjust divisor if promotion feels too fast or too slow.

#### Daily Challenge VP Bonus

Daily Challenge games award VP differently:
```
daily_vp = floor(score / 500) + 10  (flat +10 bonus for showing up)
```
No league tax on Daily. This rewards daily engagement and makes the Daily Challenge feel special for league climbing.

#### Inactivity Decay

```
If no game played in 3 consecutive days:
  VP_decay = -15 VP per day of inactivity (starting day 4)
  Minimum VP: 0 (can't go negative)
  Decay stops at league floor: Chill (0 VP)
```

**Why 3-day grace**: The community is casual. A weekend off shouldn't cost you. But a week of inactivity should create visible slippage that motivates return. At -15/day, a Gold Vibes player (2,000 VP) would decay to Fire (1,799) after ~14 days of total inactivity. That's gentle enough.

`[PLACEHOLDER]` -- Decay rate. If community skews very casual (sessions only 2-3x/week), increase grace period to 5 days and reduce decay to -10/day.

### Seasons

**Season Length**: 4 weeks (28 days)

At season end:
1. Record final league standing in season history
2. Award a **Season Pin** (unique badge not in the regular 74) to everyone Gold Vibes or above
3. Soft reset: VP = VP * 0.6 (keeps relative ranking but compresses everyone toward middle)

**Why 4 weeks**: Short enough to feel urgent ("2 weeks left to hit Gold!"), long enough that casual players can climb meaningfully. A 1-week season would be too punishing for people who play 3x/week.

**Why 0.6 multiplier reset**: A Cosmic player at 3,500 VP resets to 2,100 (Gold Vibes). They need to re-earn their way back, but don't start from zero. A Vibin player at 1,000 resets to 600 (Groovy). The compression creates early-season activity as everyone pushes to reclaim their tier.

`[PLACEHOLDER]` -- Season length and reset multiplier. If the first season shows that >80% of players are in Chill/Groovy at season end, the climb is too steep. Consider 0.7 multiplier or lower league tax.

### League UI Concept

```
+--------------------------------------------------+
|  VIBE LEAGUE              Season 3 | 12 days left |
|                                                    |
|  [FIRE LEAGUE]                                     |
|  ============================================ 1,450 VP
|  |                    [YOU ARE HERE]          |    |
|  ============================================     |
|  Next: Gold Vibes (2,000 VP) -- 550 VP to go      |
|                                                    |
|  LEAGUE STANDINGS (Fire)                           |
|  1. vibemaster99     1,780 VP                      |
|  2. craig_fan        1,650 VP                      |
|  3. >> YOU <<        1,450 VP                      |
|  4. nounish_player   1,320 VP                      |
|  ...                                               |
|                                                    |
|  RECENT MATCHES                                    |
|  Classic 12,500 -> +22 VP                          |
|  Daily   8,200  -> +26 VP                          |
|  Classic 4,100  -> +2 VP                           |
+--------------------------------------------------+
```

Key elements:
- Progress bar toward next league with VP numbers
- League-specific leaderboard (show only players in your league)
- Recent VP history so players understand the math
- Season countdown timer creating urgency

### Vibe League: Data Model (Vercel KV)

```
KEY                              VALUE (JSON)
---                              -----
league:{username_lower}          {
                                   "vp": 1450,
                                   "league": "fire",
                                   "seasonId": 3,
                                   "gamesThisSeason": 42,
                                   "lastGameDate": "2026-03-13",
                                   "vpHistory": [
                                     {"date": "2026-03-13", "change": 22, "score": 12500, "mode": "classic"},
                                     {"date": "2026-03-12", "change": 26, "score": 8200, "mode": "daily"}
                                   ],
                                   "peakVp": 1780,
                                   "peakLeague": "fire"
                                 }

league_rankings                  SORTED SET (Vercel KV zset)
                                 member: username, score: vp
                                 (Used for global league leaderboard)

season:current                   {
                                   "id": 3,
                                   "startDate": "2026-03-01",
                                   "endDate": "2026-03-28"
                                 }

season_history:{username_lower}  {
                                   "seasons": [
                                     {"id": 1, "finalVp": 820, "finalLeague": "vibin", "seasonPin": "season1_gold"},
                                     {"id": 2, "finalVp": 1650, "finalLeague": "fire", "seasonPin": "season2_gold"}
                                   ]
                                 }
```

**vpHistory is capped at the last 20 entries** to keep the JSON blob small. Older entries are dropped on write.

**league_rankings sorted set**: Reuses the same Vercel KV sorted set pattern as the existing `classic_leaderboard`. One zadd per game, zrange for display.

### Decay Implementation

Decay is calculated lazily, not via cron job. When a player's league data is read:

```typescript
function applyDecay(data: LeagueData): LeagueData {
  const now = new Date();
  const lastGame = new Date(data.lastGameDate);
  const daysSinceLastGame = Math.floor((now - lastGame) / 86400000);

  if (daysSinceLastGame <= 3) return data; // grace period

  const decayDays = daysSinceLastGame - 3;
  const totalDecay = decayDays * 15;
  const newVp = Math.max(0, data.vp - totalDecay);

  return { ...data, vp: newVp, league: getLeagueForVp(newVp) };
}
```

**Why lazy decay**: Avoids needing a cron job to sweep all users daily. The decay is deterministic -- given `lastGameDate` and current date, the result is always the same. Calculate on read, persist on next write.

---

## Priority & Implementation Order

### Phase 1: Pin Book (build FIRST)

**Why first**: The Pin Book directly feeds the existing badge collector identity. It requires minimal new UI (chest reveal overlay + pin book modal) and almost no backend changes (one new KV key per user). The "one more game" hook is immediate: "I need 2 more pins to complete all Uncommons."

Implementation steps:
1. Add `pinbook:{username}` KV storage (1 new API route: `/api/pinbook`)
2. Add chest qualification logic to the existing score POST (`/api/scores`)
3. Build chest opening animation (overlay component, similar to existing GameOver modal)
4. Build Pin Book modal (grid of badges with collected/uncollected states)
5. Add shard crafting UI (tap uncollected pin -> "Craft for X shards?")

**Estimated scope**: 2-3 days for a prototype-quality implementation.

### Phase 2: Vibe League (build SECOND)

**Why second**: The league system is meaningless without enough players playing regularly. The Pin Book creates the daily habit; the league system channels that habit into competition. Launching league without Pin Book risks: "Why should I care about ranking up? There's nothing to show for it."

Implementation steps:
1. Add `league:{username}` KV storage and `league_rankings` sorted set
2. Add VP calculation to the existing score POST
3. Build league display on profile/home (current league badge, VP, progress bar)
4. Build league leaderboard tab in existing LeaderboardModal
5. Add season management (season:current key, reset logic)
6. Add VP history display

**Estimated scope**: 3-4 days for a prototype-quality implementation.

### Phase 3: Systems Integration (LAST)

Connect the two systems for compound engagement:
- League tier affects chest quality: Fire+ players get +1 bonus pin per chest
- Season Pins are added to the Pin Book as a separate "Seasonal" tab
- Pin Book completion milestones award VP bonuses (complete a full tier = +100 VP)

**Estimated scope**: 1 day.

---

## Anti-Patterns & Gotchas

### 1. The "Empty Room" Problem
**Risk**: Launching the league system with <20 active players means most leagues have 0-2 people.
**Mitigation**: Do NOT show league-specific leaderboards until there are 10+ players in that league. Instead show the global league ranking. The league name/tier still provides identity even in a small community.

### 2. Chest Fatigue
**Risk**: After 100+ chests, every opening is a duplicate. The reveal animation becomes an annoyance, not a delight.
**Mitigation**: Add a "Quick Open" toggle after the player has opened 20+ chests. One-tap to see results without animation. Also: the shard crafting system ensures duplicates always have value.

### 3. VP Inflation Over Long Seasons
**Risk**: Since games never subtract VP, total VP in the system only goes up. After 6+ months, everyone is Cosmic.
**Mitigation**: The league tax creates a VP ceiling per game at each tier. A Cosmic player averaging 8,000/game gets floor(8000/500) + 5 - 10 = 11 VP/game. A Cosmic player averaging 5,000/game gets floor(5000/500) + 0 - 10 = 0 VP/game. To sustain Cosmic, you need consistent high performance. The season reset (0.6x) also hard-compresses inflation every 4 weeks.

### 4. Shard Economy Collapse
**Risk**: If shard earn rate is too generous, players craft all pins quickly and the system is "solved."
**Mitigation**: Track `totalChestsOpened` and `totalShards` in analytics. If average shards-per-player exceeds 200 within 30 days, tighten duplicate shard rewards by 30%.

### 5. "I Scored 2,499 and Got Nothing" Frustration
**Risk**: Hard chest thresholds create cliff-edge frustration at boundary scores.
**Mitigation**: When a player scores within 10% of the next chest threshold (e.g., 2,250-2,499 for Bronze), show a "So close! 251 more for a Bronze Chest" message on the Game Over screen. Turn the frustration into a "one more game" hook.

### 6. Daily Challenge Exploitation
**Risk**: Players create alt accounts to farm daily challenge chests with shared seeds.
**Mitigation**: Chest rewards require an account age of 24+ hours. New accounts can play but don't earn chests. This is a simple check against the `createdAt` field in the user profile.

### 7. Vercel KV Size Limits
**Risk**: vpHistory array grows unbounded.
**Mitigation**: Cap at 20 entries (already specified). The pinbook object is bounded by the 74 badge catalog. The season_history grows at 1 entry per 4 weeks -- negligible.

---

## Tuning Spreadsheet

### Chest Economy Model

```
Variable                    | Value      | Min  | Max   | Notes
----------------------------|------------|------|-------|----------------------------------
Bronze chest threshold      | 2,500      | 1,500| 4,000 | [PLACEHOLDER] Must be achievable by casual players
Silver chest threshold      | 5,000      | 3,500| 7,000 | [PLACEHOLDER] ~60% of games for avg player
Gold chest threshold        | 10,000     | 7,500| 12,000| [PLACEHOLDER] Top 20% of games
Cosmic chest threshold      | 15,000     | 12,000|18,000| [PLACEHOLDER] Top 5% of games
Legendary chest threshold   | 20,000     | 18,000|25,000| [PLACEHOLDER] Top 1% of games
Common drop % (Bronze)      | 75%        | 65%  | 85%   | Higher = more dupes = more shards
Cosmic drop % (Bronze)      | 0.5%       | 0%   | 2%    | Low enough to feel special
Shard per Common dupe       | 1          | 1    | 2     | Floor value
Shard per Cosmic dupe       | 25         | 15   | 40    | Ceiling value
Craft cost: Common          | 5          | 3    | 10    | ~5 Common dupes to target a Common
Craft cost: Cosmic          | 150        | 100  | 250   | ~6 Cosmic dupes OR many Common dupes
```

### League Economy Model

```
Variable                    | Value      | Min  | Max   | Notes
----------------------------|------------|------|-------|----------------------------------
VP base divisor             | 500        | 300  | 800   | [PLACEHOLDER] Lower = faster climb
Daily bonus VP              | 10         | 5    | 20    | Incentivize Daily Challenge play
Decay grace period (days)   | 3          | 2    | 7     | [PLACEHOLDER] Depends on play frequency data
Decay rate (VP/day)         | 15         | 5    | 25    | [PLACEHOLDER] Gentle enough for casuals
Season length (days)        | 28         | 14   | 42    | [PLACEHOLDER] Shorter = more urgency
Season reset multiplier     | 0.6        | 0.4  | 0.8   | Lower = more grind each season
Cosmic league floor VP      | 3,000      | 2,500| 4,000 | [PLACEHOLDER] Should be aspirational
League tax: Cosmic          | 10         | 5    | 15    | [PLACEHOLDER] Must prevent AFK climbing
```

---

## System Interaction Matrix

| System A       | System B        | Interaction Type | Description                                         |
|----------------|-----------------|------------------|-----------------------------------------------------|
| Pin Book       | Scoring         | Intended         | Score determines chest tier                          |
| Pin Book       | Badge Catalog   | Intended         | Pins = existing badge designs                        |
| Pin Book       | League          | Phase 3          | League tier -> chest bonus; completion -> VP bonus   |
| League         | Scoring         | Intended         | Score determines VP gain                             |
| League         | Daily Challenge | Intended         | Daily bonus VP incentivizes daily play               |
| League         | Streak System   | Acceptable       | Streak could grant VP bonus (not in MVP)             |
| Pin Book       | Vibe Draft      | Acceptable       | Could let you draft owned pins (not in MVP)          |
| League         | Leaderboard     | Intended         | League rankings replace/supplement existing boards   |

---

## Success Criteria

Before the first playtest of these systems, define "working":

1. **Pin Book**: A player who plays 3 games averaging 5,000 score opens 3 Silver Chests and gets at least 1 new pin. They open the Pin Book and can see their collection progress. They feel motivated to play a 4th game.

2. **Vibe League**: A player in Groovy league plays 5 games averaging 7,000 score. They gain ~80 VP total and can see themselves climbing toward Vibin. They check the league leaderboard and see 3-5 other players near their rank. They feel competitive motivation.

3. **Combined**: After 1 week of daily play (7-14 games), a player has collected 15-25 pins and is in Vibin/Fire league. They have a clear "next goal" in both systems. They tell another community member about their progress.

Define "broken":
- If >50% of active players are in the same league after 2 weeks, the VP formula needs rebalancing
- If a player opens 10 chests and gets 0 new pins, the duplicate rate is too aggressive
- If a player reaches Cosmic league in <1 week of casual play, the climb is too easy
- If Pin Book completion is achievable in <2 weeks, the economy is too generous
