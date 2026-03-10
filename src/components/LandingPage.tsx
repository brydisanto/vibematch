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
    onLogout?: () => void;
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
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const count = isMobile ? 55 : 120; // Increased density after removing drop-shadows

        // Extreme density badge fill
        const pooledBadges = Array(15).fill(BADGES).flat();
        // Shuffle to distribute them randomly
        const selected = pooledBadges.sort(() => Math.random() - 0.5).slice(0, count);

        const newItems = selected.map((badge, i) => {
            const rot = Math.random() * 360;
            return {
                id: i,
                image: badge.image,
                x: Math.random() * 120 - 10, // -10% to 110% width
                yStart: 110 + Math.random() * 100, // Start somewhere below the fold, spread out
                yEnd: -40 - Math.random() * 40, // End well above the fold
                size: 60 + Math.random() * (isMobile ? 100 : 220), // Smaller max size on mobile
                rotation: rot, // Start looking rotated randomly
                rotationEnd: rot + (Math.random() > 0.5 ? 90 : -90),
                duration: 20 + Math.random() * 40, // Very slow to moderately slow rise
                delay: -(Math.random() * 60), // Negative delay so the screen is pre-filled on load!
            };
        });
        requestAnimationFrame(() => {
            setItems(newItems);
        });
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#7B3FA8]"> {/* Rich purple base matching production */}
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
                        className="rounded-full shadow-2xl shadow-black/60 object-cover"
                        loading="lazy"
                    />
                </div>
            ))}
            {/* Very subtle vignette - keep background bright like production */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(circle at center, transparent 30%, rgba(100,50,140,0.15) 100%)",
                }}
            />
        </div>
    );
}

import AuthModal from "./AuthModal";
import { LogOut } from "lucide-react";

export default function LandingPage({ onStartGame, onShowInstructions, onLogout }: LandingPageProps) {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    useEffect(() => {
        // Check session instead of just localStorage
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data.authenticated) {
                    setIsLoggedIn(true);
                    setUsername(data.user.username);
                    setAvatarUrl(data.user.avatarUrl);
                    localStorage.setItem('vibematch_username', data.user.username);
                } else {
                    setIsLoggedIn(false);
                    // Legacy fallback for guests if they have a local username
                    const savedUsername = localStorage.getItem('vibematch_username');
                    if (savedUsername) {
                        setUsername(savedUsername);
                        fetch(`/api/profiles?username=${savedUsername}`)
                            .then(res => res.json())
                            .then(d => {
                                if (d.profile) setAvatarUrl(d.profile.avatarUrl);
                            })
                            .catch(err => console.error("Could not fetch legacy profile"));
                    }
                }
            })
            .catch(err => console.error("Session check error:", err));
    }, []);

    // SILENT PRELOADER: aggressively fetch all game piece images into browser cache 
    // while the user is sitting on the landing page so the board loads instantly!
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Slight delay so we don't block the initial HTML page render
            const timer = setTimeout(() => {
                BADGES.forEach(badge => {
                    const img = new window.Image();
                    img.src = badge.image;
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAuthSuccess = (newUsername: string, newAvatarUrl: string) => {
        setIsLoggedIn(true);
        setUsername(newUsername);
        setAvatarUrl(newAvatarUrl);
        localStorage.setItem('vibematch_username', newUsername);
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setIsLoggedIn(false);
            setUsername("");
            setAvatarUrl("");
            localStorage.removeItem('vibematch_username');
            toast.success("Logged out");
            onLogout?.();
        } catch (e) {
            toast.error("Logout failed");
        }
    };

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
        if (!isLoggedIn) {
            toast.error("Login to play Daily Challenge!");
            setIsAuthModalOpen(true);
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
        <div className="relative min-h-screen flex flex-col items-center justify-start px-4 pt-[8vh] pb-6">
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
                            className="relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-1 group-active:translate-y-0.5 rounded-2xl border-[3px] border-[#B0DFF0] shadow-[0_4px_20px_rgba(168,219,232,0.5),0_8px_25px_rgba(0,0,0,0.15)]"
                        >
                            <div className="relative bg-gradient-to-b from-[#E8F4F8] to-[#D5EDF5] rounded-xl px-5 py-3 sm:px-6 sm:py-4 overflow-hidden">
                                <div className="relative flex items-center justify-between z-10 w-full">
                                    <div className="flex flex-col items-start justify-center">
                                        <h2 className="font-display text-xl sm:text-2xl font-black text-[#2A5F6F] mb-1 uppercase">
                                            Classic VibeMatch
                                        </h2>
                                        <p className="text-[#6B7B82] text-xs sm:text-sm font-mundial pr-4 leading-relaxed text-left">
                                            30 moves to score as high as you can.
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 shrink-0 rounded-full bg-[#C5E4ED]/60 flex items-center justify-center border border-[#A8DBE8] group-hover:bg-[#C5E4ED] transition-colors">
                                        <ChevronRight size={18} className="text-[#5A9AAA] group-hover:text-[#2A5F6F] transition-colors" />
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
                            className="relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-1 group-active:translate-y-0.5 rounded-2xl border-[3px] border-[#D8B8F0] shadow-[0_4px_20px_rgba(212,176,232,0.5),0_8px_25px_rgba(0,0,0,0.15)]"
                        >
                            <div className="relative bg-gradient-to-b from-[#F3E8F9] to-[#E8D5F3] rounded-xl px-5 py-3 sm:px-6 sm:py-4 overflow-hidden">
                                <div className="relative flex items-center justify-between z-10 w-full">
                                    <div className="flex flex-col items-start justify-center">
                                        <h2 className="font-display text-xl sm:text-2xl font-black text-[#5B2D6E] mb-1 uppercase">
                                            THE DAILY CHALLENGE
                                        </h2>
                                        <p className="text-[#7B6B88] text-xs sm:text-sm font-mundial pr-4 leading-relaxed text-left">
                                            Same board for everyone. 1 shot to stoke it to the max!
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 shrink-0 rounded-full bg-[#E8D0F0]/60 flex items-center justify-center border border-[#D4B0E8] group-hover:bg-[#E8D0F0] transition-colors">
                                        <ChevronRight size={18} className="text-[#9A6BAA] group-hover:text-[#5B2D6E] transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* $VIBESTR RUSH — Coming Soon */}
                    <div className="group w-full text-left outline-none cursor-not-allowed">
                        <div className="relative overflow-hidden rounded-2xl">
                            <div className="relative bg-[#9B6AAE]/50 backdrop-blur-sm rounded-2xl px-5 py-3 sm:px-6 sm:py-4 overflow-hidden">
                                <div className="relative flex items-center justify-between z-10 w-full">
                                    <h2 className="font-display text-xl sm:text-2xl font-black text-white/50 uppercase">
                                        <em>$VIBESTR RUSH</em>
                                    </h2>
                                    <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white/50 text-[10px] font-bold uppercase tracking-wider font-mundial">
                                        Coming Soon
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Bottom Action Row */}
                <motion.div
                    className="mt-6 flex flex-col gap-3 w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                >
                    <div className="flex gap-3 w-full">
                        {/* Profile/Login Button — Enamel Pin Style (Silver/Blue) */}
                        <button
                            onClick={() => isLoggedIn ? setIsProfileModalOpen(true) : setIsAuthModalOpen(true)}
                            className="flex-1 group relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#8E9EAA] to-[#5C6B77] p-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                        >
                            <div className="relative h-full bg-[#B0BCC5] rounded-[17px] py-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-2px_6px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 overflow-hidden border border-[#5C6B77]/50">
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/50 to-transparent mix-blend-overlay pointer-events-none" />

                                <User size={18} className="relative z-10 text-[#3A4A57] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors" />
                                <span className="relative z-10 text-[13px] sm:text-[15px] font-black tracking-widest text-[#3A4A57] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors uppercase">
                                    {isLoggedIn ? "Profile" : "Login"}
                                </span>
                            </div>
                        </button>

                        {/* How to Play — Enamel Pin Style (Gold) */}
                        <button
                            onClick={onShowInstructions}
                            className="flex-1 group relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-[20px] bg-gradient-to-b from-[#E5C941] to-[#D4B32A] p-[3px] shadow-[0_10px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                        >
                            <div className="relative h-full bg-[#FFE048] rounded-[17px] py-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-2px_6px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 overflow-hidden border border-[#D4B32A]/50">
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent mix-blend-overlay pointer-events-none" />
                                <HelpCircle size={18} className="relative z-10 text-[#5C4D0A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors" />
                                <span className="relative z-10 text-[13px] sm:text-[15px] font-black tracking-widest text-[#5C4D0A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors uppercase">
                                    Rules
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

                    {/* Logout Button (Hidden if guest) */}
                    {isLoggedIn && (
                        <button
                            onClick={handleLogout}
                            className="mt-4 text-white/40 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-all flex items-center justify-center gap-2 hover:gap-3"
                        >
                            <LogOut size={12} />
                            <span>Sign Out of VibeMatch</span>
                        </button>
                    )}
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

            {isAuthModalOpen && (
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                    onSuccess={handleAuthSuccess}
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

