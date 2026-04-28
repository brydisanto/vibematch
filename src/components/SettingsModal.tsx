"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Zap, ZapOff } from "lucide-react";
import { useEffect, useState } from "react";
import { isMuted, toggleMute } from "@/lib/sounds";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function ToggleRow({
    icon,
    label,
    description,
    value,
    onChange,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10 last:border-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#C48CFF]">
                    {icon}
                </div>
                <div>
                    <div className="text-white font-black text-sm tracking-wide font-mundial">{label}</div>
                    <div className="text-white/40 text-[11px] font-mundial">{description}</div>
                </div>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${value ? "bg-[#B366FF]" : "bg-white/20"}`}
            >
                <motion.div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                    animate={{ left: value ? "calc(100% - 22px)" : "2px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            </button>
        </div>
    );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [soundEnabled, setSoundEnabled] = useState(!isMuted);
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("vibematch_reduce_motion");
        if (stored === "true") setReduceMotion(true);
    }, []);

    const handleSoundToggle = (enabled: boolean) => {
        setSoundEnabled(enabled);
        toggleMute(!enabled);
    };

    const handleReduceMotion = (enabled: boolean) => {
        setReduceMotion(enabled);
        localStorage.setItem("vibematch_reduce_motion", String(enabled));
        document.documentElement.classList.toggle("reduce-motion", enabled);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-50 bg-black/85"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    >
                        <div
                            className="pointer-events-auto w-full max-w-sm rounded-2xl overflow-hidden"
                            style={{
                                background: "linear-gradient(180deg, #3A1061 0%, #21083B 50%, #110321 100%)",
                                boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(179,102,255,0.4), 0 0 40px rgba(156,101,240,0.2)",
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                                <div>
                                    <h2 className="font-display text-xl font-black text-white tracking-wide">Settings</h2>
                                    <p className="text-white/40 text-[11px] font-mundial mt-0.5">Customize your Pin Drop experience</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                    <X size={16} className="text-white/60" />
                                </button>
                            </div>

                            {/* Settings */}
                            <div className="px-5 py-2">
                                <ToggleRow
                                    icon={soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                    label="Sound"
                                    description="Music and sound effects"
                                    value={soundEnabled}
                                    onChange={handleSoundToggle}
                                />
                                <ToggleRow
                                    icon={reduceMotion ? <ZapOff size={16} /> : <Zap size={16} />}
                                    label="Reduce Motion"
                                    description="Simplify animations for accessibility"
                                    value={reduceMotion}
                                    onChange={handleReduceMotion}
                                />
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-4 mt-1 border-t border-white/10 flex items-center justify-between">
                                <span className="text-white/25 text-[10px] font-mundial uppercase tracking-widest">Pin Drop v1.0</span>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl bg-[#B366FF] hover:bg-[#C48CFF] text-white text-sm font-black font-mundial transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
