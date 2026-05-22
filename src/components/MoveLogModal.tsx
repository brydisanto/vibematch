"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ScrollText, Flame, Zap, Star, Bomb, Sparkles, Layers, Trophy, ChevronDown } from "lucide-react";
import { MoveLogEntry, SpecialTileType } from "@/lib/gameEngine";
import { TIER_COLORS, TIER_DISPLAY_NAMES } from "@/lib/badges";
import { useMemo, useState } from "react";

interface MoveLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    moveLog: MoveLogEntry[];
    totalScore: number;
    /** When true, the modal renders in a "post-game" tone (no live
     *  "what's the score now?" framing, just a summary). Pure cosmetic. */
    isPostGame?: boolean;
}

const SHAPE_LABEL: Record<NonNullable<MoveLogEntry['shapeBonus']>, string> = {
    L: "L SHAPE",
    T: "T SHAPE",
    cross: "CROSS",
};

function SpecialIcon({ type, size = 11 }: { type: SpecialTileType; size?: number }) {
    if (type === "bomb") return <Bomb size={size} className="text-red-400" />;
    if (type === "vibestreak") return <Zap size={size} className="text-cyan-300" />;
    return <Sparkles size={size} className="text-purple-300" />;
}

function MoveRow({ entry, expanded, onToggle, isTopMove }: {
    entry: MoveLogEntry;
    expanded: boolean;
    onToggle: () => void;
    isTopMove: boolean;
}) {
    const tierColor = entry.topTier ? TIER_COLORS[entry.topTier] : "rgba(255,255,255,0.3)";
    const tierLabel = entry.topTier ? TIER_DISPLAY_NAMES[entry.topTier] : null;
    const isBig = entry.pointsGained >= 800;
    const isHuge = entry.pointsGained >= 2000;

    return (
        <motion.button
            type="button"
            onClick={onToggle}
            className="w-full text-left rounded-xl px-3 py-2 flex flex-col gap-1 transition-colors"
            style={{
                background: isHuge
                    ? "linear-gradient(135deg, rgba(255,224,72,0.10), rgba(179,102,255,0.06))"
                    : isBig
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.025)",
                border: isHuge
                    ? "1px solid rgba(255,224,72,0.35)"
                    : "1px solid rgba(255,255,255,0.06)",
            }}
            whileTap={{ scale: 0.99 }}
        >
            <div className="flex items-center gap-2.5 w-full min-w-0">
                {/* Move # */}
                <div
                    className="flex-shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center font-display font-black"
                    style={{
                        background: "rgba(179, 102, 255, 0.12)",
                        border: "1px solid rgba(179, 102, 255, 0.2)",
                    }}
                >
                    <span className="text-[10px] text-white/40 leading-none font-mundial">#</span>
                    <span className="text-[13px] text-white leading-none mt-[1px]">{entry.moveNum}</span>
                </div>

                {/* Tier swatch — what badge dominated */}
                <div
                    className="flex-shrink-0 w-3.5 h-3.5 rounded-sm"
                    style={{
                        background: tierColor,
                        boxShadow: `0 0 6px ${tierColor}66`,
                    }}
                    aria-hidden
                />

                {/* Points */}
                <div className="flex-1 min-w-0">
                    <div
                        className="font-display font-black leading-none truncate"
                        style={{
                            color: isHuge ? "#FFE048" : isBig ? "#FFE048" : "#fff",
                            fontSize: isHuge ? 19 : isBig ? 17 : 15,
                            textShadow: isHuge ? "0 0 10px rgba(255,224,72,0.5)" : undefined,
                        }}
                    >
                        +{entry.pointsGained.toLocaleString()}
                    </div>
                    {/* Inline modifier chips */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {entry.maxCombo >= 2 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#FF5F1F] font-bold font-mundial">
                                <Flame size={10} />×{entry.maxCombo}
                            </span>
                        )}
                        {entry.cascadeCount >= 1 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#4A9EFF] font-bold font-mundial">
                                <Layers size={10} />{entry.cascadeCount}
                            </span>
                        )}
                        {entry.shapeBonus && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#B366FF] font-bold font-mundial">
                                <Star size={10} />{SHAPE_LABEL[entry.shapeBonus]}
                            </span>
                        )}
                        {entry.specialsCreated.map((s, i) => (
                            <span key={`c-${i}`} className="inline-flex items-center gap-0.5 text-[10px] text-white/70 font-bold font-mundial">
                                <SpecialIcon type={s} />+
                            </span>
                        ))}
                        {entry.specialsTriggered.map((s, i) => (
                            <span key={`t-${i}`} className="inline-flex items-center gap-0.5 text-[10px] text-white/70 font-bold font-mundial">
                                <SpecialIcon type={s} />!
                            </span>
                        ))}
                    </div>
                </div>

                {/* Top-3 trophy */}
                {isTopMove && (
                    <div
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                            background: "rgba(255, 224, 72, 0.18)",
                            border: "1px solid rgba(255, 224, 72, 0.4)",
                        }}
                        title="Top move"
                    >
                        <Trophy size={11} className="text-[#FFE048]" />
                    </div>
                )}

                {/* Expand chevron */}
                <ChevronDown
                    size={14}
                    className="text-white/30 flex-shrink-0 transition-transform"
                    style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                />
            </div>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden w-full"
                    >
                        {/* Two-column grid; each row is "label: value" with a
                            tight gap so the value sits right next to the label
                            instead of stretching to the far edge of the card. */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 pt-2 border-t border-white/5 text-[11px] font-mundial justify-center">
                            <div className="flex items-baseline gap-1.5 justify-center">
                                <span className="text-white/40">Matches:</span>
                                <span className="text-white/90 font-bold">{entry.matchesFound}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 justify-center">
                                <span className="text-white/40">Cascades:</span>
                                <span className="text-white/90 font-bold">{entry.cascadeCount}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 justify-center">
                                <span className="text-white/40">Combo peak:</span>
                                <span className="text-white/90 font-bold">×{Math.max(1, entry.maxCombo)}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 justify-center min-w-0">
                                <span className="text-white/40 flex-shrink-0">Badge tier:</span>
                                <span
                                    className="font-bold truncate"
                                    style={{ color: tierColor }}
                                    title={entry.topTierName ?? undefined}
                                >
                                    {tierLabel ?? "—"}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
}

export default function MoveLogModal({ isOpen, onClose, moveLog, totalScore, isPostGame = false }: MoveLogModalProps) {
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    // Top-3 indices by points (for trophy highlight)
    const topMoveIndices = useMemo(() => {
        const indexed = moveLog.map((e, i) => ({ pts: e.pointsGained, i }));
        indexed.sort((a, b) => b.pts - a.pts);
        return new Set(indexed.slice(0, 3).filter(e => e.pts > 0).map(e => e.i));
    }, [moveLog]);

    const stats = useMemo(() => {
        if (moveLog.length === 0) return { avg: 0, biggest: null as MoveLogEntry | null, longestChain: 0 };
        const sum = moveLog.reduce((s, e) => s + e.pointsGained, 0);
        const biggest = moveLog.reduce<MoveLogEntry | null>((best, e) => (!best || e.pointsGained > best.pointsGained) ? e : best, null);
        const longestChain = moveLog.reduce((m, e) => Math.max(m, e.cascadeCount), 0);
        return { avg: Math.round(sum / moveLog.length), biggest, longestChain };
    }, [moveLog]);

    // Show newest first so the latest action is on top.
    const display = useMemo(() => [...moveLog].reverse(), [moveLog]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/85"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Sheet */}
                    <motion.div
                        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl overflow-hidden"
                        style={{
                            background: "linear-gradient(165deg, #1a0a30 0%, #110321 30%, #21083B 70%, #1a0a30 100%)",
                            border: "1.5px solid rgba(179, 102, 255, 0.25)",
                            boxShadow:
                                "0 0 60px rgba(179, 102, 255, 0.12), 0 0 120px rgba(179, 102, 255, 0.06), 0 25px 50px rgba(0, 0, 0, 0.5)",
                        }}
                        initial={{ scale: 0.88, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.88, y: 30, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0"
                            style={{ borderBottom: "1px solid rgba(179, 102, 255, 0.12)" }}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: "linear-gradient(135deg, #B366FF25, #B366FF10)",
                                        boxShadow: "0 0 12px #B366FF15",
                                    }}
                                >
                                    <ScrollText size={16} className="text-[#FFE048]" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="font-display text-lg font-black text-white leading-tight">
                                        Move Breakdown
                                    </h2>
                                    <p className="text-white/40 text-[10px] font-mundial tracking-wider">
                                        {moveLog.length} {moveLog.length === 1 ? "MOVE" : "MOVES"} · {totalScore.toLocaleString()} PTS
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group hover:scale-110 flex-shrink-0"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                }}
                                aria-label="Close"
                            >
                                <X size={15} className="text-white/50 group-hover:text-white transition-colors" />
                            </button>
                        </div>

                        {/* Rollup stats */}
                        {moveLog.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5 px-4 pt-3 pb-2 flex-shrink-0">
                                <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    <div className="text-[9px] text-white/40 font-mundial tracking-wider">AVG / MOVE</div>
                                    <div className="font-display font-black text-white text-sm mt-0.5">{stats.avg.toLocaleString()}</div>
                                </div>
                                <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    <div className="text-[9px] text-white/40 font-mundial tracking-wider">BEST MOVE</div>
                                    <div className="font-display font-black text-[#FFE048] text-sm mt-0.5">
                                        {stats.biggest ? `+${stats.biggest.pointsGained.toLocaleString()}` : "—"}
                                    </div>
                                </div>
                                <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    <div className="text-[9px] text-white/40 font-mundial tracking-wider">LONGEST CHAIN</div>
                                    <div className="font-display font-black text-[#4A9EFF] text-sm mt-0.5">{stats.longestChain || "—"}</div>
                                </div>
                            </div>
                        )}

                        {/* List */}
                        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 min-h-0">
                            {moveLog.length === 0 ? (
                                <div className="text-center py-12 text-white/30 text-sm font-mundial">
                                    {isPostGame ? "No moves played." : "No moves yet — make your first match."}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {display.map((entry, displayIdx) => {
                                        // Logical index in original moveLog (for expansion state)
                                        const originalIdx = moveLog.length - 1 - displayIdx;
                                        return (
                                            <MoveRow
                                                key={originalIdx}
                                                entry={entry}
                                                expanded={expandedIdx === originalIdx}
                                                onToggle={() => setExpandedIdx(prev => prev === originalIdx ? null : originalIdx)}
                                                isTopMove={topMoveIndices.has(originalIdx)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer legend — only show if list is non-empty */}
                        {moveLog.length > 0 && (
                            <div
                                className="px-4 py-2.5 flex-shrink-0 text-[9px] font-mundial text-white/30 flex flex-wrap items-center gap-x-3 gap-y-1 justify-center"
                                style={{ borderTop: "1px solid rgba(179, 102, 255, 0.08)" }}
                            >
                                <span className="inline-flex items-center gap-1"><Flame size={9} className="text-[#FF5F1F]" /> COMBO</span>
                                <span className="inline-flex items-center gap-1"><Layers size={9} className="text-[#4A9EFF]" /> CASCADE</span>
                                <span className="inline-flex items-center gap-1"><Star size={9} className="text-[#B366FF]" /> SHAPE</span>
                                <span className="inline-flex items-center gap-1"><Bomb size={9} className="text-red-400" />/<Zap size={9} className="text-cyan-300" />/<Sparkles size={9} className="text-purple-300" /> POWER</span>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
