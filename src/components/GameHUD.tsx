"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GameState } from "@/lib/gameEngine";
import { useEffect, useState, useRef } from "react";

interface GameHUDProps {
    state: GameState;
    hideMetrics?: boolean;
    hideHighScores?: boolean;
}

const TOTAL_MOVES = 30;

/* ===== SVG Radial Ring for Moves ===== */
function MovesRing({ movesLeft }: { movesLeft: number }) {
    const radius = 52;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius;
    const progress = movesLeft / TOTAL_MOVES;
    const dashOffset = circumference * (1 - progress);

    // Color transitions: green → gold → orange → red
    let strokeColor: string;
    let glowColor: string;
    if (progress > 0.6) {
        strokeColor = "#4ADE80"; // green
        glowColor = "rgba(74,222,128,0.5)";
    } else if (progress > 0.35) {
        strokeColor = "#FFE048"; // gold
        glowColor = "rgba(255,224,72,0.5)";
    } else if (progress > 0.15) {
        strokeColor = "#FF8C00"; // orange
        glowColor = "rgba(255,140,0,0.5)";
    } else {
        strokeColor = "#EF4444"; // red
        glowColor = "rgba(239,68,68,0.6)";
    }

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 120 120"
            style={{ transform: "rotate(-90deg)" }}
        >
            <defs>
                <filter id="ringGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {/* Background track */}
            <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={strokeWidth}
            />
            {/* Animated progress ring */}
            <motion.circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{
                    strokeDashoffset: dashOffset,
                    stroke: strokeColor,
                    filter: `drop-shadow(0 0 6px ${glowColor})`,
                }}
                transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
        </svg>
    );
}

/* ===== Card wrapper for consistent styling ===== */
function HudCard({
    children,
    borderColor = "rgba(123, 80, 184, 0.5)",
    glowColor = "rgba(156, 101, 240, 0.15)",
    className = "",
}: {
    children: React.ReactNode;
    borderColor?: string;
    glowColor?: string;
    className?: string;
}) {
    return (
        <div
            className={`relative w-full rounded-2xl overflow-hidden flex flex-col items-center justify-center ${className}`}
            style={{
                border: `3px solid ${borderColor}`,
                boxShadow: `0 0 20px ${glowColor}, inset 0 4px 10px rgba(255,255,255,0.08)`,
            }}
        >
            {/* Purple gradient background */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    background: "linear-gradient(180deg, #4A1D80 0%, #2E0F58 50%, #1E0840 100%)",
                }}
            />
            {/* Inner highlight shimmer */}
            <div
                className="absolute inset-0 z-0 opacity-30"
                style={{
                    background: "radial-gradient(ellipse at 50% 15%, rgba(180,140,255,0.35) 0%, transparent 60%)",
                }}
            />
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                {children}
            </div>
        </div>
    );
}

export default function GameHUD({ state, hideMetrics = false, hideHighScores = false }: GameHUDProps) {
    const { score, movesLeft, combo, gameMode } = state;

    // Fetch high scores
    const [personalBest, setPersonalBest] = useState<number>(0);
    const [globalBest, setGlobalBest] = useState<number>(0);
    const [globalBestUser, setGlobalBestUser] = useState<string>("");

    useEffect(() => {
        const username = localStorage.getItem('vibematch_username');
        fetch(`/api/scores?mode=${gameMode}`)
            .then(res => res.json())
            .then(data => {
                if (data.scores && data.scores.length > 0) {
                    setGlobalBest(data.scores[0].score);
                    setGlobalBestUser(data.scores[0].username);
                    if (username) {
                        const userScore = data.scores.find((s: { username: string }) => s.username === username);
                        if (userScore) setPersonalBest(userScore.score);
                    }
                }
            })
            .catch(() => { });
    }, [gameMode]);

    // Moves ring color for the border
    const movesProgress = movesLeft / TOTAL_MOVES;
    let movesBorderColor: string;
    let movesGlow: string;
    if (movesProgress > 0.6) {
        movesBorderColor = "#4ADE80";
        movesGlow = "rgba(74,222,128,0.35)";
    } else if (movesProgress > 0.35) {
        movesBorderColor = "#FFE048";
        movesGlow = "rgba(255,224,72,0.35)";
    } else if (movesProgress > 0.15) {
        movesBorderColor = "#FF8C00";
        movesGlow = "rgba(255,140,0,0.35)";
    } else {
        movesBorderColor = "#EF4444";
        movesGlow = "rgba(239,68,68,0.4)";
    }

    // When only showing high scores (mobile bottom row)
    if (hideMetrics) {
        return (
            <div className="flex gap-2">
                <HudCard className="flex-1 p-2">
                    <div className="text-[#B399D4] text-[9px] font-black tracking-[0.15em] font-mundial mb-1">YOUR BEST</div>
                    <div className="font-display text-xl font-black text-[#FFE048]" style={{ textShadow: "0 0 12px rgba(255,224,72,0.3)" }}>{personalBest > 0 ? personalBest.toLocaleString() : '—'}</div>
                </HudCard>
                <HudCard className="flex-1 p-2">
                    <div className="text-[#B399D4] text-[9px] font-black tracking-[0.15em] font-mundial mb-1">GLOBAL BEST</div>
                    <div className="font-display text-xl font-black text-[#C48CFF]" style={{ textShadow: "0 0 12px rgba(196,140,255,0.3)" }}>{globalBest > 0 ? globalBest.toLocaleString() : '—'}</div>
                </HudCard>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full justify-between gap-2.5 sm:gap-3 w-full">

            {/* Mobile metrics row (top HUD on mobile) */}
            {hideHighScores && (
                <div className="flex gap-2 w-full">
                    {/* Score */}
                    <HudCard className="flex-1 p-2">
                        <div className="text-[#B399D4] text-[9px] font-black tracking-[0.15em] font-mundial mb-1">SCORE</div>
                        <motion.div className="font-display text-2xl font-black leading-none text-center" key={score} style={{ color: "#FFE048", WebkitTextStroke: "1px #c9a84c", textShadow: "0 2px 0 #8b6b15, 0 0 15px rgba(255, 224, 72, 0.4)" }}>
                            {score.toLocaleString()}
                        </motion.div>
                    </HudCard>
                    {/* Moves */}
                    <HudCard borderColor={movesBorderColor} glowColor={movesGlow} className="flex-1 p-2">
                        <div className="text-[#B399D4] text-[9px] font-black tracking-[0.15em] font-mundial mb-1">MOVES</div>
                        <AnimatePresence mode="popLayout">
                            <motion.div key={movesLeft} className={`font-display text-3xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"}`} style={{ textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                                {movesLeft}
                            </motion.div>
                        </AnimatePresence>
                    </HudCard>
                    {/* Combo */}
                    <HudCard className="flex-1 p-2">
                        <div className="text-[#B399D4] text-[9px] font-black tracking-[0.15em] font-mundial mb-1">COMBO</div>
                        <AnimatePresence mode="popLayout">
                            <motion.div key={combo} className={`font-display text-3xl font-black leading-none ${combo >= 3 ? "text-[#FF5F1F]" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"}`}>
                                {combo > 0 ? combo : "—"}
                            </motion.div>
                        </AnimatePresence>
                    </HudCard>
                </div>
            )}

            {/* Desktop-only cards below */}
            {!hideHighScores && (
                <>
                    {/* Score Card */}
                    <HudCard className="flex-[1.3] min-h-0 py-3">
                        <div className="text-[#B399D4] text-xs sm:text-sm font-black tracking-[0.2em] font-mundial mb-1">
                            SCORE
                        </div>
                        <motion.div
                            className="font-display text-4xl sm:text-5xl font-black leading-none text-center"
                            key={score}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 15 }}
                            style={{
                                color: "#FFE048",
                                WebkitTextStroke: "1px #c9a84c",
                                textShadow: "0 4px 0 #8b6b15, 0 8px 10px rgba(0,0,0,0.8), 0 0 30px rgba(255, 224, 72, 0.4)",
                            }}
                        >
                            {score.toLocaleString()}
                        </motion.div>
                    </HudCard>

                    {/* Moves Card — with radial ring */}
                    <div className="relative w-full flex-1 min-h-0">
                        <HudCard borderColor={movesBorderColor} glowColor={movesGlow} className="h-full py-3">
                            <div className="text-[#B399D4] text-xs sm:text-sm font-black tracking-[0.2em] font-mundial mb-1">
                                MOVES
                            </div>
                            <div className="relative">
                                {/* SVG Ring behind the number */}
                                <div className="absolute -inset-5 sm:-inset-6">
                                    <MovesRing movesLeft={movesLeft} />
                                </div>
                                <AnimatePresence mode="popLayout">
                                    <motion.div
                                        key={movesLeft}
                                        className={`font-display text-5xl sm:text-6xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"}`}
                                        style={{ textShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                                        initial={{ scale: 1.4, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.6, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                    >
                                        {movesLeft}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </HudCard>
                    </div>

                    {/* Combo Card */}
                    <HudCard className="flex-[0.8] min-h-0 py-3">
                        <div className="text-[#B399D4] text-xs sm:text-sm font-black tracking-[0.2em] font-mundial mb-1">
                            COMBO
                        </div>
                        <AnimatePresence mode="popLayout">
                            <motion.div
                                key={combo}
                                className={`font-display text-4xl sm:text-5xl font-black leading-none ${combo >= 3 ? "text-[#FF5F1F]" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"}`}
                                style={{ textShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                                initial={{ scale: 2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                            >
                                {combo > 0 ? `×${combo}` : "—"}
                            </motion.div>
                        </AnimatePresence>
                    </HudCard>

                    {/* High Scores Card */}
                    <HudCard className="flex-1 min-h-0 py-3">
                        <div className="flex flex-col items-center w-full">
                            <div className="text-[#B399D4] text-xs sm:text-[13px] font-black tracking-[0.2em] font-mundial mb-0.5">
                                YOUR BEST
                            </div>
                            <div className="font-display text-2xl sm:text-3xl font-black text-[#FFE048]" style={{ textShadow: '0 0 15px rgba(255,224,72,0.4), 0 2px 4px rgba(0,0,0,0.5)' }}>
                                {personalBest > 0 ? personalBest.toLocaleString() : '—'}
                            </div>
                        </div>

                        <div className="w-2/3 h-px bg-white/10 my-2" />

                        <div className="flex flex-col items-center w-full">
                            <div className="text-[#B399D4] text-xs sm:text-[13px] font-black tracking-[0.2em] font-mundial mb-0.5">
                                GLOBAL BEST
                            </div>
                            <div className="font-display text-xl sm:text-2xl font-black text-[#C48CFF]" style={{ textShadow: '0 0 15px rgba(196,140,255,0.3), 0 2px 4px rgba(0,0,0,0.5)' }}>
                                {globalBest > 0 ? globalBest.toLocaleString() : '—'}
                            </div>
                        </div>
                    </HudCard>
                </>
            )}
        </div>
    );
}
