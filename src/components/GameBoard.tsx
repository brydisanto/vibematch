"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Cell, Position, SpecialTileType } from "@/lib/gameEngine";
import { TIER_COLORS, TIER_BORDER_COLORS, BadgeTier } from "@/lib/badges";
import { ScorePopup, MatchEffect } from "@/lib/useGame";
import { useEffect, useState } from "react";

interface GameBoardProps {
    board: Cell[][];
    selectedTile: Position | null;
    onTileClick: (pos: Position) => void;
    scorePopups: ScorePopup[];
    isAnimating: boolean;
    matchEffect: MatchEffect | null;
    combo: number;
    isDealing?: boolean;
}

/* ===== FULL-TILE IMMERSIVE SPECIAL EFFECTS ===== */
function BombOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_0_20px_rgba(255,0,0,0.8)]">
            <motion.div
                className="absolute inset-0 border-[3px] sm:border-[4px] border-[#FF3333] rounded-lg sm:rounded-xl"
                animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [0.98, 1, 0.98],
                    boxShadow: [
                        "inset 0 0 10px rgba(255,51,51,0.5), 0 0 10px rgba(255,51,51,0.5)",
                        "inset 0 0 25px rgba(255,51,51,1), 0 0 25px rgba(255,51,51,1)",
                        "inset 0 0 10px rgba(255,51,51,0.5), 0 0 10px rgba(255,51,51,0.5)"
                    ]
                }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Warning crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center opacity-80">
                <div className="w-[80%] h-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div className="absolute h-[80%] w-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <motion.div
                    className="absolute w-4 h-4 rounded-full bg-[#FF3333] shadow-[0_0_15px_#FF3333]"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                />
            </div>
        </div>
    );
}

function VibestreakOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden">
            <motion.div
                className="absolute inset-0 border-[3px] border-[#4A9EFF] rounded-lg sm:rounded-xl"
                animate={{
                    opacity: [0.4, 1, 0.4],
                    boxShadow: [
                        "inset 0 0 15px rgba(74,158,255,0.4), 0 0 15px rgba(255,224,72,0.4)",
                        "inset 0 0 40px rgba(74,158,255,0.9), 0 0 40px rgba(255,224,72,0.9)",
                        "inset 0 0 15px rgba(74,158,255,0.4), 0 0 15px rgba(255,224,72,0.4)"
                    ]
                }}
                transition={{ duration: 0.2, repeat: Infinity, ease: "linear" }}
            />
            {/* Electrical arcs */}
            <svg className="absolute inset-0 w-full h-full" fill="none">
                <motion.path
                    d="M 10 10 L 40 40 L 70 20 L 90 80"
                    stroke="url(#electric-grad)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    animate={{
                        opacity: [0, 1, 0, 1, 0],
                        pathLength: [0, 1, 1, 0, 0]
                    }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                />
                <defs>
                    <linearGradient id="electric-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#4A9EFF" />
                        <stop offset="100%" stopColor="#FFE048" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}

function CosmicBlastOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden">
            {/* Swirling galactic vortex */}
            <motion.div
                className="absolute -inset-10 opacity-70"
                style={{
                    background: "conic-gradient(from 0deg at 50% 50%, rgba(179,102,255,0) 0%, rgba(255,107,157,0.6) 25%, rgba(179,102,255,0) 50%, rgba(74,158,255,0.6) 75%, rgba(179,102,255,0) 100%)"
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
            {/* Energy Core */}
            <motion.div
                className="absolute inset-[15%] rounded-full bg-black/40 blur-[4px] border border-[#B366FF]/50"
                animate={{
                    scale: [0.9, 1.1, 0.9],
                    boxShadow: [
                        "0 0 20px rgba(179,102,255,0.5), inset 0 0 10px rgba(255,255,255,0.2)",
                        "0 0 40px rgba(179,102,255,1), inset 0 0 20px rgba(255,255,255,0.8)",
                        "0 0 20px rgba(179,102,255,0.5), inset 0 0 10px rgba(255,255,255,0.2)"
                    ]
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
        </div>
    );
}

/* ===== TIER CSS CLASS MAP ===== */
const TIER_IDLE_CLASS: Record<BadgeTier, string> = {
    blue: "tile-tier-blue",
    silver: "tile-tier-silver",
    gold: "tile-tier-gold",
    cosmic: "tile-tier-cosmic",
};

/* ===== MATCH PARTICLES — Enhanced per-tier ===== */
function MatchParticles({ effect }: { effect: MatchEffect }) {
    const [particles, setParticles] = useState<
        { id: number; x: number; y: number; tx: number; ty: number; color: string; size: number; delay: number }[]
    >([]);

    useEffect(() => {
        const colors = ["#FFE048", "#FF5F1F", "#B366FF", "#4A9EFF", "#FF6B9D", "#2EFF2E", "#fff"];
        const count =
            effect.intensity === "ultra" ? 96
                : effect.intensity === "mega" ? 64
                    : effect.intensity === "big" ? 40
                        : 24;

        const newParticles = Array.from({ length: count }, (_, i) => {
            const origin = effect.positions[Math.floor(Math.random() * effect.positions.length)];
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const distance =
                effect.intensity === "ultra" ? 100 + Math.random() * 200
                    : effect.intensity === "mega" ? 80 + Math.random() * 160
                        : 60 + Math.random() * 140;

            return {
                id: i,
                x: (origin.col / 8) * 100 + 6.25,
                y: (origin.row / 8) * 100 + 6.25,
                tx: Math.cos(angle) * distance,
                ty: Math.sin(angle) * distance,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: effect.intensity === "ultra" ? 6 + Math.random() * 12 : 5 + Math.random() * 8,
                delay: Math.random() * 0.15,
            };
        });

        setParticles(newParticles);
    }, [effect]);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                    }}
                    initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    animate={{ opacity: 0, scale: 0, x: p.tx, y: p.ty }}
                    transition={{
                        duration: 0.6 + Math.random() * 0.4,
                        delay: p.delay,
                        ease: "easeOut",
                    }}
                />
            ))}
        </div>
    );
}

/* ===== SHOCKWAVE RING — Big+ matches ===== */
function ShockwaveRing({ effect }: { effect: MatchEffect }) {
    if (effect.intensity === "normal") return null;

    const centerPos = effect.positions[Math.floor(effect.positions.length / 2)];
    const extraClass =
        effect.intensity === "ultra" ? "shockwave-ring-ultra"
            : effect.intensity === "mega" ? "shockwave-ring-mega"
                : "";

    return (
        <div
            className={`shockwave-ring ${extraClass}`}
            style={{
                left: `${(centerPos.col / 8) * 100 + 6.25}%`,
                top: `${(centerPos.row / 8) * 100 + 6.25}%`,
            }}
        />
    );
}

/* ===== SCREEN EDGE GLOW — Big+ matches ===== */
function ScreenEdgeGlow({ intensity }: { intensity: string }) {
    if (intensity === "normal") return null;
    const cls =
        intensity === "ultra" ? "screen-edge-glow-ultra"
            : intensity === "mega" ? "screen-edge-glow-mega"
                : "screen-edge-glow";
    return <div className={`screen-edge-glow ${cls}`} />;
}

/* ===== SCREEN FLASH ===== */
function ScreenFlash({ intensity }: { intensity: string }) {
    const color =
        intensity === "ultra" ? "rgba(179, 102, 255, 0.25)"
            : intensity === "mega" ? "rgba(255, 95, 31, 0.2)"
                : intensity === "big" ? "rgba(255, 224, 72, 0.15)"
                    : "rgba(255, 255, 255, 0.08)";

    return (
        <motion.div
            className="absolute inset-0 pointer-events-none z-30 rounded-2xl"
            style={{ backgroundColor: color }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: intensity === "ultra" ? 0.7 : intensity === "mega" ? 0.5 : 0.35, ease: "easeOut" }}
        />
    );
}

/* ===== AURORA OVERLAY — Ultra only ===== */
function AuroraOverlay({ active }: { active: boolean }) {
    if (!active) return null;
    return <div className="aurora-overlay z-25" />;
}

/* ===== SCREEN CRACK — Ultra only ===== */
function ScreenCrackOverlay({ active }: { active: boolean }) {
    if (!active) return null;
    return (
        <div className="screen-crack z-35">
            <svg viewBox="0 0 400 400" className="w-full h-full opacity-40" fill="none" preserveAspectRatio="none">
                <path
                    d="M200 200 L180 150 L160 120 L155 80 M200 200 L230 140 L250 100 M200 200 L170 230 L140 260 L120 290 M200 200 L240 240 L270 250 M200 200 L190 170 L175 140"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                <path
                    d="M200 200 L210 160 L225 130 M200 200 L160 200 L130 190 M200 200 L220 230 L250 270"
                    stroke="rgba(179,102,255,0.4)"
                    strokeWidth="1"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}

/* ===== COMBO STREAK BANNER — Street Fighter style ===== */
function ComboStreakBanner({ effect }: { effect: MatchEffect }) {
    if (effect.combo < 2) return null;

    // Map combo count to escalating hype labels
    const COMBO_TIERS = [
        { minCombo: 2, label: "YUGE!", fill: "#FFFFFF", stroke: "#FF5F1F", shadow: "rgba(255,95,31,0.9)", rotate: -3, size: "text-7xl sm:text-8xl lg:text-9xl" },
        { minCombo: 3, label: "BIG VIBES!!", fill: "#FF5F1F", stroke: "#1a0800", shadow: "rgba(255,95,31,0.8)", rotate: 2, size: "text-6xl sm:text-8xl lg:text-[7rem]" },
        { minCombo: 4, label: "ELECTRIC!!!", fill: "#FFE048", stroke: "#1a1000", shadow: "rgba(255,224,72,0.9)", rotate: -2, size: "text-6xl sm:text-8xl lg:text-[7rem]", italic: true },
        { minCombo: 5, label: "MAX STOKED!!!!", fill: "#FFE048", stroke: "#2a0845", shadow: "rgba(179,102,255,0.8)", rotate: 3, size: "text-5xl sm:text-7xl lg:text-[6.5rem]" },
    ];

    const tier = [...COMBO_TIERS].reverse().find(t => effect.combo >= t.minCombo) || COMBO_TIERS[0];

    return (
        <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
        >
            {/* Background flash */}
            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ duration: 0.4 }}
                style={{ background: `radial-gradient(circle, ${tier.shadow} 0%, transparent 70%)` }}
            />

            {/* Main combo text — massive, multi-layered */}
            <motion.div
                className={`font-display ${tier.size} font-black leading-none text-center select-none ${tier.italic ? "italic" : ""}`}
                initial={{ scale: 3, opacity: 0, rotate: tier.rotate * 3 }}
                animate={{
                    scale: [3, 0.9, 1.05, 1],
                    opacity: [0, 1, 1, 1],
                    rotate: [tier.rotate * 3, tier.rotate * -0.5, tier.rotate],
                }}
                exit={{ scale: 1.5, opacity: 0, y: -40 }}
                transition={{
                    duration: 0.5,
                    times: [0, 0.4, 0.7, 1],
                    ease: "easeOut",
                }}
                style={{
                    color: tier.fill,
                    WebkitTextStroke: `4px ${tier.stroke}`,
                    paintOrder: "stroke fill",
                    textShadow: `
                        0 0 40px ${tier.shadow},
                        0 0 80px ${tier.shadow},
                        0 6px 0 ${tier.stroke},
                        0 8px 20px rgba(0,0,0,0.8)
                    `,
                    transform: `rotate(${tier.rotate}deg)`,
                    letterSpacing: "-0.02em",
                }}
            >
                {tier.label}
            </motion.div>

        </motion.div>
    );
}

/* ===== MAIN BOARD COMPONENT ===== */
export default function GameBoard({
    board,
    selectedTile,
    onTileClick,
    scorePopups,
    isAnimating,
    matchEffect,
    combo,
    isDealing = false,
}: GameBoardProps) {
    const [effectsQueue, setEffectsQueue] = useState<MatchEffect[]>([]);

    useEffect(() => {
        if (matchEffect) {
            setEffectsQueue(prev => [...prev, matchEffect]);
            setTimeout(() => {
                setEffectsQueue(prev => prev.filter(e => e.timestamp !== matchEffect.timestamp));
            }, 2000);
        }
    }, [matchEffect]);

    // Board shake for mega+ matches
    const shakeClass = matchEffect?.intensity === "ultra"
        ? "animate-[board-shake_0.4s_ease-out]"
        : matchEffect?.intensity === "mega"
            ? "animate-[board-shake_0.25s_ease-out]"
            : "";

    // Board glow escalates with combo
    const boardGlowClass =
        combo >= 4 ? "board-glow-fire"
            : combo >= 2 ? "board-glow-hot"
                : "board-glow";

    // Board border gradient escalates with combo
    const boardBorderGradient =
        combo >= 4
            ? "from-[#B366FF]/60 via-[#FF5F1F]/50 to-[#B366FF]/60"
            : combo >= 2
                ? "from-[#FF5F1F]/50 via-[#FFE048]/40 to-[#FF5F1F]/50"
                : "from-[#FFE048]/40 via-[#FF5F1F]/25 to-[#FFE048]/40";

    return (
        <div className="relative w-full h-full">
            {/* Board container with combo-reactive glow */}
            <div className={`${boardGlowClass} rounded-2xl p-[3px] bg-gradient-to-br ${boardBorderGradient} ${shakeClass} transition-all duration-300 h-full border-2 border-[#c9a84c]`}>
                <div className="rounded-2xl bg-[#111]/95 p-1.5 sm:p-2 h-full" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    <div
                        className="grid gap-[3px] sm:gap-1 h-full"
                        style={{
                            gridTemplateColumns: `repeat(8, 1fr)`,
                            gridTemplateRows: `repeat(8, 1fr)`,
                        }}
                    >
                        {board.map((row, rowIdx) =>
                            row.map((cell, colIdx) => {
                                const isSelected =
                                    selectedTile?.row === rowIdx && selectedTile?.col === colIdx;
                                const tierColor = TIER_COLORS[cell.badge.tier];
                                const tierBorder = TIER_BORDER_COLORS[cell.badge.tier];
                                const tierClass = TIER_IDLE_CLASS[cell.badge.tier];
                                const Overlay =
                                    cell.isSpecial === "bomb" ? BombOverlay
                                        : cell.isSpecial === "vibestreak" ? VibestreakOverlay
                                            : cell.isSpecial === "cosmic_blast" ? CosmicBlastOverlay
                                                : null;

                                // Dealing animation delay: row-by-row cascade
                                const dealDelay = isDealing ? (rowIdx * 0.06 + colIdx * 0.02) : 0;

                                return (
                                    <motion.button
                                        key={cell.id}
                                        className={`
                                            relative aspect-square rounded-lg sm:rounded-xl overflow-hidden
                                            cursor-pointer transition-colors duration-150
                                            border-2 hover:brightness-110 active:scale-95
                                            ${tierClass}
                                            ${isSelected ? "tile-selected z-10" : ""}
                                            ${cell.isSpecial ? "special-glow" : ""}
                                            ${isDealing ? "tile-deal" : ""}
                                        `}
                                        style={{
                                            borderColor: isSelected ? tierColor : tierBorder,
                                            animationDelay: isDealing ? `${dealDelay}s` : undefined,
                                        }}
                                        onClick={() => onTileClick({ row: rowIdx, col: colIdx })}
                                        disabled={isAnimating}
                                        whileHover={{ scale: 1.06, zIndex: 5 }}
                                        whileTap={{ scale: 0.93 }}
                                        layout
                                        initial={cell.isNew && !isDealing ? { y: -60, opacity: 0 } : false}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 220,
                                            damping: 22,
                                            mass: 0.9,
                                        }}
                                    >
                                        {/* Badge image */}
                                        <div className="absolute inset-[2px] sm:inset-[3px] rounded-md sm:rounded-lg overflow-hidden">
                                            <Image
                                                src={cell.badge.image}
                                                alt={cell.badge.name}
                                                fill
                                                sizes="(max-width: 640px) 56px, 80px"
                                                className="object-cover"
                                                priority
                                            />
                                        </div>

                                        {Overlay && <Overlay />}

                                        {/* Selected highlight ring */}
                                        {isSelected && (
                                            <motion.div
                                                className="absolute inset-0 rounded-lg sm:rounded-xl"
                                                style={{
                                                    border: `2px solid ${tierColor}`,
                                                    boxShadow: `0 0 20px ${tierColor}, inset 0 0 15px ${tierBorder}`,
                                                }}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                            />
                                        )}
                                    </motion.button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* === HIERARCHICAL MATCH EFFECTS LAYER === */}
            <AnimatePresence>
                {effectsQueue.map(effect => (
                    <motion.div key={effect.timestamp} className="absolute inset-0 pointer-events-none z-40">
                        {/* Particle burst */}
                        <MatchParticles effect={effect} />

                        {/* Shockwave ring */}
                        <ShockwaveRing effect={effect} />

                        {/* Screen edge glow */}
                        <ScreenEdgeGlow intensity={effect.intensity} />

                        {/* Screen flash */}
                        <ScreenFlash intensity={effect.intensity} />

                        {/* Aurora overlay */}
                        <AuroraOverlay active={effect.intensity === "ultra"} />

                        {/* Screen crack */}
                        <ScreenCrackOverlay active={effect.intensity === "ultra"} />

                        {/* Combo streak banner */}
                        <ComboStreakBanner effect={effect} />
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Score popups layer */}
            {scorePopups.map((popup) => (
                <motion.div
                    key={popup.id}
                    className="score-popup absolute pointer-events-none z-50 font-display font-black text-3xl sm:text-5xl"
                    style={{
                        left: `${(popup.x / 8) * 100 + 6.25}%`,
                        top: `${(popup.y / 8) * 100 + 6.25}%`,
                        color: "var(--gvc-gold)",
                        textShadow: "0 0 25px rgba(255, 224, 72, 0.9), 0 3px 6px rgba(0,0,0,0.8), 0 -2px 4px rgba(0,0,0,0.5)",
                    }}
                    initial={{ opacity: 0, y: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 1, 1, 1, 0], y: -60, scale: [0.5, 1.4, 1.2, 1.2, 0.9] }}
                    transition={{ duration: 1.8, times: [0, 0.1, 0.25, 0.8, 1], ease: "easeOut" }}
                >
                    +{popup.value.toLocaleString()}
                </motion.div>
            ))}
        </div>
    );
}
