"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Zap, Crown } from "lucide-react";

interface LeaderboardEntry {
    username: string;
    score: number;
    avatarUrl: string;
}

interface LeaderboardModalProps {
    onClose: () => void;
    currentUsername?: string;
}

const formatScoreWithCommas = (value: number) => {
    if (value <= 0) return "—";
    return value.toLocaleString();
};

export default function LeaderboardModal({ onClose, currentUsername }: LeaderboardModalProps) {
    const [mode, setMode] = useState<"classic" | "daily">("classic");
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/scores?mode=${mode}`);
                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(data.leaderboard || []);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, [mode]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md rounded-[24px] bg-gradient-to-b from-[#4A3B52] to-[#1A1525] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            >
                {/* Enamel Tray Base */}
                <div className="relative bg-[#110D17] rounded-[21px] p-6 sm:p-8 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden flex flex-col items-center max-h-[80vh]">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] hover:border-white/50 transition-colors z-20"
                    >
                        <X size={16} className="text-white/60 hover:text-white transition-colors" />
                    </button>

                    <h2 className="font-display text-2xl sm:text-3xl font-black text-white mb-6 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center gap-3">
                        <Crown className="text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]" size={28} />
                        Leaderboards
                    </h2>

                    {/* Mode Toggles */}
                    <div className="flex bg-[#1A1525] rounded-xl p-1 mb-6 border border-[#3A3344] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] w-full">
                        <button
                            onClick={() => setMode("classic")}
                            className={`flex-1 py-2 sm:py-3 rounded-lg font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${mode === "classic"
                                ? "bg-gradient-to-b from-[#FFD700] to-[#FF8C00] text-black shadow-[0_2px_8px_rgba(255,215,0,0.4)]"
                                : "text-white/40 hover:text-white/80 hover:bg-white/5"
                                }`}
                        >
                            <Zap size={16} className={mode === "classic" ? "text-black" : "text-white/40"} />
                            Classic
                        </button>
                        <button
                            onClick={() => setMode("daily")}
                            className={`flex-1 py-2 sm:py-3 rounded-lg font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${mode === "daily"
                                ? "bg-gradient-to-b from-[#B366FF] to-[#8A2BE2] text-white shadow-[0_2px_8px_rgba(179,102,255,0.4)]"
                                : "text-white/40 hover:text-white/80 hover:bg-white/5"
                                }`}
                        >
                            <Trophy size={16} className={mode === "daily" ? "text-white" : "text-white/40"} />
                            Daily
                        </button>
                    </div>

                    {/* Scrollable Leaderboard List */}
                    <div className="w-full flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 custom-scrollbar min-h-[350px]">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center items-center h-full">
                                    <div className="w-8 h-8 rounded-full border-2 border-[#B366FF] border-t-transparent animate-spin" />
                                </motion.div>
                            ) : leaderboard.length === 0 ? (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-white/30 text-center">
                                    <Trophy size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold uppercase tracking-widest text-sm">No scores yet</p>
                                    <p className="text-xs mt-2">Be the first to claim the top spot!</p>
                                </motion.div>
                            ) : (
                                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {leaderboard.map((entry, index) => {
                                        const isCurrentUser = entry.username.toLowerCase() === currentUsername?.toLowerCase();
                                        return (
                                            <div
                                                key={`${entry.username}-${index}`}
                                                className={`flex items-center gap-4 p-3 pr-5 rounded-2xl mb-3 border ${isCurrentUser
                                                    ? "bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                                    : "bg-[#1A1525] border-[#3A3344]"
                                                    }`}
                                            >
                                                <div className="flex-shrink-0 w-6 text-center font-black text-white/30 text-base">
                                                    {index + 1}
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-[#2A2333] border border-[#3A3344] overflow-hidden flex items-center justify-center flex-shrink-0">
                                                    {entry.avatarUrl ? (
                                                        <Image src={entry.avatarUrl} alt={entry.username} width={40} height={40} className="object-cover w-full h-full" />
                                                    ) : (
                                                        <span className="text-white/20 font-bold text-xs uppercase">{entry.username.substring(0, 2)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 font-bold text-sm sm:text-base text-white/90 truncate mr-2">
                                                    {entry.username}
                                                </div>
                                                <div className="flex-shrink-0 font-display font-black text-[#FFD700] text-xl sm:text-2xl tracking-[0.05em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                                    {formatScoreWithCommas(entry.score)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}
