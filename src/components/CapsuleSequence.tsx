"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import VibeCapsule from "./VibeCapsule";
import { Badge, BadgeTier, TIER_COLORS, TIER_DISPLAY_NAMES } from "@/lib/badges";
import type { CapsuleReveal } from "@/lib/usePinBook";

interface CapsuleSequenceProps {
    isOpen: boolean;
    /** How many capsules to open in this run. */
    count: number;
    /** "chain" reveals one capsule at a time with an escape button. "bulk"
     *  pre-rolls every capsule server-side and then plays a single hero
     *  reveal at the best tier, followed by the summary grid. */
    mode: "chain" | "bulk";
    openCapsule: () => Promise<CapsuleReveal | null>;
    collectReveal: () => Promise<void>;
    onClose: (pulled: CapsuleReveal[]) => void;
}

type SequencePhase =
    | "idle"
    | "rolling"         // chain: rolling the next capsule between reveals
    | "revealing"       // chain: showing VibeCapsule for the current reveal
    | "prerolling"      // bulk: server-rolling every capsule before the reveal
    | "herorevealing"   // bulk: showing a single VibeCapsule for the best-tier pull
    | "summary"
    | "closing";

const TIER_RANK: Record<BadgeTier, number> = {
    blue: 0,
    silver: 1,
    special: 2,
    gold: 3,
    cosmic: 4,
};

export default function CapsuleSequence({
    isOpen,
    count,
    mode,
    openCapsule,
    collectReveal,
    onClose,
}: CapsuleSequenceProps) {
    const [pulled, setPulled] = useState<CapsuleReveal[]>([]);
    const [currentReveal, setCurrentReveal] = useState<CapsuleReveal | null>(null);
    const [phase, setPhase] = useState<SequencePhase>("idle");
    const [revealKey, setRevealKey] = useState(0);
    const [prerollProgress, setPrerollProgress] = useState(0);
    const [rollFailed, setRollFailed] = useState(false);
    const remainingRef = useRef<number>(count);
    const runIdRef = useRef(0);
    const pulledRef = useRef<CapsuleReveal[]>([]);
    // Guards against double-rolls when openCapsule's identity changes mid-roll
    // because usePinBook rebinds it on each state.capsules decrement.
    const rollInFlightRef = useRef(false);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    // Keep the hook methods behind refs so the bulk/chain effects don't
    // re-trigger (and restart the loop) every time state changes rebind their
    // identity. usePinBook's openCapsule depends on state.capsules and
    // collectReveal depends on pendingReveal, so both rebind on every roll;
    // before this, the bulk useEffect was restarting mid-loop and
    // double-opening capsules, which surfaced as "Something went wrong"
    // because the server rejected the repeat call with a pending-reveal
    // conflict.
    const openCapsuleRef = useRef(openCapsule);
    const collectRevealRef = useRef(collectReveal);
    useEffect(() => { openCapsuleRef.current = openCapsule; }, [openCapsule]);
    useEffect(() => { collectRevealRef.current = collectReveal; }, [collectReveal]);

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
        setPrerollProgress(0);
        setRevealKey(k => k + 1);
        setPhase(mode === "bulk" ? "prerolling" : "rolling");
    }, [isOpen, count, mode]);

    // CHAIN mode: roll one capsule whenever phase enters "rolling".
    useEffect(() => {
        if (!isOpen) return;
        if (mode !== "chain") return;
        if (phase !== "rolling") { rollInFlightRef.current = false; return; }
        if (rollInFlightRef.current) return;
        rollInFlightRef.current = true;
        const myRun = runIdRef.current;
        let cancelled = false;
        (async () => {
            const reveal = await openCapsuleRef.current();
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
    }, [isOpen, phase, mode]);

    // BULK mode: pre-roll every capsule sequentially, then hand off to the
    // hero reveal of the best-tier pull.
    useEffect(() => {
        if (!isOpen) return;
        if (mode !== "bulk") return;
        if (phase !== "prerolling") return;
        const myRun = runIdRef.current;
        let cancelled = false;
        (async () => {
            const collected: CapsuleReveal[] = [];
            for (let i = 0; i < count; i++) {
                if (cancelled || myRun !== runIdRef.current) return;
                const reveal = await openCapsuleRef.current();
                if (cancelled || myRun !== runIdRef.current) return;
                if (!reveal) {
                    // Partial failure: whatever we got so far still counts.
                    if (collected.length === 0) {
                        setRollFailed(true);
                        setPhase("summary");
                        return;
                    }
                    break;
                }
                // Credit the pin server-side immediately so the user owns it
                // even if they navigate away during the hero reveal.
                await collectRevealRef.current();
                if (cancelled || myRun !== runIdRef.current) return;
                collected.push(reveal);
                setPrerollProgress(collected.length);
            }
            if (collected.length === 0) {
                setRollFailed(true);
                setPhase("summary");
                return;
            }
            pulledRef.current = collected;
            setPulled(collected);
            // Pick the best-tier reveal as the hero. Ties broken by pull order
            // (first one wins) — arbitrary but stable.
            const hero = collected.reduce((best, r) =>
                TIER_RANK[r.tier] > TIER_RANK[best.tier] ? r : best, collected[0]);
            setCurrentReveal(hero);
            setRevealKey(k => k + 1);
            setPhase("herorevealing");
        })();
        return () => { cancelled = true; };
    }, [isOpen, phase, mode, count]);

    // CHAIN reveal complete: collect + advance. BULK reveals were already
    // collected during pre-roll; hero-reveal completion jumps to summary.
    const handleRevealComplete = useCallback(async () => {
        if (!currentReveal) return;
        if (mode === "bulk") {
            setPhase("summary");
            return;
        }
        const collectingReveal = currentReveal;
        await collectRevealRef.current();
        const nextPulled = [...pulledRef.current, collectingReveal];
        pulledRef.current = nextPulled;
        setPulled(nextPulled);
        remainingRef.current -= 1;

        if (remainingRef.current <= 0) {
            setPhase("closing");
            onClose(nextPulled);
            return;
        }

        setCurrentReveal(null);
        setPhase("rolling");
    }, [currentReveal, mode, onClose]);

    // Escape from chain mode mid-run — finishes whatever has already been
    // collected and returns to the Pin Book.
    const handleEscape = useCallback(() => {
        runIdRef.current += 1; // invalidate in-flight rolls
        setPhase("closing");
        onCloseRef.current(pulledRef.current);
    }, []);

    if (!isOpen) return null;

    const showVibeCapsule =
        (phase === "revealing" || phase === "herorevealing") && currentReveal !== null;

    return (
        <>
            {showVibeCapsule && currentReveal && (
                <VibeCapsule
                    key={revealKey}
                    isOpen={true}
                    badge={currentReveal.badge}
                    tier={currentReveal.tier}
                    isDuplicate={currentReveal.isDuplicate}
                    duplicateCount={currentReveal.duplicateCount}
                    quickOpen={false}
                    onComplete={handleRevealComplete}
                />
            )}

            {/* Chain escape button — floats in the top-right while a chain
                run is active so users can bail out between or during pulls. */}
            {mode === "chain" && (phase === "rolling" || phase === "revealing") && (
                <button
                    onClick={handleEscape}
                    aria-label="Close capsule opening"
                    className="fixed top-4 right-4 z-[140] w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    style={{
                        background: "rgba(12, 4, 24, 0.85)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
                        color: "rgba(255,255,255,0.85)",
                    }}
                >
                    <X size={18} />
                </button>
            )}

            {phase === "rolling" && (
                <RollingOverlay
                    subtitle={count > 1 ? `Capsule ${pulled.length + 1} of ${count}` : undefined}
                />
            )}

            {phase === "prerolling" && (
                <RollingOverlay
                    subtitle={`Opening ${prerollProgress} of ${count}`}
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

function RollingOverlay({ subtitle }: { subtitle?: string }) {
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
                {subtitle && (
                    <div className="text-[11px] font-mundial uppercase tracking-widest text-white/60">
                        {subtitle}
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
                    className="relative w-full max-w-[520px] rounded-2xl p-5 sm:p-6"
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
                                <span className="text-[#4ADE80] font-bold">{newPins}</span> new ·{" "}
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
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1">
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
            title={badge.name}
            style={{
                background: `linear-gradient(180deg, ${tierColor}18, ${tierColor}08)`,
                border: `1px solid ${tierColor}40`,
            }}
        >
            <PinArt badge={badge} tier={reveal.tier} />
            <div
                className="mt-1 font-display font-black text-[10px] leading-tight text-center w-full break-words line-clamp-2"
                style={{ color: tierColor }}
            >
                {badge.name}
            </div>
            <div className="text-[8px] font-mundial uppercase tracking-widest text-white/40">
                {TIER_DISPLAY_NAMES[reveal.tier]}
            </div>
            {isDuplicate ? (
                <div className="text-[8px] font-mundial uppercase tracking-widest text-white/40">Duplicate</div>
            ) : (
                <div
                    className="text-[8px] font-mundial font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{
                        color: "#0a1f10",
                        background: "linear-gradient(180deg, #6EF0A0, #3ED17A)",
                        boxShadow: "0 0 10px rgba(78, 222, 128, 0.55), 0 0 18px rgba(78, 222, 128, 0.25)",
                    }}
                >
                    New
                </div>
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
