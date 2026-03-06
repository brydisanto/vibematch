"use client";

import { useState, useCallback, useRef } from "react";
import {
    GameState,
    GameMode,
    Position,
    TurnResult,
    createInitialState,
    isAdjacentSwap,
    processTurn,
    triggerSpecialTile,
    hasValidMoves,
} from "./gameEngine";
import {
    playSelectSound,
    playDeselectSound,
    playInvalidSwapSound,
    playMatchSound,
    playBombSound,
    playCosmicBlastSound,
    playGameOverSound,
    playCascadeSound,
} from "./sounds";

export interface ScorePopup {
    id: string;
    value: number;
    x: number;
    y: number;
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
}

export interface UseGameReturn {
    state: GameState | null;
    scorePopups: ScorePopup[];
    lastTurnResult: TurnResult | null;
    matchEffect: MatchEffect | null;
    isAnimating: boolean;
    selectTile: (pos: Position) => void;
    startGame: (mode: GameMode) => void;
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
    const popupCounter = useRef(0);

    const startGame = useCallback((mode: GameMode) => {
        setState(createInitialState(mode));
        setScorePopups([]);
        setLastTurnResult(null);
        setMatchEffect(null);
        setIsAnimating(false);
    }, []);

    const resetGame = useCallback(() => {
        setState((prev) => prev ? createInitialState(prev.gameMode) : null);
        setScorePopups([]);
        setLastTurnResult(null);
        setMatchEffect(null);
        setIsAnimating(false);
    }, []);

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
                if (special.type === "cosmic_blast") playCosmicBlastSound();
            }, 200);
        }

        // Play cascade sounds
        if (result.cascadeCount > 0) {
            for (let i = 0; i < result.cascadeCount; i++) {
                setTimeout(() => playCascadeSound(i + 1), 250 + i * 150);
            }
        }

        // Calculate match intensity for visual effects
        const intensity = getIntensity(result.scoreGained, result.combo, maxMatchSize);

        // Set match effect for board to consume
        setMatchEffect({
            intensity,
            scoreGained: result.scoreGained,
            combo: result.combo,
            maxMatchSize,
            positions: allPositions,
            timestamp: Date.now(),
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
        setTimeout(() => setMatchEffect(null), intensity === "ultra" ? 1800 : intensity === "mega" ? 1200 : 800);

        // Add score popup
        const popupId = `popup_${popupCounter.current++}`;
        setScorePopups((pops) => [
            ...pops,
            {
                id: popupId,
                value: result.scoreGained,
                x: effectPos.col,
                y: effectPos.row,
            },
        ]);

        // Remove popup after animation
        setTimeout(() => {
            setScorePopups((pops) => pops.filter((p) => p.id !== popupId));
        }, 2000);

        setLastTurnResult(result);

        // Start animation sequence
        setIsAnimating(true);
        setTimeout(() => {
            setIsAnimating(false);
        }, 500);

        // Check game over
        const gameOver = newMovesLeft <= 0 || !hasValidMoves(result.board);

        if (gameOver) {
            setTimeout(() => playGameOverSound(), 600);
        }

        return {
            ...prev,
            board: result.board,
            score: newScore,
            movesLeft: newMovesLeft,
            combo: result.combo,
            maxCombo: newMaxCombo,
            selectedTile: null,
            gamePhase: gameOver ? "gameover" : "playing",
            matchCount: newMatchCount,
        };
    }, []);

    const selectTile = useCallback(
        (pos: Position) => {
            if (!state || state.gamePhase !== "playing" || isAnimating) return;

            setState((prev) => {
                if (!prev) return prev;

                // Check if clicked tile is a special tile — activate it immediately
                const clickedCell = prev.board[pos.row]?.[pos.col];
                if (clickedCell?.isSpecial) {
                    const result = triggerSpecialTile(prev.board, pos, prev.gameBadges);
                    if (result) {
                        // Play the appropriate special tile sound
                        if (clickedCell.isSpecial === "bomb") playBombSound();
                        else if (clickedCell.isSpecial === "cosmic_blast") playCosmicBlastSound();
                        else playBombSound(); // vibestreak uses bomb-like sound

                        return applyResult(prev, result, pos, true);
                    }
                }

                // No tile selected yet — select this one
                if (!prev.selectedTile) {
                    playSelectSound();
                    return { ...prev, selectedTile: pos };
                }

                // Clicking same tile — deselect
                if (
                    prev.selectedTile.row === pos.row &&
                    prev.selectedTile.col === pos.col
                ) {
                    playDeselectSound();
                    return { ...prev, selectedTile: null };
                }

                // Not adjacent — reselect new tile
                if (!isAdjacentSwap(prev.selectedTile, pos)) {
                    playSelectSound();
                    return { ...prev, selectedTile: pos };
                }

                // Adjacent tile — attempt swap
                const result = processTurn(
                    prev.board,
                    prev.selectedTile,
                    pos,
                    prev.gameBadges
                );

                if (!result) {
                    // Invalid swap — no match. Deselect
                    playInvalidSwapSound();
                    return { ...prev, selectedTile: null };
                }

                return applyResult(prev, result, pos, true);
            });
        },
        [state, isAnimating, applyResult]
    );

    return {
        state,
        scorePopups,
        lastTurnResult,
        matchEffect,
        isAnimating,
        selectTile,
        startGame,
        resetGame,
    };
}
