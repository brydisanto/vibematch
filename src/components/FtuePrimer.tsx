"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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

const TILE_SIZE = 60;
const GAP = 6;

type PanelIndex = 0 | 1 | 2;

export default function FtuePrimer({ onContinue }: FtuePrimerProps) {
    const [panelIndex, setPanelIndex] = useState<PanelIndex>(0);

    const goTo = (i: PanelIndex) => {
        if (i === panelIndex) return;
        playUIClick();
        setPanelIndex(i);
    };

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
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
                className="relative w-full max-w-md rounded-2xl border border-[#B366FF]/30 px-6 pt-8 pb-6 text-center"
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
                    className="font-display text-xl sm:text-2xl font-black text-[#FFE048] uppercase leading-tight mt-2 mb-3"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                >
                    Here&apos;s the Loop
                </h2>

                {/* Carousel */}
                <div className="relative mb-4">
                    {/* Prev arrow */}
                    <button
                        onClick={() => panelIndex > 0 && goTo((panelIndex - 1) as PanelIndex)}
                        disabled={panelIndex === 0}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90"
                        aria-label="Previous"
                    >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>
                    {/* Next arrow */}
                    <button
                        onClick={() => panelIndex < 2 && goTo((panelIndex + 1) as PanelIndex)}
                        disabled={panelIndex === 2}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90"
                        aria-label="Next"
                    >
                        <ChevronRight size={22} strokeWidth={2.5} />
                    </button>

                    <div
                        className="relative mx-auto rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
                        style={{
                            width: TILE_SIZE * 3 + GAP * 2 + 32,
                            minHeight: 284,
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
                                aria-label={`Go to step ${i + 1}`}
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

                {/* Step cards with chevrons between */}
                <div className="flex flex-col items-stretch gap-1.5 mb-5">
                    <StepCard>
                        Match 3+ badges to score points.
                    </StepCard>
                    <ChevronSep />
                    <StepCard>
                        Score <Strong>15K+</Strong> to win <Strong>Pin Capsules</Strong>.
                    </StepCard>
                    <ChevronSep />
                    <StepCard>
                        Rip Capsules to find Pins and <Strong>build your collection.</Strong>
                    </StepCard>
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
   PANEL 1 — Match-3 demo (unchanged mechanic, wrapped in panel fade)
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
   PANEL 2 — Bomb demo (double-tap the bomb to detonate)
   ===================================================================== */

const BOMB_LAYOUT = [
    [DOGE, CAPTAIN, ASTRO],
    [ASTRO, null, DOGE], // center is bomb
    [CAPTAIN, ASTRO, DOGE],
];

type BombPhase = "idle" | "selected" | "detonated";

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
                {BOMB_LAYOUT.map((row, r) =>
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
                                    background: isBomb
                                        ? "radial-gradient(circle, #4A1010, #1A0404)"
                                        : "rgba(255,255,255,0.04)",
                                    border: isBomb
                                        ? "2px solid #FF5722"
                                        : "1.5px solid rgba(255,255,255,0.08)",
                                    boxShadow: isBomb
                                        ? "0 0 22px rgba(255,87,34,0.7)"
                                        : "none",
                                    cursor: isBomb ? "pointer" : "default",
                                }}
                                initial={{ scale: 1, opacity: 1 }}
                                animate={
                                    phase === "detonated"
                                        ? { scale: [1, 1.2, 0], opacity: [1, 1, 0] }
                                        : isBomb && phase === "idle"
                                            ? { scale: [1, 1.07, 1], opacity: 1 }
                                            : isBomb && phase === "selected"
                                                ? { scale: [1, 1.12, 1], opacity: 1 }
                                                : { scale: 1, opacity: 1 }
                                }
                                transition={
                                    phase === "detonated"
                                        ? { duration: 0.6, times: [0, 0.3, 1] }
                                        : isBomb
                                            ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
                                            : { type: "spring", stiffness: 400, damping: 28 }
                                }
                                whileTap={isBomb ? { scale: 0.92 } : undefined}
                            >
                                {isBomb ? (
                                    <BombGlyph selected={phase === "selected"} />
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
                    initial={{ opacity: 0.9, scale: 0 }}
                    animate={{ opacity: 0, scale: 3 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    <div
                        className="w-32 h-32 rounded-full"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(255,224,72,0.9) 0%, rgba(255,87,34,0.6) 40%, transparent 75%)",
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

function BombGlyph({ selected }: { selected: boolean }) {
    return (
        <motion.div
            animate={{ rotate: selected ? [0, -6, 6, -6, 0] : 0 }}
            transition={selected ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
            className="relative flex items-center justify-center"
        >
            <div
                className="w-7 h-7 rounded-full"
                style={{
                    background: "radial-gradient(circle at 30% 30%, #FF8A4C, #5A1010)",
                    boxShadow: "0 2px 8px rgba(255,87,34,0.6), inset -2px -2px 4px rgba(0,0,0,0.5)",
                }}
            />
            <div
                className="absolute top-[2px] left-[50%] w-1 h-2 -translate-x-1/2"
                style={{ background: "rgba(255,224,72,0.9)", borderRadius: 2 }}
            />
            <div
                className="absolute top-[-2px] left-[50%] w-1.5 h-1.5 -translate-x-1/2 rounded-full"
                style={{
                    background: "#FFE048",
                    boxShadow: "0 0 8px #FFE048, 0 0 14px #FF5722",
                }}
            />
        </motion.div>
    );
}

/* =====================================================================
   PANEL 3 — Capsule opens to reveal a pin
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
                {/* Sparkles behind */}
                {phase !== "revealed" && (
                    <div className="absolute inset-0 pointer-events-none">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <motion.div
                                key={`${cycleKey}-sparkle-${i}`}
                                className="absolute w-1.5 h-1.5 rounded-full"
                                style={{
                                    background: "#FFE048",
                                    boxShadow: "0 0 6px #FFE048",
                                    top: `${15 + (i * 13) % 70}%`,
                                    left: `${10 + (i * 19) % 80}%`,
                                }}
                                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                                transition={{ duration: 1.8, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                        ))}
                    </div>
                )}

                {/* The capsule */}
                <AnimatePresence>
                    {phase !== "revealed" && (
                        <motion.button
                            key={`${cycleKey}-capsule`}
                            onClick={handleTap}
                            className="relative cursor-pointer"
                            style={{ width: 100, height: 128 }}
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
                                    ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                                    : { duration: 0.6 }
                            }
                            whileTap={{ scale: 0.94 }}
                            exit={{ opacity: 0 }}
                        >
                            <CapsuleGraphic />
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
                                    boxShadow: "0 0 30px rgba(255,224,72,0.8), 0 0 60px rgba(255,224,72,0.4)",
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

function CapsuleGraphic() {
    return (
        <div className="absolute inset-0">
            {/* Top half */}
            <div
                className="absolute"
                style={{
                    top: 0,
                    left: "8%",
                    right: "8%",
                    height: "46%",
                    background: "linear-gradient(135deg, #B366FF, #6C5CE7)",
                    borderRadius: "50% 50% 0 0 / 80% 80% 0 0",
                    boxShadow: "inset 0 -3px 10px rgba(0,0,0,0.35), inset 6px 8px 14px rgba(255,255,255,0.35)",
                }}
            />
            {/* Seam */}
            <div
                className="absolute left-0 right-0"
                style={{ top: "46%", height: 6, background: "rgba(0,0,0,0.45)" }}
            />
            {/* Bottom half */}
            <div
                className="absolute"
                style={{
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "54%",
                    background: "linear-gradient(135deg, #FFE048, #FFA500)",
                    borderRadius: "50% 50% 60% 60% / 18% 18% 80% 80%",
                    boxShadow: "inset 0 3px 10px rgba(0,0,0,0.2), inset -6px 10px 16px rgba(255,255,255,0.3)",
                }}
            />
            {/* Shine */}
            <div
                className="absolute"
                style={{
                    top: 10,
                    left: 22,
                    width: 12,
                    height: 32,
                    background: "rgba(255,255,255,0.4)",
                    borderRadius: "50%",
                    filter: "blur(3px)",
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

/* =====================================================================
   STEP CARDS (Option B layout, chevrons between)
   ===================================================================== */

function Strong({ children }: { children: React.ReactNode }) {
    return <strong className="text-[#FFE048] font-bold">{children}</strong>;
}

function StepCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <div className="text-[13px] font-mundial text-white/92 leading-snug text-center">
                {children}
            </div>
        </div>
    );
}

function ChevronSep() {
    return (
        <div className="flex justify-center text-[#B366FF]/60">
            <ChevronDown size={18} strokeWidth={2.4} />
        </div>
    );
}
