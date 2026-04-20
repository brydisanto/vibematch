"use client";

/**
 * Desktop (≥1024px) landing — the "Arcade Cabinet" variant A from the
 * Claude Design handoff bundle (DesktopVariants.jsx).
 *
 * Three-panel layout:
 *   - Left (260px):   HOW TO PLAY / MY CAPSULES / RECENT PULLS
 *   - Center (flex):  marquee strip / logo / Classic+Daily cabinets /
 *                     Prize Games strip / 5-col nav
 *   - Right (260px):  profile block (no level chip) / RECENT RUNS
 *
 * Guest users never land here — the parent dispatcher falls back to the
 * mobile Quest layout for anyone who isn't authenticated, so everything
 * below assumes `userProfile` is populated.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { LogOut } from "lucide-react";
import { BADGES, type BadgeTier } from "@/lib/badges";
import { getTierByCount } from "@/lib/tiers";
import { ALL_ACHIEVEMENTS } from "@/lib/achievements";
import { GameMode } from "@/lib/gameEngine";
import ProfileModal from "./ProfileModal";
import LeaderboardModal from "./LeaderboardModal";
import { ChunkyButton, FloatingBadges } from "./arcade";
import {
    GOLD,
    GOLD_DIM,
    GOLD_DEEP,
    COSMIC,
    COSMIC_DEEP,
    ORANGE,
    ORANGE_DEEP,
    PINK,
} from "@/lib/arcade-tokens";

interface LandingPageArcadeProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
    onLogout?: () => void;
    onOpenPinBook?: (initialTab?: "collection" | "leaderboard" | "capsules") => void;
    onOpenAchievements?: () => void;
    onOpenBuyPrizeGames?: () => void;
    /** Called after a successful profile save so the parent can update
     *  userProfile state and the avatar refreshes without a page reload. */
    onProfileUpdate?: (username: string, avatarUrl: string) => void;
    capsuleCount?: number;
    classicPlays?: number;
    bonusPrizeGames?: number;
    pinsCollected?: number;
    pins?: Record<string, { count: number; firstEarned: string; lastPulled?: string }>;
    questsCompleted?: number;
    userProfile: { username: string; avatarUrl: string };
}

/* ========= COUNTDOWN ========= */
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

/* ========= TIER → RARITY MAP (matches mockup's rarity chips) ========= */
const TIER_META: Record<BadgeTier, { label: string; tint: string }> = {
    cosmic: { label: "Cosmic", tint: "#B366FF" },
    gold: { label: "Legendary", tint: "#FFE048" },
    special: { label: "Special", tint: "#FF5F1F" },
    silver: { label: "Rare", tint: "#4A9EFF" },
    blue: { label: "Common", tint: "#9BA3B8" },
};

interface RecentRun {
    mode: string;
    score: number;
    timestamp: number;
}

/* ========= MAIN ========= */
export default function LandingPageArcade({
    onStartGame,
    onShowInstructions,
    onLogout,
    onOpenPinBook,
    onOpenAchievements,
    onOpenBuyPrizeGames,
    onProfileUpdate,
    capsuleCount = 0,
    classicPlays = 0,
    bonusPrizeGames = 0,
    pinsCollected = 0,
    pins = {},
    questsCompleted = 0,
    userProfile,
}: LandingPageArcadeProps) {
    const [isProfileOpen, setProfileOpen] = useState(false);
    const [isLeaderboardOpen, setLeaderboardOpen] = useState(false);
    const [streak, setStreak] = useState(0);
    const [personalBest, setPersonalBest] = useState<number>(0);
    const [totalPlayers, setTotalPlayers] = useState<number>(0);
    const [pinRank, setPinRank] = useState<number | null>(null);
    const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
    const countdown = useDailyCountdown();

    const { username, avatarUrl } = userProfile;

    // Prize-games math (matches Quest wiring)
    const BASE_CAP = 10;
    const total = BASE_CAP + bonusPrizeGames;
    const remaining = Math.max(0, total - classicPlays);
    const pct = total > 0 ? (remaining / total) * 100 : 0;
    const empty = remaining === 0;
    const low = !empty && remaining <= 3;
    const RED = "#FF3B30";
    const RED_DEEP = "#6A0A05";
    const RED_LIGHT = "#FF8A70";
    const accent = empty ? RED : low ? ORANGE : GOLD;
    const accentDeep = empty ? RED_DEEP : low ? ORANGE_DEEP : GOLD_DEEP;
    const accentLight = empty ? RED_LIGHT : low ? "#FFAA55" : "#FFF4B0";
    const accentText = (empty || low) ? "#fff" : "#1A0633";

    // Pin collection math
    const totalBadges = BADGES.length;
    const pinPct = totalBadges > 0 ? Math.round((pinsCollected / totalBadges) * 100) : 0;

    // Quest completion math
    const totalQuests = ALL_ACHIEVEMENTS.length;
    const questPct = totalQuests > 0 ? Math.round((questsCompleted / totalQuests) * 100) : 0;

    // Extra pins = total duplicates across all owned pins (sum of count-1 for
    // every pin you own more than one of). These are what the Reroll flow
    // burns to roll for new pins, so the card below doubles as an at-a-glance
    // "you have X duplicates ready to swap" prompt.
    const extraPinsCount = useMemo(
        () => Object.values(pins).reduce((sum, p) => sum + Math.max(0, p.count - 1), 0),
        [pins]
    );

    // Player tier — derived from pin-collection % via the canonical
    // src/lib/tiers.ts tranches (Rookie → Pro Plastic → Big Vibes → All Gold
    // → Shadow Funk → Cosmic → One-Of-One at 100%). Keeping the band logic
    // in one place so the arcade chip stays in sync with leaderboards,
    // profile cards, and anywhere else tier is surfaced.
    const tier = useMemo(() => {
        return getTierByCount(pinsCollected, totalBadges);
    }, [pinsCollected, totalBadges]);

    // Recent pulls — sort by lastPulled desc so duplicate pulls also bubble
    // to the top, falling back to firstEarned for legacy entries that don't
    // carry a lastPulled timestamp yet. Take top 6. `isNew` flags pins the
    // player still only has one copy of so the row renders a green NEW chip.
    const recentPulls = useMemo(() => {
        return Object.entries(pins)
            .map(([id, data]) => {
                const badge = BADGES.find(b => b.id === id);
                if (!badge) return null;
                return {
                    id,
                    name: badge.name,
                    image: badge.image,
                    tier: badge.tier,
                    sortKey: data.lastPulled || data.firstEarned || "",
                    isNew: data.count === 1,
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
            .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
            .slice(0, 6);
    }, [pins]);

    // Streak fetch
    useEffect(() => {
        fetch(`/api/streak?username=${username}`)
            .then(r => r.json())
            .then(s => { if (s.streak > 0) setStreak(s.streak); })
            .catch(() => { /* silent */ });
    }, [username]);

    // Classic leaderboard fetch — also gives us totalPlayers for the marquee.
    useEffect(() => {
        fetch(`/api/scores?mode=classic&username=${encodeURIComponent(username)}`)
            .then(r => r.json())
            .then(data => {
                if (typeof data.personalBest === "number") setPersonalBest(data.personalBest);
                if (typeof data.totalPlayers === "number") setTotalPlayers(data.totalPlayers);
            })
            .catch(() => { /* silent */ });
    }, [username]);

    // Pin leaderboard rank — derive by scanning the ordered list for the user.
    useEffect(() => {
        fetch("/api/pinbook/leaderboard")
            .then(r => r.json())
            .then(data => {
                const list: Array<{ username: string }> = data?.leaderboard || [];
                const idx = list.findIndex(
                    e => e.username?.toLowerCase() === username.toLowerCase()
                );
                if (idx >= 0) setPinRank(idx + 1);
            })
            .catch(() => { /* silent */ });
    }, [username]);

    // Recent runs fetch
    useEffect(() => {
        fetch("/api/recent-scores?limit=8")
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.runs)) setRecentRuns(data.runs);
            })
            .catch(() => { /* silent */ });
    }, [username]);

    const handleProfileSave = async (newUsername: string, newAvatarUrl: string) => {
        try {
            const res = await fetch("/api/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: newUsername, avatarUrl: newAvatarUrl }),
            });
            if (res.ok) {
                localStorage.setItem("vibematch_username", newUsername);
                // Propagate the updated profile up to the parent so the avatar
                // visible in the rail re-renders without needing a page reload.
                onProfileUpdate?.(newUsername, newAvatarUrl);
                toast.success("Profile saved!");
            } else {
                toast.error("Failed to save profile.");
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

    // Derive "NEW BEST" tag: the highest classic score in recent runs wins
    // a NEW BEST tag when it matches the personalBest. Daily "today" runs
    // get a TODAY tag.
    const taggedRuns = useMemo(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        let newBestTagged = false;
        return recentRuns.map(run => {
            const dateStr = new Date(run.timestamp).toISOString().slice(0, 10);
            let tag: "NEW BEST" | "TODAY" | null = null;
            if (run.mode === "classic" && !newBestTagged && personalBest > 0 && run.score === personalBest) {
                tag = "NEW BEST";
                newBestTagged = true;
            } else if (run.mode === "daily" && dateStr === todayStr) {
                tag = "TODAY";
            }
            const label = run.mode === "daily" ? "Daily" : "Classic";
            return { ...run, label, tag };
        });
    }, [recentRuns, personalBest]);

    return (
        <>
            <div className="relative w-full min-h-screen flex items-stretch" style={{ background: "linear-gradient(180deg, #1a0c2e 0%, #0a0418 100%)" }}>
                <div className="relative flex items-stretch w-full overflow-hidden">

                    {/* ======== LEFT PANEL ======== */}
                    <div
                        className="relative shrink-0 flex flex-col"
                        style={{
                            width: 300,
                            background: "linear-gradient(180deg, #2D0B4E 0%, #180630 100%)",
                            borderRight: `1px solid ${GOLD}15`,
                        }}
                    >
                        {/* How to Play — full copy + explicit Full Rules CTA
                            so the rail surface reads as two discrete things:
                            a short pitch and a link to the detailed rules. */}
                        <div className="px-5 pt-6 pb-4 border-b border-white/5">
                            <div className="font-display text-[10px] tracking-[0.3em] mb-2" style={{ color: GOLD }}>
                                HOW TO PLAY
                            </div>
                            <div className="text-white/70 text-[12px] leading-relaxed">
                                Match 3+ badges of the same type to score points • 4+ unlock power-ups • 30 moves to score as high as possible • Hit 15K+ to win a Pin Capsule!
                            </div>
                            <button
                                type="button"
                                onClick={onShowInstructions}
                                className="mt-3 w-full text-[10px] font-display tracking-[0.25em] py-2 rounded-lg cursor-pointer transition-all hover:brightness-125"
                                style={{ color: GOLD, border: `1px solid ${GOLD}44`, background: `${GOLD}0a` }}
                            >
                                FULL RULES →
                            </button>
                        </div>

                        {/* MY ITEMS — unified block for capsules + extra pins,
                            condensed so the rail doesn't dominate the page.
                            Two stacked sub-cards share the same header. */}
                        <div className="px-5 pt-4 pb-3 border-b border-white/5 flex flex-col gap-2.5">
                            <div className="font-display text-[10px] tracking-[0.3em]" style={{ color: GOLD }}>
                                MY ITEMS
                            </div>

                            {/* Capsules */}
                            <div
                                className="rounded-xl p-[2px] transition-all duration-200 ease-out hover:-translate-y-[2px] hover:brightness-[1.08]"
                                style={{
                                    background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 40%, ${GOLD_DEEP} 100%)`,
                                    boxShadow: `0 3px 0 ${GOLD_DEEP}, 0 5px 12px rgba(0,0,0,0.45)`,
                                }}
                            >
                                <div className="rounded-[10px] px-2.5 py-2 flex items-center gap-2.5" style={{ background: "linear-gradient(180deg, #2A1A0A 0%, #120802 100%)" }}>
                                    <div className="min-w-0 flex-1 leading-tight">
                                        <div className="flex items-baseline gap-1.5">
                                            <span
                                                className="font-display font-black text-[22px]"
                                                style={{ color: GOLD, textShadow: `0 2px 0 ${GOLD_DEEP}` }}
                                            >
                                                {capsuleCount}
                                            </span>
                                            <span className="font-display text-[11px] tracking-[0.16em] uppercase" style={{ color: `${GOLD}cc` }}>
                                                Capsule{capsuleCount === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-white/50 mt-0.5 leading-snug">
                                            Rip &apos;em open to find Pins!
                                        </div>
                                    </div>

                                    <ChunkyButton
                                        onClick={() => onOpenPinBook?.("capsules")}
                                        color={GOLD}
                                        deep={GOLD_DEEP}
                                        text="#1A0E02"
                                        style={{
                                            padding: "6px 10px",
                                            fontSize: 10,
                                            fontWeight: 900,
                                            letterSpacing: "0.18em",
                                        }}
                                    >
                                        OPEN
                                    </ChunkyButton>
                                </div>
                            </div>

                            {/* Extra Pins → Reroll */}
                            <div
                                className="rounded-xl p-[2px] transition-all duration-200 ease-out hover:-translate-y-[2px] hover:brightness-[1.08]"
                                style={{
                                    background: `linear-gradient(180deg, ${COSMIC} 0%, ${COSMIC_DEEP} 100%)`,
                                    boxShadow: `0 3px 0 ${COSMIC_DEEP}, 0 5px 12px rgba(0,0,0,0.45)`,
                                }}
                            >
                                <div
                                    className="rounded-[10px] px-2.5 py-2 flex items-center gap-2.5"
                                    style={{ background: "linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)" }}
                                >
                                    <div className="min-w-0 flex-1 leading-tight">
                                        <div className="flex items-baseline gap-1.5">
                                            <span
                                                className="font-display font-black text-[22px]"
                                                style={{
                                                    color: COSMIC,
                                                    textShadow: `0 2px 0 ${COSMIC_DEEP}`,
                                                }}
                                            >
                                                {extraPinsCount}
                                            </span>
                                            <span className="font-display text-[9px] tracking-[0.16em]" style={{ color: `${COSMIC}cc` }}>
                                                EXTRA PIN{extraPinsCount === 1 ? "" : "S"}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-white/50 mt-0.5 leading-snug">
                                            Burn duplicates, get new capsules.
                                        </div>
                                    </div>
                                    <ChunkyButton
                                        onClick={() => onOpenPinBook?.("capsules")}
                                        color={COSMIC}
                                        deep={COSMIC_DEEP}
                                        text="#fff"
                                        disabled={extraPinsCount === 0}
                                        style={{
                                            padding: "6px 10px",
                                            fontSize: 10,
                                            fontWeight: 900,
                                            letterSpacing: "0.18em",
                                        }}
                                    >
                                        REROLL
                                    </ChunkyButton>
                                </div>
                            </div>
                        </div>

                        {/* Recent Pulls */}
                        <div
                            className="flex-1 relative flex flex-col px-5 py-6"
                            style={{ background: `radial-gradient(circle at 50% 40%, ${COSMIC}22, transparent 60%)` }}
                        >
                            <div className="font-display text-[10px] tracking-[0.3em] mb-3" style={{ color: GOLD }}>
                                RECENT PULLS
                            </div>
                            {recentPulls.length === 0 ? (
                                <div className="text-[11px] text-white/40 leading-relaxed">
                                    No pins yet. Score 15,000+ to earn your first capsule.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5">
                                    {recentPulls.map(pin => {
                                        const meta = TIER_META[pin.tier];
                                        return (
                                            <button
                                                key={pin.id}
                                                type="button"
                                                onClick={() => onOpenPinBook?.()}
                                                className="rounded-xl p-[1.5px] cursor-pointer transition-all duration-200 ease-out hover:-translate-y-[2px] hover:brightness-[1.12] text-left w-full"
                                                style={{
                                                    background: `linear-gradient(180deg, ${meta.tint}55, ${meta.tint}22)`,
                                                }}
                                            >
                                                <div
                                                    className="rounded-[10px] px-2.5 py-2 flex items-center gap-3"
                                                    style={{ background: "linear-gradient(180deg, #1a0a2e, #0c0418)" }}
                                                >
                                                    <div
                                                        className="shrink-0 rounded-full overflow-hidden relative"
                                                        style={{
                                                            width: 40,
                                                            height: 40,
                                                            boxShadow: `0 2px 6px rgba(0,0,0,0.55), 0 0 0 2px ${GOLD_DEEP}`,
                                                        }}
                                                    >
                                                        <Image src={pin.image} alt="" fill sizes="40px" className="object-cover" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-display text-[12px] text-white leading-none truncate">
                                                                {pin.name}
                                                            </span>
                                                            {pin.isNew && (
                                                                <span
                                                                    className="shrink-0 font-display text-[8px] font-black uppercase tracking-[0.15em] px-1.5 py-[2px] rounded-sm"
                                                                    style={{
                                                                        color: "#0A2E12",
                                                                        background: "#2EFF2E",
                                                                        boxShadow: "0 0 10px rgba(46,255,46,0.45)",
                                                                    }}
                                                                >
                                                                    New
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div
                                                            className="text-[9px] font-bold tracking-[0.15em] uppercase mt-1"
                                                            style={{ color: `${meta.tint}cc` }}
                                                        >
                                                            {meta.label}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => onOpenPinBook?.()}
                                className="mt-3 w-full text-[10px] font-display tracking-[0.25em] py-2 rounded-lg cursor-pointer transition-all hover:brightness-125"
                                style={{ color: GOLD, border: `1px solid ${GOLD}44`, background: `${GOLD}0a` }}
                            >
                                VIEW ALL →
                            </button>
                        </div>
                    </div>

                    {/* ======== CENTER PLAY COLUMN ======== */}
                    <div
                        className="flex-1 relative flex flex-col items-stretch min-w-0"
                        style={{ minWidth: 500 }}
                    >
                        {/* Pin wall background */}
                        <FloatingBadges count={90} speed={0.8} />

                        {/* Top marquee — players count + daily reset countdown */}
                        <div
                            className="relative z-10 px-6 pt-2 pb-1.5"
                            style={{
                                background: "linear-gradient(180deg, #0a0418dd, #0a041877 80%, transparent)",
                                borderBottom: `1px solid ${GOLD}22`,
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-display text-[11px] tracking-[0.3em] text-white/65">
                                    {totalPlayers > 0
                                        ? `${totalPlayers.toLocaleString()} PLAYER${totalPlayers === 1 ? "" : "S"} VIBING`
                                        : "\u00A0"}
                                </span>
                                <div className="flex items-center gap-3 text-[11px] font-display">
                                    <span className="text-white/45 tracking-[0.3em]">DAILY RESET</span>
                                    <span className="tabular-nums" style={{ color: GOLD }}>{countdown}</span>
                                </div>
                            </div>
                        </div>

                        {/* Play stack — logo + cabinets + prize strip + nav.
                            flex-1 with justify-center so the whole cluster
                            vertically centers in the remaining space under
                            the marquee. Gaps give the logo clear breathing
                            room above the cabinets. */}
                        <div className="relative z-10 flex-1 px-6 pb-6 pt-4 flex flex-col justify-center items-center gap-6">
                            {/* Outer wrapper hosts the hover-scale so it doesn't
                                fight the inline `vmArcadeBob` keyframe on the
                                Image. Matches the production Quest logo treatment. */}
                            <div className="cursor-pointer transition-transform duration-300 hover:scale-105">
                                <Image
                                    src="/assets/logo.png"
                                    alt="VIBE MATCH"
                                    width={1000}
                                    height={627}
                                    priority
                                    className="w-[300px] h-auto"
                                    style={{
                                        filter: `drop-shadow(0 16px 30px ${GOLD}55)`,
                                        animation: "vmArcadeBob 3.2s ease-in-out infinite",
                                    }}
                                />
                            </div>

                        {/* Two mode cabinets side-by-side */}
                        <div className="w-full flex flex-col items-center">
                            <div className="grid grid-cols-2 gap-4 max-w-[640px] mx-auto w-full">
                                {/* Classic */}
                                <button
                                    type="button"
                                    onClick={() => onStartGame("classic", username, avatarUrl)}
                                    className="text-left outline-none cursor-pointer"
                                >
                                    <div
                                        className="relative rounded-2xl p-[3px] h-full transition-all duration-200 ease-out hover:-translate-y-[3px] hover:brightness-[1.08] active:translate-y-[1px] active:brightness-[0.95]"
                                        style={{
                                            background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 40%, ${GOLD_DEEP} 100%)`,
                                            boxShadow: `0 6px 0 ${GOLD_DEEP}, 0 12px 22px rgba(0,0,0,0.55), 0 0 40px ${GOLD}15`,
                                        }}
                                    >
                                        <div
                                            className="rounded-[14px] relative p-5 h-full flex flex-col items-center text-center overflow-hidden"
                                            style={{ background: "linear-gradient(180deg, #2A1A0A 0%, #120802 100%)" }}
                                        >
                                            <div
                                                className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
                                                style={{ background: `linear-gradient(180deg, ${GOLD}16, transparent)` }}
                                            />
                                            <div
                                                className="relative mb-3 rounded-full flex flex-col items-center justify-center overflow-hidden"
                                                style={{
                                                    width: 82,
                                                    height: 82,
                                                    background: `radial-gradient(circle at 35% 30%, #FFF4B0, ${GOLD} 55%, ${GOLD_DEEP})`,
                                                    boxShadow: `inset 0 -5px 9px ${GOLD_DEEP}, 0 4px 10px rgba(0,0,0,0.6), 0 0 25px ${GOLD}55`,
                                                    border: "3px solid #2A1A0A",
                                                }}
                                            >
                                                <span
                                                    className="mt-[4px] font-display font-black leading-none"
                                                    style={{
                                                        color: "#1A0633",
                                                        fontSize: 34,
                                                        textShadow: "0 2px 0 rgba(255,255,255,0.25)",
                                                    }}
                                                >
                                                    30
                                                </span>
                                                <span className="mt-[1px] text-[8px] font-bold tracking-wider" style={{ color: "#1A0633" }}>
                                                    MOVES
                                                </span>
                                            </div>
                                            <h2
                                                className="font-display font-black uppercase leading-none text-[26px]"
                                                style={{ color: GOLD, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                                            >
                                                Classic
                                            </h2>
                                            <h3
                                                className="font-display font-black uppercase leading-none text-[20px] mt-1"
                                                style={{ color: GOLD }}
                                            >
                                                VibeMatch
                                            </h3>
                                            <p className="text-white/55 text-[12px] mt-2">
                                                Match pins and score as high as you can.
                                            </p>
                                            <div className="mt-4">
                                                <ChunkyButton
                                                    color={GOLD}
                                                    deep={GOLD_DEEP}
                                                    style={{
                                                        padding: "10px 22px",
                                                        fontSize: 12,
                                                        fontWeight: 900,
                                                        letterSpacing: "0.15em",
                                                    }}
                                                >
                                                    PLAY
                                                </ChunkyButton>
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Daily */}
                                <button
                                    type="button"
                                    onClick={() => onStartGame("daily", username, avatarUrl)}
                                    className="text-left outline-none cursor-pointer"
                                >
                                    <div
                                        className="relative rounded-2xl p-[3px] h-full transition-all duration-200 ease-out hover:-translate-y-[3px] hover:brightness-[1.08] active:translate-y-[1px] active:brightness-[0.95]"
                                        style={{
                                            background: `linear-gradient(180deg, #D8A0FF 0%, ${COSMIC} 40%, ${COSMIC_DEEP} 100%)`,
                                            boxShadow: `0 6px 0 #4A1A80, 0 12px 22px rgba(0,0,0,0.55), 0 0 40px ${COSMIC}22`,
                                        }}
                                    >
                                        <div
                                            className="rounded-[14px] relative p-5 h-full flex flex-col items-center text-center overflow-hidden"
                                            style={{ background: "linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)" }}
                                        >
                                            <div
                                                className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
                                                style={{ background: `linear-gradient(180deg, ${COSMIC}16, transparent)` }}
                                            />
                                            <div
                                                className="relative mb-3 rounded-full flex items-center justify-center"
                                                style={{
                                                    width: 82,
                                                    height: 82,
                                                    background: `radial-gradient(circle at 35% 30%, #E8C0FF, ${COSMIC} 55%, ${COSMIC_DEEP})`,
                                                    boxShadow: `inset 0 -5px 9px ${COSMIC_DEEP}, 0 4px 10px rgba(0,0,0,0.6), 0 0 28px ${COSMIC}77`,
                                                }}
                                            >
                                                <span className="font-display font-black text-[38px]" style={{ color: "#1A0633" }}>
                                                    ★
                                                </span>
                                            </div>
                                            <h2
                                                className="font-display font-black uppercase leading-none text-[22px]"
                                                style={{ color: COSMIC, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                                            >
                                                The Daily
                                            </h2>
                                            <h3
                                                className="font-display font-black uppercase leading-none text-[22px] mt-1"
                                                style={{ color: COSMIC }}
                                            >
                                                Challenge
                                            </h3>
                                            <p className="text-white/55 text-[12px] mt-2">
                                                1 shot per day, same board for everyone.
                                            </p>
                                            <div className="mt-4">
                                                <ChunkyButton
                                                    color={COSMIC}
                                                    deep={COSMIC_DEEP}
                                                    text="#fff"
                                                    style={{
                                                        padding: "10px 22px",
                                                        fontSize: 12,
                                                        fontWeight: 900,
                                                        letterSpacing: "0.15em",
                                                    }}
                                                >
                                                    PLAY
                                                </ChunkyButton>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Prize Games strip */}
                            <div className="max-w-[640px] mx-auto w-full mt-4">
                                <button
                                    type="button"
                                    onClick={onOpenBuyPrizeGames}
                                    className="w-full rounded-xl p-[2px] cursor-pointer transition-all duration-200 ease-out hover:-translate-y-[2px] hover:brightness-[1.12]"
                                    style={{
                                        background: `linear-gradient(180deg, ${accent} 0%, ${accentDeep} 100%)`,
                                        boxShadow: `0 3px 0 ${accentDeep}, 0 5px 14px rgba(0,0,0,0.5)${empty ? `, 0 0 22px ${RED}66` : ""}`,
                                        animation: empty ? "vmRestockPulse 1.4s ease-in-out infinite" : undefined,
                                    }}
                                >
                                    <div
                                        className="rounded-[10px] px-4 py-2.5 flex items-center gap-4"
                                        style={{ background: "linear-gradient(180deg, #1a0e03, #0a0502)" }}
                                    >
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Image
                                                src="/badges/any_gvc_1759173799963.webp"
                                                alt=""
                                                width={32}
                                                height={32}
                                                style={{
                                                    objectFit: "contain",
                                                    filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 8px ${accent}66)${empty ? " grayscale(0.3)" : ""}`,
                                                }}
                                            />
                                            <div className="flex flex-col leading-none text-left">
                                                <span
                                                    className="font-display font-black uppercase text-[11px]"
                                                    style={{ color: accent }}
                                                >
                                                    {empty ? "Out of Plays" : "Prize Games"}
                                                </span>
                                                <span className="text-[9px] text-white/45 tracking-wider mt-0.5">
                                                    {remaining} OF {total}{bonusPrizeGames > 0 ? ` · +${bonusPrizeGames} BONUS` : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className="flex-1 relative h-2.5 rounded-full overflow-hidden"
                                            style={{
                                                background: "rgba(255,255,255,0.07)",
                                                boxShadow: empty ? `inset 0 0 0 1px ${RED}66` : undefined,
                                            }}
                                        >
                                            <div
                                                className="absolute inset-y-0 left-0 rounded-full transition-all"
                                                style={{
                                                    width: `${pct}%`,
                                                    background: `linear-gradient(90deg, ${accent}, ${accentLight})`,
                                                    boxShadow: `0 0 10px ${accent}aa`,
                                                }}
                                            />
                                            {total > 1 && [...Array(total - 1)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute top-0 bottom-0 w-px"
                                                    style={{
                                                        left: `${((i + 1) / total) * 100}%`,
                                                        background: "rgba(0,0,0,0.55)",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <ChunkyButton
                                            color={accent}
                                            deep={accentDeep}
                                            text={accentText}
                                            style={{
                                                padding: "8px 14px",
                                                fontSize: 11,
                                                fontWeight: 900,
                                                letterSpacing: "0.12em",
                                            }}
                                        >
                                            {empty ? "RESTOCK NOW" : "+ RESTOCK"}
                                        </ChunkyButton>
                                    </div>
                                </button>
                            </div>

                            {/* Arcade nav row */}
                            <div
                                className="max-w-[640px] mx-auto w-full mt-4 rounded-xl p-[2px]"
                                style={{
                                    background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 40%, ${GOLD_DEEP} 100%)`,
                                    boxShadow: `0 3px 0 ${GOLD_DEEP}, 0 5px 14px rgba(0,0,0,0.5)`,
                                }}
                            >
                                <div
                                    className="rounded-[10px] px-2 py-1.5 relative overflow-hidden"
                                    style={{ background: "linear-gradient(180deg, #1a0e03, #0a0502)" }}
                                >
                                    <div
                                        className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
                                        style={{ background: `linear-gradient(180deg, ${GOLD}10, transparent)` }}
                                    />
                                    <div className="grid grid-cols-5 relative z-10 gap-1.5">
                                        {[
                                            { label: "Profile", onClick: () => setProfileOpen(true), icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>) },
                                            { label: "Pins", onClick: () => onOpenPinBook?.(), icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>) },
                                            { label: "Quests", onClick: onOpenAchievements, icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>) },
                                            { label: "Leaders", onClick: () => setLeaderboardOpen(true), icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>) },
                                            { label: "Rules", onClick: onShowInstructions, icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>) },
                                        ].map(({ label, onClick, icon }) => (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={onClick}
                                                className="group rounded-lg p-[1.5px] cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                                                style={{
                                                    background: `linear-gradient(180deg, ${GOLD}55 0%, ${GOLD_DEEP}55 100%)`,
                                                    boxShadow: `0 2px 0 ${GOLD_DEEP}88`,
                                                }}
                                            >
                                                <div
                                                    className="rounded-[7px] flex flex-col items-center justify-center gap-1 py-2 px-1"
                                                    style={{
                                                        background: "linear-gradient(180deg, #2A1A0A 0%, #120802 100%)",
                                                        color: GOLD,
                                                    }}
                                                >
                                                    {icon}
                                                    <span
                                                        className="font-display font-black text-[9px] tracking-[0.18em] uppercase"
                                                        style={{ color: GOLD }}
                                                    >
                                                        {label}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sign-out pill — lives below the nav so it reads as a tertiary
                                action without competing with the main CTAs. Matches the
                                production Quest treatment. */}
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 hover:border-white/40 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/70 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer transition-all"
                            >
                                <LogOut size={12} />
                                <span>Sign Out of VibeMatch</span>
                            </button>
                            </div>
                        </div>
                    </div>

                    {/* ======== RIGHT PANEL ======== */}
                    <div
                        className="relative shrink-0 flex flex-col"
                        style={{
                            width: 300,
                            background: "linear-gradient(180deg, #2D0B4E 0%, #180630 100%)",
                            borderLeft: `1px solid ${GOLD}15`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setProfileOpen(true)}
                            className="relative text-left px-5 pt-6 pb-5 border-b border-white/5 cursor-pointer transition-all hover:bg-white/[0.04]"
                        >
                            <div className="relative flex flex-col items-center gap-2.5">
                                {/* Avatar — Option A: soft breathing gold halo,
                                    no rays, no sparkles. Cleanest treatment —
                                    the rotating gold ring is the only real
                                    adornment, and the halo gives it a subtle
                                    breath. */}
                                <div
                                    className="relative"
                                    style={{
                                        width: 82,
                                        height: 82,
                                        animation: "vmAvatarBounce 3.6s ease-in-out infinite",
                                    }}
                                >
                                    {/* Soft gold halo that breathes */}
                                    <div
                                        className="absolute rounded-full pointer-events-none"
                                        style={{
                                            inset: -18,
                                            background: `radial-gradient(circle, ${GOLD}bf 0%, ${GOLD}59 40%, transparent 75%)`,
                                            filter: "blur(6px)",
                                            animation: "vmAvatarGlow 3.6s ease-in-out infinite",
                                        }}
                                    />
                                    {/* Rotating gold conic ring */}
                                    <div
                                        className="absolute inset-0 rounded-full"
                                        style={{
                                            background: `conic-gradient(from 0deg, ${GOLD} 0deg, ${GOLD}00 90deg, ${GOLD} 180deg, ${GOLD}00 270deg, ${GOLD} 360deg)`,
                                            animation: "vmProfileSpin 8s linear infinite",
                                            padding: 2,
                                        }}
                                    >
                                        <div className="w-full h-full rounded-full" style={{ background: "#180630" }} />
                                    </div>
                                    {/* Inner avatar */}
                                    <div
                                        className="absolute rounded-full overflow-hidden flex items-center justify-center"
                                        style={{
                                            inset: 4,
                                            background: `linear-gradient(135deg, ${COSMIC}, ${PINK})`,
                                            boxShadow: `inset 0 -6px 14px ${COSMIC_DEEP}, inset 0 3px 6px rgba(255,255,255,0.2)`,
                                        }}
                                    >
                                        {avatarUrl ? (
                                            <Image
                                                src={avatarUrl}
                                                alt=""
                                                fill
                                                sizes="74px"
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="text-[38px] leading-none">🏄</div>
                                        )}
                                    </div>
                                </div>

                                <div
                                    className="font-display font-black text-white leading-none"
                                    style={{
                                        fontSize: 19,
                                        textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 12px ${GOLD}44`,
                                    }}
                                >
                                    {username}
                                </div>

                                <div
                                    className="rounded-full px-2.5 py-1 flex items-center"
                                    style={{
                                        background: `linear-gradient(180deg, ${tier.color}33, ${tier.accent}44)`,
                                        border: `1px solid ${tier.color}55`,
                                    }}
                                >
                                    <span
                                        className="font-display text-[9px] tracking-[0.18em] uppercase"
                                        style={{ color: tier.color }}
                                    >
                                        {tier.label}
                                        {pinRank !== null ? ` · RANK #${pinRank}` : ""}
                                    </span>
                                </div>

                                <div className="w-full mt-2">
                                    <div className="flex items-baseline justify-between mb-1 gap-2">
                                        <span className="font-display text-[9px] tracking-[0.22em]" style={{ color: `${GOLD}bb` }}>
                                            PINS COLLECTED
                                        </span>
                                        <span
                                            className="font-display font-black text-[10px] tabular-nums whitespace-nowrap"
                                            style={{ color: GOLD }}
                                        >
                                            {pinsCollected}<span className="opacity-45">/{totalBadges}</span>
                                            <span className="opacity-55"> ({pinPct}%)</span>
                                        </span>
                                    </div>
                                    <div
                                        className="relative h-2 rounded-full overflow-hidden"
                                        style={{
                                            background: "rgba(255,255,255,0.08)",
                                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full"
                                            style={{
                                                width: `${pinPct}%`,
                                                background: `linear-gradient(90deg, ${GOLD}, #FFF4B0, ${GOLD})`,
                                                boxShadow: `0 0 8px ${GOLD}aa, inset 0 1px 0 rgba(255,255,255,0.4)`,
                                            }}
                                        />
                                        {[25, 50, 75].map(p => (
                                            <div
                                                key={p}
                                                className="absolute top-0 bottom-0 w-px"
                                                style={{ left: `${p}%`, background: "rgba(0,0,0,0.5)" }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Quests completed */}
                                <div className="w-full mt-2">
                                    <div className="flex items-baseline justify-between mb-1 gap-2">
                                        <span className="font-display text-[9px] tracking-[0.22em]" style={{ color: `${COSMIC}bb` }}>
                                            QUESTS COMPLETED
                                        </span>
                                        <span
                                            className="font-display font-black text-[10px] tabular-nums whitespace-nowrap"
                                            style={{ color: COSMIC }}
                                        >
                                            {questsCompleted}<span className="opacity-45">/{totalQuests}</span>
                                            <span className="opacity-55"> ({questPct}%)</span>
                                        </span>
                                    </div>
                                    <div
                                        className="relative h-2 rounded-full overflow-hidden"
                                        style={{
                                            background: "rgba(255,255,255,0.08)",
                                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full"
                                            style={{
                                                width: `${questPct}%`,
                                                background: `linear-gradient(90deg, ${COSMIC}, #D8A0FF, ${COSMIC})`,
                                                boxShadow: `0 0 8px ${COSMIC}aa, inset 0 1px 0 rgba(255,255,255,0.4)`,
                                            }}
                                        />
                                        {[25, 50, 75].map(p => (
                                            <div
                                                key={p}
                                                className="absolute top-0 bottom-0 w-px"
                                                style={{ left: `${p}%`, background: "rgba(0,0,0,0.5)" }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div className="grid grid-cols-2 gap-1.5 w-full mt-1.5">
                                    <div
                                        className="rounded-lg px-2 py-2 flex flex-col items-center justify-center"
                                        style={{
                                            background: `linear-gradient(180deg, ${ORANGE}1A, ${ORANGE}08)`,
                                            border: `1px solid ${ORANGE}44`,
                                        }}
                                    >
                                        <div
                                            className="font-display font-black text-[15px] tabular-nums leading-none"
                                            style={{ color: ORANGE }}
                                        >
                                            {streak}
                                        </div>
                                        <div className="font-display text-[8px] tracking-[0.15em] mt-1" style={{ color: `${ORANGE}cc` }}>
                                            DAY STREAK
                                        </div>
                                    </div>
                                    <div
                                        className="rounded-lg px-2 py-2 flex flex-col items-center justify-center"
                                        style={{
                                            background: `linear-gradient(180deg, ${GOLD}1A, ${GOLD}08)`,
                                            border: `1px solid ${GOLD}44`,
                                        }}
                                    >
                                        <div
                                            className="font-display font-black text-[15px] tabular-nums leading-none"
                                            style={{ color: GOLD }}
                                        >
                                            {personalBest > 0
                                                ? personalBest >= 1000
                                                    ? `${Math.round(personalBest / 1000)}K`
                                                    : String(personalBest)
                                                : "—"}
                                        </div>
                                        <div className="font-display text-[8px] tracking-[0.15em] mt-1" style={{ color: `${GOLD}cc` }}>
                                            BEST SCORE
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Recent Runs */}
                        <div
                            className="flex-1 relative flex flex-col items-stretch justify-start px-5 py-6"
                            style={{ background: `radial-gradient(circle at 50% 40%, ${GOLD}14, transparent 60%)` }}
                        >
                            <div className="font-display text-[10px] tracking-[0.3em] mb-3 self-start" style={{ color: GOLD }}>
                                RECENT RUNS
                            </div>
                            {taggedRuns.length === 0 ? (
                                <div className="text-[11px] text-white/40 leading-relaxed">
                                    No runs yet. Play a game to see your history here.
                                </div>
                            ) : (
                                <div className="w-full flex flex-col gap-2">
                                    {taggedRuns.map((run, i) => {
                                        const labelColor = i === 0 && run.tag === "NEW BEST"
                                            ? GOLD
                                            : run.mode === "daily"
                                                ? ORANGE
                                                : i < 2
                                                    ? "#ffffff88"
                                                    : "#ffffff55";
                                        return (
                                            <div
                                                key={`${run.timestamp}-${i}`}
                                                className="rounded-lg px-3 py-2 flex items-center justify-between gap-2 transition-all hover:bg-white/[0.06] hover:translate-x-[2px]"
                                                style={{
                                                    background: "rgba(255,255,255,0.04)",
                                                    border: `1px solid ${GOLD}15`,
                                                }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className="font-display text-[11px] font-black shrink-0"
                                                        style={{ color: labelColor }}
                                                    >
                                                        {run.label}
                                                    </span>
                                                    {run.tag && (
                                                        <span
                                                            className="font-display text-[8px] tracking-[0.18em] px-1.5 py-[2px] rounded-sm"
                                                            style={{
                                                                color: run.tag === "NEW BEST" ? "#1A0E02" : "#fff",
                                                                background: run.tag === "NEW BEST" ? GOLD : `${ORANGE}cc`,
                                                            }}
                                                        >
                                                            {run.tag}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-display font-black tabular-nums text-[12px] text-white/85">
                                                    {run.score.toLocaleString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Animations */}
                <style jsx>{`
                    @keyframes vmArcadeBob {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-5px); }
                    }
                    @keyframes vmProfileSpin {
                        to { transform: rotate(360deg); }
                    }
                    @keyframes vmAvatarBounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-3px); }
                    }
                    @keyframes vmAvatarGlow {
                        0%, 100% { opacity: 0.65; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.08); }
                    }
                    @keyframes vmRestockPulse {
                        0%, 100% { box-shadow: 0 3px 0 ${accentDeep}, 0 5px 14px rgba(0,0,0,0.5), 0 0 14px ${RED}55; }
                        50% { box-shadow: 0 3px 0 ${accentDeep}, 0 5px 14px rgba(0,0,0,0.5), 0 0 28px ${RED}cc; }
                    }
                `}</style>
            </div>

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
            {isLeaderboardOpen && (
                <LeaderboardModal
                    onClose={() => setLeaderboardOpen(false)}
                    currentUsername={username}
                />
            )}
        </>
    );
}
