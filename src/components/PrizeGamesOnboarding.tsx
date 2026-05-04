"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface PrizeGamesOnboardingProps {
    isOpen: boolean;
    onClose: () => void;
    onBuy: () => void;
    variant: "running-low" | "capped";
    remaining: number;
}

export default function PrizeGamesOnboarding({ isOpen, onClose, onBuy, variant, remaining }: PrizeGamesOnboardingProps) {
    const isCapped = variant === "capped";

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative rounded-2xl p-[3px] max-w-sm w-full shadow-2xl"
                        style={{
                            background: "linear-gradient(180deg, #FFE048 0%, #c9a84c 40%, #8B6914 100%)",
                            boxShadow: "0 2px 0 #8B6914, 0 8px 25px rgba(0,0,0,0.6)",
                        }}
                    >
                        <div className="rounded-[13px] p-6 relative overflow-hidden" style={{
                            background: "linear-gradient(180deg, #2A1A0A 0%, #1A1005 100%)",
                        }}>
                            {/* Gloss */}
                            <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{
                                background: "linear-gradient(180deg, rgba(255,224,72,0.08) 0%, transparent 100%)",
                            }} />

                            <button
                                onClick={onClose}
                                className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors z-10"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>

                            <div className="relative z-10 text-center">
                                {/* Shaka icon with wiggle */}
                                <motion.img
                                    src="/assets/gvc_shaka.png"
                                    alt=""
                                    className="w-16 h-16 mx-auto mb-3 object-contain"
                                    animate={{ rotate: [0, -12, 12, -8, 8, -4, 4, 0] }}
                                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                                />

                                {/* Headline */}
                                <h2 className="font-display text-xl sm:text-2xl font-black text-[#FFE048] uppercase leading-tight mb-2" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                    {isCapped
                                        ? "All out of prize runs!"
                                        : remaining === 1
                                            ? "Down to your last stoke"
                                            : `${remaining} prize runs left today`}
                                </h2>

                                {/* Body */}
                                <p className="text-white/70 text-sm font-mundial leading-relaxed mb-5">
                                    {isCapped ? (
                                        <>
                                            You just hit your daily play cap. Grab bonus games with <strong className="text-[#FFE048]">$VIBESTR</strong> for additional gameplay throughput today.
                                        </>
                                    ) : (
                                        <>
                                            Running low on plays? Grab bonus games with <strong className="text-[#FFE048]">$VIBESTR</strong> for additional gameplay throughput today.
                                        </>
                                    )}
                                </p>

                                {/* Value props */}
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-5 text-left space-y-1.5">
                                    <div className="flex items-center gap-2 text-[11px] text-white/60 font-mundial">
                                        <span className="text-[#FFE048]">✓</span>
                                        <span>Grab a 1, 5, or 10-pack</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-white/60 font-mundial">
                                        <span className="text-[#FFE048]">✓</span>
                                        <span>10-pack is max value — save 50%</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-white/60 font-mundial">
                                        <span className="text-[#FFE048]">✓</span>
                                        <span>Free games refresh at midnight UTC</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <button
                                    onClick={onBuy}
                                    className="w-full py-3 rounded-lg font-black font-mundial uppercase tracking-wider transition-all bg-[#FFE048] text-black hover:bg-[#FFE858] active:scale-95"
                                >
                                    Buy with $VIBESTR
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full mt-2 py-2 text-white/40 hover:text-white/70 text-xs font-mundial tracking-wider uppercase transition-colors"
                                >
                                    Not right now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
