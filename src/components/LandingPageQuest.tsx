"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { BADGES } from "@/lib/badges";
import { GameMode } from "@/lib/gameEngine";
import { User, BookOpen, Trophy, Crown, HelpCircle, LogOut, LogIn } from "lucide-react";
import ProfileModal from "./ProfileModal";
import LeaderboardModal from "./LeaderboardModal";
import AuthModal from "./AuthModal";
import {
    ChunkyButton,
    EnamelCard,
    FloatingBadges,
    PrizeCoin,
} from "./arcade";
import {
    GOLD, GOLD_DEEP,
    COSMIC, COSMIC_DEEP,
    ORANGE, ORANGE_DEEP,
} from "@/lib/arcade-tokens";

interface LandingPageQuestProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
    onLogout?: () => void;
    onOpenPinBook?: () => void;
    onOpenAchievements?: () => void;
    onOpenBuyPrizeGames?: () => void;
    /** Called when auth/signup succeeds so the parent can refresh userProfile. */
    onAuthSuccess?: (username: string, avatarUrl: string) => void;
    capsuleCount?: number;
    achievementCount?: number;
    classicPlays?: number;
    bonusPrizeGames?: number;
    pinsCollected?: number;
    /** Collected pins map — only used by the desktop Arcade layout for RECENT PULLS. Accepted here for type compatibility with the dispatcher. */
    pins?: Record<string, { count: number; firstEarned: string }>;
    referralCode?: string | null;
    userProfile?: { username: string; avatarUrl: string } | null;
}

/* ========= DAILY COUNTDOWN ========= */
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
    const [t, setT] = useState(formatCountdown);
    useEffect(() => {
        const iv = setInterval(() => setT(formatCountdown()), 1000);
        return () => clearInterval(iv);
    }, []);
    return t;
}

/* ========= MAIN ========= */
export default function LandingPageQuest({
    onStartGame,
    onShowInstructions,
    onLogout,
    onOpenPinBook,
    onOpenAchievements,
    onOpenBuyPrizeGames,
    onAuthSuccess,
    capsuleCount = 0,
    achievementCount = 0,
    classicPlays = 0,
    bonusPrizeGames = 0,
    pinsCollected = 0,
    referralCode,
    userProfile,
}: LandingPageQuestProps) {
    const [isProfileOpen, setProfileOpen] = useState(false);
    const [isAuthOpen, setAuthOpen] = useState(false);
    const [isLeaderboardOpen, setLeaderboardOpen] = useState(false);
    const [streak, setStreak] = useState(0);
    const countdown = useDailyCountdown();
    const notifyRef = useRef(false);

    const isLoggedIn = !!userProfile;
    const username = userProfile?.username || "";
    const avatarUrl = userProfile?.avatarUrl || "";

    // Prize-games math
    const BASE_CAP = 10;
    const totalCap = BASE_CAP + bonusPrizeGames;
    const remaining = Math.max(0, totalCap - classicPlays);
    const pct = totalCap > 0 ? (remaining / totalCap) * 100 : 0;
    const empty = remaining === 0;
    const low = !empty && remaining <= 3;
    const prizeAccent = empty ? "#FF3B30" : low ? ORANGE : GOLD;
    const prizeAccentDeep = empty ? "#6A0A05" : low ? ORANGE_DEEP : GOLD_DEEP;

    // Pins percentage
    const totalBadges = BADGES.length;
    const pinPct = totalBadges > 0 ? Math.round((pinsCollected / totalBadges) * 100) : 0;

    // Streak fetch on login
    useEffect(() => {
        if (!userProfile) return;
        fetch(`/api/streak?username=${userProfile.username}`)
            .then(r => r.json())
            .then(s => { if (s.streak > 0) setStreak(s.streak); })
            .catch(() => { /* silent */ });
    }, [userProfile]);

    // Silent preloader for game-board badges — warms the browser cache
    useEffect(() => {
        if (typeof window === "undefined") return;
        const t = setTimeout(() => {
            const gameBadges = BADGES.filter(b => !b.collectOnly);
            const seen = new Set<string>();
            gameBadges.forEach(badge => {
                if (seen.has(badge.image)) return;
                seen.add(badge.image);
                const img1 = new window.Image();
                img1.src = badge.image;
                const img2 = new window.Image();
                img2.src = `/_next/image?url=${encodeURIComponent(badge.image)}&w=96&q=75`;
            });
        }, 800);
        return () => clearTimeout(t);
    }, []);

    const handleAuthSuccess = (newUsername: string, newAvatarUrl: string) => {
        localStorage.setItem("vibematch_username", newUsername);
        // Propagate to AppClient so userProfile flips to logged-in state. Without
        // this callback AppClient's session fetch only runs on mount and the UI
        // stays stuck on guest until a page reload.
        onAuthSuccess?.(newUsername, newAvatarUrl);
        setAuthOpen(false);
    };

    const handleProfileSave = async (newUsername: string, newAvatarUrl: string) => {
        try {
            const res = await fetch("/api/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: newUsername, avatarUrl: newAvatarUrl }),
            });
            if (res.ok) {
                localStorage.setItem("vibematch_username", newUsername);
                toast.success("Profile saved!");
            } else {
                toast.error("Failed to save profile on database.");
            }
        } catch {
            toast.error("Network error saving profile.");
        }
    };

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            localStorage.removeItem("vibematch_username");
            toast.success("Logged out");
            onLogout?.();
        } catch {
            toast.error("Logout failed");
        }
    };

    const handleStartDaily = async () => {
        if (!isLoggedIn) {
            toast.error("Login to play Daily Challenge!");
            setAuthOpen(true);
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
        } catch {
            toast.error("Failed to check daily status. Try again.");
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col items-stretch">
            {/* Pin-wall background — defaults match production density (55 mobile / 120 desktop) */}
            <FloatingBadges />

            <div className="relative z-10 flex flex-col w-full max-w-lg mx-auto px-4 pt-6 pb-4 min-h-screen">
                {/* ========== HEADER RAIL ========== */}
                <HeaderRail
                    isLoggedIn={isLoggedIn}
                    username={username}
                    avatarUrl={avatarUrl}
                    pinsCollected={pinsCollected}
                    totalBadges={totalBadges}
                    pinPct={pinPct}
                    streak={streak}
                    countdown={countdown}
                    onOpenProfile={() => setProfileOpen(true)}
                    onSignIn={() => setAuthOpen(true)}
                />

                {/* Logo — tight-cropped 4K treatment (1000x627 source).
                    mt-10 gives clear breathing room below the header rail
                    (was mt-4 and touched the rail with the new tight-cropped
                    logo). Wrapped so hover-scale lives on the outer element
                    without stomping the inner bob keyframe. */}
                <div className="flex justify-center mt-10">
                    <div className="transition-transform duration-300 hover:scale-105">
                        <Image
                            src="/assets/logo.png"
                            alt="VIBE MATCH"
                            width={1000}
                            height={627}
                            priority
                            className="w-[240px] sm:w-[320px] h-auto max-w-full"
                            style={{
                                filter: "drop-shadow(0 10px 30px rgba(255,224,72,0.3))",
                                animation: "vmLogoBob 4s ease-in-out infinite",
                            }}
                        />
                    </div>
                    <style jsx>{`
                        @keyframes vmLogoBob {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-7px); }
                        }
                    `}</style>
                </div>

                {/* ========== QUEST CARDS ========== */}
                {/* mt-8 leaves clear space under the tight-cropped logo.
                    (Old -mt-5 was compensating for whitespace baked into
                    logo-v2; the new logo has none.) */}
                <div className="flex flex-col gap-3 mt-8">
                    {/* Classic */}
                    <button
                        type="button"
                        onClick={() => onStartGame("classic", username || undefined, avatarUrl || undefined)}
                        className="block w-full text-left outline-none transition-transform duration-200 ease-out hover:-translate-y-1 active:translate-y-0.5"
                    >
                    <EnamelCard
                        color={GOLD}
                        deep={GOLD_DEEP}
                        inner="linear-gradient(155deg, #3a2108 0%, #1a0e03 60%, #0c0702 100%)"
                        tilt={-0.6}
                        depth={6}
                    >
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: `radial-gradient(circle at 20% 15%, ${GOLD}22, transparent 40%), radial-gradient(circle at 80% 80%, ${GOLD}22, transparent 50%)`,
                            }}
                        />
                        <div className="relative p-4 flex items-center gap-3.5">
                            {/* 30 MOVES circle */}
                            <div
                                className="shrink-0 rounded-full relative flex flex-col items-center justify-center overflow-hidden"
                                style={{
                                    width: 76, height: 76,
                                    background: `radial-gradient(circle at 35% 30%, #FFF4B0, ${GOLD} 50%, ${GOLD_DEEP})`,
                                    boxShadow: `inset 0 -6px 10px ${GOLD_DEEP}88, 0 4px 8px rgba(0,0,0,0.5)`,
                                    border: "3px solid #2A1A0A",
                                }}
                            >
                                <span
                                    className="mt-[6px] font-display font-black leading-none"
                                    style={{ color: "#1A0633", fontSize: 32, textShadow: "0 2px 0 rgba(255,255,255,0.3)" }}
                                >30</span>
                                <span
                                    className="mt-[2px] font-mundial font-black tracking-wider"
                                    style={{ color: "#1A0633", fontSize: 7 }}
                                >MOVES</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2
                                    className="font-display font-black uppercase leading-[0.9]"
                                    style={{ color: GOLD, fontSize: 22, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                                >
                                    Classic<br />VibeMatch
                                </h2>
                                <p className="text-white/55 text-[11px] font-mundial mt-1.5">
                                    Match pins and score as high as you can.
                                </p>
                            </div>
                            <div className="shrink-0 self-end">
                                <ChunkyButton
                                    style={{ padding: "8px 14px", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}
                                >
                                    PLAY
                                </ChunkyButton>
                            </div>
                        </div>
                    </EnamelCard>
                    </button>

                    {/* Daily Challenge */}
                    <button
                        type="button"
                        onClick={handleStartDaily}
                        className="block w-full text-left outline-none transition-transform duration-200 ease-out hover:-translate-y-1 active:translate-y-0.5"
                    >
                    <EnamelCard
                        color={COSMIC}
                        deep={COSMIC_DEEP}
                        dim="#D8A0FF"
                        inner="linear-gradient(155deg, #2a124d 0%, #14082a 60%, #0a0416 100%)"
                        tilt={0.5}
                        depth={6}
                    >
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: `radial-gradient(circle at 80% 20%, ${COSMIC}22, transparent 40%), radial-gradient(circle at 15% 80%, rgba(255,107,157,0.1), transparent 50%)`,
                            }}
                        />
                        <div className="relative p-4 flex items-center gap-3.5">
                            {/* Star circle */}
                            <div
                                className="shrink-0 rounded-full relative flex items-center justify-center"
                                style={{
                                    width: 76, height: 76,
                                    background: `radial-gradient(circle at 35% 30%, #E8C0FF, ${COSMIC} 50%, ${COSMIC_DEEP})`,
                                    boxShadow: `inset 0 -6px 10px ${COSMIC_DEEP}aa, 0 4px 8px rgba(0,0,0,0.5)`,
                                    border: "3px solid #1a0a2e",
                                }}
                            >
                                <span
                                    className="font-display font-black leading-none"
                                    style={{ color: "#1A0633", fontSize: 34 }}
                                >★</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h2
                                        className="font-display font-black uppercase leading-[0.9]"
                                        style={{ color: COSMIC, fontSize: 20, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                                    >
                                        The Daily<br />Challenge
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <p className="text-white/55 text-[11px] font-mundial">
                                        1 shot per day, same board for all
                                    </p>
                                    {streak > 0 && (
                                        <span
                                            className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mundial font-black"
                                            style={{
                                                color: ORANGE,
                                                background: `${ORANGE}22`,
                                                border: `1px solid ${ORANGE}55`,
                                            }}
                                        >
                                            🔥 {streak}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 self-end">
                                <ChunkyButton
                                    color={COSMIC}
                                    deep={COSMIC_DEEP}
                                    text="#fff"
                                    style={{ padding: "8px 14px", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em" }}
                                >
                                    PLAY
                                </ChunkyButton>
                            </div>
                        </div>
                    </EnamelCard>
                    </button>

                    {/* Prize Games energy bar — whole strip is clickable and
                        lifts on hover, matching production's tactile feedback.
                        The inner RESTOCK ChunkyButton still works on its own
                        (taps bubble up; both open the shop). */}
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => isLoggedIn ? onOpenBuyPrizeGames?.() : setAuthOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                isLoggedIn ? onOpenBuyPrizeGames?.() : setAuthOpen(true);
                            }
                        }}
                        className="rounded-2xl p-[2px] cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 outline-none"
                        style={{
                            background: `linear-gradient(180deg, ${prizeAccent} 0%, ${prizeAccentDeep} 100%)`,
                            boxShadow: `0 3px 0 ${prizeAccentDeep}, 0 5px 10px rgba(0,0,0,0.45)${empty ? `, 0 0 22px rgba(255,59,48,0.6)` : ""}`,
                            animation: empty ? "vmRestockPulse 1.4s ease-in-out infinite" : undefined,
                        }}
                    >
                        <style jsx>{`
                            @keyframes vmRestockPulse {
                                0%, 100% { box-shadow: 0 3px 0 ${prizeAccentDeep}, 0 5px 10px rgba(0,0,0,0.45), 0 0 14px rgba(255,59,48,0.4); }
                                50% { box-shadow: 0 3px 0 ${prizeAccentDeep}, 0 5px 10px rgba(0,0,0,0.45), 0 0 30px rgba(255,59,48,0.9); }
                            }
                        `}</style>
                        <div
                            className="rounded-[14px] p-3"
                            style={{ background: "linear-gradient(180deg, #1a0e03, #0a0502)" }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <PrizeCoin size={26} spin={empty} />
                                    <div>
                                        <div
                                            className="font-display font-black uppercase leading-none"
                                            style={{ color: prizeAccent, fontSize: 13, letterSpacing: "0.05em" }}
                                        >
                                            {empty ? "Out of Plays" : "Prize Games"}
                                        </div>
                                        <div className="text-[9px] font-mundial text-white/45 mt-0.5">
                                            {remaining} of {totalCap} remaining
                                            {bonusPrizeGames > 0 ? ` · +${bonusPrizeGames} bonus` : ""}
                                        </div>
                                    </div>
                                </div>
                                <ChunkyButton
                                    onClick={isLoggedIn ? onOpenBuyPrizeGames : () => setAuthOpen(true)}
                                    color={prizeAccent}
                                    deep={prizeAccentDeep}
                                    text={empty || low ? "#fff" : "#1A0633"}
                                    style={{ padding: "6px 10px", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em" }}
                                >
                                    {empty ? "RESTOCK NOW" : "+ RESTOCK"}
                                </ChunkyButton>
                            </div>
                            {/* Energy bar */}
                            <div
                                className="relative h-3 rounded-full overflow-hidden"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
                                }}
                            >
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${pct}%`,
                                        background: `linear-gradient(90deg, ${prizeAccent}, ${empty || low ? "#FFAA55" : "#FFF4B0"})`,
                                        boxShadow: `0 0 12px ${prizeAccent}aa`,
                                    }}
                                />
                                {/* Segment ticks */}
                                {[...Array(Math.max(0, totalCap - 1))].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute top-0 bottom-0 w-px"
                                        style={{
                                            left: `${((i + 1) / totalCap) * 100}%`,
                                            background: "rgba(0,0,0,0.55)",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sign-in callout for guests (below cards, above nav) */}
                {!isLoggedIn && (
                    <button
                        onClick={() => setAuthOpen(true)}
                        className="mt-3 rounded-xl p-[1.5px] active:scale-[0.98] transition-transform"
                        style={{
                            background: `linear-gradient(180deg, ${COSMIC}77, ${COSMIC_DEEP})`,
                            boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
                        }}
                    >
                        <div
                            className="rounded-[10px] px-4 py-2.5 flex items-center justify-center gap-2"
                            style={{ background: "linear-gradient(180deg, #2D0B4E 0%, #1A0633 100%)" }}
                        >
                            <LogIn size={14} style={{ color: COSMIC }} />
                            <span className="text-[12px] font-mundial font-bold tracking-wider text-white/90">
                                Sign in to save progress & unlock features
                            </span>
                        </div>
                    </button>
                )}

                {/* ========== BOTTOM NAV ==========
                    Natural flow below the content — no flex-1 spacer. On shorter
                    screens the nav sits right below the sign-in callout; on tall
                    screens there's a small natural gap (mt-4) rather than a void. */}
                <div className="mt-4" />
                <BottomNav
                    isLoggedIn={isLoggedIn}
                    capsuleCount={capsuleCount}
                    achievementCount={achievementCount}
                    onProfile={() => isLoggedIn ? setProfileOpen(true) : setAuthOpen(true)}
                    onPins={() => isLoggedIn ? onOpenPinBook?.() : setAuthOpen(true)}
                    onQuests={() => isLoggedIn ? onOpenAchievements?.() : setAuthOpen(true)}
                    onLeaders={() => setLeaderboardOpen(true)}
                    onRules={() => onShowInstructions?.()}
                />

                {/* Subtle logout — only when logged in, below the nav */}
                {isLoggedIn && (
                    <button
                        onClick={handleLogout}
                        className="mt-3 text-white/35 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white/70 transition-colors flex items-center justify-center gap-2 w-full"
                    >
                        <LogOut size={12} />
                        <span>Sign Out</span>
                    </button>
                )}
            </div>

            {/* Modals */}
            {isProfileOpen && (
                <ProfileModal
                    currentUsername={username}
                    currentAvatarUrl={avatarUrl}
                    onSave={handleProfileSave}
                    onClose={() => setProfileOpen(false)}
                    pinsCollected={pinsCollected}
                    streak={streak}
                    capsuleCount={capsuleCount}
                />
            )}
            {isAuthOpen && (
                <AuthModal
                    isOpen={isAuthOpen}
                    onClose={() => setAuthOpen(false)}
                    onSuccess={handleAuthSuccess}
                    referralCode={referralCode}
                />
            )}
            {isLeaderboardOpen && (
                <LeaderboardModal
                    currentUsername={username}
                    currentAvatarUrl={avatarUrl}
                    onClose={() => setLeaderboardOpen(false)}
                />
            )}
        </div>
    );
}

/* ========= HEADER RAIL ========= */
function HeaderRail({
    isLoggedIn,
    username,
    avatarUrl,
    pinsCollected,
    totalBadges,
    pinPct,
    streak,
    countdown,
    onOpenProfile,
    onSignIn,
}: {
    isLoggedIn: boolean;
    username: string;
    avatarUrl: string;
    pinsCollected: number;
    totalBadges: number;
    pinPct: number;
    streak: number;
    countdown: string;
    onOpenProfile: () => void;
    onSignIn: () => void;
}) {
    const backdrop = {
        background: "rgba(10,4,20,0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${GOLD}33`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    } as const;

    // Hover treatment is identical across guest/logged-in so the bar reads
    // as one interactive pill regardless of auth state. Brightness lift +
    // subtle Y-translate + a softened gold edge on hover, 200ms ease.
    const hoverFx =
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.08] hover:shadow-[0_8px_22px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,224,72,0.35)] active:scale-[0.99]";

    if (!isLoggedIn) {
        return (
            <button
                type="button"
                onClick={onSignIn}
                className={`w-full flex items-center justify-between rounded-full pl-1.5 pr-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[${GOLD}]/60 ${hoverFx}`}
                style={backdrop}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{
                            background: `linear-gradient(135deg, ${COSMIC}44, ${COSMIC_DEEP}88)`,
                            border: `1px solid ${GOLD}55`,
                        }}
                    >
                        <User size={16} style={{ color: GOLD }} />
                    </div>
                    <div className="text-left">
                        <div className="font-display text-[12px] font-black text-white leading-none">Guest</div>
                        <div className="text-[9px] text-white/65 font-mundial tracking-wider mt-0.5">
                            Tap to sign in
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[8px] tracking-[0.2em] font-mundial text-white/55">PLAYS RESET</div>
                    <div className="text-[11px] tabular-nums font-display font-black text-white">{countdown}</div>
                </div>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onOpenProfile}
            className={`w-full flex items-center justify-between rounded-full pl-1.5 pr-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[${GOLD}]/60 ${hoverFx}`}
            style={backdrop}
        >
            <div className="flex items-center gap-2">
                <div
                    className="w-9 h-9 rounded-full overflow-hidden relative"
                    style={{
                        background: `linear-gradient(135deg, ${COSMIC}, #FF6B9D)`,
                        boxShadow: `0 0 0 2px ${GOLD}, 0 0 12px ${GOLD}55`,
                    }}
                >
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-base">🏄</div>
                    )}
                </div>
                <div className="text-left">
                    <div className="font-display text-[12px] font-black text-white leading-none">
                        {username}
                    </div>
                    <div className="text-[9px] text-white/65 font-mundial tracking-wider mt-0.5">
                        {pinsCollected}/{totalBadges} Pins ({pinPct}%)
                        {streak > 0 && ` · 🔥 ${streak}-Day Streak`}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-[8px] tracking-[0.2em] font-mundial text-white/55">PLAYS RESET</div>
                <div className="text-[11px] tabular-nums font-display font-black text-white">{countdown}</div>
            </div>
        </button>
    );
}

/* ========= BOTTOM NAV ========= */
function BottomNav({
    isLoggedIn,
    capsuleCount,
    achievementCount,
    onProfile,
    onPins,
    onQuests,
    onLeaders,
    onRules,
}: {
    isLoggedIn: boolean;
    capsuleCount: number;
    achievementCount: number;
    onProfile: () => void;
    onPins: () => void;
    onQuests: () => void;
    onLeaders: () => void;
    onRules: () => void;
}) {
    const items: Array<{
        key: string;
        label: string;
        icon: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
        badge?: { count: number; color: string; textColor?: string };
    }> = [
        {
            key: "profile",
            label: isLoggedIn ? "Profile" : "Login",
            icon: <User size={16} />,
            onClick: onProfile,
        },
        {
            key: "pins",
            label: "Pins",
            icon: <BookOpen size={16} />,
            onClick: onPins,
            disabled: !isLoggedIn,
            badge: capsuleCount > 0 ? { count: capsuleCount, color: ORANGE } : undefined,
        },
        {
            key: "quests",
            label: "Quests",
            icon: <Trophy size={16} />,
            onClick: onQuests,
            disabled: !isLoggedIn,
            badge: achievementCount > 0 ? { count: achievementCount, color: GOLD, textColor: "#1A0633" } : undefined,
        },
        {
            key: "leaders",
            label: "Leaders",
            icon: <Crown size={16} />,
            onClick: onLeaders,
        },
        {
            key: "rules",
            label: "Rules",
            icon: <HelpCircle size={16} />,
            onClick: onRules,
        },
    ];

    return (
        <div
            className="rounded-xl p-[2px]"
            style={{
                background: `linear-gradient(180deg, ${GOLD} 0%, #c9a84c 40%, ${GOLD_DEEP} 100%)`,
                boxShadow: `0 3px 0 ${GOLD_DEEP}, 0 5px 14px rgba(0,0,0,0.5)`,
            }}
        >
            <div
                className="rounded-[10px] px-1.5 py-1.5 relative overflow-hidden"
                style={{ background: "linear-gradient(180deg, #1a0e03, #0a0502)" }}
            >
                <div
                    className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
                    style={{ background: `linear-gradient(180deg, ${GOLD}10, transparent)` }}
                />
                <div className="grid grid-cols-5 relative z-10 gap-1">
                    {items.map(it => (
                        <button
                            key={it.key}
                            onClick={it.onClick}
                            disabled={it.disabled}
                            className="group rounded-lg p-[1.5px] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            style={{
                                background: `linear-gradient(180deg, ${GOLD}55 0%, ${GOLD_DEEP}55 100%)`,
                                boxShadow: `0 2px 0 ${GOLD_DEEP}88`,
                            }}
                        >
                            <div
                                className="rounded-[7px] flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 relative"
                                style={{
                                    background: "linear-gradient(180deg, #2A1A0A 0%, #120802 100%)",
                                    color: GOLD,
                                }}
                            >
                                <div className="relative">
                                    {it.icon}
                                    {it.badge && (
                                        <span
                                            className="absolute -top-2 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[9px] font-mundial font-bold px-1"
                                            style={{
                                                background: it.badge.color,
                                                color: it.badge.textColor || "#fff",
                                                boxShadow: `0 0 8px ${it.badge.color}99`,
                                            }}
                                        >
                                            {it.badge.count}
                                        </span>
                                    )}
                                </div>
                                <span
                                    className="font-display font-black tracking-[0.14em] uppercase"
                                    style={{ color: GOLD, fontSize: 8 }}
                                >
                                    {it.label}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
