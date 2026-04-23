"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getAllTiers, type TierId } from "@/lib/tiers";
import { BADGES } from "@/lib/badges";

interface TierInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Current tier id so the corresponding row can be visually flagged. */
    currentTierId?: TierId;
    /** Current unique-pin count, used for the "you own X / Y" caption. */
    pinsCollected?: number;
}

/**
 * Info modal surfaced when the user taps the TIER pill. Lists every tier
 * band lowest → highest, showing the pin-collection threshold and
 * highlighting the tier the player currently sits in. Read-only — no
 * actions beyond close.
 */
export default function TierInfoModal({
    isOpen,
    onClose,
    currentTierId,
    pinsCollected = 0,
}: TierInfoModalProps) {
    const tiers = getAllTiers();
    const totalBadges = BADGES.length;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    style={{ background: "rgba(6, 2, 14, 0.78)", backdropFilter: "blur(6px)" }}
                >
                    <motion.div
                        className="relative w-full max-w-[420px] rounded-3xl overflow-hidden"
                        initial={{ scale: 0.94, y: 16, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.96, y: 8, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)",
                            border: "1px solid rgba(179, 102, 255, 0.35)",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 60px rgba(179,102,255,0.25)",
                        }}
                    >
                        <div className="relative px-6 pt-6 pb-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>

                            <h2
                                className="font-display font-black uppercase text-[22px] leading-none"
                                style={{
                                    color: "#FFE048",
                                    textShadow: "0 2px 0 rgba(0,0,0,0.5)",
                                }}
                            >
                                Collector Tiers
                            </h2>
                            <p className="text-white/55 text-[12px] leading-snug mt-1.5">
                                Your tier is determined by the % of unique pins you&apos;ve collected.
                                Keep opening capsules to climb.
                            </p>
                            <div
                                className="mt-2 font-display text-[11px] tracking-[0.2em] uppercase"
                                style={{ color: "#B366FFcc" }}
                            >
                                You own {pinsCollected} / {totalBadges} pins
                            </div>
                        </div>

                        <div className="px-6 pb-6 pt-1 flex flex-col gap-2">
                            {tiers.map((t) => {
                                const minCount = Math.ceil((t.minPercent / 100) * totalBadges);
                                const isCurrent = t.id === currentTierId;
                                const isHolo = t.id === "one_of_one";
                                return (
                                    <div
                                        key={t.id}
                                        className={`rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 transition-all relative overflow-hidden ${isHolo ? "tier-holo" : ""}`}
                                        style={{
                                            background: isHolo
                                                ? undefined
                                                : isCurrent
                                                    ? `linear-gradient(180deg, ${t.color}26, ${t.accent}26)`
                                                    : "rgba(255,255,255,0.03)",
                                            border: isHolo
                                                ? "1px solid rgba(255,255,255,0.55)"
                                                : isCurrent
                                                    ? `1px solid ${t.color}99`
                                                    : "1px solid rgba(255,255,255,0.06)",
                                            boxShadow: isHolo
                                                ? "0 0 24px rgba(255,255,255,0.25), inset 0 0 20px rgba(255,255,255,0.12)"
                                                : isCurrent
                                                    ? `0 0 18px ${t.color}40`
                                                    : undefined,
                                        }}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                                            <div
                                                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isHolo ? "tier-holo-dot" : ""}`}
                                                style={
                                                    isHolo
                                                        ? undefined
                                                        : {
                                                            background: t.color,
                                                            boxShadow: `0 0 10px ${t.color}aa`,
                                                        }
                                                }
                                            />
                                            <span
                                                className={`font-display font-black text-[13px] uppercase tracking-[0.08em] truncate ${isHolo ? "tier-holo-text" : ""}`}
                                                style={isHolo ? undefined : { color: t.color }}
                                            >
                                                {t.label}
                                            </span>
                                            {isCurrent && (
                                                <span
                                                    className="font-display text-[8px] font-black uppercase tracking-[0.18em] px-1.5 py-[2px] rounded-sm shrink-0"
                                                    style={{
                                                        color: "#0A0418",
                                                        background: t.color,
                                                    }}
                                                >
                                                    You
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 relative z-10">
                                            <div
                                                className="font-display font-black text-[12px] tabular-nums"
                                                style={{
                                                    color: isHolo ? "#ffffff" : isCurrent ? t.color : "#ffffffaa",
                                                }}
                                            >
                                                {t.minPercent}%+
                                            </div>
                                            <div className="text-[9px] text-white/45 tabular-nums mt-0.5">
                                                {minCount}+ pins
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </motion.div>
            )}
            {/* Holo animation for the One-Of-One tier row. Iridescent
                conic sweep behind the content + animated gradient on the
                label and dot to sell the "rainbow foil" look. */}
            <style jsx global>{`
                .tier-holo {
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
                        conic-gradient(
                            from var(--holo-angle, 0deg),
                            #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff,
                            #84fab0, #fad0c4, #ffdde1, #ff6ad5
                        );
                    background-blend-mode: overlay, normal;
                    animation: tierHoloSpin 6s linear infinite;
                }
                .tier-holo-dot {
                    background: conic-gradient(
                        from 0deg,
                        #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff,
                        #84fab0, #fad0c4, #ffdde1, #ff6ad5
                    );
                    box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
                    animation: tierHoloDotSpin 4s linear infinite;
                }
                .tier-holo-text {
                    background: linear-gradient(
                        90deg,
                        #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff,
                        #84fab0, #fad0c4, #ffdde1, #ff6ad5
                    );
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: transparent;
                    animation: tierHoloShimmer 4s linear infinite;
                    text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
                }
                @keyframes tierHoloSpin {
                    to { --holo-angle: 360deg; }
                }
                @keyframes tierHoloDotSpin {
                    to { transform: rotate(360deg); }
                }
                @keyframes tierHoloShimmer {
                    0% { background-position: 0% center; }
                    100% { background-position: 200% center; }
                }
                @property --holo-angle {
                    syntax: "<angle>";
                    inherits: false;
                    initial-value: 0deg;
                }
            `}</style>
        </AnimatePresence>
    );
}
