# Claynosaurz partner event assets

Files are referenced by name from `src/lib/promo-badges.ts`.

## Pin art (5 files) ✅ IN PLACE

| filename | rarity | pt value | drop weight | notes |
| --- | --- | --- | --- | --- |
| `common.webp` | Common | 1 | 70 | ~10.4% per capsule |
| `rare.webp` | Rare | 2 | 20 | ~2.97% |
| `epic.webp` | Epic | 5 | 8 | ~1.19% |
| `legendary.webp` | Legendary | 10 | 2 | ~0.30% |
| `cosmic.webp` | Cosmic (chase) | 20 | 1 | ~0.15% — ultra-rare, doesn't count toward set completion |

Format guidance to match Craig's set:
- Square PNGs, ideally 1024×1024, transparent background
- Render at pin-tile aspect (the game board scales them down; visible detail ~60-80px)

## Hero image (1 file)

- `hero.jpg` — Landing/drawer hero image. Rendered inside a circular mask.
- Square. 800×800 or 1000×1000 recommended.
- If Claynosaurz has a signature character/mascot, that reads better than a pin tile blowup.

## Game background (optional — separate location)

If we want the pink Bubble Gum backdrop treatment for Claynosaurz too:
- `../../../backgrounds/game-bg-claynosaurz.webp`
- Wide (~2400×1340), .webp for LCP.
- The AppClient swap logic gates on `kind === "set"` — currently swaps to
  the Bubble Gum backdrop. When Claynosaurz goes live we'd need to also
  gate on `set.id` to pick the right backdrop per event.

## Naming placeholder

Pin display names are currently `Claynosaurz {Rarity} (TBD)` — update
`src/lib/promo-badges.ts` when the naming concept is locked (e.g.,
"Fossil / Bone / Skull / Full Skeleton / Amber Chase").

## Brand accent color

Currently `#00C4B4` (approximate Claynosaurz teal). Update
`accentColor` in the `claynosaurz_partner_event` PromoEventSet entry
if their brand brief specifies a different hex.
