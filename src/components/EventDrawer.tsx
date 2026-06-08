"use client";

/**
 * Dedicated drawer for active partner events. Replaces the "promo" tab
 * route on the LeaderboardModal so events get full-bleed real estate
 * for hero treatment, copy, and a tall leaderboard.
 *
 * Bottom-anchored slide-up sheet. Backdrop click + ESC close.
 *
 * Data source: `/api/promo/leaderboard` (active promo's collector zset).
 */

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GOLD, GOLD_DEEP } from "@/lib/arcade-tokens";

interface EventEntry {
    username: string;
    count: number;
    rank: number;
    avatarUrl?: string;
}

interface PromoInfo {
    id: string;
    name: string;
    partnerName: string;
    tabLabel: string;
    image: string;
    description?: string;
    eventWindow?: string;
    prizeNote?: string;
    accentColor?: string;
    endsAt?: string;
}

function formatRemaining(targetMs: number): { d: number; h: number; m: number; s: number; done: boolean } {
    const diff = targetMs - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { d, h, m, s, done: false };
}

/**
 * Self-contained countdown subtree. Owns its own setInterval state so the
 * per-second tick re-renders ONLY this component, not the parent drawer.
 * Previously the parent useCountdown hook re-rendered the entire drawer
 * (including all 50 leaderboard rows + avatar fetches) every second,
 * which caused noticeable lag.
 */
const Countdown = memo(function Countdown({ endsAt, accent }: { endsAt: string; accent: string }) {
    const targetMs = new Date(endsAt).getTime();
    const [tick, setTick] = useState(() => formatRemaining(targetMs));
    useEffect(() => {
        const iv = setInterval(() => setTick(formatRemaining(targetMs)), 1000);
        return () => clearInterval(iv);
    }, [targetMs]);

    if (tick.done) {
        return (
            <div className="font-display text-[10px] tracking-[0.32em] text-white/55 mb-4">
                EVENT ENDED
            </div>
        );
    }

    const units = [
        { value: tick.d, label: "DAYS" },
        { value: tick.h, label: "HRS" },
        { value: tick.m, label: "MIN" },
        { value: tick.s, label: "SEC" },
    ];

    return (
        <div className="flex flex-col items-center mb-4">
            <div className="font-display text-[10px] tracking-[0.32em] text-white/45 mb-1.5">
                ENDS JUN 8 · 12 PM ET
            </div>
            <div className="flex items-end gap-2 sm:gap-3 tabular-nums">
                {units.map((unit, i) => (
                    <div key={unit.label} className="flex items-end gap-2 sm:gap-3">
                        <div className="flex flex-col items-center">
                            <div
                                className="font-display text-2xl sm:text-3xl font-black leading-none"
                                style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}
                            >
                                {unit.value.toString().padStart(2, "0")}
                            </div>
                            <div className="font-display text-[9px] tracking-[0.3em] text-white/40 mt-1">
                                {unit.label}
                            </div>
                        </div>
                        {i < 3 && (
                            <div
                                className="font-display text-2xl sm:text-3xl font-black leading-none pb-4"
                                style={{ color: `${accent}55` }}
                            >
                                :
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

interface EventDrawerProps {
    onClose: () => void;
    currentUsername?: string;
    currentAvatarUrl?: string;
    promo: PromoInfo;
}

const avatarCache = new Map<string, string>();

const Avatar = memo(function Avatar({ username, hintUrl, size }: { username: string; hintUrl?: string; size: number }) {
    const [src, setSrc] = useState(hintUrl || avatarCache.get(username.toLowerCase()) || "");

    useEffect(() => {
        if (src) return;
        const key = username.toLowerCase();
        if (avatarCache.has(key)) {
            setSrc(avatarCache.get(key)!);
            return;
        }
        fetch(`/api/profiles?username=${encodeURIComponent(username)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                const url = d?.profile?.avatarUrl || "";
                avatarCache.set(key, url);
                if (url) setSrc(url);
            })
            .catch(() => {});
    }, [username, src]);

    const isDataUri = src.startsWith("data:");
    return (
        <div
            className="rounded-full bg-[#2A2333] border border-[#3A3344] overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ width: size, height: size }}
        >
            {src ? (
                isDataUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={username} width={size} height={size} className="object-cover w-full h-full" />
                ) : (
                    <Image src={src} alt={username} width={size} height={size} className="object-cover w-full h-full" />
                )
            ) : (
                <Image
                    src="/avatars/default.jpg"
                    alt=""
                    width={size}
                    height={size}
                    className="object-cover w-full h-full"
                />
            )}
        </div>
    );
});

const MEDAL: Record<number, { border: string; bg: string; rankColor: string; glow: string }> = {
    1: { border: "rgba(255,215,0,0.55)", bg: "rgba(255,215,0,0.10)", rankColor: "#FFD700", glow: "0 0 18px rgba(255,215,0,0.25)" },
    2: { border: "rgba(192,192,192,0.55)", bg: "rgba(192,192,192,0.08)", rankColor: "#C0C0C0", glow: "0 0 14px rgba(192,192,192,0.22)" },
    3: { border: "rgba(205,127,50,0.55)", bg: "rgba(205,127,50,0.08)", rankColor: "#CD7F32", glow: "0 0 14px rgba(205,127,50,0.22)" },
};

interface RowProps {
    entry: EventEntry;
    isUser: boolean;
    accent: string;
    currentAvatarUrl?: string;
}
const LeaderboardRow = memo(function LeaderboardRow({ entry, isUser, accent, currentAvatarUrl }: RowProps) {
    const medal = MEDAL[entry.rank];
    return (
        <Link
            href={`/u/${encodeURIComponent(entry.username)}`}
            prefetch={false}
            className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
                isUser
                    ? "bg-[#B366FF]/10 border border-[#B366FF]/20"
                    : medal
                        ? ""
                        : "hover:bg-white/[0.03]"
            }`}
            style={medal && !isUser ? {
                background: medal.bg,
                border: `1px solid ${medal.border}`,
                boxShadow: medal.glow,
            } : undefined}
        >
            <div
                className="flex-shrink-0 w-7 text-center font-display font-black text-sm"
                style={{
                    color: medal ? medal.rankColor : undefined,
                    textShadow: medal ? `0 0 10px ${medal.rankColor}55` : undefined,
                }}
            >
                {entry.rank}
            </div>
            <Avatar
                username={entry.username}
                hintUrl={isUser ? currentAvatarUrl : undefined}
                size={36}
            />
            <div className="flex-1 min-w-0">
                <div className={`font-display font-black text-sm truncate ${isUser ? "text-[#B366FF]" : "text-white/90"}`}>
                    {isUser ? "You" : entry.username}
                </div>
            </div>
            <div className="font-display font-black text-sm" style={{ color: accent }}>
                {entry.count.toLocaleString()}
            </div>
        </Link>
    );
});

export default function EventDrawer({ onClose, currentUsername, currentAvatarUrl, promo }: EventDrawerProps) {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<EventEntry[]>([]);
    const [userEntry, setUserEntry] = useState<EventEntry | null>(null);
    const [totalPlayers, setTotalPlayers] = useState(0);

    const accent = promo.accentColor || GOLD;

    // Reactive "is the event over" — flips the hero pill from EVENT LIVE
    // to FINAL RESULTS the moment endsAt passes, without a refresh. Same
    // pattern as the header pill in LandingPageArcade.
    const [ended, setEnded] = useState<boolean>(() => {
        if (!promo.endsAt) return false;
        return Date.now() >= new Date(promo.endsAt).getTime();
    });
    useEffect(() => {
        if (!promo.endsAt) return;
        const endMs = new Date(promo.endsAt).getTime();
        const remaining = endMs - Date.now();
        if (remaining <= 0) {
            setEnded(true);
            return;
        }
        setEnded(false);
        const t = setTimeout(() => setEnded(true), remaining);
        return () => clearTimeout(t);
    }, [promo.endsAt]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/promo/leaderboard`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (cancelled || !d) return;
                setEntries(d.leaderboard || []);
                setUserEntry(d.userEntry || null);
                setTotalPlayers(d.totalPlayers || 0);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const userRow = userEntry
        ? entries.find(e => e.username.toLowerCase() === userEntry.username.toLowerCase())
            ? null
            : userEntry
        : null;

    return (
        <AnimatePresence>
            <motion.div
                key="event-drawer-backdrop"
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={onClose}
            />
            <motion.div
                key="event-drawer-sheet"
                className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
                <div
                    className="relative max-h-[92vh] overflow-hidden rounded-t-3xl border-t border-x"
                    style={{
                        background: "linear-gradient(180deg, #0e0820 0%, #0a0418 100%)",
                        borderColor: `${accent}55`,
                        // Lighter shadow than the original. Large blur radii
                        // on big elements force the compositor to repaint
                        // every frame during scroll + spring animation,
                        // which was the dominant cause of the laggy feel.
                        boxShadow: `0 -8px 24px -8px rgba(0,0,0,0.7)`,
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-2.5 pb-1">
                        <div className="h-1 w-10 rounded-full bg-white/15" />
                    </div>

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Close event drawer"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Scrollable body */}
                    <div className="overflow-y-auto max-h-[calc(92vh-12px)] pb-8">
                        {/* Hero */}
                        <div
                            className="relative flex flex-col items-center px-6 pt-6 pb-7"
                            style={{
                                background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${accent}26 0%, transparent 70%)`,
                            }}
                        >
                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4"
                                style={{
                                    background: ended
                                        ? "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"
                                        : `linear-gradient(180deg, ${GOLD}1f, ${GOLD_DEEP}14)`,
                                    border: ended
                                        ? "1px solid rgba(255,255,255,0.18)"
                                        : `1px solid ${GOLD}66`,
                                }}
                            >
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                        background: ended ? "rgba(255,255,255,0.35)" : accent,
                                        boxShadow: ended ? "none" : `0 0 8px ${accent}`,
                                    }}
                                />
                                <span
                                    className="font-display text-[10px] tracking-[0.3em]"
                                    style={{ color: ended ? "rgba(255,255,255,0.65)" : GOLD }}
                                >
                                    {ended ? "FINAL RESULTS" : "EVENT LIVE"}
                                </span>
                                {promo.eventWindow && (
                                    <>
                                        <span className="h-3 w-px bg-white/15" />
                                        <span className="font-mundial text-[10px] tracking-[0.2em] uppercase text-white/55">
                                            {promo.eventWindow}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="relative w-28 h-28 mb-4">
                                <div className="absolute inset-0 rounded-full" style={{ filter: `drop-shadow(0 6px 20px ${accent}55)` }}>
                                    <Image
                                        src={promo.image}
                                        alt={promo.name}
                                        fill
                                        sizes="112px"
                                        className="object-contain"
                                    />
                                </div>
                            </div>

                            <div className="font-mundial text-[11px] tracking-[0.28em] uppercase text-white/45 mb-1">
                                {promo.partnerName}
                            </div>
                            <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight text-center mb-3 leading-[1.05]">
                                {promo.name}
                            </h2>
                            {promo.description && (
                                <p className="max-w-xl text-center font-mundial text-[13px] sm:text-[14px] text-white/60 leading-relaxed mb-4">
                                    {promo.description}
                                </p>
                            )}

                            {promo.endsAt && <Countdown endsAt={promo.endsAt} accent={accent} />}

                            {/* Stat row */}
                            <div className="flex gap-2 w-full max-w-md">
                                <div className="flex-1 rounded-xl px-3 py-2.5 text-center"
                                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div className="font-display text-[9px] tracking-[0.3em] text-white/45 mb-0.5">COLLECTORS</div>
                                    <div className="font-display text-xl font-black" style={{ color: accent }}>
                                        {totalPlayers.toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex-1 rounded-xl px-3 py-2.5 text-center"
                                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div className="font-display text-[9px] tracking-[0.3em] text-white/45 mb-0.5">YOUR RANK</div>
                                    <div className="font-display text-xl font-black text-white">
                                        {userEntry ? `#${userEntry.rank.toLocaleString()}` : "—"}
                                    </div>
                                </div>
                                <div className="flex-1 rounded-xl px-3 py-2.5 text-center"
                                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div className="font-display text-[9px] tracking-[0.3em] text-white/45 mb-0.5">YOUR PINS</div>
                                    <div className="font-display text-xl font-black text-white">
                                        {userEntry ? userEntry.count.toLocaleString() : "0"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard */}
                        <div className="px-5 pb-3">
                            <h3 className="font-display font-black text-white text-sm tracking-[0.2em] mb-3">TOP COLLECTORS</h3>
                            {loading ? (
                                <div className="py-12 text-center font-mundial text-sm text-white/40">Loading leaderboard…</div>
                            ) : entries.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="font-mundial text-sm text-white/50">No collectors yet.</div>
                                    <div className="font-mundial text-xs text-white/30 mt-1">Be the first to pull an {promo.name}.</div>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {entries.map(entry => (
                                        <LeaderboardRow
                                            key={entry.username}
                                            entry={entry}
                                            isUser={!!currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase()}
                                            accent={accent}
                                            currentAvatarUrl={currentAvatarUrl}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* User pinned row when not in top 50 */}
                            {userRow && (
                                <div className="mt-3 pt-3 border-t border-white/5">
                                    <Link
                                        href={`/u/${encodeURIComponent(userRow.username)}`}
                                        className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#B366FF]/10 border border-[#B366FF]/20"
                                    >
                                        <div className="flex-shrink-0 w-7 text-center font-display font-black text-sm text-white/60">
                                            {userRow.rank}
                                        </div>
                                        <Avatar username={userRow.username} hintUrl={currentAvatarUrl} size={36} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-display font-black text-sm text-[#B366FF]">You</div>
                                        </div>
                                        <div className="font-display font-black text-sm" style={{ color: accent }}>
                                            {userRow.count.toLocaleString()}
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
