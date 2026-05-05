"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Flame, Trophy, Calendar, Pin, Star, HandHeart, Target, Sparkles,
    TrendingUp, ArrowRight, Lock, Globe,
} from "lucide-react";
import { ChunkyButton } from "@/components/arcade";
import {
    GOLD, GOLD_DEEP, GOLD_LIGHT,
    COSMIC, COSMIC_DEEP, COSMIC_LIGHT,
    ORANGE,
    INK_PANEL, INK_PANEL_LIGHT, INK_DARKEST,
} from "@/lib/arcade-tokens";
import { ALL_ACHIEVEMENTS } from "@/lib/achievements";
import {
    playMatchSound, playBombSound, playCapsuleAnticipateSound,
    playCapsuleCrackSound, playCapsuleRevealSound, playNewPinSound,
    playUIClick,
} from "@/lib/sounds";

/* ────────────────────────────────────────────────────────────────
   Palette.
   ──────────────────────────────────────────────────────────────── */
const TIER_META = {
    common:  { label: "Common",    color: "#E5E7EB", glow: "rgba(229,231,235,0.3)",  count: 19, img: "/badges/any_gvc_1759173799963.webp" },
    rare:    { label: "Rare",      color: "#4A9EFF", glow: "rgba(74,158,255,0.4)",   count: 51, img: "/badges/rainbow_boombox_1759173875165.webp" },
    special: { label: "Special",   color: ORANGE,    glow: "rgba(255,95,31,0.45)",   count: 9,  img: "/badges/vibestr_blue_tier.webp" },
    gold:    { label: "Legendary", color: GOLD,      glow: "rgba(255,224,72,0.45)",  count: 19, img: "/badges/gold_member_1759173793799.webp" },
    cosmic:  { label: "Cosmic",    color: COSMIC,    glow: "rgba(179,102,255,0.5)",  count: 3,  img: "/badges/cosmic_guardian1759173818340.webp" },
} as const;

const COLLECTOR_TIERS = [
    { id: "rookie",      label: "Plastic",     color: "#9CA3AF", pct: 0 },
    { id: "pro_plastic", label: "Grailscale",  color: "#E5E7EB", pct: 10 },
    { id: "big_vibes",   label: "Collectooor", color: "#FFB547", pct: 25 },
    { id: "all_gold",    label: "69K Gold",    color: GOLD,      pct: 50 },
    { id: "shadow_funk", label: "Shadow Funk", color: "#D946EF", pct: 75 },
    { id: "cosmic",      label: "Cosmic",      color: COSMIC,    pct: 90 },
    { id: "one_of_one",  label: "One-Of-One",  color: "#FFFFFF", pct: 100 },
];

const QUEST_SAMPLER = [
    "first_combo", "first_bomb", "score_25k", "combo_8",
    "all_cosmic", "found_cosmic_10", "streak_7", "pins_69",
];

const SECTIONS: Array<{ id: string; label: string }> = [
    { id: "how-to-play", label: "How to Play" },
    { id: "scoring", label: "Scoring Moves" },
    { id: "power-tiles", label: "Power Tiles" },
    { id: "shapes", label: "Shape Bonuses" },
    { id: "capsules", label: "Pin Capsules" },
    { id: "pins", label: "Pins and Rarity" },
    { id: "ladder", label: "Collector Ladder" },
    { id: "daily", label: "Daily Challenge" },
    { id: "quests", label: "Quests" },
    { id: "rerolls", label: "Rerolls" },
    { id: "leaderboards", label: "Leaderboards" },
    { id: "streak", label: "Streaks and Referrals" },
    { id: "rewards", label: "Rewards" },
    { id: "tips", label: "Tips and Tricks" },
];

/* Badges used in the interactive demos (same pool the FTUE uses). */
const B_CITIZEN = { id: "citizen", src: "/badges/any_gvc_1759173799963.webp" };
const B_DOGE    = { id: "doge",    src: "/badges/doge_1759173842640.webp" };
const B_ASTRO   = { id: "astro",   src: "/badges/astro_balls_1759173838889.webp" };
const B_CAPTAIN = { id: "captain", src: "/badges/captain_1759173895611.webp" };
const B_COSMIC  = { id: "cosmic",  src: "/badges/cosmic_guardian1759173818340.webp" };

/* ────────────────────────────────────────────────────────────────
   Root.
   ──────────────────────────────────────────────────────────────── */
export default function GameGuideClient() {
    const quests = QUEST_SAMPLER
        .map(id => ALL_ACHIEVEMENTS.find(a => a.id === id))
        .filter((a): a is NonNullable<typeof a> => !!a);

    return (
        <main
            className="relative min-h-screen overflow-x-hidden"
            style={{
                background: `radial-gradient(ellipse at top, ${INK_PANEL_LIGHT} 0%, ${INK_PANEL} 55%, ${INK_DARKEST} 100%)`,
            }}
        >
            <AmbientFx />

            <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 pt-10 pb-24">
                <TopBar />
                <Hero />
                <TableOfContents />

                <HowToPlay />
                <Scoring />
                <PowerTiles />
                <ShapeBonuses />
                <Capsules />
                <PinsSection />
                <CollectorLadder />
                <DailyChallenge />
                <Quests quests={quests} />
                <Rerolls />
                <Leaderboards />
                <StreakRefer />
                <Prizes />
                <Tips />

                <Footer />
            </div>
        </main>
    );
}

/* ────────────────────────────────────────────────────────────────
   Shaka icon + mini capsule icon.
   ──────────────────────────────────────────────────────────────── */
function Shaka({ size = 24 }: { size?: number }) {
    return (
        <Image
            src="/assets/gvc_shaka.png"
            alt=""
            width={size}
            height={size}
            unoptimized
            style={{ width: size, height: size }}
        />
    );
}

function CapsuleIcon({ size = 14, color = GOLD }: { size?: number; color?: string }) {
    return (
        <span className="inline-block relative align-middle" style={{ width: size, height: size }}>
            <span
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle at 35% 28%, ${GOLD_LIGHT}, ${color} 60%, ${GOLD_DEEP})`,
                    boxShadow: `inset 0 -2px 3px rgba(0,0,0,0.5), 0 0 4px ${color}`,
                }}
            />
            <span
                className="absolute left-0 right-0"
                style={{ top: "50%", height: 1.5, transform: "translateY(-50%)", background: GOLD_LIGHT, opacity: 0.9 }}
            />
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────
   Ambient background:
   - Starfield underlay (twinkle)
   - A handful of badges drifting slowly in the far margins so they
     never cross section copy. Placed at extreme left / right edges
     with low opacity so the page reads cleanly but still feels alive.
   ──────────────────────────────────────────────────────────────── */
function AmbientFx() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const stars = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 4,
        dur: 3 + Math.random() * 3,
    }));

    // Two columns of drifting badges, one on each extreme edge.
    const badgePool = [B_CITIZEN, B_DOGE, B_ASTRO, B_CAPTAIN, B_COSMIC];
    const drifters = [
        { src: badgePool[0].src, side: "left",  top: "8%",  size: 64, delay: 0    },
        { src: badgePool[1].src, side: "right", top: "24%", size: 56, delay: 4    },
        { src: badgePool[2].src, side: "left",  top: "44%", size: 72, delay: 8    },
        { src: badgePool[3].src, side: "right", top: "62%", size: 60, delay: 12   },
        { src: badgePool[4].src, side: "left",  top: "82%", size: 64, delay: 16   },
    ];

    return (
        <>
            {/* Starfield */}
            <div className="pointer-events-none fixed inset-0 z-0">
                {stars.map(s => (
                    <span
                        key={s.id}
                        className="absolute rounded-full bg-white"
                        style={{
                            left: `${s.x}%`, top: `${s.y}%`,
                            width: s.size, height: s.size, opacity: 0.32,
                            animation: `vmGuideTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                        }}
                    />
                ))}
            </div>

            <style>{`
                @keyframes vmGuideTwinkle {
                    0%, 100% { opacity: 0.22; transform: scale(1); }
                    50%      { opacity: 0.85; transform: scale(1.4); }
                }
                @keyframes vmGuideBob {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-6px); }
                }
                @keyframes vmGuideDrift {
                    0%   { transform: translateY(0) rotate(-2deg); }
                    100% { transform: translateY(28px) rotate(3deg); }
                }
                @keyframes vmHoloSpin { to { --holo-angle: 360deg; } }
                @property --holo-angle {
                    syntax: "<angle>";
                    inherits: false;
                    initial-value: 0deg;
                }
                @keyframes vmCapsuleBob {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50%      { transform: translateY(-4px) rotate(-2deg); }
                }
                @keyframes vmShapeFlash {
                    0%, 100% { filter: brightness(1); }
                    50%      { filter: brightness(1.4); }
                }
            `}</style>
        </>
    );
}

/* ────────────────────────────────────────────────────────────────
   Top bar + Hero + TOC.
   ──────────────────────────────────────────────────────────────── */
function TopBar() {
    // Absolute-positioned so the Hero (PLAYER GUIDE pill + logo) can pull up
    // and sit at the same vertical level as the OPEN GAME button on the right.
    // top-10 / right-5 sm:right-8 matches the parent container's pt-10 px-5
    // sm:px-8 padding, so the button visually nests inside the content edge.
    return (
        <div className="absolute top-10 right-5 sm:right-8 z-20">
            <Link href="/" className="no-underline">
                <ChunkyButton
                    color={GOLD}
                    deep={GOLD_DEEP}
                    text="#1A0E02"
                    style={{ padding: "9px 18px", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em" }}
                >
                    OPEN GAME
                </ChunkyButton>
            </Link>
        </div>
    );
}

function Hero() {
    return (
        <section className="text-center pt-1 pb-10">
            <div
                className="inline-flex items-center gap-2 font-display font-black text-[10px] tracking-[0.35em] uppercase px-4 py-1.5 rounded-full mb-5"
                style={{ color: GOLD, background: `${GOLD}12`, border: `1px solid ${GOLD}55` }}
            >
                <Shaka size={14} />
                Player Guide
            </div>
            <div
                className="mx-auto mb-4 cursor-default"
                style={{ animation: "vmGuideBob 3.2s ease-in-out infinite", width: 360, maxWidth: "80%" }}
            >
                <Image
                    src="/assets/logo-v3.png"
                    alt="Pin Drop"
                    width={1854}
                    height={1623}
                    priority
                    className="w-full h-auto"
                    style={{ filter: `drop-shadow(0 16px 30px ${GOLD}55)` }}
                />
            </div>
            <p className="font-mundial text-[17px] max-w-[640px] mx-auto mt-2" style={{ color: "rgba(255,255,255,0.82)" }}>
                A new match-3 puzzle game from Good Vibes Club! Match pins. Score big. Rip capsules. Complete your collection of 101. Players can climb the ladder from{" "}
                <span className="font-display font-black" style={{ color: "#9CA3AF" }}>PLASTIC</span>{" "}
                all the way up to{" "}
                <span
                    className="font-display font-black"
                    style={{
                        background: "linear-gradient(90deg,#ff6ad5,#c774e8,#94d0ff,#84fab0,#ffdde1,#ff6ad5)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    ONE-OF-ONE
                </span>!
            </p>
            <div className="flex justify-center gap-5 mt-10 flex-wrap">
                {(["common","rare","special","gold","cosmic"] as const).map(t => (
                    <div key={t} className="flex flex-col items-center gap-2">
                        <div
                            className="w-12 h-12 rounded-full relative"
                            style={{
                                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.6), ${TIER_META[t].color} 55%, rgba(0,0,0,0.55))`,
                                boxShadow: `0 0 22px ${TIER_META[t].glow}, inset 0 -4px 8px rgba(0,0,0,0.5)`,
                            }}
                        />
                        <span
                            className="font-display font-black text-[9px] tracking-[0.2em] uppercase"
                            style={{ color: TIER_META[t].color }}
                        >
                            {TIER_META[t].label}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

function SectionHeader({ tag, title, sub, id }: { tag: string; title: string; sub?: string; id: string }) {
    return (
        <div id={id} className="mb-8 pt-4">
            <div
                className="inline-block font-display font-black text-[10px] tracking-[0.3em] uppercase px-3 py-1 rounded-full mb-3"
                style={{ color: COSMIC, background: `${COSMIC}18`, border: `1px solid ${COSMIC}44` }}
            >
                {tag}
            </div>
            <h2
                className="font-display font-black uppercase leading-none"
                style={{
                    fontSize: "clamp(28px, 4.5vw, 44px)",
                    color: GOLD,
                    textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 18px ${GOLD}33`,
                }}
            >
                {title}
            </h2>
            {sub && (
                <p className="font-mundial mt-3 text-[15px] max-w-[720px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {sub}
                </p>
            )}
        </div>
    );
}

function Card({ children, accent = COSMIC, className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
    return (
        <div
            className={`rounded-2xl p-5 sm:p-6 ${className}`}
            style={{
                background: "linear-gradient(180deg, rgba(26,10,46,0.92), rgba(12,4,24,0.96))",
                border: `1px solid ${accent}33`,
                boxShadow: `0 4px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
        >
            {children}
        </div>
    );
}

function Callout({ tone, label, children }: { tone: "gold" | "cosmic"; label: string; children: React.ReactNode }) {
    const c = tone === "gold" ? GOLD : COSMIC;
    return (
        <div
            className="mt-5 rounded-xl px-5 py-4"
            style={{
                background: `linear-gradient(90deg, ${c}1a, rgba(12,4,24,0.92))`,
                borderLeft: `3px solid ${c}`,
                border: `1px solid ${c}33`,
            }}
        >
            <div className="font-display font-black uppercase text-[10px] tracking-[0.3em] mb-1" style={{ color: c }}>{label}</div>
            <div className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.95)" }}>{children}</div>
        </div>
    );
}

function TableOfContents() {
    return (
        <section className="mt-8 mb-16 max-w-[720px] mx-auto">
            {/* Header matches the standard SectionHeader rhythm: small COSMIC
                tag pill above, big GOLD title below. Centered for the TOC
                so it reads as a hero index above the rest of the guide. */}
            <div className="mb-6 text-center">
                <div
                    className="inline-block font-display font-black text-[10px] tracking-[0.3em] uppercase px-3 py-1 rounded-full mb-3"
                    style={{ color: COSMIC, background: `${COSMIC}18`, border: `1px solid ${COSMIC}44` }}
                >
                    Contents
                </div>
                <h2
                    className="font-display font-black uppercase leading-none"
                    style={{
                        fontSize: "clamp(28px, 4.5vw, 44px)",
                        color: GOLD,
                        textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 18px ${GOLD}33`,
                    }}
                >
                    What&apos;s In Here
                </h2>
            </div>
            <nav
                className="rounded-2xl p-2"
                style={{
                    background: "linear-gradient(180deg, rgba(26,10,46,0.92), rgba(12,4,24,0.96))",
                    border: `1px solid ${COSMIC}33`,
                    boxShadow: `0 4px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
            >
                <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 list-none p-0 m-0">
                    {SECTIONS.map((s, i) => (
                        <li key={s.id}>
                            <a
                                href={`#${s.id}`}
                                className="group flex items-center gap-3 no-underline rounded-xl px-3 py-2.5 transition-colors"
                                style={{
                                    color: "rgba(255,255,255,0.85)",
                                    background: "transparent",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${COSMIC}14`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            >
                                <span
                                    className="font-display font-black tabular-nums text-[12px] tracking-[0.05em] flex-shrink-0 w-7 text-center py-1 rounded"
                                    style={{
                                        color: COSMIC,
                                        background: `${COSMIC}14`,
                                        border: `1px solid ${COSMIC}33`,
                                    }}
                                >
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="font-mundial font-bold text-[14px] transition-colors group-hover:text-white">
                                    {s.label}
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 1: How to Play : now with an interactive match-3 demo
   ════════════════════════════════════════════════════════════════ */
function HowToPlay() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="how-to-play"
                tag="The basics"
                title="How to Play"
                sub="Players get 30 moves per game. Swap tiles to match 3, 4, or 5+ of the same pin in a row. Look for long streaks or moves that trigger a chain reaction to hit combos and score big points."
            />

            <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6 items-start">
                {/* The interactive demo : tabbed (Basic Match / Cascade) */}
                <div className="order-2 md:order-1">
                    <HowToPlayDemo />
                </div>

                {/* Copy */}
                <div className="order-1 md:order-2 space-y-4">
                    <MiniFact
                        icon={<ArrowRight size={18} style={{ color: COSMIC }} />}
                        title="Swap Adjacent Tiles"
                        body="Tap a tile, then tap a neighbor in any direction (up, down, left, or right). No diagonals. If your swap doesn't make a match, it reverts for free."
                    />
                    <MiniFact
                        icon={<TrendingUp size={18} style={{ color: COSMIC }} />}
                        title="Cascades Compound"
                        body="When tiles clear, new ones drop in. Any fresh matches from those new tiles trigger a cascade and add +75% to your multiplier. A smart swap can chain 3 to 4 cascades together."
                    />
                    <MiniFact
                        icon={<Target size={18} style={{ color: COSMIC }} />}
                        title="30 Moves, Spend Wisely"
                        body="Players get 30 moves per game with no time pressure. Speed doesn't pay. The best swap does. Big matches spawn power tiles, and special shapes can multiply your score."
                    />
                </div>
            </div>

            <Callout tone="cosmic" label="Idle hint">
                Stay still for 8 seconds and the game flashes a valid swap once per run. Safe move, not optimal. Just enough to keep you unstuck.
            </Callout>

            <Callout tone="gold" label="Good to know">
                Badges from the GVC ecosystem are always referred to as <strong style={{ color: GOLD }}>Pins</strong> in the game environment.
            </Callout>
        </section>
    );
}

function MiniFact({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <div
            className="rounded-xl p-4"
            style={{
                background: "linear-gradient(180deg, rgba(26,10,46,0.85), rgba(12,4,24,0.92))",
                border: `1px solid ${COSMIC}33`,
            }}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${COSMIC}22`, border: `1px solid ${COSMIC}66` }}>
                    {icon}
                </div>
                <h3 className="font-display font-black uppercase text-[13px] tracking-[0.12em]" style={{ color: "#fff" }}>{title}</h3>
            </div>
            <p className="font-mundial text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>{body}</p>
        </div>
    );
}

/* Tabbed demo shell : Basic Match | Cascade. After the basic match completes
   once, the Cascade tab pulses to nudge the player to try the chain. */
function HowToPlayDemo() {
    const [tab, setTab] = useState<"basic" | "cascade">("basic");
    const [basicCompleted, setBasicCompleted] = useState(false);
    const [nudge, setNudge] = useState(false);

    const handleBasicCycle = () => {
        if (!basicCompleted) {
            setBasicCompleted(true);
            setNudge(true);
        }
    };

    const switchTab = (t: "basic" | "cascade") => {
        setTab(t);
        if (t === "cascade") setNudge(false);
    };

    const accent = tab === "basic" ? GOLD : COSMIC;

    const tabs = [
        { id: "basic" as const, label: "Basic Match", color: GOLD },
        { id: "cascade" as const, label: "Cascade", color: COSMIC },
    ];

    return (
        <Card accent={accent}>
            <div className="flex items-end gap-1 mb-5 border-b border-white/10">
                {tabs.map(t => {
                    const active = tab === t.id;
                    const showNudge = t.id === "cascade" && nudge && !active;
                    return (
                        <button
                            key={t.id}
                            onClick={() => switchTab(t.id)}
                            className="relative px-4 py-2.5 font-display font-black uppercase text-[11.5px] tracking-[0.2em] transition-colors -mb-px"
                            style={{
                                color: active ? t.color : "rgba(255,255,255,0.45)",
                                borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent",
                            }}
                        >
                            {t.label}
                            {showNudge && (
                                <motion.span
                                    className="absolute top-1.5 -right-0.5 w-2 h-2 rounded-full"
                                    style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }}
                                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                                />
                            )}
                        </button>
                    );
                })}
                <AnimatePresence>
                    {nudge && tab === "basic" && (
                        <motion.div
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="ml-auto self-center pb-2 font-mundial font-bold text-[10px] tracking-[0.2em] uppercase"
                            style={{ color: COSMIC }}
                        >
                            Try a cascade →
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
                {tab === "basic" ? (
                    <motion.div key="basic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                        <MatchDemo onCycleComplete={handleBasicCycle} />
                    </motion.div>
                ) : (
                    <motion.div key="cascade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                        <CascadeDemo />
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}

/* Interactive match-3 demo : 4x4 board, swap glowing tiles to form a row of 3. */
const MATCH_INITIAL = [
    [{ id: 1,  badge: B_CITIZEN }, { id: 2,  badge: B_CITIZEN }, { id: 3,  badge: B_DOGE    }, { id: 10, badge: B_ASTRO   }],
    [{ id: 4,  badge: B_ASTRO   }, { id: 5,  badge: B_CAPTAIN }, { id: 6,  badge: B_CITIZEN }, { id: 11, badge: B_DOGE    }],
    [{ id: 7,  badge: B_DOGE    }, { id: 8,  badge: B_ASTRO   }, { id: 9,  badge: B_CAPTAIN }, { id: 12, badge: B_ASTRO   }],
    [{ id: 13, badge: B_CAPTAIN }, { id: 14, badge: B_CITIZEN }, { id: 15, badge: B_ASTRO   }, { id: 16, badge: B_DOGE    }],
];
const SWAP_A = { row: 0, col: 2 };
const SWAP_B = { row: 1, col: 2 };
const DEMO_TILE = 64;
const DEMO_GAP = 6;
const DEMO_COLS = 4;

function MatchDemo({ onCycleComplete }: { onCycleComplete?: () => void }) {
    type Phase = "idle" | "swapping" | "matched";
    const [grid, setGrid] = useState(MATCH_INITIAL);
    const [phase, setPhase] = useState<Phase>("idle");
    const [score, setScore] = useState(0);
    const [scorePop, setScorePop] = useState<number | null>(null);
    const [cycleKey, setCycleKey] = useState(0);

    const matchedSet = new Set(phase === "matched" ? ["0,0", "0,1", "0,2"] : []);
    const isHint = (r: number, c: number) =>
        phase === "idle" && ((r === SWAP_A.row && c === SWAP_A.col) || (r === SWAP_B.row && c === SWAP_B.col));

    const handleTap = (r: number, c: number) => {
        if (phase !== "idle") return;
        const ok = (r === SWAP_A.row && c === SWAP_A.col) || (r === SWAP_B.row && c === SWAP_B.col);
        if (!ok) return;
        setPhase("swapping");
        const next = grid.map(row => [...row]);
        const a = next[SWAP_A.row][SWAP_A.col];
        next[SWAP_A.row][SWAP_A.col] = next[SWAP_B.row][SWAP_B.col];
        next[SWAP_B.row][SWAP_B.col] = a;
        setGrid(next);
        setTimeout(() => {
            setPhase("matched");
            setScore(100);
            setScorePop(100);
            playMatchSound(100, 1, 3);
            setTimeout(() => setScorePop(null), 1400);
        }, 320);
    };

    useEffect(() => {
        if (phase !== "matched") return;
        const t = setTimeout(() => {
            onCycleComplete?.();
            setGrid(MATCH_INITIAL);
            setScore(0);
            setPhase("idle");
            setCycleKey(k => k + 1);
        }, 1500);
        return () => clearTimeout(t);
    }, [phase, onCycleComplete]);

    return (
        <div className="relative">
            <div className="flex justify-end items-baseline mb-3">
                <motion.div
                    key={score}
                    className="font-display font-black text-[28px] leading-none"
                    style={{ color: GOLD, textShadow: `0 0 18px ${GOLD}55` }}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1.2, 1] }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {score.toLocaleString()}
                </motion.div>
            </div>

            <div
                className="relative grid mx-auto"
                style={{
                    gridTemplateColumns: `repeat(${DEMO_COLS}, ${DEMO_TILE}px)`,
                    gap: `${DEMO_GAP}px`,
                    width: DEMO_TILE * DEMO_COLS + DEMO_GAP * (DEMO_COLS - 1),
                }}
            >
                {grid.map((row, r) =>
                    row.map((tile, c) => {
                        const hinted = isHint(r, c);
                        const matched = matchedSet.has(`${r},${c}`);
                        return (
                            <motion.button
                                key={`${cycleKey}-${tile.id}`}
                                onClick={() => handleTap(r, c)}
                                layout
                                layoutId={`match-${cycleKey}-${tile.id}`}
                                className="relative rounded-[12px] overflow-hidden"
                                style={{
                                    width: DEMO_TILE,
                                    height: DEMO_TILE,
                                    background: "rgba(255,255,255,0.04)",
                                    border: hinted || matched ? `2px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.08)",
                                    boxShadow: hinted
                                        ? `0 0 18px ${GOLD}88`
                                        : matched
                                            ? `0 0 26px ${GOLD}cc`
                                            : "none",
                                    cursor: hinted ? "pointer" : "default",
                                }}
                                animate={
                                    matched
                                        ? { scale: [1, 1.15, 0], opacity: [1, 1, 0] }
                                        : hinted
                                            ? { scale: [1, 1.06, 1], opacity: 1 }
                                            : { scale: 1, opacity: 1 }
                                }
                                transition={
                                    matched
                                        ? { duration: 0.7, times: [0, 0.35, 1] }
                                        : hinted
                                            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                                            : { type: "spring", stiffness: 400, damping: 28 }
                                }
                                whileTap={hinted ? { scale: 0.94 } : undefined}
                            >
                                <Image
                                    src={tile.badge.src}
                                    alt=""
                                    fill
                                    sizes={`${DEMO_TILE}px`}
                                    className="object-cover pointer-events-none"
                                    unoptimized
                                />
                            </motion.button>
                        );
                    })
                )}

                {/* Score popup pinned to the board so it floats over the
                    cleared row instead of pushing layout below. */}
                <ScorePopup pop={scorePop != null ? { amount: scorePop } : null} />
            </div>

            <div className="relative mt-4 text-[10px] font-mundial font-bold uppercase tracking-[0.2em] h-[14px] text-center">
                <AnimatePresence mode="wait">
                    {phase === "idle" && (
                        <motion.div key="idle" className="absolute inset-0" style={{ color: `${GOLD}cc` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Tap a glowing tile to swap
                        </motion.div>
                    )}
                    {phase === "matched" && (
                        <motion.div key="match" className="absolute inset-0" style={{ color: GOLD }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                            Match!
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* Shared score popup : a solid backdrop pill that appears briefly above the
   board. Pop in fast, hold, fade out. No translation, so the eye doesn't
   chase a moving target. */
function ScorePopup({ pop }: { pop: { amount: number; mult?: string } | null }) {
    return (
        <AnimatePresence>
            {pop != null && (
                <motion.div
                    key={`${pop.amount}-${pop.mult ?? ""}`}
                    className="absolute pointer-events-none z-10"
                    style={{ left: "50%", top: -18 }}
                    initial={{ opacity: 0, scale: 0.7, x: "-50%", y: 8 }}
                    animate={{ opacity: 1, scale: 1, x: "-50%", y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: "-50%", y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                >
                    <div
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full whitespace-nowrap"
                        style={{
                            background: `linear-gradient(180deg, rgba(26,10,46,0.95), rgba(12,4,24,0.95))`,
                            border: `1.5px solid ${pop.mult ? COSMIC : GOLD}`,
                            boxShadow: `0 6px 22px rgba(0,0,0,0.55), 0 0 18px ${pop.mult ? COSMIC : GOLD}55`,
                        }}
                    >
                        <span
                            className="font-display font-black text-[20px] leading-none whitespace-nowrap"
                            style={{ color: pop.mult ? COSMIC : GOLD }}
                        >
                            +{pop.amount}
                        </span>
                        {pop.mult && (
                            <span
                                className="font-display font-black text-[9px] tracking-[0.22em] uppercase px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                style={{
                                    color: COSMIC,
                                    background: `${COSMIC}1f`,
                                    border: `1px solid ${COSMIC}66`,
                                }}
                            >
                                {pop.mult} cascade
                            </span>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* Cascade demo: same 4x4 grid layout, but the swap clears a row, tiles fall,
   and the falling tiles form a second match (cascade) for a +1.75x bonus. */
const CASCADE_INITIAL = [
    [{ id: 101, badge: B_DOGE    }, { id: 102, badge: B_ASTRO   }, { id: 103, badge: B_CAPTAIN }, { id: 104, badge: B_ASTRO   }],
    [{ id: 105, badge: B_DOGE    }, { id: 106, badge: B_CAPTAIN }, { id: 107, badge: B_CITIZEN }, { id: 108, badge: B_ASTRO   }],
    [{ id: 109, badge: B_CITIZEN }, { id: 110, badge: B_CITIZEN }, { id: 111, badge: B_CAPTAIN }, { id: 112, badge: B_DOGE    }],
    [{ id: 113, badge: B_DOGE    }, { id: 114, badge: B_ASTRO   }, { id: 115, badge: B_ASTRO   }, { id: 116, badge: B_CITIZEN }],
];

/* After the row-2 match clears (id109, id110, id107 cleared) and tiles fall.
   Surviving ids keep their identity so layoutId animates them down smoothly.
   New tiles (201/202/203) spawn at the top. */
const CASCADE_AFTER_FALL = [
    [{ id: 201, badge: B_ASTRO   }, { id: 202, badge: B_DOGE    }, { id: 203, badge: B_ASTRO   }, { id: 104, badge: B_ASTRO   }],
    [{ id: 101, badge: B_DOGE    }, { id: 102, badge: B_ASTRO   }, { id: 103, badge: B_CAPTAIN }, { id: 108, badge: B_ASTRO   }],
    [{ id: 105, badge: B_DOGE    }, { id: 106, badge: B_CAPTAIN }, { id: 111, badge: B_CAPTAIN }, { id: 112, badge: B_DOGE    }],
    [{ id: 113, badge: B_DOGE    }, { id: 114, badge: B_ASTRO   }, { id: 115, badge: B_ASTRO   }, { id: 116, badge: B_CITIZEN }],
];

const CASCADE_SWAP_A = { row: 1, col: 2 };
const CASCADE_SWAP_B = { row: 2, col: 2 };

/* Tiles cleared during the first match (the row-2 trio after the swap). */
const CASCADE_MATCHED_IDS = new Set([109, 110, 107]);
/* Tiles cleared during the cascade match (column 0 trio after the fall). */
const CASCADE_CASCADED_IDS = new Set([101, 105, 113]);

function CascadeDemo() {
    type Phase = "idle" | "swapping" | "matched" | "falling" | "cascade-matched" | "done";
    const [grid, setGrid] = useState(CASCADE_INITIAL);
    const [phase, setPhase] = useState<Phase>("idle");
    const [score, setScore] = useState(0);
    const [scorePop, setScorePop] = useState<{ amount: number; mult?: string } | null>(null);
    const [cycleKey, setCycleKey] = useState(0);

    const isHint = (r: number, c: number) =>
        phase === "idle" && ((r === CASCADE_SWAP_A.row && c === CASCADE_SWAP_A.col) || (r === CASCADE_SWAP_B.row && c === CASCADE_SWAP_B.col));

    const handleTap = (r: number, c: number) => {
        if (phase !== "idle") return;
        const ok = (r === CASCADE_SWAP_A.row && c === CASCADE_SWAP_A.col) || (r === CASCADE_SWAP_B.row && c === CASCADE_SWAP_B.col);
        if (!ok) return;

        // Phase 1 (t=0): swap. The two swapped tiles animate to each other's slots.
        setPhase("swapping");
        const swapped = grid.map(row => [...row]);
        const a = swapped[CASCADE_SWAP_A.row][CASCADE_SWAP_A.col];
        swapped[CASCADE_SWAP_A.row][CASCADE_SWAP_A.col] = swapped[CASCADE_SWAP_B.row][CASCADE_SWAP_B.col];
        swapped[CASCADE_SWAP_B.row][CASCADE_SWAP_B.col] = a;
        setGrid(swapped);

        // Phase 2 (t=320ms): matched. Highlight the row 2 match + score popup.
        setTimeout(() => {
            setPhase("matched");
            setScore(100);
            setScorePop({ amount: 100 });
            playMatchSound(100, 1, 3);
            setTimeout(() => setScorePop(null), 950);
        }, 320);

        // Phase 3 (t=1200ms): falling. Snap grid to post-fall state. Each tile
        // keeps its id, so the absolute layout interpolates to the new (row,col).
        setTimeout(() => {
            setPhase("falling");
            setGrid(CASCADE_AFTER_FALL);
        }, 1200);

        // Phase 4 (t=2100ms): cascade match in col 0. +175 with the 1.75x label.
        setTimeout(() => {
            setPhase("cascade-matched");
            setScore(s => s + 175);
            setScorePop({ amount: 175, mult: "1.75x" });
            playMatchSound(175, 2, 3);
            setTimeout(() => setScorePop(null), 1100);
        }, 2100);

        // Phase 5 (t=3400ms): done. Show final score for a beat.
        setTimeout(() => {
            setPhase("done");
        }, 3400);
    };

    useEffect(() => {
        if (phase !== "done") return;
        const t = setTimeout(() => {
            setGrid(CASCADE_INITIAL);
            setScore(0);
            setPhase("idle");
            setCycleKey(k => k + 1);
        }, 2200);
        return () => clearTimeout(t);
    }, [phase]);

    // Flatten the grid to a per-id list, then sort by id so DOM order is
    // stable across renders. Sorting matters: when the array order changes
    // between renders, React reorders DOM nodes — which can cause framer-motion
    // to drop the in-flight transition for that node. Stable order = smooth
    // interpolation from previous (x,y) to new (x,y) for every surviving tile.
    const flat = grid
        .flatMap((row, r) => row.map((tile, c) => ({ id: tile.id, badge: tile.badge, row: r, col: c })))
        .sort((a, b) => a.id - b.id);

    const STEP = DEMO_TILE + DEMO_GAP;
    const boardSize = DEMO_TILE * DEMO_COLS + DEMO_GAP * (DEMO_COLS - 1);

    return (
        <div className="relative">
            <div className="flex justify-end items-baseline mb-3">
                <motion.div
                    key={score}
                    className="font-display font-black text-[28px] leading-none"
                    style={{ color: GOLD, textShadow: `0 0 18px ${GOLD}55` }}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1.2, 1] }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {score.toLocaleString()}
                </motion.div>
            </div>

            <div
                className="relative mx-auto"
                style={{ width: boardSize, height: boardSize }}
            >
                {flat.map(t => {
                    const hinted = isHint(t.row, t.col);
                    const matched = phase === "matched" && CASCADE_MATCHED_IDS.has(t.id);
                    const cascaded = phase === "cascade-matched" && CASCADE_CASCADED_IDS.has(t.id);
                    const highlighted = hinted || matched || cascaded;
                    const targetX = t.col * STEP;
                    const targetY = t.row * STEP;
                    // New tiles spawned by the cascade fall in from above.
                    const isSpawn = t.id >= 200;
                    return (
                        <motion.button
                            key={`${cycleKey}-${t.id}`}
                            onClick={() => handleTap(t.row, t.col)}
                            className="absolute rounded-[12px] overflow-hidden"
                            style={{
                                left: 0,
                                top: 0,
                                width: DEMO_TILE,
                                height: DEMO_TILE,
                                background: "rgba(255,255,255,0.04)",
                                border: highlighted
                                    ? `2px solid ${cascaded ? COSMIC : GOLD}`
                                    : "1.5px solid rgba(255,255,255,0.08)",
                                boxShadow: hinted
                                    ? `0 0 18px ${GOLD}88`
                                    : matched
                                        ? `0 0 26px ${GOLD}cc`
                                        : cascaded
                                            ? `0 0 26px ${COSMIC}cc`
                                            : "none",
                                cursor: hinted ? "pointer" : "default",
                            }}
                            initial={{
                                x: targetX,
                                y: isSpawn ? -DEMO_TILE - 8 : targetY,
                                scale: 1,
                                opacity: 1,
                            }}
                            animate={
                                matched || cascaded
                                    ? { x: targetX, y: targetY, scale: [1, 1.15, 0], opacity: [1, 1, 0] }
                                    : hinted
                                        ? { x: targetX, y: targetY, scale: [1, 1.06, 1], opacity: 1 }
                                        : { x: targetX, y: targetY, scale: 1, opacity: 1 }
                            }
                            transition={
                                matched || cascaded
                                    ? {
                                        scale: { duration: 0.55, times: [0, 0.35, 1], ease: "easeOut" },
                                        opacity: { duration: 0.55, times: [0, 0.35, 1], ease: "easeOut" },
                                        x: { duration: 0.25, ease: "easeOut" },
                                        y: { duration: 0.25, ease: "easeOut" },
                                    }
                                    : hinted
                                        ? {
                                            scale: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
                                            x: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                                            y: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                                        }
                                        : {
                                            // Tween with gravity-feel ease on y so the fall
                                            // accelerates from rest like real gravity.
                                            x: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
                                            y: { duration: 0.5, ease: [0.55, 0.085, 0.68, 0.53] },
                                            scale: { duration: 0.25 },
                                            opacity: { duration: 0.25 },
                                        }
                            }
                            whileTap={hinted ? { scale: 0.94 } : undefined}
                        >
                            <Image
                                src={t.badge.src}
                                alt=""
                                fill
                                sizes={`${DEMO_TILE}px`}
                                className="object-cover pointer-events-none"
                                unoptimized
                            />
                        </motion.button>
                    );
                })}

                {/* Score popup pinned to the board so it floats above the action
                    without taking up vertical space below the grid. */}
                <ScorePopup pop={scorePop} />
            </div>

            <div className="relative mt-4 text-[10px] font-mundial font-bold uppercase tracking-[0.2em] h-[14px] text-center">
                <AnimatePresence mode="wait">
                    {phase === "idle" && (
                        <motion.div key="idle" className="absolute inset-0" style={{ color: `${GOLD}cc` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Tap a glowing tile to swap
                        </motion.div>
                    )}
                    {phase === "matched" && (
                        <motion.div key="match" className="absolute inset-0" style={{ color: GOLD }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Match!
                        </motion.div>
                    )}
                    {phase === "falling" && (
                        <motion.div key="fall" className="absolute inset-0" style={{ color: `${COSMIC}aa` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Tiles fall...
                        </motion.div>
                    )}
                    {phase === "cascade-matched" && (
                        <motion.div key="cascade" className="absolute inset-0" style={{ color: COSMIC }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Cascade!
                        </motion.div>
                    )}
                    {phase === "done" && (
                        <motion.div key="done" className="absolute inset-0" style={{ color: GOLD }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Total: {score}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 2: Scoring
   ════════════════════════════════════════════════════════════════ */
function Scoring() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="scoring"
                tag="Score math"
                title="Scoring Your Moves"
                sub="Every match you make stacks three multipliers: match length, pin tier, and cascade depth. They all compound together. A 4-match of Legendary pins on the second cascade can score 8 to 10x what the same tiles would score cleared cold. Setups always beat grab-and-go."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStat value="3+" label="Match length" color={GOLD}
                    sub="3-match: 100 base. 4-match: 300 + Bomb. 5-match: 600 + Laser Party. 6+: Cosmic Blast." />
                <ScoreStat value="+75%" label="Cascade" color={COSMIC}
                    sub="Every cascade adds +75% to your multiplier. 1st: 1.75x. 2nd: 2.5x. 3rd: 3.25x. And climbing." />
                <ScoreStat value="+3" label="Momentum" color={ORANGE}
                    sub="End a turn with 3 cascades and your next move starts at combo +1. 4 cascades → +2. 5+ → +3. Momentum carries between turns." />
            </div>

            <Callout tone="cosmic" label="Combos in plain English">
                It's not about how fast you tap. It's about how many matches one swap cascades into. End a turn with 3+ cascades and some of that momentum carries to your next swap as a combo head start.
            </Callout>
        </section>
    );
}

function ScoreStat({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
    return (
        <Card accent={color}>
            <div className="text-center">
                <div className="font-display font-black leading-none" style={{ fontSize: 46, color, textShadow: `0 0 22px ${color}55, 0 3px 0 rgba(0,0,0,0.55)` }}>
                    {value}
                </div>
                <h3 className="font-display font-black uppercase text-[13px] tracking-[0.15em] mt-3" style={{ color: "#fff" }}>{label}</h3>
                <p className="font-mundial text-[13px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>{sub}</p>
            </div>
        </Card>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 3: Power tiles
   ════════════════════════════════════════════════════════════════ */
function PowerTiles() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="power-tiles"
                tag="Power tiles"
                title="Bombs, Laser Parties and Blasts"
                sub="Match 4+ pins and you'll spawn a power tile. It sits on the board until you double tap it, or swap it with a neighbor tile, and detonate. Chain multiple power tiles in one turn for massive score swings!"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PowerTileDemo
                    kind="bomb"
                    name="Bomb"
                    trigger="Match 4"
                    effect="Clears a 3x3 area around itself."
                    detail="Position matters. A bomb in a dense column wipes far more than one near an edge."
                    accent="#FF3333"
                    glow="rgba(255,51,51,0.45)"
                />
                <PowerTileDemo
                    kind="laser"
                    name="Laser Party"
                    trigger="Match 5"
                    effect="Clears the full row AND column."
                    detail="An easy way to set up long cascades. A single Laser can wipe out 15+ tiles in one move."
                    accent="#4A9EFF"
                    glow="rgba(74,158,255,0.5)"
                />
                <PowerTileDemo
                    kind="cosmic"
                    name="Cosmic Blast"
                    trigger="Match 6+"
                    effect="Clears EVERY tile of that pin type."
                    detail="The rarest power tile in the game. Most runs see zero of these. When one lands, expect a 10,000+ point score swing!"
                    accent={COSMIC}
                    glow="rgba(179,102,255,0.55)"
                    premium
                />
            </div>
            <Callout tone="cosmic" label="Cosmic tier pins are unique">
                Matching Cosmic-tier pins automatically upgrades the power tile they spawn by one tier. A Cosmic 4-match skips the Bomb and creates a Laser Party. A Cosmic 5-match skips the Laser and creates a Cosmic Blast.
            </Callout>
        </section>
    );
}

function PowerTileDemo({
    kind, name, trigger, effect, detail, accent, glow, premium = false,
}: {
    kind: "bomb" | "laser" | "cosmic";
    name: string;
    trigger: string;
    effect: string;
    detail: string;
    accent: string;
    glow: string;
    premium?: boolean;
}) {
    return (
        <div
            className="rounded-2xl p-6 text-center relative overflow-hidden"
            style={{
                background: "linear-gradient(180deg, rgba(26,10,46,0.94), rgba(12,4,24,0.97))",
                border: `2px solid ${accent}88`,
                boxShadow: premium
                    ? `0 0 36px ${glow}, inset 0 0 18px ${accent}18`
                    : `0 0 22px ${glow}`,
            }}
        >
            <div
                className="absolute inset-x-0 top-0 h-[30%] pointer-events-none"
                style={{ background: `linear-gradient(180deg, ${accent}18, transparent)` }}
            />
            <div className="relative flex justify-center mb-4">
                <div
                    className="relative rounded-xl overflow-hidden"
                    style={{
                        width: 96, height: 96,
                        background: "rgba(20,10,40,0.9)",
                        border: "1.5px solid rgba(255,255,255,0.1)",
                    }}
                >
                    <Image src={B_CITIZEN.src} alt="" fill sizes="96px" unoptimized className="object-cover opacity-85" />
                    {kind === "bomb" && <DemoBombOverlay />}
                    {kind === "laser" && <DemoLaserOverlay />}
                    {kind === "cosmic" && <DemoCosmicOverlay />}
                </div>
            </div>
            <h3 className="font-display font-black uppercase text-[20px]" style={{ color: "#fff", letterSpacing: "0.06em" }}>{name}</h3>
            <p className="font-mundial text-[12px] italic mt-1.5" style={{ color: accent }}>{trigger}</p>
            <p className="font-mundial text-[14px] mt-3" style={{ color: "rgba(255,255,255,0.92)" }}>{effect}</p>
            <p className="font-mundial text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>{detail}</p>
        </div>
    );
}

function DemoBombOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 20px rgba(255,0,0,0.8)" }}>
            <div className="bomb-border absolute inset-0 border-[3px] border-[#FF3333] rounded-xl" />
            <div className="absolute inset-0 flex items-center justify-center opacity-80">
                <div className="w-[80%] h-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div className="absolute h-[80%] w-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div className="bomb-core absolute w-4 h-4 rounded-full bg-[#FF3333] shadow-[0_0_15px_#FF3333]" />
            </div>
        </div>
    );
}

function DemoLaserOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 24px rgba(74,158,255,0.9)" }}>
            <div className="laser-border absolute inset-0 border-[3px] border-[#4A9EFF] rounded-xl" />
            <div className="laser-scan-h absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4AE0FF] to-transparent shadow-[0_0_12px_#4AE0FF,0_0_24px_#4A9EFF] opacity-90" />
            <div className="laser-scan-v absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#4AE0FF] to-transparent shadow-[0_0_12px_#4AE0FF,0_0_24px_#4A9EFF] opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="laser-core w-3 h-3 rounded-full bg-[#4AE0FF] shadow-[0_0_16px_#4AE0FF,0_0_32px_#4A9EFF]" />
            </div>
        </div>
    );
}

function DemoCosmicOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden">
            <div className="cosmic-outer-glow absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 0 10px rgba(179,102,255,0.7), inset 0 0 20px rgba(255,107,157,0.35)" }} />
            <div className="cosmic-ring absolute -inset-6" style={{ background: "conic-gradient(from 0deg at 50% 50%, rgba(179,102,255,0) 0%, rgba(255,107,157,0.85) 25%, rgba(179,102,255,0) 50%, rgba(74,158,255,0.85) 75%, rgba(179,102,255,0) 100%)" }} />
            <div className="cosmic-glow absolute inset-[10%] rounded-full border-2 border-[#B366FF]/60" style={{ background: "radial-gradient(circle, rgba(179,102,255,0.35) 0%, rgba(179,102,255,0.08) 60%, transparent 100%)" }} />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="cosmic-core-dot w-2.5 h-2.5 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(179,102,255,0.5) 60%, transparent 100%)", boxShadow: "0 0 6px rgba(179,102,255,0.9), 0 0 14px rgba(179,102,255,0.5)" }} />
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 4: Shape bonuses
   ════════════════════════════════════════════════════════════════ */
function ShapeBonuses() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="shapes"
                tag="Shape bonuses"
                title="The Shape Multipliers"
                sub="When two separate matches share a tile, the game detects the shape they form and stacks a big multiplier on top of everything else. There are three shapes worth chasing: L, T, and Cross."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <ShapeCard
                    name="L-Shape"
                    mult="x1.5"
                    sub="Two lines meet at a shared corner tile"
                    color="#4A9EFF"
                    glow="rgba(74,158,255,0.45)"
                    sequence={[[0,0], [1,0], [2,0], [2,1], [2,2]]}
                />
                <ShapeCard
                    name="T-Shape"
                    mult="x2.5"
                    sub="A line meets the middle of another"
                    color={ORANGE}
                    glow="rgba(255,95,31,0.5)"
                    sequence={[[1,1], [1,2], [1,3], [2,2], [3,2]]}
                    highlight
                />
                <ShapeCard
                    name="Cross"
                    mult="x4"
                    sub="Two lines cross at the middle of both"
                    color={COSMIC}
                    glow="rgba(179,102,255,0.55)"
                    sequence={[[1,2], [2,1], [2,2], [2,3], [3,2]]}
                    highlight
                />
            </div>
            <Callout tone="gold" label="Bonus capsule">
                Land a <strong style={{ color: GOLD }}>T</strong> or <strong style={{ color: GOLD }}>Cross</strong> shape in a match and you'll earn a <strong style={{ color: GOLD }}>+1 bonus Pin Capsule</strong>. One bonus per game, stacked on top of whatever your score earns. Worth hunting on runs you're already crushing!
            </Callout>
        </section>
    );
}

function ShapeCard({
    name, mult, sub, color, glow, sequence, highlight = false,
}: {
    name: string;
    mult: string;
    sub: string;
    color: string;
    glow: string;
    sequence: Array<[number, number]>;
    highlight?: boolean;
}) {
    const [revealCount, setRevealCount] = useState(sequence.length);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const play = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setRevealCount(0);
        sequence.forEach((_, i) => {
            timeoutRef.current = setTimeout(() => setRevealCount(i + 1), 200 * (i + 1));
        });
    };

    useEffect(() => {
        const t = setTimeout(play, 600);
        return () => {
            clearTimeout(t);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const litCells = new Set(sequence.slice(0, revealCount).map(([r, c]) => `${r},${c}`));

    return (
        <button
            type="button"
            onClick={play}
            className="rounded-2xl p-5 text-center relative overflow-hidden cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none"
            style={{
                background: `linear-gradient(180deg, ${color}14, rgba(12,4,24,0.97))`,
                border: `2px solid ${color}`,
                boxShadow: highlight ? `0 0 36px ${glow}, inset 0 0 22px ${color}22` : `0 0 24px ${glow}`,
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top, ${glow}, transparent 65%)` }}
            />
            <div className="relative z-10 flex justify-center mb-3">
                <div className="grid grid-cols-5 gap-[5px]" style={{ width: 200, height: 200 }}>
                    {Array.from({ length: 25 }).map((_, i) => {
                        const r = Math.floor(i / 5);
                        const c = i % 5;
                        const on = litCells.has(`${r},${c}`);
                        return (
                            <div
                                key={i}
                                className="rounded-[4px] transition-all duration-200"
                                style={{
                                    background: on
                                        ? `radial-gradient(circle at 35% 28%, ${color}ee, ${color})`
                                        : "rgba(255,255,255,0.04)",
                                    border: on ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
                                    boxShadow: on
                                        ? `0 0 12px ${glow}, inset 0 -3px 5px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.4)`
                                        : "none",
                                    transform: on ? "scale(1)" : "scale(0.94)",
                                }}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="relative z-10 font-display font-black uppercase text-[20px]" style={{ color: "#fff", letterSpacing: "0.08em" }}>
                {name}
            </div>
            <div
                className="relative z-10 font-display font-black leading-none my-1.5"
                style={{ fontSize: 44, color, textShadow: `0 0 18px ${glow}, 0 3px 0 rgba(0,0,0,0.55)`, letterSpacing: "-0.02em" }}
            >
                {mult}
            </div>
            <div className="relative z-10 font-mundial text-[12.5px]" style={{ color: "rgba(255,255,255,0.85)" }}>{sub}</div>
            <div className="relative z-10 font-display font-black text-[9px] tracking-[0.25em] mt-3 uppercase" style={{ color: `${color}dd` }}>
                Tap to replay
            </div>
        </button>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 5: Pin Capsules : identical to FTUE CapsulePanel behavior
   ════════════════════════════════════════════════════════════════ */
function Capsules() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="capsules"
                tag="Rewards"
                title="Earning Pin Capsules"
                sub="Hit certain score thresholds in a game and you'll earn Pin Capsules. Each capsule cracks open to reveal a random pin from the 101-pin catalog. The higher your score, the more capsules you'll earn. Tap the capsule below to try one!"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStep amount="15,000+" caps="+1 Capsule" color={GOLD} intensity={0.35} />
                <ScoreStep amount="30,000+" caps="+2 Capsules" color={ORANGE} intensity={0.45} />
                <ScoreStep amount="50,000+" caps="+3 Capsules" color={COSMIC} intensity={0.6} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 items-start">
                <Card accent={GOLD} className="text-center flex flex-col items-center justify-center">
                    <CapsuleDemo />
                </Card>

                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar size={20} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[18px]" style={{ color: "#fff" }}>Daily Challenge bonus</h3>
                    </div>
                    <p className="font-mundial text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                        Same score thresholds, but you'll earn double the capsules! Players only get one shot per day, so the extra payout rewards taking it seriously.
                    </p>
                    <ul className="font-mundial text-[15px] mt-3 pl-5 m-0" style={{ color: "rgba(255,255,255,0.95)" }}>
                        <li className="mb-1">15K+ → <strong style={{ color: GOLD }}>+2 capsules</strong></li>
                        <li className="mb-1">30K+ → <strong style={{ color: GOLD }}>+4 capsules</strong></li>
                        <li>50K+ → <strong style={{ color: GOLD }}>+6 capsules</strong></li>
                    </ul>
                    <p className="font-mundial text-[14px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Stack the Daily Champion prize on top and Daily becomes your biggest capsule day of the week. By far.
                    </p>
                </Card>
            </div>
        </section>
    );
}

/* ── Interactive capsule demo: mirrors FtuePrimer exactly. ── */
type CapsulePhase = "idle" | "anticipating" | "cracking" | "revealed";
const ANTICIPATE_MS = 1800;
const CRACK_MS = 400;

function CapsuleDemo() {
    const [phase, setPhase] = useState<CapsulePhase>("idle");
    const [cycleKey, setCycleKey] = useState(0);

    const handleTap = () => {
        if (phase !== "idle") return;
        setPhase("anticipating");
        playCapsuleAnticipateSound();
        setTimeout(() => {
            setPhase("cracking");
            playCapsuleCrackSound("cosmic");
            setTimeout(() => {
                setPhase("revealed");
                playCapsuleRevealSound("cosmic");
                playNewPinSound();
            }, CRACK_MS);
        }, ANTICIPATE_MS);
    };

    useEffect(() => {
        if (phase !== "revealed") return;
        const t = setTimeout(() => {
            setPhase("idle");
            setCycleKey(k => k + 1);
        }, 2800);
        return () => clearTimeout(t);
    }, [phase]);

    return (
        <div className="relative mx-auto flex flex-col items-center justify-center w-full gap-3">
            {/* Header cluster — Pins Collected label + count read as one unit
                so justify-around spreads three groups (header / capsule /
                footer label) evenly down the card. w-full so its internal
                items-center anchors against the demo's full width instead
                of its own content width. */}
            <div className="w-full flex flex-col items-center">
                <div className="text-[9px] font-mundial font-black tracking-[0.22em] uppercase text-white/50">
                    Pins Collected
                </div>
                <motion.div
                    key={phase === "revealed" ? "r" : "i"}
                    className="font-display font-black text-[22px] mt-1"
                    style={{ color: GOLD }}
                    initial={{ scale: 1 }}
                    animate={{ scale: phase === "revealed" ? [1.3, 1] : 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {phase === "revealed" ? "+1" : "0"}
                </motion.div>
            </div>

            <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
                {/* Gold halo */}
                {phase !== "revealed" && (
                    <motion.div
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            width: 180, height: 180,
                            background: "radial-gradient(circle, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0.08) 50%, transparent 75%)",
                            filter: "blur(6px)",
                        }}
                        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                )}

                {/* Orbit sparkles */}
                {phase !== "revealed" && (
                    <div className="absolute inset-0 pointer-events-none">
                        {[0,1,2,3,4,5].map(i => (
                            <motion.div
                                key={`${cycleKey}-sparkle-${i}`}
                                className="absolute w-1.5 h-1.5 rounded-full"
                                style={{
                                    background: GOLD,
                                    boxShadow: `0 0 6px ${GOLD}`,
                                    top: `${18 + (i * 17) % 64}%`,
                                    left: `${12 + (i * 23) % 76}%`,
                                }}
                                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 0.5] }}
                                transition={{ duration: 1.6, delay: i * 0.25, repeat: Infinity, ease: "easeInOut" }}
                            />
                        ))}
                    </div>
                )}

                {/* Capsule */}
                <AnimatePresence>
                    {phase !== "revealed" && (
                        <motion.button
                            key={`${cycleKey}-capsule`}
                            onClick={handleTap}
                            className="relative cursor-pointer bg-transparent border-none p-0"
                            style={{ width: 120, height: 120 }}
                            initial={{ scale: 0.92, opacity: 1 }}
                            animate={
                                phase === "idle"
                                    ? { scale: [0.98, 1.04, 0.98], rotate: [-2, 2, -2], opacity: 1 }
                                    : phase === "anticipating"
                                        ? {
                                            rotate: [
                                                0, -1.5, 1.5, -2, 2.5, -3, 3.5,
                                                0, 0,
                                                -5, 5, -7, 7, -9, 10,
                                                0, 0,
                                                -13, 15, -17, 18, -20, 22, 0,
                                            ],
                                            x: [
                                                0, 0, 0, 0, 0, 0, 0,
                                                0, 0,
                                                -0.5, 0.6, -0.8, 1, -1.2, 1.5,
                                                0, 0,
                                                -1.8, 2, -2.2, 2.4, -2.6, 3, 0,
                                            ],
                                            scale: [
                                                1, 1, 1, 1.01, 1.01, 1.02, 1.02,
                                                1, 1,
                                                1.03, 1.02, 1.04, 1.03, 1.05, 1.06,
                                                1, 1,
                                                1.07, 1.08, 1.09, 1.1, 1.12, 1.15, 1.18,
                                            ],
                                            opacity: 1,
                                        }
                                        : { scale: [1.18, 1.25, 0], rotate: [0, 0, 0], opacity: [1, 1, 0] }
                            }
                            transition={
                                phase === "idle"
                                    ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                                    : phase === "anticipating"
                                        ? { duration: ANTICIPATE_MS / 1000, ease: "easeIn" }
                                        : { duration: CRACK_MS / 1000, times: [0, 0.3, 1] }
                            }
                            whileTap={{ scale: 0.94 }}
                            exit={{ opacity: 0 }}
                        >
                            <SphericalCapsule
                                anticipating={phase === "anticipating"}
                                cracking={phase === "cracking"}
                            />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Revealed pin */}
                <AnimatePresence>
                    {phase === "revealed" && (
                        <motion.div
                            key={`${cycleKey}-pin`}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="relative rounded-full overflow-hidden"
                                style={{
                                    width: 96, height: 96,
                                    boxShadow: `0 0 30px ${COSMIC}cc, 0 0 60px ${COSMIC}66`,
                                    border: `3px solid ${COSMIC}`,
                                }}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                            >
                                <Image src={B_COSMIC.src} alt="" fill sizes="96px" className="object-cover pointer-events-none" unoptimized />
                            </motion.div>
                            <motion.div
                                className="font-display font-black text-white text-[15px] leading-tight text-center"
                                style={{ textShadow: `0 0 16px ${COSMIC}77` }}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 25 }}
                            >
                                Cosmic Guardian
                            </motion.div>
                            <motion.div
                                className="px-3 py-0.5 rounded-full text-[9px] font-mundial font-bold uppercase tracking-[0.2em]"
                                style={{
                                    background: `${COSMIC}2e`,
                                    color: COSMIC,
                                    border: `1px solid ${COSMIC}66`,
                                    boxShadow: `0 0 10px ${COSMIC}33`,
                                }}
                                initial={{ y: 10, opacity: 0, scale: 0.8 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.28 }}
                            >
                                Cosmic
                            </motion.div>
                            <motion.div
                                className="px-3 py-1 rounded-full text-[9px] font-display font-black uppercase tracking-[0.15em]"
                                style={{
                                    background: "linear-gradient(135deg, rgba(46,255,46,0.22), rgba(46,255,46,0.08))",
                                    color: "#2EFF2E",
                                    border: "1px solid rgba(46,255,46,0.4)",
                                    boxShadow: "0 0 14px rgba(46,255,46,0.25)",
                                }}
                                initial={{ y: 12, opacity: 0, scale: 0.7 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.42 }}
                            >
                                New Pin Collected!
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer label — same 220px reference width as the capsule
                wrapper above. The motion.span uses framer-motion's x prop
                (translateX(-50%)) anchored from left:50% for foolproof
                horizontal centering that doesn't rely on text-align or
                flex inheritance. */}
            <div className="relative h-[14px]" style={{ width: 220 }}>
                <AnimatePresence mode="wait">
                    {(phase === "idle" || phase === "anticipating" || phase === "cracking") && (
                        <motion.span
                            key={phase}
                            className="absolute top-0 left-1/2 text-[10px] font-mundial font-bold uppercase tracking-[0.15em] whitespace-nowrap"
                            style={{ color: phase === "idle" ? `${GOLD}cc` : GOLD, x: "-50%" }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            {phase === "idle" ? "Tap to Open" : phase === "anticipating" ? "Shaking..." : "Cracking..."}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* SphericalCapsule : direct port of FtuePrimer's capsule shape. Gold
   tier treatment with dark chrome hemispheres, gold seam, subsurface
   light leak that ramps on anticipation, specular highlight, and a
   shaka decal that fades out on crack. */
function SphericalCapsule({ anticipating, cracking }: { anticipating: boolean; cracking: boolean }) {
    const SIZE = 120;
    const HALF = SIZE / 2;
    const GLOW = "#FFE048";

    return (
        <div className="absolute inset-0" style={{ filter: `drop-shadow(0 0 22px ${GOLD}55) drop-shadow(0 6px 18px rgba(0,0,0,0.6))` }}>
            {/* Top hemisphere */}
            <div
                className="absolute"
                style={{
                    top: 0, left: 0, width: SIZE, height: HALF,
                    borderRadius: `${HALF}px ${HALF}px 0 0 / ${HALF}px ${HALF}px 0 0`,
                    background: "radial-gradient(ellipse at 35% 30%, #3a3222 0%, #1a1508 55%, #0a0806 100%)",
                    boxShadow: "inset 0 2px 6px rgba(255,255,255,0.18), inset 0 -3px 10px rgba(0,0,0,0.45)",
                }}
            />
            {/* Bottom hemisphere */}
            <div
                className="absolute"
                style={{
                    bottom: 0, left: 0, width: SIZE, height: HALF,
                    borderRadius: `0 0 ${HALF}px ${HALF}px / 0 0 ${HALF}px ${HALF}px`,
                    background: "radial-gradient(ellipse at 35% 70%, #2a2010 0%, #14100a 55%, #0a0806 100%)",
                    boxShadow: "inset 0 -3px 10px rgba(0,0,0,0.7), inset 4px 4px 12px rgba(255,216,72,0.1)",
                }}
            />
            {/* Gold rim ring */}
            <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ border: `1.5px solid ${GOLD}`, boxShadow: `0 0 12px ${GOLD}70, inset 0 0 8px ${GOLD}33` }}
            />
            {/* Subsurface light leak */}
            <motion.div
                className="absolute pointer-events-none"
                style={{
                    top: HALF - 6, left: "8%", width: "84%", height: 12,
                    background: `radial-gradient(ellipse at center, ${GLOW} 0%, transparent 70%)`,
                    filter: "blur(3px)",
                    mixBlendMode: "screen",
                }}
                animate={
                    anticipating ? { opacity: [0.2, 0.2, 0.35, 0.55, 0.8, 1] }
                    : cracking ? { opacity: [1, 1, 1] }
                    : { opacity: 0.25 }
                }
                transition={
                    anticipating ? { duration: 1.8, ease: "easeIn" }
                    : cracking ? { duration: 0.4 }
                    : {}
                }
            />
            {/* Seam */}
            <motion.div
                className="absolute left-0 right-0"
                style={{
                    top: HALF - 1, height: 2,
                    background: `linear-gradient(90deg, transparent 0%, ${GLOW} 20%, ${GOLD} 50%, ${GLOW} 80%, transparent 100%)`,
                    boxShadow: `0 0 10px ${GOLD}`,
                }}
                animate={
                    anticipating ? { scaleX: [1, 1, 1.02, 1.04, 1.06, 1.1], opacity: [0.9, 1, 1, 1, 1, 1] }
                    : cracking ? { scaleX: [1.1, 1.15, 1.2], opacity: 1 }
                    : { scaleX: 1, opacity: 1 }
                }
                transition={
                    anticipating ? { duration: 1.8, ease: "easeIn" }
                    : cracking ? { duration: 0.4 }
                    : {}
                }
            />
            {/* Specular highlight */}
            <div
                className="absolute"
                style={{
                    top: 14, left: 20, width: 30, height: 22,
                    background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.6) 0%, rgba(255,240,160,0.25) 45%, transparent 75%)",
                    filter: "blur(2px)",
                    borderRadius: "50%",
                }}
            />
            {/* Environment reflection arc */}
            <div className="absolute pointer-events-none rounded-full overflow-hidden" style={{ inset: 0, mixBlendMode: "screen", opacity: 0.5 }}>
                <div
                    className="absolute inset-0"
                    style={{ background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 15%, transparent 32%, rgba(255,255,255,0.12) 48%, transparent 65%)" }}
                />
            </div>
            {/* Shaka decal */}
            <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full overflow-hidden"
                style={{ width: SIZE * 0.55, height: SIZE * 0.55, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}
                animate={
                    anticipating ? { opacity: [0.85, 0.8, 0.7, 0.55, 0.4, 0.25] }
                    : cracking ? { opacity: 0 }
                    : { opacity: 0.85 }
                }
                transition={
                    anticipating ? { duration: 1.8, ease: "easeIn" }
                    : cracking ? { duration: 0.2 }
                    : { duration: 0.15 }
                }
            >
                <Image src={B_CITIZEN.src} alt="" fill sizes="66px" className="object-contain" unoptimized />
            </motion.div>
        </div>
    );
}

function ScoreStep({ amount, caps, sub, color, intensity }: { amount: string; caps: string; sub?: string; color: string; intensity: number }) {
    return (
        <div
            className="rounded-2xl text-center py-7 px-5 relative overflow-hidden"
            style={{
                background: "linear-gradient(180deg, rgba(12,4,24,0.88), rgba(5,2,16,0.96))",
                border: `1.5px solid ${color}88`,
                boxShadow: `0 0 ${Math.round(22 + intensity * 24)}px ${color}44, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
        >
            <div
                className="absolute inset-x-0 top-0 h-[40%] pointer-events-none"
                style={{ background: `linear-gradient(180deg, ${color}22, transparent)` }}
            />
            <div className="relative font-display font-black leading-none" style={{ fontSize: 32, color, textShadow: `0 3px 0 rgba(0,0,0,0.6), 0 0 20px ${color}66` }}>
                {amount}
            </div>
            <div className="relative font-display font-black uppercase text-[14px] mt-2" style={{ color: "#fff", letterSpacing: "0.1em" }}>{caps}</div>
            {sub && (
                <div className="relative font-mundial text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>{sub}</div>
            )}
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 6: Pins and rarity
   ════════════════════════════════════════════════════════════════ */
function PinsSection() {
    const tiers: Array<keyof typeof TIER_META> = ["common","rare","special","gold","cosmic"];
    return (
        <section className="mb-20">
            <SectionHeader
                id="pins"
                tag="The collection"
                title="Pins and Rarity"
                sub="There are 101 unique pins to collect across 5 rarity tiers. Each capsule rolls the tier first (Common is the most likely, Cosmic the rarest), then picks a specific pin from inside that tier. Rarer pins also drop less often within their own tier."
            />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {tiers.map(t => {
                    const m = TIER_META[t];
                    return (
                        <div
                            key={t}
                            className="rounded-2xl p-4 text-center"
                            style={{
                                background: `linear-gradient(180deg, ${m.color}18, rgba(12,4,24,0.95))`,
                                border: `1.5px solid ${m.color}77`,
                                boxShadow: `0 0 20px ${m.glow}`,
                            }}
                        >
                            <div
                                className="relative mx-auto rounded-full overflow-hidden"
                                style={{
                                    width: 72, height: 72,
                                    border: `2px solid ${m.color}`,
                                    boxShadow: `0 0 14px ${m.glow}, 0 4px 10px rgba(0,0,0,0.5)`,
                                    background: INK_DARKEST,
                                }}
                            >
                                <Image src={m.img} alt={m.label} fill sizes="72px" className="object-cover" unoptimized />
                            </div>
                            <div className="font-display font-black uppercase text-[11px] tracking-[0.2em] mt-3" style={{ color: m.color }}>
                                {m.label}
                            </div>
                            <div className="font-mundial text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                                {m.count} pins
                            </div>
                        </div>
                    );
                })}
            </div>
            <Callout tone="cosmic" label="Duplicates are useful">
                Pulled a pin you already own? The duplicate stacks up in your collection. Dupes fuel the <em style={{ color: COSMIC, fontStyle: "normal", fontWeight: 800 }}>Reroll</em> flow and tick up your lifetime tier-find quests. No capsule is ever wasted.
            </Callout>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 7: Collector ladder
   ════════════════════════════════════════════════════════════════ */
function CollectorLadder() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="ladder"
                tag="Status"
                title="The Collector Ladder"
                sub="Your collector tier is a prestige title ranked by your unique-pin %, not by how much you've spent. Cosmic gets a purple glow treatment. One-Of-One is the holographic rainbow status reserved for clearing the entire catalog."
            />
            <div className="flex flex-col gap-2">
                {COLLECTOR_TIERS.map(t => {
                    const isHolo = t.id === "one_of_one";
                    const isCosmic = t.id === "cosmic";
                    return (
                        <div
                            key={t.id}
                            className={`rounded-xl px-4 py-3 flex items-center gap-3 relative overflow-hidden ${isHolo ? "vm-holo-row" : ""}`}
                            style={
                                isHolo
                                    ? { border: `1px solid rgba(255,255,255,0.55)` }
                                    : isCosmic
                                        ? {
                                            background: `radial-gradient(circle at 20% 30%, ${COSMIC}33, transparent 55%), radial-gradient(circle at 80% 75%, ${COSMIC_LIGHT}22, transparent 55%), linear-gradient(180deg, rgba(45,14,84,0.9), rgba(21,6,48,0.97))`,
                                            border: `1px solid ${COSMIC}88`,
                                            boxShadow: `0 0 22px ${COSMIC}55`,
                                        }
                                        : {
                                            background: "rgba(12,4,24,0.85)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                        }
                            }
                        >
                            {isHolo && <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(8,4,20,0.55), rgba(8,4,20,0.72))" }} />}
                            <div className="w-3 h-3 rounded-full relative z-10" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
                            <span
                                className="relative z-10 font-display font-black uppercase tracking-[0.12em] text-[15px] flex-1"
                                style={
                                    isHolo
                                        ? { color: "#fff", textShadow: "0 0 10px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.9)" }
                                        : { color: t.color }
                                }
                            >
                                {t.label}
                            </span>
                            <span
                                className="relative z-10 font-mundial text-[12px] tabular-nums"
                                style={{ color: isHolo ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.8)" }}
                            >
                                {t.pct === 100 ? "100% . 101 pins" : `${t.pct}%+ . ${Math.ceil((t.pct/100) * 101)}+ pins`}
                            </span>
                        </div>
                    );
                })}
            </div>
            <style>{`
                .vm-holo-row {
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
                        conic-gradient(
                            from var(--holo-angle, 0deg),
                            #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff,
                            #84fab0, #fad0c4, #ffdde1, #ff6ad5
                        );
                    background-blend-mode: overlay, normal;
                    animation: vmHoloSpin 6s linear infinite;
                    box-shadow: 0 0 24px rgba(255,255,255,0.25);
                }
            `}</style>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 8: Daily Challenge
   ════════════════════════════════════════════════════════════════ */
function DailyChallenge() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="daily"
                tag="Once a day"
                title="The Daily Challenge"
                sub="One identical board for every player around the world. One attempt per day, no retries. A pure skill comparison. Daily pays out more capsules per threshold than Classic, and the day's #1 finisher wins the champion bonus."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <Globe size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>Same Board, Everyone</h3>
                    </div>
                    <p className="font-mundial text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                        The Daily board is seeded by the date, so the layout is identical for every player on the planet.
                    </p>
                </Card>
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <Lock size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>One Shot</h3>
                    </div>
                    <p className="font-mundial text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                        Players get just one attempt per day. The server locks you in the moment you start the game. The next Daily unlocks at midnight UTC.
                    </p>
                </Card>
            </div>

            <div
                className="rounded-2xl text-center py-10 px-6 relative overflow-hidden"
                style={{
                    background: `radial-gradient(ellipse at center, ${GOLD}28, transparent 70%), linear-gradient(180deg, rgba(26,10,46,0.93), rgba(12,4,24,0.97))`,
                    border: `2px solid ${GOLD}99`,
                    boxShadow: `0 0 48px ${GOLD}44`,
                }}
            >
                <CrownBadge />
                <div className="font-display font-black uppercase text-[11px] tracking-[0.35em] mt-4" style={{ color: GOLD, opacity: 0.95 }}>
                    Daily Champion Prize
                </div>
                <div
                    className="font-display font-black leading-none mt-3"
                    style={{ fontSize: 44, color: GOLD, textShadow: `0 3px 0 rgba(0,0,0,0.55), 0 0 24px ${GOLD}66` }}
                >
                    +10 PIN CAPSULES
                </div>
                <p className="font-mundial text-[14px] mt-3 max-w-[460px] mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                    Top the Daily leaderboard and 10 Pin Capsules will land in your account on your next login. It's automatic, no claim needed. If players tie, the earlier submission wins.
                </p>
            </div>
        </section>
    );
}

function CrownBadge() {
    return (
        <svg viewBox="0 0 64 64" width={60} height={60} aria-hidden="true" style={{ margin: "0 auto", display: "block", filter: `drop-shadow(0 0 20px ${GOLD}aa)` }}>
            <defs>
                <linearGradient id="crownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD_LIGHT} />
                    <stop offset="55%" stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD_DEEP} />
                </linearGradient>
            </defs>
            <path d="M8 46 L12 20 L24 32 L32 14 L40 32 L52 20 L56 46 Z" fill="url(#crownGrad)" stroke="#6B4A0F" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="8" y="46" width="48" height="7" rx="2" fill="url(#crownGrad)" stroke="#6B4A0F" strokeWidth="1.5" />
            <circle cx="32" cy="10" r="3" fill={GOLD_LIGHT} />
        </svg>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 9: Quests
   ════════════════════════════════════════════════════════════════ */
function Quests({ quests }: { quests: Array<{ id: string; icon: string; title: string; description: string; capsules: number }> }) {
    return (
        <section className="mb-20">
            <SectionHeader
                id="quests"
                tag="Long-term chases"
                title="Quests"
                sub="There are 55+ quests across two tracks. The Journey track teaches game mechanics with quests like first bomb, first capsule, and 3-day streak. The Mastery track is the long game: collection milestones, full tier sets, big score walls. Every quest you finish pays out capsules, and unlocks are permanent."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quests.map(q => (
                    <div
                        key={q.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{ background: "rgba(12,4,24,0.85)", border: `1px solid ${COSMIC}44` }}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `radial-gradient(circle at 35% 30%, ${COSMIC_LIGHT}44, ${COSMIC}44)`,
                                border: `1px solid ${COSMIC}88`,
                            }}
                        >
                            <QuestIcon id={q.id} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-display font-black text-[13px]" style={{ color: "#fff" }}>{q.title}</div>
                            <div className="font-mundial text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.82)" }}>{q.description}</div>
                        </div>
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}66` }}
                        >
                            <CapsuleIcon size={12} />
                            <span className="font-display font-black text-[11px]" style={{ color: GOLD }}>x{q.capsules}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function QuestIcon({ id }: { id: string }) {
    const map: Record<string, { icon: React.ReactNode; color: string }> = {
        first_combo:     { icon: <Flame size={18} />,    color: ORANGE },
        first_bomb:      { icon: <Target size={18} />,   color: "#FF3333" },
        score_25k:       { icon: <Trophy size={18} />,   color: GOLD },
        combo_8:         { icon: <Flame size={18} />,    color: ORANGE },
        all_cosmic:     { icon: <Sparkles size={18} />, color: COSMIC },
        found_cosmic_10: { icon: <Star size={18} />,     color: COSMIC },
        streak_7:        { icon: <Calendar size={18} />, color: ORANGE },
        pins_69:         { icon: <Pin size={18} />,      color: COSMIC },
    };
    const m = map[id] ?? { icon: <Star size={18} />, color: COSMIC };
    return <span style={{ color: m.color }}>{m.icon}</span>;
}

/* ════════════════════════════════════════════════════════════════
   SECTION 10: Rerolls
   ════════════════════════════════════════════════════════════════ */
function Rerolls() {
    const rows = [
        { tier: "common",  label: "Common",    cost: 5 },
        { tier: "rare",    label: "Rare",      cost: 4 },
        { tier: "special", label: "Special",   cost: 3 },
        { tier: "gold",    label: "Legendary", cost: 2 },
        { tier: "cosmic",  label: "Cosmic",    cost: 1 },
    ] as const;
    return (
        <section className="mb-20">
            <SectionHeader
                id="rerolls"
                tag="Dupes to fresh capsules"
                title="Rerolls"
                sub="Burn duplicate pins back into fresh capsules. Rarer tiers pay out more: a single Cosmic duplicate gets you a new capsule, while it takes five Commons for the same payout. Players always keep at least one of every pin they own, so collection % can only go up."
            />
            <Card accent={COSMIC}>
                <div className="grid gap-y-3" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b" style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.1)" }}>Tier</div>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b" style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.1)" }}>Dupes</div>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b text-right" style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.1)" }}>For</div>
                    {rows.map(r => {
                        const m = TIER_META[r.tier];
                        return (
                            <div key={r.tier} className="contents">
                                <div>
                                    <span
                                        className="inline-block font-display font-black text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
                                        style={{ color: m.color, border: `1px solid ${m.color}88`, background: `${m.color}18` }}
                                    >
                                        {r.label}
                                    </span>
                                </div>
                                <div className="font-mundial font-bold" style={{ color: m.color }}>{r.cost} dupes</div>
                                <div className="font-mundial font-bold text-right flex items-center justify-end gap-1.5" style={{ color: GOLD }}>
                                    <CapsuleIcon size={12} /> 1 Capsule
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
            <Callout tone="gold" label="Safety net">
                Reroll will <strong style={{ color: GOLD }}>never</strong> take your last copy of any pin. Your collection % can only go up. Completed tier sets stay sealed.
            </Callout>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 11: Leaderboards
   ════════════════════════════════════════════════════════════════ */
function Leaderboards() {
    const boards = [
        { icon: <Trophy size={26} />,  name: "All-Time", color: GOLD,      sub: "Your highest Classic score of all time. Never resets. The number you're trying to beat forever." },
        { icon: <Calendar size={26} />,name: "Weekly",   color: ORANGE,    sub: "Your best Classic score this week. A fresh race kicks off every Monday at midnight UTC." },
        { icon: <Star size={26} />,    name: "Daily",    color: "#4A9EFF", sub: "Today's Daily Challenge. One score per player, same board worldwide. The #1 finisher wins the champion bonus." },
        { icon: <Pin size={26} />,     name: "Pins",     color: COSMIC,    sub: "Ranked by collection %. A separate race from score. Updates the moment you pull a new pin." },
    ];
    return (
        <section className="mb-20">
            <SectionHeader
                id="leaderboards"
                tag="Compete"
                title="Leaderboards"
                sub="Four leaderboards, each tracking something different. The score boards only count eligible matches, so no practice farming. The Pins board races collection breadth instead of score."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {boards.map(b => (
                    <div
                        key={b.name}
                        className="rounded-2xl p-5 flex gap-4"
                        style={{
                            background: `linear-gradient(180deg, ${b.color}18, rgba(12,4,24,0.95))`,
                            border: `1px solid ${b.color}77`,
                            boxShadow: `0 0 20px ${b.color}28`,
                        }}
                    >
                        <div className="flex-shrink-0" style={{ color: b.color }}>{b.icon}</div>
                        <div>
                            <h3 className="font-display font-black uppercase text-[14px] tracking-[0.15em]" style={{ color: b.color }}>
                                {b.name}
                            </h3>
                            <p className="font-mundial text-[13px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                                {b.sub}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 12: Streaks + Referrals
   ════════════════════════════════════════════════════════════════ */
function StreakRefer() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="streak"
                tag="Show up, share"
                title="Streaks and Referrals"
                sub="Play any mode on any given day and your streak climbs by one. Skip a day and it resets back to 1. Quests at 3, 7, and 30 days each pay out bonus capsules. Referrals credit +2 capsules to both sides, with a lifetime cap of 50."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card accent={ORANGE}>
                    <div className="flex items-center gap-2 mb-2">
                        <Flame size={18} style={{ color: ORANGE }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>Day Streaks</h3>
                    </div>
                    <p className="font-mundial text-[14px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                        Any completed game counts toward your streak. The counter lives on your profile.
                    </p>
                    <ul className="font-mundial text-[14px] pl-5 m-0" style={{ color: "rgba(255,255,255,0.98)" }}>
                        <li className="mb-1 flex items-center gap-1.5"><strong style={{ color: ORANGE }}>3 days</strong> Streak Starter <span className="inline-flex items-center gap-0.5"><CapsuleIcon size={11} /> x2</span></li>
                        <li className="mb-1 flex items-center gap-1.5"><strong style={{ color: ORANGE }}>7 days</strong> Devoted <span className="inline-flex items-center gap-0.5"><CapsuleIcon size={11} /> x2</span></li>
                        <li className="flex items-center gap-1.5"><strong style={{ color: ORANGE }}>30 days</strong> Committed <span className="inline-flex items-center gap-0.5"><CapsuleIcon size={11} /> x3</span></li>
                    </ul>
                </Card>
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <HandHeart size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>Referral Link</h3>
                    </div>
                    <p className="font-mundial text-[14px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                        Grab your referral link from your profile. Every signup through your link credits both sides:
                    </p>
                    <div className="rounded-lg px-3 py-2 mb-1.5 flex items-center gap-2" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}55` }}>
                        <CapsuleIcon size={13} /> <strong style={{ color: GOLD }}>+2</strong> <span style={{ color: "rgba(255,255,255,0.95)" }}>to you</span>
                    </div>
                    <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: `${COSMIC}18`, border: `1px solid ${COSMIC}55` }}>
                        <CapsuleIcon size={13} color={COSMIC} /> <strong style={{ color: COSMIC }}>+2</strong> <span style={{ color: "rgba(255,255,255,0.95)" }}>to them</span>
                    </div>
                    <p className="font-mundial text-[12px] mt-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                        Lifetime cap is 50 capsules. The same link feeds the Ambassador, Recruiter, and Commander quest line (at 1, 5, and 10 referrals).
                    </p>
                </Card>
            </div>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION 13: Tips
   ════════════════════════════════════════════════════════════════ */
function Tips() {
    const tips = [
        { n: 1, title: "Hunt shapes before you clear",
          text: "A T or Cross setup on the next cascade is worth 2 to 4x a clean 3-match. Before you take the obvious move, scan the board for intersections. A Cross plus a high combo on a single turn can swing 10K points your way." },
        { n: 2, title: "Chain power tiles",
          text: "A Bomb next to a Laser detonates both at once. A Cosmic Blast next to anything is usually a game-defining move. If you have two power tiles on the board, your next move should almost always be to put them together." },
        { n: 3, title: "4-matches are never wasted",
          text: "A 4-match always leaves a Bomb behind, and a 5-match leaves a Laser. They sit on the board until you use them. Late game, your stockpile becomes your final-cascade multiplier stack." },
        { n: 4, title: "Daily Challenge ≠ Classic",
          text: "Classic gives you ten games per day. Daily gives you just one. Scan the whole board before your first move. Sketch out your power-tile setups in your head. Plan your last 10 moves. Slower play wins here." },
        { n: 5, title: "Open capsules immediately",
          text: "Every pin you pull ticks up a lifetime tier-find counter for quests like \"Find 200 Commons\" or \"Find 10 Cosmics\". Hoarding sealed capsules just slows your quest progress. There's no upside to waiting." },
        { n: 6, title: "Watch the Quests rail",
          text: "The desktop landing shows the three quests closest to completion. If one's sitting at 9/10, that's your next obvious move. Finish it, earn the capsules, and the rail re-rolls to the next closest one." },
    ];
    return (
        <section className="mb-20">
            <SectionHeader
                id="tips"
                tag="Get good"
                title="Tips and Tricks"
                sub="Six habits that separate consistent high scorers from lucky ones. Each one is a small shift in how you read the board, and each one compounds over time."
            />
            <div className="flex flex-col gap-3">
                {tips.map(t => (
                    <div
                        key={t.n}
                        className="rounded-xl px-5 py-4 flex gap-4 items-start"
                        style={{
                            background: "rgba(12,4,24,0.85)",
                            border: `1px solid ${COSMIC}33`,
                            borderLeft: `3px solid ${COSMIC}`,
                        }}
                    >
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display font-black text-[13px]"
                            style={{
                                color: "#1A0E02",
                                background: `radial-gradient(circle at 35% 30%, ${GOLD_LIGHT}, ${GOLD})`,
                                boxShadow: `0 0 12px ${GOLD}66`,
                            }}
                        >
                            {t.n}
                        </div>
                        <div>
                            <div className="font-display font-black text-[14px]" style={{ color: "#fff" }}>{t.title}</div>
                            <div className="font-mundial text-[13.5px] mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>{t.text}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   SECTION: Rewards
   ════════════════════════════════════════════════════════════════ */
function Prizes() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="rewards"
                tag="What's at stake"
                title="Rewards"
                sub="There are 2 different types of GVC rewards up for grabs."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card accent={GOLD}>
                    <div className="flex items-center gap-2 mb-3">
                        <div
                            className="font-display font-black uppercase text-[10px] tracking-[0.28em] px-2.5 py-1 rounded-full"
                            style={{ color: GOLD, background: `${GOLD}1f`, border: `1px solid ${GOLD}66` }}
                        >
                            Launch event
                        </div>
                    </div>
                    <h3 className="font-display font-black uppercase text-[20px] leading-tight mb-2" style={{ color: "#fff" }}>
                        GVC NFT Raffle
                    </h3>
                    <p className="font-mundial text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                        During the launch event, multiple GVC NFTs are up for grabs for the top Pin collectors. Anyone who completes the Pinbook (i.e. 100%, all 101 Pins found) before <strong style={{ color: GOLD }}>June 5th</strong>, or otherwise progresses the furthest (by %), will be entered into an exclusive raffle.
                    </p>
                </Card>

                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-3">
                        <div
                            className="font-display font-black uppercase text-[10px] tracking-[0.28em] px-2.5 py-1 rounded-full"
                            style={{ color: COSMIC, background: `${COSMIC}1f`, border: `1px solid ${COSMIC}66` }}
                        >
                            Evergreen reward
                        </div>
                    </div>
                    <h3 className="font-display font-black uppercase text-[20px] leading-tight mb-2" style={{ color: "#fff" }}>
                        Exclusive &quot;Pin Drop&quot; Badge
                    </h3>
                    <p className="font-mundial text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                        Do it for the flex! Any player that collects all 101 Pins and completes the entire Pinbook (100%) unlocks an exclusive <strong style={{ color: COSMIC }}>Pin Drop Badge</strong>. There is no end date announced at this time.
                    </p>
                </Card>
            </div>

            <Callout tone="cosmic" label="Heads up">
                To receive the Pin Drop badge, players must connect a wallet that&apos;s also tied to their GVC profile.
            </Callout>
        </section>
    );
}

/* ════════════════════════════════════════════════════════════════
   Footer
   ════════════════════════════════════════════════════════════════ */
function Footer() {
    return (
        <section className="text-center mt-20 pt-12" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="font-display font-black uppercase text-[10px] tracking-[0.35em] mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                Good Vibes Club
            </div>
            <h2 className="font-display font-black uppercase" style={{ fontSize: 34, color: GOLD, textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 16px ${GOLD}44` }}>
                Now go play.
            </h2>
            <p className="font-mundial text-[14px] mt-2 flex items-center justify-center gap-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                See you on the leaderboard. <Shaka size={16} />
            </p>
            {/* Free-path parity + legal disclaimer. Required wherever
                $VIBESTR purchase surfaces are present, kept here so the
                site footer carries the same line. */}
            <p className="font-mundial text-[12px] mt-5 max-w-[640px] mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                Every pin is earnable for free.<br />
                Use of $VIBESTR does not increase the probability of any specific outcome.
            </p>
            <div className="flex justify-center mt-6">
                <Link href="/" className="no-underline">
                    <ChunkyButton
                        color={GOLD}
                        deep={GOLD_DEEP}
                        text="#1A0E02"
                        style={{ padding: "12px 28px", fontSize: 13, fontWeight: 900, letterSpacing: "0.22em" }}
                    >
                        OPEN PIN DROP
                    </ChunkyButton>
                </Link>
            </div>
        </section>
    );
}
