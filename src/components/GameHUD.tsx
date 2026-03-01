"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GameState } from "@/lib/gameEngine";
import { Flame, Target, Trophy, Zap } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

interface GameHUDProps {
    state: GameState;
}

/* ===== CIRCULAR MOVES RING ===== */
function MovesRing({ movesLeft, totalMoves }: { movesLeft: number; totalMoves: number }) {
    const radius = 60; // Increased radius
    const circumference = 2 * Math.PI * radius;
    const progress = movesLeft / totalMoves;
    const dashOffset = circumference * (1 - progress);

    const isLow = movesLeft <= 5;
    const isCritical = movesLeft <= 3;
    const ringColor = isCritical ? "#FF3232" : isLow ? "#FF5F1F" : "#FFE048";

    return (
        <div className="relative flex items-center justify-center">
            <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
                {/* Track */}
                <circle
                    cx="70" cy="70" r={radius}
                    className="moves-ring-track"
                    fill="none"
                    strokeWidth="8"
                />
                {/* Fill */}
                <circle
                    cx="70" cy="70" r={radius}
                    className="moves-ring-fill"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ "--ring-color": ringColor } as React.CSSProperties}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={movesLeft}
                        className={`font-display text-4xl sm:text-5xl font-black leading-none ${isCritical ? "text-red-400" : isLow ? "text-[#FF5F1F]" : "text-white"}`}
                        initial={{ scale: 1.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                        {movesLeft}
                    </motion.div>
                </AnimatePresence>
                <span className="text-xs text-white/50 uppercase tracking-wider font-mundial font-bold mt-1">Moves</span>
            </div>
        </div>
    );
}

/* ===== COMBO FIRE PARTICLES ===== */
function ComboFireParticles({ active }: { active: boolean }) {
    if (!active) return null;

    const particles = Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: 20 + Math.random() * 60,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 0.5,
        duration: 0.6 + Math.random() * 0.4,
        driftX: (Math.random() - 0.5) * 16,
        color: Math.random() > 0.5 ? "#FF5F1F" : "#FFE048",
    }));

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="fire-particle"
                    style={{
                        left: `${p.left}%`,
                        bottom: "5px",
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        "--delay": `${p.delay}s`,
                        "--duration": `${p.duration}s`,
                        "--drift-x": `${p.driftX}px`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}



export default function GameHUD({ state }: GameHUDProps) {
    const { score, movesLeft, combo, maxCombo, gameMode, matchCount } = state;
    const totalMoves = 30; // CLASSIC_MOVES constant

    // Snake border activation on score milestones
    const [snakeActive, setSnakeActive] = useState(false);
    const prevScore = useRef(score);

    useEffect(() => {
        // Fire snake animation on every 1000-point milestone
        if (score > 0 && Math.floor(score / 1000) > Math.floor(prevScore.current / 1000)) {
            setSnakeActive(true);
            const timeout = setTimeout(() => setSnakeActive(false), 3000);
            return () => clearTimeout(timeout);
        }
    }, [score]);

    // Update prevScore *after* checking for milestones
    useEffect(() => {
        prevScore.current = score;
    }, [score]);

    return (
        <div className="flex flex-col h-full justify-between gap-3">
            {/* Score Card — snake only on milestones */}
            <div className={`card-snake ${snakeActive ? "card-snake-active" : "card-snake-idle"} flex-1 rounded-2xl w-full relative`}>
                <span className="snake-line snake-line-1" />
                <span className="snake-line snake-line-2" />
                <span className="snake-line snake-line-3" />
                <span className="snake-line snake-line-4" />
                <div className="absolute inset-[2px] bg-[#0A0A0A] shadow-[inset_0_4px_10px_rgba(255,255,255,0.1),_inset_0_-4px_10px_rgba(0,0,0,0.5),_0_8px_16px_rgba(0,0,0,0.6)] rounded-2xl p-5 flex flex-col items-center justify-center z-10 border-4 border-[#e5c158]">
                    {/* Top glare for enamel pin effect */}
                    <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-white/10 to-transparent rounded-t-xl pointer-events-none" />

                    <div className="flex flex-col items-center gap-1.5 mb-2 relative z-10">
                        {/* Mode pill */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] border border-white/5">
                            {gameMode === "daily" ? (
                                <Trophy size={12} className="text-[#FFE048]" />
                            ) : (
                                <Zap size={12} className="text-[#2EFF2E]" />
                            )}
                            <span className="text-[10px] font-mundial font-bold text-white/80 uppercase tracking-wider drop-shadow-md">
                                {gameMode === "daily" ? "Daily" : "Classic"}
                            </span>
                        </div>
                        <div className="text-base text-white/60 uppercase tracking-widest font-mundial text-center font-bold mt-2 drop-shadow-md">
                            Score
                        </div>
                    </div>
                    <motion.div
                        className="font-display text-5xl sm:text-6xl font-black leading-none text-center relative z-10"
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
            </div>

            {/* Moves Card */}
            <div className="flex-1 w-full relative bg-[#0A0A0A] rounded-2xl p-5 flex flex-col items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.6)] border-4 border-[#e5c158] overflow-hidden">
                <div className="absolute inset-0 shadow-[inset_0_4px_10px_rgba(255,255,255,0.1),_inset_0_-4px_10px_rgba(0,0,0,0.5)] pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <MovesRing movesLeft={movesLeft} totalMoves={totalMoves} />
                </div>
            </div>

            {/* Combo Card */}
            <div className="flex-1 w-full relative bg-[#0A0A0A] rounded-2xl p-5 flex flex-col items-center justify-center overflow-hidden shadow-[0_8px_16px_rgba(0,0,0,0.6)] border-4 border-[#e5c158]">
                <div className="absolute inset-0 shadow-[inset_0_4px_10px_rgba(255,255,255,0.1),_inset_0_-4px_10px_rgba(0,0,0,0.5)] pointer-events-none z-0" />
                <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-0" />

                <ComboFireParticles active={combo >= 3} />
                <div className="flex items-center gap-1.5 mb-2 relative z-10">
                    <Flame size={18} className="text-[#FF5F1F] drop-shadow-lg" />
                    <span className="text-sm text-white/60 font-bold uppercase tracking-widest font-mundial drop-shadow-md mt-1">
                        Combo
                    </span>
                </div>
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={combo}
                        className={`font-display text-6xl font-black relative z-10 ${combo >= 3 ? "text-[#FF5F1F] combo-fire" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"}`}
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        style={combo > 0 ? {
                            WebkitTextStroke: `1px ${combo >= 3 ? "#c83b06" : "#c9a84c"}`,
                            textShadow: `0 4px 0 ${combo >= 3 ? "#8a2400" : "#8b6b15"}, 0 8px 10px rgba(0,0,0,0.8), 0 0 30px ${combo >= 3 ? "rgba(255, 95, 31, 0.4)" : "rgba(255, 224, 72, 0.4)"}`,
                        } : {}}
                    >
                        {combo > 0 ? `×${combo}` : "—"}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Mini stats - Enamel Pin Style */}
            <div className="w-full relative bg-[#0A0A0A] rounded-xl px-4 py-3 shadow-[0_4px_8px_rgba(0,0,0,0.5)] border-2 border-[#e5c158] overflow-hidden">
                <div className="absolute inset-0 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1),_inset_0_-2px_5px_rgba(0,0,0,0.5)] pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <div className="flex justify-between text-xs text-white/60 font-mundial font-bold relative z-10">
                    <span className="drop-shadow-md">Matches: <span className="text-white/90">{matchCount}</span></span>
                    <span className="drop-shadow-md">Best combo: <span className="text-white/90">×{maxCombo}</span></span>
                </div>
            </div>
        </div>
    );
}
