"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    JOURNEY_ACHIEVEMENTS,
    MASTERY_ACHIEVEMENTS,
    ALL_ACHIEVEMENTS,
    type AchievementDef,
} from "@/lib/achievements";

interface AchievementsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    unlocked: Record<string, { unlockedAt: string }>;
}

type Tab = "journey" | "mastery";

export default function AchievementsPanel({ isOpen, onClose, unlocked }: AchievementsPanelProps) {
    const [activeTab, setActiveTab] = useState<Tab>("journey");

    const totalUnlocked = Object.keys(unlocked).length;
    const totalAchievements = ALL_ACHIEVEMENTS.length;
    const journeyUnlocked = JOURNEY_ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
    const masteryUnlocked = MASTERY_ACHIEVEMENTS.filter(a => unlocked[a.id]).length;

    const achievements = activeTab === "journey" ? JOURNEY_ACHIEVEMENTS : MASTERY_ACHIEVEMENTS;

    // For Journey: find the next unlockable (first non-unlocked)
    const nextJourneyIndex = JOURNEY_ACHIEVEMENTS.findIndex(a => !unlocked[a.id]);

    function getState(a: AchievementDef): "completed" | "current" | "locked" {
        if (unlocked[a.id]) return "completed";
        if (a.category === "journey") {
            const idx = JOURNEY_ACHIEVEMENTS.indexOf(a);
            return idx === nextJourneyIndex ? "current" : "locked";
        }
        return "locked";
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/85"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
                        style={{
                            background: "linear-gradient(180deg, #2D0B4E 0%, #1A0633 50%, #110321 100%)",
                            border: "1px solid rgba(179, 102, 255, 0.3)",
                            boxShadow: "0 0 60px rgba(179, 102, 255, 0.15), 0 16px 48px rgba(0, 0, 0, 0.7)",
                        }}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className="px-5 pt-5 pb-3 border-b border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-white font-black text-xl tracking-wide">Achievements</h2>
                                <button
                                    onClick={onClose}
                                    className="text-white/40 hover:text-white/80 transition-colors text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Progress bar */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${(totalUnlocked / totalAchievements) * 100}%`,
                                            background: "linear-gradient(90deg, #B366FF, #FFE048)",
                                        }}
                                    />
                                </div>
                                <span className="text-[#B399D4] text-xs font-bold whitespace-nowrap">
                                    {totalUnlocked}/{totalAchievements}
                                </span>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                                <TabButton
                                    label="Journey"
                                    count={`${journeyUnlocked}/${JOURNEY_ACHIEVEMENTS.length}`}
                                    active={activeTab === "journey"}
                                    onClick={() => setActiveTab("journey")}
                                />
                                <TabButton
                                    label="Mastery"
                                    count={`${masteryUnlocked}/${MASTERY_ACHIEVEMENTS.length}`}
                                    active={activeTab === "mastery"}
                                    onClick={() => setActiveTab("mastery")}
                                />
                            </div>
                        </div>

                        {/* Achievement list */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                            {achievements.map(a => (
                                <AchievementCard
                                    key={a.id}
                                    achievement={a}
                                    state={getState(a)}
                                />
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function TabButton({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                active
                    ? "bg-[#B366FF]/20 text-white"
                    : "text-white/40 hover:text-white/60"
            }`}
            style={active ? { boxShadow: "inset 0 0 12px rgba(179, 102, 255, 0.15)" } : {}}
        >
            <span>{label}</span>
            <span className="ml-1.5 text-[10px] text-[#B399D4]">{count}</span>
        </button>
    );
}

function AchievementCard({
    achievement,
    state,
}: {
    achievement: AchievementDef;
    state: "completed" | "current" | "locked";
}) {
    const isCompleted = state === "completed";
    const isLocked = state === "locked";

    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                isCompleted
                    ? "bg-[#FFE048]/[0.06]"
                    : state === "current"
                    ? "bg-[#B366FF]/[0.08]"
                    : "bg-white/[0.02]"
            }`}
            style={{
                border: isCompleted
                    ? "1px solid rgba(255, 224, 72, 0.3)"
                    : state === "current"
                    ? "1px solid rgba(179, 102, 255, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                opacity: isLocked ? 0.45 : 1,
            }}
        >
            {/* Icon */}
            <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
                    isLocked ? "grayscale" : ""
                }`}
                style={{
                    background: isCompleted
                        ? "rgba(255, 224, 72, 0.12)"
                        : "rgba(179, 102, 255, 0.1)",
                }}
            >
                {isLocked ? "🔒" : achievement.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {achievement.category === "journey" && (
                        <span className="text-[9px] font-black tracking-wider text-[#B366FF] bg-[#B366FF]/10 px-1.5 py-0.5 rounded">
                            {achievement.order}
                        </span>
                    )}
                    <span className={`text-sm font-bold leading-tight ${isCompleted ? "text-[#FFE048]" : "text-white"}`}>
                        {achievement.title}
                    </span>
                </div>
                <div className="text-[#B399D4] text-xs leading-tight mt-0.5">
                    {achievement.description}
                </div>
            </div>

            {/* Reward / Status */}
            <div className="flex-shrink-0">
                {isCompleted ? (
                    <div className="w-7 h-7 rounded-full bg-[#FFE048]/20 flex items-center justify-center">
                        <span className="text-[#FFE048] text-sm">✓</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                        <span className="text-xs">💊</span>
                        <span className="text-[#FFE048]/70 text-[11px] font-bold">×{achievement.capsules}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
