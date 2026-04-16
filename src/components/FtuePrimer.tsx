"use client";

import { motion } from "framer-motion";

interface FtuePrimerProps {
    onContinue: () => void;
    onSkip: () => void;
}

export default function FtuePrimer({ onContinue, onSkip }: FtuePrimerProps) {
    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            <motion.div
                className="absolute inset-0 bg-black/85"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />
            <motion.div
                className="relative w-full max-w-md rounded-[20px] border border-[#B366FF]/30 px-6 pt-8 pb-6 text-center"
                style={{
                    background: "linear-gradient(180deg, #1a0428 0%, #0a0114 100%)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
                <div
                    className="absolute top-[-12px] left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-[24px] text-[10px] font-mundial font-extrabold tracking-[0.2em] uppercase text-white"
                    style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
                >
                    Welcome
                </div>

                <h2 className="text-[#FFD700] text-[22px] font-display font-extrabold uppercase tracking-wide mt-2 mb-2">
                    Here&apos;s the loop
                </h2>
                <p className="text-white/60 text-[13px] font-mundial leading-relaxed mb-5">
                    Three things to know before you play.
                </p>

                <div className="flex flex-col gap-3.5 mb-5">
                    <PrimerStep num={1} text="Match badges to rack up" strong="score" />
                    <PrimerStep num={2} text="Hit" strong="15K+" tail="to earn capsules" />
                    <PrimerStep num={3} text="Open capsules to collect" strong="pins" />
                </div>

                <button
                    onClick={onContinue}
                    className="w-full py-3.5 rounded-[14px] font-mundial font-extrabold text-[13px] uppercase tracking-[0.1em] text-[#2A1810] active:scale-[0.98] transition-transform"
                    style={{
                        background: "linear-gradient(135deg, #FFD700, #FFA500)",
                        boxShadow: "0 4px 14px rgba(255,165,0,0.25)",
                    }}
                >
                    Let&apos;s go
                </button>
                <button
                    onClick={onSkip}
                    className="w-full mt-2 py-2.5 text-[11px] font-mundial font-semibold uppercase tracking-[0.1em] text-white/50 hover:text-white/80 transition-colors"
                >
                    Skip
                </button>
            </motion.div>
        </motion.div>
    );
}

function PrimerStep({ num, text, strong, tail }: { num: number; text: string; strong: string; tail?: string }) {
    return (
        <div className="flex items-center gap-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3">
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-display font-extrabold text-[13px] text-white"
                style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
            >
                {num}
            </div>
            <div className="text-[13px] font-mundial text-white/90 leading-snug text-left">
                {text} <strong className="text-[#FFD700] font-bold">{strong}</strong>
                {tail ? ` ${tail}` : null}
            </div>
        </div>
    );
}
