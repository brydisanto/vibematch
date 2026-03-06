"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, MousePointerClick, Bomb, Flame, Target } from "lucide-react";
import { TIER_COLORS } from "@/lib/badges";

interface InstructionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TIERS = [
    {
        name: "Common",
        color: TIER_COLORS.blue,
        multiplier: "1×",
        description: "The foundation of your board",
        examples: "Doge, Pepe, Checkmate",
    },
    {
        name: "Uncommon",
        color: TIER_COLORS.silver,
        multiplier: "1.5×",
        description: "A nice score boost",
        examples: "Captain, King, Showtime",
    },
    {
        name: "Gold",
        color: TIER_COLORS.gold,
        multiplier: "2×",
        description: "Rare — doubles your points!",
        examples: "Gold Member, Astro Balls",
    },
    {
        name: "Cosmic",
        color: TIER_COLORS.cosmic,
        multiplier: "3×",
        description: "Legendary — massive score multiplier",
        examples: "Cosmic, Super Rare",
    },
];

const RULES = [
    {
        icon: MousePointerClick,
        color: "#4A9EFF",
        bg: "from-[#4A9EFF]/20 to-[#4A9EFF]/10",
        title: "Select & Swap",
        desc: "Tap a badge, then tap an adjacent one to swap them. Swaps must create a match!",
    },
    {
        icon: Sparkles,
        color: "#FFE048",
        bg: "from-[#FFE048]/20 to-[#FFE048]/10",
        title: "Match 3+",
        desc: "Line up 3 or more identical badges in a row or column to score points.",
    },
    {
        icon: Bomb,
        color: "#FF5F1F",
        bg: "from-[#FF5F1F]/20 to-[#FF5F1F]/10",
        title: "Special Tiles",
        desc: "Match 4 = Bomb (3×3 clear). Match 5 = Cosmic Blast (clears all of one type)!",
    },
    {
        icon: Flame,
        color: "#FF6B9D",
        bg: "from-[#FF6B9D]/20 to-[#FF6B9D]/10",
        title: "Combos",
        desc: "Chain matches cascade into combos. Each combo level adds 50% to your score!",
    },
    {
        icon: Target,
        color: "#B366FF",
        bg: "from-[#B366FF]/20 to-[#B366FF]/10",
        title: "Strategy Wins",
        desc: "You have 30 moves. Target high-tier badges and build combo chains for top scores!",
    },
];

export default function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal */}
                    <motion.div
                        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl bg-[#111] border-2 border-[#c9a84c]"
                        initial={{ scale: 0.85, y: 40, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.85, y: 40, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between p-5 pb-3 bg-[#111] border-b-2 border-[#c9a84c]">
                            <div className="flex items-center gap-2">
                                <Sparkles size={20} className="text-[#FFE048]" />
                                <h2 className="font-display text-xl font-black text-white">
                                    How to Play
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-[#111] border-2 border-[#c9a84c] hover:bg-[#FFE048] hover:border-[#FFE048] flex items-center justify-center transition-all duration-200 group"
                            >
                                <X size={16} className="text-white/70 group-hover:text-black transition-colors" />
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            {/* Game Rules */}
                            <div>
                                <h3 className="font-display text-sm uppercase tracking-wider text-white/50 mb-3 font-bold">
                                    Rules
                                </h3>
                                <div className="space-y-3">
                                    {RULES.map((rule, i) => {
                                        const Icon = rule.icon;
                                        return (
                                            <motion.div
                                                key={i}
                                                className="flex gap-3 items-start"
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.1 + i * 0.05 }}
                                            >
                                                <div
                                                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${rule.bg} flex items-center justify-center flex-shrink-0 border`}
                                                    style={{ borderColor: `${rule.color}30` }}
                                                >
                                                    <Icon size={18} style={{ color: rule.color }} />
                                                </div>
                                                <div>
                                                    <h4 className="font-mundial font-bold text-white text-sm">
                                                        {rule.title}
                                                    </h4>
                                                    <p className="text-white/50 text-xs font-mundial leading-relaxed">
                                                        {rule.desc}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                            {/* Badge Tier Hierarchy */}
                            <div>
                                <h3 className="font-display text-sm uppercase tracking-wider text-white/50 mb-1 font-bold">
                                    Badge Hierarchy
                                </h3>
                                <p className="text-white/40 text-xs font-mundial mb-4">
                                    Higher tier badges = bigger scores. Target them strategically!
                                </p>

                                <div className="space-y-2.5">
                                    {TIERS.map((tier, i) => (
                                        <motion.div
                                            key={tier.name}
                                            className="rounded-xl p-3 flex items-center gap-3"
                                            style={{
                                                background: `linear-gradient(135deg, ${tier.color}15, ${tier.color}08)`,
                                                border: `1px solid ${tier.color}30`,
                                            }}
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.3 + i * 0.08 }}
                                        >
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{
                                                    background: `${tier.color}20`,
                                                    boxShadow: `0 0 20px ${tier.color}30`,
                                                }}
                                            >
                                                <div
                                                    className="w-6 h-6 rounded-full"
                                                    style={{
                                                        background: tier.color,
                                                        boxShadow: `0 0 10px ${tier.color}`,
                                                    }}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span
                                                        className="font-display font-black text-sm"
                                                        style={{ color: tier.color }}
                                                    >
                                                        {tier.name}
                                                    </span>
                                                    <span
                                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mundial"
                                                        style={{
                                                            background: `${tier.color}25`,
                                                            color: tier.color,
                                                        }}
                                                    >
                                                        {tier.multiplier} Points
                                                    </span>
                                                </div>
                                                <p className="text-white/50 text-[11px] font-mundial">
                                                    {tier.description}
                                                </p>
                                                <p className="text-white/30 text-[10px] font-mundial mt-0.5">
                                                    e.g. {tier.examples}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Scoring Formula — Visual treatment */}
                            <div className="rounded-xl p-4 bg-gradient-to-br from-[#FFE048]/10 to-[#FF5F1F]/10 border border-[#FFE048]/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <Zap size={14} className="text-[#FFE048]" />
                                    <span className="font-display text-xs font-bold text-[#FFE048] uppercase tracking-wider">
                                        Scoring Formula
                                    </span>
                                </div>
                                {/* Visual equation */}
                                <div className="flex items-center justify-center gap-2 text-sm font-mundial font-semibold mb-3">
                                    <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white">Base Points</span>
                                    <span className="text-white/40">×</span>
                                    <span className="px-3 py-1.5 rounded-lg bg-[#FFE048]/15 text-[#FFE048] border border-[#FFE048]/20">Tier</span>
                                    <span className="text-white/40">×</span>
                                    <span className="px-3 py-1.5 rounded-lg bg-[#FF5F1F]/15 text-[#FF5F1F] border border-[#FF5F1F]/20">Combo</span>
                                </div>
                                <div className="text-[10px] text-white/40 font-mundial space-y-0.5">
                                    <p>• Match-3 = 100 pts · Match-4 = 300 pts · Match-5 = 600 pts</p>
                                    <p>• Combo bonus: +50% per chain level</p>
                                    <p>• Special tile activations: +200 pts bonus</p>
                                </div>
                            </div>

                            {/* Pro tip */}
                            <div className="rounded-xl p-3 bg-[#B366FF]/10 border border-[#B366FF]/20">
                                <p className="text-xs text-white/60 font-mundial">
                                    <span className="text-[#B366FF] font-bold">💡 Pro Tip:</span>{" "}
                                    Focus on Cosmic and Gold badges for maximum points. Set up chain reactions that cascade into combo multipliers!
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
