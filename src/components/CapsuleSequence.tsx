"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import VibeCapsule from "./VibeCapsule";
import { Badge, BadgeTier, TIER_COLORS, TIER_DISPLAY_NAMES } from "@/lib/badges";
import type { CapsuleReveal } from "@/lib/usePinBook";

// Tiers that always get the full hero animation (no quickOpen, no auto-collect)
// even inside a bulk run, so a rare pull is never blurred past.
const HERO_TIERS: BadgeTier[] = ["gold", "cosmic"];

const AUTO_COLLECT_MS = 650;

interface CapsuleSequenceProps {
    isOpen: boolean;
    /** How many capsules to open in this run. */
    count: number;
    openCapsule: () => Promise<CapsuleReveal | null>;
    collectReveal: () => Promise<void>;
    onClose: (pulled: CapsuleReveal[]) => void;
}

type SequencePhase = "idle" | "rolling" | "revealing" | "summary" | "closing";

export default function CapsuleSequence({
    isOpen,
    count,
    openCapsule,
    collectReveal,
    onClose,
}: CapsuleSequenceProps) {
    const mode: "single" | "chain" | "bulk" =
        count >= 6 ? "bulk" : count >= 2 ? "chain" : "single";

    const [pulled, setPulled] = useState<CapsuleReveal[]>([]);
    const [currentReveal, setCurrentReveal] = useState<CapsuleReveal | null>(null);
    const [phase, setPhase] = useState<SequencePhase>("idle");
    const [revealKey, setRevealKey] = useState(0);
    const [rollFailed, setRollFailed] = useState(false);
    const remainingRef = useRef<number>(count);
    const runIdRef = useRef(0);
    const pulledRef = useRef<CapsuleReveal[]>([]);
    // Guards against double-rolls when openCapsule's identity changes mid-roll
    // because usePinBook rebinds it on each state.capsules decrement.
    const rollInFlightRef = useRef(false);

    // Kick off the run whenever isOpen flips true (and we have capsules)
    useEffect(() => {
        if (!isOpen) return;
        runIdRef.current += 1;
        remainingRef.current = count;
        pulledRef.current = [];
        rollInFlightRef.current = false;
        setPulled([]);
        setCurrentReveal(null);
        setRollFailed(false);
        setRevealKey(k => k + 1);
        setPhase("rolling");
    }, [isOpen, count]);

    // Roll the next capsule when we enter the rolling phase. Gated by a ref
    // so we don't double-fire if openCapsule's identity changes mid-roll.
    useEffect(() => {
        if (!isOpen) return;
        if (phase !== "rolling") { rollInFlightRef.current = false; return; }
        if (rollInFlightRef.current) return;
        rollInFlightRef.current = true;
        const myRun = runIdRef.current;
        let cancelled = false;
        (async () => {
            const reveal = await openCapsule();
            if (cancelled || myRun !== runIdRef.current) return;
            rollInFlightRef.current = false;
            if (!reveal) {
                setRollFailed(true);
                setPhase("summary");
                return;
            }
            setCurrentReveal(reveal);
            setRevealKey(k => k + 1);
            setPhase("revealing");
        })();
        return () => { cancelled = true; };
    }, [isOpen, phase, openCapsule]);

    // When VibeCapsule signals completion, collect + advance
    const handleRevealComplete = useCallback(async () => {
        if (!currentReveal) return;
        const collectingReveal = currentReveal;
        await collectReveal();
        const nextPulled = [...pulledRef.current, collectingReveal];
        pulledRef.current = nextPulled;
        setPulled(nextPulled);
        remainingRef.current -= 1;

        if (remainingRef.current <= 0) {
            if (mode === "bulk") {
                setPhase("summary");
            } else {
                setPhase("closing");
                onClose(nextPulled);
            }
            return;
        }

        // Chain to next capsule — flip to rolling (the VibeCapsule unmount via
        // currentReveal=null also clears any lingering animation state).
        setCurrentReveal(null);
        setPhase("rolling");
    }, [collectReveal, currentReveal, mode, onClose]);

    const rare = currentReveal ? HERO_TIERS.includes(currentReveal.tier) : false;
    // Bulk mode: non-rare pulls use quickOpen + auto-collect to cycle fast.
    // Rare pulls (gold/cosmic) always get the full hero animation and a manual tap.
    // Chain mode (2-5) and single: always full animation + manual tap.
    const quickOpen = mode === "bulk" && !rare;
    const autoCollectMs = mode === "bulk" && !rare ? AUTO_COLLECT_MS : undefined;

    if (!isOpen) return null;

    return (
        <>
            {currentReveal && phase === "revealing" && (
                <VibeCapsule
                    key={revealKey}
                    isOpen={true}
                    badge={currentReveal.badge}
                    tier={currentReveal.tier}
                    isDuplicate={currentReveal.isDuplicate}
                    duplicateCount={currentReveal.duplicateCount}
                    quickOpen={quickOpen}
                    autoCollectMs={autoCollectMs}
                    onComplete={handleRevealComplete}
                />
            )}

            {phase === "rolling" && (
                <RollingOverlay
                    mode={mode}
                    index={pulled.length + 1}
                    total={count}
                />
            )}

            {phase === "summary" && (
                <SummaryOverlay
                    pulled={pulled}
                    failed={rollFailed}
                    onDismiss={() => onClose(pulled)}
                />
            )}
        </>
    );
}

// -----------------------------------------------------------------------------
// Overlays
// -----------------------------------------------------------------------------

function RollingOverlay({ mode, index, total }: { mode: "single" | "chain" | "bulk"; index: number; total: number }) {
    const showCounter = mode !== "single";
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(26,6,51,0.92), rgba(6,0,15,0.96))" }} />
            <div className="relative flex flex-col items-center gap-3">
                <motion.div
                    className="w-12 h-12 rounded-full border-2 border-white/10"
                    style={{ borderTopColor: "#B366FF", borderRightColor: "#B366FF" }}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                />
                {showCounter && (
                    <div className="text-[11px] font-mundial uppercase tracking-widest text-white/60">
                        Capsule <span className="text-[#B366FF] font-bold">{index}</span> of {total}
                    </div>
                )}
            </div>
        </div>
    );
}

interface SummaryOverlayProps {
    pulled: CapsuleReveal[];
    failed: boolean;
    onDismiss: () => void;
}

function SummaryOverlay({ pulled, failed, onDismiss }: SummaryOverlayProps) {
    const { newPins, dupes, bestTier } = useMemo(() => summarize(pulled), [pulled]);

    return (
        <AnimatePresence>
            <motion.div
                key="summary"
                className="fixed inset-0 z-[130] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div
                    className="absolute inset-0"
                    style={{ background: "radial-gradient(circle at 50% 40%, rgba(26,6,51,0.94), rgba(6,0,15,0.98))" }}
                    onClick={onDismiss}
                />
                <motion.div
                    initial={{ scale: 0.92, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    className="relative w-full max-w-[480px] rounded-2xl p-5 sm:p-6"
                    style={{
                        background: "linear-gradient(180deg, rgba(36,14,68,0.95), rgba(16,6,34,0.96))",
                        border: "1px solid rgba(179,102,255,0.3)",
                        boxShadow: "0 20px 80px rgba(0,0,0,0.6), 0 0 48px rgba(179,102,255,0.25)",
                    }}
                >
                    <div className="text-center mb-4">
                        <div className="text-[10px] font-mundial uppercase tracking-widest text-white/50 mb-1">
                            Haul complete
                        </div>
                        <div className="text-2xl sm:text-3xl font-display font-black text-white">
                            {failed && pulled.length === 0
                                ? "Something went wrong"
                                : `${pulled.length} ${pulled.length === 1 ? "Capsule" : "Capsules"} Opened`}
                        </div>
                        {!failed && pulled.length > 0 && (
                            <div className="mt-1 text-[11px] font-mundial text-white/60">
                                <span className="text-[#B366FF] font-bold">{newPins}</span> new ·{" "}
                                <span className="text-white/80 font-bold">{dupes}</span> duplicate
                                {bestTier && (
                                    <>
                                        {" · best pull "}
                                        <span style={{ color: TIER_COLORS[bestTier] }} className="font-bold uppercase">
                                            {TIER_DISPLAY_NAMES[bestTier]}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {pulled.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[48vh] overflow-y-auto custom-scrollbar pr-1">
                            {pulled.map((reveal, i) => (
                                <SummaryCard key={`${reveal.badge.id}-${i}`} reveal={reveal} index={i} />
                            ))}
                        </div>
                    )}

                    <button
                        onClick={onDismiss}
                        className="mt-5 w-full py-3 rounded-xl text-[11px] font-black font-mundial uppercase tracking-widest transition-all hover:brightness-110 active:translate-y-0.5"
                        style={{
                            background: "linear-gradient(180deg, #B366FF 0%, #8A2BE2 100%)",
                            border: "2px solid rgba(179,102,255,0.6)",
                            color: "#fff",
                            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                        }}
                    >
                        Back to Pin Book
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function SummaryCard({ reveal, index }: { reveal: CapsuleReveal; index: number }) {
    const tierColor = TIER_COLORS[reveal.tier] ?? "#888";
    const { badge, isDuplicate } = reveal;
    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.28 }}
            className="relative rounded-xl p-2 flex flex-col items-center gap-1"
            style={{
                background: `linear-gradient(180deg, ${tierColor}18, ${tierColor}08)`,
                border: `1px solid ${tierColor}40`,
            }}
        >
            <PinArt badge={badge} tier={reveal.tier} />
            <div className="mt-1 text-[9px] font-mundial uppercase tracking-wider text-center truncate w-full" style={{ color: tierColor }}>
                {badge.name}
            </div>
            {isDuplicate ? (
                <div className="text-[8px] font-mundial uppercase tracking-wider text-white/40">Dupe</div>
            ) : (
                <div className="text-[8px] font-mundial uppercase tracking-wider font-bold" style={{ color: tierColor }}>New</div>
            )}
        </motion.div>
    );
}

function PinArt({ badge, tier }: { badge: Badge; tier: BadgeTier }) {
    const tierColor = TIER_COLORS[tier] ?? "#888";
    return (
        <div
            className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center"
            style={{
                background: `radial-gradient(circle, ${tierColor}30, transparent 70%)`,
                boxShadow: `0 0 12px ${tierColor}55`,
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badge.image} alt={badge.name} className="w-full h-full object-cover" />
        </div>
    );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TIER_RANK: Record<BadgeTier, number> = {
    blue: 0,
    silver: 1,
    special: 2,
    gold: 3,
    cosmic: 4,
};

function summarize(pulled: CapsuleReveal[]) {
    let newPins = 0;
    let dupes = 0;
    let bestTier: BadgeTier | null = null;
    for (const r of pulled) {
        if (r.isDuplicate) dupes += 1;
        else newPins += 1;
        if (bestTier === null || TIER_RANK[r.tier] > TIER_RANK[bestTier]) {
            bestTier = r.tier;
        }
    }
    return { newPins, dupes, bestTier };
}
