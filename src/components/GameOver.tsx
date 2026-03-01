"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { GameState } from "@/lib/gameEngine";
import { useEffect } from "react";
import { RotateCcw, Home, Share2 } from "lucide-react";
import { TIER_COLORS } from "@/lib/badges";

interface GameOverProps {
    state: GameState;
    userProfile?: { username: string; avatarUrl: string } | null;
    onPlayAgain: () => void;
    onGoHome: () => void;
}

/* ===== SVG RANK SHIELDS ===== */
function RankShield({ color, accentColor, label }: { color: string; accentColor: string; label: string }) {
    return (
        <div className="rank-shield-enter w-20 h-24 mx-auto mb-4">
            <svg viewBox="0 0 80 96" className="w-full h-full" fill="none">
                {/* Shield body */}
                <path
                    d="M40 4 L72 16 L72 52 C72 68 56 82 40 92 C24 82 8 68 8 52 L8 16 Z"
                    fill={`url(#shield-fill-${label})`}
                    stroke={color}
                    strokeWidth="2.5"
                />
                {/* Inner shield highlight */}
                <path
                    d="M40 12 L64 22 L64 50 C64 63 52 74 40 82 C28 74 16 63 16 50 L16 22 Z"
                    fill="rgba(0,0,0,0.3)"
                    stroke={color}
                    strokeWidth="1"
                    strokeOpacity="0.4"
                />
                {/* Star/rank emblem */}
                <path
                    d="M40 28 L44 40 L56 40 L46 48 L50 60 L40 52 L30 60 L34 48 L24 40 L36 40 Z"
                    fill={color}
                    fillOpacity="0.9"
                >
                    <animate attributeName="fillOpacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
                </path>
                {/* Glow effect */}
                <circle cx="40" cy="46" r="18" fill={color} fillOpacity="0.1">
                    <animate attributeName="r" values="18;22;18" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fillOpacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
                </circle>
                <defs>
                    <linearGradient id={`shield-fill-${label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accentColor} />
                        <stop offset="100%" stopColor={color} stopOpacity="0.3" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}

const RANK_CONFIG = [
    { threshold: 10000, label: "COSMIC", color: "#B366FF", accent: "#1a0533", icon: "🌌" },
    { threshold: 5000, label: "GOLD", color: "#FFE048", accent: "#2a1a00", icon: "🥇" },
    { threshold: 2500, label: "SILVER", color: "#C0C0C0", accent: "#1a1a1a", icon: "🥈" },
    { threshold: 0, label: "BRONZE", color: "#4A9EFF", accent: "#0a1a2a", icon: "🔵" },
];

function getRank(score: number) {
    return RANK_CONFIG.find((r) => score >= r.threshold) || RANK_CONFIG[RANK_CONFIG.length - 1];
}

export default function GameOver({ state, userProfile, onPlayAgain, onGoHome }: GameOverProps) {
    const { score, matchCount, maxCombo, gameMode, gameBadges } = state;
    const rank = getRank(score);

    // Persist score to Vercel KV Cloud Database
    useEffect(() => {
        if (score > 0 && userProfile?.username) {
            fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: userProfile.username,
                    mode: gameMode,
                    score: score
                })
            }).catch(e => console.error("Failed to post score", e));
        }
    }, [score, gameMode, userProfile?.username]);

    const handleShare = async () => {
        const text = `🎮 VibeMatch ${gameMode === "daily" ? "Daily" : "Classic"}\n🏆 Score: ${score.toLocaleString()}\n🔥 Best Combo: ×${maxCombo}\n${rank.label}\n\nPlay at vibematch.gg 🤙`;

        if (navigator.share) {
            try { await navigator.share({ text }); } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(text);
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* Backdrop */}
            <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />

            {/* Card */}
            <motion.div
                className="relative w-full max-w-md rounded-3xl"
                initial={{ scale: 0.8, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    delay: 0.2,
                }}
            >
                <div className="rounded-3xl p-6 sm:p-8 text-center bg-[#111] border-2 border-[#c9a84c]" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.6)' }}>
                    {/* Rank Shield */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.4,
                        }}
                    >
                        <RankShield color={rank.color} accentColor={rank.accent} label={rank.label} />
                    </motion.div>

                    <motion.div
                        className="font-display text-xl sm:text-2xl font-black mb-1"
                        style={{ color: rank.color }}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        {rank.label}
                    </motion.div>

                    <motion.div
                        className="text-white/50 text-xs sm:text-sm font-mundial mb-6"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        {gameMode === "daily" ? "Daily Challenge" : "Classic Mode"} Complete
                    </motion.div>

                    {/* Score */}
                    <motion.div
                        className="font-display text-5xl sm:text-6xl font-black mb-6"
                        style={{
                            color: "var(--gvc-gold)",
                            textShadow: "0 0 40px rgba(255, 224, 72, 0.5)",
                        }}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            delay: 0.7,
                        }}
                    >
                        {score.toLocaleString()}
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        className="grid grid-cols-3 gap-3 mb-6"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        {[
                            { label: "Matches", value: matchCount, color: "text-white" },
                            { label: "Best Combo", value: `×${maxCombo}`, color: "text-[#FF5F1F]" },
                            { label: "Badges Used", value: gameBadges.length, color: "text-white" },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white/5 border border-[#FFE048]/30 rounded-xl p-3">
                                <div className="text-[10px] sm:text-xs text-white/40 font-mundial uppercase mb-1">
                                    {stat.label}
                                </div>
                                <div className={`font-display text-lg sm:text-xl font-bold ${stat.color}`}>
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Badges used preview — larger with tier glow */}
                    <motion.div
                        className="flex justify-center gap-2 mb-6"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.9 }}
                    >
                        {gameBadges.slice(0, 8).map((badge) => (
                            <div
                                key={badge.id}
                                className="group relative w-9 h-9 sm:w-11 sm:h-11 rounded-lg overflow-hidden border-2 transition-transform hover:scale-110"
                                style={{
                                    borderColor: TIER_COLORS[badge.tier],
                                    boxShadow: `0 0 10px ${TIER_COLORS[badge.tier]}50`,
                                }}
                            >
                                <Image
                                    src={badge.image}
                                    alt={badge.name}
                                    width={44}
                                    height={44}
                                    className="w-full h-full object-cover"
                                />
                                {/* Name tooltip on hover */}
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-0.5 rounded text-[8px] text-white font-mundial z-10">
                                    {badge.name}
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Action buttons */}
                    <motion.div
                        className="flex gap-3"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        <button
                            onClick={onGoHome}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                                bg-[#111] border-2 border-[#c9a84c] text-white/70 hover:bg-[#FFE048] hover:border-[#FFE048] hover:text-black
                                font-mundial font-semibold text-sm transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                        >
                            <Home size={16} />
                            Home
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                                bg-[#111] border-2 border-[#c9a84c] text-white/70 hover:bg-[#FFE048] hover:border-[#FFE048] hover:text-black
                                font-mundial font-semibold text-sm transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                        >
                            <Share2 size={16} />
                        </button>
                        <button
                            onClick={onPlayAgain}
                            className="flex-1 relative overflow-hidden bg-[#FFE048] text-black font-cooper font-bold uppercase tracking-wider py-3 rounded-xl hover:bg-white transition-all shadow-[0_0_20px_rgba(255,224,72,0.4)] active:scale-95 duration-200 flex items-center justify-center gap-2 group"
                        >
                            {/* Shimmer overlay */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shimmer" />
                            </div>
                            {/* Sparkle dots */}
                            <div className="absolute w-1 h-1 top-2 right-4 bg-white/60 rounded-full blur-[1px] animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                            <div className="absolute w-1 h-1 bottom-2 left-6 bg-white/50 rounded-full blur-[1px] animate-ping pointer-events-none" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />

                            <RotateCcw size={16} className="relative z-10 text-black/60 group-hover:text-black transition-colors" />
                            <span className="relative z-10 text-sm">REMATCH</span>
                        </button>
                    </motion.div>
                </div>
            </motion.div>
        </motion.div>
    );
}
