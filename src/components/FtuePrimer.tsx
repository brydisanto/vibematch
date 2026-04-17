"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
    playMatchSound,
    playBombSound,
    playCapsuleCrackSound,
    playCapsuleRevealSound,
    playNewPinSound,
    playUIClick,
} from "@/lib/sounds";

interface FtuePrimerProps {
    onContinue: () => void;
}

// Badges used by the demo panels.
const CITIZEN = { id: "citizen", src: "/badges/any_gvc_1759173799963.webp" };
const DOGE = { id: "doge", src: "/badges/doge_1759173842640.webp" };
const ASTRO = { id: "astro", src: "/badges/astro_balls_1759173838889.webp" };
const CAPTAIN = { id: "captain", src: "/badges/captain_1759173895611.webp" };
const COSMIC = { id: "cosmic", src: "/badges/cosmic_guardian1759173818340.webp" };

const TILE_SIZE = 64;
const GAP = 6;

type PanelIndex = 0 | 1 | 2;

const PANEL_COPY: Record<PanelIndex, { title: string; body: string }> = {
    0: {
        title: "Match to Score",
        body: "Line up 3 of the same badge — horizontal or vertical — to score points.",
    },
    1: {
        title: "Create Power-Ups",
        body: "Match 4+ in a row to unlock special tiles. Double-tap to unleash massive score.",
    },
    2: {
        title: "Collect Pins",
        body: "Score 15K+ to win Pin Capsules. Rip them open to build your collection.",
    },
};

export default function FtuePrimer({ onContinue }: FtuePrimerProps) {
    const [panelIndex, setPanelIndex] = useState<PanelIndex>(0);

    const goTo = (i: PanelIndex) => {
        if (i === panelIndex) return;
        playUIClick();
        setPanelIndex(i);
    };

    const copy = PANEL_COPY[panelIndex];

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            <motion.div
                className="absolute inset-0 bg-black/85"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />
            <motion.div
                className="relative w-full max-w-md rounded-2xl border border-[#B366FF]/30 px-3 pt-8 pb-5 text-center"
                style={{
                    background: "linear-gradient(180deg, #1a0428 0%, #0a0114 100%)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
                <div
                    className="absolute top-[-12px] left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-mundial font-black tracking-[0.2em] uppercase text-white whitespace-nowrap"
                    style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
                >
                    Welcome to VibeMatch!
                </div>

                <h2
                    className="font-display text-xl sm:text-2xl font-black text-[#FFE048] uppercase leading-tight mt-2 mb-4"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                >
                    Here&apos;s the Loop
                </h2>

                {/* Carousel frame */}
                <div className="relative mb-3">
                    {/* Prev arrow */}
                    <button
                        onClick={() => panelIndex > 0 && goTo((panelIndex - 1) as PanelIndex)}
                        disabled={panelIndex === 0}
                        className="absolute left-[-4px] top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-15 disabled:cursor-not-allowed transition-all active:scale-90"
                        aria-label="Previous"
                    >
                        <ChevronLeft size={24} strokeWidth={2.5} />
                    </button>
                    {/* Next arrow */}
                    <button
                        onClick={() => panelIndex < 2 && goTo((panelIndex + 1) as PanelIndex)}
                        disabled={panelIndex === 2}
                        className="absolute right-[-4px] top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-15 disabled:cursor-not-allowed transition-all active:scale-90"
                        aria-label="Next"
                    >
                        <ChevronRight size={24} strokeWidth={2.5} />
                    </button>

                    <div
                        className="relative mx-auto rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
                        style={{
                            width: TILE_SIZE * 3 + GAP * 2 + 32,
                            minHeight: 296,
                            padding: "14px 16px 16px",
                        }}
                    >
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background:
                                    "radial-gradient(circle at 50% 45%, rgba(255,224,72,0.1), transparent 65%)",
                            }}
                        />
                        <AnimatePresence mode="wait">
                            {panelIndex === 0 && <MatchPanel key="match" />}
                            {panelIndex === 1 && <BombPanel key="bomb" />}
                            {panelIndex === 2 && <CapsulePanel key="capsule" />}
                        </AnimatePresence>
                    </div>

                    {/* Dots */}
                    <div className="flex justify-center gap-2 mt-3">
                        {[0, 1, 2].map((i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i as PanelIndex)}
                                className="transition-all active:scale-90"
                                aria-label={`Go to panel ${i + 1}`}
                            >
                                <div
                                    className="rounded-full transition-all"
                                    style={{
                                        width: i === panelIndex ? 20 : 6,
                                        height: 6,
                                        background:
                                            i === panelIndex
                                                ? "linear-gradient(135deg, #FFE048, #FFA500)"
                                                : "rgba(255,255,255,0.25)",
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Panel-specific copy (switches with carousel) */}
                <div className="min-h-[78px] mb-4 px-2">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={panelIndex}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div
                                className="font-display text-[20px] font-black text-[#FFE048] uppercase leading-tight tracking-wide mb-1.5"
                                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                            >
                                {copy.title}
                            </div>
                            <div className="text-[13px] font-mundial text-white/70 leading-relaxed">
                                {copy.body}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <button
                    onClick={onContinue}
                    className="w-full py-3 rounded-lg font-black font-mundial uppercase tracking-wider transition-all bg-[#FFE048] text-black hover:bg-[#FFE858] active:scale-95"
                >
                    Let&apos;s Freaking Go!
                </button>
            </motion.div>
        </motion.div>
    );
}

/* =====================================================================
   PANEL 1 — Match-3 demo
   ===================================================================== */

type MatchTile = { id: number; badge: { id: string; src: string } };
type MatchPhase = "idle" | "swapping" | "matched";

const MATCH_INITIAL: MatchTile[][] = [
    [
        { id: 1, badge: CITIZEN },
        { id: 2, badge: CITIZEN },
        { id: 3, badge: DOGE },
    ],
    [
        { id: 4, badge: ASTRO },
        { id: 5, badge: CAPTAIN },
        { id: 6, badge: CITIZEN },
    ],
    [
        { id: 7, badge: DOGE },
        { id: 8, badge: ASTRO },
        { id: 9, badge: CAPTAIN },
    ],
];

const SWAP_A = { row: 0, col: 2 };
const SWAP_B = { row: 1, col: 2 };

function MatchPanel() {
    const [grid, setGrid] = useState<MatchTile[][]>(MATCH_INITIAL);
    const [phase, setPhase] = useState<MatchPhase>("idle");
    const [score, setScore] = useState(0);
    const [scorePop, setScorePop] = useState<number | null>(null);
    const [cycleKey, setCycleKey] = useState(0);

    const matchedSet = new Set(phase === "matched" ? ["0,0", "0,1", "0,2"] : []);
    const isHint = (r: number, c: number) =>
        phase === "idle" && ((r === SWAP_A.row && c === SWAP_A.col) || (r === SWAP_B.row && c === SWAP_B.col));

    const handleTap = (r: number, c: number) => {
        if (phase !== "idle") return;
        const isSwappable = (r === SWAP_A.row && c === SWAP_A.col) || (r === SWAP_B.row && c === SWAP_B.col);
        if (!isSwappable) return;

        setPhase("swapping");
        const next = grid.map((row) => [...row]);
        const a = next[SWAP_A.row][SWAP_A.col];
        const b = next[SWAP_B.row][SWAP_B.col];
        next[SWAP_A.row][SWAP_A.col] = b;
        next[SWAP_B.row][SWAP_B.col] = a;
        setGrid(next);

        setTimeout(() => {
            setPhase("matched");
            setScore(300);
            setScorePop(300);
            playMatchSound(300, 1, 3);
            setTimeout(() => setScorePop(null), 1400);
        }, 320);
    };

    useEffect(() => {
        if (phase !== "matched") return;
        const t = setTimeout(() => {
            setGrid(MATCH_INITIAL);
            setScore(0);
            setPhase("idle");
            setCycleKey((k) => k + 1);
        }, 1500);
        return () => clearTimeout(t);
    }, [phase]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
        >
            <PanelHeader label="Score" value={score.toLocaleString()} />

            <div
                className="relative grid mx-auto"
                style={{
                    gridTemplateColumns: `repeat(3, ${TILE_SIZE}px)`,
                    gap: `${GAP}px`,
                    width: TILE_SIZE * 3 + GAP * 2,
                }}
            >
                {grid.map((row, r) =>
                    row.map((tile, c) => {
                        const hinted = isHint(r, c);
                        const matched = matchedSet.has(`${r},${c}`);
                        return (
                            <motion.button
                                key={`${cycleKey}-${tile.id}`}
                                onClick={() => handleTap(r, c)}
                                layout
                                layoutId={`match-${cycleKey}-${tile.id}`}
                                className="relative rounded-[12px] overflow-hidden"
                                style={{
                                    width: TILE_SIZE,
                                    height: TILE_SIZE,
                                    background: "rgba(255,255,255,0.04)",
                                    border: hinted || matched ? "2px solid #FFE048" : "1.5px solid rgba(255,255,255,0.08)",
                                    boxShadow: hinted
                                        ? "0 0 18px rgba(255,224,72,0.55)"
                                        : matched
                                            ? "0 0 24px rgba(255,224,72,0.8)"
                                            : "none",
                                    cursor: hinted ? "pointer" : "default",
                                }}
                                initial={{ scale: 1, opacity: 1 }}
                                animate={
                                    matched
                                        ? { scale: [1, 1.15, 0], opacity: [1, 1, 0] }
                                        : hinted
                                            ? { scale: [1, 1.06, 1], opacity: 1 }
                                            : { scale: 1, opacity: 1 }
                                }
                                transition={
                                    matched
                                        ? { duration: 0.7, times: [0, 0.35, 1] }
                                        : hinted
                                            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                                            : { type: "spring", stiffness: 400, damping: 28 }
                                }
                                whileTap={hinted ? { scale: 0.94 } : undefined}
                            >
                                <Image
                                    src={tile.badge.src}
                                    alt=""
                                    fill
                                    sizes={`${TILE_SIZE}px`}
                                    className="object-cover pointer-events-none"
                                />
                            </motion.button>
                        );
                    })
                )}
            </div>

            <ScorePopup value={scorePop} label={`+${scorePop}`} />

            <PanelCaption
                idle={phase === "idle" ? "Tap a glowing tile to swap" : null}
                active={phase === "matched" ? "Match!" : null}
            />
        </motion.div>
    );
}

/* =====================================================================
   PANEL 2 — Bomb demo (matches the in-game BombOverlay look)
   ===================================================================== */

type BombPhase = "idle" | "selected" | "detonated";

// Layout: bomb at center, 8 surrounding badges.
const BOMB_SURROUND = [
    [DOGE, CAPTAIN, ASTRO],
    [ASTRO, null, DOGE],
    [CAPTAIN, ASTRO, DOGE],
];

function BombPanel() {
    const [phase, setPhase] = useState<BombPhase>("idle");
    const [score, setScore] = useState(0);
    const [scorePop, setScorePop] = useState<number | null>(null);
    const [cycleKey, setCycleKey] = useState(0);

    const handleBombTap = () => {
        if (phase === "idle") {
            setPhase("selected");
            playUIClick();
            return;
        }
        if (phase === "selected") {
            setPhase("detonated");
            playBombSound();
            setScore(1200);
            setScorePop(1200);
            setTimeout(() => setScorePop(null), 1400);
        }
    };

    useEffect(() => {
        if (phase !== "detonated") return;
        const t = setTimeout(() => {
            setScore(0);
            setPhase("idle");
            setCycleKey((k) => k + 1);
        }, 1800);
        return () => clearTimeout(t);
    }, [phase]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
        >
            <PanelHeader label="Score" value={score.toLocaleString()} />

            <div
                className="relative grid mx-auto"
                style={{
                    gridTemplateColumns: `repeat(3, ${TILE_SIZE}px)`,
                    gap: `${GAP}px`,
                    width: TILE_SIZE * 3 + GAP * 2,
                }}
            >
                {BOMB_SURROUND.map((row, r) =>
                    row.map((badge, c) => {
                        const isBomb = badge === null;
                        return (
                            <motion.button
                                key={`${cycleKey}-${r}-${c}`}
                                onClick={isBomb ? handleBombTap : undefined}
                                className="relative rounded-[12px] overflow-hidden flex items-center justify-center"
                                style={{
                                    width: TILE_SIZE,
                                    height: TILE_SIZE,
                                    background: "rgba(255,255,255,0.04)",
                                    border: isBomb ? "none" : "1.5px solid rgba(255,255,255,0.08)",
                                    cursor: isBomb ? "pointer" : "default",
                                }}
                                initial={{ scale: 1, opacity: 1 }}
                                animate={
                                    phase === "detonated"
                                        ? { scale: [1, 1.2, 0], opacity: [1, 1, 0] }
                                        : isBomb && phase === "selected"
                                            ? { scale: [1, 1.04, 1], opacity: 1 }
                                            : { scale: 1, opacity: 1 }
                                }
                                transition={
                                    phase === "detonated"
                                        ? { duration: 0.6, times: [0, 0.3, 1] }
                                        : isBomb && phase === "selected"
                                            ? { duration: 0.35, repeat: Infinity, ease: "easeInOut" }
                                            : { type: "spring", stiffness: 400, damping: 28 }
                                }
                                whileTap={isBomb ? { scale: 0.94 } : undefined}
                            >
                                {isBomb ? (
                                    <BombTile pulsing={phase === "idle"} selected={phase === "selected"} />
                                ) : badge ? (
                                    <Image
                                        src={badge.src}
                                        alt=""
                                        fill
                                        sizes={`${TILE_SIZE}px`}
                                        className="object-cover pointer-events-none"
                                    />
                                ) : null}
                            </motion.button>
                        );
                    })
                )}
            </div>

            {/* Explosion burst */}
            {phase === "detonated" && (
                <motion.div
                    className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    initial={{ opacity: 0.95, scale: 0 }}
                    animate={{ opacity: 0, scale: 3.2 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    <div
                        className="w-32 h-32 rounded-full"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(255,224,72,0.95) 0%, rgba(255,51,51,0.7) 40%, transparent 75%)",
                        }}
                    />
                </motion.div>
            )}

            <ScorePopup value={scorePop} label={`+${scorePop}`} />

            <PanelCaption
                idle={phase === "idle" ? "Tap the bomb" : null}
                active={phase === "selected" ? "Tap again to detonate" : phase === "detonated" ? "Boom!" : null}
            />
        </motion.div>
    );
}

/**
 * BombTile — visually mirrors the in-game BombOverlay:
 * red border + inset red shadow + yellow crosshairs + red center core.
 */
function BombTile({ pulsing, selected }: { pulsing: boolean; selected: boolean }) {
    return (
        <div
            className="absolute inset-0 rounded-[10px] overflow-hidden"
            style={{
                background: "radial-gradient(circle at 50% 50%, #3A0A0A, #1A0404)",
                border: "3px solid #FF3333",
                boxShadow: "inset 0 0 16px rgba(255,51,51,0.85), 0 0 20px rgba(255,51,51,0.5)",
            }}
        >
            {/* Crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center opacity-90">
                <div
                    className="absolute"
                    style={{
                        width: "78%",
                        height: 2,
                        background: "#FFE048",
                        boxShadow: "0 0 8px #FFE048",
                    }}
                />
                <div
                    className="absolute"
                    style={{
                        height: "78%",
                        width: 2,
                        background: "#FFE048",
                        boxShadow: "0 0 8px #FFE048",
                    }}
                />
            </div>
            {/* Core dot */}
            <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    width: 12,
                    height: 12,
                    background: "#FF3333",
                    boxShadow: "0 0 14px #FF3333",
                }}
                animate={
                    selected
                        ? { scale: [1, 1.35, 1], opacity: [1, 0.7, 1] }
                        : pulsing
                            ? { scale: [1, 1.15, 1], opacity: [1, 0.9, 1] }
                            : { scale: 1, opacity: 1 }
                }
                transition={
                    selected
                        ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" }
                        : pulsing
                            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.2 }
                }
            />
        </div>
    );
}

/* =====================================================================
   PANEL 3 — Capsule opens to reveal a pin (mirrors real capsule shape)
   ===================================================================== */

type CapsulePhase = "idle" | "cracking" | "revealed";

function CapsulePanel() {
    const [phase, setPhase] = useState<CapsulePhase>("idle");
    const [cycleKey, setCycleKey] = useState(0);

    const handleTap = () => {
        if (phase !== "idle") return;
        setPhase("cracking");
        playCapsuleCrackSound("gold");
        setTimeout(() => {
            setPhase("revealed");
            playCapsuleRevealSound("gold");
            playNewPinSound();
        }, 600);
    };

    useEffect(() => {
        if (phase !== "revealed") return;
        const t = setTimeout(() => {
            setPhase("idle");
            setCycleKey((k) => k + 1);
        }, 2400);
        return () => clearTimeout(t);
    }, [phase]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
        >
            <PanelHeader label="Pins Collected" value={phase === "revealed" ? "+1" : "0"} />

            <div
                className="relative mx-auto flex items-center justify-center"
                style={{
                    width: TILE_SIZE * 3 + GAP * 2,
                    height: TILE_SIZE * 3 + GAP * 2,
                }}
            >
                {/* Gold halo behind capsule */}
                {phase !== "revealed" && (
                    <motion.div
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            width: 180,
                            height: 180,
                            background:
                                "radial-gradient(circle, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0.08) 50%, transparent 75%)",
                            filter: "blur(6px)",
                        }}
                        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                )}

                {/* Orbit sparkles */}
                {phase !== "revealed" && (
                    <div className="absolute inset-0 pointer-events-none">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <motion.div
                                key={`${cycleKey}-sparkle-${i}`}
                                className="absolute w-1.5 h-1.5 rounded-full"
                                style={{
                                    background: "#FFE048",
                                    boxShadow: "0 0 6px #FFE048",
                                    top: `${18 + (i * 17) % 64}%`,
                                    left: `${12 + (i * 23) % 76}%`,
                                }}
                                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 0.5] }}
                                transition={{
                                    duration: 1.6,
                                    delay: i * 0.25,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Capsule */}
                <AnimatePresence>
                    {phase !== "revealed" && (
                        <motion.button
                            key={`${cycleKey}-capsule`}
                            onClick={handleTap}
                            className="relative cursor-pointer"
                            style={{ width: 96, height: 140 }}
                            initial={{ scale: 0.92, opacity: 1 }}
                            animate={
                                phase === "idle"
                                    ? { scale: [0.98, 1.04, 0.98], opacity: 1 }
                                    : {
                                          scale: [1, 1.08, 0],
                                          rotate: [0, -6, 6, 0],
                                          opacity: [1, 1, 0],
                                      }
                            }
                            transition={
                                phase === "idle"
                                    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                                    : { duration: 0.6 }
                            }
                            whileTap={{ scale: 0.94 }}
                            exit={{ opacity: 0 }}
                        >
                            <RealisticCapsule />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Revealed pin */}
                <AnimatePresence>
                    {phase === "revealed" && (
                        <motion.div
                            key={`${cycleKey}-pin`}
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: "spring", stiffness: 220, damping: 18 }}
                        >
                            <div
                                className="relative rounded-full overflow-hidden"
                                style={{
                                    width: 96,
                                    height: 96,
                                    boxShadow:
                                        "0 0 30px rgba(255,215,0,0.85), 0 0 60px rgba(255,215,0,0.45)",
                                    border: "3px solid #FFE048",
                                }}
                            >
                                <Image
                                    src={COSMIC.src}
                                    alt=""
                                    fill
                                    sizes="96px"
                                    className="object-cover pointer-events-none"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <PanelCaption
                idle={phase === "idle" ? "Tap the capsule to open" : null}
                active={phase === "cracking" ? "Cracking..." : phase === "revealed" ? "New Pin!" : null}
            />
        </motion.div>
    );
}

/**
 * RealisticCapsule — simplified 2D approximation of the live VibeCapsule.
 * Key cues from the real capsule: dark chrome/onyx body with a colored rim
 * and glow (gold tier here). Pill shape with a seam at the midpoint.
 */
function RealisticCapsule() {
    const CAPSULE_W = 96;
    const CAPSULE_H = 140;
    const HALF = CAPSULE_H / 2;

    return (
        <div
            className="absolute inset-0"
            style={{ filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.5))" }}
        >
            {/* Top half — dark onyx/chrome, rounded top */}
            <div
                className="absolute"
                style={{
                    top: 0,
                    left: 0,
                    width: CAPSULE_W,
                    height: HALF + 2,
                    borderRadius: `${CAPSULE_W / 2}px ${CAPSULE_W / 2}px 0 0 / ${HALF}px ${HALF}px 0 0`,
                    background:
                        "radial-gradient(ellipse at 35% 30%, #3a3528 0%, #1a1508 55%, #0a0806 100%)",
                    border: "1.5px solid rgba(255,216,72,0.25)",
                    borderBottom: "none",
                    boxShadow: "inset 0 2px 8px rgba(255,255,255,0.15), inset 4px -4px 12px rgba(0,0,0,0.6)",
                }}
            />
            {/* Specular highlight (top-left) */}
            <div
                className="absolute"
                style={{
                    top: 10,
                    left: 18,
                    width: 26,
                    height: 42,
                    background:
                        "radial-gradient(ellipse at 50% 40%, rgba(255,240,160,0.55) 0%, rgba(255,216,72,0.2) 45%, transparent 75%)",
                    filter: "blur(2px)",
                    borderRadius: "50%",
                }}
            />
            {/* Seam — gold accent line */}
            <div
                className="absolute left-0 right-0"
                style={{
                    top: HALF - 1,
                    height: 3,
                    background:
                        "linear-gradient(90deg, transparent 0%, #FFE048 20%, #FFD700 50%, #FFE048 80%, transparent 100%)",
                    boxShadow: "0 0 8px #FFD700",
                }}
            />
            {/* Bottom half — dark onyx with gold tint */}
            <div
                className="absolute"
                style={{
                    bottom: 0,
                    left: 0,
                    width: CAPSULE_W,
                    height: HALF + 2,
                    borderRadius: `0 0 ${CAPSULE_W / 2}px ${CAPSULE_W / 2}px / 0 0 ${HALF}px ${HALF}px`,
                    background:
                        "radial-gradient(ellipse at 35% 65%, #2a2010 0%, #14100a 55%, #0a0806 100%)",
                    border: "1.5px solid rgba(255,216,72,0.3)",
                    borderTop: "none",
                    boxShadow: "inset 0 -2px 10px rgba(0,0,0,0.7), inset 4px 4px 10px rgba(255,216,72,0.12)",
                }}
            />
            {/* Gold rim glow (subtle outer halo via radial gradient fade) */}
            <div
                className="absolute pointer-events-none"
                style={{
                    inset: -4,
                    borderRadius: `${CAPSULE_W / 2 + 4}px`,
                    background: "radial-gradient(ellipse at center, transparent 70%, rgba(255,216,72,0.18) 85%, transparent 100%)",
                }}
            />
        </div>
    );
}

/* =====================================================================
   SHARED PANEL PIECES
   ===================================================================== */

function PanelHeader({ label, value }: { label: string; value: string }) {
    return (
        <div className="relative flex justify-between items-center mb-3 text-left">
            <div className="text-[9px] font-mundial font-black tracking-[0.22em] uppercase text-white/40">
                {label}
            </div>
            <motion.div
                key={value}
                className="flex items-baseline gap-1 text-[#FFE048] font-display font-black"
                initial={{ scale: 1 }}
                animate={{ scale: [1.18, 1] }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                <span className="text-[16px]">{value}</span>
            </motion.div>
        </div>
    );
}

function ScorePopup({ value, label }: { value: number | null; label: string }) {
    return (
        <AnimatePresence>
            {value != null && (
                <motion.div
                    className="absolute left-0 right-0 flex justify-center pointer-events-none"
                    style={{ top: 86 }}
                    initial={{ opacity: 0, y: 0, scale: 0.7 }}
                    animate={{ opacity: 1, y: -68, scale: 1.05 }}
                    exit={{ opacity: 0, y: -76, scale: 0.95 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                >
                    <div
                        className="font-display font-black text-[28px] text-[#FFE048]"
                        style={{
                            textShadow: "0 2px 12px rgba(255,224,72,0.7), 0 0 18px rgba(255,224,72,0.9)",
                        }}
                    >
                        {label}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function PanelCaption({ idle, active }: { idle: string | null; active: string | null }) {
    return (
        <div className="relative mt-3 text-[10px] font-mundial font-bold uppercase tracking-[0.2em] h-[14px]">
            <AnimatePresence mode="wait">
                {idle && (
                    <motion.div
                        key={idle}
                        className="absolute inset-0 text-[#FFE048]/80"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {idle}
                    </motion.div>
                )}
                {active && (
                    <motion.div
                        key={active}
                        className="absolute inset-0 text-[#FFE048]"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {active}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
