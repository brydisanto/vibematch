"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface FtuePrimerProps {
    onContinue: () => void;
    onSkip: () => void;
}

const CITIZEN_BADGE = "/badges/any_gvc_1759173799963.webp";

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
                className="relative w-full max-w-md rounded-2xl border border-[#B366FF]/30 px-6 pt-8 pb-6 text-center"
                style={{
                    background: "linear-gradient(180deg, #1a0428 0%, #0a0114 100%)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
                <div
                    className="absolute top-[-12px] left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-mundial font-black tracking-[0.2em] uppercase text-white"
                    style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
                >
                    Welcome
                </div>

                <h2
                    className="font-display text-xl sm:text-2xl font-black text-[#FFE048] uppercase leading-tight mt-2 mb-2"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                >
                    Here&apos;s the Loop
                </h2>

                {/* Match-3 demo scene — three Citizen of Vibetown badges */}
                <div className="relative my-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4 overflow-hidden">
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: "radial-gradient(circle at 50% 50%, rgba(255,224,72,0.12), transparent 65%)",
                        }}
                    />
                    <div className="relative flex justify-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                className="relative w-[54px] h-[54px] rounded-[10px] overflow-hidden"
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1.5px solid rgba(255,224,72,0.5)",
                                    boxShadow: "0 0 16px rgba(255,224,72,0.3)",
                                }}
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 400, damping: 22 }}
                            >
                                <Image
                                    src={CITIZEN_BADGE}
                                    alt="Citizen of Vibetown"
                                    fill
                                    sizes="54px"
                                    className="object-cover"
                                />
                            </motion.div>
                        ))}
                    </div>
                    <div className="relative mt-2.5 text-[10px] font-mundial font-bold uppercase tracking-[0.2em] text-[#FFE048]/70">
                        Match 3+ to score
                    </div>
                </div>

                <div className="flex flex-col gap-2.5 mb-5">
                    <PrimerStep num={1} text="Match badges to rack up" strong="score" />
                    <PrimerStep num={2} text="Hit" strong="15K+" tail="to earn capsules" />
                    <PrimerStep num={3} text="Open capsules to collect" strong="pins" />
                </div>

                <button
                    onClick={onContinue}
                    className="w-full py-3 rounded-lg font-black font-mundial uppercase tracking-wider transition-all bg-[#FFE048] text-black hover:bg-[#FFE858] active:scale-95"
                >
                    Let&apos;s go
                </button>
                <button
                    onClick={onSkip}
                    className="w-full mt-2 py-2 text-white/40 hover:text-white/70 text-xs font-mundial tracking-wider uppercase transition-colors"
                >
                    Skip
                </button>
            </motion.div>
        </motion.div>
    );
}

function PrimerStep({ num, text, strong, tail }: { num: number; text: string; strong: string; tail?: string }) {
    return (
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-display font-black text-[13px] text-white"
                style={{ background: "linear-gradient(135deg, #B366FF, #6C5CE7)" }}
            >
                {num}
            </div>
            <div className="text-[13px] font-mundial text-white/90 leading-snug text-left">
                {text} <strong className="text-[#FFE048] font-bold">{strong}</strong>
                {tail ? ` ${tail}` : null}
            </div>
        </div>
    );
}
