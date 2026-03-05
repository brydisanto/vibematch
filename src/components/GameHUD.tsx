"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GameState } from "@/lib/gameEngine";
import { useEffect, useState, useRef } from "react";

interface GameHUDProps {
    state: GameState;
    hideMetrics?: boolean;
    hideHighScores?: boolean;
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

    // When only showing high scores (mobile bottom row)
    if (hideMetrics) {
        return (
            <div className="flex gap-2">
                {/* Your Best */}
                <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#31115F] to-[#1C063D] border-2 border-[#9C65F0]/50 shadow-[0_0_15px_rgba(156,101,240,0.2),inset_0_2px_5px_rgba(255,255,255,0.1)] p-2 flex flex-col items-center justify-center">
                    <div className="text-[#A283C9] text-[9px] font-black tracking-[0.1em] font-mundial mb-1">YOUR BEST</div>
                    <div className="font-display text-xl font-black text-[#FFE048]">{personalBest > 0 ? personalBest.toLocaleString() : '—'}</div>
                </div>
                {/* Global Best */}
                <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#31115F] to-[#1C063D] border-2 border-[#9C65F0]/50 shadow-[0_0_15px_rgba(156,101,240,0.2),inset_0_2px_5px_rgba(255,255,255,0.1)] p-2 flex flex-col items-center justify-center">
                    <div className="text-[#A283C9] text-[9px] font-black tracking-[0.1em] font-mundial mb-1">GLOBAL BEST</div>
                    <div className="font-display text-xl font-black text-[#C48CFF]">{globalBest > 0 ? globalBest.toLocaleString() : '—'}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full justify-between gap-2.5 sm:gap-3 w-full">

            {/* Mobile metrics row (top HUD on mobile) */}
            {hideHighScores && (
                <div className="flex gap-2 w-full">
                    {/* Score */}
                    <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#31115F] to-[#1C063D] border-2 border-[#9C65F0]/50 shadow-[0_0_15px_rgba(156,101,240,0.2),inset_0_2px_5px_rgba(255,255,255,0.1)] p-2 flex flex-col items-center justify-center">
                        <div className="text-[#A283C9] text-[9px] font-black tracking-[0.1em] font-mundial mb-1">SCORE</div>
                        <motion.div className="font-display text-2xl font-black leading-none text-center" key={score} style={{ color: "#FFE048", WebkitTextStroke: "1px #c9a84c", textShadow: "0 2px 0 #8b6b15, 0 0 15px rgba(255, 224, 72, 0.4)" }}>
                            {score.toLocaleString()}
                        </motion.div>
                    </div>
                    {/* Moves */}
                    <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#31115F] to-[#1C063D] border-2 border-[#FFE048] shadow-[0_0_15px_rgba(255,224,72,0.3),inset_0_2px_5px_rgba(255,255,255,0.1)] p-2 flex flex-col items-center justify-center">
                        <div className="text-[#A283C9] text-[9px] font-black tracking-[0.1em] font-mundial mb-1">MOVES</div>
                        <AnimatePresence mode="popLayout">
                            <motion.div key={movesLeft} className={`font-display text-3xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF5F1F]" : "text-white"}`}>
                                {movesLeft}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    {/* Combo */}
                    <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#31115F] to-[#1C063D] border-2 border-[#9C65F0]/50 shadow-[0_0_15px_rgba(156,101,240,0.2),inset_0_2px_5px_rgba(255,255,255,0.1)] p-2 flex flex-col items-center justify-center">
                        <div className="text-[#A283C9] text-[9px] font-black tracking-[0.1em] font-mundial mb-1">COMBO</div>
                        <AnimatePresence mode="popLayout">
                            <motion.div key={combo} className={`font-display text-3xl font-black leading-none ${combo >= 3 ? "text-[#FF5F1F]" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"}`}>
                                {combo > 0 ? combo : "—"}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Desktop-only cards below */}
            {!hideHighScores && (
                <>
                    {/* Score Card */}
                    <div className="relative w-full flex-[1.3] min-h-0 rounded-2xl bg-gradient-to-b from-[#3D1A6E] to-[#2A0E50] border-[3px] border-[#7B50B8]/40 shadow-[0_0_20px_rgba(156,101,240,0.15),inset_0_4px_10px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center">
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
                    </div>

                    {/* Moves Card */}
                    <div className="relative w-full flex-1 min-h-0 rounded-2xl bg-gradient-to-b from-[#3D1A6E] to-[#2A0E50] border-[3px] border-[#FFE048]/80 shadow-[0_0_20px_rgba(255,224,72,0.25),inset_0_4px_10px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center">
                        <div className="text-[#B399D4] text-xs sm:text-sm font-black tracking-[0.2em] font-mundial mb-1">
                            MOVES
                        </div>
                        <AnimatePresence mode="popLayout">
                            <motion.div
                                key={movesLeft}
                                className={`font-display text-5xl sm:text-6xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF5F1F]" : "text-white"}`}
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

                    {/* Combo Card */}
                    <div className="relative w-full flex-[0.8] min-h-0 rounded-2xl bg-gradient-to-b from-[#3D1A6E] to-[#2A0E50] border-[3px] border-[#7B50B8]/40 shadow-[0_0_20px_rgba(156,101,240,0.15),inset_0_4px_10px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center">
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
                                {combo > 0 ? `x${combo}` : "—"}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* High Scores Card */}
                    <div className="relative w-full flex-1 min-h-0 rounded-2xl bg-gradient-to-b from-[#3D1A6E] to-[#2A0E50] border-[3px] border-[#7B50B8]/40 shadow-[0_0_20px_rgba(156,101,240,0.15),inset_0_4px_10px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center py-3">
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
                    </div>
                </>
            )}
        </div>
    );
}
