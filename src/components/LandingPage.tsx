"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BADGES } from "@/lib/badges";
import { HelpCircle, ChevronRight, User, Crown, BookOpen, Trophy } from "lucide-react";
import ProfileModal from "./ProfileModal";
import LeaderboardModal from "./LeaderboardModal";
import { toast } from "react-hot-toast";
import { GameMode } from "@/lib/gameEngine";

interface LandingPageProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
    onLogout?: () => void;
    onOpenPinBook?: () => void;
    onOpenAchievements?: () => void;
    onOpenBuyPrizeGames?: () => void;
    capsuleCount?: number;
    achievementCount?: number;
    classicPlays?: number;
    bonusPrizeGames?: number;
    pinsCollected?: number;
    referralCode?: string | null;
    userProfile?: { username: string; avatarUrl: string } | null;
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

/* ===== DAILY COUNTDOWN HOOK ===== */
function formatCountdown() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

function useDailyCountdown() {
    const [countdown, setCountdown] = useState(formatCountdown);
    useEffect(() => {
        const timer = setInterval(() => setCountdown(formatCountdown()), 1000);
        return () => clearInterval(timer);
    }, []);
    return countdown;
}

export default function LandingPage({ onStartGame, onShowInstructions, onLogout, onOpenPinBook, onOpenAchievements, onOpenBuyPrizeGames, capsuleCount = 0, achievementCount = 0, classicPlays = 0, bonusPrizeGames = 0, pinsCollected = 0, referralCode, userProfile }: LandingPageProps) {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(!!userProfile);
    const [username, setUsername] = useState(userProfile?.username || "");
    const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || "");
    const [streak, setStreak] = useState<number>(0);
    const dailyCountdown = useDailyCountdown();
    const notifyRef = useRef(false);

    // Sync with parent's userProfile prop (no duplicate session fetch)
    useEffect(() => {
        if (userProfile) {
            setIsLoggedIn(true);
            setUsername(userProfile.username);
            setAvatarUrl(userProfile.avatarUrl);
            // Fetch streak in background (lightweight)
            fetch(`/api/streak?username=${userProfile.username}`)
                .then(r => r.json())
                .then(s => { if (s.streak > 0) setStreak(s.streak); })
                .catch(() => { });
        } else {
            setIsLoggedIn(false);
            // Legacy fallback for guests
            const savedUsername = localStorage.getItem('vibematch_username');
            if (savedUsername) {
                setUsername(savedUsername);
            }
        }
    }, [userProfile]);

    // SILENT PRELOADER: aggressively fetch all game piece images into browser cache 
    // Preload game-board badge images while on the landing page.
    // Only preload non-collectOnly badges (the ones that appear on the board),
    // and preload both raw + Next.js optimized URLs for cache warmth.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const timer = setTimeout(() => {
            const gameBadges = BADGES.filter(b => !b.collectOnly);
            const seen = new Set<string>();
            gameBadges.forEach(badge => {
                if (seen.has(badge.image)) return;
                seen.add(badge.image);
                // Raw URL
                const img1 = new window.Image();
                img1.src = badge.image;
                // Next.js optimized URL (matches what GameBoard renders at ~96px)
                const img2 = new window.Image();
                img2.src = `/_next/image?url=${encodeURIComponent(badge.image)}&w=96&q=75`;
            });
        }, 800);
        return () => clearTimeout(timer);
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

    const handleNotifyMe = () => {
        if (notifyRef.current || localStorage.getItem('vibematch_rush_notify')) {
            toast("You're already on the list!", { icon: "✅" });
            return;
        }
        notifyRef.current = true;
        localStorage.setItem('vibematch_rush_notify', 'true');
        toast.success("We'll let you know when $VIBESTR RUSH drops!");
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
        <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-6">
            <FloatingBadges />

            <div className="relative z-10 w-full max-w-lg text-center">
                {/* Logo Lockup — gentle bob */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="flex items-center justify-center">
                        <motion.div
                            animate={{ y: [0, -7, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                        >
                            <Image
                                src="/assets/logo.png"
                                alt="VIBE MATCH Logo"
                                width={1000}
                                height={627}
                                className="drop-shadow-[0_10px_30px_rgba(255,224,72,0.3)] hover:scale-105 transition-transform duration-300 w-[240px] sm:w-[320px] h-auto max-w-full mx-auto block"
                                priority
                            />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Mode Cards — staggered entrance */}
                <div className="flex flex-col gap-3 mt-8">
                    {/* Classic Mode */}
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.35, duration: 0.45, type: "spring", stiffness: 200, damping: 20 }}
                    >
                        <button
                            onClick={() => onStartGame("classic", username, avatarUrl)}
                            className="group w-full text-left outline-none"
                        >
                            <div
                                className="relative overflow-visible transition-all duration-300 transform group-hover:-translate-y-1 group-active:translate-y-0.5 rounded-2xl p-[3px]"
                                style={{
                                    background: "linear-gradient(180deg, #FFE048 0%, #c9a84c 40%, #8B6914 100%)",
                                    boxShadow: "0 2px 0 #8B6914, 0 4px 8px rgba(0,0,0,0.5), 0 8px 25px rgba(0,0,0,0.4)",
                                }}
                            >
                                <div className="relative rounded-xl px-5 py-3 sm:px-6 sm:py-4 overflow-hidden" style={{
                                    background: "linear-gradient(180deg, #2A1A0A 0%, #1A1005 100%)",
                                }}>
                                    {/* Gloss reflection */}
                                    <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none z-0" style={{
                                        background: "linear-gradient(180deg, rgba(255,224,72,0.08) 0%, transparent 100%)",
                                    }} />
                                    <div className="relative flex items-center justify-between z-10 w-full">
                                        <div className="flex flex-col items-start justify-center">
                                            <h2 className="font-display text-xl sm:text-2xl font-black text-[#FFE048] mb-0.5 uppercase" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                                Classic VibeMatch
                                            </h2>
                                            <p className="text-white/60 text-xs sm:text-sm font-mundial pr-4 leading-relaxed text-left">
                                                30 moves to score as high as you can.
                                            </p>
                                        </div>
                                        <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{
                                            background: "linear-gradient(180deg, #FFE048 0%, #c9a84c 100%)",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                                        }}>
                                            <ChevronRight size={18} className="text-[#1A0633]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </motion.div>

                    {/* Daily Challenge */}
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.45, type: "spring", stiffness: 200, damping: 20 }}
                    >
                        <button
                            onClick={handleStartDaily}
                            className="group w-full text-left outline-none"
                        >
                            <div
                                className="relative overflow-visible transition-all duration-300 transform group-hover:-translate-y-1 group-active:translate-y-0.5 rounded-2xl p-[3px]"
                                style={{
                                    background: "linear-gradient(180deg, #D8A0FF 0%, #B366FF 40%, #6B1FC0 100%)",
                                    boxShadow: "0 2px 0 #4A1A80, 0 4px 8px rgba(0,0,0,0.5), 0 8px 25px rgba(0,0,0,0.4)",
                                }}
                            >
                                <div className="relative rounded-xl px-5 py-3 sm:px-6 sm:py-4 overflow-hidden" style={{
                                    background: "linear-gradient(180deg, #1A0A2E 0%, #110520 100%)",
                                }}>
                                    {/* Gloss reflection */}
                                    <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none z-0" style={{
                                        background: "linear-gradient(180deg, rgba(179,102,255,0.08) 0%, transparent 100%)",
                                    }} />
                                    <div className="relative flex items-center justify-between z-10 w-full">
                                        <div className="flex flex-col items-start justify-center">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h2 className="font-display text-xl sm:text-2xl font-black text-[#B366FF] uppercase leading-[1]" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                                    THE DAILY CHALLENGE
                                                </h2>
                                                {streak > 0 && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#FF7832]/12 border border-[#FF7832]/25 text-[#FF7832] text-[11px] font-black font-mundial inline-flex items-center gap-1">
                                                        🔥{streak}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-white/60 text-xs sm:text-sm font-mundial leading-relaxed text-left">
                                                Same board for everyone. 1 shot to stoke it to the max!
                                            </p>
                                        </div>
                                        <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{
                                            background: "linear-gradient(180deg, #D8A0FF 0%, #B366FF 100%)",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                                        }}>
                                            <ChevronRight size={18} className="text-[#1A0633]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </motion.div>

                    {/* Prize Games + Daily Reset — side by side info boxes */}
                    <motion.div
                            className="grid grid-cols-2 gap-2.5"
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.65, duration: 0.45, type: "spring", stiffness: 200, damping: 20 }}
                        >
                            {(() => {
                                const BASE_CAP = 10;
                                const totalCap = BASE_CAP + bonusPrizeGames;
                                const remaining = Math.max(0, totalCap - classicPlays);
                                const capped = remaining === 0;
                                const pct = totalCap > 0 ? (remaining / totalCap) * 100 : 0;
                                return (
                                    <button
                                        onClick={isLoggedIn ? onOpenBuyPrizeGames : undefined}
                                        disabled={!isLoggedIn}
                                        className="relative rounded-xl p-[2px] overflow-hidden text-left transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:active:scale-100 disabled:cursor-not-allowed"
                                        style={{
                                            background: "linear-gradient(180deg, #A0A0A8 0%, #707078 40%, #45454D 100%)",
                                            boxShadow: "0 2px 0 #2A2A30, 0 3px 6px rgba(0,0,0,0.5)",
                                        }}
                                    >
                                        <div className="rounded-[10px] px-4 py-3 relative overflow-hidden text-center" style={{
                                            background: "linear-gradient(180deg, #1C1C22 0%, #131318 100%)",
                                        }}>
                                            {/* Gloss */}
                                            <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{
                                                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                                            }} />
                                            <p className="relative z-10 text-[10px] font-mundial tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                                                {capped ? "Out of prize games" : "Prize games left"}
                                            </p>
                                            <div className="relative z-10 flex items-baseline justify-center gap-1.5">
                                                <p className="text-[18px] sm:text-[20px] font-display font-black" style={{ color: "rgba(255,255,255,0.75)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                                    {capped ? "0" : remaining}
                                                </p>
                                                {bonusPrizeGames > 0 && (
                                                    <span className="text-[10px] text-[#FFE048]/70 font-mundial font-bold">+{bonusPrizeGames}</span>
                                                )}
                                            </div>
                                            {isLoggedIn && (
                                                <span className="relative z-10 inline-flex items-center gap-1 mt-1 text-[10px] font-mundial font-bold tracking-wider uppercase border-b border-[#FFE048] pb-px" style={{ color: "#FFE048" }}>
                                                    Get More <span aria-hidden>→</span>
                                                </span>
                                            )}
                                        </div>
                                        {/* Bottom edge progress bar */}
                                        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                                            <div className="h-full" style={{
                                                width: `${pct}%`,
                                                background: capped ? "#FF6B6B" : remaining <= 3 ? "#FFB464" : remaining <= 5 ? "#FFE048" : "rgba(255,255,255,0.5)",
                                                borderRadius: "0 2px 0 0",
                                            }} />
                                        </div>
                                    </button>
                                );
                            })()}
                            <div
                                className="rounded-xl p-[2px] h-full"
                                style={{
                                    background: "linear-gradient(180deg, #A0A0A8 0%, #707078 40%, #45454D 100%)",
                                    boxShadow: "0 2px 0 #2A2A30, 0 3px 6px rgba(0,0,0,0.5)",
                                }}
                            >
                                <div className="rounded-[10px] px-4 py-3 h-full relative overflow-hidden flex flex-col items-center justify-center" style={{
                                    background: "linear-gradient(180deg, #1C1C22 0%, #131318 100%)",
                                }}>
                                    {/* Gloss */}
                                    <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{
                                        background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                                    }} />
                                    <p className="relative z-10 text-[10px] font-mundial tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                                        Daily prize games reset in
                                    </p>
                                    <p className="relative z-10 text-[18px] sm:text-[20px] font-display font-black" style={{ color: "rgba(255,255,255,0.75)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                        {dailyCountdown}
                                    </p>
                                </div>
                            </div>
                    </motion.div>
                </div>

                {/* Bottom Action Row */}
                <motion.div
                    className="mt-6 flex flex-col gap-3 w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                >
                    {/* Enamel Pin Menu Bar */}
                    <div
                        className="rounded-2xl overflow-hidden p-[2px]"
                        style={{
                            background: "linear-gradient(180deg, rgba(179,102,255,0.5) 0%, rgba(179,102,255,0.25) 40%, rgba(107,31,192,0.4) 100%)",
                            boxShadow: "0 2px 0 #0D0520, 0 4px 8px rgba(0,0,0,0.5)",
                        }}
                    >
                        <div
                            className="rounded-[14px] overflow-hidden"
                            style={{
                                background: "linear-gradient(180deg, #2D0B4E 0%, #1A0633 100%)",
                            }}
                        >
                            {/* Gloss */}
                            <div className="relative">
                                <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{
                                    background: "linear-gradient(180deg, rgba(179,102,255,0.06) 0%, transparent 100%)",
                                }} />
                                <div className="grid grid-cols-5 relative z-10">
                                    {/* Profile / Login */}
                                    <button
                                        onClick={() => isLoggedIn ? setIsProfileModalOpen(true) : setIsAuthModalOpen(true)}
                                        className="flex flex-col items-center gap-1.5 py-3.5 px-2 transition-all duration-200 hover:bg-white/[0.04] active:scale-95"
                                    >
                                        <User size={20} style={{ color: "rgba(179,102,255,0.85)" }} />
                                        <span className="text-[10px] font-mundial font-bold tracking-wider uppercase" style={{ color: "rgba(179,102,255,0.85)" }}>
                                            {isLoggedIn ? "Profile" : "Login"}
                                        </span>
                                    </button>

                                    {/* Pins */}
                                    <button
                                        onClick={isLoggedIn ? onOpenPinBook : undefined}
                                        disabled={!isLoggedIn}
                                        className="relative flex flex-col items-center gap-1.5 py-3.5 px-2 transition-all duration-200 hover:bg-white/[0.04] active:scale-95 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    >
                                        <div className="relative">
                                            <BookOpen size={20} style={{ color: isLoggedIn ? "rgba(179,102,255,0.85)" : "rgba(179,102,255,0.25)" }} />
                                            {capsuleCount > 0 && (
                                                <span
                                                    className="absolute -top-2 -right-3 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-white text-[9px] font-mundial font-bold px-1"
                                                    style={{
                                                        background: "#FF5F1F",
                                                        boxShadow: "0 0 8px rgba(255,95,31,0.6)",
                                                    }}
                                                >
                                                    {capsuleCount}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-mundial font-bold tracking-wider uppercase" style={{ color: isLoggedIn ? "rgba(179,102,255,0.85)" : "rgba(179,102,255,0.25)" }}>
                                            Pins
                                        </span>
                                    </button>

                                    {/* Achievements */}
                                    <button
                                        onClick={isLoggedIn ? onOpenAchievements : undefined}
                                        disabled={!isLoggedIn}
                                        className="relative flex flex-col items-center gap-1.5 py-3.5 px-2 transition-all duration-200 hover:bg-white/[0.04] active:scale-95 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    >
                                        <div className="relative">
                                            <Trophy size={20} style={{ color: isLoggedIn ? "rgba(179,102,255,0.85)" : "rgba(179,102,255,0.25)" }} />
                                            {achievementCount > 0 && (
                                                <span
                                                    className="absolute -top-2 -right-3 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-white text-[9px] font-mundial font-bold px-1"
                                                    style={{
                                                        background: "#FFE048",
                                                        color: "#1A0633",
                                                        boxShadow: "0 0 8px rgba(255,224,72,0.6)",
                                                    }}
                                                >
                                                    {achievementCount}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-mundial font-bold tracking-wider uppercase" style={{ color: isLoggedIn ? "rgba(179,102,255,0.85)" : "rgba(179,102,255,0.25)" }}>
                                            Quests
                                        </span>
                                    </button>

                                    {/* Leaderboards */}
                                    <button
                                        onClick={() => setIsLeaderboardOpen(true)}
                                        className="flex flex-col items-center gap-1.5 py-3.5 px-2 transition-all duration-200 hover:bg-white/[0.04] active:scale-95"
                                    >
                                        <Crown size={20} style={{ color: "rgba(179,102,255,0.85)" }} />
                                        <span className="text-[10px] font-mundial font-bold tracking-wider uppercase sm:hidden" style={{ color: "rgba(179,102,255,0.85)" }}>
                                            Leaders
                                        </span>
                                        <span className="text-[10px] font-mundial font-bold tracking-wider uppercase hidden sm:inline" style={{ color: "rgba(179,102,255,0.85)" }}>
                                            Leaderboards
                                        </span>
                                    </button>

                                    {/* Rules */}
                                    <button
                                        onClick={onShowInstructions}
                                        className="flex flex-col items-center gap-1.5 py-3.5 px-2 transition-all duration-200 hover:bg-white/[0.04] active:scale-95"
                                    >
                                        <HelpCircle size={20} style={{ color: "rgba(179,102,255,0.85)" }} />
                                        <span className="text-[10px] font-mundial font-bold tracking-wider uppercase" style={{ color: "rgba(179,102,255,0.85)" }}>
                                            Rules
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logout Button — reserve space so layout doesn't shift */}
                    <div className="mt-4 h-5">
                        {isLoggedIn && (
                            <button
                                onClick={handleLogout}
                                className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-all flex items-center justify-center gap-2 hover:gap-3 w-full"
                            >
                                <LogOut size={12} />
                                <span>Sign Out of VibeMatch</span>
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>

            {isProfileModalOpen && (
                <ProfileModal
                    currentUsername={username}
                    currentAvatarUrl={avatarUrl}
                    onSave={handleProfileSave}
                    onClose={() => setIsProfileModalOpen(false)}
                    pinsCollected={pinsCollected}
                    streak={streak || 0}
                    capsuleCount={capsuleCount || 0}
                />
            )}

            {isAuthModalOpen && (
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                    onSuccess={handleAuthSuccess}
                    referralCode={referralCode}
                />
            )}

            {isLeaderboardOpen && (
                <LeaderboardModal
                    currentUsername={username}
                    currentAvatarUrl={avatarUrl}
                    onClose={() => setIsLeaderboardOpen(false)}
                />
            )}
        </div>
    );
}

