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

// Utility to format scores with a stylized low-hanging comma
const formatScoreWithCommas = (value: number) => {
    if (value <= 0) return "—";
    const str = value.toLocaleString();
    const parts = str.split(',');
    if (parts.length <= 1) return str;

    return (
        <>
            {parts.map((part, i) => (
                <span key={i}>
                    {part}
                    {i < parts.length - 1 && (
                        <span className="inline-block translate-y-[0.35em] mx-[-0.08em] opacity-80" style={{ fontSize: '0.8em' }}>,</span>
                    )}
                </span>
            ))}
        </>
    );
};

/* ===== Card wrapper for consistent styling ===== */
function HudCard({
    children,
    borderColor = "rgba(179, 102, 255, 0.8)",
    glowColor = "rgba(156, 101, 240, 0.2)",
    borderProgress,
    className = "",
}: {
    children: React.ReactNode;
    borderColor?: string;
    glowColor?: string;
    borderProgress?: number; // 0-1, fraction of border filled
    className?: string;
}) {
    const usesProgressBorder = borderProgress !== undefined;

    return (
        <div
            className={`relative w-full rounded-2xl flex flex-col items-center justify-center ${className}`}
            style={{
                padding: "3px",
                boxShadow: `0 8px 16px rgba(0,0,0,0.6), 0 0 20px ${glowColor}`,
                background: usesProgressBorder
                    ? `conic-gradient(from 0deg, ${borderColor} ${borderProgress! * 360}deg, rgba(255,255,255,0.1) ${borderProgress! * 360}deg)`
                    : borderColor,
                borderRadius: "1rem",
            }}
        >
            {/* Inner card — sits inside the 3px "border" padding */}
            <div
                className="absolute inset-[3px] z-0 rounded-[calc(1rem-3px)] overflow-hidden"
                style={{
                    background: "linear-gradient(180deg, #3A1061 0%, #21083B 50%, #110321 100%)",
                    boxShadow: "inset 0 6px 15px rgba(0,0,0,0.7), inset 0 -2px 5px rgba(0,0,0,0.5)",
                }}
            >
                {/* Inner highlight shimmer */}
                <div
                    className="absolute inset-0 z-0 opacity-60 pointer-events-none"
                    style={{
                        background: "radial-gradient(ellipse at 85% 0%, rgba(255,224,72,0.3) 0%, rgba(180,140,255,0.1) 40%, transparent 70%)",
                    }}
                />
            </div>
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
        fetch(`/api/scores?mode=${gameMode}&skip_avatars=true`)
            .then(res => res.json())
            .then(data => {
                if (data.leaderboard && data.leaderboard.length > 0) {
                    setGlobalBest(data.leaderboard[0].score);
                    setGlobalBestUser(data.leaderboard[0].username);
                    if (username) {
                        const userScore = data.leaderboard.find((s: { username: string }) => s.username === username);
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
        movesBorderColor = "#FFE048";
        movesGlow = "rgba(255,224,72,0.35)";
    } else if (movesProgress > 0.35) {
        movesBorderColor = "#FF8C00";
        movesGlow = "rgba(255,140,0,0.35)";
    } else if (movesProgress > 0.15) {
        movesBorderColor = "#FF5F1F";
        movesGlow = "rgba(255,95,31,0.35)";
    } else {
        movesBorderColor = "#EF4444";
        movesGlow = "rgba(239,68,68,0.4)";
    }

    // When only showing high scores (mobile bottom row)
    if (hideMetrics) {
        return (
            <div className="flex gap-1.5 px-1 py-1">
                <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[75px] sm:min-h-[90px] px-1 sm:p-2">
                    <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">YOUR BEST</div>
                    <div className="font-display text-2xl font-black text-[#FFE048]" style={{ textShadow: "0 0 12px rgba(255,224,72,0.3)" }}>{personalBest > 0 ? personalBest.toLocaleString() : '—'}</div>
                </HudCard>
                <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[75px] sm:min-h-[90px] px-1 sm:p-2">
                    <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">GLOBAL BEST</div>
                    <div className="font-display text-2xl font-black text-[#C48CFF]" style={{ textShadow: "0 0 12px rgba(196,140,255,0.3)" }}>{globalBest > 0 ? globalBest.toLocaleString() : '—'}</div>
                </HudCard>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full justify-between gap-2.5 sm:gap-3 w-full">

            {/* Mobile metrics row (top HUD on mobile) */}
            {hideHighScores && (
                <div className="flex gap-1.5 w-full -mt-2 px-1">
                    {/* Score */}
                    <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[85px] sm:min-h-[100px] px-1 sm:p-2">
                        <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">SCORE</div>
                        <motion.div className="font-display text-3xl font-black leading-none text-center" key={score} style={{ color: "#FFE048", WebkitTextStroke: "1px #c9a84c", textShadow: "0 2px 0 #8b6b15, 0 0 15px rgba(255, 224, 72, 0.4)" }}>
                            {score.toLocaleString()}
                        </motion.div>
                    </HudCard>
                    {/* Moves */}
                    <HudCard borderColor={movesBorderColor} glowColor={movesGlow} className="flex-1 flex flex-col items-center justify-center min-h-[85px] sm:min-h-[100px] px-1 sm:p-2">
                        <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">MOVES</div>
                        <AnimatePresence mode="popLayout">
                            <motion.div key={movesLeft} className={`font-display text-4xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"}`} style={{ textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                                {movesLeft}
                            </motion.div>
                        </AnimatePresence>
                    </HudCard>
                    {/* Combo */}
                    <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[85px] sm:min-h-[100px] px-1 sm:p-2">
                        <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">COMBO</div>
                        <AnimatePresence mode="popLayout">
                            <motion.div key={combo} className={`font-display text-4xl font-black leading-none ${combo >= 3 ? "text-[#FF5F1F]" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"}`}>
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
                    <HudCard className="flex-1 min-h-0 py-3">
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
                            {formatScoreWithCommas(score)}
                        </motion.div>
                    </HudCard>

                    {/* Moves Card — border acts as radial indicator */}
                    <HudCard borderColor={movesBorderColor} glowColor={movesGlow} borderProgress={movesLeft / TOTAL_MOVES} className="flex-1 min-h-0 py-3">
                        <div className="text-[#B399D4] text-xs sm:text-sm font-black tracking-[0.2em] font-mundial mb-1">
                            MOVES
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
                    </HudCard>

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
                            <div className="font-display tracking-[0.1em] text-2xl sm:text-3xl font-black text-[#FFE048]" style={{ textShadow: '0 0 15px rgba(255,224,72,0.4), 0 2px 4px rgba(0,0,0,0.5)' }}>
                                {formatScoreWithCommas(personalBest)}
                            </div>
                        </div>

                        <div className="w-[85%] h-[2px] bg-white/20 my-2 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />

                        <div className="flex flex-col items-center w-full">
                            <div className="text-[#B399D4] text-xs sm:text-[13px] font-black tracking-[0.2em] font-mundial mb-0.5">
                                GLOBAL BEST
                            </div>
                            <div className="font-display tracking-[0.1em] text-xl sm:text-2xl font-black text-[#C48CFF]" style={{ textShadow: '0 0 15px rgba(196,140,255,0.3), 0 2px 4px rgba(0,0,0,0.5)' }}>
                                {formatScoreWithCommas(globalBest)}
                            </div>
                        </div>
                    </HudCard>
                </>
            )}
        </div>
    );
}
