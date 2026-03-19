"use client";

import { useState, useCallback, useRef } from "react";
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
    bonusCapsuleTriggered?: boolean;
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
    startGame: (mode: GameMode) => void;
    startGameWithBadges: (mode: GameMode, badges: Badge[]) => void;
    resetGame: () => void;
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
        const seen = new Set<string>();
        const promises: Promise<void>[] = [];
        for (const badge of badges) {
            if (seen.has(badge.image)) continue;
            seen.add(badge.image);
            // Preload both the original and the Next.js optimized URL (96px width)
            // so the browser cache is warm for whichever the Image component requests
            const optimizedUrl = `/_next/image?url=${encodeURIComponent(badge.image)}&w=96&q=75`;
            for (const src of [badge.image, optimizedUrl]) {
                promises.push(new Promise((resolve) => {
                    const img = new window.Image();
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // don't block on failure
                    img.src = src;
                }));
            }
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

    const startGame = useCallback((mode: GameMode) => {
        const initialState = createInitialState(mode);
        preloadBadgeImages(initialState.gameBadges).then(() => {
            applyStartState(initialState);
        });
    }, [preloadBadgeImages, applyStartState]);

    const startGameWithBadges = useCallback((mode: GameMode, badges: Badge[]) => {
        const initialState = createInitialState(mode, badges);
        preloadBadgeImages(initialState.gameBadges).then(() => {
            applyStartState(initialState);
        });
    }, [preloadBadgeImages, applyStartState]);

    const resetGame = useCallback(() => {
        hintShownThisGame.current = false;
        const mode = state?.gameMode ?? "classic";
        const s = createInitialState(mode);
        preloadBadgeImages(s.gameBadges).then(() => {
            setState(s);
            resetHintTimer(s.board);
            setScorePopups([]);
            setLastTurnResult(null);
            setMatchEffect(null);
            setIsAnimating(false);
            setHintMessage(null);
            playGameStartSound();
        });
    }, [state?.gameMode, resetHintTimer, preloadBadgeImages]);

    // Shared helper: apply a TurnResult to game state with effects
    const applyResult = useCallback((
        prev: GameState,
        result: TurnResult,
        effectPos: Position,
        costMove: boolean,
    ): GameState => {
        const newMovesLeft = costMove ? prev.movesLeft - 1 : prev.movesLeft;
        const newScore = prev.score + result.scoreGained;
        const newMatchCount = prev.matchCount + result.matchesFound.length;
        const newMaxCombo = Math.max(prev.maxCombo, result.combo);
        const maxMatchSize = Math.max(...result.matchesFound.map(m => m.positions.length));
        const allPositions = result.matchesFound.flatMap(m => m.positions);

        // Play match sounds (escalated)
        playMatchSound(result.scoreGained, result.combo, maxMatchSize);

        // Play special tile sounds
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

        // Find the most common badge name across all matches for the flash effect
        const badgeCounts = new Map<string, { count: number; name: string }>();
        for (const match of result.matchesFound) {
            const key = match.badge.id;
            const existing = badgeCounts.get(key);
            if (existing) {
                existing.count += match.positions.length;
            } else {
                badgeCounts.set(key, { count: match.positions.length, name: match.badge.name });
            }
        }
        let matchedBadgeName: string | undefined;
        let highestCount = 0;
        for (const [, entry] of badgeCounts) {
            if (entry.count > highestCount) {
                highestCount = entry.count;
                matchedBadgeName = entry.name;
            }
        }

        // Check for T/cross bonus capsule (capped at 1 per game)
        const isBonusShape = result.shapeBonus?.type === 'T' || result.shapeBonus?.type === 'cross';
        const bonusCapsuleTriggered = isBonusShape && !prev.bonusCapsuleAwarded;

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
            bonusCapsuleTriggered,
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

        // Add score popup
        const popupId = `popup_${popupCounter.current++}`;
        setScorePopups((pops) => [
            ...pops,
            {
                id: popupId,
                value: result.scoreGained,
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

        // Check game over
        const noMovesLeft = newMovesLeft <= 0;
        const noValidMoves = !noMovesLeft && !hasValidMoves(result.board);
        const gameOver = noMovesLeft || noValidMoves;

        // Start animation sequence
        setIsAnimating(true);

        if (gameOver) {
            // Wind-down delay: keep isAnimating true to block input,
            // then transition to gameover after effects play out
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
                // Clear stale dropDistance so animation-fill-mode doesn't block future swap transitions
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
            gamePhase: "playing", // stays "playing" during wind-down; setTimeout sets "gameover"
            gameOverReason: prev.gameOverReason,
            matchCount: newMatchCount,
            totalCascades: prev.totalCascades + result.cascadeCount,
            bonusCapsuleAwarded: prev.bonusCapsuleAwarded || bonusCapsuleTriggered,
        };
    }, []);

    const selectTile = useCallback(
        (pos: Position) => {
            if (!state || state.gamePhase !== "playing" || isAnimating) return;
            setHintCells(new Set());
            setHintMessage(null);

            // Check if clicked tile is a special tile — activate it immediately
            const clickedCell = state.board[pos.row]?.[pos.col];
            if (clickedCell?.isSpecial) {
                const result = triggerSpecialTile(state.board, pos, state.gameBadges);
                if (result) {
                    if (clickedCell.isSpecial === "bomb") playBombSound();
                    else if (clickedCell.isSpecial === "cosmic_blast") playCosmicBlastSound();
                    else if (clickedCell.isSpecial === "vibestreak") playVibestreakSound();
                    else playBombSound();
                    setState(prev => prev ? applyResult(prev, result, pos, true) : prev);
                    return;
                }
            }

            // No tile selected yet — select this one
            if (!state.selectedTile) {
                playSelectSound();
                setState({ ...state, selectedTile: pos });
                return;
            }

            // Clicking same tile — deselect
            if (state.selectedTile.row === pos.row && state.selectedTile.col === pos.col) {
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
                setState(prev => prev ? applyResult(prev, result, pos, true) : prev);
            }, isMobile ? 280 : 240);
        },
        [state, isAnimating, applyResult, resetHintTimer, isMobile]
    );

    const swipeTiles = useCallback(
        (from: Position, to: Position) => {
            if (!state || state.gamePhase !== "playing" || isAnimating) return;
            if (!isAdjacentSwap(from, to)) return;
            setHintCells(new Set());
            setHintMessage(null);

            // Check if source is a special tile — activate it
            const fromCell = state.board[from.row]?.[from.col];
            if (fromCell?.isSpecial) {
                const result = triggerSpecialTile(state.board, from, state.gameBadges);
                if (result) {
                    if (fromCell.isSpecial === "bomb") playBombSound();
                    else if (fromCell.isSpecial === "cosmic_blast") playCosmicBlastSound();
                    else if (fromCell.isSpecial === "vibestreak") playVibestreakSound();
                    else playBombSound();
                    setState(prev => prev ? applyResult(prev, result, from, true) : prev);
                    return;
                }
            }

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
                setState(prev => prev ? applyResult(prev, result, to, true) : prev);
            }, isMobile ? 280 : 240);
        },
        [state, isAnimating, applyResult, resetHintTimer, isMobile]
    );

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
