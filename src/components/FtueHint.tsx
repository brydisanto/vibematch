"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { ArrowLeftRight, Bomb, Zap, Sparkles } from "lucide-react";

export type HintKind = "firstMove" | "bomb" | "vibestreak" | "capsule";

interface FtueHintProps {
    kind: HintKind;
    onDismiss: () => void;
}

const CONFIG: Record<
    HintKind,
    {
        label: string;
        title: string;
        body: string;
        gradient: string;
        accent: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Icon: React.ComponentType<any>;
    }
> = {
    firstMove: {
        label: "Tip",
        title: "Swap two adjacent badges",
        body: "Line up 3 of the same badge — horizontal or vertical.",
        gradient: "linear-gradient(135deg, #4A9EFF, #B366FF)",
        accent: "#4A9EFF",
        Icon: ArrowLeftRight,
    },
    bomb: {
        label: "New! Bomb",
        title: "Bomb tile earned",
        body: "Tap twice to detonate. Clears a 3×3 area.",
        gradient: "linear-gradient(135deg, #FF8A4C, #FF5722)",
        accent: "#FF8A4C",
        Icon: Bomb,
    },
    vibestreak: {
        label: "New! Vibestreak",
        title: "Vibestreak tile earned",
        body: "Tap twice to clear the whole row and column.",
        gradient: "linear-gradient(135deg, #B366FF, #6C5CE7)",
        accent: "#B366FF",
        Icon: Zap,
    },
    capsule: {
        label: "Capsule!",
        title: "Pin capsule earned",
        body: "Keep scoring — or check your Pin Book after.",
        gradient: "linear-gradient(135deg, #FFD700, #B8860B)",
        accent: "#FFD700",
        Icon: Sparkles,
    },
};

export default function FtueHint({ kind, onDismiss }: FtueHintProps) {
    const cfg = CONFIG[kind];
    const Icon = cfg.Icon;

    // Auto-dismiss after 3.5s (slightly longer now that there's more to read)
    useEffect(() => {
        const t = setTimeout(onDismiss, 3500);
        return () => clearTimeout(t);
    }, [onDismiss]);

    return (
        <motion.div
            className="fixed inset-x-0 top-[25%] z-[55] flex justify-center px-4 pointer-events-none"
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
            <motion.button
                onClick={onDismiss}
                className="pointer-events-auto w-full max-w-[380px] rounded-2xl border-2 px-4 py-4 text-left flex items-center gap-4"
                style={{
                    background: "rgba(10,1,20,0.97)",
                    borderColor: cfg.accent,
                    boxShadow: `0 14px 40px rgba(0,0,0,0.7), 0 0 24px ${cfg.accent}33`,
                }}
                whileTap={{ scale: 0.98 }}
            >
                <div
                    className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{
                        background: cfg.gradient,
                        boxShadow: `0 4px 12px ${cfg.accent}66`,
                    }}
                >
                    <Icon size={22} color="white" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        className="text-[10px] font-mundial font-black tracking-[0.22em] uppercase mb-0.5"
                        style={{ color: cfg.accent }}
                    >
                        {cfg.label}
                    </div>
                    <div className="text-white text-[15px] font-mundial font-bold leading-tight">
                        {cfg.title}
                    </div>
                    <div className="text-white/65 text-[12px] font-mundial leading-snug mt-1">
                        {cfg.body}
                    </div>
                </div>
            </motion.button>
        </motion.div>
    );
}
