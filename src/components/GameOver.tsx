"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { GameState } from "@/lib/gameEngine";
import { useEffect, useState, useRef } from "react";
import { RotateCcw, Home, Target, Flame, Zap } from "lucide-react";
import { TIER_COLORS, BadgeTier, TIER_DISPLAY_NAMES } from "@/lib/badges";
import { playNewHighScoreSound } from "@/lib/sounds";
import toast from "react-hot-toast";

interface GameOverProps {
    state: GameState;
    userProfile?: { username: string; avatarUrl: string } | null;
    onPlayAgain: () => void;
    onGoHome: () => void;
    onRequestLogin?: () => void;
    capsuleEarned?: boolean;
    onOpenPinBook?: () => void;
    /** Server-issued match token. When present, the score submission
     *  includes it so the server can enforce the prize-eligibility
     *  gate before writing to leaderboards. */
    matchId?: string;
}

/* ===== STAR SVG GRADIENTS (rendered once) ===== */
const STAR_GRADIENTS: Record<string, [string, string, string]> = {
    WOOD:   ["#C8845A", "#A0522D", "#6B3518"],
    BRONZE: ["#E5A04E", "#CD7F32", "#8B5A1E"],
    SILVER: ["#F8FAFC", "#E2E8F0", "#94A3B8"],
    GOLD:   ["#FFF3A0", "#FFE048", "#B8860B"],
    COSMIC: ["#D8A0FF", "#B366FF", "#6B1FC0"],
};

function StarGradientDefs() {
    return (
        <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
                {Object.entries(STAR_GRADIENTS).map(([key, [top, mid, bot]]) => (
                    <linearGradient key={key} id={`star-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={top} />
                        <stop offset="45%" stopColor={mid} />
                        <stop offset="100%" stopColor={bot} />
                    </linearGradient>
                ))}
                <linearGradient id="star-specular" x1="0.3" y1="0" x2="0.7" y2="0.6">
                    <stop offset="0%" stopColor="white" stopOpacity="0.65" />
                    <stop offset="40%" stopColor="white" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
}

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z";

/* ===== CONSTELLATION BURST — SINGLE STAR ===== */
function Star({ filled, color, glowColor, gradientId, index }: {
    filled: boolean;
    color: string;
    glowColor: string;
    gradientId: string;
    index: number;
}) {
    if (!filled) {
        return (
            <motion.div
                className="w-9 h-9 sm:w-11 sm:h-11 relative"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.15, duration: 0.3 }}
            >
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path d={STAR_PATH} fill="rgba(255,255,255,0.04)" />
                    <path d={STAR_PATH} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" />
                </svg>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="w-9 h-9 sm:w-11 sm:h-11 relative"
            initial={{ opacity: 0.15, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                delay: 0.3 + index * 0.2,
                duration: 0.6,
                ease: [0.34, 1.56, 0.64, 1],
            }}
        >
            {/* Ignite flash */}
            <motion.div
                className="absolute inset-[-12px] rounded-full pointer-events-none"
                style={{
                    background: `radial-gradient(circle, white 0%, ${glowColor} 40%, transparent 70%)`,
                }}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1.5, 2] }}
                transition={{ delay: 0.4 + index * 0.2, duration: 0.5 }}
            />

            {/* Orbiting particles */}
            {[0, 1, 2, 3].map((p) => (
                <div
                    key={p}
                    className="constellation-particle absolute top-1/2 left-1/2 rounded-full pointer-events-none"
                    style={{
                        width: p % 2 === 0 ? 3 : 2,
                        height: p % 2 === 0 ? 3 : 2,
                        background: p % 2 === 0 ? color : '#fff',
                        opacity: 0.6 - p * 0.1,
                        animationDelay: `${1.2 + index * 0.3 + p * 0.7}s`,
                        '--orbit-r': `${20 + p * 4}px`,
                        animationDuration: `${2.4 + p * 0.6}s`,
                        animationDirection: p % 2 === 0 ? 'normal' : 'reverse',
                        boxShadow: `0 0 4px ${color}`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Star SVG with 4-layer bloom */}
            <motion.svg
                viewBox="0 0 24 24"
                className="w-full h-full relative z-10"
                style={{
                    filter: `drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 16px ${glowColor}) drop-shadow(0 0 30px ${glowColor.replace(')', ',0.25)').replace('rgba', 'rgba')})`,
                }}
                animate={{
                    filter: [
                        `drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 16px ${glowColor}) drop-shadow(0 0 30px ${glowColor.replace(/[\d.]+\)$/, '0.25)')})`,
                        `drop-shadow(0 0 3px rgba(255,255,255,1)) drop-shadow(0 0 8px ${glowColor}) drop-shadow(0 0 20px ${glowColor}) drop-shadow(0 0 36px ${glowColor.replace(/[\d.]+\)$/, '0.35)')})`,
                        `drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 16px ${glowColor}) drop-shadow(0 0 30px ${glowColor.replace(/[\d.]+\)$/, '0.25)')})`,
                    ],
                }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 + index * 0.3 }}
            >
                {/* Shadow layer */}
                <path d={STAR_PATH} fill="rgba(0,0,0,0.5)" transform="translate(0.4, 0.8)" />
                {/* Body gradient */}
                <path d={STAR_PATH} fill={`url(#star-grad-${gradientId})`} />
                {/* Specular highlight */}
                <path d={STAR_PATH} fill="url(#star-specular)" style={{ mixBlendMode: "screen" }} />
                {/* Stroke */}
                <path d={STAR_PATH} fill="none" stroke={color} strokeWidth="0.6" strokeOpacity="0.5" />
            </motion.svg>
        </motion.div>
    );
}

/* ===== CONSTELLATION BURST — 5-STAR RATING ===== */
function RankStars({ filledCount, color, glowColor, label }: {
    filledCount: number;
    color: string;
    glowColor: string;
    label: string;
}) {
    return (
        <div className="relative flex flex-col items-center mx-auto mb-2">
            {/* Container for rays, bloom, and stars */}
            <div className="relative flex justify-center items-center" style={{ width: 320, height: 90 }}>
                {/* Rotating light rays (conic gradient) */}
                {filledCount >= 3 && (
                    <motion.div
                        className="constellation-rays absolute pointer-events-none"
                        style={{
                            width: 260,
                            height: 260,
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            borderRadius: '50%',
                            background: `conic-gradient(
                                from 0deg,
                                transparent 0deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 5deg, transparent 15deg,
                                transparent 30deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 35deg, transparent 45deg,
                                transparent 60deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 65deg, transparent 75deg,
                                transparent 90deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 95deg, transparent 105deg,
                                transparent 120deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 125deg, transparent 135deg,
                                transparent 150deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 155deg, transparent 165deg,
                                transparent 180deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 185deg, transparent 195deg,
                                transparent 210deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 215deg, transparent 225deg,
                                transparent 240deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 245deg, transparent 255deg,
                                transparent 270deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 275deg, transparent 285deg,
                                transparent 300deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 305deg, transparent 315deg,
                                transparent 330deg, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 335deg, transparent 345deg,
                                transparent 360deg
                            )`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.0, duration: 0.8 }}
                    />
                )}

                {/* Radial bloom */}
                {filledCount >= 2 && (
                    <motion.div
                        className="absolute pointer-events-none"
                        style={{
                            width: 220,
                            height: 220,
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: `radial-gradient(circle, ${glowColor.replace(/[\d.]+\)$/, '0.2)')} 0%, ${glowColor.replace(/[\d.]+\)$/, '0.08)')} 40%, transparent 70%)`,
                            borderRadius: '50%',
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.6 }}
                    />
                )}

                {/* Constellation connecting line */}
                {filledCount >= 2 && (
                    <motion.svg
                        className="absolute inset-0 z-[1] pointer-events-none"
                        viewBox="0 0 320 90"
                        preserveAspectRatio="xMidYMid meet"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        transition={{ delay: 1.2, duration: 0.5 }}
                    >
                        <defs>
                            <linearGradient id="constellation-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                                <stop offset="50%" stopColor={color} stopOpacity="0.7" />
                                <stop offset="100%" stopColor={color} stopOpacity="0.2" />
                            </linearGradient>
                        </defs>
                        <polyline
                            points={Array.from({ length: filledCount }, (_, i) => {
                                const totalWidth = (filledCount - 1) * 52;
                                const startX = 160 - totalWidth / 2;
                                return `${startX + i * 52},45`;
                            }).join(' ')}
                            fill="none"
                            stroke="url(#constellation-line-grad)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            className="constellation-draw-line"
                        />
                    </motion.svg>
                )}

                {/* Stars row */}
                <div className="relative z-[2] flex items-center justify-center gap-3 sm:gap-3.5">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Star
                            key={i}
                            filled={i < filledCount}
                            color={color}
                            glowColor={glowColor}
                            gradientId={label}
                            index={i}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ===== ANIMATED SCORE COUNTER ===== */
function AnimatedScore({ target, color }: { target: number; color: string }) {
    const [displayValue, setDisplayValue] = useState(0);
    const [showPulse, setShowPulse] = useState(false);
    const frameRef = useRef<number>(0);

    useEffect(() => {
        const duration = 1800;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out quart for satisfying deceleration
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplayValue(Math.round(eased * target));

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            } else {
                setShowPulse(true);
            }
        };

        const delay = setTimeout(() => {
            frameRef.current = requestAnimationFrame(animate);
        }, 900);

        return () => {
            clearTimeout(delay);
            cancelAnimationFrame(frameRef.current);
        };
    }, [target]);

    return (
        <div className="relative inline-block">
            {/* Score landing pulse */}
            <AnimatePresence>
                {showPulse && (
                    <motion.div
                        className="absolute inset-[-20px] rounded-full pointer-events-none"
                        style={{
                            background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
                        }}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [0.5, 1.5], opacity: [0.8, 0] }}
                        transition={{ duration: 0.6 }}
                    />
                )}
            </AnimatePresence>

            <motion.span
                className="font-display text-5xl sm:text-7xl font-black tabular-nums"
                style={{
                    color,
                    textShadow: `0 0 40px ${color}60, 0 0 80px ${color}20`,
                }}
                animate={showPulse ? {
                    scale: [1, 1.06, 1],
                    filter: [`brightness(1)`, `brightness(1.2)`, `brightness(1)`],
                } : {}}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                {displayValue.toLocaleString()}
            </motion.span>
        </div>
    );
}

/* ===== TWITTER/X ICON ===== */
function XIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

const RANK_CONFIG = [
    { threshold: 30000, label: "COSMIC", color: "#B366FF", accent: "#1a0533", glow: "rgba(179,102,255,0.6)", stars: 5, icon: "🌌" },
    { threshold: 20000, label: "GOLD", color: "#FFE048", accent: "#2a1a00", glow: "rgba(255,224,72,0.5)", stars: 4, icon: "🥇" },
    { threshold: 15000, label: "SILVER", color: "#E2E8F0", accent: "#1a202c", glow: "rgba(226,232,240,0.4)", stars: 3, icon: "🥈" },
    { threshold: 7500, label: "BRONZE", color: "#CD7F32", accent: "#2d1606", glow: "rgba(205,127,50,0.5)", stars: 2, icon: "🥉" },
    { threshold: 0, label: "WOOD", color: "#A0522D", accent: "#2a1205", glow: "rgba(160,82,45,0.5)", stars: 1, icon: "🪵" },
];

function getRank(score: number) {
    return RANK_CONFIG.find((r) => score >= r.threshold) || RANK_CONFIG[RANK_CONFIG.length - 1];
}

/* ===== TIER LABEL COLORS ===== */
const TIER_LABEL_CONFIG: Record<BadgeTier, { bg: string; text: string }> = {
    blue: { bg: "rgba(255, 255, 255, 0.1)", text: "#E0E0E0" }, // Grey/White
    silver: { bg: "rgba(74, 158, 255, 0.15)", text: "#4A9EFF" }, // Blue
    special: { bg: "bg-[#FF8C42]/20", text: "text-[#FF8C42]" },
    gold: { bg: "rgba(255, 224, 72, 0.15)", text: "#FFE048" },
    cosmic: { bg: "rgba(179, 102, 255, 0.15)", text: "#B366FF" },
};

/* ===== STAT CARD ===== */
function StatCard({
    label,
    value,
    color,
    icon: Icon,
    delay,
}: {
    label: string;
    value: string | number;
    color: string;
    icon: React.ElementType;
    delay: number;
}) {
    return (
        <motion.div
            className="relative bg-[#1a0533]/95 border border-white/[0.08] rounded-2xl p-3 sm:p-4 overflow-hidden group"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
            whileHover={{
                scale: 1.03,
                borderColor: "rgba(255,255,255,0.2)",
                transition: { duration: 0.15, ease: "easeOut" }
            }}
        >
            {/* Subtle top highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="flex flex-col items-center gap-1 mb-1.5">
                <Icon size={14} className={`${color} opacity-50`} />
                <div className="text-[10px] sm:text-xs text-white/35 font-mundial uppercase tracking-wider">
                    {label}
                </div>
            </div>
            <div className={`font-display text-xl sm:text-2xl font-bold text-center ${color}`}>
                {value}
            </div>
        </motion.div>
    );
}

/* ===== BADGE SHOWCASE CARD ===== */
function BadgeCard({
    badge,
    delay,
}: {
    badge: { id: string; name: string; image: string; tier: BadgeTier; pointMultiplier: number };
    delay: number;
}) {
    const tierConfig = TIER_LABEL_CONFIG[badge.tier];

    return (
        <motion.div
            className="relative flex flex-col items-center gap-1.5 p-2 sm:p-2.5 rounded-xl overflow-hidden"
            style={{
                background: `linear-gradient(180deg, ${TIER_COLORS[badge.tier]}08 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${TIER_COLORS[badge.tier]}20`,
            }}
            initial={{ scale: 0, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{
                type: "spring",
                stiffness: 350,
                damping: 22,
                delay,
            }}
            whileHover={{
                scale: 1.08,
                borderColor: `${TIER_COLORS[badge.tier]}60`,
                boxShadow: `0 0 20px ${TIER_COLORS[badge.tier]}30`,
                transition: { type: "spring", stiffness: 400, damping: 25 }
            }}
        >
            {/* Top accent stripe */}
            <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                    background: `linear-gradient(90deg, transparent, ${TIER_COLORS[badge.tier]}60, transparent)`,
                }}
            />

            {/* Badge image with tier ring */}
            <div className="relative">
                <div
                    className={`relative w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-full overflow-hidden
                        ${badge.tier === "gold" ? "tile-tier-gold" : ""}
                        ${badge.tier === "cosmic" ? "tile-tier-cosmic" : ""}
                        ${badge.tier === "silver" ? "tile-tier-silver" : ""}
                    `}
                    style={{
                        boxShadow: `0 0 0 2px ${TIER_COLORS[badge.tier]}, 0 0 12px ${TIER_COLORS[badge.tier]}35, 0 3px 8px rgba(0,0,0,0.5)`,
                        background: `radial-gradient(circle at 30% 30%, ${TIER_COLORS[badge.tier]}12, #0a0a0a)`,
                    }}
                >
                    <Image
                        src={badge.image}
                        alt={badge.name}
                        width={52}
                        height={52}
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Multiplier tag */}
                {badge.pointMultiplier > 1 && (
                    <div
                        className="absolute -bottom-1 -right-1 text-[9px] sm:text-[10px] font-mundial font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                            background: TIER_COLORS[badge.tier],
                            color: badge.tier === "gold" ? "#1a1200" : badge.tier === "silver" ? "#1a1a1a" : "#fff",
                            boxShadow: `0 1px 4px rgba(0,0,0,0.4)`,
                        }}
                    >
                        ×{badge.pointMultiplier}
                    </div>
                )}
            </div>

            {/* Badge name */}
            <span
                className="text-[9px] sm:text-[10px] font-mundial font-medium text-center leading-tight px-1"
                style={{ color: `${TIER_COLORS[badge.tier]}c0` }}
            >
                {badge.name}
            </span>

            {/* Tier pill */}
            <div
                className="text-[7px] sm:text-[8px] font-mundial font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{
                    background: tierConfig.bg,
                    color: tierConfig.text,
                }}
            >
                {TIER_DISPLAY_NAMES[badge.tier]}
            </div>
        </motion.div>
    );
}

/* ===== RANK PROGRESS BAR ===== */
function RankProgressBar({ score, rank }: { score: number; rank: typeof RANK_CONFIG[0] }) {
    // Find the next rank above current
    const currentIdx = RANK_CONFIG.indexOf(rank);
    const nextRank = currentIdx > 0 ? RANK_CONFIG[currentIdx - 1] : null;

    if (!nextRank) {
        // Already at max rank — show nothing
        return null;
    }

    const prevThreshold = rank.threshold;
    const needed = nextRank.threshold - prevThreshold;
    const progress = Math.min((score - prevThreshold) / needed, 1);
    const remaining = nextRank.threshold - score;

    return (
        <motion.div
            className="mt-1 mb-4 w-full max-w-[280px] mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5, duration: 0.4 }}
        >
            {/* Bar */}
            <div className="relative h-2 rounded-full overflow-hidden bg-white/[0.08]">
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                        background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})`,
                        boxShadow: `0 0 8px ${nextRank.color}40`,
                    }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ delay: 2.7, duration: 1, ease: "easeOut" }}
                />
            </div>
            {/* Label */}
            <div className="flex justify-between items-center mt-1.5">
                <span className="text-[9px] font-mundial font-bold uppercase tracking-wider" style={{ color: rank.color }}>
                    {rank.label}
                </span>
                <span className="text-[9px] font-mundial text-white/40 tracking-wider">
                    {remaining.toLocaleString()} to {nextRank.label}
                </span>
                <span className="text-[9px] font-mundial font-bold uppercase tracking-wider" style={{ color: nextRank.color }}>
                    {nextRank.label}
                </span>
            </div>
        </motion.div>
    );
}

export default function GameOver({ state, userProfile, onPlayAgain, onGoHome, onRequestLogin, capsuleEarned, onOpenPinBook, matchId }: GameOverProps) {
    const { score, matchCount, maxCombo, totalCascades, gameMode, gameBadges, gameOverReason } = state;
    const rank = getRank(score);
    const [isNewHighScore, setIsNewHighScore] = useState(false);
    const [isAllTimeHigh, setIsAllTimeHigh] = useState(false);
    // Server returns leaderboardSkipped:true when the match was outside
    // the prize cap. Drives the "extra play — not saved" banner below.
    const [leaderboardSkipped, setLeaderboardSkipped] = useState(false);

    // Persist score to Vercel KV Cloud Database
    useEffect(() => {
        if (score > 0 && userProfile?.username) {
            fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: userProfile.username,
                    mode: gameMode,
                    score: score,
                    matchId: matchId,
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.leaderboardSkipped) {
                        setLeaderboardSkipped(true);
                        return;
                    }
                    if (data.isNewAllTimeHigh) {
                        setIsAllTimeHigh(true);
                        setIsNewHighScore(true);
                        playNewHighScoreSound();
                    } else if (data.isNewBest) {
                        setIsNewHighScore(true);
                        playNewHighScoreSound();
                    }
                })
                .catch(e => console.error("Failed to post score", e));
        }
    }, [score, gameMode, userProfile?.username]);

    // Capsule count derived from score thresholds (mirrors server logic in /api/pinbook/earn).
    const capsuleCount = score >= 50000 ? 3 : score >= 30000 ? 2 : score >= 15000 ? 1 : 0;
    const canShare = score >= 15000 && !!userProfile?.username;

    const handleShareX = () => {
        if (!canShare) return;
        const user = userProfile!.username;
        const shareUrl = `https://vibematch.app/?ref=${encodeURIComponent(user)}&user=${encodeURIComponent(user)}&score=${score}&capsules=${capsuleCount}`;
        const capsuleLine = capsuleCount > 0
            ? `${capsuleCount} ${capsuleCount === 1 ? "capsule" : "capsules"} earned.`
            : "";
        const text = `Scored ${score.toLocaleString()} on Pin Drop.${capsuleLine ? `\n${capsuleLine}` : ""}`;
        const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

        const win = window.open(intentUrl, "_blank", "noopener,noreferrer");
        if (!win) {
            navigator.clipboard.writeText(`${text}\n\n${shareUrl}`).then(() => {
                toast.success("Copied to clipboard!", {
                    style: { background: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" },
                    iconTheme: { primary: "#FFE048", secondary: "#000" },
                });
            }).catch(() => { });
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
                className="absolute inset-0 bg-black/90"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />

            {/* Card */}
            <motion.div
                className="relative w-full max-w-md max-h-[90vh] overflow-y-auto"
                style={{ scrollbarWidth: "none" }}
                initial={{ scale: 0.8, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    delay: 0.15,
                }}
            >
                {/* Animated gradient border wrapper */}
                <div
                    className="gameover-card-border rounded-[28px] p-[2px] shadow-2xl transition-all duration-1000"
                    style={{
                        boxShadow: `0 0 50px ${rank.color}30, inset 0 0 20px ${rank.color}20`,
                        border: `1px solid ${rank.color}50`
                    }}
                >
                    <div
                        className="rounded-[26px] px-5 py-6 sm:px-8 sm:py-7 text-center relative overflow-hidden"
                        style={{
                            background: "linear-gradient(180deg, #151515 0%, #0d0d0d 100%)",
                        }}
                    >
                        {/* Subtle inner radial glow keyed to rank */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: `radial-gradient(ellipse at 50% 15%, ${rank.color}0a 0%, transparent 55%)`,
                            }}
                        />

                        {/* Top decorative line */}
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                        {/* ===== STAR GRADIENT DEFS ===== */}
                        <StarGradientDefs />

                        {/* ===== 5-STAR RATING — staggered reveal ===== */}
                        <RankStars
                            filledCount={rank.stars}
                            color={rank.color}
                            glowColor={rank.glow}
                            label={rank.label}
                        />

                        {/* ===== RANK LABEL — with scale pop ===== */}
                        <motion.div
                            className="font-display text-xl sm:text-2xl font-black tracking-wider mb-0.5"
                            style={{
                                color: rank.color,
                                textShadow: `0 0 24px ${rank.color}50`,
                            }}
                            initial={{ y: 20, opacity: 0, scale: 0.7 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 18,
                                delay: 0.55,
                            }}
                        >
                            {rank.label}
                        </motion.div>

                        {/* No valid moves explanation */}
                        {gameOverReason === "no_valid_moves" && (
                            <motion.div
                                className="text-white/40 text-[10px] sm:text-xs font-mundial tracking-wider uppercase mb-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7 }}
                            >
                                No valid moves remaining
                            </motion.div>
                        )}

                        {/* ===== ANIMATED SCORE ===== */}
                        <motion.div
                            className="mb-4 relative"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 15,
                                delay: 0.7,
                            }}
                        >
                            <AnimatedScore target={score} color={rank.color} />
                        </motion.div>

                        {/* ===== NEW ALL TIME HIGH BANNER ===== */}
                        <AnimatePresence>
                            {isAllTimeHigh && (
                                <motion.div
                                    className="relative flex items-center justify-center px-6 py-3 rounded-2xl mb-4 mx-auto overflow-hidden"
                                    style={{
                                        background: "linear-gradient(135deg, rgba(179,102,255,0.2), rgba(255,224,72,0.15), rgba(179,102,255,0.2))",
                                        border: "2px solid rgba(255,224,72,0.5)",
                                        boxShadow: "0 0 30px rgba(255,224,72,0.3), 0 0 60px rgba(179,102,255,0.2), inset 0 0 30px rgba(255,224,72,0.1)",
                                    }}
                                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: 2.0, type: "spring", stiffness: 300, damping: 18 }}
                                >
                                    {/* Shimmer sweep */}
                                    <motion.div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            background: "linear-gradient(105deg, transparent 40%, rgba(255,224,72,0.3) 50%, transparent 60%)",
                                        }}
                                        animate={{ x: ["-100%", "200%"] }}
                                        transition={{ duration: 2, delay: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                                    />
                                    <span
                                        className="font-display font-black text-lg sm:text-xl uppercase tracking-wider select-none relative z-10"
                                        style={{
                                            background: "linear-gradient(135deg, #FFE048, #FF8C00, #B366FF, #FFE048)",
                                            backgroundSize: "300% 100%",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                            animation: "ath-gradient-shift 4s ease infinite",
                                            filter: "drop-shadow(0 0 8px rgba(255,224,72,0.5))",
                                        }}
                                    >
                                        NEW ALL-TIME HIGH!!
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ===== NEW PERSONAL BEST BANNER ===== */}
                        <AnimatePresence>
                            {isNewHighScore && !isAllTimeHigh && (
                                <motion.div
                                    className="flex items-center justify-center px-5 py-2.5 rounded-xl mb-4 mx-auto"
                                    style={{
                                        background: "linear-gradient(135deg, rgba(255,69,0,0.15), rgba(255,140,0,0.1))",
                                        border: "1.5px solid rgba(255,140,0,0.4)",
                                        boxShadow: "0 0 25px rgba(255,140,0,0.2), 0 4px 16px rgba(0,0,0,0.5)",
                                    }}
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: 2.2, type: "spring", stiffness: 400, damping: 20 }}
                                >
                                    <span className="text-[#FF8C00] text-sm sm:text-base font-display font-black uppercase tracking-wider"
                                        style={{ textShadow: "0 0 12px rgba(255,140,0,0.5)" }}
                                    >
                                        NEW PERSONAL BEST!
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ===== RANK PROGRESS (hidden on new best) ===== */}
                        {!isNewHighScore && <RankProgressBar score={score} rank={rank} />}

                        {/* ===== EXTRA PLAY NOTICE =====
                            Classic matches played beyond the prize cap are
                            "extra plays" — still tracked as games, but the
                            score is not saved to the all-time or weekly
                            leaderboards and no capsules are awarded. Give
                            the player explicit feedback so they aren't
                            left wondering why a big score didn't move
                            their rank. */}
                        {leaderboardSkipped && (
                            <motion.div
                                className="mx-auto max-w-[440px] rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
                                style={{
                                    background: "rgba(255, 149, 0, 0.08)",
                                    border: "1px solid rgba(255, 149, 0, 0.35)",
                                }}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.3 }}
                            >
                                <div
                                    className="flex-shrink-0 rounded-full flex items-center justify-center font-display font-black text-[10px]"
                                    style={{
                                        width: 22,
                                        height: 22,
                                        background: "rgba(255, 149, 0, 0.25)",
                                        color: "#FFB547",
                                    }}
                                >
                                    !
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div
                                        className="font-display font-black text-[11px] tracking-[0.2em] uppercase"
                                        style={{ color: "#FFB547" }}
                                    >
                                        Extra Play
                                    </div>
                                    <div className="text-[12px] text-white/70 leading-snug mt-0.5">
                                        This run was beyond your daily prize cap — score isn&apos;t saved to the leaderboard and no capsules were awarded.
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ===== STATS ROW ===== */}
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-6">
                            <StatCard
                                label="MATCHES"
                                value={matchCount}
                                color="text-white"
                                icon={Target}
                                delay={0.9}
                            />
                            <StatCard
                                label="BEST COMBO"
                                value={`×${maxCombo}`}
                                color="text-[#FF5F1F]"
                                icon={Flame}
                                delay={1.0}
                            />
                            <StatCard
                                label="CASCADES"
                                value={totalCascades}
                                color="text-[#4A9EFF]"
                                icon={Zap}
                                delay={1.1}
                            />
                        </div>

                        {/* ===== CAPSULE EARNED NOTIFICATION ===== */}
                        {capsuleEarned && onOpenPinBook && (
                            <motion.button
                                onClick={onOpenPinBook}
                                className="w-full mb-5 py-3.5 px-4 rounded-2xl border relative overflow-hidden group"
                                style={{
                                    background: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(179,102,255,0.1))",
                                    borderColor: "rgba(108,92,231,0.4)",
                                    boxShadow: "0 0 25px rgba(108,92,231,0.2)",
                                }}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 1.8, type: "spring", stiffness: 300, damping: 20 }}
                                whileHover={{ scale: 1.02, borderColor: "rgba(108,92,231,0.7)" }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-[#6C5CE7]/0 via-[#6C5CE7]/10 to-[#6C5CE7]/0 group-hover:via-[#6C5CE7]/20 transition-all" />
                                <div className="relative flex items-center justify-center gap-3">
                                    <motion.span
                                        className="text-2xl"
                                        animate={{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.1, 1] }}
                                        transition={{ duration: 1.5, delay: 2.2, repeat: 2 }}
                                    >
                                        🫧
                                    </motion.span>
                                    <div className="text-left">
                                        <div className="text-white font-display font-black text-sm tracking-wide">
                                            Pin Capsule Earned!
                                        </div>
                                        <div className="text-white/50 text-[10px] font-mundial">
                                            Tap to open your Pin Capsule
                                        </div>
                                    </div>
                                    <motion.div
                                        className="text-[#6C5CE7] text-lg"
                                        animate={{ x: [0, 4, 0] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    >
                                        →
                                    </motion.div>
                                </div>
                            </motion.button>
                        )}

                        {/* ===== BADGES PLAYED — Trophy Showcase ===== */}
                        <motion.div
                            className="mb-6"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 1.15 }}
                        >
                            {/* Section header */}
                            <div className="flex items-center gap-3 mb-3.5">
                                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <span className="text-[10px] sm:text-xs text-white/30 font-mundial uppercase tracking-[0.2em]">
                                    Pins Played
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {/* Badge grid — 3 columns for 6 badges, sorted by tier */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                                {[...gameBadges.slice(0, 6)]
                                    .sort((a, b) => {
                                        const order: Record<string, number> = { cosmic: 0, gold: 1, special: 2, silver: 3, blue: 4 };
                                        return (order[a.tier] ?? 4) - (order[b.tier] ?? 4);
                                    })
                                    .map((badge, i) => (
                                    <BadgeCard
                                        key={badge.id}
                                        badge={badge}
                                        delay={1.2 + i * 0.07}
                                    />
                                ))}
                            </div>
                        </motion.div>


                        {/* ===== LOGIN PROMPT FOR GUESTS ===== */}
                        {!userProfile && onRequestLogin && (
                            <motion.div
                                className="mb-6"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 1.2 }}
                            >
                                <button
                                    onClick={onRequestLogin}
                                    className="w-full py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-[#B366FF] to-[#8A2BE2] text-white font-mundial font-bold tracking-widest text-xs sm:text-sm shadow-[0_4px_15px_rgba(179,102,255,0.4)] hover:shadow-[0_6px_20px_rgba(179,102,255,0.6)] transform hover:-translate-y-0.5 transition-all outline-none"
                                >
                                    LOG IN TO SAVE SCORE!
                                </button>
                            </motion.div>
                        )}

                        {/* ===== ACTION BUTTONS ===== */}
                        <motion.div
                            className="flex gap-2.5 sm:gap-3 w-full"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 1.15 }}
                        >
                            {/* Home button */}
                            <button
                                onClick={onGoHome}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white font-mundial font-semibold text-[13px] sm:text-sm transition-all duration-75 active:scale-[0.97] group"
                            >
                                <Home size={16} className="text-white/50 group-hover:text-white/80 transition-colors" />
                                HOME
                            </button>

                            {/* Share on X button — only when score >= 15K and user is logged in */}
                            {canShare && (
                                <button
                                    onClick={handleShareX}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white font-mundial font-semibold text-[13px] sm:text-sm transition-all duration-75 active:scale-[0.97] group"
                                >
                                    <div className="text-white/50 group-hover:text-white/80 transition-colors">
                                        <XIcon size={14} />
                                    </div>
                                    SHARE
                                </button>
                            )}

                            {/* Rematch button — Classic only */}
                            {gameMode === "classic" && (
                                <button
                                    onClick={onPlayAgain}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-[#FFE048] hover:bg-white/[0.1] hover:border-[#FFE048]/50 hover:text-[#FFD000] font-mundial font-semibold text-[13px] sm:text-sm transition-all duration-75 active:scale-[0.97] group relative overflow-hidden"
                                    style={{ textShadow: "0 0 10px rgba(255,224,72,0.3)" }}
                                >
                                    <RotateCcw size={16} className="text-[#FFE048]/60 group-hover:text-[#FFE048] transition-colors" />
                                    REMATCH
                                </button>
                            )}
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
