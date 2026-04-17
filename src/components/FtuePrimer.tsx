"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

interface FtuePrimerProps {
    onContinue: () => void;
}

// Badges chosen for visual distinctiveness in the demo grid.
const CITIZEN = { id: "citizen", src: "/badges/any_gvc_1759173799963.webp" };
const DOGE = { id: "doge", src: "/badges/doge_1759173842640.webp" };
const ASTRO = { id: "astro", src: "/badges/astro_balls_1759173838889.webp" };
const CAPTAIN = { id: "captain", src: "/badges/captain_1759173895611.webp" };

type Tile = { id: number; badge: { id: string; src: string } };
type Phase = "idle" | "swapping" | "matched";

const TILE_SIZE = 64;
const GAP = 6;

// 3×3 starting layout. Swapping (0,2) with (1,2) creates 3 Citizens in row 0.
const INITIAL_GRID: Tile[][] = [
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

// The two tiles the user should swap to make the match.
const SWAP_A = { row: 0, col: 2 };
const SWAP_B = { row: 1, col: 2 };

export default function FtuePrimer({ onContinue }: FtuePrimerProps) {
    const [grid, setGrid] = useState<Tile[][]>(INITIAL_GRID);
    const [phase, setPhase] = useState<Phase>("idle");
    const [score, setScore] = useState(0);
    const [scorePop, setScorePop] = useState<number | null>(null);
    // Incremented each time the demo resets. Keyed into every tile so framer
    // remounts them cleanly — otherwise the matched tiles' final opacity:0
    // persists across cycles and the row stays visually empty.
    const [cycleKey, setCycleKey] = useState(0);

    const matchedPositions = phase === "matched"
        ? [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]
        : [];

    const isHintTile = (r: number, c: number) =>
        phase === "idle" && ((r === SWAP_A.row && c === SWAP_A.col) || (r === SWAP_B.row && c === SWAP_B.col));

    const isMatchedTile = (r: number, c: number) =>
        matchedPositions.some((p) => p.row === r && p.col === c);

    const handleTap = (r: number, c: number) => {
        if (phase !== "idle") return;
        const isSwappable = (r === SWAP_A.row && c === SWAP_A.col) || (r === SWAP_B.row && c === SWAP_B.col);
        if (!isSwappable) return;

        // Animate swap: clone grid and swap the two cells.
        setPhase("swapping");
        const newGrid = grid.map((row) => [...row]);
        const a = newGrid[SWAP_A.row][SWAP_A.col];
        const b = newGrid[SWAP_B.row][SWAP_B.col];
        newGrid[SWAP_A.row][SWAP_A.col] = b;
        newGrid[SWAP_B.row][SWAP_B.col] = a;
        setGrid(newGrid);

        // After swap animation, trigger match
        setTimeout(() => {
            setPhase("matched");
            setScorePop(300);
            setScore(300);
            setTimeout(() => setScorePop(null), 1400);
        }, 320);
    };

    // Auto-reset after match so the user can try again if they missed it.
    useEffect(() => {
        if (phase !== "matched") return;
        const t = setTimeout(() => {
            setGrid(INITIAL_GRID);
            setScore(0);
            setPhase("idle");
            setCycleKey((k) => k + 1);
        }, 1500);
        return () => clearTimeout(t);
    }, [phase]);

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
                    className="absolute top-[-12px] left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-mundial font-black tracking-[0.2em] uppercase text-white"
                    style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
                >
                    The Basics
                </div>

                <h2
                    className="font-display text-xl sm:text-2xl font-black text-[#FFE048] uppercase leading-tight mt-2 mb-3"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                >
                    Here&apos;s the Loop
                </h2>

                {/* Interactive match-3 demo */}
                <div className="relative mx-auto mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
                    style={{
                        width: TILE_SIZE * 3 + GAP * 2 + 32,
                        padding: "16px",
                    }}
                >
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: "radial-gradient(circle at 50% 50%, rgba(255,224,72,0.1), transparent 65%)",
                        }}
                    />

                    {/* Score pill — top-right */}
                    <div className="relative flex justify-between items-center mb-3 text-left">
                        <div className="text-[9px] font-mundial font-black tracking-[0.22em] uppercase text-white/40">
                            Score
                        </div>
                        <motion.div
                            key={score}
                            className="flex items-baseline gap-1 text-[#FFE048] font-display font-black"
                            initial={{ scale: 1 }}
                            animate={score > 0 ? { scale: [1.18, 1] } : { scale: 1 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <span className="text-[16px]">{score.toLocaleString()}</span>
                        </motion.div>
                    </div>

                    {/* Tile grid */}
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
                                const hinted = isHintTile(r, c);
                                const matched = isMatchedTile(r, c);
                                return (
                                    <motion.button
                                        // cycleKey forces remount on reset — frees framer from the
                                        // previous cycle's opacity:0 / scale:0 final state.
                                        key={`${cycleKey}-${tile.id}`}
                                        onClick={() => handleTap(r, c)}
                                        layout
                                        layoutId={`ftue-tile-${cycleKey}-${tile.id}`}
                                        className="relative rounded-[12px] overflow-hidden"
                                        style={{
                                            width: TILE_SIZE,
                                            height: TILE_SIZE,
                                            background: "rgba(255,255,255,0.04)",
                                            border: hinted
                                                ? "2px solid #FFE048"
                                                : matched
                                                    ? "2px solid #FFE048"
                                                    : "1.5px solid rgba(255,255,255,0.08)",
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

                    {/* Score popup */}
                    <AnimatePresence>
                        {scorePop != null && (
                            <motion.div
                                className="absolute left-0 right-0 top-[58%] flex justify-center pointer-events-none"
                                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                animate={{ opacity: 1, y: -20, scale: 1.1 }}
                                exit={{ opacity: 0, y: -32, scale: 1 }}
                                transition={{ duration: 1.2 }}
                            >
                                <div
                                    className="font-display font-black text-[32px] text-[#FFE048]"
                                    style={{ textShadow: "0 2px 12px rgba(255,224,72,0.6), 0 0 18px rgba(255,224,72,0.8)" }}
                                >
                                    +300
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Instruction caption */}
                    <div className="relative mt-3 text-[10px] font-mundial font-bold uppercase tracking-[0.2em] h-[14px]">
                        <AnimatePresence mode="wait">
                            {phase === "idle" && (
                                <motion.div
                                    key="idle"
                                    className="absolute inset-0 text-[#FFE048]/80"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    Tap a glowing tile to swap
                                </motion.div>
                            )}
                            {phase === "matched" && (
                                <motion.div
                                    key="matched"
                                    className="absolute inset-0 text-[#FFE048]"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    Match!
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex flex-col gap-2.5 mb-5">
                    <PrimerStep num={1}>
                        Match badges to score points.
                    </PrimerStep>
                    <PrimerStep num={2}>
                        Score <Strong>15K+</Strong> to win <Strong>Pin Capsules</Strong>.
                    </PrimerStep>
                    <PrimerStep num={3}>
                        Rip Capsules to find <Strong>Pins</Strong> <Strong>and build your collection</Strong>.
                    </PrimerStep>
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

function Strong({ children }: { children: React.ReactNode }) {
    return <strong className="text-[#FFE048] font-bold">{children}</strong>;
}

function PrimerStep({ num, children }: { num: number; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-display font-black text-[13px] text-white"
                style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
            >
                {num}
            </div>
            <div className="text-[13px] font-mundial text-white/90 leading-snug text-left">
                {children}
            </div>
        </div>
    );
}
