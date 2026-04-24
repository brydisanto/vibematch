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
    /** Atomic open+collect used by bulk mode to avoid the React render race
     *  between the state-based openCapsule and collectReveal. */
    rollAndCollectCapsule: () => Promise<CapsuleReveal | null>;
    onClose: (pulled: CapsuleReveal[]) => void;
}

type SequencePhase =
    | "idle"
    | "rolling"         // chain: rolling the next capsule between reveals
    | "revealing"       // chain: showing VibeCapsule for the current reveal
    | "prerolling"      // bulk: server-rolling every capsule
    | "herorevealing"   // bulk: showing a single VibeCapsule at the best-tier pull
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
    rollAndCollectCapsule,
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
    const rollAndCollectRef = useRef(rollAndCollectCapsule);
    useEffect(() => { openCapsuleRef.current = openCapsule; }, [openCapsule]);
    useEffect(() => { collectRevealRef.current = collectReveal; }, [collectReveal]);
    useEffect(() => { rollAndCollectRef.current = rollAndCollectCapsule; }, [rollAndCollectCapsule]);

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
                // Atomic open+collect — hits the server sequentially and
                // updates client state without routing through pendingReveal,
                // so we don't race React's render cycle between iterations.
                const reveal = await rollAndCollectRef.current();
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
                collected.push(reveal);
                setPrerollProgress(collected.length);
            }
            if (collected.length === 0) {
                setRollFailed(true);
                setPhase("summary");
                return;
            }
            // Sort the haul by tier rarity (most rare first) so the summary
            // grid leads with cosmic/legendary pulls rather than whatever
            // came out of the RNG first.
            const sorted = [...collected].sort(
                (a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]
            );
            pulledRef.current = sorted;
            setPulled(sorted);
            // Play one capsule reveal at the best-tier pull (first after
            // sort), then jump to the summary grid on user tap.
            setCurrentReveal(sorted[0]);
            setRevealKey(k => k + 1);
            setPhase("herorevealing");
        })();
        return () => { cancelled = true; };
    }, [isOpen, phase, mode, count]);

    // Reveal complete. Chain: collect this pull + advance to the next.
    // Bulk hero-reveal: all pulls were pre-rolled and credited during the
    // pre-roll loop, so we just hand off to the summary.
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

            {/* Chain escape pill — lives in the top-right while a chain run
                is active so users can bail out between or during pulls. Large
                and labeled so it doesn't get lost against the capsule FX. */}
            {mode === "chain" && (phase === "rolling" || phase === "revealing") && (
                <motion.button
                    onClick={handleEscape}
                    aria-label="Close capsule opening"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.25 }}
                    className="fixed top-5 right-5 z-[140] flex items-center gap-1.5 rounded-full pl-3 pr-3.5 py-2 transition-all hover:scale-[1.04] active:scale-[0.97]"
                    style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(235,225,255,0.94))",
                        border: "1px solid rgba(179,102,255,0.55)",
                        boxShadow: "0 6px 20px rgba(0,0,0,0.55), 0 0 24px rgba(179,102,255,0.4)",
                        color: "#2A0F52",
                    }}
                >
                    <X size={16} strokeWidth={3} />
                    <span className="font-mundial font-black text-[11px] uppercase tracking-[0.18em]">
                        Close
                    </span>
                </motion.button>
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

// Tier colors used for the idle-floating capsules so the overlay previews the
// palette the user's about to see in the summary.
const IDLE_CAPSULE_TIERS: BadgeTier[] = ["blue", "silver", "special", "gold", "cosmic"];

function RollingOverlay({ subtitle }: { subtitle?: string }) {
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(26,6,51,0.92), rgba(6,0,15,0.96))" }} />
            <div className="relative flex flex-col items-center gap-5">
                {/* Floating capsule cluster — five rarity-tinted pills bobbing
                    on staggered delays so the counter feels alive instead of
                    a blank spinner wait. */}
                <div className="relative h-28 w-[280px] flex items-end justify-center gap-3">
                    {IDLE_CAPSULE_TIERS.map((tier, i) => (
                        <FloatingCapsule key={tier} tier={tier} index={i} />
                    ))}
                </div>
                <motion.div
                    className="w-8 h-8 rounded-full border-2 border-white/10"
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

function FloatingCapsule({ tier, index }: { tier: BadgeTier; index: number }) {
    const color = TIER_COLORS[tier] ?? "#888";
    // Each capsule bobs with a slightly different phase + vertical range to
    // look like a loose cluster rather than a locked-step row.
    const duration = 1.6 + (index % 3) * 0.25;
    const delay = index * 0.18;
    const bobHeight = 12 + (index % 2) * 4;
    return (
        <motion.div
            initial={{ y: 0, rotate: 0 }}
            animate={{
                y: [0, -bobHeight, 0, bobHeight * 0.6, 0],
                rotate: [-4, 4, -3, 3, -4],
            }}
            transition={{
                repeat: Infinity,
                duration,
                delay,
                ease: "easeInOut",
            }}
            className="relative w-10 h-14 rounded-full"
            style={{
                background: `linear-gradient(180deg, ${color} 0%, ${color}aa 48%, ${color}66 100%)`,
                boxShadow: `0 6px 14px rgba(0,0,0,0.55), 0 0 22px ${color}66, inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -6px 12px rgba(0,0,0,0.35)`,
                border: `1px solid ${color}`,
            }}
        >
            {/* Specular highlight so the pill reads as a 3D capsule, not a
                flat pill sticker. */}
            <div
                className="absolute top-[6px] left-[5px] w-[10px] h-[14px] rounded-full opacity-80"
                style={{
                    background: "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
                }}
            />
            {/* Seam band in the middle of the capsule, darker than the shell
                but brighter than the deepest shadow — matches the VibeCapsule
                aesthetic without being literal about it. */}
            <div
                className="absolute left-0 right-0"
                style={{
                    top: "calc(50% - 1px)",
                    height: 2,
                    background: `linear-gradient(90deg, transparent, rgba(0,0,0,0.45), transparent)`,
                }}
            />
        </motion.div>
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
            className="relative rounded-xl p-2 flex flex-col items-center gap-1 text-center"
            title={badge.name}
            style={{
                background: `linear-gradient(180deg, ${tierColor}18, ${tierColor}08)`,
                border: `1px solid ${tierColor}40`,
            }}
        >
            <PinArt badge={badge} tier={reveal.tier} />
            <div className="mt-1 font-display font-black text-[10px] leading-tight text-center w-full break-words line-clamp-2 text-white">
                {badge.name}
            </div>
            <div
                className="text-[8px] font-mundial font-black uppercase tracking-widest text-center"
                style={{ color: tierColor }}
            >
                {TIER_DISPLAY_NAMES[reveal.tier]}
            </div>
            {!isDuplicate && (
                <div
                    className="text-[8px] font-mundial font-black uppercase tracking-widest px-1.5 py-0.5 rounded text-center"
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
