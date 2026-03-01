"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";
import { BADGES } from "@/lib/badges";
import { Zap, Trophy, HelpCircle, ChevronRight, User, Crown } from "lucide-react";
import ProfileModal from "./ProfileModal";
import LeaderboardModal from "./LeaderboardModal";
import { toast } from "react-hot-toast";
import { GameMode } from "@/lib/gameEngine";

interface LandingPageProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
}

/* ===== FLOATING BADGES (UPWARD STREAM) ===== */
function FloatingBadges() {
    const [items, setItems] = useState<
        {
            id: number;
            image: string;
            x: number; // horizontal percentage
            yStart: number; // vertical start percentage (below screen)
            yEnd: number; // vertical end percentage (above screen)
            size: number;
            rotation: number;
            rotationEnd: number;
            duration: number;
            delay: number;
        }[]
    >([]);

    useEffect(() => {
        // Extreme density badge fill
        const pooledBadges = Array(15).fill(BADGES).flat();
        // Shuffle to distribute them randomly
        const selected = pooledBadges.sort(() => Math.random() - 0.5).slice(0, 320);

        const newItems = selected.map((badge, i) => {
            const rot = Math.random() * 360;
            return {
                id: i,
                image: badge.image,
                x: Math.random() * 120 - 10, // -10% to 110% width
                yStart: 110 + Math.random() * 100, // Start somewhere below the fold, spread out
                yEnd: -40 - Math.random() * 40, // End well above the fold
                size: 60 + Math.random() * 220, // Even more diverse scale for depth feeling
                rotation: rot, // Start looking rotated randomly
                rotationEnd: rot + (Math.random() > 0.5 ? 90 : -90),
                duration: 20 + Math.random() * 40, // Very slow to moderately slow rise
                delay: -(Math.random() * 60), // Negative delay so the screen is pre-filled on load!
            };
        });
        setItems(newItems);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#160d24]"> {/* Deep dark purple base */}
            <style>{`
                @keyframes floatUpAndSpin {
                    0% {
                        transform: translateY(var(--y-start)) rotate(var(--rot-start));
                    }
                    100% {
                        transform: translateY(var(--y-end)) rotate(var(--rot-end));
                    }
                }
                .floating-badge {
                    animation: floatUpAndSpin var(--duration) linear var(--delay) infinite;
                    will-change: transform;
                }
            `}</style>
            {items.map((item) => (
                <div
                    key={item.id}
                    className="absolute pointer-events-none floating-badge"
                    style={{
                        left: `${item.x}%`,
                        width: item.size,
                        height: item.size,
                        '--y-start': `${item.yStart}vh`,
                        '--y-end': `${item.yEnd}vh`,
                        '--rot-start': `${item.rotation}deg`,
                        '--rot-end': `${item.rotationEnd}deg`,
                        '--duration': `${item.duration}s`,
                        '--delay': `${item.delay}s`,
                    } as React.CSSProperties}
                >
                    <Image
                        src={item.image}
                        alt=""
                        width={item.size}
                        height={item.size}
                        className="rounded-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] object-cover"
                    />
                </div>
            ))}
            {/* Soft, dark center vignette so the text remains legible over the bright badges */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(circle at center, rgba(16,10,25,0.1) 15%, rgba(16,10,25,0.3) 60%, rgba(16,10,25,0.6) 100%)",
                }}
            />
        </div>
    );
}

export default function LandingPage({ onStartGame, onShowInstructions }: LandingPageProps) {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    useEffect(() => {
        const savedUsername = localStorage.getItem('vibematch_username');
        if (savedUsername) {
            setUsername(savedUsername);
            fetch(`/api/profiles?username=${savedUsername}`)
                .then(res => res.json())
                .then(data => {
                    if (data.profile) setAvatarUrl(data.profile.avatarUrl);
                })
                .catch(err => console.error(err));
        }
    }, []);

    const handleProfileSave = async (newUsername: string, newAvatarUrl: string) => {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername, avatarUrl: newAvatarUrl })
            });
            if (res.ok) {
                setUsername(newUsername);
                setAvatarUrl(newAvatarUrl);
                localStorage.setItem('vibematch_username', newUsername);
                toast.success('Profile saved!');
            } else {
                toast.error('Failed to save profile on database.');
            }
        } catch (e) {
            toast.error('Network error saving profile.');
        }
    };

    const handleStartDaily = async () => {
        if (!username) {
            toast.error("Set a profile first to play Daily Challenge!");
            setIsProfileModalOpen(true);
            return;
        }
        try {
            const res = await fetch(`/api/daily-status?username=${username}`);
            const data = await res.json();
            if (data.playedToday) {
                toast.error("You already played the Daily Challenge today! Come back tomorrow.");
                return;
            }
            onStartGame("daily", username, avatarUrl);
        } catch (e) {
            toast.error("Failed to check daily status. Try again.");
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12">
            <FloatingBadges />

            <div className="relative z-10 w-full max-w-lg text-center">
                {/* Logo Lockup */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="flex items-center justify-center">
                        <Image
                            src="/assets/logo-v2.png"
                            alt="VIBE MATCH Logo"
                            width={320}
                            height={160}
                            className="drop-shadow-[0_10px_30px_rgba(255,224,72,0.3)] hover:scale-105 transition-transform duration-300 w-[240px] sm:w-[320px] h-auto max-w-full"
                            priority
                        />
                    </div>
                </motion.div>

                {/* Mode Cards — each with distinct personality */}
                <motion.div
                    className="flex flex-col gap-3 -mt-6"
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                >
                    {/* Classic Mode */}
                    <button
                        onClick={() => onStartGame("classic", username, avatarUrl)}
                        className="group w-full text-left outline-none"
                    >
                        <div
                            className="relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-1 group-active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#2A2333] to-[#1A1525] p-[3px] shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                        >
                            {/* Inner Enamel Area */}
                            <div className="relative bg-[#110D17] rounded-[17px] p-5 sm:p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden">

                                {/* Glow layer (Classic Yellow) */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/10 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 group-hover:bg-[#FFD700]/20 transition-colors duration-500" />
                                <div className="relative flex items-center justify-between z-10 w-full pt-1">
                                    <div className="flex flex-col items-start justify-center">
                                        <h2 className="font-display text-xl sm:text-2xl font-black text-white mb-2">
                                            Classic
                                        </h2>
                                        <p className="text-white/50 text-xs sm:text-sm font-mundial pr-4 leading-relaxed text-left">
                                            30 moves. Score as high as possible. Pure strategy.
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 shrink-0 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] group-hover:border-[#FFD700]/50 transition-colors">
                                        <ChevronRight size={16} className="text-white/40 group-hover:text-[#FFD700] transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Daily Challenge */}
                    <button
                        onClick={handleStartDaily}
                        className="group w-full text-left outline-none"
                    >
                        <div
                            className="relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-1 group-active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#2A2333] to-[#1A1525] p-[3px] shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                        >
                            {/* Inner Enamel Area */}
                            <div className="relative bg-[#110D17] rounded-[17px] p-5 sm:p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden">

                                {/* Glow layer (Daily Purple) */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#B366FF]/10 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 group-hover:bg-[#B366FF]/20 transition-colors duration-500" />
                                <div className="relative flex items-center justify-between z-10 w-full pt-1">
                                    <div className="flex flex-col items-start justify-center">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="font-display text-xl sm:text-2xl font-black text-white">
                                                Daily Challenge
                                            </h2>
                                            <span className="px-2 py-0.5 rounded-full bg-[#B366FF]/20 border border-[#B366FF]/30 text-[#B366FF] text-[10px] font-bold uppercase tracking-wider font-mundial">
                                                New
                                            </span>
                                        </div>
                                        <p className="text-white/50 text-xs sm:text-sm font-mundial pr-4 leading-relaxed text-left">
                                            Same board for everyone. One shot to top the daily leaderboard.
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 shrink-0 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] group-hover:border-[#B366FF]/50 transition-colors">
                                        <ChevronRight size={16} className="text-white/40 group-hover:text-[#B366FF] transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </button>
                </motion.div>

                {/* Bottom Action Row */}
                <motion.div
                    className="mt-6 flex flex-col gap-3 w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                >
                    <div className="flex gap-3 w-full">
                        {/* Set Profile — Enamel Pin Style (Silver/Blue) */}
                        <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="flex-1 group relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#8E9EAA] to-[#5C6B77] p-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                        >
                            <div className="relative h-full bg-[#B0BCC5] rounded-[17px] py-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-2px_6px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 overflow-hidden border border-[#5C6B77]/50">
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/50 to-transparent mix-blend-overlay pointer-events-none" />

                                <User size={18} className="relative z-10 text-[#3A4A57] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors" />
                                <span className="relative z-10 text-[13px] sm:text-[15px] font-black tracking-widest text-[#3A4A57] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors uppercase">
                                    {username ? 'Profile' : 'Set Profile'}
                                </span>
                            </div>
                        </button>

                        {/* How to Play — Enamel Pin Style (Gold) */}
                        <button
                            onClick={onShowInstructions}
                            className="flex-1 group relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#E5C941] to-[#D4B32A] p-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                        >
                            {/* Enamel Fill */}
                            <div className="relative h-full bg-[#FFE048] rounded-[17px] py-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-2px_6px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 overflow-hidden border border-[#D4B32A]/50">

                                {/* Specular Highlight Base */}
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent mix-blend-overlay pointer-events-none" />
                                {/* Sparkle dots */}
                                <div className="absolute w-2 h-2 top-2 right-4 bg-white/60 rounded-full blur-[1px] animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                                <div className="absolute w-1.5 h-1.5 bottom-2 left-4 bg-white/50 rounded-full blur-[1px] animate-ping pointer-events-none" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />

                                <HelpCircle size={18} className="relative z-10 text-[#5C4D0A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors" />
                                <span className="relative z-10 text-[13px] sm:text-[15px] font-black tracking-widest text-[#5C4D0A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors uppercase">
                                    How to Play
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Leaderboards */}
                    <button
                        onClick={() => setIsLeaderboardOpen(true)}
                        className="group relative w-full overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#B366FF] to-[#8A2BE2] p-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                    >
                        <div className="relative bg-[#9C4EEB] rounded-[17px] py-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-2px_6px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 overflow-hidden border border-[#8A2BE2]/50">

                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent mix-blend-overlay pointer-events-none" />

                            <Crown size={18} className="relative z-10 text-white drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-[#FFD700] transition-colors" />
                            <span className="relative z-10 text-[15px] font-black tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] uppercase">
                                Leaderboards
                            </span>
                        </div>
                    </button>
                </motion.div>


            </div>

            {isProfileModalOpen && (
                <ProfileModal
                    currentUsername={username}
                    currentAvatarUrl={avatarUrl}
                    onSave={handleProfileSave}
                    onClose={() => setIsProfileModalOpen(false)}
                />
            )}

            {isLeaderboardOpen && (
                <LeaderboardModal
                    currentUsername={username}
                    onClose={() => setIsLeaderboardOpen(false)}
                />
            )}
        </div>
    );
}
