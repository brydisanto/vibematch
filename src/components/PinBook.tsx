"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy } from "lucide-react";
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
    onOpenCapsule: () => void;
    pins: Record<string, { count: number; firstEarned: string }>;
    unopenedCapsules: number;
    currentUsername?: string;
}

const TIER_ORDER: BadgeTier[] = ["cosmic", "gold", "silver", "blue"];

const TIER_GLOW: Record<BadgeTier, string> = {
    cosmic: "0 0 12px rgba(179, 102, 255, 0.6), 0 0 24px rgba(179, 102, 255, 0.25)",
    gold: "0 0 12px rgba(255, 224, 72, 0.5), 0 0 24px rgba(255, 224, 72, 0.2)",
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
                                {entry.uniqueCount}/77 pins collected ({entry.totalPins} total)
                            </div>
                        </div>

                        {/* Pin Score + % Complete */}
                        <div className="flex-shrink-0 text-right">
                            <div className="font-display font-extrabold text-base tracking-[0.03em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                style={{ color: entry.percentComplete === 100 ? "#FFD700" : "#B366FF" }}>
                                {entry.percentComplete}%
                            </div>
                            <div className="text-[10px] text-white/30 font-bold mt-0.5">
                                {entry.pinScore} pts
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// --- Main PinBook Component ---

export default function PinBook({
    isOpen,
    onClose,
    onOpenCapsule,
    pins,
    unopenedCapsules,
    currentUsername,
}: PinBookProps) {
    const [tab, setTab] = useState<"collection" | "leaderboard">("collection");

    const ownedCount = useMemo(
        () => Object.keys(pins).length,
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
            silver: [],
            blue: [],
        };
        for (const badge of BADGES) {
            groups[badge.tier].push(badge);
        }
        return groups;
    }, []);

    return (
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
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
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
                        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#3A1061] to-[#3A1061]/95 backdrop-blur-md px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
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

                                {/* Close + Capsule Badge */}
                                <div className="flex items-center gap-2">
                                    {unopenedCapsules > 0 && (
                                        <div className="relative">
                                            <button
                                                onClick={onOpenCapsule}
                                                className="group relative overflow-hidden px-4 py-2.5 rounded-[16px] text-[11px] font-black font-mundial tracking-widest uppercase transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0.5"
                                                style={{
                                                    background: "linear-gradient(180deg, #B366FF 0%, #8A2BE2 100%)",
                                                    boxShadow: "0 6px 16px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -2px 3px rgba(0,0,0,0.25), 0 0 20px rgba(179,102,255,0.4)",
                                                    border: "2px solid rgba(179,102,255,0.6)",
                                                    color: "#fff",
                                                    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                                                }}
                                            >
                                                <span className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
                                                Open Pin Capsule!
                                            </button>
                                            {/* Notification Badge */}
                                            <span
                                                className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF5F1F] text-white text-[10px] font-black font-mundial flex items-center justify-center"
                                                style={{
                                                    boxShadow:
                                                        "0 0 10px rgba(255, 95, 31, 0.6)",
                                                }}
                                            >
                                                {unopenedCapsules}
                                            </span>
                                        </div>
                                    )}
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
                                    <span className="text-white/30 text-[10px] font-mundial font-bold">
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
                            <div className="flex bg-white/5 p-1 rounded-xl w-full mt-3">
                                {(["collection", "leaderboard"] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTab(t)}
                                        className={`flex-1 py-2 text-center text-xs font-bold uppercase transition-all rounded-lg ${
                                            tab === t
                                                ? "bg-white text-black shadow-sm"
                                                : "text-white/40 hover:text-white/80"
                                        }`}
                                    >
                                        {t === "collection" ? "My Collection" : "Leaderboard"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Scrollable Content ── */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {tab === "leaderboard" ? (
                            <PinLeaderboard currentUsername={currentUsername} refreshKey={leaderboardRefreshKey} />
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
                        <div className="px-5 sm:px-6 py-4 border-t border-white/10 bg-[#110321]/80 backdrop-blur-md flex items-center justify-between">
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
    );
}
