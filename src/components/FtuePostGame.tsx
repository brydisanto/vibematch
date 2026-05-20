"use client";

import { motion } from "framer-motion";

export type FtuePostGameVariant = "capsule" | "tryAgain";

interface FtuePostGameProps {
    variant: FtuePostGameVariant;
    score: number;
    onPrimary: () => void;
    onSecondary: () => void;
}

export default function FtuePostGame({ variant, score, onPrimary, onSecondary }: FtuePostGameProps) {
    const isCapsule = variant === "capsule";

    return (
        <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
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
                    className="absolute top-[-12px] left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-[24px] text-[10px] font-mundial font-extrabold tracking-[0.2em] uppercase"
                    style={{
                        background: isCapsule
                            ? "linear-gradient(135deg, #FFD700, #B8860B)"
                            : "linear-gradient(135deg, #B366FF, #6C5CE7)",
                        color: isCapsule ? "#2A1810" : "#fff",
                    }}
                >
                    {isCapsule ? "First Capsule" : "So close"}
                </div>

                {isCapsule ? (
                    <>
                        <h2 className="text-[#FFD700] text-[22px] font-display font-extrabold uppercase tracking-wide mt-2 mb-2">
                            You just earned a Capsule!
                        </h2>
                        <p className="text-white/60 text-[13px] font-mundial leading-relaxed mb-6">
                            Rip it open to reveal your first pin. It lives in your Pin Book forever.
                        </p>
                        <button
                            onClick={onPrimary}
                            className="w-full py-3.5 rounded-[14px] font-mundial font-extrabold text-[13px] uppercase tracking-[0.1em] text-[#2A1810] active:scale-[0.98] transition-transform"
                            style={{
                                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                                boxShadow: "0 4px 14px rgba(255,165,0,0.25)",
                            }}
                        >
                            Show Me
                        </button>
                        <button
                            onClick={onSecondary}
                            className="w-full mt-2 py-2.5 text-[11px] font-mundial font-semibold uppercase tracking-[0.1em] text-white/50 hover:text-white/80 transition-colors"
                        >
                            Play Again
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-[#FFD700] text-[22px] font-display font-extrabold uppercase tracking-wide mt-2 mb-2">
                            You scored {score.toLocaleString()}!
                        </h2>
                        <p className="text-white/60 text-[13px] font-mundial leading-relaxed mb-6">
                            Hit 15K+ next time, that&rsquo;s when Pin Capsules start dropping!
                            Special tiles (4-match, 5-match) boost your score fast.
                        </p>
                        <button
                            onClick={onPrimary}
                            className="w-full py-3.5 rounded-[14px] font-mundial font-extrabold text-[13px] uppercase tracking-[0.1em] text-[#2A1810] active:scale-[0.98] transition-transform"
                            style={{
                                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                                boxShadow: "0 4px 14px rgba(255,165,0,0.25)",
                            }}
                        >
                            Play Again
                        </button>
                        <button
                            onClick={onSecondary}
                            className="w-full mt-2 py-2.5 text-[11px] font-mundial font-semibold uppercase tracking-[0.1em] text-white/50 hover:text-white/80 transition-colors"
                        >
                            Home
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}
