"use client";

/**
 * Desktop (≥1024px) landing — the "Arcade Cabinet" variant A from the
 * Claude Design handoff bundle (DesktopVariants.jsx).
 *
 * Three-panel layout (landing-v2 reorganization):
 *   - Left (300px):   MY CAPSULES hero / PINS COLLECTED grid / QUESTS
 *   - Center (flex):  PLAYERS VIBING marquee / logo / Classic cabinet /
 *                     Prize Games strip / 5-col nav
 *   - Right (300px):  profile block / DAILY CHALLENGE hero / RECENT RUNS
 *
 * Guest users never land here — the parent dispatcher falls back to the
 * mobile Quest layout for anyone who isn't authenticated, so everything
 * below assumes `userProfile` is populated.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { LogOut, Crown } from "lucide-react";
import { BADGES, type BadgeTier } from "@/lib/badges";
import { getTierByCount } from "@/lib/tiers";
import { ALL_ACHIEVEMENTS, getQuestProgressList, type QuestProgress } from "@/lib/achievements";
import { isPromoActive, getPrimaryActiveEvent } from "@/lib/promo-badges";
import { buildPlayerContext } from "@/lib/playerContext";
import { getEasternDailyKey, getNextNoonEastern } from "@/lib/daily-window";
import { GameMode } from "@/lib/gameEngine";
import ProfileModal from "./ProfileModal";
import LeaderboardModal from "./LeaderboardModal";
import TierInfoModal from "./TierInfoModal";
import EventDrawer from "./EventDrawer";
import { ChunkyButton, FloatingBadges } from "./arcade";
import {
    GOLD,
    GOLD_DIM,
    GOLD_DEEP,
    GOLD_LIGHT,
    COSMIC,
    COSMIC_DEEP,
    ORANGE,
    ORANGE_DEEP,
    ORANGE_LIGHT,
    PINK,
    RED as TOKEN_RED,
} from "@/lib/arcade-tokens";

interface LandingPageArcadeProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
    onLogout?: () => void;
    onOpenPinBook?: (initialTab?: "collection" | "leaderboard" | "capsules") => void;
    onOpenAchievements?: () => void;
    onOpenBuyPrizeGames?: () => void;
    onOpenReroll?: () => void;
    /** Called after a successful profile save so the parent can update
     *  userProfile state and the avatar refreshes without a page reload. */
    onProfileUpdate?: (username: string, avatarUrl: string) => void;
    capsuleCount?: number;
    classicPlays?: number;
    bonusPrizeGames?: number;
    pinsCollected?: number;
    pins?: Record<string, { count: number; firstEarned: string; lastPulled?: string }>;
    questsCompleted?: number;
    /** IDs of achievements the player has already unlocked — used to
     *  filter the "closest to unlock" QUESTS rail. */
    unlockedAchievementIds?: string[];
    userProfile: { username: string; avatarUrl: string };
}

/* ========= COUNTDOWN ========= */
function formatCountdown() {
    const now = new Date();
    const target = getNextNoonEastern(now);
    const diff = Math.max(0, target.getTime() - now.getTime());
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

interface GlobalRun {
    username: string;
    avatarUrl: string | null;
    mode: string;
    score: number;
    timestamp: number;
}

type FeedTab = "mine" | "global";

interface VibingPlayer {
    username: string;
    avatarUrl: string;
}

interface DailyStats {
    yourBest: number | null;
    topScore: number | null;
    totalPlayers: number;
    yourRank: number | null;
}

// Default avatar used in two distinct ways across this file:
//  - DEFAULT_BADGE: the shaka pin (any_gvc) — used decoratively on the
//    PLAYERS VIBING stack and the right-rail profile block. Stays as
//    the gold-rimmed badge there because that surface is design-led.
//  - DEFAULT_FEED_AVATAR: the GVC blank-white citizen — used on the
//    global feed (FeedAvatar) for users without an uploaded avatar.
//    Reads as "GVC member, hasn't customized yet" instead of "decoration".
//    Falls back to a plain <img> for data: URLs since next/image refuses
//    those in optimized mode.
const DEFAULT_AVATAR = "/badges/any_gvc_1759173799963.webp";
const DEFAULT_FEED_AVATAR = "/avatars/default.jpg";

// Tight single-letter mode chip used on global feed rows. Replaces the
// wider CLASSIC / DAILY text pill so usernames have predictable room
// next to the chip + avatar regardless of mode label length.
//   C = Classic (gold), D = Daily (cosmic purple — matches the DAILY
//   CHALLENGE box on the right rail), F = Frenzy (red).
// White letter on the cosmic chip since the deep purple bg eats the
// dark-text contrast that gold + red need.
function ModeChip({ mode }: { mode: string }) {
    const map: Record<string, { letter: string; bg: string; fg: string }> = {
        classic: { letter: "C", bg: GOLD, fg: "#1A0E02" },
        daily: { letter: "D", bg: COSMIC, fg: "#FFFFFF" },
        frenzy: { letter: "F", bg: ORANGE, fg: "#1A0E02" },
    };
    const m = map[mode] || map.classic;
    return (
        <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 font-display font-black text-[12px] leading-none"
            style={{ background: m.bg, color: m.fg }}
            aria-label={mode.toUpperCase()}
        >
            {m.letter}
        </span>
    );
}

function FeedAvatar({ avatarUrl, username }: { avatarUrl: string | null; username: string }) {
    const isData = !!avatarUrl && avatarUrl.startsWith("data:");

    // Default-avatar path: GVC blank-white citizen rendered inside the
    // same circular clipped chip as uploaded avatars. The blank-white
    // figure needs a circular crop (not full-image display) to read
    // as "user avatar" rather than "decorative badge".
    if (!avatarUrl) {
        return (
            <span
                className="relative shrink-0 inline-block w-6 h-6 rounded-full overflow-hidden"
                style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,224,72,0.55)",
                }}
                aria-hidden
            >
                <Image
                    src={DEFAULT_FEED_AVATAR}
                    alt=""
                    fill
                    sizes="24px"
                    className="object-cover"
                />
            </span>
        );
    }

    // Uploaded avatars keep the bordered + clipped chip treatment so
    // photos render inside a circle with a thin gold rim.
    return (
        <span
            className="relative shrink-0 inline-block w-6 h-6 rounded-full overflow-hidden"
            style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,224,72,0.55)",
            }}
            aria-hidden
        >
            {isData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
                <Image src={avatarUrl} alt={username} fill sizes="24px" className="object-cover" />
            )}
        </span>
    );
}

/* ========= MAIN ========= */
export default function LandingPageArcade({
    onStartGame,
    onShowInstructions,
    onLogout,
    onOpenPinBook,
    onOpenAchievements,
    onOpenBuyPrizeGames,
    onOpenReroll,
    onProfileUpdate,
    capsuleCount = 0,
    classicPlays = 0,
    bonusPrizeGames = 0,
    pinsCollected = 0,
    pins = {},
    questsCompleted = 0,
    unlockedAchievementIds = [],
    userProfile,
}: LandingPageArcadeProps) {
    const [isProfileOpen, setProfileOpen] = useState(false);
    // The first profile click triggers __pdEnsureWallet, which flips
    // walletReady in AppClient and re-wraps the tree in <WalletProvider>.
    // That re-wrap remounts this landing component, throwing away any
    // local setState we just called. Stash a window flag before the
    // wallet trigger so the new mount can pick it up below.
    const openProfile = () => {
        const win = window as unknown as { __pdEnsureWallet?: () => void; __pdPendingProfileOpen?: boolean };
        win.__pdPendingProfileOpen = true;
        win.__pdEnsureWallet?.();
        setProfileOpen(true);
    };
    useEffect(() => {
        const win = window as unknown as { __pdPendingProfileOpen?: boolean };
        if (win.__pdPendingProfileOpen) {
            win.__pdPendingProfileOpen = false;
            setProfileOpen(true);
        }
    }, []);
    const [isTierInfoOpen, setTierInfoOpen] = useState(false);
    // Leaderboard modal open-state doubles as its initial tab, so the
    // Leaders nav button can open on "classic" while the DAILY CHALLENGE
    // VIEW LEADERS CTA jumps straight to "daily" and the SCORE/PIN rank
    // tiles route to their respective boards.
    const [leaderboardTab, setLeaderboardTab] = useState<"classic" | "daily" | "frenzy" | "pins" | "promo" | null>(null);
    const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
    // Active partner event (OpenSea Aye Aye Captain at launch). When the
    // NEXT_PUBLIC_PROMO_ACTIVE flag is on, the top marquee surfaces a
    // clickable EVENT LIVE chip that opens a dedicated EventDrawer with
    // hero copy, stats, and the collector leaderboard. Falls back to
    // null cleanly when nothing's running.
    // Resolved primary event for the pill + drawer. Sets win over
    // standalone promos; within standalone, droppable wins over ended.
    // The returned activePromo is a unified shape with the fields the
    // pill JSX already reads (image, name, partnerName, endsAt) plus
    // the eventSetId the drawer needs to switch into set mode.
    const activePromo = (() => {
        if (!isPromoActive()) return null;
        const primary = getPrimaryActiveEvent();
        if (!primary) return null;
        if (primary.kind === "standalone") {
            const p = primary.promo;
            return {
                id: p.id,
                name: p.name,
                partnerName: p.partnerName ?? "",
                tabLabel: p.tabLabel,
                image: p.image,
                description: p.description,
                eventWindow: p.eventWindow,
                prizeNote: p.prizeNote,
                accentColor: p.accentColor,
                startsAt: undefined as string | undefined,
                endsAt: p.endsAt,
                eventSetId: undefined as string | undefined,
            };
        }
        // Set event — derive PromoInfo-shaped display from the set
        // metadata. Prefer the set's dedicated heroImage; fall back to
        // the highest-points pin if no hero asset is supplied.
        const set = primary.set;
        const heroPin = [...primary.pins].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
        return {
            id: set.id,
            name: set.name,
            partnerName: set.partnerName ?? "",
            tabLabel: set.tabLabel,
            setTabLabel: set.setTabLabel,
            image: set.heroImage ?? heroPin?.image ?? "",
            description: set.description,
            eventWindow: set.eventWindow,
            prizeNote: set.prizeNote,
            accentColor: set.accentColor,
            startsAt: set.startsAt,
            endsAt: set.endsAt,
            eventSetId: set.id,
        };
    })();
    // Treat the pill as "final results" once endsAt has passed — drops
    // stop everywhere else automatically, but the leaderboard tab and
    // drawer remain available so winners can be confirmed. Reactive so
    // an already-open tab flips the moment the cutoff hits, without
    // needing a page refresh.
    const [promoEnded, setPromoEnded] = useState<boolean>(() => {
        if (!activePromo?.endsAt) return false;
        return Date.now() >= new Date(activePromo.endsAt).getTime();
    });
    useEffect(() => {
        if (!activePromo?.endsAt) return;
        const endMs = new Date(activePromo.endsAt).getTime();
        const remaining = endMs - Date.now();
        if (remaining <= 0) {
            setPromoEnded(true);
            return;
        }
        setPromoEnded(false);
        const t = setTimeout(() => setPromoEnded(true), remaining);
        return () => clearTimeout(t);
    }, [activePromo?.endsAt]);
    // Mirror of promoEnded but for startsAt — flips the chip from
    // COMING SOON to EVENT LIVE the moment the window opens.
    const [promoStarted, setPromoStarted] = useState<boolean>(() => {
        if (!activePromo?.startsAt) return true;
        return Date.now() >= new Date(activePromo.startsAt).getTime();
    });
    useEffect(() => {
        if (!activePromo?.startsAt) return;
        const startMs = new Date(activePromo.startsAt).getTime();
        const remaining = startMs - Date.now();
        if (remaining <= 0) {
            setPromoStarted(true);
            return;
        }
        setPromoStarted(false);
        const t = setTimeout(() => setPromoStarted(true), remaining);
        return () => clearTimeout(t);
    }, [activePromo?.startsAt]);
    const [streak, setStreak] = useState(0);
    const [personalBest, setPersonalBest] = useState<number>(0);
    const [frenzyBest, setFrenzyBest] = useState<number>(0);
    const [totalPlayers, setTotalPlayers] = useState<number>(0);
    const [pinRank, setPinRank] = useState<number | null>(null);
    const [scoreRank, setScoreRank] = useState<number | null>(null);
    const [frenzyRank, setFrenzyRank] = useState<number | null>(null);
    const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
    const [globalRuns, setGlobalRuns] = useState<GlobalRun[]>([]);
    // GLOBAL is the default — the panel is more interesting filled with
    // everyone's plays than just the current user's history.
    const [feedTab, setFeedTab] = useState<FeedTab>("global");
    const [vibingPlayers, setVibingPlayers] = useState<VibingPlayer[]>([]);
    const [dailyStats, setDailyStats] = useState<DailyStats>({ yourBest: null, topScore: null, totalPlayers: 0, yourRank: null });
    const [playedDaily, setPlayedDaily] = useState<boolean>(false);
    // Stable random seed per mount — drives the QUESTS rotation so the
    // player sees a different 3-quest slice each visit without them
    // reshuffling on every re-render.
    const [questPickSeed] = useState<number>(() => Math.random());
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

    // Current #1 on today's daily? Drives the champion crown pill +
    // gold glow on the hero card.
    const isDailyChamp = dailyStats.yourRank === 1;

    // Quest rotation — per the landing-v2 design, the rail surfaces 3
    // random quests each visit (refresh = new set). We seed a stable
    // random once at mount and use a tiny id-hash fold so the three
    // picks don't reshuffle on re-render, but progress values still
    // flow through when pins / streak update mid-session.
    const shownQuests: QuestProgress[] = useMemo(() => {
        const ctx = buildPlayerContext(pins, { streak });
        const unlockedSet = new Set(unlockedAchievementIds);
        const candidates = getQuestProgressList(ctx)
            .filter(q => !unlockedSet.has(q.def.id) && q.percent < 1);
        const scored = candidates.map(q => {
            let h = 0;
            const key = q.def.id + String(questPickSeed);
            for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
            return { q, h };
        });
        scored.sort((a, b) => a.h - b.h);
        return scored.slice(0, 3).map(s => s.q);
    }, [pins, streak, unlockedAchievementIds, questPickSeed]);

    // Recent pulls — sort by lastPulled desc so duplicate pulls also bubble
    // to the top, falling back to firstEarned for legacy entries that don't
    // carry a lastPulled timestamp yet. Take top 12 so the rail can render
    // a 4×3 grid of recent pins. `isNew` flags pins the player still only
    // has one copy of so the tile surfaces a green NEW indicator on hover.
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
            .slice(0, 12);
    }, [pins]);

    // Streak fetch
    useEffect(() => {
        fetch(`/api/streak?username=${username}`)
            .then(r => r.json())
            .then(s => { if (s.streak > 0) setStreak(s.streak); })
            .catch(() => { /* silent */ });
    }, [username]);

    // Silent preloader for game-board badges + active-event assets.
    // Mirrors the mobile Quest landing so the desktop arcade also has
    // warm cache for the drawer + first game.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const t = setTimeout(async () => {
            const seen = new Set<string>();
            const preload = (url: string) => {
                if (seen.has(url)) return;
                seen.add(url);
                const raw = new window.Image();
                raw.src = url;
                const optimized = new window.Image();
                optimized.src = `/_next/image?url=${encodeURIComponent(url)}&w=96&q=75`;
            };
            BADGES.filter(b => !b.collectOnly).forEach(b => preload(b.image));
            try {
                const promoModule = await import("@/lib/promo-badges");
                if (promoModule.isPromoActive()) {
                    promoModule.getActivePromoBadges().forEach(p => preload(p.image));
                    const primary = promoModule.getPrimaryActiveEvent();
                    if (primary?.kind === "set") {
                        if (primary.set.heroImage) preload(primary.set.heroImage);
                        if (primary.set.gameBackground) preload(primary.set.gameBackground);
                        if (primary.set.partnerLogo) preload(primary.set.partnerLogo);
                    }
                }
            } catch { /* silent */ }
        }, 800);
        return () => clearTimeout(t);
    }, []);

    // Classic leaderboard fetch — personal best + all-time score rank.
    // Total players (marquee count) now comes from /api/players-vibing
    // so the count matches the avatar stack.
    useEffect(() => {
        fetch(`/api/scores?mode=classic&username=${encodeURIComponent(username)}`)
            .then(r => r.json())
            .then(data => {
                if (typeof data.personalBest === "number") setPersonalBest(data.personalBest);
                if (typeof data.userRank === "number") setScoreRank(data.userRank);
            })
            .catch(() => { /* silent */ });
    }, [username]);

    // Frenzy leaderboard fetch — personal best + all-time rank. Mirrors
    // the Classic fetch above so the right-rail profile block surfaces
    // both modes side by side.
    useEffect(() => {
        fetch(`/api/scores?mode=frenzy&username=${encodeURIComponent(username)}`)
            .then(r => r.json())
            .then(data => {
                if (typeof data.personalBest === "number") setFrenzyBest(data.personalBest);
                if (typeof data.userRank === "number") setFrenzyRank(data.userRank);
            })
            .catch(() => { /* silent */ });
    }, [username]);

    // Players Vibing feed — count + avatar stack for the top marquee.
    // Cached 30s server-side; we refetch on mount only to avoid thrash.
    useEffect(() => {
        fetch("/api/players-vibing")
            .then(r => r.json())
            .then(data => {
                if (typeof data.count === "number") setTotalPlayers(data.count);
                if (Array.isArray(data.avatars)) setVibingPlayers(data.avatars);
            })
            .catch(() => { /* silent */ });
    }, []);

    // Daily challenge stats + played-today flag for the right-rail box.
    // Refetched on mount *and* on window focus so returning from a
    // daily game refreshes the stats without a manual reload. Cache
    // headers on the score endpoint keep this cheap.
    useEffect(() => {
        let cancelled = false;
        const refresh = () => {
            fetch(`/api/scores?mode=daily&username=${encodeURIComponent(username)}`)
                .then(r => r.json())
                .then(data => {
                    if (cancelled) return;
                    // Leaderboard is ordered rev by score, so entry 0 is
                    // the day's top score (or null if no plays yet).
                    const top = Array.isArray(data.leaderboard) && data.leaderboard.length > 0
                        ? Number(data.leaderboard[0]?.score) || null
                        : null;
                    setDailyStats({
                        yourBest: typeof data.personalBest === "number" && data.personalBest > 0 ? data.personalBest : null,
                        topScore: top && top > 0 ? top : null,
                        totalPlayers: typeof data.totalPlayers === "number" ? data.totalPlayers : 0,
                        yourRank: typeof data.userRank === "number" ? data.userRank : null,
                    });
                })
                .catch(() => { /* silent */ });
            fetch("/api/daily-status")
                .then(r => r.json())
                .then(data => { if (!cancelled && typeof data.playedToday === "boolean") setPlayedDaily(data.playedToday); })
                .catch(() => { /* silent */ });
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => {
            cancelled = true;
            window.removeEventListener("focus", refresh);
        };
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

    // Recent runs fetch — capped at 6 so the right-rail scrolls less.
    // Two scopes feed the RECENT RUNS tab toggle: "mine" (the player's
    // own history, auth required) and "global" (the rolling activity
    // feed of everyone playing, public). We fetch mine eagerly on
    // mount and global on first switch — most sessions never toggle.
    useEffect(() => {
        fetch("/api/recent-scores?scope=me&limit=6")
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.runs)) setRecentRuns(data.runs);
            })
            .catch(() => { /* silent */ });
    }, [username]);

    useEffect(() => {
        if (feedTab !== "global") return;
        // Initial fetch + poll every 6s while the GLOBAL tab is
        // visible, so games flow into the feed in near-realtime
        // without a manual refresh. The endpoint sets a 5s edge
        // cache (Cache-Control: public, s-maxage=5), so most of
        // these polls hit Vercel's CDN — only the occasional
        // refresh actually touches KV.
        const fetchGlobal = () => {
            fetch("/api/recent-scores?scope=global&limit=6")
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data.runs)) setGlobalRuns(data.runs);
                })
                .catch(() => { /* silent */ });
        };
        fetchGlobal();
        const interval = setInterval(fetchGlobal, 6000);
        return () => clearInterval(interval);
    }, [feedTab]);

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
        const todayStr = getEasternDailyKey();
        let newBestTagged = false;
        return recentRuns.map(run => {
            const dateStr = getEasternDailyKey(new Date(run.timestamp));
            let tag: "NEW BEST" | "TODAY" | null = null;
            if (run.mode === "classic" && !newBestTagged && personalBest > 0 && run.score === personalBest) {
                tag = "NEW BEST";
                newBestTagged = true;
            } else if (run.mode === "daily" && dateStr === todayStr) {
                tag = "TODAY";
            }
            const label = run.mode === "daily" ? "Daily" : run.mode === "frenzy" ? "Frenzy" : "Classic";
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
                        {/* MY ITEMS — compact unified block matching
                            production: capsules + extra-pins as two
                            stacked horizontal sub-cards sharing the
                            same MY ITEMS header. */}
                        <div className="px-5 pt-6 pb-3 border-b border-white/5 flex flex-col gap-2.5">
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
                                            Trade them in for capsules
                                        </div>
                                    </div>
                                    <ChunkyButton
                                        onClick={() => onOpenReroll?.()}
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

                        {/* PINS COLLECTED — 8-tile grid of most-recent pulls,
                            rarity-tinted borders preserve the color coding
                            used everywhere else in the app. Empty slots
                            render as dashed placeholders so the grid's
                            shape is always visible. */}
                        <div className="px-5 pt-4 pb-4 border-b border-white/5">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="font-display text-[10px] tracking-[0.3em]" style={{ color: GOLD }}>
                                    PINS COLLECTED
                                </div>
                                <span
                                    className="font-display font-black text-[13px] tabular-nums"
                                    style={{ color: GOLD }}
                                >
                                    {pinsCollected}<span className="opacity-45">/{totalBadges}</span>
                                    <span className="opacity-55"> ({pinPct}%)</span>
                                </span>
                            </div>
                            <div
                                className="relative h-2 rounded-full overflow-hidden mb-3"
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
                            <div className="grid grid-cols-4 gap-1.5">
                                {Array.from({ length: 12 }).map((_, i) => {
                                    const pin = recentPulls[i];
                                    if (!pin) {
                                        return (
                                            <div
                                                key={`slot-${i}`}
                                                className="aspect-square rounded-lg"
                                                style={{
                                                    background: "rgba(255,255,255,0.02)",
                                                    border: "1px dashed rgba(255,255,255,0.08)",
                                                }}
                                            />
                                        );
                                    }
                                    const meta = TIER_META[pin.tier];
                                    // Column-aware tooltip alignment so
                                    // leftmost and rightmost tiles don't
                                    // push their hover cards past the rail
                                    // edge. Middle columns center normally.
                                    const col = i % 4;
                                    const tooltipAlign =
                                        col === 0
                                            ? { left: 0, right: "auto", transform: "none" as const }
                                            : col === 3
                                                ? { left: "auto" as const, right: 0, transform: "none" as const }
                                                : { left: "50%", right: "auto", transform: "translateX(-50%)" as const };
                                    return (
                                        <button
                                            key={pin.id}
                                            type="button"
                                            onClick={() => onOpenPinBook?.()}
                                            className="group aspect-square rounded-lg p-[1.5px] cursor-pointer transition-all duration-200 ease-out hover:-translate-y-[2px] hover:brightness-[1.12] relative"
                                            style={{
                                                background: `linear-gradient(180deg, ${meta.tint}aa, ${meta.tint}44)`,
                                                boxShadow: `0 0 8px ${meta.tint}33`,
                                            }}
                                        >
                                            <div
                                                className="w-full h-full rounded-[7px] overflow-hidden relative"
                                                style={{ background: "#0c0418" }}
                                            >
                                                <Image src={pin.image} alt="" fill sizes="56px" className="object-cover" />
                                            </div>
                                            {pin.isNew && (
                                                <span
                                                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                                                    style={{
                                                        background: "#2EFF2E",
                                                        boxShadow: "0 0 8px rgba(46,255,46,0.8)",
                                                    }}
                                                />
                                            )}
                                            {/* Hover card — absolute, escapes
                                                the tile so the full pin name
                                                is readable. Column-aligned
                                                so edge tiles don't clip. Width
                                                is capped and names wrap so long
                                                pin names stay inside the rail
                                                boundary rather than overflowing
                                                past the right edge. */}
                                            <div
                                                className="pointer-events-none absolute bottom-full mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 text-center"
                                                style={{
                                                    ...tooltipAlign,
                                                    width: 180,
                                                    background: "rgba(12, 4, 24, 0.96)",
                                                    border: `1px solid ${meta.tint}66`,
                                                    boxShadow: `0 4px 14px rgba(0,0,0,0.6), 0 0 12px ${meta.tint}33`,
                                                    borderRadius: 8,
                                                    padding: "6px 9px",
                                                }}
                                            >
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    <span className="font-display text-[11px] font-black text-white leading-tight break-words text-center">
                                                        {pin.name}
                                                    </span>
                                                    {pin.isNew && (
                                                        <span
                                                            className="font-display text-[8px] font-black uppercase tracking-[0.15em] px-1.5 py-[2px] rounded-sm leading-none"
                                                            style={{
                                                                color: "#0A2E12",
                                                                background: "#2EFF2E",
                                                                boxShadow: "0 0 8px rgba(46,255,46,0.5)",
                                                            }}
                                                        >
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className="text-[9px] font-bold tracking-[0.15em] uppercase mt-1 text-center"
                                                    style={{ color: `${meta.tint}cc` }}
                                                >
                                                    {meta.label}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => onOpenPinBook?.()}
                                className="mt-2.5 w-full text-[10px] font-display tracking-[0.25em] py-1.5 rounded-lg cursor-pointer transition-all hover:brightness-125"
                                style={{ color: GOLD, border: `1px solid ${GOLD}44`, background: `${GOLD}0a` }}
                            >
                                VIEW PINBOOK →
                            </button>
                        </div>

                        {/* QUESTS — 3 closest-to-unlock achievements,
                            ranked by progress %. Each shows the icon,
                            title, X/Y progress, and a thin progress bar.
                            Empty state (everything done or rail hasn't
                            loaded yet) falls back to a compact teaser. */}
                        <div
                            className="flex-1 relative flex flex-col px-5 py-5"
                            style={{ background: `radial-gradient(circle at 50% 40%, ${COSMIC}20, transparent 60%)` }}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="font-display text-[10px] tracking-[0.3em]" style={{ color: COSMIC }}>
                                    QUESTS
                                </div>
                                <span
                                    className="font-display font-black text-[13px] tabular-nums"
                                    style={{ color: COSMIC }}
                                >
                                    {questsCompleted}<span className="opacity-45">/{totalQuests}</span>
                                    <span className="opacity-55"> ({totalQuests > 0 ? Math.round((questsCompleted / totalQuests) * 100) : 0}%)</span>
                                </span>
                            </div>
                            <div
                                className="relative h-2 rounded-full overflow-hidden mb-3"
                                style={{
                                    background: "rgba(255,255,255,0.08)",
                                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                                }}
                            >
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full"
                                    style={{
                                        width: `${totalQuests > 0 ? (questsCompleted / totalQuests) * 100 : 0}%`,
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
                            {shownQuests.length === 0 ? (
                                <div className="text-[11px] text-white/40 leading-relaxed">
                                    Play a game to start unlocking quests.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {shownQuests.map(q => {
                                        const pct = Math.round(q.percent * 100);
                                        return (
                                            <button
                                                key={q.def.id}
                                                type="button"
                                                onClick={onOpenAchievements}
                                                className="rounded-lg px-2.5 py-2 flex flex-col cursor-pointer transition-all hover:-translate-y-[1px] hover:brightness-[1.1] text-left"
                                                style={{
                                                    background: "rgba(255,255,255,0.04)",
                                                    border: `1px solid ${COSMIC}33`,
                                                }}
                                            >
                                                <div className="flex items-baseline justify-between gap-1.5">
                                                    <span className="font-display text-[11px] font-black text-white truncate">
                                                        {q.def.title}
                                                    </span>
                                                    <span
                                                        className="font-display text-[9px] font-black tabular-nums shrink-0"
                                                        style={{ color: COSMIC }}
                                                    >
                                                        {pct}%
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-white/55 leading-snug mt-0.5">
                                                    {q.def.description}
                                                </div>
                                                <div
                                                    className="relative h-1.5 rounded-full overflow-hidden mt-1.5"
                                                    style={{ background: "rgba(255,255,255,0.08)" }}
                                                >
                                                    <div
                                                        className="absolute inset-y-0 left-0 rounded-full"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: `linear-gradient(90deg, ${COSMIC}, #D8A0FF)`,
                                                            boxShadow: `0 0 6px ${COSMIC}88`,
                                                        }}
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={onOpenAchievements}
                                className="mt-3 w-full text-[10px] font-display tracking-[0.25em] py-2 rounded-lg cursor-pointer transition-all hover:brightness-125"
                                style={{ color: COSMIC, border: `1px solid ${COSMIC}44`, background: `${COSMIC}0a` }}
                            >
                                VIEW ALL QUESTS →
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
                            <div className="relative flex items-center justify-between">
                                {/* Avatar stack + live-ish player count. The
                                    stack is capped at 5 faces so the overlap
                                    pattern stays legible; a subtle pulsing
                                    green dot tags the leftmost face to imply
                                    live activity without overclaiming. */}
                                <div className="flex items-center gap-2.5 min-h-[22px]">
                                    {vibingPlayers.length > 0 && (
                                        <div className="flex -space-x-2">
                                            {vibingPlayers.slice(0, 5).map((p, i) => (
                                                <div
                                                    key={`${p.username}-${i}`}
                                                    className="relative rounded-full overflow-hidden"
                                                    style={{
                                                        width: 22,
                                                        height: 22,
                                                        border: `1.5px solid #0a0418`,
                                                        background: `linear-gradient(135deg, ${COSMIC}, ${PINK})`,
                                                        zIndex: 5 - i,
                                                        boxShadow: i === 0 ? `0 0 0 1.5px ${GOLD}` : undefined,
                                                    }}
                                                    title={p.username}
                                                >
                                                    {p.avatarUrl ? (
                                                        p.avatarUrl.startsWith("data:") ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={p.avatarUrl}
                                                                alt=""
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <Image
                                                                src={p.avatarUrl}
                                                                alt=""
                                                                fill
                                                                sizes="22px"
                                                                className="object-cover"
                                                            />
                                                        )
                                                    ) : (
                                                        <Image
                                                            src={DEFAULT_FEED_AVATAR}
                                                            alt=""
                                                            fill
                                                            sizes="22px"
                                                            className="object-cover"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {totalPlayers > 0 && (
                                        <span className="font-display text-[11px] tracking-[0.3em] text-white/65">
                                            <span className="font-black" style={{ color: GOLD }}>{totalPlayers.toLocaleString()}</span>
                                            <span>&nbsp;PLAYER{totalPlayers === 1 ? "" : "S"} VIBING</span>
                                        </span>
                                    )}
                                </div>
                                {/* DAILY RESET sits on the right of the marquee
                                    when there's no event. When an event is
                                    active the pill takes that slot and the
                                    countdown lives in the right-rail DAILY
                                    CHALLENGE box. */}
                                {!activePromo && (
                                    <div className="flex items-center gap-3 text-[11px] font-display">
                                        <span className="text-white/45 tracking-[0.3em]">DAILY RESET</span>
                                        <span className="tabular-nums" style={{ color: GOLD }}>{countdown}</span>
                                    </div>
                                )}
                                {/* Right-anchored active-event chip. Only rendered
                                    while NEXT_PUBLIC_PROMO_ACTIVE is on. Opens
                                    the EventDrawer. */}
                                {activePromo && (
                                    <button
                                        type="button"
                                        onClick={() => setEventDrawerOpen(true)}
                                        className="relative group inline-flex items-center gap-2 rounded-full px-3 py-[5px] overflow-hidden transition-all hover:brightness-125 cursor-pointer"
                                        style={{
                                            background: promoEnded
                                                ? "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))"
                                                : `linear-gradient(180deg, ${GOLD}1f, ${GOLD_DEEP}14)`,
                                            border: promoEnded
                                                ? "1px solid rgba(255,255,255,0.16)"
                                                : `1px solid ${GOLD}66`,
                                            boxShadow: promoEnded ? "none" : `0 0 12px ${GOLD}22`,
                                        }}
                                        aria-label={`Open ${activePromo.partnerName || activePromo.name} event drawer`}
                                    >
                                        {/* Sparkles ONLY while the event is still running.
                                            Once it ends, the pill becomes a quiet
                                            "FINAL RESULTS" entry point with no animation. */}
                                        {!promoEnded && [
                                            { top: "18%", left: "12%", size: 14, delay: "0s" },
                                            { top: "60%", left: "40%", size: 11, delay: "0.9s" },
                                            { top: "22%", left: "68%", size: 13, delay: "1.8s" },
                                            { top: "55%", left: "88%", size: 10, delay: "0.45s" },
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
                                                    filter: `drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px ${GOLD})`,
                                                }}
                                            >
                                                <path
                                                    d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
                                                    fill="#ffffff"
                                                />
                                            </svg>
                                        ))}
                                        <span
                                            className="relative font-display text-[10px] tracking-[0.3em]"
                                            style={{ color: promoEnded ? "rgba(255,255,255,0.6)" : GOLD }}
                                        >
                                            {promoEnded ? "FINAL RESULTS" : !promoStarted ? "COMING SOON" : "EVENT LIVE"}
                                        </span>
                                        <span
                                            className="relative h-3 w-px"
                                            style={{ background: promoEnded ? "rgba(255,255,255,0.18)" : `${GOLD}44` }}
                                        />
                                        <span className="relative w-4 h-4 shrink-0 rounded-full overflow-hidden">
                                            <Image
                                                src={activePromo.image}
                                                alt=""
                                                fill
                                                sizes="16px"
                                                className="object-cover"
                                                style={promoEnded ? { filter: "grayscale(40%) brightness(0.9)" } : undefined}
                                            />
                                        </span>
                                        <span className="relative font-display text-[10px] tracking-[0.25em] text-white/85 uppercase whitespace-nowrap">
                                            {/* Always show the event name — partnerName is
                                                still surfaced via aria-label + the drawer hero,
                                                but showing "Claynosaurz · Claynosaurz Chase!"
                                                on the chip is redundant. */}
                                            {activePromo.name}
                                        </span>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative text-white/55 transition-transform group-hover:translate-x-0.5">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Play stack — logo + cabinets + prize strip + nav.
                            flex-1 with justify-start anchors the cluster to the
                            top of the available area so the cabinets don't
                            float in the middle of the column. Gaps give the
                            logo clear breathing room above the cabinets. */}
                        <div className="relative z-10 flex-1 px-6 pb-6 pt-16 flex flex-col justify-start items-center gap-1">
                            {/* Outer wrapper hosts the hover-scale so it doesn't
                                fight the inline `vmArcadeBob` keyframe on the
                                Image. PIN DROP logo is cropped (1854x1623). */}
                            <div className="cursor-pointer transition-transform duration-300 hover:scale-105">
                                <Image
                                    src="/assets/logo-v3.png"
                                    alt="PIN DROP"
                                    width={1854}
                                    height={1623}
                                    priority
                                    className="w-[280px] h-auto"
                                    style={{
                                        filter: `drop-shadow(0 16px 30px ${GOLD}55)`,
                                        animation: "vmArcadeBob 3.2s ease-in-out infinite",
                                    }}
                                />
                            </div>

                        {/* Game-mode cabinets — Classic + Pin Frenzy
                            side-by-side. Both share the vertical cabinet
                            layout (circle stat -> mode label -> Pin Drop
                            wordmark -> tagline -> PLAY) so they read as
                            siblings. Classic stays gold, Frenzy is orange
                            for heat/speed. Daily Challenge lives in the
                            right rail. */}
                        <div className="w-full max-w-[780px] mx-auto flex flex-row items-stretch gap-3">
                            <button
                                type="button"
                                onClick={() => onStartGame("classic", username, avatarUrl)}
                                className="flex-1 min-w-0 block text-left outline-none cursor-pointer"
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
                                                width: 90,
                                                height: 90,
                                                background: `radial-gradient(circle at 35% 30%, #FFF4B0, ${GOLD} 55%, ${GOLD_DEEP})`,
                                                boxShadow: `inset 0 -5px 9px ${GOLD_DEEP}, 0 4px 10px rgba(0,0,0,0.6), 0 0 25px ${GOLD}55`,
                                                border: "3px solid #2A1A0A",
                                            }}
                                        >
                                            <span
                                                className="mt-[4px] font-display font-black leading-none"
                                                style={{
                                                    color: "#1A0633",
                                                    fontSize: 38,
                                                    textShadow: "0 2px 0 rgba(255,255,255,0.25)",
                                                }}
                                            >
                                                30
                                            </span>
                                            <span className="mt-[1px] text-[9px] font-bold tracking-wider" style={{ color: "#1A0633" }}>
                                                MOVES
                                            </span>
                                        </div>
                                        <h2
                                            className="font-display font-black uppercase leading-none text-[22px]"
                                            style={{ color: GOLD, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                                        >
                                            Classic
                                        </h2>
                                        <h3
                                            className="font-display font-black uppercase leading-none text-[32px] mt-1"
                                            style={{ color: GOLD }}
                                        >
                                            Pin Drop
                                        </h3>
                                        <p className="text-white/55 text-[12px] mt-2">
                                            Match pins and score as high as you can.
                                        </p>
                                        <div className="mt-4">
                                            <ChunkyButton
                                                color={GOLD}
                                                deep={GOLD_DEEP}
                                                style={{
                                                    padding: "11px 30px",
                                                    fontSize: 13,
                                                    fontWeight: 900,
                                                    letterSpacing: "0.18em",
                                                }}
                                            >
                                                PLAY
                                            </ChunkyButton>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => onStartGame("frenzy", username, avatarUrl)}
                                className="flex-1 min-w-0 block text-left outline-none cursor-pointer"
                            >
                                <div
                                    className="relative rounded-2xl p-[3px] h-full transition-all duration-200 ease-out hover:-translate-y-[3px] hover:brightness-[1.08] active:translate-y-[1px] active:brightness-[0.95]"
                                    style={{
                                        background: `linear-gradient(180deg, ${ORANGE} 0%, #C2410C 60%, ${ORANGE_DEEP} 100%)`,
                                        boxShadow: `0 6px 0 ${ORANGE_DEEP}, 0 12px 22px rgba(0,0,0,0.55), 0 0 40px ${ORANGE}15`,
                                    }}
                                >
                                    <div
                                        className="rounded-[14px] relative p-5 h-full flex flex-col items-center text-center overflow-hidden"
                                        style={{ background: "linear-gradient(180deg, #2A0A0A 0%, #120303 100%)" }}
                                    >
                                        <div
                                            className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
                                            style={{ background: `linear-gradient(180deg, ${ORANGE}16, transparent)` }}
                                        />
                                        <div
                                            className="relative mb-3 rounded-full flex flex-col items-center justify-center overflow-hidden"
                                            style={{
                                                width: 90,
                                                height: 90,
                                                background: `radial-gradient(circle at 35% 30%, #FFD8A6, ${ORANGE} 55%, ${ORANGE_DEEP})`,
                                                boxShadow: `inset 0 -5px 9px ${ORANGE_DEEP}, 0 4px 10px rgba(0,0,0,0.6), 0 0 25px ${ORANGE}55`,
                                                border: "3px solid #2A0A0A",
                                            }}
                                        >
                                            <span
                                                className="mt-[4px] font-display font-black leading-none"
                                                style={{
                                                    color: "#2A0A0A",
                                                    fontSize: 34,
                                                    textShadow: "0 2px 0 rgba(255,255,255,0.25)",
                                                }}
                                            >
                                                60
                                            </span>
                                            <span className="mt-[1px] text-[9px] font-bold tracking-wider" style={{ color: "#2A0A0A" }}>
                                                SECONDS
                                            </span>
                                        </div>
                                        <h2
                                            className="font-display font-black uppercase leading-none text-[22px]"
                                            style={{ color: ORANGE_LIGHT, textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                                        >
                                            Pin Drop
                                        </h2>
                                        <h3
                                            className="font-display font-black uppercase leading-none text-[32px] mt-1"
                                            style={{ color: ORANGE_LIGHT }}
                                        >
                                            Frenzy
                                        </h3>
                                        <p className="text-white/55 text-[12px] mt-2">
                                            Max chaos. Match pins as fast as you can.
                                        </p>
                                        <div className="mt-4">
                                            <ChunkyButton
                                                color={ORANGE}
                                                deep={ORANGE_DEEP}
                                                style={{
                                                    padding: "11px 30px",
                                                    fontSize: 13,
                                                    fontWeight: 900,
                                                    letterSpacing: "0.18em",
                                                }}
                                            >
                                                GO
                                            </ChunkyButton>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* Spacer to keep Prize Games strip below in flow */}
                        <div className="w-full flex flex-col items-center">

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
                                                    {empty ? "Out of Plays" : "Daily Plays"}
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
                                            { label: "Profile", onClick: openProfile, icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>) },
                                            { label: "Pins", onClick: () => onOpenPinBook?.(), icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>) },
                                            { label: "Quests", onClick: onOpenAchievements, icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>) },
                                            { label: "Leaders", onClick: () => setLeaderboardTab("classic"), icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>) },
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
                                <span>Sign Out of Pin Drop</span>
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
                        <div className="relative px-5 pt-6 pb-5 border-b border-white/5">
                            <button
                                type="button"
                                onClick={openProfile}
                                className="relative w-full text-left cursor-pointer transition-all hover:opacity-90"
                            >
                                <div className="relative flex flex-col items-center gap-3">
                                    {/* Avatar — sized between the original
                                        82 and the earlier 108 iteration for
                                        a balanced hero presence. */}
                                    <div
                                        className="relative"
                                        style={{
                                            width: 92,
                                            height: 92,
                                            animation: "vmAvatarBounce 3.6s ease-in-out infinite",
                                        }}
                                    >
                                        {avatarUrl && (
                                            <>
                                                <div
                                                    className="absolute rounded-full pointer-events-none"
                                                    style={{
                                                        inset: -20,
                                                        background: `radial-gradient(circle, ${GOLD}bf 0%, ${GOLD}59 40%, transparent 75%)`,
                                                        filter: "blur(6px)",
                                                        animation: "vmAvatarGlow 3.6s ease-in-out infinite",
                                                    }}
                                                />
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
                                            </>
                                        )}
                                        {avatarUrl ? (
                                            <div
                                                className="absolute rounded-full overflow-hidden flex items-center justify-center"
                                                style={{
                                                    inset: 4,
                                                    background: `linear-gradient(135deg, ${COSMIC}, ${PINK})`,
                                                    boxShadow: `inset 0 -6px 14px ${COSMIC_DEEP}, inset 0 3px 6px rgba(255,255,255,0.2)`,
                                                }}
                                            >
                                                {avatarUrl.startsWith("data:") ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={avatarUrl}
                                                        alt=""
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <Image
                                                        src={avatarUrl}
                                                        alt=""
                                                        fill
                                                        sizes="84px"
                                                        className="object-cover"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            // GVC blank-yellow citizen — circular
                                            // clipped to match the uploaded-avatar
                                            // treatment so the placeholder reads as
                                            // "user avatar, not customized yet".
                                            <Image
                                                src={DEFAULT_FEED_AVATAR}
                                                alt=""
                                                fill
                                                sizes="84px"
                                                className="object-cover"
                                            />
                                        )}
                                    </div>

                                    {/* Username — sized between original 19
                                        and the earlier 24 iteration. */}
                                    <div
                                        className="font-display font-black text-white leading-none text-center"
                                        style={{
                                            fontSize: 21,
                                            textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 12px ${GOLD}55`,
                                        }}
                                    >
                                        {username}
                                    </div>

                                    {/* Tier pill — simplified to just the
                                        tier label; rank metrics live in
                                        their own boxes below. Tap to
                                        open the tier-threshold modal. */}
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTierInfoOpen(true);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.stopPropagation();
                                                setTierInfoOpen(true);
                                            }
                                        }}
                                        className="rounded-full px-2.5 py-1 flex items-center cursor-pointer transition-all hover:brightness-125"
                                        style={{
                                            background: `linear-gradient(180deg, ${tier.color}33, ${tier.accent}44)`,
                                            border: `1px solid ${tier.color}55`,
                                        }}
                                    >
                                        <span
                                            className="font-display text-[9px] tracking-[0.18em] uppercase"
                                            style={{ color: tier.color }}
                                        >
                                            TIER: {tier.label}
                                        </span>
                                    </span>
                                </div>
                            </button>

                            {/* Rank row — 3 tiles. PIN ROUTES to pins
                                tab; CLASSIC RANK to classic all-time;
                                FRENZY RANK to the frenzy tab. Each is a
                                real <button> so the whole tile is tappable
                                including keyboard focus. */}
                            <div className="grid grid-cols-3 gap-1.5 w-full mt-3">
                                <button
                                    type="button"
                                    onClick={() => setLeaderboardTab("pins")}
                                    className="rounded-lg px-2 py-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-[1px] hover:brightness-[1.12]"
                                    style={{
                                        background: `linear-gradient(180deg, ${COSMIC}1A, ${COSMIC}08)`,
                                        border: `1px solid ${COSMIC}44`,
                                    }}
                                >
                                    <div
                                        className="font-display font-black text-[14px] tabular-nums leading-none"
                                        style={{ color: COSMIC }}
                                    >
                                        {pinRank !== null ? `#${pinRank}` : "—"}
                                    </div>
                                    <div className="font-display text-[8px] tracking-[0.15em] mt-1 text-center leading-tight" style={{ color: `${COSMIC}cc` }}>
                                        PIN<br />RANK
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLeaderboardTab("classic")}
                                    className="rounded-lg px-2 py-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-[1px] hover:brightness-[1.12]"
                                    style={{
                                        background: `linear-gradient(180deg, ${GOLD}1A, ${GOLD}08)`,
                                        border: `1px solid ${GOLD}44`,
                                    }}
                                >
                                    <div
                                        className="font-display font-black text-[14px] tabular-nums leading-none"
                                        style={{ color: GOLD }}
                                    >
                                        {scoreRank !== null ? `#${scoreRank}` : "—"}
                                    </div>
                                    <div className="font-display text-[8px] tracking-[0.15em] mt-1 text-center leading-tight" style={{ color: `${GOLD}cc` }}>
                                        CLASSIC RANK
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLeaderboardTab("frenzy")}
                                    className="rounded-lg px-2 py-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-[1px] hover:brightness-[1.12]"
                                    style={{
                                        background: `linear-gradient(180deg, ${ORANGE}1A, ${ORANGE}08)`,
                                        border: `1px solid ${ORANGE}44`,
                                    }}
                                >
                                    <div
                                        className="font-display font-black text-[14px] tabular-nums leading-none"
                                        style={{ color: ORANGE }}
                                    >
                                        {frenzyRank !== null ? `#${frenzyRank}` : "—"}
                                    </div>
                                    <div className="font-display text-[8px] tracking-[0.15em] mt-1 text-center leading-tight" style={{ color: `${ORANGE}cc` }}>
                                        FRENZY RANK
                                    </div>
                                </button>
                            </div>

                            {/* Stats row — 3 tiles: STREAK / BEST CLASSIC
                                / BEST FRENZY. Mirrors the rank row above
                                so each mode has both a current-rank and
                                a personal-best surface. */}
                            <div className="grid grid-cols-3 gap-1.5 w-full mt-1.5">
                                <div
                                    className="rounded-lg px-2 py-2 flex flex-col items-center justify-center"
                                    style={{
                                        background: `linear-gradient(180deg, ${ORANGE}1A, ${ORANGE}08)`,
                                        border: `1px solid ${ORANGE}44`,
                                    }}
                                >
                                    <div
                                        className="font-display font-black text-[14px] tabular-nums leading-none"
                                        style={{ color: ORANGE }}
                                    >
                                        {streak}
                                    </div>
                                    <div className="font-display text-[8px] tracking-[0.15em] mt-1 text-center leading-tight" style={{ color: `${ORANGE}cc` }}>
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
                                        className="font-display font-black text-[14px] tabular-nums leading-none"
                                        style={{ color: GOLD }}
                                    >
                                        {personalBest > 0
                                            ? personalBest >= 1000
                                                ? `${Math.round(personalBest / 1000)}K`
                                                : String(personalBest)
                                            : "—"}
                                    </div>
                                    <div className="font-display text-[8px] tracking-[0.15em] mt-1 text-center leading-tight" style={{ color: `${GOLD}cc` }}>
                                        BEST SCORE
                                    </div>
                                </div>
                                <div
                                    className="rounded-lg px-2 py-2 flex flex-col items-center justify-center"
                                    style={{
                                        background: `linear-gradient(180deg, ${ORANGE}1A, ${ORANGE}08)`,
                                        border: `1px solid ${ORANGE}44`,
                                    }}
                                >
                                    <div
                                        className="font-display font-black text-[14px] tabular-nums leading-none"
                                        style={{ color: ORANGE }}
                                    >
                                        {frenzyBest > 0
                                            ? frenzyBest >= 1000
                                                ? `${Math.round(frenzyBest / 1000)}K`
                                                : String(frenzyBest)
                                            : "—"}
                                    </div>
                                    <div className="font-display text-[8px] tracking-[0.15em] mt-1 text-center leading-tight" style={{ color: `${ORANGE}cc` }}>
                                        BEST SCORE
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DAILY CHALLENGE — right-rail box with your
                            best + "beat %", plus an ENTER CHALLENGE CTA
                            that flips to COME BACK TOMORROW once played.
                            RESETS IN sub-line surfaces the daily-reset
                            countdown when an event is active (it's the
                            only place the timer lives in that case). */}
                        <div
                            className="px-5 pt-4 pb-4 border-b border-white/5"
                            style={{ background: `linear-gradient(180deg, ${COSMIC}14 0%, transparent 100%)` }}
                        >
                            <div className="flex items-center gap-2 mb-0.5">
                                <div className="font-display text-[10px] tracking-[0.3em]" style={{ color: COSMIC }}>
                                    DAILY CHALLENGE
                                </div>
                                {/* 10× Pin Capsule prize indicator. Tap /
                                    hover reveals an explainer tooltip with
                                    the SPECIAL PRIZE copy. ml-auto pushes
                                    it to the right edge of the rail header
                                    so it reads as "here's what you're
                                    competing for" anchored to the box. */}
                                <div className="relative group ml-auto">
                                    <div
                                        className="flex items-center gap-1 rounded-full pl-1 pr-1.5 py-[2px] cursor-help transition-all hover:brightness-125"
                                        style={{
                                            background: `linear-gradient(180deg, ${GOLD}44, ${GOLD_DEEP}33)`,
                                            border: `1px solid ${GOLD}88`,
                                            boxShadow: `0 0 10px ${GOLD}33`,
                                        }}
                                        tabIndex={0}
                                    >
                                        {/* Pin Capsule glyph — matches the SVG icon used
                                            on the game guide CapsuleIcon so the prize
                                            indicator reads as "+10 capsules" instead of
                                            a generic GVC pin. */}
                                        <span className="inline-block relative align-middle" style={{ width: 14, height: 14 }}>
                                            <span
                                                className="absolute inset-0 rounded-full"
                                                style={{
                                                    background: `radial-gradient(circle at 35% 28%, ${GOLD_LIGHT}, ${GOLD} 60%, ${GOLD_DEEP})`,
                                                    boxShadow: `inset 0 -2px 3px rgba(0,0,0,0.5), 0 0 4px ${GOLD}`,
                                                }}
                                            />
                                            <span
                                                className="absolute left-0 right-0"
                                                style={{ top: "50%", height: 1.5, transform: "translateY(-50%)", background: GOLD_LIGHT, opacity: 0.9 }}
                                            />
                                        </span>
                                        <span
                                            className="font-display font-black text-[9px] tracking-[0.1em]"
                                            style={{ color: GOLD }}
                                        >
                                            10×
                                        </span>
                                    </div>
                                    {/* Hover explainer. Anchored to the
                                        badge's RIGHT edge so the tooltip
                                        extends LEFTWARD — the badge sits
                                        near the right side of the rail,
                                        so anchoring left-0 pushed the
                                        tooltip past the rail boundary. */}
                                    <div
                                        className="pointer-events-none absolute right-0 top-full mt-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-30"
                                        style={{
                                            width: 220,
                                            background: "rgba(12, 4, 24, 0.96)",
                                            border: `1px solid ${GOLD}66`,
                                            boxShadow: `0 6px 16px rgba(0,0,0,0.6), 0 0 14px ${GOLD}33`,
                                            borderRadius: 8,
                                            padding: "7px 10px",
                                        }}
                                    >
                                        <div
                                            className="font-display font-black text-[9px] tracking-[0.22em] uppercase"
                                            style={{ color: GOLD }}
                                        >
                                            Special Prize
                                        </div>
                                        <div className="text-[11px] text-white/75 mt-0.5 leading-snug">
                                            The #1 finisher each day wins 10 Pin Capsules!
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Reset countdown sub-line — only when an event is
                                active. On non-event days the timer lives in
                                the top marquee where the EVENT pill would
                                otherwise sit. */}
                            {activePromo && (
                                <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-display">
                                    <span className="text-white/50">Resets In</span>
                                    <span className="tabular-nums" style={{ color: GOLD }}>{countdown}</span>
                                </div>
                            )}

                            {/* Card wrapper is a <div> not a <button> —
                                the ChunkyButtons inside are the real
                                clickable elements, avoiding nested-button
                                HTML invalidity that was breaking the
                                VIEW LEADERS click handler. */}
                            <div
                                className="w-full rounded-2xl p-[2px] relative"
                                style={{
                                    background: isDailyChamp
                                        ? `linear-gradient(180deg, #FFF4B0 0%, ${GOLD} 40%, ${GOLD_DEEP} 100%)`
                                        : `linear-gradient(180deg, #D8A0FF 0%, ${COSMIC} 40%, ${COSMIC_DEEP} 100%)`,
                                    boxShadow: isDailyChamp
                                        ? `0 4px 0 ${GOLD_DEEP}, 0 8px 18px rgba(0,0,0,0.55), 0 0 32px ${GOLD}77`
                                        : `0 4px 0 #4A1A80, 0 8px 18px rgba(0,0,0,0.55), 0 0 28px ${COSMIC}22`,
                                    animation: isDailyChamp ? "vmDailyChampPulse 2.2s ease-in-out infinite" : undefined,
                                }}
                            >
                                {/* Champion pill — surfaces when the user
                                    is currently #1 on today's daily. Floats
                                    above the card with a gold crown so the
                                    achievement is unmissable. */}
                                {isDailyChamp && (
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 -top-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                                        style={{
                                            background: `linear-gradient(180deg, #FFF4B0 0%, ${GOLD} 55%, ${GOLD_DEEP} 100%)`,
                                            boxShadow: `0 2px 6px rgba(0,0,0,0.55), 0 0 14px ${GOLD}aa`,
                                            border: "1px solid #FFF4B0",
                                        }}
                                    >
                                        <Crown size={11} style={{ color: "#1A0E02" }} strokeWidth={2.5} />
                                        <span
                                            className="font-display font-black text-[9px] tracking-[0.22em] uppercase"
                                            style={{ color: "#1A0E02" }}
                                        >
                                            #1 Today
                                        </span>
                                    </div>
                                )}
                                <div
                                    className="rounded-[14px] relative p-4 flex flex-col overflow-hidden"
                                    style={{ background: "linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)" }}
                                >
                                    <div
                                        className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
                                        style={{
                                            background: `linear-gradient(180deg, ${isDailyChamp ? `${GOLD}22` : `${COSMIC}18`}, transparent)`,
                                        }}
                                    />

                                    {/* Stats row — rank, your score, top score.
                                        Three columns so the tiles stay narrow
                                        but still readable inside the 300px rail. */}
                                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                                        <div
                                            className="rounded-lg px-1.5 py-2 text-center"
                                            style={{
                                                background: "rgba(255,255,255,0.04)",
                                                border: `1px solid ${isDailyChamp ? GOLD : COSMIC}44`,
                                                boxShadow: isDailyChamp ? `inset 0 0 10px ${GOLD}33` : undefined,
                                            }}
                                        >
                                            <div
                                                className="font-display font-black text-[14px] tabular-nums leading-none"
                                                style={{ color: isDailyChamp ? GOLD : COSMIC }}
                                            >
                                                {dailyStats.yourRank !== null ? `#${dailyStats.yourRank}` : "—"}
                                            </div>
                                            <div
                                                className="font-display text-[8px] tracking-[0.12em] mt-1"
                                                style={{ color: isDailyChamp ? `${GOLD}cc` : `${COSMIC}cc` }}
                                            >
                                                RANK TODAY
                                            </div>
                                        </div>
                                        <div
                                            className="rounded-lg px-1.5 py-2 text-center"
                                            style={{
                                                background: "rgba(255,255,255,0.04)",
                                                border: `1px solid ${GOLD}33`,
                                            }}
                                        >
                                            <div
                                                className="font-display font-black text-[14px] tabular-nums leading-none"
                                                style={{ color: GOLD }}
                                            >
                                                {dailyStats.yourBest !== null
                                                    ? dailyStats.yourBest >= 1000
                                                        ? `${Math.round(dailyStats.yourBest / 1000)}K`
                                                        : String(dailyStats.yourBest)
                                                    : "—"}
                                            </div>
                                            <div className="font-display text-[8px] tracking-[0.12em] mt-1" style={{ color: `${GOLD}cc` }}>
                                                YOUR SCORE
                                            </div>
                                        </div>
                                        <div
                                            className="rounded-lg px-1.5 py-2 text-center"
                                            style={{
                                                background: "rgba(255,255,255,0.04)",
                                                border: `1px solid ${COSMIC}33`,
                                            }}
                                        >
                                            <div
                                                className="font-display font-black text-[14px] tabular-nums leading-none"
                                                style={{ color: COSMIC }}
                                            >
                                                {dailyStats.topScore !== null
                                                    ? dailyStats.topScore >= 1000
                                                        ? `${Math.round(dailyStats.topScore / 1000)}K`
                                                        : String(dailyStats.topScore)
                                                    : "—"}
                                            </div>
                                            <div className="font-display text-[8px] tracking-[0.12em] mt-1" style={{ color: `${COSMIC}cc` }}>
                                                TOP SCORE
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-white/55 text-[11px] leading-snug text-center mb-3">
                                        {playedDaily
                                            ? "You've already played today."
                                            : "Highest score wins bonus Capsules!"}
                                    </p>

                                    <div className="flex flex-col items-center gap-2">
                                        {!playedDaily && (
                                            <ChunkyButton
                                                onClick={() => onStartGame("daily", username, avatarUrl)}
                                                color={COSMIC}
                                                deep={COSMIC_DEEP}
                                                text="#fff"
                                                style={{
                                                    padding: "10px 22px",
                                                    fontSize: 11,
                                                    fontWeight: 900,
                                                    letterSpacing: "0.2em",
                                                }}
                                            >
                                                ENTER CHALLENGE
                                            </ChunkyButton>
                                        )}

                                        {/* VIEW LEADERS only surfaces after
                                            today's run is done — keeps the
                                            box to a single CTA so the pre-play
                                            action is unambiguous. */}
                                        {playedDaily && (
                                            <ChunkyButton
                                                onClick={() => setLeaderboardTab("daily")}
                                                color={COSMIC}
                                                deep={COSMIC_DEEP}
                                                text="#fff"
                                                style={{
                                                    padding: "10px 22px",
                                                    fontSize: 11,
                                                    fontWeight: 900,
                                                    letterSpacing: "0.2em",
                                                }}
                                            >
                                                VIEW LEADERS
                                            </ChunkyButton>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Runs — 2-tab toggle (GLOBAL / MINE) */}
                        <div
                            className="flex-1 relative flex flex-col items-stretch justify-start px-5 py-6"
                            style={{ background: `radial-gradient(circle at 50% 40%, ${GOLD}14, transparent 60%)` }}
                        >
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setFeedTab("global")}
                                    className="font-display text-[10px] tracking-[0.3em] transition-colors cursor-pointer hover:brightness-110"
                                    style={{
                                        color: feedTab === "global" ? GOLD : "rgba(255,255,255,0.35)",
                                    }}
                                >
                                    ALL GAMES
                                </button>
                                <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.15)" }} />
                                <button
                                    type="button"
                                    onClick={() => setFeedTab("mine")}
                                    className="font-display text-[10px] tracking-[0.3em] transition-colors cursor-pointer hover:brightness-110"
                                    style={{
                                        color: feedTab === "mine" ? GOLD : "rgba(255,255,255,0.35)",
                                    }}
                                >
                                    MY GAMES
                                </button>
                            </div>
                            {feedTab === "mine" ? (
                                taggedRuns.length === 0 ? (
                                    <div className="text-[11px] text-white/40 leading-relaxed">
                                        No runs yet. Play a game to see your history here.
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-2">
                                        {taggedRuns.map((run, i) => {
                                            const labelColor = i === 0 && run.tag === "NEW BEST"
                                                ? GOLD
                                                : run.mode === "daily"
                                                    ? COSMIC
                                                    : run.mode === "frenzy"
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
                                )
                            ) : (
                                globalRuns.length === 0 ? (
                                    <div className="text-[11px] text-white/40 leading-relaxed">
                                        Loading the latest games played...
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-2">
                                        {globalRuns.map((run, i) => (
                                            <Link
                                                key={`${run.username}-${run.timestamp}-${i}`}
                                                href={`/u/${encodeURIComponent(run.username)}`}
                                                className="rounded-lg px-3 py-2 flex items-center gap-2 transition-all hover:bg-white/[0.06] hover:translate-x-[2px]"
                                                style={{
                                                    background: "rgba(255,255,255,0.04)",
                                                    border: `1px solid ${GOLD}15`,
                                                }}
                                            >
                                                <FeedAvatar avatarUrl={run.avatarUrl} username={run.username} />
                                                <span
                                                    className="font-display text-[11px] font-black truncate text-white/90 flex-1 min-w-0"
                                                    title={run.username}
                                                >
                                                    {run.username}
                                                </span>
                                                <span className="font-display font-black tabular-nums text-[12px] text-white/85 shrink-0">
                                                    {run.score.toLocaleString()}
                                                </span>
                                                <ModeChip mode={run.mode} />
                                            </Link>
                                        ))}
                                    </div>
                                )
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
                    @keyframes vmDailyChampPulse {
                        0%, 100% { box-shadow: 0 4px 0 ${GOLD_DEEP}, 0 8px 18px rgba(0,0,0,0.55), 0 0 28px ${GOLD}77; }
                        50% { box-shadow: 0 4px 0 ${GOLD_DEEP}, 0 8px 18px rgba(0,0,0,0.55), 0 0 48px ${GOLD}cc; }
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
            {leaderboardTab && (
                <LeaderboardModal
                    onClose={() => setLeaderboardTab(null)}
                    currentUsername={username}
                    initialTab={leaderboardTab}
                />
            )}
            <TierInfoModal
                isOpen={isTierInfoOpen}
                onClose={() => setTierInfoOpen(false)}
                currentTierId={tier.id}
                pinsCollected={pinsCollected}
            />
            {eventDrawerOpen && activePromo && (
                <EventDrawer
                    onClose={() => setEventDrawerOpen(false)}
                    currentUsername={username}
                    currentAvatarUrl={avatarUrl}
                    promo={{
                        id: activePromo.id,
                        name: activePromo.name,
                        partnerName: activePromo.partnerName,
                        tabLabel: activePromo.tabLabel,
                        setTabLabel: activePromo.setTabLabel,
                        image: activePromo.image,
                        description: activePromo.description,
                        eventWindow: activePromo.eventWindow,
                        prizeNote: activePromo.prizeNote,
                        accentColor: activePromo.accentColor,
                        startsAt: activePromo.startsAt,
                        endsAt: activePromo.endsAt,
                        eventSetId: activePromo.eventSetId,
                    }}
                />
            )}
        </>
    );
}
