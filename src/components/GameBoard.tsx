"use client";

import Image from "next/image";
import { Cell, Position, SpecialTileType } from "@/lib/gameEngine";
import { TIER_COLORS, TIER_BORDER_COLORS, BadgeTier } from "@/lib/badges";
import { ScorePopup, MatchEffect } from "@/lib/useGame";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

const EMPTY_HINT_SET = new Set<string>();

/* ===== EFFECT PRIORITY SYSTEM ===== */
const EFFECT_PRIORITY: Record<string, number> = {
    ComboStreakBanner: 6,
    ShapeAnnouncement: 5,
    ScreenFlash: 4,
    TileRingBurst: 3,
    TileMatchFlash: 2,
    ScreenEdgeGlow: 1,
};
const MAX_SIMULTANEOUS_EFFECTS = 7;

/* ===== RESPONSIVE PARTICLE CAPS ===== */
function getParticleCap(): number {
    if (typeof window === 'undefined') return 140;
    const w = window.innerWidth;
    if (w < 768) return 45;
    if (w < 1024) return 80;
    return 140;
}

interface GameBoardProps {
    board: Cell[][];
    selectedTile: Position | null;
    onTileClick: (pos: Position) => void;
    onSwipe?: (from: Position, to: Position) => void;
    scorePopups: ScorePopup[];
    isAnimating: boolean;
    matchEffect: MatchEffect | null;
    combo: number;
    score: number;
    isDealing?: boolean;
    hintCells?: Set<string>;
    invalidSwapCells?: { row: number; col: number }[] | null;
    swapAnim?: { pos1: Position; pos2: Position } | null;
}

/* ===== FULL-TILE IMMERSIVE SPECIAL EFFECTS ===== */
function BombOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_0_20px_rgba(255,0,0,0.8)]">
            <div
                className="bomb-border absolute inset-0 border-[3px] sm:border-[4px] border-[#FF3333] rounded-lg sm:rounded-xl"
            />
            {/* Warning crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center opacity-80">
                <div className="w-[80%] h-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div className="absolute h-[80%] w-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div
                    className="bomb-core absolute w-4 h-4 rounded-full bg-[#FF3333] shadow-[0_0_15px_#FF3333]"
                />
            </div>
        </div>
    );
}

function LaserPartyOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_0_24px_rgba(74,158,255,0.9)]">
            {/* Pulsing bright border */}
            <div
                className="laser-border absolute inset-0 border-[3px] sm:border-[4px] border-[#4A9EFF] rounded-lg sm:rounded-xl"
            />
            {/* Scanning laser lines — horizontal + vertical */}
            <div className="laser-scan-h absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4AE0FF] to-transparent shadow-[0_0_12px_#4AE0FF,0_0_24px_#4A9EFF] opacity-90" />
            <div className="laser-scan-v absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#4AE0FF] to-transparent shadow-[0_0_12px_#4AE0FF,0_0_24px_#4A9EFF] opacity-90" />
            {/* Center energy core */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="laser-core w-3 h-3 rounded-full bg-[#4AE0FF] shadow-[0_0_16px_#4AE0FF,0_0_32px_#4A9EFF]" />
            </div>
        </div>
    );
}

function CosmicBlastOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden">
            {/* Outer pulsing inset glow */}
            <div
                className="cosmic-outer-glow absolute inset-0 rounded-lg sm:rounded-xl"
                style={{
                    boxShadow: "inset 0 0 10px rgba(179,102,255,0.7), inset 0 0 20px rgba(255,107,157,0.35)",
                }}
            />
            {/* Swirling galactic vortex */}
            <div
                className="cosmic-ring absolute -inset-6"
                style={{
                    background: "conic-gradient(from 0deg at 50% 50%, rgba(179,102,255,0) 0%, rgba(255,107,157,0.85) 25%, rgba(179,102,255,0) 50%, rgba(74,158,255,0.85) 75%, rgba(179,102,255,0) 100%)"
                }}
            />
            {/* Energy Core */}
            <div
                className="cosmic-glow absolute inset-[10%] rounded-full border-2 border-[#B366FF]/60"
                style={{
                    background: "radial-gradient(circle, rgba(179,102,255,0.35) 0%, rgba(179,102,255,0.08) 60%, transparent 100%)",
                }}
            />
            {/* Center pinpoint */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="cosmic-core-dot w-2.5 h-2.5 rounded-full"
                    style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(179,102,255,0.5) 60%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(179,102,255,0.9), 0 0 14px rgba(179,102,255,0.5)",
                    }}
                />
            </div>
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
        { id: number; x: number; y: number; tx: number; ty: number; color: string; size: number; delay: number; rotate: number; isSquare: boolean; duration: number; initialScale: number }[]
    >([]);

    const particleCap = useMemo(() => getParticleCap(), []);

    useEffect(() => {
        const colors = ["#FFE048", "#FF5F1F", "#B366FF", "#4A9EFF", "#FF6B9D", "#2EFF2E", "#fff"];
        const rawCount =
            effect.intensity === "ultra" ? 140
                : effect.intensity === "mega" ? 95
                    : effect.intensity === "big" ? 65
                        : 40;
        const count = Math.min(rawCount, particleCap);

        const newParticles = Array.from({ length: count }, (_, i) => {
            const origin = effect.positions[Math.floor(Math.random() * effect.positions.length)];
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
            const distance =
                effect.intensity === "ultra" ? 160 + Math.random() * 290
                    : effect.intensity === "mega" ? 130 + Math.random() * 240
                        : effect.intensity === "big" ? 110 + Math.random() * 210
                            : 90 + Math.random() * 170;

            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance + 50 + Math.random() * 40;

            return {
                id: i,
                x: (origin.col / 8) * 100 + 6.25,
                y: (origin.row / 8) * 100 + 6.25,
                tx,
                ty,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: effect.intensity === "ultra" ? 6 + Math.random() * 14 : 4 + Math.random() * 11,
                delay: Math.random() * 0.1,
                rotate: Math.random() * 720 - 360,
                isSquare: Math.random() > 0.55,
                duration: 0.7 + Math.random() * 0.5,
                initialScale: 1.8 + Math.random() * 2.2,
            };
        });

        setParticles(newParticles);
    }, [effect, particleCap]);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="match-particle"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        borderRadius: p.isSquare ? "2px" : "50%",
                        "--p-tx": `${p.tx}px`,
                        "--p-ty": `${p.ty}px`,
                        "--p-scale": p.initialScale,
                        "--p-duration": `${p.duration}s`,
                        "--p-delay": `${p.delay}s`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}

/* ===== TILE RING BURST — CSS-only expanding ring from each matched tile (big+) ===== */
function TileRingBurst({ effect }: { effect: MatchEffect }) {
    if (effect.intensity === "normal") return null;

    const ringColor =
        effect.intensity === "ultra" ? "#B366FF"
            : effect.intensity === "mega" ? "#FF5F1F"
                : "#FFE048";

    const finalScale = effect.intensity === "ultra" ? 6 : effect.intensity === "mega" ? 5 : 4;

    return (
        <>
            {effect.positions.map((pos, i) => (
                <div
                    key={i}
                    className="absolute rounded-full pointer-events-none ring-burst-effect"
                    style={{
                        left: `${(pos.col / 8) * 100 + 6.25}%`,
                        top: `${(pos.row / 8) * 100 + 6.25}%`,
                        width: 28,
                        height: 28,
                        marginLeft: -14,
                        marginTop: -14,
                        border: `3px solid ${ringColor}`,
                        '--ring-final-scale': finalScale,
                        animationDelay: `${i * 0.035}s`,
                    } as React.CSSProperties}
                />
            ))}
        </>
    );
}

/* ===== FEATURE 1: TILE MATCH FLASH — white-hot crunch pop at each matched tile ===== */
function TileMatchFlash({ effect, cellSize }: { effect: MatchEffect; cellSize: number }) {
    if (cellSize === 0) return null;

    return (
        <>
            {effect.positions.map((pos, i) => (
                <div
                    key={i}
                    className="absolute pointer-events-none tile-match-flash-effect"
                    style={{
                        left: cellSize * pos.col + cellSize / 2,
                        top: cellSize * pos.row + cellSize / 2,
                        zIndex: 35,
                    }}
                >
                    <div
                        style={{
                            width: cellSize * 0.9,
                            height: cellSize * 0.9,
                            transform: "translateX(-50%) translateY(-50%)",
                            background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,224,72,0.6) 45%, transparent 70%)",
                            borderRadius: "50%",
                        }}
                    />
                </div>
            ))}
        </>
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

/* ===== SCREEN FLASH — CSS-only ===== */
function ScreenFlash({ intensity }: { intensity: string }) {
    const color =
        intensity === "ultra" ? "rgba(179, 102, 255, 0.25)"
            : intensity === "mega" ? "rgba(255, 95, 31, 0.2)"
                : intensity === "big" ? "rgba(255, 224, 72, 0.15)"
                    : "rgba(255, 255, 255, 0.08)";

    const durClass =
        intensity === "ultra" ? "screen-flash--ultra"
            : intensity === "mega" ? "screen-flash--mega"
                : "screen-flash--normal";

    return (
        <div
            className={`absolute inset-0 pointer-events-none z-30 rounded-2xl screen-flash-effect ${durClass}`}
            style={{ backgroundColor: color }}
        />
    );
}



/* ===== COMBO STREAK BANNER — Street Fighter style, CSS-only ===== */
function ComboStreakBanner({ effect }: { effect: MatchEffect }) {
    if (effect.combo < 2) return null;

    const COMBO_TIERS = [
        { minCombo: 6, label: "rkf4trrgrggrgh;[['11]", fill: "#B366FF", stroke: "#0d0020", shadow: "rgba(179,102,255,0.95)", rotate: -2, size: "text-6xl sm:text-8xl", italic: true },
        { minCombo: 5, label: "MAX STOKED!", fill: "#FFE048", stroke: "#2a0845", shadow: "rgba(179,102,255,0.85)", rotate: 3, size: "text-6xl sm:text-8xl" },
        { minCombo: 4, label: "ELECTRIC!!", fill: "#FFE048", stroke: "#1a1000", shadow: "rgba(255,224,72,0.95)", rotate: -2, size: "text-6xl sm:text-8xl", italic: true },
        { minCombo: 3, label: "VIBES!", fill: "#FF5F1F", stroke: "#1a0800", shadow: "rgba(255,95,31,0.85)", rotate: 2, size: "text-6xl sm:text-8xl" },
        { minCombo: 2, label: "NICE!", fill: "#FFFFFF", stroke: "#FF5F1F", shadow: "rgba(255,95,31,0.9)", rotate: -3, size: "text-7xl sm:text-9xl" },
    ];

    const tier = COMBO_TIERS.find(t => effect.combo >= t.minCombo) ?? COMBO_TIERS[COMBO_TIERS.length - 1];

    return (
        <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 combo-banner-enter"
        >
            {/* Radial background flash */}
            <div
                className="absolute inset-0 opacity-30"
                style={{ background: `radial-gradient(ellipse at center, ${tier.shadow} 0%, transparent 65%)` }}
            />

            {/* Main combo text */}
            <div
                className={`relative font-display ${tier.size} font-black leading-none text-center select-none ${tier.italic ? "italic" : ""} combo-text-pop`}
                style={{
                    color: tier.fill,
                    WebkitTextStroke: `4px ${tier.stroke}`,
                    paintOrder: "stroke fill",
                    textShadow: `0 0 40px ${tier.shadow}, 0 0 80px ${tier.shadow}, 0 6px 0 ${tier.stroke}, 0 8px 20px rgba(0,0,0,0.8)`,
                    letterSpacing: "-0.02em",
                    '--combo-rotate': `${tier.rotate}deg`,
                    '--combo-rotate-start': `${tier.rotate * 2}deg`,
                } as React.CSSProperties}
            >
                {tier.label}
            </div>

            {/* xN COMBO sub-label */}
            <div
                className="font-display font-black tracking-[0.2em] text-white text-2xl sm:text-3xl uppercase mt-2 select-none combo-sublabel-enter"
                style={{
                    WebkitTextStroke: "1.5px rgba(0,0,0,0.6)",
                    paintOrder: "stroke fill",
                    textShadow: `0 0 20px ${tier.shadow}, 0 2px 8px rgba(0,0,0,0.9)`,
                }}
            >
                x{effect.combo} COMBO
            </div>
        </div>
    );
}

/* ===== CASCADE CHAIN LABEL — bottom zone, CSS-only ===== */
function CascadeLabel({ effect }: { effect: MatchEffect }) {
    if (effect.cascadeCount < 1) return null;

    const label =
        effect.cascadeCount >= 4 ? `VIBE CHAIN x${effect.cascadeCount}!`
            : effect.cascadeCount >= 3 ? "VIBE CHAIN x3!"
                : effect.cascadeCount >= 2 ? "VIBE CHAIN x2!"
                    : "VIBE WAVE!";

    const color =
        effect.cascadeCount >= 3 ? "#B366FF"
            : effect.cascadeCount >= 2 ? "#4A9EFF"
                : "#2EFF2E";

    return (
        <div
            className="absolute bottom-[10%] left-0 right-0 flex justify-center pointer-events-none cascade-label-enter"
        >
            <span
                className="font-display font-black text-2xl sm:text-3xl tracking-wider uppercase select-none"
                style={{
                    color,
                    WebkitTextStroke: "1.5px rgba(0,0,0,0.75)",
                    paintOrder: "stroke fill",
                    textShadow: `0 0 22px ${color}, 0 0 44px ${color}60, 0 2px 8px rgba(0,0,0,0.9)`,
                }}
            >
                {label}
            </span>
        </div>
    );
}

/* ===== SHAPE ANNOUNCEMENT — top zone, CSS-only ===== */
function ShapeAnnouncement({ effect }: { effect: MatchEffect }) {
    const SHAPE_INFO: Record<string, { label: string; multiplierLabel: string }> = {
        L: { label: "L-SHAPE!", multiplierLabel: "1.5\u00D7" },
        T: { label: "T-SHAPE!", multiplierLabel: "2.5\u00D7" },
        cross: { label: "\u2726 CROSS!", multiplierLabel: "4\u00D7" },
    };

    const shapeType = effect.shapeBonusType;
    const hasShape = shapeType != null && shapeType in SHAPE_INFO;
    const hasRowStreak = effect.maxMatchSize >= 5;

    if (!hasShape && !hasRowStreak) return null;

    let label: string;
    let subtext: string | null = null;

    if (hasShape) {
        const info = SHAPE_INFO[shapeType!];
        label = info.label;
        subtext = info.multiplierLabel;
    } else {
        label = effect.maxMatchSize >= 6 ? "SIX IN A ROW!" : "5 IN A ROW!";
    }

    return (
        <div
            className="absolute top-[4%] left-0 right-0 flex flex-col items-center pointer-events-none z-40 shape-announce-enter"
        >
            <span
                className="font-display font-black text-2xl sm:text-3xl tracking-widest uppercase select-none px-4 py-1.5 rounded-full"
                style={{
                    color: "#FFE048",
                    background: "rgba(0,0,0,0.7)",
                    border: "1.5px solid rgba(255,224,72,0.4)",
                    WebkitTextStroke: "1.5px #8b6b15",
                    paintOrder: "stroke fill",
                    textShadow: "0 0 20px rgba(255,224,72,0.9), 0 0 40px rgba(255,224,72,0.4), 0 2px 8px rgba(0,0,0,0.9)",
                }}
            >
                {hasShape ? label : `\u2B50 ${label} \u2B50`}
            </span>
            {subtext && (
                <span
                    className="font-display font-black text-base sm:text-lg tracking-wider uppercase select-none mt-1 shape-subtext-enter"
                    style={{
                        color: "#FFE048",
                        textShadow: "0 0 14px rgba(255,224,72,0.8), 0 1px 6px rgba(0,0,0,0.9)",
                        opacity: 0.85,
                    }}
                >
                    {subtext} BONUS
                </span>
            )}
        </div>
    );
}

/* ===== FEATURE 2: MILESTONE BANNER — score threshold celebration, CSS-only ===== */
const MILESTONE_THRESHOLDS = [1000, 5000, 10000, 25000, 50000];

function MilestoneBanner({ milestone }: { milestone: number }) {
    const label = milestone >= 10000 ? `${milestone / 1000}K` : `${milestone}`;
    return (
        <div
            className="absolute left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-50 milestone-banner-enter"
            style={{ top: "22%" }}
        >
            {/* Main text */}
            <span
                className="relative font-display font-black text-3xl sm:text-4xl tracking-wider uppercase select-none px-5 py-2 rounded-full"
                style={{
                    color: "#FFE048",
                    background: "rgba(0,0,0,0.75)",
                    border: "2px solid rgba(255,224,72,0.45)",
                    WebkitTextStroke: "2px #5a3800",
                    paintOrder: "stroke fill",
                    textShadow: "0 0 30px rgba(255,224,72,0.95), 0 0 60px rgba(255,224,72,0.5), 0 3px 8px rgba(0,0,0,0.9)",
                }}
            >
                {label} MILESTONE!
            </span>
            {/* Sub-text */}
            <span
                className="relative font-mundial font-black tracking-[0.2em] text-sm sm:text-base uppercase mt-2 select-none"
                style={{
                    color: "#FFE048",
                    textShadow: "0 0 12px rgba(255,224,72,0.8), 0 1px 4px rgba(0,0,0,0.9)",
                    opacity: 0.85,
                }}
            >
                BONUS SCORE!
            </span>
        </div>
    );
}

/* ===== FEATURE 6: HOT STREAK PARTICLES — CSS-only fire embers at combo >= 4 ===== */
function HotStreakParticles({ combo }: { combo: number }) {
    if (combo < 4) return null;
    const isUltra = combo >= 6;
    const count = isUltra ? 12 : 8;
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            {Array.from({ length: count }, (_, i) => {
                const xPct = 5 + (i / count) * 90;
                const delay = (i * 0.18) % 1.2;
                const dur = 1.4 + (i % 3) * 0.3;
                const size = isUltra ? 4 + (i % 3) * 2 : 3 + (i % 2) * 2;
                const travelY = -(60 + (i % 4) * 25);
                const driftX = (i % 2 === 0 ? -1 : 1) * (i % 3 + 1) * 6;
                const color = i % 3 === 0 ? "#FF5F1F" : i % 3 === 1 ? "#FFE048" : "#FF8C00";
                return (
                    <div
                        key={i}
                        className="absolute rounded-full hot-streak-particle"
                        style={{
                            left: `${xPct}%`,
                            bottom: "0%",
                            width: size,
                            height: size,
                            background: color,
                            '--hs-x0': `${driftX}px`,
                            '--hs-y0': '0px',
                            '--hs-x1': '0px',
                            '--hs-y1': `${travelY}px`,
                            '--hs-duration': `${dur}s`,
                            '--hs-delay': `${delay}s`,
                        } as React.CSSProperties}
                    />
                );
            })}
        </div>
    );
}

/* ===== MAIN BOARD COMPONENT ===== */
export default function GameBoard({
    board,
    selectedTile,
    onTileClick,
    onSwipe,
    scorePopups,
    isAnimating,
    matchEffect,
    combo,
    score,
    isDealing = false,
    hintCells = EMPTY_HINT_SET,
    invalidSwapCells = null,
    swapAnim = null,
}: GameBoardProps) {
    const [effectsQueue, setEffectsQueue] = useState<MatchEffect[]>([]);
    const gridRef = useRef<HTMLDivElement>(null);
    const [cellSize, setCellSize] = useState(0);
    const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, []);

    // Track active effect types for priority throttling
    const activeEffectCount = useMemo(() => {
        let count = 0;
        for (const effect of effectsQueue) {
            if (effect.combo >= 2) count++; // ComboStreakBanner
            if (effect.shapeBonusType || effect.maxMatchSize >= 5) count++; // ShapeAnnouncement
            count++; // ScreenFlash always
            if (effect.intensity !== "normal") count += 2; // TileRingBurst + ScreenEdgeGlow
            count++; // TileMatchFlash
        }
        return count;
    }, [effectsQueue]);

    const shouldShowEffect = useCallback((effectName: string): boolean => {
        if (activeEffectCount <= MAX_SIMULTANEOUS_EFFECTS) return true;
        const priority = EFFECT_PRIORITY[effectName] ?? 0;
        // Suppress low-priority effects when overloaded
        return priority >= 3;
    }, [activeEffectCount]);

    // ===== SWIPE/DRAG GESTURE HANDLING =====
    const swipeStartTile = useRef<Position | null>(null);
    const swipeStartXY = useRef<{ x: number; y: number } | null>(null);
    const didSwipe = useRef(false);
    const SWIPE_THRESHOLD = 18;

    const handlePointerDown = useCallback((e: React.PointerEvent, row: number, col: number) => {
        if (isAnimating) return;
        swipeStartTile.current = { row, col };
        swipeStartXY.current = { x: e.clientX, y: e.clientY };
        didSwipe.current = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [isAnimating]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!swipeStartTile.current || !swipeStartXY.current || didSwipe.current || !onSwipe) return;
        const dx = e.clientX - swipeStartXY.current.x;
        const dy = e.clientY - swipeStartXY.current.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

        let targetRow = swipeStartTile.current.row;
        let targetCol = swipeStartTile.current.col;

        if (absDx > absDy) {
            targetCol += dx > 0 ? 1 : -1;
        } else {
            targetRow += dy > 0 ? 1 : -1;
        }

        if (targetRow < 0 || targetRow >= 8 || targetCol < 0 || targetCol >= 8) return;

        didSwipe.current = true;
        onSwipe(swipeStartTile.current, { row: targetRow, col: targetCol });
        swipeStartTile.current = null;
        swipeStartXY.current = null;
    }, [isAnimating, onSwipe]);

    const handlePointerUp = useCallback(() => {
        swipeStartTile.current = null;
        swipeStartXY.current = null;
    }, []);

    // Feature 2: milestone tracking
    const prevScoreRef = useRef(score);
    const [milestone, setMilestone] = useState<number | null>(null);

    useEffect(() => {
        const prev = prevScoreRef.current;
        prevScoreRef.current = score;
        const crossed = MILESTONE_THRESHOLDS.find(t => prev < t && score >= t);
        if (crossed !== undefined) {
            setMilestone(crossed);
            const timer = setTimeout(() => setMilestone(null), 2200);
            return () => clearTimeout(timer);
        }
    }, [score]);

    useEffect(() => {
        const update = () => {
            if (gridRef.current?.firstElementChild) {
                const rect = gridRef.current.firstElementChild.getBoundingClientRect();
                const gapPx = window.innerWidth >= 640 ? 4 : 2;
                setCellSize(rect.width + gapPx);
            }
        };
        update();
        const ro = new ResizeObserver(update);
        if (gridRef.current) ro.observe(gridRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (matchEffect) {
            setEffectsQueue(prev => {
                const next = [...prev, matchEffect];
                return next.length > 2 ? next.slice(-2) : next;
            });
            setTimeout(() => {
                setEffectsQueue(prev => prev.filter(e => e.timestamp !== matchEffect.timestamp));
            }, 2800);
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
            {/* Feature 2: Milestone Banner */}
            {milestone !== null && (
                <MilestoneBanner key={milestone} milestone={milestone} />
            )}

            {/* Board container with combo-reactive glow */}
            <div className={`${boardGlowClass} rounded-2xl p-[3px] bg-gradient-to-br ${boardBorderGradient} ${shakeClass} transition-all duration-300 h-full border-2 border-[#c9a84c]`}>
                <div className="rounded-2xl bg-[#111]/95 p-1 sm:p-2 h-full" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    <div
                        ref={gridRef}
                        className="grid gap-[2px] sm:gap-1 h-full"
                        style={{
                            gridTemplateColumns: `repeat(8, 1fr)`,
                            gridTemplateRows: `repeat(8, 1fr)`,
                            touchAction: "none",
                        }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        {board.map((row, rowIdx) =>
                            row.map((cell, colIdx) => {
                                const isSelected =
                                    selectedTile?.row === rowIdx && selectedTile?.col === colIdx;
                                const isHinted = hintCells.has(`${rowIdx},${colIdx}`);
                                const invalidIdx = invalidSwapCells?.findIndex(c => c.row === rowIdx && c.col === colIdx) ?? -1;
                                const isInvalidSwap = invalidIdx !== -1;
                                const isSwap1 = swapAnim?.pos1.row === rowIdx && swapAnim?.pos1.col === colIdx;
                                const isSwap2 = swapAnim?.pos2.row === rowIdx && swapAnim?.pos2.col === colIdx;
                                const swapDx = isSwap1 ? (swapAnim!.pos2.col - swapAnim!.pos1.col) * cellSize
                                    : isSwap2 ? (swapAnim!.pos1.col - swapAnim!.pos2.col) * cellSize : 0;
                                const swapDy = isSwap1 ? (swapAnim!.pos2.row - swapAnim!.pos1.row) * cellSize
                                    : isSwap2 ? (swapAnim!.pos1.row - swapAnim!.pos2.row) * cellSize : 0;
                                const tierColor = TIER_COLORS[cell.badge.tier];
                                const tierBorder = TIER_BORDER_COLORS[cell.badge.tier];
                                const tierClass = TIER_IDLE_CLASS[cell.badge.tier];
                                const Overlay =
                                    cell.isSpecial === "bomb" ? BombOverlay
                                        : cell.isSpecial === "vibestreak" ? LaserPartyOverlay
                                            : cell.isSpecial === "cosmic_blast" ? CosmicBlastOverlay
                                                : null;

                                const dealDelay = isDealing ? (rowIdx * 0.06 + colIdx * 0.02) : 0;
                                const isNewDrop = cell.isNew && !isDealing;
                                const isDroppingTile = !isDealing && (cell.dropDistance ?? 0) > 0;
                                const dropPx = isDroppingTile ? (cell.dropDistance! * cellSize) : 0;

                                // Determine if tile is currently animating (for will-change)
                                const isTileAnimating = isInvalidSwap || isSwap1 || isSwap2 || isDroppingTile || isDealing;

                                return (
                                    <button
                                        key={cell.id}
                                        className={`
                                            game-tile
                                            cursor-pointer hover:brightness-110
                                            relative aspect-square rounded-lg sm:rounded-xl overflow-hidden
                                            transition-colors duration-150
                                            border-2
                                            ${tierClass}
                                            ${isSelected ? "tile-selected z-10" : ""}
                                            ${cell.isSpecial ? "special-glow" : ""}
                                            ${isDealing ? "tile-deal" : ""}
                                            ${isHinted && !isSelected ? "ring-[3px] ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]" : ""}
                                            ${isInvalidSwap ? "game-tile--invalid-shake" : ""}
                                            ${isDroppingTile && !isSwap1 && !isSwap2 ? "game-tile--dropping" : ""}
                                            ${(isSwap1 || isSwap2) ? "game-tile--swapping" : ""}
                                            ${isTileAnimating ? "game-tile--animating" : ""}
                                        `}
                                        style={{
                                            borderColor: isSelected ? tierColor : tierBorder,
                                            animationDelay: isDealing ? `${dealDelay}s` : undefined,
                                            '--swap-dx': (isSwap1 || isSwap2) ? `${swapDx}px` : undefined,
                                            '--swap-dy': (isSwap1 || isSwap2) ? `${swapDy}px` : undefined,
                                            '--drop-distance': isDroppingTile ? `${-dropPx}px` : undefined,
                                            '--drop-delay': isDroppingTile ? `${colIdx * 0.02}s` : undefined,
                                        } as React.CSSProperties}
                                        onPointerDown={(e) => handlePointerDown(e, rowIdx, colIdx)}
                                        onClick={() => {
                                            if (didSwipe.current) { didSwipe.current = false; return; }
                                            onTileClick({ row: rowIdx, col: colIdx });
                                        }}
                                        disabled={isAnimating}
                                    >
                                        {/* Badge image */}
                                        <div
                                            className="absolute inset-[2px] sm:inset-[3px] rounded-md sm:rounded-lg overflow-hidden"
                                            style={{ backgroundColor: `${tierColor}40` }}
                                        >
                                            <Image
                                                src={cell.badge.image}
                                                alt={cell.badge.name}
                                                fill
                                                sizes="(max-width: 640px) 56px, 80px"
                                                className="object-cover transition-opacity duration-200"
                                                loading="eager"
                                                quality={75}
                                            />
                                        </div>

                                        {Overlay && <Overlay />}

                                        {/* Hint pulse overlay — CSS only */}
                                        {isHinted && !isSelected && (
                                            <div className="absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none hint-pulse-overlay" />
                                        )}

                                        {/* Selected highlight ring — CSS only */}
                                        {isSelected && (
                                            <div
                                                className="absolute inset-0 rounded-lg sm:rounded-xl selected-highlight-ring"
                                                style={{
                                                    border: `2px solid ${tierColor}`,
                                                    '--sel-color': tierColor,
                                                    '--sel-border': tierBorder,
                                                } as React.CSSProperties}
                                            />
                                        )}

                                        {/* Feature 5: Tile Selection Ripple — CSS only */}
                                        {isSelected && (
                                            <div
                                                className="absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none tile-select-ripple"
                                                style={{
                                                    border: "2px solid rgba(255, 224, 72, 0.8)",
                                                    borderRadius: "inherit",
                                                }}
                                            />
                                        )}

                                        {/* Hover brightening handled by CSS hover:brightness-110 */}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Feature 6: Hot Streak Particles */}
            <HotStreakParticles combo={combo} />

            {/* === HIERARCHICAL MATCH EFFECTS LAYER === */}
            {effectsQueue.map(effect => (
                <div key={effect.timestamp} className="absolute inset-0 pointer-events-none z-40">
                    {/* Particle burst */}
                    <MatchParticles effect={effect} />

                    {/* Per-tile ring burst */}
                    {shouldShowEffect('TileRingBurst') && <TileRingBurst effect={effect} />}

                    {/* Feature 1: Tile Match Flash */}
                    {shouldShowEffect('TileMatchFlash') && <TileMatchFlash effect={effect} cellSize={cellSize} />}

                    {/* Shockwave ring */}
                    <ShockwaveRing effect={effect} />

                    {/* Screen edge glow */}
                    {shouldShowEffect('ScreenEdgeGlow') && <ScreenEdgeGlow intensity={effect.intensity} />}

                    {/* Screen flash */}
                    {shouldShowEffect('ScreenFlash') && <ScreenFlash intensity={effect.intensity} />}

                    {/* Combo streak banner */}
                    {shouldShowEffect('ComboStreakBanner') && <ComboStreakBanner effect={effect} />}

                    {/* Cascade chain label */}
                    <CascadeLabel effect={effect} />

                    {/* Shape/streak announcement (top zone) */}
                    {shouldShowEffect('ShapeAnnouncement') && <ShapeAnnouncement effect={effect} />}
                </div>
            ))}

            {/* Score popups layer — CSS only */}
            {scorePopups.map((popup) => {
                const driftX = ((popup.x % 3) - 1) * 14;
                return (
                    <div
                        key={popup.id}
                        className="absolute pointer-events-none z-50 flex items-center justify-center score-popup-float"
                        style={{
                            left: `${(popup.x / 8) * 100 + 6.25}%`,
                            top: `${(popup.y / 8) * 100 + 6.25}%`,
                            '--popup-drift-x': `${driftX}px`,
                        } as React.CSSProperties}
                    >
                        <span
                            className="font-display font-black text-xl sm:text-2xl px-2.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{
                                color: "#FFE048",
                                background: "rgba(0,0,0,0.7)",
                                border: "1.5px solid rgba(255,224,72,0.4)",
                                textShadow: "0 0 10px rgba(255,224,72,0.6)",
                            }}
                        >
                            +{popup.value.toLocaleString()}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
