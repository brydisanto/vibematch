"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Info } from "lucide-react";
import {
    Badge,
    BADGES,
    TIER_COLORS,
    TIER_DISPLAY_NAMES,
    BadgeTier,
} from "@/lib/badges";

interface PinBookProps {
    isOpen: boolean;
    onClose: () => void;
    /** mode="one" opens a single capsule (or starts a chain for 2-5 count that the
     *  user can escape from). mode="all" opens every capsule and jumps to a
     *  single hero reveal + summary grid. */
    onOpenCapsule: (mode: "one" | "all") => void;
    onOpenReroll?: () => void;
    onOpenBuyPrizeGames?: () => void;
    onStartGame?: () => void;
    pins: Record<string, { count: number; firstEarned: string }>;
    unopenedCapsules: number;
    prizeGamesRemaining?: number;
    currentUsername?: string;
    /** Tab to show when the modal opens. Defaults to "collection". */
    initialTab?: "collection" | "leaderboard" | "capsules";
}

const TIER_ORDER: BadgeTier[] = ["cosmic", "gold", "special", "silver", "blue"];

const TIER_GLOW: Record<BadgeTier, string> = {
    cosmic: "0 0 12px rgba(179, 102, 255, 0.6), 0 0 24px rgba(179, 102, 255, 0.25)",
    gold: "0 0 12px rgba(255, 224, 72, 0.5), 0 0 24px rgba(255, 224, 72, 0.2)",
    special: "rgba(255, 140, 66, 0.5)",
    silver: "0 0 12px rgba(74, 158, 255, 0.5), 0 0 24px rgba(74, 158, 255, 0.2)",
    blue: "0 0 10px rgba(224, 224, 224, 0.3), 0 0 20px rgba(224, 224, 224, 0.1)",
};

// --- PinBook Leaderboard ---

interface PinLeaderboardEntry {
    username: string;
    avatarUrl: string;
    uniqueCount: number;
    totalPins: number;
    percentComplete: number;
    pinScore: number;
}

// Shared avatar cache across PinBook avatars
const pinAvatarCache = new Map<string, string>();

function PinLeaderboardAvatar({ entry, size = 36 }: { entry: PinLeaderboardEntry; size?: number }) {
    const [src, setSrc] = useState(entry.avatarUrl || pinAvatarCache.get(entry.username.toLowerCase()) || "");

    useEffect(() => {
        if (src) return;
        const key = entry.username.toLowerCase();
        if (pinAvatarCache.has(key)) {
            setSrc(pinAvatarCache.get(key)!);
            return;
        }
        fetch(`/api/profiles?username=${encodeURIComponent(entry.username)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                const url = d?.profile?.avatarUrl || "";
                pinAvatarCache.set(key, url);
                if (url) setSrc(url);
            })
            .catch(() => {});
    }, [entry.username, src]);

    return (
        <div className="rounded-full bg-[#2A1845] border border-[#3A2855] overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ width: size, height: size }}>
            {src ? (
                <Image src={src} alt={entry.username} width={size} height={size} className="object-cover w-full h-full" />
            ) : (
                <span className="text-white/20 font-bold uppercase" style={{ fontSize: size * 0.3 }}>
                    {entry.username.substring(0, 2)}
                </span>
            )}
        </div>
    );
}

function PinLeaderboard({ currentUsername, refreshKey }: { currentUsername?: string; refreshKey?: number }) {
    const [entries, setEntries] = useState<PinLeaderboardEntry[]>([]);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                setIsLoading(prev => entries.length === 0 ? true : prev);
                const res = await fetch('/api/pinbook/leaderboard');
                if (!res.ok) return;
                const data = await res.json();
                setEntries(data.leaderboard || []);
                setTotalPlayers(data.totalPlayers || (data.leaderboard || []).length);
            } catch {
                // ignore
            } finally {
                setIsLoading(false);
            }
        })();
    }, [refreshKey]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 px-5 py-6">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-7 h-4 bg-white/5 rounded" />
                        <div className="w-9 h-9 rounded-full bg-white/5" />
                        <div className="flex-1 h-4 bg-white/5 rounded" style={{ width: `${60 - i * 8}%` }} />
                        <div className="w-20 h-4 bg-white/5 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 text-center px-6">
                <Trophy size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-sm">No collectors yet</p>
                <p className="text-xs mt-2 text-white/20">Open capsules to start your collection!</p>
            </div>
        );
    }

    return (
        <div className="px-3 py-2">
            {totalPlayers > 0 && (
                <div className="text-center py-2 mb-1">
                    <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
                        {totalPlayers.toLocaleString()} collector{totalPlayers !== 1 ? "s" : ""} vibing
                    </span>
                </div>
            )}
            {entries.map((entry, i) => {
                const rank = i + 1;
                const isUser = entry.username.toLowerCase() === currentUsername?.toLowerCase();
                const isTop3 = rank <= 3;
                const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

                return (
                    <div
                        key={entry.username}
                        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
                            isUser ? "bg-[#B366FF]/10 border border-[#B366FF]/20" : "hover:bg-white/[0.03]"
                        }`}
                    >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-7 text-center font-bold text-sm"
                            style={{ color: isTop3 ? medalColors[rank - 1] : "rgba(255,255,255,0.4)" }}>
                            {rank}
                        </div>

                        {/* Avatar */}
                        <PinLeaderboardAvatar entry={entry} size={36} />

                        {/* Name + unique count */}
                        <div className="flex-1 min-w-0">
                            <div className="font-display font-extrabold text-base tracking-[0.03em] text-white/90 truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                {isUser ? (
                                    <><span>{entry.username}</span><span className="ml-1.5 text-[9px] font-extrabold text-[#B366FF] bg-[#B366FF]/15 px-1.5 py-0.5 rounded tracking-wider">YOU</span></>
                                ) : entry.username}
                            </div>
                            <div className="text-[10px] text-white/30 font-bold mt-0.5">
                                {entry.uniqueCount}/{BADGES.length} pins collected ({entry.totalPins} total)
                            </div>
                        </div>

                        {/* % Complete */}
                        <div className="flex-shrink-0 text-right">
                            <div className="font-display font-extrabold text-base tracking-[0.03em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                style={{ color: entry.percentComplete === 100 ? "#FFD700" : "#B366FF" }}>
                                {entry.percentComplete}%
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// --- Main PinBook Component ---

/* ── Onboarding content — shared between empty state and info modal ── */
function PinBookOnboarding({ onAction, actionLabel }: { onAction?: () => void; actionLabel?: string }) {
    return (
        <div className="space-y-5">
            {/* Hero */}
            <div className="text-center">
                <div
                    className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                    style={{
                        background: "linear-gradient(135deg, rgba(255,224,72,0.12), rgba(179,102,255,0.12))",
                        border: "1px solid rgba(255,224,72,0.2)",
                    }}
                >
                    <img src="/assets/gvc_shaka.png" alt="" className="w-9 h-9 object-contain" />
                </div>
                <h2
                    className="font-display text-xl font-black uppercase tracking-wider mb-2"
                    style={{
                        background: "linear-gradient(135deg, #FFE048, #B366FF)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Collect 101 GVC Pins
                </h2>
                <p className="text-white/60 text-[13px] font-mundial leading-relaxed max-w-[300px] mx-auto">
                    Every game is a chance to discover rare pins. Score big to earn capsules, then crack them open to see what&apos;s inside.
                </p>
            </div>

            {/* Tier showcase */}
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-center">
                Pull Rates
            </h3>
            <div className="flex gap-1.5 justify-center">
                {([
                    { tier: "blue" as BadgeTier, label: "Common", pct: "45%" },
                    { tier: "silver" as BadgeTier, label: "Rare", pct: "30%" },
                    { tier: "special" as BadgeTier, label: "Specials", pct: "13%" },
                    { tier: "gold" as BadgeTier, label: "Legend", pct: "9%" },
                    { tier: "cosmic" as BadgeTier, label: "Cosmic", pct: "3%" },
                ]).map(t => (
                    <div
                        key={t.tier}
                        className="flex-1 min-w-0 rounded-xl p-2 text-center"
                        style={{
                            background: `${TIER_COLORS[t.tier]}08`,
                            border: `1px solid ${TIER_COLORS[t.tier]}18`,
                        }}
                    >
                        <div
                            className="w-9 h-9 rounded-full mx-auto mb-1.5 flex items-center justify-center text-[9px] font-black"
                            style={{
                                border: `2px solid ${TIER_COLORS[t.tier]}60`,
                                color: TIER_COLORS[t.tier],
                                background: `${TIER_COLORS[t.tier]}10`,
                            }}
                        >
                            {t.label.charAt(0)}
                        </div>
                        <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: TIER_COLORS[t.tier] }}>
                            {t.label}
                        </div>
                        <div className="text-[10px] font-semibold mt-0.5" style={{ color: TIER_COLORS[t.tier] }}>{t.pct}</div>
                    </div>
                ))}
            </div>

            {/* Capsule scoring */}
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-center">
                Higher Scores, More Capsules
            </h3>
            <div
                className="flex justify-center items-center gap-4 py-3 px-4 rounded-xl"
                style={{
                    background: "rgba(255,224,72,0.03)",
                    border: "1px solid rgba(255,224,72,0.08)",
                }}
            >
                {[
                    { score: "15K+", reward: "1 capsule" },
                    { score: "30K+", reward: "2 capsules" },
                    { score: "50K+", reward: "3 capsules" },
                ].map((c, i) => (
                    <div key={c.score} className="flex items-center gap-4">
                        <div className="text-center">
                            <div className="text-[#FFE048] text-base font-display font-black">{c.score}</div>
                            <div className="text-white/40 text-[9px] font-mundial">{c.reward}</div>
                        </div>
                        {i < 2 && <span className="text-white/15 text-lg">&rarr;</span>}
                    </div>
                ))}
            </div>

            {/* How to earn */}
            <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-center mb-3">
                    How to Earn Capsules
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { title: "Score Big", desc: <>Hit <strong className="text-white/70">15K+</strong> in Classic or Daily to earn capsules. Win extras at <strong className="text-white/70">30K</strong> &amp; <strong className="text-white/70">50K</strong>.</> },
                        { title: "Form Shapes", desc: <>Land a <strong className="text-white/70">T</strong> or <strong className="text-white/70">Cross</strong> to win 1 bonus capsule.</> },
                        { title: "Complete Quests", desc: <>Unlock achievements for <strong className="text-white/70">bonus capsules</strong></> },
                        { title: "Reroll Extras", desc: <>Burn duplicate pins for new capsules. Requires <strong className="text-white/70">$VIBESTR</strong>.</> },
                    ].map(card => (
                        <div
                            key={card.title}
                            className="rounded-xl p-3 text-center"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            <div className="text-[11px] font-bold text-[#FFE048] uppercase tracking-wider mb-1">{card.title}</div>
                            <div className="text-[10px] text-white/45 leading-relaxed font-mundial">{card.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily prize games callout */}
            <div
                className="rounded-xl p-4 text-center"
                style={{
                    background: "linear-gradient(135deg, rgba(179,102,255,0.08), rgba(255,224,72,0.05))",
                    border: "1px solid rgba(179,102,255,0.15)",
                }}
            >
                <p className="font-display font-black text-base text-white uppercase tracking-wide mb-1">
                    10 Free Games Per Day
                </p>
                <p className="text-white/50 text-[11px] font-mundial leading-relaxed">
                    Plus the <strong className="text-[#B366FF] font-bold">Daily Challenge</strong> for bonus capsules.
                    <br />
                    Need more? Grab bonus games with <strong className="text-[#FFE048] font-bold">$VIBESTR</strong>. Every pin is earnable for free.
                </p>
            </div>

            {/* CTA */}
            {onAction && (
                <div className="text-center">
                    <button
                        onClick={onAction}
                        className="w-full py-4 rounded-xl font-display font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                        style={{
                            background: "linear-gradient(135deg, #FFE048 0%, #c9a84c 100%)",
                            color: "#1A0633",
                            boxShadow: "0 2px 0 #8B6914, 0 4px 12px rgba(255,224,72,0.3)",
                        }}
                    >
                        {actionLabel || "Start Playing"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function PinBook({
    isOpen,
    onClose,
    onOpenCapsule,
    onOpenReroll,
    onOpenBuyPrizeGames,
    onStartGame,
    pins,
    unopenedCapsules,
    prizeGamesRemaining = 10,
    currentUsername,
    initialTab = "collection",
}: PinBookProps) {
    const [tab, setTab] = useState<"collection" | "leaderboard" | "capsules">(initialTab);
    const [showInfo, setShowInfo] = useState(false);

    // If the caller bumps initialTab while the modal is already mounted, reset.
    useEffect(() => {
        if (isOpen) setTab(initialTab);
    }, [isOpen, initialTab]);

    const ownedCount = useMemo(
        () => Object.keys(pins).length,
        [pins]
    );

    const duplicateCount = useMemo(
        () => Object.values(pins).reduce((sum, p) => sum + Math.max(0, p.count - 1), 0),
        [pins]
    );

    // Derive a refresh key from total pin count so leaderboard refetches after capsule opens
    const leaderboardRefreshKey = useMemo(
        () => Object.values(pins).reduce((sum, p) => sum + p.count, 0),
        [pins]
    );

    const totalCount = BADGES.length;

    const progressPercent = useMemo(
        () => Math.round((ownedCount / totalCount) * 100),
        [ownedCount, totalCount]
    );

    const groupedBadges = useMemo(() => {
        const groups: Record<BadgeTier, Badge[]> = {
            cosmic: [],
            gold: [],
            special: [],
            silver: [],
            blue: [],
        };
        for (const badge of BADGES) {
            groups[badge.tier].push(badge);
        }
        return groups;
    }, []);

    return (
        <>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/85"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal Panel */}
                    <motion.div
                        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
                        style={{
                            background:
                                "linear-gradient(180deg, #3A1061 0%, #21083B 50%, #110321 100%)",
                            boxShadow:
                                "0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(179,102,255,0.4), 0 0 40px rgba(156,101,240,0.2)",
                        }}
                        initial={{ scale: 0.85, y: 40, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.85, y: 40, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ── Sticky Header ── */}
                        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#3A1061] to-[#3A1061] px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
                            {/* Title Row */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 0 20px rgba(255, 224, 72, 0.3)" }}>
                                        <Image src="/badges/any_gvc_1759173799963.webp" alt="Pin Capsule" width={40} height={40} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h2 className="font-display text-xl sm:text-2xl font-black text-white tracking-wide">
                                            My Pin Book
                                        </h2>
                                        <p className="text-white/40 text-[11px] font-mundial mt-0.5">
                                            Collect &apos;em all for immaculate vibes!
                                        </p>
                                    </div>
                                </div>

                                {/* Close + Info */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowInfo(true)}
                                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                        title="How Pin Collection Works"
                                    >
                                        <Info size={14} className="text-white/60" />
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                    >
                                        <X
                                            size={16}
                                            className="text-white/60"
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div>
                                <div className="flex items-baseline justify-between mb-1.5">
                                    <span className="text-white/60 text-xs font-mundial font-bold tracking-wide">
                                        {ownedCount}{" "}
                                        <span className="text-white/30">
                                            / {totalCount}
                                        </span>{" "}
                                        <span className="text-white/40">
                                            Collected
                                        </span>
                                    </span>
                                    <span className="text-white/50 text-lg font-display font-black">
                                        {progressPercent}%
                                    </span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{
                                            background:
                                                "linear-gradient(90deg, #6C5CE7, #B366FF, #D4A0FF)",
                                            boxShadow:
                                                "0 0 12px rgba(179, 102, 255, 0.5)",
                                        }}
                                        initial={{ width: 0 }}
                                        animate={{
                                            width: `${progressPercent}%`,
                                        }}
                                        transition={{
                                            duration: 1,
                                            ease: "easeOut",
                                            delay: 0.3,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Tab Bar */}
                            <div className="flex bg-white/5 p-1 rounded-xl w-full mt-3 gap-0.5">
                                {([
                                    { id: "collection" as const, label: "Collection" },
                                    { id: "leaderboard" as const, label: "Leaderboard" },
                                    { id: "capsules" as const, label: `Capsules${unopenedCapsules > 0 ? ` (${unopenedCapsules})` : ""}` },
                                ]).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTab(t.id)}
                                        className={`relative flex-1 py-2 text-center text-[10px] sm:text-xs font-bold uppercase transition-all rounded-lg ${
                                            tab === t.id
                                                ? t.id === "capsules" ? "bg-[#B366FF] text-white shadow-sm" : "bg-white text-black shadow-sm"
                                                : "text-white/40 hover:text-white/80"
                                        }`}
                                    >
                                        {t.id === "capsules" ? "Capsules" : t.label}
                                        {t.id === "capsules" && unopenedCapsules > 0 && (
                                            <span
                                                className="absolute -top-1.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
                                                style={{
                                                    background: "#FF5F1F",
                                                    boxShadow: "0 0 8px rgba(255,95,31,0.6)",
                                                }}
                                            >
                                                {unopenedCapsules}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Scrollable Content ── */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {tab === "capsules" ? (
                            /* ── Capsules Tab ── */
                            <div className="px-5 sm:px-6 py-5 space-y-3">
                                {/* Capsules Card */}
                                <div
                                    className="flex justify-between items-center p-4 rounded-xl gap-3"
                                    style={{
                                        background: "rgba(179,102,255,0.08)",
                                        border: "1px solid rgba(179,102,255,0.15)",
                                    }}
                                >
                                    <div>
                                        <div className="text-2xl font-display font-black text-[#B366FF]">{unopenedCapsules}</div>
                                        <div className="text-[10px] text-white/40 font-mundial">
                                            {unopenedCapsules === 1 ? 'Capsule' : 'Capsules'} Ready
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {unopenedCapsules >= 6 && (
                                            <button
                                                onClick={() => onOpenCapsule("one")}
                                                className="px-3 py-2 rounded-lg text-[10px] font-black font-mundial uppercase tracking-widest transition-all hover:-translate-y-0.5 active:translate-y-0.5"
                                                style={{
                                                    background: "rgba(179,102,255,0.12)",
                                                    border: "2px solid rgba(179,102,255,0.45)",
                                                    color: "#fff",
                                                    boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
                                                }}
                                            >
                                                Open
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onOpenCapsule(unopenedCapsules >= 6 ? "all" : "one")}
                                            disabled={unopenedCapsules <= 0}
                                            className="px-3 py-2 rounded-lg text-[10px] font-black font-mundial uppercase tracking-widest transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                            style={{
                                                background: "linear-gradient(180deg, #B366FF 0%, #8A2BE2 100%)",
                                                border: "2px solid rgba(179,102,255,0.6)",
                                                color: "#fff",
                                                boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
                                            }}
                                        >
                                            {unopenedCapsules >= 6
                                                ? "Open All"
                                                : unopenedCapsules >= 2
                                                    ? `Open ${unopenedCapsules}`
                                                    : "Open"}
                                        </button>
                                    </div>
                                </div>

                                {/* Duplicates / Reroll Card */}
                                <div
                                    className="flex justify-between items-center p-4 rounded-xl"
                                    style={{
                                        background: "rgba(255,140,66,0.08)",
                                        border: "1px solid rgba(255,140,66,0.15)",
                                    }}
                                >
                                    <div>
                                        <div className="text-2xl font-display font-black text-[#FF8C42]">{duplicateCount}</div>
                                        <div className="text-[10px] text-white/40 font-mundial">Duplicate {duplicateCount === 1 ? 'Pin' : 'Pins'}</div>
                                    </div>
                                    <button
                                        onClick={onOpenReroll}
                                        disabled={!onOpenReroll || duplicateCount <= 0}
                                        className="px-5 py-2.5 rounded-xl text-[11px] font-black font-mundial uppercase tracking-widest transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                        style={{
                                            background: "linear-gradient(180deg, #FF8C42 0%, #CC6A20 100%)",
                                            border: "2px solid rgba(255,140,66,0.6)",
                                            color: "#fff",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        Reroll
                                    </button>
                                </div>

                                {/* Prize Games Card */}
                                <div
                                    className="flex justify-between items-center p-4 rounded-xl"
                                    style={{
                                        background: "rgba(255,224,72,0.06)",
                                        border: "1px solid rgba(255,224,72,0.12)",
                                    }}
                                >
                                    <div>
                                        <div className="text-2xl font-display font-black text-[#FFE048]">{prizeGamesRemaining}</div>
                                        <div className="text-[10px] text-white/40 font-mundial">Prize {prizeGamesRemaining === 1 ? 'Game' : 'Games'} Left</div>
                                    </div>
                                    <button
                                        onClick={onOpenBuyPrizeGames}
                                        disabled={!onOpenBuyPrizeGames}
                                        className="px-5 py-2.5 rounded-xl text-[11px] font-black font-mundial uppercase tracking-widest transition-all hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                        style={{
                                            background: "linear-gradient(180deg, #FFE048 0%, #c9a84c 100%)",
                                            border: "2px solid rgba(255,224,72,0.6)",
                                            color: "#1A0633",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        Buy More
                                    </button>
                                </div>

                                {/* Referral Card */}
                                <div
                                    className="p-4 rounded-xl"
                                    style={{
                                        background: "rgba(179,102,255,0.05)",
                                        border: "1px solid rgba(179,102,255,0.12)",
                                    }}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <div className="text-sm font-display font-black text-[#B366FF]">Refer Friends</div>
                                            <div className="text-[10px] text-white/40 font-mundial">You both get 2 free capsules</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div
                                            className="flex-1 rounded-lg px-2.5 py-2 text-[10px] font-mono text-white/50 truncate"
                                            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                                        >
                                            vibematch.app?ref={currentUsername}
                                        </div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`https://vibematch.app?ref=${currentUsername || ''}`);
                                                // Brief visual feedback
                                                const btn = document.activeElement as HTMLButtonElement;
                                                if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); }
                                            }}
                                            className="shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:brightness-125 active:scale-95"
                                            style={{
                                                background: "rgba(179,102,255,0.15)",
                                                border: "1px solid rgba(179,102,255,0.4)",
                                                color: "#B366FF",
                                            }}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : tab === "leaderboard" ? (
                            <PinLeaderboard currentUsername={currentUsername} refreshKey={leaderboardRefreshKey} />
                        ) : ownedCount === 0 ? (
                            <div className="px-5 sm:px-6 py-6">
                                <PinBookOnboarding
                                    onAction={() => { onClose(); onStartGame?.(); }}
                                    actionLabel="Start Playing"
                                />
                            </div>
                        ) : (
                        <div className="px-5 sm:px-6 py-5 space-y-6">
                            {TIER_ORDER.map((tier, tierIdx) => {
                                const badges = groupedBadges[tier];
                                if (badges.length === 0) return null;

                                const tierColor = TIER_COLORS[tier];
                                const tierName = TIER_DISPLAY_NAMES[tier];
                                const ownedInTier = badges.filter(
                                    (b) => pins[b.id]
                                ).length;

                                return (
                                    <motion.div
                                        key={tier}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            delay: 0.15 + tierIdx * 0.08,
                                        }}
                                    >
                                        {/* Section Header */}
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{
                                                    background: tierColor,
                                                    boxShadow: `0 0 8px ${tierColor}`,
                                                }}
                                            />
                                            <h3
                                                className="font-display text-sm font-black uppercase tracking-wider"
                                                style={{ color: tierColor }}
                                            >
                                                {tierName}
                                            </h3>
                                            <span className="text-white/25 text-[10px] font-mundial font-bold">
                                                {ownedInTier}/{badges.length}
                                            </span>
                                            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                                        </div>

                                        {/* Badge Grid */}
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 sm:gap-3">
                                            {badges.map((badge, badgeIdx) => {
                                                const owned = pins[badge.id];
                                                const isOwned = !!owned;
                                                const count = owned?.count ?? 0;
                                                const tierGlow =
                                                    TIER_GLOW[badge.tier];

                                                return (
                                                    <motion.div
                                                        key={badge.id}
                                                        className="relative group"
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.8,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                        }}
                                                        transition={{
                                                            delay:
                                                                0.2 +
                                                                tierIdx * 0.06 +
                                                                badgeIdx *
                                                                    0.015,
                                                            type: "spring",
                                                            stiffness: 400,
                                                            damping: 25,
                                                        }}
                                                    >
                                                        <div
                                                            className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
                                                                isOwned
                                                                    ? "hover:scale-105 cursor-pointer"
                                                                    : ""
                                                            }`}
                                                            style={{
                                                                background:
                                                                    isOwned
                                                                        ? `linear-gradient(135deg, ${tierColor}15, ${tierColor}08)`
                                                                        : "rgba(255,255,255,0.03)",
                                                                border: `1.5px solid ${
                                                                    isOwned
                                                                        ? `${tierColor}40`
                                                                        : "rgba(255,255,255,0.06)"
                                                                }`,
                                                                boxShadow:
                                                                    isOwned
                                                                        ? tierGlow
                                                                        : "none",
                                                            }}
                                                        >
                                                            {/* Badge Image */}
                                                            <div className="relative aspect-square p-2">
                                                                <Image
                                                                    src={
                                                                        badge.image
                                                                    }
                                                                    alt={
                                                                        isOwned ? badge.name : "Undiscovered"
                                                                    }
                                                                    fill
                                                                    sizes="(max-width: 640px) 80px, 100px"
                                                                    className={`object-contain p-1.5 transition-all duration-300 ${
                                                                        isOwned
                                                                            ? ""
                                                                            : "brightness-0 opacity-[0.15]"
                                                                    }`}
                                                                    style={
                                                                        !isOwned
                                                                            ? {
                                                                                  filter: "brightness(0)",
                                                                                  opacity: 0.15,
                                                                              }
                                                                            : undefined
                                                                    }
                                                                />
                                                            </div>

                                                            {/* Badge Name + Tier Dot */}
                                                            <div className="px-1.5 pb-2 text-center">
                                                                <div className="flex items-center justify-center gap-1 mb-0.5">
                                                                    <div
                                                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                                        style={{
                                                                            background:
                                                                                isOwned
                                                                                    ? tierColor
                                                                                    : "rgba(255,255,255,0.15)",
                                                                        }}
                                                                    />
                                                                    <span
                                                                        className={`text-[9px] sm:text-[10px] font-mundial font-bold leading-tight truncate ${
                                                                            isOwned
                                                                                ? "text-white/80"
                                                                                : "text-white/20"
                                                                        }`}
                                                                    >
                                                                        {
                                                                            isOwned ? badge.name : "???"
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Duplicate Count Badge */}
                                                            {isOwned &&
                                                                count > 1 && (
                                                                    <div
                                                                        className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                                                                        style={{
                                                                            background:
                                                                                tierColor,
                                                                            boxShadow: `0 0 8px ${tierColor}80`,
                                                                        }}
                                                                    >
                                                                        <span className="text-[9px] font-black font-mundial text-black leading-none">
                                                                            x
                                                                            {
                                                                                count
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                        </div>

                                                        {/* Hover Tooltip (desktop only) */}
                                                        {isOwned && (
                                                            <div className="hidden sm:block absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-black/90 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                                                <span className="text-[10px] font-mundial font-bold text-white/90">
                                                                    {
                                                                        badge.name
                                                                    }
                                                                </span>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {/* Bottom Padding for scroll comfort */}
                            <div className="h-2" />
                        </div>
                        )}
                        </div>

                        {/* ── Footer ── */}
                        <div className="px-5 sm:px-6 py-3 border-t border-white/10 bg-[#110321] flex items-center justify-between">
                            <span className="text-white/25 text-[10px] font-mundial uppercase tracking-widest">
                                {totalCount} Total Pins
                            </span>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-black font-mundial transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Info modal overlay */}
        <AnimatePresence>
            {showInfo && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                    onClick={() => setShowInfo(false)}
                >
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        onClick={e => e.stopPropagation()}
                        className="relative bg-[#0D0520] border border-white/10 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto custom-scrollbar"
                    >
                        <div className="sticky top-0 z-10 flex justify-end p-3 bg-[#0D0520]">
                            <button
                                onClick={() => setShowInfo(false)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <X size={16} className="text-white/60" />
                            </button>
                        </div>
                        <div className="px-5 pb-6">
                            <PinBookOnboarding
                                onAction={() => setShowInfo(false)}
                                actionLabel="Got It"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}
