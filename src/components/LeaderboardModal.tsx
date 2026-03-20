"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Crown } from "lucide-react";

interface LeaderboardEntry {
    username: string;
    score: number;
    avatarUrl: string;
}

interface UserEntry extends LeaderboardEntry {
    rank: number;
}

interface NextPlayer {
    username: string;
    score: number;
}

interface LeaderboardModalProps {
    onClose: () => void;
    currentUsername?: string;
    currentAvatarUrl?: string;
}

type TabMode = "classic" | "weekly" | "daily";

const formatScore = (value: number) => {
    if (value <= 0) return "\u2014";
    return value.toLocaleString();
};

// --- Reset countdown helpers ---

function getNextMonday(): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(0, 0, 0, 0);
    return next;
}

function getMidnightTonight(): Date {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return midnight;
}

function formatCountdown(targetDate: Date): string {
    const now = Date.now();
    const diff = targetDate.getTime() - now;
    if (diff <= 0) return "Resetting...";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        return `${days}d ${remHours}h`;
    }
    return `${hours}h ${minutes}m`;
}

function useCountdown(mode: TabMode): string | null {
    const [, setTick] = useState(0);

    useEffect(() => {
        if (mode === "classic") return;
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, [mode]);

    if (mode === "classic") return null;
    if (mode === "weekly") return formatCountdown(getNextMonday());
    return formatCountdown(getMidnightTonight());
}

// --- Avatar cache (shared across all Avatar instances in the session) ---
const avatarCache = new Map<string, string>();

function Avatar({ entry, size = 40, className = "" }: { entry: LeaderboardEntry; size?: number; className?: string }) {
    const [src, setSrc] = useState(entry.avatarUrl || avatarCache.get(entry.username.toLowerCase()) || "");

    useEffect(() => {
        if (src) return; // already have it
        const key = entry.username.toLowerCase();
        if (avatarCache.has(key)) {
            setSrc(avatarCache.get(key)!);
            return;
        }
        fetch(`/api/profiles?username=${encodeURIComponent(entry.username)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                const url = d?.profile?.avatarUrl || "";
                avatarCache.set(key, url);
                if (url) setSrc(url);
            })
            .catch(() => {});
    }, [entry.username, src]);

    return (
        <div className={`rounded-full bg-[#2A2333] border border-[#3A3344] overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`}
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

// --- Podium (top 3) ---

function PodiumSection({ entries, currentUsername }: { entries: LeaderboardEntry[]; currentUsername?: string }) {
    if (entries.length < 3) return null;

    const podiumOrder = [entries[1], entries[0], entries[2]]; // 2nd, 1st, 3rd
    const ranks = [2, 1, 3];
    const medalColors = [
        { border: "#C0C0C0", glow: "rgba(192,192,192,0.2)", bg: "linear-gradient(135deg,#E8E8E8,#A0A0A0)" },
        { border: "#FFD700", glow: "rgba(255,215,0,0.3)", bg: "linear-gradient(135deg,#FFD700,#FFA500)" },
        { border: "#CD7F32", glow: "rgba(205,127,50,0.2)", bg: "linear-gradient(135deg,#CD7F32,#A0522D)" },
    ];
    const pedestalHeights = [52, 72, 40];
    const avatarSizes = [56, 72, 56];

    return (
        <div className="relative flex items-end justify-center gap-2 px-5 pt-2 pb-0">
            {/* Radial glow behind podium */}
            <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-[radial-gradient(circle,rgba(255,215,0,0.08)_0%,transparent_70%)] pointer-events-none" />

            {podiumOrder.map((entry, i) => {
                const rank = ranks[i];
                const medal = medalColors[i];
                const isUser = entry.username.toLowerCase() === currentUsername?.toLowerCase();
                return (
                    <div key={entry.username} className="flex flex-col items-center relative z-10">
                        <div style={{
                            borderRadius: "50%",
                            border: rank === 1 ? "3px solid #FFD700" : `2px solid ${medal.border}`,
                            boxShadow: `0 0 ${rank === 1 ? 20 : 15}px ${medal.glow}`,
                            animation: rank === 1 ? "goldPulse 2s ease-in-out infinite" : undefined,
                        }}>
                            <Avatar entry={entry} size={avatarSizes[i]} />
                        </div>
                        {/* Medal badge */}
                        <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-black text-[#110D17] -mt-[10px] relative z-20"
                            style={{ background: medal.bg, boxShadow: rank === 1 ? `0 0 12px rgba(255,215,0,0.4)` : undefined }}>
                            {rank}
                        </div>
                        <div className={`mt-1.5 text-xs font-bold max-w-[90px] truncate text-center ${isUser ? "text-[#B366FF]" : "text-white/90"}`}>
                            {isUser ? "You" : entry.username}
                        </div>
                        <div className="text-sm font-extrabold text-[#FFD700] mt-0.5">
                            {formatScore(entry.score)}
                        </div>
                        {/* Pedestal */}
                        <div className="w-[100px] rounded-t-lg mt-2"
                            style={{
                                height: pedestalHeights[i],
                                background: `linear-gradient(180deg, ${medal.border}22, ${medal.border}08)`,
                                border: `1px solid ${medal.border}33`,
                                borderBottom: "none",
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
}

// --- List row ---

function LeaderboardRow({ entry, rank, isCurrentUser }: { entry: LeaderboardEntry; rank: number; isCurrentUser: boolean }) {
    return (
        <div
            className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${isCurrentUser
                ? "bg-[#B366FF]/10 border border-[#B366FF]/20"
                : "hover:bg-white/[0.03]"
                }`}
        >
            <div className="flex-shrink-0 w-7 text-center font-bold text-white/40 text-sm">
                {rank}
            </div>
            <Avatar entry={entry} size={36} />
            <div className="flex-1 font-bold text-sm text-white/90 truncate">
                {isCurrentUser ? <><span>{entry.username}</span><span className="ml-1.5 text-[9px] font-extrabold text-[#B366FF] bg-[#B366FF]/15 px-1.5 py-0.5 rounded tracking-wider">YOU</span></> : entry.username}
            </div>
            <div className="flex-shrink-0 font-display font-extrabold text-[#FFD700] text-base tracking-[0.03em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {formatScore(entry.score)}
            </div>
        </div>
    );
}

// --- Main component ---

export default function LeaderboardModal({ onClose, currentUsername, currentAvatarUrl }: LeaderboardModalProps) {
    const [mode, setMode] = useState<TabMode>("weekly");
    const [cache, setCache] = useState<Record<string, {
        leaderboard: LeaderboardEntry[];
        userEntry: UserEntry | null;
        nextPlayer: NextPlayer | null;
        totalPlayers: number;
        totalMatchesPlayed: number;
    }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fetchedModes = useRef(new Set<string>());
    const countdown = useCountdown(mode);

    const cached = cache[mode];
    const leaderboard = cached?.leaderboard ?? [];
    const userEntry = cached?.userEntry ?? null;
    const nextPlayer = cached?.nextPlayer ?? null;
    const totalPlayers = cached?.totalPlayers ?? 0;
    const totalMatchesPlayed = cached?.totalMatchesPlayed ?? 0;

    // --- Two-phase fetch: scores first (fast), then avatars (lazy) ---
    const fetchForMode = useCallback(async (targetMode: TabMode) => {
        const params = new URLSearchParams({ mode: targetMode });
        if (currentUsername) params.set("username", currentUsername);
        const res = await fetch(`/api/scores?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const rawList = data.leaderboard || [];

        const phase1List: LeaderboardEntry[] = rawList.map((entry: any) => {
            const isCurrentUser = currentUsername && currentAvatarUrl && entry.username.toLowerCase() === currentUsername.toLowerCase();
            return {
                username: entry.username,
                score: Number(entry.score),
                avatarUrl: isCurrentUser ? currentAvatarUrl : "",
            };
        });

        let ue: UserEntry | null = null;
        if (data.userEntry) {
            const e = data.userEntry;
            ue = {
                username: e.username,
                score: e.score,
                avatarUrl: (currentAvatarUrl && currentUsername?.toLowerCase() === e.username.toLowerCase()) ? currentAvatarUrl : "",
                rank: data.userRank || 0,
            };
        }

        let np: NextPlayer | null = null;
        if (data.nextPlayer) {
            np = data.nextPlayer;
        } else if (data.userRank && data.userRank > 1) {
            const userIndex = data.userRank - 1;
            if (userIndex > 0 && userIndex < phase1List.length) {
                np = { username: phase1List[userIndex - 1].username, score: phase1List[userIndex - 1].score };
            }
        }

        // Commit phase 1 — scores render immediately with initial placeholders
        fetchedModes.current.add(targetMode);
        setCache(prev => ({
            ...prev,
            [targetMode]: { leaderboard: phase1List, userEntry: ue, nextPlayer: np, totalPlayers: data.totalPlayers || phase1List.length, totalMatchesPlayed: data.totalMatchesPlayed || 0 },
        }));
        setIsLoading(false);

        // Avatars are now lazy-loaded per Avatar component via /api/profiles
    }, [currentUsername, currentAvatarUrl]);

    // Prefetch default mode immediately on mount (no waiting for animation)
    const hasInitialFetch = useRef(false);
    useEffect(() => {
        if (hasInitialFetch.current) return;
        hasInitialFetch.current = true;
        fetchForMode(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch when tab changes (skips if already cached)
    useEffect(() => {
        if (fetchedModes.current.has(mode)) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        fetchForMode(mode).catch(err => {
            console.error("Failed to fetch leaderboard", err);
            setIsLoading(false);
        });
    }, [mode, fetchForMode]);

    // Auto-scroll to user's row when loaded
    useEffect(() => {
        if (isLoading || !scrollRef.current || !currentUsername) return;
        const userIndex = leaderboard.findIndex(e => e.username.toLowerCase() === currentUsername.toLowerCase());
        if (userIndex > 5) {
            const rowHeight = 52;
            setTimeout(() => {
                scrollRef.current?.scrollTo({ top: (userIndex - 3) * rowHeight, behavior: "smooth" });
            }, 300);
        }
    }, [isLoading, leaderboard, currentUsername]);

    // Beat nudge text
    const beatNudge = useMemo(() => {
        if (!nextPlayer || !currentUsername) return null;
        const userScore = userEntry?.score ?? leaderboard.find(e => e.username.toLowerCase() === currentUsername.toLowerCase())?.score;
        if (!userScore) return null;
        const diff = nextPlayer.score - userScore;
        if (diff <= 0) return null;
        return { name: nextPlayer.username, points: diff };
    }, [nextPlayer, userEntry, leaderboard, currentUsername]);

    const hasPodium = leaderboard.length >= 3;
    const top3 = hasPodium ? leaderboard.slice(0, 3) : [];
    const restOfList = hasPodium ? leaderboard.slice(3) : leaderboard;

    const tabs: { key: TabMode; label: string }[] = [
        { key: "classic", label: "All Time" },
        { key: "weekly", label: "Weekly" },
        { key: "daily", label: "Daily" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md rounded-[24px] bg-gradient-to-b from-[#4A3B52] to-[#1A1525] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            >
                <div className="relative bg-[#110D17] rounded-[21px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden flex flex-col max-h-[85vh]">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] hover:border-white/50 transition-colors z-20"
                    >
                        <X size={18} className="text-white/60 hover:text-white transition-colors" />
                    </button>

                    {/* Header */}
                    <div className="flex flex-col items-center pt-6 pb-2 px-6">
                        <h2 className="font-display text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center gap-3">
                            <Crown className="text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]" size={28} />
                            Leaderboards
                        </h2>
                    </div>

                    {/* Mode Tabs */}
                    <div className="px-6 pb-2">
                        <div className="flex bg-white/5 p-1 rounded-xl w-full">
                            {tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setMode(tab.key)}
                                    className={`flex-1 py-2.5 text-center text-xs font-bold uppercase transition-all rounded-lg ${mode === tab.key
                                        ? "bg-white text-black shadow-sm"
                                        : "text-white/40 hover:text-white/80"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {/* Reset countdown + player/match count */}
                        <div className={`flex items-center mt-2 px-1 ${countdown ? "justify-between" : "justify-center"}`}>
                            <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
                                {totalPlayers > 0 ? `${totalPlayers.toLocaleString()} player${totalPlayers !== 1 ? "s" : ""} vibing` : "\u00A0"}
                                {mode === "classic" && totalMatchesPlayed > 0 ? ` \u00B7 ${totalMatchesPlayed.toLocaleString()} games played` : ""}
                            </span>
                            {countdown && (
                                <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
                                    Resets in {countdown}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div key={`${mode}-loading`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex flex-col gap-3 px-5 py-6">
                                    {/* Skeleton rows */}
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-3 animate-pulse">
                                            <div className="w-7 h-4 bg-white/5 rounded" />
                                            <div className="w-9 h-9 rounded-full bg-white/5" />
                                            <div className="flex-1 h-4 bg-white/5 rounded" style={{ width: `${60 - i * 6}%` }} />
                                            <div className="w-16 h-4 bg-white/5 rounded" />
                                        </div>
                                    ))}
                                </motion.div>
                            ) : leaderboard.length === 0 ? (
                                <motion.div key={`${mode}-empty`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center py-20 text-white/30 text-center px-6">
                                    <Trophy size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold uppercase tracking-widest text-sm">No scores yet</p>
                                    <p className="text-xs mt-2 text-white/20">Be the first to claim the top spot!</p>
                                </motion.div>
                            ) : (
                                <motion.div key={`${mode}-list`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    {/* Podium */}
                                    {hasPodium && (
                                        <PodiumSection entries={top3} currentUsername={currentUsername} />
                                    )}

                                    {/* Separator (only after podium) */}
                                    {hasPodium && (
                                        <div className="h-px bg-gradient-to-r from-transparent via-[#2A2333] to-transparent mx-5 mt-4 mb-2" />
                                    )}

                                    {/* List (4-50 if podium, or all entries if no podium) */}
                                    <div className="px-3 pb-2">
                                        {restOfList.map((entry, index) => {
                                            const isCurrentUser = entry.username.toLowerCase() === currentUsername?.toLowerCase();
                                            return (
                                                <LeaderboardRow
                                                    key={`${entry.username}-${index}`}
                                                    entry={entry}
                                                    rank={hasPodium ? index + 4 : index + 1}
                                                    isCurrentUser={isCurrentUser}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Pinned user entry when outside top 50 */}
                                    {userEntry && (
                                        <div className="px-3 pb-4">
                                            <div className="flex items-center gap-2 my-3">
                                                <div className="flex-1 h-px bg-white/10" />
                                                <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Your Rank</span>
                                                <div className="flex-1 h-px bg-white/10" />
                                            </div>
                                            <LeaderboardRow
                                                entry={userEntry}
                                                rank={userEntry.rank}
                                                isCurrentUser={true}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Beat nudge — sticky at bottom */}
                    {beatNudge && !isLoading && (
                        <div className="px-5 py-3 border-t border-white/5 bg-[#110D17]">
                            <p className="text-center text-xs text-white/40">
                                <span className="text-[#FFD700] font-bold">{formatScore(beatNudge.points)}</span>
                                {" "}points to beat{" "}
                                <span className="text-white/70 font-semibold">{beatNudge.name}</span>
                            </p>
                        </div>
                    )}

                </div>
            </motion.div>
        </div>
    );
}
