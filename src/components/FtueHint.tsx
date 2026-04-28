"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { ArrowLeftRight, Bomb, Zap, Stars, X } from "lucide-react";

export type HintKind = "firstMove" | "bomb" | "vibestreak" | "cosmicBlast";

interface FtueHintProps {
    kind: HintKind;
    onDismiss: () => void;
}

const CONFIG: Record<
    HintKind,
    {
        label: string | null;
        title: string;
        body: string;
        gradient: string;
        accent: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Icon: React.ComponentType<any>;
    }
> = {
    firstMove: {
        label: null,
        title: "Swap two adjacent pins",
        body: "Line up 3 of the same pin in a row to make a match, either horizontal or vertical.",
        gradient: "linear-gradient(135deg, #4A9EFF, #B366FF)",
        accent: "#4A9EFF",
        Icon: ArrowLeftRight,
    },
    bomb: {
        label: "New!",
        title: "Bomb Tile Unlocked",
        body: "For matching 4 in a row. Tap twice to detonate, it clears a 3×3 area.",
        gradient: "linear-gradient(135deg, #FF8A4C, #FF5722)",
        accent: "#FF8A4C",
        Icon: Bomb,
    },
    vibestreak: {
        label: "New!",
        title: "Laser Party Tile Unlocked",
        body: "For matching 5 in a row. Tap twice to clear the whole row and column.",
        gradient: "linear-gradient(135deg, #4A9EFF, #4AE0FF)",
        accent: "#4A9EFF",
        Icon: Zap,
    },
    cosmicBlast: {
        label: "New!",
        title: "Cosmic Blast Tile Unlocked",
        body: "For matching 6 in a row. Tap twice to clear every tile of the same type on the board.",
        gradient: "linear-gradient(135deg, #FF6BCB, #B366FF)",
        accent: "#E080FF",
        Icon: Stars,
    },
};

export default function FtueHint({ kind, onDismiss }: FtueHintProps) {
    const cfg = CONFIG[kind];
    const Icon = cfg.Icon;

    // Auto-dismiss after 3s. Player can also tap the X to close immediately.
    useEffect(() => {
        const t = setTimeout(onDismiss, 3000);
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
            <motion.div
                className="pointer-events-auto relative w-full max-w-[380px] rounded-2xl border-2 px-4 py-4 flex items-center gap-4"
                style={{
                    background: "rgba(10,1,20,0.97)",
                    borderColor: cfg.accent,
                    boxShadow: `0 14px 40px rgba(0,0,0,0.7), 0 0 24px ${cfg.accent}33`,
                }}
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
                <div className="flex-1 min-w-0 pr-5">
                    {cfg.label && (
                        <div
                            className="text-[10px] font-mundial font-black tracking-[0.22em] uppercase mb-0.5"
                            style={{ color: cfg.accent }}
                        >
                            {cfg.label}
                        </div>
                    )}
                    <div className="text-white text-[15px] font-mundial font-bold leading-tight">
                        {cfg.title}
                    </div>
                    <div className="text-white/65 text-[12px] font-mundial leading-snug mt-1">
                        {cfg.body}
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    aria-label="Dismiss hint"
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 active:scale-90 transition-all"
                >
                    <X size={14} strokeWidth={2.4} />
                </button>
            </motion.div>
        </motion.div>
    );
}
