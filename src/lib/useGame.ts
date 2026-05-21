"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
    GameState,
    GameMode,
    Position,
    TurnResult,
    Cell,
    createInitialState,
    isAdjacentSwap,
    processTurn,
    triggerSpecialTile,
    hasValidMoves,
    findBestHint,
    computeFrenzyBonusMs,
    FRENZY_MAX_MS,
    FRENZY_HEAT_WINDOW_MS,
    FRENZY_HEAT_TRIGGER_COUNT,
    FRENZY_HEAT_DURATION_MS,
} from "./gameEngine";
import { Badge } from "./badges";
import {
    playSelectSound,
    playDeselectSound,
    playInvalidSwapSound,
    playMatchSound,
    playBombSound,
    playCosmicBlastSound,
    playVibestreakSound,
    playGameOverSound,
    playCascadeSound,
    playShapeBonusSound,
    playHintSound,
    playFinalMoveWarning,
    playGameStartSound,
    playTileLandSound,
} from "./sounds";

export interface ScorePopup {
    id: string;
    value: number;
    x: number;
    y: number;
    combo: number;
}

// Intensity level for match effects — drives animations + haptics
export type MatchIntensity = "normal" | "big" | "mega" | "ultra";

export interface MatchEffect {
    intensity: MatchIntensity;
    scoreGained: number;
    combo: number;
    maxMatchSize: number;
    positions: { row: number; col: number }[];
    timestamp: number;
    cascadeCount: number;
    shapeBonusType?: 'L' | 'T' | 'cross' | null;
    matchedBadgeName?: string;
    /** Tier of the dominant matched badge — drives particle color in
     *  MatchParticles so the burst tells the player WHICH tier they
     *  popped without reading any text. */
    matchedBadgeTier?: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special';
    bonusCapsuleTriggered?: boolean;
    /** Power tiles spawned this turn (from 4+ matches) — drives the
     *  big "BOMB CREATED" / "LASER PARTY" / "COSMIC BLAST" slam-in
     *  label + ring at the spawn position. */
    specialTilesCreated?: { pos: { row: number; col: number }; type: 'bomb' | 'vibestreak' | 'cosmic_blast' }[];
    /** Power tiles that detonated this turn — drives the tinted full-
     *  screen flash (red for bomb, cyan for laser, purple for cosmic). */
    specialTilesTriggered?: { pos: { row: number; col: number }; type: 'bomb' | 'vibestreak' | 'cosmic_blast' }[];
}

export interface UseGameReturn {
    state: GameState | null;
    scorePopups: ScorePopup[];
    lastTurnResult: TurnResult | null;
    matchEffect: MatchEffect | null;
    isAnimating: boolean;
    hintCells: Set<string>;
    hintMessage: string | null;
    invalidSwapCells: { row: number; col: number }[] | null;
    swapAnim: { pos1: Position; pos2: Position } | null;
    selectTile: (pos: Position) => void;
    swipeTiles: (from: Position, to: Position) => void;
    /** Resolves once the initial board state has been set so callers can
     *  defer the view switch and avoid flashing an empty grid while
     *  badge images preload. */
    startGame: (mode: GameMode) => Promise<void>;
    startGameWithBadges: (mode: GameMode, badges: Badge[]) => Promise<void>;
    resetGame: () => Promise<void>;
}

function getIntensity(score: number, combo: number, maxMatchSize: number): MatchIntensity {
    if (maxMatchSize >= 5 || combo >= 4 || score >= 1500) return "ultra";
    if (maxMatchSize >= 4 || combo >= 3 || score >= 800) return "mega";
    if (combo >= 2 || score >= 400) return "big";
    return "normal";
}

export function useGame(): UseGameReturn {
    const [state, setState] = useState<GameState | null>(null);
    const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
    const [lastTurnResult, setLastTurnResult] = useState<TurnResult | null>(null);
    const [matchEffect, setMatchEffect] = useState<MatchEffect | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [hintCells, setHintCells] = useState<Set<string>>(new Set());
    const [invalidSwapCells, setInvalidSwapCells] = useState<{ row: number; col: number }[] | null>(null);
    const [swapAnim, setSwapAnim] = useState<{ pos1: Position; pos2: Position } | null>(null);
    const [hintMessage, setHintMessage] = useState<string | null>(null);
    const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hintMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hintShownThisGame = useRef(false);
    const popupCounter = useRef(0);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const resetHintTimer = useCallback((board: Cell[][]) => {
        if (hintTimer.current) clearTimeout(hintTimer.current);
        if (hintMessageTimer.current) clearTimeout(hintMessageTimer.current);
        setHintCells(new Set());
        setHintMessage(null);

        // Only show hint once per game
        if (hintShownThisGame.current) return;

        // Hint highlight at 8 seconds of idle
        hintTimer.current = setTimeout(() => {
            const hint = findBestHint(board);
            if (hint) {
                setHintCells(new Set([
                    `${hint.pos1.row},${hint.pos1.col}`,
                    `${hint.pos2.row},${hint.pos2.col}`,
                ]));
                playHintSound();
                hintShownThisGame.current = true;
            }
        }, 8000);
    }, []);

    const preloadBadgeImages = useCallback((badges: Badge[]): Promise<void> => {
        // Tiles render with a plain <img>, not Next's optimizer. So we only
        // need to warm the cache for the raw badge URL — the prior dual-URL
        // fetch (raw + /_next/image?...) was paying for an optimizer URL the
        // <img> never actually requests, doubling network work for no benefit.
        // We use decode() rather than just onload so the bitmap is decoded
        // and ready to paint the moment the board mounts. Without decode(),
        // tiles can render briefly empty while the browser does the decode
        // step on first paint.
        const seen = new Set<string>();
        const promises: Promise<void>[] = [];
        for (const badge of badges) {
            if (seen.has(badge.image)) continue;
            seen.add(badge.image);
            const img = new window.Image();
            img.src = badge.image;
            const p = img.decode
                ? img.decode().catch(() => undefined)
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            promises.push(Promise.resolve(p).then(() => undefined));
        }
        return Promise.all(promises).then(() => {});
    }, []);

    const applyStartState = useCallback((initialState: GameState) => {
        setState(initialState);
        setScorePopups([]);
        setLastTurnResult(null);
        setMatchEffect(null);
        setIsAnimating(false);
        setHintMessage(null);
        hintShownThisGame.current = false;
        resetHintTimer(initialState.board);
        playGameStartSound();
    }, [resetHintTimer]);

    const startGame = useCallback(async (mode: GameMode) => {
        const initialState = createInitialState(mode);
        await preloadBadgeImages(initialState.gameBadges);
        applyStartState(initialState);
    }, [preloadBadgeImages, applyStartState]);

    const startGameWithBadges = useCallback(async (mode: GameMode, badges: Badge[]) => {
        const initialState = createInitialState(mode, badges);
        await preloadBadgeImages(initialState.gameBadges);
        applyStartState(initialState);
    }, [preloadBadgeImages, applyStartState]);

    const resetGame = useCallback(async () => {
        hintShownThisGame.current = false;
        const mode = state?.gameMode ?? "classic";
        const s = createInitialState(mode);
        await preloadBadgeImages(s.gameBadges);
        setState(s);
        resetHintTimer(s.board);
        setScorePopups([]);
        setLastTurnResult(null);
        setMatchEffect(null);
        setIsAnimating(false);
        setHintMessage(null);
        playGameStartSound();
    }, [state?.gameMode, resetHintTimer, preloadBadgeImages]);

    // Shared helper: apply a TurnResult to game state with effects
    /**
     * Hit-stop budget by match intensity. The board's actual state update
     * is deferred by this many ms after the impact effects fire, so the
     * player sees the matched tiles flash IN PLACE for a beat before they
     * dissolve into the cascade. Single most underrated juice trick — the
     * micro-pause makes mega+ matches feel weighty.
     */
    const getHitStopMs = useCallback((intensity: MatchIntensity): number => {
        if (intensity === "ultra") return 130;
        if (intensity === "mega") return 80;
        return 0;
    }, []);

    /**
     * Fires the immediate side-effects of a match result: sounds, haptic,
     * matchEffect (drives the visual flash + particles + ring burst),
     * score popup, and isAnimating=true. Returns the computed intensity
     * so the caller can decide hit-stop length.
     *
     * Split out from the state-update path so we can fire effects NOW
     * (during the swap-anim → settle window) but defer the actual board
     * state update by hit-stop ms on bigger matches. The board sits in
     * its post-swap state during the freeze, the flash plays on the
     * matched cells, then the cascade plays out.
     */
    const triggerMatchEffects = useCallback((
        result: TurnResult,
        effectPos: Position,
        costMove: boolean,
        prevMovesLeft: number,
        prevBonusCapsuleAwarded: boolean,
        scoreMultiplier: number = 1,
    ): MatchIntensity => {
        const newMovesLeft = costMove ? prevMovesLeft - 1 : prevMovesLeft;
        const realMatches = result.matchesFound.filter(m => m.positions.length <= 8);
        const maxMatchSize = realMatches.length > 0 ? Math.max(...realMatches.map(m => m.positions.length)) : 3;
        const allPositions = result.matchesFound.flatMap(m => m.positions);

        // Play match sounds (escalated)
        playMatchSound(result.scoreGained, result.combo, maxMatchSize);

        // Play sounds for special tiles that detonated (chain reactions)
        for (let i = 0; i < result.specialTilesTriggered.length; i++) {
            const special = result.specialTilesTriggered[i];
            setTimeout(() => {
                if (special.type === "bomb") playBombSound();
                else if (special.type === "cosmic_blast") playCosmicBlastSound();
                else if (special.type === "vibestreak") playVibestreakSound();
            }, 100 + i * 200);
        }

        // Play special tile creation sounds
        for (const special of result.specialTilesCreated) {
            setTimeout(() => {
                if (special.type === "bomb") playBombSound();
                else if (special.type === "cosmic_blast") playCosmicBlastSound();
                else if (special.type === "vibestreak") playVibestreakSound();
            }, 200);
        }

        // Play cascade sounds + tile land sounds
        if (result.cascadeCount > 0) {
            for (let i = 0; i < result.cascadeCount; i++) {
                setTimeout(() => playCascadeSound(i + 1), 250 + i * 150);
            }
            // Staggered tile land sounds after final cascade settles
            const landBase = 250 + result.cascadeCount * 150 + 200;
            for (let col = 0; col < 8; col++) {
                setTimeout(() => playTileLandSound(col), landBase + col * 35);
            }
        }

        // Play shape bonus sound
        if (result.shapeBonus?.type) {
            setTimeout(() => playShapeBonusSound(result.shapeBonus!.type), 150);
        }

        // Final move warning sound
        if (costMove && newMovesLeft >= 1 && newMovesLeft <= 3) {
            setTimeout(() => playFinalMoveWarning(newMovesLeft), 600);
        }

        // Calculate match intensity for visual effects
        const intensity = getIntensity(result.scoreGained, result.combo, maxMatchSize);

        // Find the most common badge across all matches for flash + tinted
        // particles. Track tier alongside name so MatchParticles can color
        // the burst by the dominant matched tier (gold burst on a gold-tier
        // match, cosmic burst on cosmic, etc).
        const badgeCounts = new Map<string, { count: number; name: string; tier: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special' }>();
        for (const match of result.matchesFound) {
            const key = match.badge.id;
            const existing = badgeCounts.get(key);
            if (existing) {
                existing.count += match.positions.length;
            } else {
                badgeCounts.set(key, { count: match.positions.length, name: match.badge.name, tier: match.badge.tier });
            }
        }
        let matchedBadgeName: string | undefined;
        let matchedBadgeTier: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special' | undefined;
        let highestCount = 0;
        for (const [, entry] of badgeCounts) {
            if (entry.count > highestCount) {
                highestCount = entry.count;
                matchedBadgeName = entry.name;
                matchedBadgeTier = entry.tier;
            }
        }

        // Check for T/cross bonus capsule (capped at 1 per game)
        const isBonusShape = result.shapeBonus?.type === 'T' || result.shapeBonus?.type === 'cross';
        const bonusCapsuleTriggered = isBonusShape && !prevBonusCapsuleAwarded;

        // Set match effect for board to consume
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
            matchedBadgeTier,
            bonusCapsuleTriggered,
            specialTilesCreated: result.specialTilesCreated.map(s => ({ pos: s.pos, type: s.type })),
            specialTilesTriggered: result.specialTilesTriggered,
        });

        // Haptic feedback on mobile
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            const pattern =
                intensity === "ultra" ? [50, 30, 80]
                    : intensity === "mega" ? [50]
                        : intensity === "big" ? [30]
                            : [15];
            navigator.vibrate(pattern);
        }

        // Clear match effect after animation
        setTimeout(() => setMatchEffect(null), intensity === "ultra" ? 2400 : intensity === "mega" ? 1800 : 1200);

        // Add score popup. scoreMultiplier surfaces Frenzy's heat 2x so
        // the floating number matches what the score tile actually adds.
        const popupId = `popup_${popupCounter.current++}`;
        setScorePopups((pops) => [
            ...pops,
            {
                id: popupId,
                value: Math.round(result.scoreGained * scoreMultiplier),
                x: effectPos.col,
                y: effectPos.row,
                combo: result.combo,
            },
        ]);

        // Remove popup after animation
        setTimeout(() => {
            setScorePopups((pops) => pops.filter((p) => p.id !== popupId));
        }, 2600);

        setLastTurnResult(result);

        // Start animation sequence — blocks new input until cascade settles.
        setIsAnimating(true);

        return intensity;
    }, []);

    /**
     * Pure state update for a turn result. No side effects — those fire
     * via triggerMatchEffects(). Returns the next GameState. Schedules
     * its own settle / game-over timers internally.
     */
    const applyResultState = useCallback((
        prev: GameState,
        result: TurnResult,
        costMove: boolean,
        scoreMultiplier: number = 1,
    ): GameState => {
        const isFrenzy = prev.gameMode === "frenzy";
        // Frenzy doesn't burn moves — the clock is the budget. Keeping
        // movesLeft static avoids the moves-exhausted gameover path.
        const newMovesLeft = isFrenzy ? prev.movesLeft : (costMove ? prev.movesLeft - 1 : prev.movesLeft);
        const adjustedScoreGained = Math.round(result.scoreGained * scoreMultiplier);
        const newScore = prev.score + adjustedScoreGained;
        const newMatchCount = prev.matchCount + result.matchesFound.length;
        const newMaxCombo = Math.max(prev.maxCombo, result.combo);

        // Bonus capsule check — recomputed here since triggerMatchEffects
        // ran on `prev` separately (could be a stale snapshot if hit-stop
        // delayed us). Re-deriving from the current `prev` keeps the
        // bonus flag flipping based on the latest game state.
        const isBonusShape = result.shapeBonus?.type === 'T' || result.shapeBonus?.type === 'cross';
        const bonusCapsuleTriggered = isBonusShape && !prev.bonusCapsuleAwarded;

        // ===== FRENZY UPDATES =====
        // Bonus time from big matches/combos, heat-streak tracking, and
        // first-swap timer arming all live here so a single match resolution
        // updates every Frenzy field atomically.
        let frenzyMsRemaining = prev.frenzyMsRemaining;
        let frenzyBonusMsEarned = prev.frenzyBonusMsEarned;
        let frenzyStartedAt = prev.frenzyStartedAt;
        let frenzyLastMatchAt = prev.frenzyLastMatchAt;
        let frenzyConsecutiveQuickMatches = prev.frenzyConsecutiveQuickMatches;
        let frenzyHeatActiveUntil = prev.frenzyHeatActiveUntil;

        if (isFrenzy && result.matchesFound.length > 0) {
            const now = Date.now();
            // Arm the timer on first valid swap so board-load latency
            // doesn't steal time from the player.
            if (frenzyStartedAt === null) frenzyStartedAt = now;

            const realMatches = result.matchesFound.filter(m => m.positions.length <= 8);
            const largestMatchSize = realMatches.length > 0
                ? Math.max(...realMatches.map(m => m.positions.length))
                : 3;
            const spawnedSpecial = result.specialTilesCreated.length > 0;
            const bonusMs = computeFrenzyBonusMs({
                largestMatchSize,
                spawnedSpecial,
                comboPeak: result.combo,
            });
            if (bonusMs > 0) {
                frenzyMsRemaining = Math.min(FRENZY_MAX_MS, frenzyMsRemaining + bonusMs);
                frenzyBonusMsEarned = frenzyBonusMsEarned + bonusMs;
            }

            // Heat streak: matches within FRENZY_HEAT_WINDOW_MS of the
            // previous one stack. Hitting FRENZY_HEAT_TRIGGER_COUNT arms
            // a one-shot 2x multiplier on the next match.
            const withinWindow = frenzyLastMatchAt !== null && (now - frenzyLastMatchAt) <= FRENZY_HEAT_WINDOW_MS;
            frenzyConsecutiveQuickMatches = withinWindow ? frenzyConsecutiveQuickMatches + 1 : 1;
            // If THIS match consumed heat (scoreMultiplier > 1), clear it.
            if (scoreMultiplier > 1) frenzyHeatActiveUntil = null;
            // Arm heat for the NEXT match if we just hit the trigger.
            if (frenzyConsecutiveQuickMatches >= FRENZY_HEAT_TRIGGER_COUNT) {
                frenzyHeatActiveUntil = now + FRENZY_HEAT_DURATION_MS;
                frenzyConsecutiveQuickMatches = 0;
            }
            frenzyLastMatchAt = now;
        }

        // Game-over wind-down + post-cascade cleanup are scheduled here
        // because they need to fire AFTER the state update applies. Frenzy
        // game-over is driven by the timer effect, not by moves.
        const noMovesLeft = !isFrenzy && newMovesLeft <= 0;
        const noValidMoves = !isFrenzy && !noMovesLeft && !hasValidMoves(result.board);
        const gameOver = noMovesLeft || noValidMoves;

        if (gameOver) {
            setTimeout(() => {
                playGameOverSound();
                setState(prev2 => prev2 ? {
                    ...prev2,
                    gamePhase: "gameover",
                    gameOverReason: noValidMoves ? "no_valid_moves" : "moves_exhausted",
                } : prev2);
                setIsAnimating(false);
            }, 1800);
        } else {
            setTimeout(() => {
                setIsAnimating(false);
                setState(prev2 => {
                    if (!prev2) return prev2;
                    const cleaned = prev2.board.map(row =>
                        row.map(cell => cell.dropDistance ? { ...cell, dropDistance: 0, isNew: false } : cell)
                    );
                    return { ...prev2, board: cleaned };
                });
            }, isMobile ? 120 : 300);
        }

        return {
            ...prev,
            board: result.board,
            score: newScore,
            movesLeft: newMovesLeft,
            combo: result.combo,
            comboCarry: result.comboCarry,
            maxCombo: newMaxCombo,
            selectedTile: null,
            gamePhase: "playing",
            gameOverReason: prev.gameOverReason,
            matchCount: newMatchCount,
            totalCascades: prev.totalCascades + result.cascadeCount,
            bonusCapsuleAwarded: prev.bonusCapsuleAwarded || bonusCapsuleTriggered,
            frenzyMsRemaining,
            frenzyBonusMsEarned,
            frenzyStartedAt,
            frenzyLastMatchAt,
            frenzyConsecutiveQuickMatches,
            frenzyHeatActiveUntil,
        };
    }, [isMobile]);

    /**
     * Convenience wrapper for paths that DON'T need hit-stop (e.g. tap-
     * activated power tiles). Fires effects + applies state immediately.
     */
    const applyResult = useCallback((
        prev: GameState,
        result: TurnResult,
        effectPos: Position,
        costMove: boolean,
    ): GameState => {
        const heatMul = (prev.gameMode === "frenzy"
            && prev.frenzyHeatActiveUntil !== null
            && prev.frenzyHeatActiveUntil > Date.now()) ? 2 : 1;
        triggerMatchEffects(result, effectPos, costMove, prev.movesLeft, prev.bonusCapsuleAwarded, heatMul);
        return applyResultState(prev, result, costMove, heatMul);
    }, [triggerMatchEffects, applyResultState]);

    // Input queueing — when the player taps during the isAnimating
    // window (swap anim + hit-stop + cascade settle = up to ~530ms on
    // an ultra match), the tap was being silently dropped. Felt like
    // "tap does nothing" on mobile especially during cascade-heavy
    // play. Now we buffer the most recent tap intent and replay it
    // the moment input opens. Only the LAST queued tap is kept (so
    // mashing doesn't queue up a backlog) and stale ones (>600ms old)
    // are discarded so the player doesn't get a delayed action they
    // forgot about.
    const queuedTapRef = useRef<{ pos: Position; ts: number } | null>(null);
    const queuedSwipeRef = useRef<{ from: Position; to: Position; ts: number } | null>(null);
    const QUEUE_STALENESS_MS = 600;

    const selectTile = useCallback(
        (pos: Position) => {
            if (!state || state.gamePhase !== "playing") return;
            if (isAnimating) {
                queuedTapRef.current = { pos, ts: performance.now() };
                queuedSwipeRef.current = null;
                return;
            }
            queuedTapRef.current = null;
            setHintCells(new Set());
            setHintMessage(null);

            // No tile selected yet — select this one
            if (!state.selectedTile) {
                playSelectSound();
                setState({ ...state, selectedTile: pos });
                return;
            }

            // Clicking same tile — if special, activate on double-click; otherwise deselect
            if (state.selectedTile.row === pos.row && state.selectedTile.col === pos.col) {
                const cell = state.board[pos.row]?.[pos.col];
                if (cell?.isSpecial) {
                    const result = triggerSpecialTile(state.board, pos, state.gameBadges);
                    if (result) {
                        if (cell.isSpecial === "bomb") playBombSound();
                        else if (cell.isSpecial === "cosmic_blast") playCosmicBlastSound();
                        else if (cell.isSpecial === "vibestreak") playVibestreakSound();
                        else playBombSound();
                        setState(prev => prev ? applyResult(prev, result, pos, true) : prev);
                        return;
                    }
                }
                playDeselectSound();
                setState({ ...state, selectedTile: null });
                return;
            }

            // Not adjacent — reselect new tile
            if (!isAdjacentSwap(state.selectedTile, pos)) {
                playSelectSound();
                setState({ ...state, selectedTile: pos });
                return;
            }

            // Adjacent tile — attempt swap
            const result = processTurn(state.board, state.selectedTile, pos, state.gameBadges, state.comboCarry);

            if (!result) {
                // Invalid swap — no match. Animate bounce then deselect
                playInvalidSwapSound();
                resetHintTimer(state.board);
                setInvalidSwapCells([state.selectedTile, pos]);
                setTimeout(() => setInvalidSwapCells(null), 400);
                setState({ ...state, selectedTile: null });
                return;
            }

            // Valid swap — show slide animation first, then apply turn result
            const swapPos1 = state.selectedTile;
            const swapPos2 = pos;
            resetHintTimer(result.board);
            setSwapAnim({ pos1: swapPos1, pos2: swapPos2 });
            setState({ ...state, selectedTile: null });
            setIsAnimating(true);
            setTimeout(() => {
                setSwapAnim(null);
                // Heat 2x is a one-shot per arming, so we lock the multiplier
                // here against the swap-time snapshot. Hit-stop pipeline:
                // fire match effects (sounds, flash, particles) immediately,
                // then defer the actual board state update by hit-stop ms on
                // mega/ultra so the player sees the matched tiles flash IN
                // PLACE before the cascade.
                const heatMul = (state?.gameMode === "frenzy"
                    && state.frenzyHeatActiveUntil !== null
                    && state.frenzyHeatActiveUntil > Date.now()) ? 2 : 1;
                const intensity = state ? triggerMatchEffects(result, pos, true, state.movesLeft, state.bonusCapsuleAwarded, heatMul) : "normal";
                const hitStop = getHitStopMs(intensity);
                const apply = () => setState(prev => prev ? applyResultState(prev, result, true, heatMul) : prev);
                if (hitStop > 0) setTimeout(apply, hitStop); else apply();
            }, isMobile ? 280 : 240);
        },
        [state, isAnimating, applyResult, applyResultState, triggerMatchEffects, getHitStopMs, resetHintTimer, isMobile]
    );

    const swipeTiles = useCallback(
        (from: Position, to: Position) => {
            if (!state || state.gamePhase !== "playing") return;
            if (!isAdjacentSwap(from, to)) return;
            if (isAnimating) {
                queuedSwipeRef.current = { from, to, ts: performance.now() };
                queuedTapRef.current = null;
                return;
            }
            queuedSwipeRef.current = null;
            setHintCells(new Set());
            setHintMessage(null);

            // Attempt swap
            const result = processTurn(state.board, from, to, state.gameBadges, state.comboCarry);

            if (!result) {
                playInvalidSwapSound();
                resetHintTimer(state.board);
                setInvalidSwapCells([from, to]);
                setTimeout(() => setInvalidSwapCells(null), 400);
                return;
            }

            // Valid swap — animate then apply
            resetHintTimer(result.board);
            setSwapAnim({ pos1: from, pos2: to });
            setState({ ...state, selectedTile: null });
            setIsAnimating(true);
            setTimeout(() => {
                setSwapAnim(null);
                const heatMul = (state?.gameMode === "frenzy"
                    && state.frenzyHeatActiveUntil !== null
                    && state.frenzyHeatActiveUntil > Date.now()) ? 2 : 1;
                const intensity = state ? triggerMatchEffects(result, to, true, state.movesLeft, state.bonusCapsuleAwarded, heatMul) : "normal";
                const hitStop = getHitStopMs(intensity);
                const apply = () => setState(prev => prev ? applyResultState(prev, result, true, heatMul) : prev);
                if (hitStop > 0) setTimeout(apply, hitStop); else apply();
            }, isMobile ? 280 : 240);
        },
        [state, isAnimating, applyResultState, triggerMatchEffects, getHitStopMs, resetHintTimer, isMobile]
    );

    // ===== FRENZY TIMER TICK =====
    // Decrements frenzyMsRemaining every 100ms once the player has made
    // their first valid swap. Animations don't pause the clock — pausing
    // during cascades is exploitable (chain combos to freeze time). When
    // the clock hits zero we flip to gameover with reason "time_expired";
    // any in-flight cascade keeps resolving behind the overlay so its
    // score still lands. No-op for non-frenzy modes.
    // Deps are the "should this interval be alive" signals only. The
    // interval body uses setState's callback form to always read the
    // latest frenzyMsRemaining, so we don't tear down + recreate every
    // 100ms.
    useEffect(() => {
        if (!state) return;
        if (state.gameMode !== "frenzy") return;
        if (state.frenzyStartedAt === null) return;
        if (state.gamePhase !== "playing") return;

        const tick = setInterval(() => {
            setState(prev => {
                if (!prev) return prev;
                if (prev.gameMode !== "frenzy") return prev;
                if (prev.gamePhase !== "playing") return prev;
                const next = Math.max(0, prev.frenzyMsRemaining - 100);
                if (next <= 0) {
                    setTimeout(() => playGameOverSound(), 0);
                    return {
                        ...prev,
                        frenzyMsRemaining: 0,
                        gamePhase: "gameover",
                        gameOverReason: "time_expired",
                    };
                }
                return { ...prev, frenzyMsRemaining: next };
            });
        }, 100);

        return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state?.gameMode, state?.frenzyStartedAt, state?.gamePhase]);

    // Replay queued input when the animating window clears. Only one
    // queued action exists at a time (selectTile / swipeTiles each
    // clear the other when buffering) so we just check both and fire
    // the freshest if not stale.
    useEffect(() => {
        if (isAnimating) return;
        const now = performance.now();
        const tap = queuedTapRef.current;
        const swipe = queuedSwipeRef.current;
        queuedTapRef.current = null;
        queuedSwipeRef.current = null;
        if (swipe && now - swipe.ts <= QUEUE_STALENESS_MS) {
            swipeTiles(swipe.from, swipe.to);
        } else if (tap && now - tap.ts <= QUEUE_STALENESS_MS) {
            selectTile(tap.pos);
        }
    }, [isAnimating, selectTile, swipeTiles]);

    return {
        state,
        scorePopups,
        lastTurnResult,
        matchEffect,
        isAnimating,
        hintCells,
        hintMessage,
        invalidSwapCells,
        swapAnim,
        selectTile,
        swipeTiles,
        startGame,
        startGameWithBadges,
        resetGame,
    };
}
