"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AchievementUnlockEvent } from "@/lib/useAchievements";

interface AchievementToastProps {
    event: AchievementUnlockEvent | null;
    onDismiss: () => void;
}

export default function AchievementToast({ event, onDismiss }: AchievementToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!event) return;
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 400); // wait for exit animation
        }, 3500);
        return () => clearTimeout(timer);
    }, [event, onDismiss]);

    return (
        <AnimatePresence>
            {visible && event && (
                <motion.div
                    className="fixed top-4 right-4 z-[70] pointer-events-auto"
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onDismiss, 200);
                    }}
                >
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl max-w-[280px] cursor-pointer"
                        style={{
                            background: "linear-gradient(135deg, #3A1061 0%, #21083B 100%)",
                            border: "2px solid rgba(255, 224, 72, 0.7)",
                            boxShadow: "0 0 24px rgba(255, 224, 72, 0.3), 0 8px 24px rgba(0, 0, 0, 0.6)",
                        }}
                    >
                        {/* Icon */}
                        <div className="text-2xl flex-shrink-0">{event.achievement.icon}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black tracking-[0.15em] uppercase text-[#FFE048] font-mundial">
                                Achievement Unlocked
                            </div>
                            <div className="text-white font-bold text-sm leading-tight truncate">
                                {event.achievement.title}
                            </div>
                            <div className="text-[#B399D4] text-[11px] leading-tight truncate">
                                {event.achievement.description}
                            </div>
                        </div>

                        {/* Capsule reward */}
                        <div className="flex items-center gap-1 flex-shrink-0 bg-white/10 rounded-lg px-2 py-1">
                            <span className="text-sm">💊</span>
                            <span className="text-[#FFE048] text-xs font-black">×{event.capsules}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
