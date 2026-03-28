"use client";

import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import Image from "next/image";
import { Badge, BadgeTier, TIER_COLORS, TIER_DISPLAY_NAMES } from "@/lib/badges";

const CapsuleSphere3D = lazy(() => import("./CapsuleSphere3D"));
import {
    playCapsuleAppearSound,
    playCapsuleAnticipateSound,
    playCapsuleCrackSound,
    playCapsuleRevealSound,
    playNewPinSound,
    playCapsuleCollectSound,
} from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VibeCapsuleProps {
    isOpen: boolean;
    badge: Badge | null;
    tier: BadgeTier;
    isDuplicate: boolean;
    duplicateCount: number;
    quickOpen: boolean;
    onComplete: () => void;
}

type Phase = "idle" | "appear" | "anticipate" | "crack" | "reveal" | "collect";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAPSULE_SIZE = 160;

const CAPSULE_COLORS: Record<
    BadgeTier,
    { shell: string; shellDark: string; shellDeep: string; glow: string; accent: string; rim: string; specularIntensity: number }
> = {
    // Dark chrome / onyx / liquid mercury palette
    blue:   { shell: "#2a2a30", shellDark: "#1a1a20", shellDeep: "#0e0e14", glow: "#555560", accent: "#70707a", rim: "#888890", specularIntensity: 0.7 },
    silver: { shell: "#1a1a22", shellDark: "#121218", shellDeep: "#0a0a10", glow: "#C0D0E0", accent: "#D8E8F8", rim: "#E8F0FF", specularIntensity: 0.85 },
    gold:   { shell: "#1a1508", shellDark: "#12100a", shellDeep: "#0a0806", glow: "#FFD700", accent: "#FFE878", rim: "#FFF0A0", specularIntensity: 0.9 },
    cosmic: { shell: "#12081e", shellDark: "#0d0616", shellDeep: "#08030e", glow: "#B366FF", accent: "#DD88FF", rim: "#E0AAFF", specularIntensity: 0.92 },
};

const TIER_INTENSITY: Record<BadgeTier, number> = {
    blue: 1,
    silver: 1.3,
    gold: 1.7,
    cosmic: 2.2,
};

const PHASE_DURATION: Record<string, number> = {
    appear: 500,
    anticipate: 2800,
    crack: 800,
    reveal: 900,
};

// Haptic feedback helper — safe no-op on unsupported devices
function triggerHaptic(pattern: number | number[]) {
    try { navigator?.vibrate?.(pattern); } catch { /* unsupported */ }
}

const QUICK_DURATIONS: Record<string, number> = {
    crack: 300,
    reveal: 400,
};

// ---------------------------------------------------------------------------
// Particle generation helpers
// ---------------------------------------------------------------------------

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    angle: number;
    distance: number;
    duration: number;
    delay: number;
    color: string;
    shape: "circle" | "diamond" | "streak" | "star";
}

function generateOrbitParticles(tier: BadgeTier, count: number): Particle[] {
    const colors = CAPSULE_COLORS[tier];
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 0,
        y: 0,
        size: 3 + Math.random() * 4,
        angle: (i / count) * 360,
        distance: 50 + Math.random() * 30,
        duration: 1.5 + Math.random() * 1,
        delay: (i / count) * 0.8,
        color: i % 2 === 0 ? colors.glow : colors.accent,
        shape: "circle" as const,
    }));
}

function generateBurstParticles(tier: BadgeTier, count: number): Particle[] {
    const colors = CAPSULE_COLORS[tier];
    const isCosmic = tier === "cosmic";
    const cosmicColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#B366FF"];
    const shapes: Particle["shape"][] = ["circle", "diamond", "streak", "star"];

    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360 + (Math.random() - 0.5) * 30;
        const rad = (angle * Math.PI) / 180;
        const dist = 120 + Math.random() * 180 * TIER_INTENSITY[tier];
        return {
            id: i,
            x: Math.cos(rad) * dist,
            y: Math.sin(rad) * dist + 40,
            size: 3 + Math.random() * 6,
            angle,
            distance: dist,
            duration: 0.6 + Math.random() * 0.3,
            delay: Math.random() * 0.15,
            color: isCosmic
                ? cosmicColors[i % cosmicColors.length]
                : i % 3 === 0 ? colors.shell : i % 3 === 1 ? colors.glow : colors.accent,
            shape: shapes[i % shapes.length],
        };
    });
}

function generateRevealParticles(tier: BadgeTier, count: number): Particle[] {
    const colors = CAPSULE_COLORS[tier];
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        const rad = (angle * Math.PI) / 180;
        const dist = 100 + Math.random() * 120;
        return {
            id: i,
            x: Math.cos(rad) * dist,
            y: Math.sin(rad) * dist,
            size: 2 + Math.random() * 4,
            angle,
            distance: dist,
            duration: 0.8 + Math.random() * 0.4,
            delay: Math.random() * 0.2,
            color: i % 2 === 0 ? colors.glow : TIER_COLORS[tier],
            shape: "circle" as const,
        };
    });
}

// ---------------------------------------------------------------------------
// Particle shape styles
// ---------------------------------------------------------------------------

function getParticleStyle(shape: Particle["shape"], size: number, color: string): React.CSSProperties {
    const base = { background: color, boxShadow: `0 0 ${size * 2}px ${color}`, position: "absolute" as const };
    switch (shape) {
        case "diamond":
            return { ...base, width: size, height: size, borderRadius: 2, transform: "rotate(45deg)" };
        case "streak":
            return { ...base, width: size * 0.4, height: size * 2, borderRadius: 2 };
        case "star":
            return { ...base, width: size * 1.2, height: size * 1.2, clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" };
        default:
            return { ...base, width: size, height: size, borderRadius: "50%" };
    }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OrbitParticles({ tier, active }: { tier: BadgeTier; active: boolean }) {
    const particles = useMemo(() => generateOrbitParticles(tier, tier === "cosmic" ? 16 : 10), [tier]);
    if (!active) return null;

    return (
        <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="capsule-orbit-particle"
                    style={{
                        "--orbit-angle": `${p.angle}deg`,
                        "--orbit-distance": `${p.distance}px`,
                        "--orbit-size": `${p.size}px`,
                        "--orbit-duration": `${p.duration}s`,
                        "--orbit-delay": `${p.delay}s`,
                        "--orbit-color": p.color,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}

function BurstParticles({ tier, active }: { tier: BadgeTier; active: boolean }) {
    const particles = useMemo(
        () => generateBurstParticles(tier, tier === "cosmic" ? 50 : tier === "gold" ? 30 : 20),
        [tier]
    );
    if (!active) return null;

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ left: "50%", top: "50%" }}>
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    style={{
                        ...getParticleStyle(p.shape, p.size, p.color),
                        marginLeft: -p.size / 2,
                        marginTop: -p.size / 2,
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                    animate={{
                        x: p.x,
                        y: p.y,
                        opacity: [1, 0.8, 0],
                        scale: [1, 1.3, 0],
                        rotate: Math.random() * 360 * (Math.random() > 0.5 ? 1 : -1),
                    }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                />
            ))}
        </div>
    );
}

function RevealParticles({ tier, active }: { tier: BadgeTier; active: boolean }) {
    const particles = useMemo(
        () => generateRevealParticles(tier, tier === "cosmic" ? 24 : 14),
        [tier]
    );
    if (!active) return null;

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ left: "50%", top: "50%" }}>
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        width: p.size,
                        height: p.size,
                        background: p.color,
                        boxShadow: `0 0 ${p.size * 3}px ${p.color}80`,
                        marginLeft: -p.size / 2,
                        marginTop: -p.size / 2,
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                        x: p.x,
                        y: p.y,
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0.3],
                    }}
                    transition={{
                        duration: p.duration,
                        delay: 0.15 + p.delay,
                        ease: "easeOut",
                    }}
                />
            ))}
        </div>
    );
}

/** Animated crack lines SVG */
function CrackLines({ active, color }: { active: boolean; color: string }) {
    if (!active) return null;
    return (
        <motion.svg
            viewBox="0 0 160 160"
            className="absolute inset-0 w-full h-full pointer-events-none"
            fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.08 }}
            style={{ zIndex: 10 }}
        >
            <motion.path d="M80 80 L75 60 L82 45 L78 30 L85 18" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            <motion.path d="M80 80 L86 100 L78 115 L83 130 L76 142" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, delay: 0.04, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            <motion.path d="M75 60 L58 52 L48 40" stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.08, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <motion.path d="M82 45 L100 38 L115 30" stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.1, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <motion.path d="M86 100 L102 108 L118 115" stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.12, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <motion.path d="M78 115 L60 122 L45 128" stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.14, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <motion.path d="M80 80 L55 78 L35 82" stroke={color} strokeWidth="2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.06, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <motion.path d="M80 80 L108 82 L128 78" stroke={color} strokeWidth="2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.08, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </motion.svg>
    );
}

/** Shockwave ring on crack */
function ShockwaveRings({ active, color }: { active: boolean; color: string }) {
    if (!active) return null;
    return (
        <>
            <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 100, height: 100,
                    border: `3px solid ${color}`,
                    top: "50%", left: "50%",
                    marginTop: -50, marginLeft: -50,
                }}
                initial={{ scale: 0.1, opacity: 0.9 }}
                animate={{ scale: [0.1, 3, 5], opacity: [0.9, 0.4, 0] }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 100, height: 100,
                    border: `2px solid ${color}88`,
                    top: "50%", left: "50%",
                    marginTop: -50, marginLeft: -50,
                }}
                initial={{ scale: 0.1, opacity: 0.7 }}
                animate={{ scale: [0.1, 3, 5], opacity: [0.7, 0.3, 0] }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            />
        </>
    );
}

/** Light beam shooting upward from crack */
function LightBeam({ active, tier }: { active: boolean; tier: BadgeTier }) {
    if (!active || (tier !== "gold" && tier !== "cosmic")) return null;
    const colors = CAPSULE_COLORS[tier];
    return (
        <motion.div
            className="absolute pointer-events-none"
            style={{
                width: 60, height: 400,
                background: `linear-gradient(to top, ${colors.glow}, transparent)`,
                borderRadius: "50%",
                filter: "blur(8px)",
                bottom: "50%", left: "50%",
                marginLeft: -30,
                transformOrigin: "center bottom",
            }}
            initial={{ scaleY: 0, scaleX: 1, opacity: 0 }}
            animate={{ scaleY: [0, 1.5, 1.2], scaleX: [1, 0.6, 0.3], opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
    );
}

/** Screen flash overlay on crack */
function CrackFlash({ active, tier }: { active: boolean; tier: BadgeTier }) {
    if (!active) return null;
    const colors = CAPSULE_COLORS[tier];
    const isCosmic = tier === "cosmic";

    return (
        <motion.div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 200 }}
            initial={{ opacity: 0 }}
            animate={{
                opacity: [0, 1, 0.8, 0],
                background: isCosmic
                    ? [
                        "linear-gradient(45deg, #A855F7, #EC4899)",
                        "linear-gradient(90deg, #EC4899, #F59E0B, #10B981)",
                        "linear-gradient(135deg, #3B82F6, #A855F7)",
                        "transparent",
                    ]
                    : undefined,
                backgroundColor: isCosmic ? undefined : [
                    `${colors.glow}99`,
                    "#FFFFFF",
                    `${colors.glow}66`,
                    "transparent",
                ],
            }}
            transition={{
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
                times: [0, 0.05, 0.15, 1],
            }}
        />
    );
}

/** Center bloom — light erupts from center before badge materializes */
function CenterBloom({ active, color }: { active: boolean; color: string }) {
    if (!active) return null;
    return (
        <motion.div
            className="absolute pointer-events-none"
            style={{
                width: 20, height: 20,
                borderRadius: "50%",
                top: "50%", left: "50%",
                marginTop: -10, marginLeft: -10,
                background: "white",
                zIndex: 20,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{
                scale: [0, 0.5, 15],
                opacity: [1, 1, 0],
                background: ["#FFFFFF", "#FFFFFF", color],
            }}
            transition={{
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
            }}
        />
    );
}

/** Confetti shower for gold/cosmic reveal */
function ConfettiShower({ active, tier }: { active: boolean; tier: BadgeTier }) {
    if (!active || (tier !== "gold" && tier !== "cosmic")) return null;
    const confettiColors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#F7DC6F", "#BB8FCE", "#85C1E9", "#F1948A"];
    const count = tier === "cosmic" ? 40 : 24;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ left: "50%", top: "50%", marginLeft: -200, marginTop: -200, width: 400, height: 400 }}>
            {Array.from({ length: count }, (_, i) => {
                const side = Math.random() > 0.5 ? 1 : -1;
                return (
                    <motion.div
                        key={i}
                        className="absolute"
                        style={{
                            width: 4 + Math.random() * 6,
                            height: 8 + Math.random() * 12,
                            backgroundColor: confettiColors[i % confettiColors.length],
                            borderRadius: Math.random() > 0.5 ? "50%" : 2,
                            left: 200, top: 200,
                        }}
                        initial={{ x: 0, y: -20, rotate: 0, opacity: 1 }}
                        animate={{
                            x: side * (50 + Math.random() * 150),
                            y: 200 + Math.random() * 200,
                            rotate: Math.random() * 720 - 360,
                            opacity: [1, 1, 0.8, 0],
                        }}
                        transition={{
                            duration: 1.5 + Math.random() * 1,
                            ease: [0.22, 0, 0.36, 1],
                            delay: Math.random() * 0.3,
                        }}
                    />
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Premium 3D Sphere
// ---------------------------------------------------------------------------

function CapsuleShape({ tier, phase, onTap }: { tier: BadgeTier; phase: Phase; onTap: () => void }) {
    const colors = CAPSULE_COLORS[tier];
    const isCosmic = tier === "cosmic";
    const isGold = tier === "gold";
    const capsuleControls = useAnimation();
    const intensity = TIER_INTENSITY[tier];

    // Escalating wobble during anticipation — 2.8s with micro-pauses
    // Structure: slow build → pause → medium build → pause → frantic finale
    // Asymmetric values + translational jitter + exponential scale for physical weight
    useEffect(() => {
        if (phase === "anticipate") {
            capsuleControls.start({
                rotateZ: [
                    0, 0.3, -0.4, 0.6, -0.8, 1.1, -1.2, 1.6, -1.7,
                    0, 0, // ← micro-pause 1
                    2.3, -2.8, 3.4, -3.9, 4.8, -5.3, 6.4, -7.2,
                    0, 0, // ← micro-pause 2
                    7.2, -9.8, 11.3, -10.1, 12.6, -13.4, 14.2, -14.7, 0,
                ],
                rotateX: [
                    0, 0, 0, 0.3, -0.4, 0.6, -0.9, 1.1, -1.2,
                    0, 0,
                    1.7, -2.3, 2.8, -3.4, 3.9, -4.3, 4.8, -5.4,
                    0, 0,
                    5.8, -6.3, 6.9, -7.2, 7.4, -7.2, 7.5, -7.3, 0,
                ],
                rotateY: [
                    0, 0, 0.2, -0.3, 0.4, -0.6, 0.8, -0.9, 1.1,
                    0, 0,
                    1.6, -2.1, 2.5, -2.8, 3.2, -3.8, 4.2, -4.5,
                    0, 0,
                    4.8, -5.3, 5.2, -5.6, 5.4, -5.3, 5.5, -5.4, 0,
                ],
                // Translational jitter — small shifts on contact point sell physical weight
                x: [
                    0, 0, 0, 0, 0, 0.3, -0.3, 0.5, -0.5,
                    0, 0,
                    0.8, -1, 1.2, -1.5, 1.8, -2, 2.3, -2.5,
                    0, 0,
                    2.8, -3.2, 3.5, -3.2, 3.6, -3.4, 3.2, -3.5, 0,
                ],
                y: [
                    0, 0, 0, 0, 0, -0.2, 0.2, -0.3, 0.3,
                    0, 0,
                    -0.5, 0.6, -0.8, 1, -1.2, 1.3, -1.5, 1.6,
                    0, 0,
                    -1.8, 2, -2.2, 2, -2.3, 2.1, -2, 2.2, 0,
                ],
                // Exponential scale — slow at first, rapid at the end
                scale: [
                    1, 1, 1.001, 1, 1.003, 1.005, 1.008, 1.01, 1.012,
                    1.025, 1.025, // ← pause swell 1
                    1.025, 1.03, 1.035, 1.04, 1.05, 1.055, 1.065, 1.075,
                    1.085, 1.085, // ← pause swell 2
                    1.09, 1.095, 1.1, 1.105, 1.11, 1.12, 1.13, 1.14, 1.16,
                ],
                transition: {
                    duration: 2.8,
                    ease: "linear",
                    times: [
                        0, 0.03, 0.06, 0.09, 0.12, 0.16, 0.2, 0.24, 0.28,
                        0.32, 0.36, // micro-pause 1
                        0.39, 0.42, 0.46, 0.5, 0.53, 0.56, 0.58, 0.6,
                        0.62, 0.66, // micro-pause 2
                        0.7, 0.74, 0.78, 0.82, 0.86, 0.9, 0.93, 0.97, 1.0,
                    ],
                },
            });
            // Haptic pulses that accelerate with the wobble
            triggerHaptic(15);
            setTimeout(() => triggerHaptic(15), 700);
            setTimeout(() => triggerHaptic(20), 1300);
            setTimeout(() => triggerHaptic(25), 1800);
            setTimeout(() => triggerHaptic(30), 2100);
            setTimeout(() => triggerHaptic(35), 2400);
            setTimeout(() => triggerHaptic([20, 30, 40]), 2600);
        }
    }, [phase, capsuleControls]);

    const isCracking = phase === "crack";

    // Dark chrome multi-layer gradients — metallic with strong highlights
    const topHalfBg = isCosmic
        ? undefined
        : `radial-gradient(ellipse 120% 100% at 50% 110%, ${colors.accent}22 0%, ${colors.shell} 35%, ${colors.shellDark} 60%, ${colors.shellDeep} 100%)`;

    const bottomHalfBg = isCosmic
        ? undefined
        : `radial-gradient(ellipse 120% 100% at 50% -10%, ${colors.shell}bb 0%, ${colors.shellDark} 45%, ${colors.shellDeep} 100%)`;

    const seamColor = isGold ? colors.accent : colors.glow;

    return (
        <motion.div
            className="relative cursor-pointer select-none"
            style={{ width: CAPSULE_SIZE, height: CAPSULE_SIZE, perspective: 400 }}
            animate={capsuleControls}
            onClick={phase === "anticipate" || phase === "appear" ? onTap : undefined}
            whileTap={phase === "anticipate" || phase === "appear" ? { scale: 0.95, transition: { duration: 0.05 } } : undefined}
            role="button"
            tabIndex={0}
            aria-label="Open capsule"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { if (phase === "anticipate" || phase === "appear") onTap(); } }}
        >
            {/* Pulsing outer glow — intensifies during anticipation */}
            <motion.div
                className="absolute pointer-events-none rounded-full"
                style={{ inset: "-30%", background: `radial-gradient(circle, ${colors.glow}30 0%, transparent 70%)` }}
                animate={phase === "anticipate" ? {
                    boxShadow: [
                        `0 0 15px 5px ${colors.glow}15`,
                        `0 0 20px 8px ${colors.glow}22`,
                        `0 0 30px 12px ${colors.glow}33`,
                        `0 0 30px 12px ${colors.glow}44`, // pause hold
                        `0 0 45px 20px ${colors.glow}55`,
                        `0 0 55px 25px ${colors.glow}77`,
                        `0 0 65px 30px ${colors.glow}88`,
                        `0 0 65px 30px ${colors.glow}99`, // pause hold
                        `0 0 80px 38px ${colors.glow}BB`,
                        `0 0 100px 50px ${colors.glow}EE`,
                    ],
                    scale: [1, 1.02, 1.05, 1.06, 1.1, 1.14, 1.18, 1.2, 1.28, 1.38],
                } : {}}
                transition={phase === "anticipate" ? { duration: 2.8, ease: "easeIn" } : {}}
            />

            {/* Contact shadow — responds to wobble */}
            <motion.div
                className="absolute pointer-events-none"
                style={{
                    bottom: -6, left: "28%", width: "44%", height: 8,
                    borderRadius: "50%",
                    background: `radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)`,
                }}
                animate={phase === "anticipate" ? {
                    x: [0, 0.5, -0.5, 0.8, -1, 1.2, -1.5, 1.8, -2, 0, 0, 2.2, -2.5, 2.8, -3, 3.2, -3.5, 3.2, -3.5, 0, 0, 3.5, -3.8, 4, -3.8, 4, -4, 3.8, -4, 0],
                    scaleX: [1, 1, 1, 1.01, 0.99, 1.02, 0.98, 1.03, 0.97, 1.04, 1.04, 1.04, 1.05, 1.06, 0.94, 1.07, 0.93, 1.08, 0.92, 1.09, 1.09, 1.09, 1.1, 1.11, 0.9, 1.12, 0.88, 1.12, 0.88, 1],
                } : {}}
                transition={phase === "anticipate" ? {
                    duration: 2.8, ease: "linear",
                    times: [0, 0.03, 0.06, 0.09, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.39, 0.42, 0.46, 0.5, 0.53, 0.56, 0.58, 0.6, 0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.9, 0.93, 0.97, 1.0],
                } : {}}
            />
            {/* Ambient shadow */}
            <div
                className="absolute pointer-events-none"
                style={{
                    bottom: -12, left: "15%", width: "70%", height: 18,
                    borderRadius: "50%",
                    background: `radial-gradient(ellipse, ${colors.glow}25 0%, transparent 70%)`,
                    filter: "blur(3px)",
                }}
            />

            {/* 3D Sphere container */}
            <div
                className="capsule-float"
                style={{
                    width: CAPSULE_SIZE, height: CAPSULE_SIZE,
                    transformStyle: "preserve-3d",
                    position: "relative",
                    filter: `drop-shadow(0 0 25px ${colors.glow}50) drop-shadow(0 0 8px ${colors.shellDeep}80)`,
                    willChange: "transform",
                }}
            >
                {/* Fake environment reflection — rotates independently to sell 3D */}
                <div
                    className="capsule-env-reflect absolute inset-0 rounded-full pointer-events-none overflow-hidden"
                    style={{ zIndex: 7, mixBlendMode: "screen" }}
                >
                    <div
                        style={{
                            position: "absolute", inset: 0,
                            background: `conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.06) 15%, transparent 30%, rgba(255,255,255,0.1) 45%, transparent 60%, rgba(255,255,255,0.04) 80%, transparent 100%)`,
                            animation: "envMapRotate 8s linear infinite",
                        }}
                    />
                </div>

                {/* Subsurface scattering at seam — light leaking through thin plastic */}
                <motion.div
                    className="absolute pointer-events-none"
                    style={{
                        top: CAPSULE_SIZE / 2 - 8, left: "5%", width: "90%", height: 16,
                        background: `radial-gradient(ellipse at center, ${colors.glow}40 0%, transparent 70%)`,
                        filter: "blur(4px)",
                        mixBlendMode: "screen",
                        zIndex: 4,
                    }}
                    animate={phase === "anticipate" ? { opacity: [0, 0, 0, 0.2, 0.4, 0.6, 0.8] } : { opacity: 0.08 }}
                    transition={phase === "anticipate" ? { duration: 2.8, ease: "easeIn" } : {}}
                />
                {/* ──── Top half ──── */}
                <motion.div
                    className={isCosmic ? "capsule-cosmic-top" : ""}
                    style={{
                        position: "absolute", top: 0, left: 0,
                        width: CAPSULE_SIZE, height: CAPSULE_SIZE / 2,
                        borderRadius: `${CAPSULE_SIZE / 2}px ${CAPSULE_SIZE / 2}px 0 0`,
                        background: topHalfBg,
                        overflow: "hidden",
                        transformOrigin: "center bottom",
                        backfaceVisibility: "hidden",
                        boxShadow: "inset 0 -4px 12px -2px rgba(0,0,0,0.3)",
                    }}
                    animate={isCracking ? {
                        y: -150 * intensity,
                        x: 30 * intensity,
                        z: [0, 80, 40],
                        rotateZ: 25 * intensity,
                        rotateX: -40 * intensity,
                        rotateY: [0, 15 * intensity, 35 * intensity],
                        scale: [1, 1.05, 0.6, 0.2],
                        opacity: [1, 1, 0.7, 0],
                    } : {}}
                    transition={isCracking ? {
                        duration: 0.7,
                        ease: [0.16, 1, 0.3, 1],
                        scale: { duration: 0.7, times: [0, 0.1, 0.5, 1] },
                        opacity: { duration: 0.7, times: [0, 0.2, 0.6, 1] },
                    } : {}}
                >
                    {/* Diffuse color wash — subtle on dark chrome */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: `radial-gradient(ellipse at 35% 15%, ${colors.accent}30 0%, transparent 55%)`,
                    }} />
                    {/* Environment reflection — stronger on dark surface */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: `linear-gradient(180deg, transparent 25%, ${colors.glow}12 45%, rgba(255,255,255,0.08) 50%, ${colors.shellDeep}30 55%, transparent 75%)`,
                    }} />
                    {/* Rim light (right edge) — bright fresnel on dark chrome */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: `radial-gradient(ellipse 25% 85% at 97% 50%, ${colors.rim}66 0%, ${colors.rim}30 40%, transparent 70%)`,
                    }} />
                    {/* Left rim fill light */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: `radial-gradient(ellipse 20% 70% at 3% 50%, ${colors.accent}22 0%, transparent 70%)`,
                    }} />
                    {/* Secondary diffuse highlight — more visible on dark */}
                    <div className="absolute pointer-events-none" style={{
                        top: 4, left: 10, width: 85, height: 52,
                        borderRadius: "50%",
                        background: "radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 40%, transparent 70%)",
                        mixBlendMode: "screen",
                    }} />
                    {/* Primary specular highlight — crisp on dark chrome */}
                    <div className="absolute pointer-events-none" style={{
                        top: 10, left: 26, width: 48, height: 30,
                        borderRadius: "50%",
                        background: `radial-gradient(ellipse at center, rgba(255,255,255,${Math.min(colors.specularIntensity + 0.08, 0.99)}) 0%, rgba(255,255,255,${colors.specularIntensity * 0.55}) 40%, transparent 70%)`,
                        transform: "rotate(-15deg)",
                        mixBlendMode: "screen",
                    }} />
                    {/* Pinpoint gloss — hard specular catch */}
                    <div className="absolute pointer-events-none" style={{
                        top: 16, left: 36, width: 14, height: 9,
                        borderRadius: "50%",
                        background: "radial-gradient(ellipse at center, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.75) 30%, transparent 70%)",
                        filter: "blur(0.5px)",
                        mixBlendMode: "screen",
                    }} />
                    {/* Secondary specular catch — smaller, offset */}
                    <div className="absolute pointer-events-none" style={{
                        top: 22, left: 50, width: 6, height: 4,
                        borderRadius: "50%",
                        background: "radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, transparent 70%)",
                        mixBlendMode: "screen",
                    }} />
                    {/* Bottom hemisphere ambient occlusion */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.12) 80%, rgba(0,0,0,0.2) 100%)",
                    }} />
                    {/* Light sweep animation overlay */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="capsule-light-sweep" style={{
                            position: "absolute", top: 0, left: 0,
                            width: "60px", height: "200%",
                            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05) 15%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.2) 60%, rgba(255,255,255,0.05) 85%, transparent)",
                            transform: "rotate(25deg)",
                        }} />
                    </div>
                </motion.div>

                {/* ──── Bottom half ──── */}
                <motion.div
                    className={isCosmic ? "capsule-cosmic-bottom" : ""}
                    style={{
                        position: "absolute", top: CAPSULE_SIZE / 2, left: 0,
                        width: CAPSULE_SIZE, height: CAPSULE_SIZE / 2,
                        borderRadius: `0 0 ${CAPSULE_SIZE / 2}px ${CAPSULE_SIZE / 2}px`,
                        background: bottomHalfBg,
                        overflow: "hidden",
                        transformOrigin: "center top",
                        backfaceVisibility: "hidden",
                        boxShadow: "inset 0 4px 10px -2px rgba(0,0,0,0.35), inset 0 -8px 20px -4px rgba(0,0,0,0.25)",
                    }}
                    animate={isCracking ? {
                        y: 120 * intensity,
                        x: -25 * intensity,
                        z: [0, -60, -120],
                        rotateZ: -20 * intensity,
                        rotateX: 30 * intensity,
                        rotateY: [0, -20 * intensity, -40 * intensity],
                        scale: [1, 1.05, 0.55, 0.15],
                        opacity: [1, 1, 0.7, 0],
                    } : {}}
                    transition={isCracking ? {
                        duration: 0.65,
                        ease: [0.55, 0, 1, 0.45],
                        scale: { duration: 0.65, times: [0, 0.1, 0.5, 1] },
                        opacity: { duration: 0.65, times: [0, 0.3, 0.7, 1] },
                    } : {}}
                >
                    {/* Rim light bottom — bright fresnel on dark chrome */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: `radial-gradient(ellipse 25% 85% at 97% 50%, ${colors.rim}55 0%, ${colors.rim}22 40%, transparent 70%)`,
                    }} />
                    {/* Left fill bottom */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: `radial-gradient(ellipse 20% 70% at 3% 50%, ${colors.accent}18 0%, transparent 70%)`,
                    }} />
                    {/* Bottom ambient occlusion */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: "linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.25) 100%)",
                    }} />
                    {/* Subtle reflected light from ground */}
                    <div className="absolute pointer-events-none" style={{
                        bottom: 8, left: "25%", width: "50%", height: 20,
                        borderRadius: "50%",
                        background: `radial-gradient(ellipse at center, ${colors.glow}12 0%, transparent 70%)`,
                        mixBlendMode: "screen",
                    }} />
                </motion.div>

                {/* ──── Equator seam — machined metal band ──── */}
                <motion.div
                    style={{
                        position: "absolute",
                        top: CAPSULE_SIZE / 2 - 4,
                        left: 0, width: CAPSULE_SIZE, height: 8,
                        background: isGold
                            ? `linear-gradient(180deg, rgba(0,0,0,0.5) 0%, ${colors.accent}88 15%, ${colors.accent}bb 30%, rgba(255,255,255,0.5) 50%, ${colors.accent}bb 70%, ${colors.accent}88 85%, rgba(0,0,0,0.5) 100%)`
                            : `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, ${seamColor}44 15%, ${seamColor}66 30%, rgba(255,255,255,0.25) 50%, ${seamColor}66 70%, ${seamColor}44 85%, rgba(0,0,0,0.4) 100%)`,
                        borderRadius: 3,
                        boxShadow: isGold
                            ? `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 10px ${colors.accent}50, 0 0 20px ${colors.accent}25`
                            : `inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 6px ${colors.glow}30`,
                        zIndex: 5,
                    }}
                    animate={isCracking ? {
                        opacity: [1, 1, 0],
                        scaleX: [1, 1.8, 3],
                        scaleY: [1, 0.3, 0],
                        filter: ["blur(0px)", "blur(1px)", "blur(4px)"],
                    } : {}}
                    transition={isCracking ? { duration: 0.2, ease: [0.22, 1, 0.36, 1], times: [0, 0.3, 1] } : {}}
                >
                    {/* Shimmer overlay on seam */}
                    <div className="absolute inset-0 rounded-sm overflow-hidden pointer-events-none">
                        <div style={{
                            position: "absolute", inset: 0,
                            background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.15) 70%, transparent 90%)",
                        }} />
                    </div>
                </motion.div>

                {/* ──── GVC Shaka badge logo overlay ──── */}
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: CAPSULE_SIZE * 0.55, height: CAPSULE_SIZE * 0.55,
                    zIndex: 4, pointerEvents: "none",
                    opacity: isCracking ? 0 : 0.85,
                    transition: "opacity 0.15s ease",
                }}>
                    <Image
                        src="/badges/any_gvc_1759173799963.webp"
                        alt="GVC Shaka"
                        width={Math.round(CAPSULE_SIZE * 0.55)}
                        height={Math.round(CAPSULE_SIZE * 0.55)}
                        className="w-full h-full object-contain"
                        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))", borderRadius: "50%" }}
                        priority
                    />
                </div>
            </div>

            {/* Inner energy glow during anticipation — light leaking through seams */}
            {phase === "anticipate" && (
                <motion.div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                        inset: "15%",
                        background: `radial-gradient(circle, ${colors.glow}00 30%, ${colors.glow}40 60%, ${colors.glow}00 80%)`,
                        mixBlendMode: "screen",
                    }}
                    animate={{
                        opacity: [0, 0.15, 0.25, 0.25, 0.4, 0.55, 0.65, 0.65, 0.8, 1],
                        scale: [0.8, 0.83, 0.86, 0.86, 0.9, 0.94, 0.97, 0.97, 1.02, 1.08],
                    }}
                    transition={{ duration: 2.8, ease: "easeIn" }}
                />
            )}

            {/* Tier-specific anticipation tells */}
            {/* Gold: seam glows bright gold during late anticipation */}
            {isGold && phase === "anticipate" && (
                <motion.div
                    className="absolute pointer-events-none"
                    style={{
                        top: CAPSULE_SIZE / 2 - 6,
                        left: -4, width: CAPSULE_SIZE + 8, height: 12,
                        borderRadius: 6,
                        background: `linear-gradient(90deg, transparent, ${colors.accent}88, ${colors.accent}CC, ${colors.accent}88, transparent)`,
                        filter: "blur(2px)",
                    }}
                    initial={{ opacity: 0, scaleX: 0.7 }}
                    animate={{ opacity: [0, 0, 0, 0.3, 0.6, 0.8, 1], scaleX: [0.7, 0.7, 0.7, 0.8, 0.9, 1, 1.05] }}
                    transition={{ duration: 2.8, ease: "easeIn" }}
                />
            )}

            {/* Cosmic: counter-rotating particle ring + purple aura */}
            {isCosmic && phase === "anticipate" && (
                <>
                    {/* Purple aura bloom */}
                    <motion.div
                        className="absolute pointer-events-none rounded-full"
                        style={{
                            inset: "-50%",
                            background: `radial-gradient(circle, ${colors.accent}00 30%, ${colors.accent}20 50%, #6B1FC020 70%, transparent 85%)`,
                        }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 0, 0.3, 0.5, 0.7, 1], scale: [0.5, 0.5, 0.7, 0.85, 1, 1.2] }}
                        transition={{ duration: 2.8, ease: "easeIn" }}
                    />
                    {/* Counter-rotating orbit ring */}
                    <motion.div
                        className="absolute pointer-events-none"
                        style={{
                            inset: "-20%",
                            borderRadius: "50%",
                            border: `1.5px solid ${colors.accent}40`,
                            boxShadow: `0 0 15px ${colors.accent}20`,
                        }}
                        initial={{ opacity: 0, rotate: 0 }}
                        animate={{ opacity: [0, 0, 0.4, 0.7, 1], rotate: -360 }}
                        transition={{ opacity: { duration: 2.8, ease: "easeIn" }, rotate: { duration: 2.8, ease: "linear" } }}
                    />
                    {/* Cosmic color flashes — "is this cosmic?" tell */}
                    {[0, 1, 2].map(i => (
                        <motion.div
                            key={`cosmic-flash-${i}`}
                            className="absolute pointer-events-none rounded-full"
                            style={{
                                inset: "5%",
                                background: ["#FF6B6B", "#4ECDC4", "#45B7D1"][i],
                                mixBlendMode: "overlay",
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0, 0, 0, 0, 0.15, 0, 0.2, 0, 0.25, 0] }}
                            transition={{ duration: 2.8, delay: i * 0.15, ease: "linear" }}
                        />
                    ))}
                </>
            )}

            {/* Silver: green flash hint at 70% mark */}
            {tier === "silver" && phase === "anticipate" && (
                <motion.div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                        inset: "10%",
                        background: `radial-gradient(circle, ${colors.glow}60 0%, transparent 60%)`,
                        mixBlendMode: "screen",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0, 0, 0, 0, 0, 0.4, 0, 0.5, 0] }}
                    transition={{ duration: 2.8, ease: "linear" }}
                />
            )}

            {/* Crack overlay */}
            <CrackLines active={phase === "crack"} color={colors.glow} />

            {/* Gold particle trail */}
            {isGold && (phase === "appear" || phase === "anticipate") && (
                <div className="absolute inset-0 pointer-events-none overflow-visible">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div
                            key={i}
                            className="capsule-gold-trail"
                            style={{
                                "--trail-delay": `${i * 0.2}s`,
                                "--trail-x": `${20 + Math.random() * 120}px`,
                                "--trail-start-y": `${20 + Math.random() * 120}px`,
                            } as React.CSSProperties}
                        />
                    ))}
                </div>
            )}

            {/* Cosmic shimmer overlay */}
            {isCosmic && (
                <div
                    className="absolute inset-0 rounded-full pointer-events-none mix-blend-overlay"
                    style={{
                        background: "linear-gradient(135deg, rgba(255,107,107,0.2), rgba(78,205,196,0.2), rgba(69,183,209,0.2), rgba(179,102,255,0.2))",
                        animation: "cosmicShimmer 1.5s ease-in-out infinite",
                    }}
                />
            )}
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VibeCapsule({
    isOpen,
    badge,
    tier,
    isDuplicate,
    duplicateCount,
    quickOpen,
    onComplete,
}: VibeCapsuleProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [showBurst, setShowBurst] = useState(false);
    const [showRevealParticles, setShowRevealParticles] = useState(false);
    const [showFlash, setShowFlash] = useState(false);
    const [showShockwave, setShowShockwave] = useState(false);
    const [showLightBeam, setShowLightBeam] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showBloom, setShowBloom] = useState(false);
    const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
    // Counter increments each time capsule opens — used as key to force fresh Three.js scene
    const openCountRef = useRef(0);
    useEffect(() => { if (isOpen) openCountRef.current++; }, [isOpen]);
    const isCosmic = tier === "cosmic";
    const isGold = tier === "gold";
    const colors = CAPSULE_COLORS[tier];
    const intensity = TIER_INTENSITY[tier];

    useEffect(() => {
        return () => { timeoutRefs.current.forEach(clearTimeout); };
    }, []);

    const addTimeout = useCallback((fn: () => void, ms: number) => {
        const id = setTimeout(fn, ms);
        timeoutRefs.current.push(id);
        return id;
    }, []);

    // Reset when closed
    useEffect(() => {
        if (!isOpen) {
            setPhase("idle");
            setShowBurst(false);
            setShowRevealParticles(false);
            setShowFlash(false);
            setShowShockwave(false);
            setShowLightBeam(false);
            setShowConfetti(false);
            setShowBloom(false);
            timeoutRefs.current.forEach(clearTimeout);
            timeoutRefs.current = [];
        }
    }, [isOpen]);

    // Start sequence
    useEffect(() => {
        if (!isOpen) return;

        if (quickOpen) {
            setPhase("crack");
            setShowBurst(true);
            setShowFlash(true);
            setShowShockwave(true);
            playCapsuleCrackSound(tier);
            triggerHaptic(50);
            addTimeout(() => { setShowFlash(false); }, 400);
            addTimeout(() => {
                setPhase("reveal");
                setShowBurst(false);
                setShowShockwave(false);
                setShowRevealParticles(true);
                if (isGold || isCosmic) setShowConfetti(true);
                playCapsuleRevealSound(tier);
                if (!isDuplicate) playNewPinSound();
            }, QUICK_DURATIONS.crack);
            addTimeout(() => { setShowRevealParticles(false); }, QUICK_DURATIONS.crack + QUICK_DURATIONS.reveal);
        } else {
            setPhase("appear");
            // Play thud + haptic when capsule lands (after spring animation)
            addTimeout(() => {
                playCapsuleAppearSound();
                triggerHaptic(30);
            }, 350);
            addTimeout(() => {
                setPhase("anticipate");
                playCapsuleAnticipateSound();
            }, PHASE_DURATION.appear);
        }
    }, [isOpen, quickOpen, addTimeout, isGold, isCosmic, isDuplicate]);

    // Handle tap to crack
    const handleCapsuleTap = useCallback(() => {
        if (phase !== "anticipate" && phase !== "appear") return;

        setPhase("crack");
        setShowBurst(true);
        setShowFlash(true);
        setShowShockwave(true);
        if (tier === "gold" || tier === "cosmic") setShowLightBeam(true);
        playCapsuleCrackSound(tier);
        // Heavy haptic impact on crack
        triggerHaptic(tier === "cosmic" ? [50, 30, 80] : tier === "gold" ? [40, 20, 60] : 50);

        addTimeout(() => { setShowFlash(false); }, 400);

        // Brief void — burst clears, creating a beat of "nothing" before reveal
        addTimeout(() => {
            setShowBurst(false);
            setShowShockwave(false);
            setShowLightBeam(false);
        }, PHASE_DURATION.crack * 0.4);

        // Center bloom fires just before reveal
        addTimeout(() => {
            setShowBloom(true);
        }, PHASE_DURATION.crack * 0.55);

        // Reveal — badge materializes from the bloom
        addTimeout(() => {
            setPhase("reveal");
            setShowRevealParticles(true);
            if (tier === "gold" || tier === "cosmic") setShowConfetti(true);
            playCapsuleRevealSound(tier);
            if (!isDuplicate) playNewPinSound();
            triggerHaptic(20);
        }, PHASE_DURATION.crack * 0.7);

        addTimeout(() => {
            setShowBloom(false);
            setShowRevealParticles(false);
        }, PHASE_DURATION.crack * 0.7 + PHASE_DURATION.reveal);
    }, [phase, addTimeout, tier, isDuplicate]);

    // Handle collect tap
    const handleCollect = useCallback(() => {
        if (phase !== "reveal") return;
        setPhase("collect");
        playCapsuleCollectSound();
        triggerHaptic(15);
        addTimeout(() => { onComplete(); }, 500);
    }, [phase, onComplete, addTimeout]);

    // Screen shake values
    const shakeAmount = tier === "cosmic" ? 8 : tier === "gold" ? 4 : tier === "silver" ? 2 : 0;

    return (
        <>
            <AnimatePresence>
                {isOpen && phase !== "idle" && (
                    <motion.div
                        className="fixed inset-0 z-[100] flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Background overlay */}
                        <motion.div
                            className="absolute inset-0"
                            style={{ background: "#0a0a1a" }}
                            initial={{ opacity: 0 }}
                            animate={{
                                opacity: phase === "anticipate" ? 0.95
                                    : phase === "crack" || phase === "reveal" ? 0.97
                                    : 0.9,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        />

                        {/* Vignette that tightens during anticipation — spotlight effect */}
                        {phase === "anticipate" && (
                            <motion.div
                                className="absolute inset-0 pointer-events-none"
                                style={{ zIndex: 1 }}
                                initial={{
                                    background: "radial-gradient(circle, transparent 60%, rgba(0,0,0,0.3) 100%)",
                                }}
                                animate={{
                                    background: [
                                        "radial-gradient(circle, transparent 60%, rgba(0,0,0,0.3) 100%)",
                                        "radial-gradient(circle, transparent 50%, rgba(0,0,0,0.45) 100%)",
                                        "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.55) 100%)",
                                        "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.65) 100%)",
                                    ],
                                }}
                                transition={{ duration: 2.8, ease: "easeIn" }}
                            />
                        )}

                        {/* Cosmic: purple background tint during anticipation */}
                        {isCosmic && phase === "anticipate" && (
                            <motion.div
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: "linear-gradient(180deg, #2D1B69 0%, #1a0a2e 50%, #0a0a1a 100%)" }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0, 0, 0.15, 0.3, 0.5] }}
                                transition={{ duration: 2.8, ease: "easeIn" }}
                            />
                        )}

                        {/* Screen flash overlay */}
                        <CrackFlash active={showFlash} tier={tier} />

                        {/* Screen shake + zoom wrapper */}
                        <motion.div
                            className="relative flex flex-col items-center justify-center w-full h-full"
                            animate={
                                phase === "crack" && shakeAmount > 0
                                    ? {
                                        x: [0, -shakeAmount, shakeAmount, -shakeAmount * 0.7, shakeAmount * 0.7, -shakeAmount * 0.4, shakeAmount * 0.4, 0],
                                        y: [0, shakeAmount * 0.5, -shakeAmount * 0.5, shakeAmount * 0.3, -shakeAmount * 0.3, shakeAmount * 0.15, 0, 0],
                                    }
                                    : phase === "anticipate"
                                    ? { scale: [1, 1.02, 1.06] }
                                    : {}
                            }
                            transition={
                                phase === "crack" && shakeAmount > 0
                                    ? { duration: 0.5, ease: "linear", times: [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1] }
                                    : phase === "anticipate"
                                    ? { duration: 2.8, ease: "easeIn" }
                                    : {}
                            }
                        >
                            {/* ======================== */}
                            {/* CAPSULE (appear + anticipate + crack) */}
                            {/* ======================== */}
                            <AnimatePresence>
                                {(phase === "appear" || phase === "anticipate" || phase === "crack") && (
                                    <motion.div
                                        className="relative"
                                        initial={quickOpen
                                            ? { y: 0, scale: 1, opacity: 1 }
                                            : { y: -500, scale: 0.3, opacity: 0, rotateZ: -8, filter: "blur(8px)" }
                                        }
                                        animate={
                                            phase === "crack"
                                                ? {
                                                    scale: [1, 1.12, 1.12],
                                                    opacity: [1, 1, 1],
                                                    transition: { duration: quickOpen ? 0.15 : 0.2, ease: "easeOut" },
                                                }
                                                : {
                                                    y: 0,
                                                    scale: 1,
                                                    opacity: 1,
                                                    rotateZ: 0,
                                                    filter: "blur(0px)",
                                                    transition: {
                                                        y: { type: "spring", stiffness: 300, damping: 20, mass: 2.5 },
                                                        scale: { type: "spring", stiffness: 300, damping: 18, mass: 1.5, delay: 0.05 },
                                                        opacity: { duration: 0.12, ease: "easeOut" },
                                                        rotateZ: { type: "spring", stiffness: 200, damping: 15, delay: 0.1 },
                                                        filter: { duration: 0.25, ease: "easeOut" },
                                                    },
                                                }
                                        }
                                        exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
                                    >
                                        {/* Landing squash-stretch */}
                                        <motion.div
                                            animate={phase === "appear" ? {
                                                scaleX: [1, 1.12, 0.95, 1.03, 1],
                                                scaleY: [1, 0.88, 1.06, 0.98, 1],
                                            } : { scaleX: 1, scaleY: 1 }}
                                            transition={phase === "appear"
                                                ? { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.38 }
                                                : { duration: 0.15, ease: "easeOut" }
                                            }
                                        >
                                            <Suspense fallback={<div style={{ width: 700, height: 700 }} />}>
                                                <CapsuleSphere3D key={openCountRef.current} tier={tier} phase={phase} onTap={handleCapsuleTap} />
                                            </Suspense>
                                        </motion.div>

                                        <OrbitParticles tier={tier} active={phase === "anticipate"} />
                                        <BurstParticles tier={tier} active={showBurst} />
                                        <ShockwaveRings active={showShockwave} color={colors.glow} />
                                        <LightBeam active={showLightBeam} tier={tier} />
                                        <CenterBloom active={showBloom} color={colors.glow} />

                                        {/* Tap hint */}
                                        {(phase === "appear" || phase === "anticipate") && (
                                            <motion.div
                                                className="absolute -bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-white/40 text-xs font-mundial tracking-widest uppercase"
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: [0, 0.6, 0.3, 0.6], y: [5, 0, 2, 0] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            >
                                                TAP TO OPEN
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ======================== */}
                            {/* REVEAL (badge image + info) */}
                            {/* ======================== */}
                            <AnimatePresence>
                                {(phase === "reveal" || phase === "collect") && badge && (
                                    <motion.div
                                        className="relative flex flex-col items-center cursor-pointer"
                                        onClick={handleCollect}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Collect ${badge.name}`}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCollect(); }}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={
                                            phase === "collect"
                                                ? {
                                                    scale: [1, 1.1, 0.15],
                                                    y: [0, -15, 400],
                                                    opacity: [1, 1, 0],
                                                    transition: { duration: 0.5, ease: [0.55, 0, 1, 0.45], times: [0, 0.2, 1] },
                                                }
                                                : {
                                                    scale: [0, 0.1, 0.1, 1.2 * (intensity * 0.6), 0.92, 1.04, 1],
                                                    opacity: [0, 0, 1, 1, 1, 1, 1],
                                                    filter: [
                                                        "brightness(5) blur(20px)",
                                                        "brightness(4) blur(15px)",
                                                        "brightness(3) blur(8px)",
                                                        "brightness(1.3) blur(0px)",
                                                        "brightness(1.1) blur(0px)",
                                                        "brightness(1) blur(0px)",
                                                        "brightness(1) blur(0px)",
                                                    ],
                                                    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1], times: [0, 0.1, 0.2, 0.5, 0.65, 0.8, 1] },
                                                }
                                        }
                                        exit={{ scale: 0, y: 400, opacity: 0, transition: { duration: 0.3, ease: "easeIn" } }}
                                    >
                                        {/* Pulsing glow rings */}
                                        {[0, 1, 2].map((ringIdx) => (
                                            <motion.div
                                                key={ringIdx}
                                                className="absolute rounded-full pointer-events-none"
                                                style={{
                                                    width: 120 + ringIdx * 50,
                                                    height: 120 + ringIdx * 50,
                                                    top: "50%", left: "50%",
                                                    marginTop: -(120 + ringIdx * 50) / 2,
                                                    marginLeft: -(120 + ringIdx * 50) / 2,
                                                    border: `2px solid ${colors.glow}`,
                                                    boxShadow: `0 0 20px 5px ${colors.glow}44`,
                                                }}
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{
                                                    scale: [0.5, 1 + ringIdx * 0.3, 0.9 + ringIdx * 0.25],
                                                    opacity: [0, 0.5 - ringIdx * 0.1, 0.3 - ringIdx * 0.08],
                                                }}
                                                transition={{
                                                    duration: 1.5, ease: "easeOut",
                                                    delay: 0.1 + ringIdx * 0.08,
                                                    repeat: Infinity, repeatType: "reverse", repeatDelay: 0.2,
                                                }}
                                            />
                                        ))}

                                        {/* Cosmic rotating halo */}
                                        {isCosmic && (
                                            <motion.div
                                                className="absolute rounded-full pointer-events-none"
                                                style={{
                                                    width: 240, height: 240,
                                                    top: "50%", left: "50%",
                                                    marginTop: -120, marginLeft: -120,
                                                    background: "conic-gradient(from 0deg, #FF6B6B20, #4ECDC420, #45B7D120, #B366FF20, #FF6B6B20)",
                                                    filter: "blur(10px)",
                                                }}
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                            />
                                        )}

                                        {/* Badge image */}
                                        <div
                                            className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden z-10"
                                            style={{
                                                boxShadow: `0 0 0 3px ${TIER_COLORS[tier]}, 0 0 30px ${colors.glow}50, 0 0 60px ${colors.glow}20`,
                                            }}
                                        >
                                            <Image
                                                src={badge.image}
                                                alt={badge.name}
                                                width={144}
                                                height={144}
                                                className="w-full h-full object-cover"
                                                priority
                                            />
                                            {/* Gold shimmer sweep */}
                                            {isGold && (
                                                <motion.div
                                                    className="absolute inset-0 pointer-events-none"
                                                    initial={{ x: "-100%" }}
                                                    animate={{ x: "200%" }}
                                                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.5, repeat: 1, repeatDelay: 1.5 }}
                                                    style={{
                                                        width: "50%", height: "100%",
                                                        background: "linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.3), transparent)",
                                                        transform: "skewX(-20deg)",
                                                    }}
                                                />
                                            )}
                                        </div>

                                        {/* Badge name */}
                                        <motion.h2
                                            className="mt-5 text-xl sm:text-2xl font-display font-black text-white text-center z-10"
                                            style={{ textShadow: `0 0 20px ${colors.glow}60` }}
                                            initial={{ y: 15, opacity: 0, scale: 0.9 }}
                                            animate={{ y: 0, opacity: 1, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 25, mass: 0.8, delay: 0.25 }}
                                        >
                                            {badge.name}
                                        </motion.h2>

                                        {/* Tier label */}
                                        <motion.div
                                            className="mt-2 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-mundial font-bold uppercase tracking-[0.2em] z-10"
                                            style={{
                                                background: `${TIER_COLORS[tier]}20`,
                                                color: TIER_COLORS[tier],
                                                border: `1px solid ${TIER_COLORS[tier]}30`,
                                                boxShadow: `0 0 12px ${TIER_COLORS[tier]}15`,
                                            }}
                                            initial={{ y: 20, opacity: 0, scale: 0.8 }}
                                            animate={{ y: 0, opacity: 1, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 25, mass: 0.8, delay: 0.35 }}
                                        >
                                            {TIER_DISPLAY_NAMES[tier]}
                                        </motion.div>

                                        {/* New pin / duplicate label */}
                                        {isDuplicate ? (
                                            <motion.div
                                                className="mt-2 text-[11px] sm:text-xs font-mundial text-white/40 tracking-wider z-10"
                                                initial={{ y: 8, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                transition={{ delay: 0.4, duration: 0.3 }}
                                            >
                                                Already Owned
                                                <span className="ml-1.5 text-white/25">x{duplicateCount}</span>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                className="mt-3 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-display font-black uppercase tracking-[0.15em] z-10"
                                                style={{
                                                    background: "linear-gradient(135deg, rgba(46,255,46,0.15), rgba(46,255,46,0.05))",
                                                    color: "#2EFF2E",
                                                    border: "1px solid rgba(46,255,46,0.25)",
                                                    boxShadow: "0 0 16px rgba(46,255,46,0.15)",
                                                }}
                                                initial={{ y: 15, opacity: 0, scale: 0.7 }}
                                                animate={{ y: 0, opacity: 1, scale: [0.7, 1.1, 1] }}
                                                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.4 }}
                                            >
                                                New Pin Collected!
                                            </motion.div>
                                        )}

                                        {/* Tap to collect hint */}
                                        {phase === "reveal" && (
                                            <motion.div
                                                className="mt-6 text-white/30 text-xs font-mundial tracking-widest uppercase z-10"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: [0, 0.5, 0.25, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                                            >
                                                TAP TO COLLECT
                                            </motion.div>
                                        )}

                                        <RevealParticles tier={tier} active={showRevealParticles} />
                                        <ConfettiShower active={showConfetti} tier={tier} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ======================== */}
            {/* KEYFRAME ANIMATIONS */}
            {/* ======================== */}
            <style jsx global>{`
                /* Multi-axis idle float — sells 3D via perspective foreshortening */
                .capsule-float {
                    animation: capsuleFloat 3.4s ease-in-out infinite;
                }

                @keyframes capsuleFloat {
                    0% { transform: translateY(0) rotateX(0deg) rotateY(0deg) scale(1); }
                    25% { transform: translateY(-3px) rotateX(1.8deg) rotateY(-1.2deg) scale(1.003); }
                    50% { transform: translateY(-5px) rotateX(0deg) rotateY(0.6deg) scale(1.005); }
                    75% { transform: translateY(-2px) rotateX(-1.2deg) rotateY(-0.4deg) scale(1.002); }
                    100% { transform: translateY(0) rotateX(0deg) rotateY(0deg) scale(1); }
                }

                /* Light sweep — faster, accelerates across curved surface */
                .capsule-light-sweep {
                    animation: capsuleLightSweep 2.5s cubic-bezier(0.7, 0, 0.3, 1) 0.3s infinite;
                }

                @keyframes capsuleLightSweep {
                    0% { transform: translateX(-120%) rotate(25deg); }
                    100% { transform: translateX(500%) rotate(25deg); }
                }

                /* Slow-rotating environment reflection — sells "reflective 3D surface" */
                @keyframes envMapRotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Orbiting particles */
                .capsule-orbit-particle {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    width: var(--orbit-size);
                    height: var(--orbit-size);
                    margin-left: calc(var(--orbit-size) / -2);
                    margin-top: calc(var(--orbit-size) / -2);
                    border-radius: 50%;
                    background: var(--orbit-color);
                    box-shadow: 0 0 8px var(--orbit-color);
                    animation: capsuleOrbit var(--orbit-duration) linear var(--orbit-delay) infinite;
                    pointer-events: none;
                }

                @keyframes capsuleOrbit {
                    0% {
                        transform: rotate(var(--orbit-angle))
                            translateX(var(--orbit-distance)) rotate(calc(-1 * var(--orbit-angle))) scale(0.6);
                        opacity: 0.25;
                        filter: blur(1.5px);
                    }
                    25% {
                        opacity: 0.5;
                        filter: blur(0.8px);
                        transform: rotate(calc(var(--orbit-angle) + 90deg))
                            translateX(var(--orbit-distance)) rotate(calc(-1 * (var(--orbit-angle) + 90deg))) scale(0.8);
                    }
                    50% {
                        opacity: 1;
                        filter: blur(0px);
                        transform: rotate(calc(var(--orbit-angle) + 180deg))
                            translateX(var(--orbit-distance)) rotate(calc(-1 * (var(--orbit-angle) + 180deg))) scale(1.15);
                    }
                    75% {
                        opacity: 0.5;
                        filter: blur(0.8px);
                        transform: rotate(calc(var(--orbit-angle) + 270deg))
                            translateX(var(--orbit-distance)) rotate(calc(-1 * (var(--orbit-angle) + 270deg))) scale(0.8);
                    }
                    100% {
                        transform: rotate(calc(var(--orbit-angle) + 360deg))
                            translateX(var(--orbit-distance))
                            rotate(calc(-1 * (var(--orbit-angle) + 360deg))) scale(0.6);
                        opacity: 0.25;
                        filter: blur(1.5px);
                    }
                }

                /* Gold tier particle trail */
                .capsule-gold-trail {
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: #ffe048;
                    box-shadow: 0 0 8px #ffe048, 0 0 16px #ffe04880;
                    left: var(--trail-x);
                    top: var(--trail-start-y);
                    animation: goldTrail 1.5s ease-in-out var(--trail-delay) infinite;
                    pointer-events: none;
                }

                @keyframes goldTrail {
                    0% { opacity: 0; transform: translateY(0) scale(0); }
                    20% { opacity: 1; transform: translateY(-10px) scale(1); }
                    100% { opacity: 0; transform: translateY(-60px) scale(0); }
                }

                /* Cosmic shimmer overlay */
                @keyframes cosmicShimmer {
                    0% { opacity: 0.3; filter: hue-rotate(0deg); }
                    50% { opacity: 0.6; filter: hue-rotate(90deg); }
                    100% { opacity: 0.3; filter: hue-rotate(0deg); }
                }

                /* Cosmic holographic sphere halves */
                .capsule-cosmic-top {
                    background: linear-gradient(
                        180deg,
                        #FF6B6B 0%,
                        #4ECDC4 40%,
                        #45B7D1 70%,
                        #B366FF 100%
                    ) !important;
                    background-size: 200% 200% !important;
                    animation: cosmicHoloShift 6s linear infinite !important;
                }

                .capsule-cosmic-bottom {
                    background: linear-gradient(
                        180deg,
                        #B366FF 0%,
                        #45B7D1 30%,
                        #4ECDC4 60%,
                        #FF66B2 100%
                    ) !important;
                    background-size: 200% 200% !important;
                    animation: cosmicHoloShift 6s linear infinite reverse !important;
                }

                @keyframes cosmicHoloShift {
                    0% { background-position: 0% 0%; filter: brightness(1) hue-rotate(0deg); }
                    25% { filter: brightness(1.15) hue-rotate(90deg); }
                    50% { background-position: 100% 100%; filter: brightness(1) hue-rotate(180deg); }
                    75% { filter: brightness(1.1) hue-rotate(270deg); }
                    100% { background-position: 0% 0%; filter: brightness(1) hue-rotate(360deg); }
                }
            `}</style>
        </>
    );
}
