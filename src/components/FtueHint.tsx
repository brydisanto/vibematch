"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

export type HintKind = "firstMove" | "bomb" | "vibestreak" | "capsule";

interface FtueHintProps {
    kind: HintKind;
    onDismiss: () => void;
}

const CONFIG: Record<HintKind, { label: string; title: string; body: string; gradient: string }> = {
    firstMove: {
        label: "Tip",
        title: "Swap two adjacent badges",
        body: "Line up 3 of the same badge — horizontal or vertical — to make a match.",
        gradient: "linear-gradient(135deg, #4A9EFF, #B366FF)",
    },
    bomb: {
        label: "New! Bomb",
        title: "Bomb tile earned",
        body: "Tap twice to detonate. Clears a 3×3 area.",
        gradient: "linear-gradient(135deg, #FF8A4C, #FF5722)",
    },
    vibestreak: {
        label: "New! Vibestreak",
        title: "Vibestreak tile earned",
        body: "Tap twice to clear the whole row and column.",
        gradient: "linear-gradient(135deg, #B366FF, #6C5CE7)",
    },
    capsule: {
        label: "Capsule!",
        title: "Pin capsule earned",
        body: "Keep scoring — or check your Pin Book after.",
        gradient: "linear-gradient(135deg, #FFD700, #B8860B)",
    },
};

export default function FtueHint({ kind, onDismiss }: FtueHintProps) {
    const cfg = CONFIG[kind];

    // Auto-dismiss after 3s
    useEffect(() => {
        const t = setTimeout(onDismiss, 3000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    return (
        <motion.div
            className="fixed inset-x-0 top-[88px] z-[55] flex justify-center px-4 pointer-events-none"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
        >
            <motion.button
                onClick={onDismiss}
                className="pointer-events-auto max-w-[320px] w-full rounded-[14px] border px-4 py-3 text-left flex items-start gap-3"
                style={{
                    background: "rgba(10,1,20,0.97)",
                    borderColor: kind === "capsule" ? "#FFD700" : kind === "bomb" ? "#FF5722" : kind === "firstMove" ? "#4A9EFF" : "#B366FF",
                    boxShadow: "0 10px 36px rgba(0,0,0,0.7)",
                }}
                whileTap={{ scale: 0.98 }}
            >
                <div
                    className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5"
                    style={{ background: cfg.gradient }}
                />
                <div className="flex-1">
                    <div
                        className="text-[10px] font-display font-extrabold tracking-[0.2em] uppercase mb-0.5"
                        style={{ color: kind === "capsule" ? "#FFD700" : kind === "bomb" ? "#FF8A4C" : kind === "firstMove" ? "#4A9EFF" : "#B366FF" }}
                    >
                        {cfg.label}
                    </div>
                    <div className="text-white text-[13px] font-mundial font-semibold leading-snug">
                        {cfg.title}
                    </div>
                    <div className="text-white/60 text-[11px] font-mundial leading-snug mt-0.5">
                        {cfg.body}
                    </div>
                </div>
            </motion.button>
        </motion.div>
    );
}
