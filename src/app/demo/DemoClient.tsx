"use client";

/**
 * Standalone /demo highlights reel for video capture.
 *
 * Renders the live <GameBoard> + <GameHUD> with no app chrome. Walks through
 * 8 hand-crafted scenarios in sequence (3-match → 4-match → 5-match → bomb
 * detonation → laser detonation → cosmic 6-match → cosmic blast → bomb+laser
 * chain), then loops. Each scenario plays through the real engine via
 * processTurn(), so animations, sounds, and effects are identical to the
 * shipped game — just on a contrived board that produces the desired moment.
 *
 * The "safe base board" uses a (row+col) % 6 pattern over the 6 selected
 * badges, which guarantees no pre-existing matches anywhere. Each scenario
 * mutates only the cells needed to set up its swap, so the rest of the board
 * stays clean.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameBoard from "@/components/GameBoard";
import GameHUD from "@/components/GameHUD";
import {
    Cell,
    GameState,
    Position,
    SpecialTileType,
    TurnResult,
    processTurn,
} from "@/lib/gameEngine";
import { Badge, selectGameBadges } from "@/lib/badges";
import {
    playMatchSound,
    playBombSound,
    playVibestreakSound,
    playCosmicBlastSound,
    playCascadeSound,
    playTileLandSound,
    playShapeBonusSound,
    playGameStartSound,
} from "@/lib/sounds";
import type { MatchEffect, ScorePopup } from "@/lib/useGame";

// Fixed seed → same 6 badges every session, so scenario tuning is stable.
const DEMO_SEED = 7;
const BOARD_SIZE = 8;

// Cell IDs need to be unique across the whole demo session. Using a counter
// scoped to this module so each scenario reset still produces fresh IDs (the
// engine keys animations off cell.id; reusing IDs across scenario resets
// would cause cross-fade glitches).
let demoCellCounter = 0;
const nextDemoId = () => `demo_${demoCellCounter++}`;

function mkCell(badge: Badge, opts?: { special?: SpecialTileType; cosmicTarget?: string }): Cell {
    return {
        id: nextDemoId(),
        badge,
        isMatched: false,
        ...(opts?.special ? { isSpecial: opts.special } : {}),
        ...(opts?.cosmicTarget ? { cosmicTargetBadgeId: opts.cosmicTarget } : {}),
    };
}

/** Safe match-free 8x8: each cell is badges[(row + col) % 6]. */
function buildSafeBoard(badges: Badge[]): Cell[][] {
    return Array.from({ length: BOARD_SIZE }, (_, r) =>
        Array.from({ length: BOARD_SIZE }, (_, c) => mkCell(badges[(r + c) % 6]))
    );
}

interface Mutation {
    row: number;
    col: number;
    badgeIdx: number;
    special?: SpecialTileType;
    cosmicTargetIdx?: number;
}

function applyMutations(board: Cell[][], muts: Mutation[], badges: Badge[]): Cell[][] {
    const out = board.map(row => row.map(c => ({ ...c })));
    for (const m of muts) {
        const target = m.cosmicTargetIdx !== undefined ? badges[m.cosmicTargetIdx].id : undefined;
        out[m.row][m.col] = mkCell(badges[m.badgeIdx], { special: m.special, cosmicTarget: target });
    }
    return out;
}

interface Scenario {
    name: string;
    /** Build mutations given the badge list. Lets scenarios reference the
     *  cosmic-tier badge index, which is determined at runtime. */
    build: (badges: Badge[], cosmicIdx: number) => Mutation[];
    swap: { from: Position; to: Position };
    /** How long to hold the resulting state before advancing. Should cover
     *  match flash + cascade settling + a beat for the camera. */
    holdMs: number;
}

/* ════════════════════════════════════════════════════════════════
   The 8 scenarios. All assume the safe base board (row+col)%6 layout.
   Mutations only overwrite the cells the swap needs — the rest of the
   board stays match-free.
   ════════════════════════════════════════════════════════════════ */

const SCENARIOS: Scenario[] = [
    // 1. 3-Match warmup. swap (0,2)C ↔ (0,3)A → row 0 cols 0-2 all A.
    {
        name: "3-match warmup",
        build: () => [
            { row: 0, col: 0, badgeIdx: 0 }, // A
            { row: 0, col: 1, badgeIdx: 0 }, // A
            // (0,2) is C from safe pattern, kept
            { row: 0, col: 3, badgeIdx: 0 }, // A
        ],
        swap: { from: { row: 0, col: 2 }, to: { row: 0, col: 3 } },
        holdMs: 2200,
    },

    // 2. 4-Match → Bomb spawn. Swap (0,2)↔(1,2): row 0 = AAAA.
    {
        name: "4-match → bomb",
        build: () => [
            { row: 0, col: 0, badgeIdx: 0 },
            { row: 0, col: 1, badgeIdx: 0 },
            // (0,2) = C from safe; will swap up
            { row: 0, col: 3, badgeIdx: 0 },
            { row: 1, col: 2, badgeIdx: 0 }, // A — swaps up to (0,2)
        ],
        swap: { from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
        holdMs: 2800,
    },

    // 3. 5-Match → Vibestreak (Laser Party) spawn. Same swap as #2 but
    //    (0,4) also overridden to A so post-swap row 0 has 5 A's.
    {
        name: "5-match → laser party",
        build: () => [
            { row: 0, col: 0, badgeIdx: 0 },
            { row: 0, col: 1, badgeIdx: 0 },
            { row: 0, col: 3, badgeIdx: 0 },
            { row: 0, col: 4, badgeIdx: 0 },
            { row: 1, col: 2, badgeIdx: 0 },
        ],
        swap: { from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
        holdMs: 3000,
    },

    // 4. Bomb detonation. Pre-place a Bomb at (4,4); 3-match through it
    //    triggers it. Swap (3,4)↔(2,4) where (2,4)=A puts A at (3,4),
    //    making column 4 rows 3-5 all A through the bomb.
    {
        name: "bomb detonation",
        build: () => [
            { row: 2, col: 4, badgeIdx: 0 }, // A — gets swapped down
            // (3,4) safe pattern is B = stays as the non-A starter
            { row: 4, col: 4, badgeIdx: 0, special: "bomb" }, // Bomb-A
            { row: 5, col: 4, badgeIdx: 0 }, // A
        ],
        swap: { from: { row: 2, col: 4 }, to: { row: 3, col: 4 } },
        holdMs: 3200,
    },

    // 5. Vibestreak detonation. Same setup as #4 but with vibestreak
    //    instead of bomb. Clears full row + column.
    {
        name: "laser detonation",
        build: () => [
            { row: 2, col: 4, badgeIdx: 0 },
            { row: 4, col: 4, badgeIdx: 0, special: "vibestreak" },
            { row: 5, col: 4, badgeIdx: 0 },
        ],
        swap: { from: { row: 2, col: 4 }, to: { row: 3, col: 4 } },
        holdMs: 3200,
    },

    // 6. Cosmic 6-match → Cosmic Blast spawn. Use the cosmic-tier badge
    //    in a horizontal 6, completed by swapping a cell up from row 1.
    {
        name: "cosmic 6-match → cosmic blast",
        build: (_badges, cosmic) => [
            { row: 0, col: 0, badgeIdx: cosmic },
            { row: 0, col: 1, badgeIdx: cosmic },
            // (0,2) safe pattern non-cosmic; gets swapped up
            { row: 0, col: 3, badgeIdx: cosmic },
            { row: 0, col: 4, badgeIdx: cosmic },
            { row: 0, col: 5, badgeIdx: cosmic },
            { row: 1, col: 2, badgeIdx: cosmic }, // swaps up to (0,2)
        ],
        swap: { from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
        holdMs: 3500,
    },

    // 7. Cosmic Blast detonation. Pre-place a Cosmic Blast at (4,4);
    //    it stores the source-match's badge as its target (we set that
    //    explicitly here). Match clears all tiles of badge A.
    {
        name: "cosmic blast detonation",
        build: () => [
            { row: 2, col: 4, badgeIdx: 0 },
            { row: 4, col: 4, badgeIdx: 0, special: "cosmic_blast", cosmicTargetIdx: 0 },
            { row: 5, col: 4, badgeIdx: 0 },
        ],
        swap: { from: { row: 2, col: 4 }, to: { row: 3, col: 4 } },
        holdMs: 3800,
    },

    // 8. Climax: Bomb + Vibestreak chain. Bomb at (4,4), vibestreak at
    //    (4,5). Match the bomb → its 3x3 area engulfs (4,5) → vibestreak
    //    chain-detonates → row 4 + col 5 also clear.
    {
        name: "bomb + laser chain reaction",
        build: () => [
            { row: 2, col: 4, badgeIdx: 0 },
            { row: 4, col: 4, badgeIdx: 0, special: "bomb" },
            { row: 5, col: 4, badgeIdx: 0 },
            // Vibestreak adjacent. Use a different badge so it doesn't
            // accidentally form a 3-match with surrounding A's pre-swap.
            { row: 4, col: 5, badgeIdx: 1, special: "vibestreak" },
        ],
        swap: { from: { row: 2, col: 4 }, to: { row: 3, col: 4 } },
        holdMs: 4200,
    },
];

const SWAP_ANIM_MS = 350;
const PRE_SWAP_DELAY_MS = 700; // beat to let the audience see the setup

/* ════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════ */

export default function DemoClient() {
    // Deterministic 6-badge set so scenario hand-tuning stays stable.
    const badges = useMemo(() => selectGameBadges(6, DEMO_SEED), []);
    const cosmicIdx = useMemo(() => {
        const idx = badges.findIndex(b => b.tier === "cosmic");
        return idx === -1 ? 0 : idx;
    }, [badges]);

    const safeBase = useMemo(() => buildSafeBoard(badges), [badges]);

    const [board, setBoard] = useState<Cell[][]>(safeBase);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [matchEffect, setMatchEffect] = useState<MatchEffect | null>(null);
    const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
    const [swapAnim, setSwapAnim] = useState<{ pos1: Position; pos2: Position } | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isDealing, setIsDealing] = useState(true);
    const [scenarioIdx, setScenarioIdx] = useState(0);

    const popupCounter = useRef(0);
    const scenarioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const matchEffectClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const popupClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Apply a TurnResult to demo state. Mirrors useGame.applyResult but
    // stripped of the things the demo doesn't need (move counter, FTUE,
    // pinbook, achievements, game-over checks).
    const applyTurnResult = useCallback((result: TurnResult, effectPos: Position) => {
        const realMatches = result.matchesFound.filter(m => m.positions.length <= 8);
        const maxMatchSize = realMatches.length > 0
            ? Math.max(...realMatches.map(m => m.positions.length))
            : 3;
        const allPositions = result.matchesFound.flatMap(m => m.positions);

        // Sounds — keep the same cadence the live game uses.
        playMatchSound(result.scoreGained, result.combo, maxMatchSize);

        for (let i = 0; i < result.specialTilesTriggered.length; i++) {
            const sp = result.specialTilesTriggered[i];
            setTimeout(() => {
                if (sp.type === "bomb") playBombSound();
                else if (sp.type === "cosmic_blast") playCosmicBlastSound();
                else if (sp.type === "vibestreak") playVibestreakSound();
            }, 100 + i * 200);
        }

        for (const sp of result.specialTilesCreated) {
            setTimeout(() => {
                if (sp.type === "bomb") playBombSound();
                else if (sp.type === "cosmic_blast") playCosmicBlastSound();
                else if (sp.type === "vibestreak") playVibestreakSound();
            }, 200);
        }

        if (result.cascadeCount > 0) {
            for (let i = 0; i < result.cascadeCount; i++) {
                setTimeout(() => playCascadeSound(i + 1), 250 + i * 150);
            }
            const landBase = 250 + result.cascadeCount * 150 + 200;
            for (let col = 0; col < 8; col++) {
                setTimeout(() => playTileLandSound(col), landBase + col * 35);
            }
        }

        if (result.shapeBonus?.type) {
            setTimeout(() => playShapeBonusSound(result.shapeBonus!.type), 150);
        }

        // Intensity heuristic mirroring useGame.getIntensity loosely.
        const intensity: MatchEffect["intensity"] =
            result.scoreGained >= 5000 || result.combo >= 4 || maxMatchSize >= 6
                ? "ultra"
                : result.scoreGained >= 2000 || result.combo >= 3 || maxMatchSize >= 5
                    ? "mega"
                    : result.scoreGained >= 800 || result.combo >= 2 || maxMatchSize >= 4
                        ? "big"
                        : "normal";

        // Most-matched badge for the flash-banner copy.
        const badgeCounts = new Map<string, { count: number; name: string }>();
        for (const match of result.matchesFound) {
            const key = match.badge.id;
            const existing = badgeCounts.get(key);
            if (existing) existing.count += match.positions.length;
            else badgeCounts.set(key, { count: match.positions.length, name: match.badge.name });
        }
        let matchedBadgeName: string | undefined;
        let highestCount = 0;
        for (const [, entry] of badgeCounts) {
            if (entry.count > highestCount) {
                highestCount = entry.count;
                matchedBadgeName = entry.name;
            }
        }

        setMatchEffect({
            intensity,
            scoreGained: result.scoreGained,
            combo: result.combo,
            maxMatchSize,
            positions: allPositions,
            timestamp: Date.now(),
            cascadeCount: result.cascadeCount,
            shapeBonusType: result.shapeBonus?.type ?? null,
            matchedBadgeName,
            bonusCapsuleTriggered: false,
        });

        if (matchEffectClearTimer.current) clearTimeout(matchEffectClearTimer.current);
        matchEffectClearTimer.current = setTimeout(
            () => setMatchEffect(null),
            intensity === "ultra" ? 2400 : intensity === "mega" ? 1800 : 1200
        );

        // Score popup
        const popupId = `popup_${popupCounter.current++}`;
        setScorePopups(pops => [
            ...pops,
            { id: popupId, value: result.scoreGained, x: effectPos.col, y: effectPos.row, combo: result.combo },
        ]);
        if (popupClearTimer.current) clearTimeout(popupClearTimer.current);
        popupClearTimer.current = setTimeout(
            () => setScorePopups(pops => pops.filter(p => p.id !== popupId)),
            2600
        );

        setBoard(result.board);
        setScore(s => s + result.scoreGained);
        setCombo(result.combo);
    }, []);

    // Run the current scenario. Re-runs whenever scenarioIdx changes.
    useEffect(() => {
        const scenario = SCENARIOS[scenarioIdx];

        // 1. Snap to the scenario's initial board. New cell IDs guarantee
        //    fresh deal animation rather than incremental cross-fade from
        //    the previous scenario's final state.
        const initial = applyMutations(safeBase, scenario.build(badges, cosmicIdx), badges).map(row =>
            row.map(c => ({ ...c, id: nextDemoId() }))
        );
        setBoard(initial);
        setIsDealing(true);
        setIsAnimating(true);
        setMatchEffect(null);
        setScorePopups([]);
        setCombo(0);

        // Reset score at the start of each loop (scenario 0).
        if (scenarioIdx === 0) {
            setScore(0);
            playGameStartSound();
        }

        // 2. After the deal animation + a beat, fire the swap.
        swapTimer.current = setTimeout(() => {
            setIsDealing(false);
            setSwapAnim({ pos1: scenario.swap.from, pos2: scenario.swap.to });

            // 3. Once the swap CSS finishes, run the engine and apply.
            settleTimer.current = setTimeout(() => {
                setSwapAnim(null);
                const result = processTurn(initial, scenario.swap.from, scenario.swap.to, badges);
                if (result) {
                    applyTurnResult(result, scenario.swap.from);
                } else {
                    // Engine rejected the swap (no match formed). Should not
                    // happen with hand-crafted scenarios; surface visibly so
                    // mis-tuned boards are obvious during dev.
                    console.warn(`[demo] scenario "${scenario.name}" produced no match`);
                }

                // 4. Hold the resulting frame, then advance.
                scenarioTimer.current = setTimeout(() => {
                    setIsAnimating(false);
                    setScenarioIdx(idx => (idx + 1) % SCENARIOS.length);
                }, scenario.holdMs);
            }, SWAP_ANIM_MS);
        }, PRE_SWAP_DELAY_MS + 600); // +600 covers the deal-in stagger

        return () => {
            if (swapTimer.current) clearTimeout(swapTimer.current);
            if (settleTimer.current) clearTimeout(settleTimer.current);
            if (scenarioTimer.current) clearTimeout(scenarioTimer.current);
            if (matchEffectClearTimer.current) clearTimeout(matchEffectClearTimer.current);
            if (popupClearTimer.current) clearTimeout(popupClearTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scenarioIdx]);

    // Synthetic GameState for the HUD. The HUD reads score, movesLeft,
    // combo, etc. — we feed it the demo's running tallies.
    const hudState: GameState = useMemo(() => ({
        board,
        score,
        movesLeft: 30, // pinned at full so the moves bar always reads "30"
        combo,
        maxCombo: combo,
        comboCarry: 0,
        selectedTile: null,
        gameBadges: badges,
        gameMode: "classic",
        gamePhase: "playing",
        matchCount: 0,
        totalCascades: 0,
        gameOverReason: null,
        bonusCapsuleAwarded: false,
        moveLog: [],
        moveSequence: [],
    }), [board, score, combo, badges]);

    // Mirror the live game's layout: HUD left on desktop, top+bottom stacked
    // on mobile, board in the center. No app header — the page is full-bleed
    // so it's clean to record/crop.
    return (
        <div
            className="min-h-screen w-full flex items-center justify-center"
            style={{
                background: "radial-gradient(ellipse at top, #1A0E2E 0%, #0a0418 60%, #050208 100%)",
            }}
        >
            <div className="w-full min-h-screen flex flex-col lg:flex-row items-center justify-center pt-1 pb-2 px-1 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
                {/* Left HUD (desktop) */}
                <div
                    className="hidden lg:flex flex-col justify-center w-56 flex-shrink-0 min-w-0"
                    style={{ height: "min(100vw - 8px, calc(100dvh - 220px), 680px)" }}
                >
                    <GameHUD state={hudState} />
                </div>

                {/* Mobile HUD top */}
                <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pb-1 order-first">
                    <GameHUD state={hudState} hideHighScores />
                </div>

                {/* Board */}
                <div
                    className="flex-shrink-0 relative overflow-visible flex items-center justify-center"
                    style={{
                        height: "min(100vw - 8px, calc(100dvh - 220px), 680px)",
                        width: "min(100vw - 8px, calc(100dvh - 220px), 680px)",
                    }}
                >
                    <div className="absolute inset-0">
                        <GameBoard
                            board={board}
                            selectedTile={null}
                            onTileClick={() => {}}
                            scorePopups={scorePopups}
                            isAnimating={isAnimating}
                            matchEffect={matchEffect}
                            combo={combo}
                            score={score}
                            isDealing={isDealing}
                            swapAnim={swapAnim}
                            isPrizeGame={true}
                        />
                    </div>
                </div>

                {/* Mobile HUD bottom */}
                <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pt-0 pb-2 px-0 sm:px-2">
                    <GameHUD state={hudState} hideMetrics />
                </div>
            </div>
        </div>
    );
}
