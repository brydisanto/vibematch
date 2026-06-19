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
    /** Optional — Pin Drop's in-house events have no partner. */
    partnerName?: string;
    tabLabel: string;
    image: string;
    description?: string;
    eventWindow?: string;
    prizeNote?: string;
    accentColor?: string;
    /** When set + in the future, the drawer renders a "STARTS IN"
     *  countdown instead of "ENDS IN". Once startsAt passes, the
     *  countdown switches to the endsAt target. */
    startsAt?: string;
    endsAt?: string;
    /** When set, the drawer treats this as a multi-pin event: leaderboard
     *  reads from event_set:<id>:points, a second "Set" tab is shown with
     *  the 4 pins, and per-row counts render as point totals rather than
     *  pin counts. Without it, behaves identically to the original
     *  single-pin OpenSea-style drawer. */
    eventSetId?: string;
}

interface EventSetPin {
    id: string;
    name: string;
    image: string;
    rarityLabel: string | null;
    points: number;
    owned: number;
}

interface EventSetMeta {
    setBonusPoints: number | null;
    scoreCap: number | null;
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

/** "JUL 7 · 12 PM ET" — date + time in America/New_York, capitalized
 *  to match the existing display weight. */
function formatEasternLabel(iso: string): string {
    try {
        const date = new Date(iso);
        const dateStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            month: "short",
            day: "numeric",
        }).format(date).toUpperCase();
        const timeStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }).format(date).replace(/(AM|PM)$/, m => " " + m).toUpperCase();
        const compactTime = timeStr.replace(/:00\s/, " ");
        return `${dateStr} · ${compactTime.trim()} ET`;
    } catch {
        return "";
    }
}

/**
 * Self-contained countdown subtree. Owns its own setInterval state so the
 * per-second tick re-renders ONLY this component, not the parent drawer.
 * Previously the parent useCountdown hook re-rendered the entire drawer
 * (including all 50 leaderboard rows + avatar fetches) every second,
 * which caused noticeable lag.
 *
 * Three phases:
 *   1. PRE-EVENT  (now < startsAt) → "EVENT BEGINS IN" + countdown to startsAt
 *   2. ACTIVE     (startsAt ≤ now < endsAt) → "ENDS <date>" + countdown to endsAt
 *   3. ENDED      (now ≥ endsAt) → "EVENT ENDED" static label
 *
 * Auto-transitions across phases by tracking now per tick rather than
 * pinning to a single target.
 */
const Countdown = memo(function Countdown({
    startsAt,
    endsAt,
    accent,
}: { startsAt?: string; endsAt?: string; accent: string }) {
    const startMs = startsAt ? new Date(startsAt).getTime() : null;
    const endMs = endsAt ? new Date(endsAt).getTime() : null;

    const computePhase = () => {
        const now = Date.now();
        if (startMs !== null && now < startMs) {
            return {
                phase: "pre" as const,
                target: startMs,
                heading: "EVENT BEGINS IN",
                subLabel: startsAt ? formatEasternLabel(startsAt) : "",
            };
        }
        if (endMs !== null && now >= endMs) {
            return {
                phase: "ended" as const,
                target: 0,
                heading: "EVENT ENDED",
                subLabel: "",
            };
        }
        if (endMs !== null) {
            return {
                phase: "active" as const,
                target: endMs,
                heading: "",
                subLabel: endsAt ? `ENDS ${formatEasternLabel(endsAt)}` : "",
            };
        }
        return null;
    };

    const [state, setState] = useState(computePhase);
    useEffect(() => {
        const iv = setInterval(() => setState(computePhase()), 1000);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startMs, endMs]);

    if (!state) return null;
    if (state.phase === "ended") {
        return (
            <div className="font-display text-[10px] tracking-[0.32em] text-white/55 mb-4">
                EVENT ENDED
            </div>
        );
    }

    const tick = formatRemaining(state.target);
    const units = [
        { value: tick.d, label: "DAYS" },
        { value: tick.h, label: "HRS" },
        { value: tick.m, label: "MIN" },
        { value: tick.s, label: "SEC" },
    ];

    return (
        <div className="flex flex-col items-center mb-4">
            <div className="font-display text-[10px] tracking-[0.32em] text-white/45 mb-1.5">
                {state.phase === "pre" ? state.heading : state.subLabel}
            </div>
            {state.phase === "pre" && state.subLabel && (
                <div className="font-mundial text-[10px] tracking-[0.2em] uppercase text-white/35 mb-2">
                    {state.subLabel}
                </div>
            )}
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
    /** When true and rank === 1, render a "WINNER" treatment — larger
     *  row, stronger gold ring, crown glyph. Set on rows in finished
     *  events so the #1 collector is unambiguous. */
    isWinner?: boolean;
}
const LeaderboardRow = memo(function LeaderboardRow({ entry, isUser, accent, currentAvatarUrl, isWinner }: RowProps) {
    const medal = MEDAL[entry.rank];

    if (isWinner) {
        // Elevated winner row: ~50% taller, stronger gold gradient bg,
        // gold ring around avatar, crown glyph in the rank slot,
        // and a scatter of twinkling gold sparkles around the row.
        // Sits visually above the rest of the medal rows; the capstone
        // of the leaderboard for an ended event.
        return (
            <Link
                href={`/u/${encodeURIComponent(entry.username)}`}
                prefetch={false}
                className="flex items-center gap-3 py-3.5 px-3 rounded-xl transition-colors relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(255,180,0,0.08) 60%, rgba(255,215,0,0.04) 100%)",
                    border: "1.5px solid rgba(255,215,0,0.55)",
                    boxShadow: "0 0 24px rgba(255,215,0,0.25), inset 0 0 18px rgba(255,215,0,0.08)",
                }}
            >
                {/* Twinkling sparkles scattered around the banner. Same
                    keyframe (sparkle-twinkle) used by the header EVENT
                    LIVE pill so the visual language is consistent across
                    the app. Positions hand-tuned to avoid the avatar +
                    username + count read regions. */}
                {[
                    { top: "18%", left: "30%", size: 10, delay: "0s" },
                    { top: "62%", left: "22%", size: 8, delay: "0.7s" },
                    { top: "22%", left: "58%", size: 9, delay: "1.4s" },
                    { top: "68%", left: "70%", size: 11, delay: "0.35s" },
                    { top: "30%", left: "92%", size: 8, delay: "1.05s" },
                    { top: "78%", left: "47%", size: 7, delay: "1.75s" },
                ].map((s, i) => (
                    <svg
                        key={i}
                        aria-hidden
                        className="pointer-events-none absolute"
                        viewBox="0 0 24 24"
                        style={{
                            top: s.top,
                            left: s.left,
                            width: s.size,
                            height: s.size,
                            animation: `sparkle-twinkle 2.7s ease-in-out ${s.delay} infinite both`,
                            filter: "drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px #FFD700)",
                        }}
                    >
                        <path
                            d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
                            fill="#ffffff"
                        />
                    </svg>
                ))}
                {/* Crown glyph in the rank slot instead of "1". */}
                <div className="flex-shrink-0 w-7 flex items-center justify-center relative" aria-label="Winner">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="#FFD700"
                        style={{ filter: "drop-shadow(0 0 6px rgba(255,215,0,0.7))" }}
                        aria-hidden
                    >
                        <path d="M3 7l4 3 5-6 5 6 4-3-2 11H5L3 7zm2 13h14v2H5v-2z" />
                    </svg>
                </div>
                <div
                    className="rounded-full overflow-hidden flex-shrink-0 relative"
                    style={{
                        padding: 2,
                        background: "linear-gradient(135deg, #FFD700, #FFA500)",
                        boxShadow: "0 0 12px rgba(255,215,0,0.45)",
                    }}
                >
                    <Avatar
                        username={entry.username}
                        hintUrl={isUser ? currentAvatarUrl : undefined}
                        size={44}
                    />
                </div>
                <div className="flex-1 min-w-0 relative">
                    <div className={`font-display font-black text-base truncate ${isUser ? "text-[#B366FF]" : "text-white"}`}>
                        {isUser ? "You" : entry.username}
                    </div>
                </div>
                <div
                    className="font-display font-black text-lg tabular-nums relative"
                    style={{ color: "#FFD700", textShadow: "0 0 14px rgba(255,215,0,0.55)" }}
                >
                    {entry.count.toLocaleString()}
                </div>
            </Link>
        );
    }

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

    // Set events open on the "Set" tab — players see the collection
    // surface (their progress + the pins to chase) before the
    // leaderboard. Reads as a personal "what's left" first, public
    // ranking second.
    const [view, setView] = useState<"leaderboard" | "set">("set");
    const [setPins, setSetPins] = useState<EventSetPin[]>([]);
    const [setMeta, setSetMeta] = useState<EventSetMeta>({ setBonusPoints: null, scoreCap: null });
    const [scoreLabel, setScoreLabel] = useState<"pins" | "points">("pins");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        // Set events go through ?set=<id> which sources the points
        // leaderboard and returns per-pin owned counts. Standalone
        // events keep the original endpoint shape.
        const url = promo.eventSetId
            ? `/api/promo/leaderboard?set=${encodeURIComponent(promo.eventSetId)}`
            : `/api/promo/leaderboard`;
        fetch(url)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (cancelled || !d) return;
                setEntries(d.leaderboard || []);
                setUserEntry(d.userEntry || null);
                setTotalPlayers(d.totalPlayers || 0);
                if (d.eventSet?.pins) setSetPins(d.eventSet.pins);
                if (d.eventSet) {
                    setSetMeta({
                        setBonusPoints: d.eventSet.setBonusPoints ?? null,
                        scoreCap: d.eventSet.scoreCap ?? null,
                    });
                }
                if (d.scoreLabel === "points") setScoreLabel("points");
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [promo.eventSetId]);

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
                    className="relative max-h-[96vh] overflow-hidden rounded-t-3xl border-t border-x"
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
                    <div className="overflow-y-auto max-h-[calc(96vh-12px)] pb-8">
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
                                <div
                                    className="absolute inset-0 rounded-full overflow-hidden"
                                    style={{
                                        filter: `drop-shadow(0 6px 20px ${accent}55)`,
                                        border: `2px solid ${accent}66`,
                                    }}
                                >
                                    <Image
                                        src={promo.image}
                                        alt={promo.name}
                                        fill
                                        sizes="112px"
                                        className="object-cover"
                                    />
                                </div>
                            </div>

                            {promo.partnerName && (
                                <div className="font-mundial text-[11px] tracking-[0.28em] uppercase text-white/45 mb-1">
                                    {promo.partnerName}
                                </div>
                            )}
                            <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight text-center mb-3 leading-[1.05]">
                                {promo.name}
                            </h2>
                            {promo.description && (
                                <p className="max-w-xl text-center font-mundial text-[13px] sm:text-[14px] text-white/60 leading-relaxed mb-4">
                                    {promo.description}
                                </p>
                            )}

                            {(promo.startsAt || promo.endsAt) && (
                                <Countdown
                                    startsAt={promo.startsAt}
                                    endsAt={promo.endsAt}
                                    accent={accent}
                                />
                            )}

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
                                    <div className="font-display text-[9px] tracking-[0.3em] text-white/45 mb-0.5">
                                        {(() => {
                                            const userScore = userEntry?.count ?? 0;
                                            const maxed = setMeta.scoreCap !== null && userScore >= setMeta.scoreCap;
                                            if (maxed) return "MAXED";
                                            return scoreLabel === "points" ? "YOUR POINTS" : "YOUR PINS";
                                        })()}
                                    </div>
                                    <div
                                        className="font-display text-xl font-black"
                                        style={{
                                            color: setMeta.scoreCap !== null && (userEntry?.count ?? 0) >= setMeta.scoreCap
                                                ? accent
                                                : "#fff",
                                        }}
                                    >
                                        {userEntry ? userEntry.count.toLocaleString() : "0"}
                                        {setMeta.scoreCap !== null && (
                                            <span className="font-display text-sm font-black text-white/35">
                                                {" "}/ {setMeta.scoreCap}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tab strip — only rendered for set events. Single-pin
                            events skip straight to the leaderboard view since
                            there's no "set" to show. Centered with larger tap
                            targets so the two tabs feel balanced under the
                            hero rather than left-anchored. */}
                        {promo.eventSetId && (
                            <div className="px-5 pt-2 pb-2 flex justify-center gap-6 border-b border-white/[0.04]">
                                <button
                                    type="button"
                                    onClick={() => setView("set")}
                                    className="px-3 py-2.5 font-display font-black text-[13px] tracking-[0.22em] uppercase transition-colors"
                                    style={{
                                        color: view === "set" ? accent : "rgba(255,255,255,0.5)",
                                        borderBottom: view === "set" ? `2px solid ${accent}` : "2px solid transparent",
                                    }}
                                >
                                    The Set
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setView("leaderboard")}
                                    className="px-3 py-2.5 font-display font-black text-[13px] tracking-[0.22em] uppercase transition-colors"
                                    style={{
                                        color: view === "leaderboard" ? accent : "rgba(255,255,255,0.5)",
                                        borderBottom: view === "leaderboard" ? `2px solid ${accent}` : "2px solid transparent",
                                    }}
                                >
                                    Leaderboard
                                </button>
                            </div>
                        )}

                        {/* Content */}
                        {view === "leaderboard" ? (
                            <div className="px-5 pb-3 pt-3">
                                {/* TOP COLLECTORS header is redundant with the
                                    "Leaderboard" tab label on set events. Keep
                                    it for single-pin events where there's no
                                    tab strip above to do that job. */}
                                {!promo.eventSetId && (
                                    <h3 className="font-display font-black text-white text-sm tracking-[0.2em] mb-3">TOP COLLECTORS</h3>
                                )}
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
                                                isWinner={ended && entry.rank === 1}
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
                        ) : (
                            <SetView
                                pins={setPins}
                                accent={accent}
                                setBonusPoints={setMeta.setBonusPoints}
                                scoreCap={setMeta.scoreCap}
                            />
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// ── Set view ─────────────────────────────────────────────────────────
// Tab 2 of the drawer for multi-pin events. Renders the 4 set pins as
// cards: image, name, rarity label, point value, and the signed-in
// user's owned count. Provides the "what's left to collect?" answer
// the leaderboard alone can't.
function SetView({
    pins,
    accent,
    setBonusPoints,
    scoreCap,
}: {
    pins: EventSetPin[];
    accent: string;
    setBonusPoints: number | null;
    scoreCap: number | null;
}) {
    if (pins.length === 0) {
        return (
            <div className="px-5 pt-6 pb-12 text-center font-mundial text-sm text-white/40">
                Loading set…
            </div>
        );
    }
    return (
        <div className="px-5 pt-4 pb-6">
            {/* Bonus + cap explainer. Hidden when neither is configured
                so single-pin sets and uncapped events render unchanged. */}
            {(setBonusPoints !== null || scoreCap !== null) && (
                <div
                    className="rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-x-5 gap-y-1.5 justify-center text-center"
                    style={{
                        background: `linear-gradient(135deg, ${accent}14, ${accent}06)`,
                        border: `1px solid ${accent}33`,
                    }}
                >
                    {setBonusPoints !== null && setBonusPoints > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="font-display text-[9px] tracking-[0.22em] uppercase text-white/45">FULL SET</span>
                            <span className="font-display font-black text-[13px]" style={{ color: accent }}>
                                +{setBonusPoints} pts
                            </span>
                        </div>
                    )}
                    {scoreCap !== null && (
                        <div className="flex items-center gap-2">
                            <span className="font-display text-[9px] tracking-[0.22em] uppercase text-white/45">CAPS AT</span>
                            <span className="font-display font-black text-[13px]" style={{ color: accent }}>
                                {scoreCap} pts
                            </span>
                        </div>
                    )}
                </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pins.map(pin => (
                    <div
                        key={pin.id}
                        className="rounded-xl p-3 flex flex-col items-center text-center transition-transform"
                        style={{
                            background: `linear-gradient(135deg, ${accent}14, ${accent}05)`,
                            border: `1px solid ${accent}33`,
                            boxShadow: pin.owned > 0 ? `0 0 14px ${accent}26` : "none",
                            opacity: pin.owned > 0 ? 1 : 0.7,
                        }}
                    >
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2">
                            <Image
                                src={pin.image}
                                alt={pin.name}
                                fill
                                sizes="80px"
                                className="object-contain"
                                style={pin.owned === 0 ? { filter: "grayscale(70%) brightness(0.7)" } : undefined}
                                unoptimized
                            />
                        </div>
                        <div className="font-display font-black text-[11px] sm:text-[12px] text-white leading-tight mb-1 line-clamp-2">
                            {pin.name}
                        </div>
                        {pin.rarityLabel && (
                            <div className="font-display text-[9px] tracking-[0.2em] uppercase mb-1.5" style={{ color: accent }}>
                                {pin.rarityLabel}
                            </div>
                        )}
                        <div className="flex items-center justify-between w-full mt-auto pt-2 border-t border-white/5">
                            <span className="font-mundial text-[9px] tracking-[0.15em] uppercase text-white/40">PTS</span>
                            <span className="font-display font-black text-[12px] tabular-nums" style={{ color: accent }}>
                                {pin.points}
                            </span>
                        </div>
                        <div className="flex items-center justify-between w-full">
                            <span className="font-mundial text-[9px] tracking-[0.15em] uppercase text-white/40">OWNED</span>
                            <span className="font-display font-black text-[12px] tabular-nums text-white">
                                ×{pin.owned}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
