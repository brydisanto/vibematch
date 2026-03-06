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

    // Sequentially apply board steps with delays to allow animations to play
    const applySteps = useCallback(async (
        initialState: GameState,
        result: TurnResult,
        effectPos: Position,
        costMove: boolean,
    ) => {
        setIsAnimating(true);
        const movesAfterTurn = costMove ? initialState.movesLeft - 1 : initialState.movesLeft;
        let currentScore = initialState.score;
        let currentMatchCount = initialState.matchCount;

        // Process each step returned by the engine
        for (let i = 0; i < result.steps.length; i++) {
            const step = result.steps[i];
            const isLast = i === result.steps.length - 1;

            // 1. Play sounds for specific step types
            if (step.type === "match" && step.matchesFound) {
                const stepScore = step.scoreGained || 0;
                const maxMatchSize = Math.max(...step.matchesFound.map(m => m.positions.length));
                playMatchSound(stepScore, i / 2, maxMatchSize); // Approximation of combo
                currentScore += stepScore;
                currentMatchCount += step.matchesFound.length;

                // Set match effect for visual layer
                const allPositions = step.matchesFound.flatMap(m => m.positions);
                const intensity = getIntensity(stepScore, i / 2, maxMatchSize);
                setMatchEffect({
                    intensity,
                    scoreGained: stepScore,
                    combo: Math.floor(i / 2) + 1,
                    maxMatchSize,
                    positions: allPositions,
                    timestamp: Date.now(),
                });

                // Add score popup
                const popupId = `popup_${popupCounter.current++}`;
                setScorePopups(pops => [...pops, { id: popupId, value: stepScore, x: effectPos.col, y: effectPos.row }]);
                setTimeout(() => setScorePopups(pops => pops.filter(p => p.id !== popupId)), 2000);

                // Haptic feedback
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate(intensity === "ultra" ? [50, 30, 80] : intensity === "mega" ? [50] : [30]);
                }
            } else if (step.type === "special") {
                playBombSound();
                currentScore += step.scoreGained || 0;
            } else if (step.type === "gravity" && i > 1) {
                // Secondary gravity in cascades
                playCascadeSound(Math.floor(i / 2));
            }

            // 2. Update board state
            setState(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    board: step.board,
                    score: currentScore,
                    matchCount: currentMatchCount,
                    movesLeft: movesAfterTurn,
                    combo: Math.floor(i / 2) + (step.type === "match" ? 1 : 0),
                    // If last step, sync gamePhase
                    gamePhase: isLast && (movesAfterTurn <= 0 || !hasValidMoves(step.board)) ? "gameover" : "playing"
                };
            });

            // 3. Wait for animation to finish before next step
            const delay = step.type === "swap" ? 280
                : step.type === "match" ? 450
                    : step.type === "special" ? 500
                        : 400; // gravity
            await new Promise(resolve => setTimeout(resolve, delay));

            if (step.type === "match") setMatchEffect(null);
        }

        setIsAnimating(false);
        setLastTurnResult(result);

        // Final game over check/sound
        setState(final => {
            if (final?.gamePhase === "gameover") {
                playGameOverSound();
            }
            return final;
        });
    }, []);

    const selectTile = useCallback(
        (pos: Position) => {
            if (!state || state.gamePhase !== "playing" || isAnimating) return;

            // Check if clicked tile is a special tile
            const clickedCell = state.board[pos.row]?.[pos.col];
            if (clickedCell?.isSpecial) {
                const result = triggerSpecialTile(state.board, pos, state.gameBadges);
                if (result) {
                    applySteps(state, result, pos, true);
                    return;
                }
            }

            // No selection
            if (!state.selectedTile) {
                playSelectSound();
                setState(prev => prev ? ({ ...prev, selectedTile: pos }) : null);
                return;
            }

            // Same tile
            if (state.selectedTile.row === pos.row && state.selectedTile.col === pos.col) {
                playDeselectSound();
                setState(prev => prev ? ({ ...prev, selectedTile: null }) : null);
                return;
            }

            // Adjacent swap
            if (isAdjacentSwap(state.selectedTile, pos)) {
                const result = processTurn(state.board, state.selectedTile, pos, state.gameBadges);
                if (!result) {
                    playInvalidSwapSound();
                    setState(prev => prev ? ({ ...prev, selectedTile: null }) : null);
                    return;
                }
                applySteps(state, result, pos, true);
            } else {
                // Non-adjacent, just reselect
                playSelectSound();
                setState(prev => prev ? ({ ...prev, selectedTile: pos }) : null);
            }
        },
        [state, isAnimating, applySteps]
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
