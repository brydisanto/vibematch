"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Badge, TIER_COLORS, TIER_DISPLAY_NAMES } from "@/lib/badges";
import { playSelectSound, playDeselectSound, playUIClick } from "@/lib/sounds";

interface VibeDraftProps {
    pool: Badge[];
    onDraftComplete: (selected: Badge[]) => void;
    onBack: () => void;
}

const MAX_PICKS = 6;

export default function VibeDraft({ pool, onDraftComplete, onBack }: VibeDraftProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleBadge = (badge: Badge) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(badge.id)) {
                next.delete(badge.id);
                playDeselectSound();
            } else if (next.size < MAX_PICKS) {
                next.add(badge.id);
                playSelectSound();
            }
            return next;
        });
    };

    const handleConfirm = () => {
        if (selected.size !== MAX_PICKS) return;
        playUIClick();
        const drafted = pool.filter(b => selected.has(b.id));
        onDraftComplete(drafted);
    };

    const tierCounts = {
        blue: pool.filter(b => selected.has(b.id) && b.tier === "blue").length,
        silver: pool.filter(b => selected.has(b.id) && b.tier === "silver").length,
        gold: pool.filter(b => selected.has(b.id) && b.tier === "gold").length,
        cosmic: pool.filter(b => selected.has(b.id) && b.tier === "cosmic").length,
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
            style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Header */}
            <div className="text-center mb-6">
                <motion.h1
                    className="font-display font-black text-3xl sm:text-4xl tracking-wider uppercase"
                    style={{ color: "#6C5CE7" }}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    Vibe Draft
                </motion.h1>
                <motion.p
                    className="text-white/60 text-sm sm:text-base mt-2"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    Pick {MAX_PICKS} badges to play with
                </motion.p>
                <motion.p
                    className="text-white/40 text-xs mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    Higher tiers score more but appear less on the board
                </motion.p>
            </div>

            {/* Selection counter */}
            <motion.div
                className="flex gap-1.5 mb-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                {Array.from({ length: MAX_PICKS }).map((_, i) => (
                    <div
                        key={i}
                        className="w-3 h-3 rounded-full border transition-all duration-200"
                        style={{
                            borderColor: i < selected.size ? "#6C5CE7" : "rgba(255,255,255,0.2)",
                            backgroundColor: i < selected.size ? "#6C5CE7" : "transparent",
                            boxShadow: i < selected.size ? "0 0 8px rgba(108, 92, 231, 0.6)" : "none",
                        }}
                    />
                ))}
            </motion.div>

            {/* Badge Grid */}
            <div className="grid grid-cols-5 gap-3 sm:gap-4 max-w-md w-full mb-6">
                {pool.map((badge, i) => {
                    const isSelected = selected.has(badge.id);
                    const isDisabled = !isSelected && selected.size >= MAX_PICKS;
                    const tierColor = TIER_COLORS[badge.tier];

                    return (
                        <motion.button
                            key={badge.id}
                            onClick={() => !isDisabled && toggleBadge(badge)}
                            className="relative flex flex-col items-center"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: isDisabled ? 0.35 : 1 }}
                            transition={{ delay: 0.1 + i * 0.04, type: "spring", stiffness: 400, damping: 20 }}
                            whileTap={!isDisabled ? { scale: 0.9 } : undefined}
                        >
                            <div
                                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden transition-all duration-200"
                                style={{
                                    border: `2px solid ${isSelected ? tierColor : "rgba(255,255,255,0.15)"}`,
                                    boxShadow: isSelected
                                        ? `0 0 16px ${tierColor}66, inset 0 0 12px ${tierColor}22`
                                        : "none",
                                    background: isSelected
                                        ? `linear-gradient(135deg, ${tierColor}15, transparent)`
                                        : "rgba(255,255,255,0.05)",
                                }}
                            >
                                <Image
                                    src={badge.image}
                                    alt={badge.name}
                                    fill
                                    className="object-cover p-1"
                                    sizes="64px"
                                />
                                {/* Checkmark overlay */}
                                <AnimatePresence>
                                    {isSelected && (
                                        <motion.div
                                            className="absolute inset-0 flex items-center justify-center"
                                            style={{ background: `${tierColor}33` }}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            <div
                                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                                style={{ background: tierColor, color: "#0a0a1a" }}
                                            >
                                                ✓
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            {/* Badge name + tier */}
                            <span className="text-[10px] sm:text-xs text-white/70 mt-1 truncate max-w-[60px] sm:max-w-[70px] text-center">
                                {badge.name}
                            </span>
                            <span
                                className="text-[9px] font-semibold"
                                style={{ color: tierColor }}
                            >
                                {badge.pointMultiplier}x
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            {/* Tier summary */}
            <motion.div
                className="flex gap-3 mb-6 text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                {(["blue", "silver", "gold", "cosmic"] as const).map(tier => (
                    <div key={tier} className="flex items-center gap-1">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: TIER_COLORS[tier] }}
                        />
                        <span className="text-white/50">
                            {TIER_DISPLAY_NAMES[tier]}:
                        </span>
                        <span
                            className="font-semibold"
                            style={{ color: tierCounts[tier] > 0 ? TIER_COLORS[tier] : "rgba(255,255,255,0.3)" }}
                        >
                            {tierCounts[tier]}
                        </span>
                    </div>
                ))}
            </motion.div>

            {/* Action buttons */}
            <div className="flex gap-3">
                <motion.button
                    onClick={() => { playUIClick(); onBack(); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/20 hover:border-white/40 transition-colors"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    Back
                </motion.button>
                <motion.button
                    onClick={handleConfirm}
                    disabled={selected.size !== MAX_PICKS}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{
                        background: selected.size === MAX_PICKS
                            ? "linear-gradient(135deg, #6C5CE7, #a855f7)"
                            : "rgba(255,255,255,0.1)",
                        color: selected.size === MAX_PICKS ? "white" : "rgba(255,255,255,0.3)",
                        boxShadow: selected.size === MAX_PICKS
                            ? "0 0 20px rgba(108, 92, 231, 0.4)"
                            : "none",
                    }}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    whileTap={selected.size === MAX_PICKS ? { scale: 0.95 } : undefined}
                >
                    {selected.size === MAX_PICKS ? "Start Game" : `${selected.size} / ${MAX_PICKS}`}
                </motion.button>
            </div>
        </motion.div>
    );
}
