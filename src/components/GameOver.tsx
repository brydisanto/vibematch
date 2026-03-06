"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { GameState } from "@/lib/gameEngine";
import { useEffect, useState, useRef } from "react";
import { RotateCcw, Home, Target, Flame, Award } from "lucide-react";
import { TIER_COLORS, BadgeTier, TIER_DISPLAY_NAMES } from "@/lib/badges";
import toast from "react-hot-toast";

interface GameOverProps {
    state: GameState;
    userProfile?: { username: string; avatarUrl: string } | null;
    onPlayAgain: () => void;
    onGoHome: () => void;
}

/* ===== FLOATING RANK PARTICLES ===== */
function RankParticles({ color }: { color: string }) {
    const particles = Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const distance = 60 + Math.random() * 30;
        return {
            id: i,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: 3 + Math.random() * 4,
            delay: i * 0.04,
        };
    });

    return (
        <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute left-1/2 top-1/2 rounded-full"
                    style={{
                        width: p.size,
                        height: p.size,
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                        marginLeft: -p.size / 2,
                        marginTop: -p.size / 2,
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                        x: p.x,
                        y: p.y,
                        opacity: [0, 1, 0],
                        scale: [0, 1.2, 0],
                    }}
                    transition={{
                        duration: 0.8,
                        delay: 0.4 + p.delay,
                        ease: "easeOut",
                    }}
                />
            ))}
        </div>
    );
}

/* ===== ANIMATED RANK MEDALLION ===== */
function RankMedallion({ color, accentColor, label }: { color: string; accentColor: string; label: string }) {
    return (
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto mb-2">
            {/* Particle burst on reveal */}
            <RankParticles color={color} />

            {/* Outer glow halo — breathing */}
            <motion.div
                className="absolute inset-[-25%] rounded-full"
                style={{
                    background: `radial-gradient(circle, ${color}25 0%, transparent 65%)`,
                }}
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.4, 0.7, 0.4],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Conic light sweep */}
            <motion.div
                className="absolute inset-[-15%] rounded-full"
                style={{
                    background: `conic-gradient(from 0deg, transparent, ${color}18, transparent, ${color}12, transparent, ${color}18, transparent)`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />

            {/* Outer ring — dashed, spinning */}
            <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full" fill="none">
                <circle cx="60" cy="60" r="56" stroke={color} strokeWidth="2" strokeOpacity="0.2" />
                <circle cx="60" cy="60" r="56" stroke={`url(#ring-grad-${label})`} strokeWidth="2.5" strokeDasharray="10 5" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="15s" repeatCount="indefinite" />
                </circle>
                <defs>
                    <linearGradient id={`ring-grad-${label}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={color} stopOpacity="0.15" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Shield body */}
            <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full" fill="none">
                <path
                    d="M60 16 L96 30 L96 68 C96 88 78 102 60 112 C42 102 24 88 24 68 L24 30 Z"
                    fill={`url(#shield-fill-${label})`}
                    stroke={color}
                    strokeWidth="2"
                />
                <path
                    d="M60 26 L86 37 L86 65 C86 81 72 92 60 100 C48 92 34 81 34 65 L34 37 Z"
                    fill="rgba(0,0,0,0.35)"
                    stroke={color}
                    strokeWidth="1"
                    strokeOpacity="0.25"
                />
                {/* Star emblem with pulse */}
                <path
                    d="M60 40 L65 54 L80 54 L68 63 L73 77 L60 68 L47 77 L52 63 L40 54 L55 54 Z"
                    fill={color}
                    fillOpacity="0.95"
                >
                    <animate attributeName="fillOpacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
                </path>
                {/* Inner glow */}
                <circle cx="60" cy="60" r="22" fill={color} fillOpacity="0.06">
                    <animate attributeName="r" values="22;27;22" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="fillOpacity" values="0.06;0.15;0.06" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <defs>
                    <linearGradient id={`shield-fill-${label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accentColor} />
                        <stop offset="100%" stopColor={color} stopOpacity="0.25" />
                    </linearGradient>
                </defs>
            </svg>
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
    { threshold: 10000, label: "COSMIC", color: "#B366FF", accent: "#1a0533", icon: "🌌" },
    { threshold: 5000, label: "GOLD", color: "#FFE048", accent: "#2a1a00", icon: "🥇" },
    { threshold: 2500, label: "UNCOMMON", color: "#4A9EFF", accent: "#0a1a2a", icon: "🔵" },
    { threshold: 0, label: "COMMON", color: "#E0E0E0", accent: "#1a1a1a", icon: "⚪" },
];

function getRank(score: number) {
    return RANK_CONFIG.find((r) => score >= r.threshold) || RANK_CONFIG[RANK_CONFIG.length - 1];
}

/* ===== TIER LABEL COLORS ===== */
const TIER_LABEL_CONFIG: Record<BadgeTier, { bg: string; text: string }> = {
    blue: { bg: "rgba(255, 255, 255, 0.1)", text: "#E0E0E0" }, // Grey/White
    silver: { bg: "rgba(74, 158, 255, 0.15)", text: "#4A9EFF" }, // Blue
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
            className="relative bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3 sm:p-4 backdrop-blur-sm overflow-hidden group"
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

            <div className="flex items-center justify-center gap-1.5 mb-1.5">
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
                        className="absolute -bottom-1 -right-1 text-[8px] font-mundial font-bold px-1 py-0.5 rounded-md"
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

export default function GameOver({ state, userProfile, onPlayAgain, onGoHome }: GameOverProps) {
    const { score, matchCount, maxCombo, gameMode, gameBadges } = state;
    const rank = getRank(score);
    const [isNewHighScore, setIsNewHighScore] = useState(false);

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
            })
                .then(res => res.json())
                .then(data => {
                    if (data.isNewBest) {
                        setIsNewHighScore(true);
                    }
                })
                .catch(e => console.error("Failed to post score", e));
        }
    }, [score, gameMode, userProfile?.username]);

    const handleShareX = () => {
        const modeLabel = gameMode === "daily" ? "Daily Challenge" : "Classic";
        const text = `🎮 I scored ${score.toLocaleString()} on VibeMatch ${modeLabel}!\n🏆 Rank: ${rank.label}\n🔥 Best Combo: ×${maxCombo}\n\nCan you beat me? 🤙\n\n#VibeMatch`;
        const url = "https://vibematch.gg";
        const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

        const win = window.open(intentUrl, "_blank", "noopener,noreferrer");
        if (!win) {
            navigator.clipboard.writeText(`${text}\n\n${url}`).then(() => {
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
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
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
                        className="rounded-[26px] px-5 py-7 sm:px-8 sm:py-9 text-center relative overflow-hidden"
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

                        {/* ===== RANK MEDALLION — with slam entrance ===== */}
                        <motion.div
                            initial={{ scale: 0, rotate: -15 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 250,
                                damping: 16,
                                delay: 0.3,
                            }}
                        >
                            <RankMedallion color={rank.color} accentColor={rank.accent} label={rank.label} />
                        </motion.div>

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


                        {/* ===== ANIMATED SCORE — with glow pulse & NEW BEST decal ===== */}
                        <motion.div
                            className="mb-8 relative"
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

                            {/* New High Score Decal */}
                            <AnimatePresence>
                                {isNewHighScore && (
                                    <motion.div
                                        className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FF4500] to-[#FF8C00] text-white font-mundial font-black uppercase tracking-widest text-[9px] sm:text-[10px] px-3 py-1 rounded-full shadow-[0_0_15px_rgba(255,140,0,0.6)] z-10"
                                        initial={{ opacity: 0, y: 10, scale: 0.5, rotate: -3 }}
                                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                                        transition={{ delay: 2.2, type: "spring", stiffness: 400, damping: 12 }}
                                    >
                                        New Best!
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* ===== STATS ROW ===== */}
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-5">
                            <StatCard
                                label="Matches"
                                value={matchCount}
                                color="text-white"
                                icon={Target}
                                delay={0.9}
                            />
                            <StatCard
                                label="Best Combo"
                                value={`×${maxCombo}`}
                                color="text-[#FF5F1F]"
                                icon={Flame}
                                delay={1.0}
                            />
                            <StatCard
                                label="Badges"
                                value={gameBadges.length}
                                color="text-white"
                                icon={Award}
                                delay={1.1}
                            />
                        </div>


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
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white font-mundial font-semibold text-[13px] sm:text-sm transition-all duration-200 active:scale-[0.97] group"
                            >
                                <Home size={16} className="text-white/50 group-hover:text-white/80 transition-colors" />
                                Home
                            </button>

                            {/* Share on X button */}
                            <button
                                onClick={handleShareX}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white font-mundial font-semibold text-[13px] sm:text-sm transition-all duration-200 active:scale-[0.97] group"
                            >
                                <div className="text-white/50 group-hover:text-white/80 transition-colors">
                                    <XIcon size={14} />
                                </div>
                                Share 𝕏
                            </button>

                            {/* Rematch button — Classic only */}
                            {gameMode === "classic" && (
                                <button
                                    onClick={onPlayAgain}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-[#FFE048] hover:bg-white/[0.1] hover:border-[#FFE048]/50 hover:text-[#FFD000] font-mundial font-semibold text-[13px] sm:text-sm transition-all duration-200 active:scale-[0.97] group relative overflow-hidden"
                                    style={{ textShadow: "0 0 10px rgba(255,224,72,0.3)" }}
                                >
                                    <RotateCcw size={16} className="text-[#FFE048]/60 group-hover:text-[#FFE048] transition-colors" />
                                    Rematch
                                </button>
                            )}
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
