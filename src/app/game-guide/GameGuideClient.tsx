"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FloatingBadges, ChunkyButton } from "@/components/arcade";
import {
    GOLD,
    GOLD_DIM,
    GOLD_DEEP,
    GOLD_LIGHT,
    COSMIC,
    COSMIC_DEEP,
    COSMIC_LIGHT,
    ORANGE,
    ORANGE_DEEP,
    PINK,
    INK_DEEP,
    INK_PANEL,
    INK_PANEL_LIGHT,
    INK_DARKEST,
} from "@/lib/arcade-tokens";
import { ALL_ACHIEVEMENTS } from "@/lib/achievements";

/* Tier visual tokens — mirrors Pin Book rarity treatment. */
const TIER_META = {
    common:  { label: "Common",    color: "#E5E7EB", glow: "rgba(229,231,235,0.25)", count: 19, img: "/badges/any_gvc_1759173799963.webp" },
    rare:    { label: "Rare",      color: "#4A9EFF", glow: "rgba(74,158,255,0.35)",  count: 51, img: "/badges/rainbow_boombox_1759173875165.webp" },
    special: { label: "Special",   color: ORANGE,    glow: "rgba(255,95,31,0.4)",    count: 9,  img: "/badges/vibestr_blue_tier.webp" },
    gold:    { label: "Legendary", color: GOLD,      glow: "rgba(255,224,72,0.4)",   count: 19, img: "/badges/gold_member_1759173793799.webp" },
    cosmic:  { label: "Cosmic",    color: COSMIC,    glow: "rgba(179,102,255,0.45)", count: 3,  img: "/badges/cosmic_guardian1759173818340.webp" },
} as const;

/* Collector ladder — same order/labels as src/lib/tiers.ts. */
const COLLECTOR_TIERS = [
    { id: "rookie",      label: "Plastic",     color: "#9CA3AF", accent: "#4B5563", pct: 0 },
    { id: "pro_plastic", label: "Grailscale",  color: "#E5E7EB", accent: "#6B7280", pct: 10 },
    { id: "big_vibes",   label: "Collectooor", color: "#FFB547", accent: "#B87333", pct: 25 },
    { id: "all_gold",    label: "69K Gold",    color: GOLD,      accent: "#8B6914", pct: 50 },
    { id: "shadow_funk", label: "Shadow Funk", color: "#D946EF", accent: "#86198F", pct: 75 },
    { id: "cosmic",      label: "Cosmic",      color: COSMIC,    accent: COSMIC_DEEP, pct: 90 },
    { id: "one_of_one",  label: "One-Of-One",  color: "#FFFFFF", accent: "#A8A8A8",  pct: 100 },
];

/* Curated quest sampler for the public guide. Ids match src/lib/achievements.ts. */
const QUEST_SAMPLER = [
    "first_combo", "first_bomb", "score_25k", "combo_8",
    "all_cosmic", "found_cosmic_10", "streak_7", "pins_69",
];

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
            {/* Ambient starfield + slow floating badges for the whole page */}
            <FloatingBadges count={80} speed={0.6} />
            <StarField />

            <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 pt-10 pb-24">

                {/* ─── Top bar ─── */}
                <TopBar />

                {/* ─── Hero ─── */}
                <Hero />

                {/* ─── TOC ─── */}
                <TableOfContents />

                {/* ─── Sections ─── */}
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
                <Tips />

                <Footer />
            </div>
        </main>
    );
}

/* ─────────────────────────────────────────────────────────────────
   Ambient starfield underlay (client-side twinkle).
   ───────────────────────────────────────────────────────────────── */
function StarField() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    const stars = Array.from({ length: 70 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 4,
        dur: 3 + Math.random() * 3,
    }));
    return (
        <>
            <div className="pointer-events-none fixed inset-0 z-0">
                {stars.map(s => (
                    <span
                        key={s.id}
                        className="absolute rounded-full bg-white"
                        style={{
                            left: `${s.x}%`,
                            top: `${s.y}%`,
                            width: s.size,
                            height: s.size,
                            opacity: 0.35,
                            animation: `vmGuideTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                        }}
                    />
                ))}
            </div>
            <style>{`
                @keyframes vmGuideTwinkle {
                    0%, 100% { opacity: 0.25; transform: scale(1); }
                    50% { opacity: 0.9; transform: scale(1.4); }
                }
                @keyframes vmGuideBob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes vmGuideGlow {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.08); }
                }
                @keyframes vmGuideOrbSpin { to { transform: rotate(360deg); } }
                @keyframes vmHoloSpin { to { --holo-angle: 360deg; } }
                @property --holo-angle {
                    syntax: "<angle>";
                    inherits: false;
                    initial-value: 0deg;
                }
            `}</style>
        </>
    );
}

/* ─────────────────────────────────────────────────────────────────
   Top bar — shaka home link + "Open the Game" CTA.
   ───────────────────────────────────────────────────────────────── */
function TopBar() {
    return (
        <div className="flex items-center justify-between mb-12">
            <Link href="/" className="group flex items-center gap-2.5 cursor-pointer">
                <Image
                    src="/assets/gvc_shaka.png"
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 group-hover:[transform:rotate(-12deg)_scale(1.08)] transition-transform duration-200"
                />
                <span
                    className="font-display font-black text-[13px] tracking-[0.3em] uppercase"
                    style={{ color: GOLD, textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 12px ${GOLD}44` }}
                >
                    VibeMatch
                </span>
            </Link>
            <Link href="/" className="no-underline">
                <ChunkyButton
                    color={GOLD}
                    deep={GOLD_DEEP}
                    text="#1A0E02"
                    style={{
                        padding: "9px 18px",
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.2em",
                    }}
                >
                    OPEN GAME
                </ChunkyButton>
            </Link>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   Hero — logo + tagline + tier orbs.
   ───────────────────────────────────────────────────────────────── */
function Hero() {
    return (
        <section className="text-center pt-6 pb-10">
            <div
                className="inline-block font-display font-black text-[10px] tracking-[0.35em] uppercase px-4 py-1.5 rounded-full mb-6"
                style={{
                    color: GOLD,
                    background: `${GOLD}12`,
                    border: `1px solid ${GOLD}55`,
                }}
            >
                🤙 Player Guide
            </div>
            <div
                className="mx-auto mb-4 cursor-default"
                style={{ animation: "vmGuideBob 3.2s ease-in-out infinite", width: 360, maxWidth: "80%" }}
            >
                <Image
                    src="/assets/logo.png"
                    alt="VibeMatch"
                    width={1000}
                    height={627}
                    priority
                    className="w-full h-auto"
                    style={{ filter: `drop-shadow(0 16px 30px ${GOLD}55)` }}
                />
            </div>
            <p
                className="font-mundial text-[17px] max-w-[600px] mx-auto mt-2"
                style={{ color: "rgba(255,255,255,0.7)" }}
            >
                Match badges. Score big. Collect every pin. Climb the Collector ladder from{" "}
                <span className="font-display font-black" style={{ color: "#9CA3AF" }}>PLASTIC</span>{" "}
                all the way to{" "}
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
                </span>
                .
            </p>

            {/* Tier orbs */}
            <div className="flex justify-center gap-4 mt-10 flex-wrap">
                {(["common","rare","special","gold","cosmic"] as const).map(t => (
                    <div key={t} className="flex flex-col items-center gap-2">
                        <div
                            className="w-12 h-12 rounded-full relative"
                            style={{
                                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), ${TIER_META[t].color} 55%, rgba(0,0,0,0.55))`,
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

/* ─────────────────────────────────────────────────────────────────
   Section shells — consistent header + card styling.
   ───────────────────────────────────────────────────────────────── */
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
            {sub && <p className="font-mundial mt-3 text-[15px] max-w-[680px]" style={{ color: "rgba(255,255,255,0.62)" }}>{sub}</p>}
        </div>
    );
}

function Card({
    children,
    accent = COSMIC,
    className = "",
}: { children: React.ReactNode; accent?: string; className?: string }) {
    return (
        <div
            className={`rounded-2xl p-5 sm:p-6 ${className}`}
            style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                border: `1px solid ${accent}22`,
                boxShadow: `0 0 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
        >
            {children}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   Table of contents.
   ───────────────────────────────────────────────────────────────── */
const SECTIONS: Array<{ id: string; label: string }> = [
    { id: "how-to-play", label: "How to play" },
    { id: "scoring", label: "Scoring moves" },
    { id: "power-tiles", label: "Power tiles" },
    { id: "shapes", label: "Shape bonuses" },
    { id: "capsules", label: "Pin Capsules" },
    { id: "pins", label: "Pins & rarity" },
    { id: "ladder", label: "Collector ladder" },
    { id: "daily", label: "Daily Challenge" },
    { id: "quests", label: "Quests" },
    { id: "rerolls", label: "Rerolls" },
    { id: "leaderboards", label: "Leaderboards" },
    { id: "streak", label: "Streaks & referrals" },
    { id: "tips", label: "Tips & tricks" },
];

function TableOfContents() {
    return (
        <nav
            className="mt-8 mb-16 rounded-2xl px-6 py-5"
            style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(4px)",
            }}
        >
            <div
                className="font-display font-black text-[10px] tracking-[0.3em] uppercase mb-3"
                style={{ color: GOLD }}
            >
                What's in here
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 list-none p-0 m-0">
                {SECTIONS.map((s, i) => (
                    <li key={s.id}>
                        <a
                            href={`#${s.id}`}
                            className="font-mundial text-[13px] no-underline transition-colors"
                            style={{ color: "rgba(255,255,255,0.62)" }}
                        >
                            <span
                                className="font-display font-black tabular-nums mr-2"
                                style={{ color: COSMIC }}
                            >
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            {s.label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/* ─────────────────────────────────────────────────────────────────
   Sections.
   ───────────────────────────────────────────────────────────────── */

function HowToPlay() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="how-to-play"
                tag="The basics"
                title="How to play"
                sub="VibeMatch is match-3 with Good Vibes Club badge artwork as the tiles. Swap adjacent badges to line up 3 or more of the same type. They clear, the board cascades, and your score climbs."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <h3 className="font-display font-black text-[17px] mb-2" style={{ color: COSMIC }}>Swap &amp; match</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Tap a badge then a neighbor to swap them. If the swap lines up 3+ same badges in a row or column, they clear.
                    </p>
                </Card>
                <Card>
                    <h3 className="font-display font-black text-[17px] mb-2" style={{ color: COSMIC }}>Cascade</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        When tiles clear, the ones above drop down and new tiles appear. Chain matches are "cascades" and multiply score.
                    </p>
                </Card>
                <Card>
                    <h3 className="font-display font-black text-[17px] mb-2" style={{ color: COSMIC }}>30 moves</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        You get 30 moves per Classic run. Bigger matches, combos, and shapes all multiply what each move is worth.
                    </p>
                </Card>
            </div>
            <Callout tone="cosmic" label="Stuck?">
                If you don't move for 8 seconds, the game quietly highlights a valid swap for you. You get one hint per run.
            </Callout>
        </section>
    );
}

function Scoring() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="scoring"
                tag="Score math"
                title="Scoring your moves"
                sub="Every match starts with a base score, then multipliers stack on top. Three things drive the multiplier: match length, combos, and cascades. Hit all three and a 3-match can swing 5 figures."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStat value="3+" label="Match length" color={GOLD} sub="3 is base. 4 and 5 pay more and create power tiles." />
                <ScoreStat value="×N" label="Combo" color={ORANGE} sub="Chain matches quickly and the combo multiplier climbs." />
                <ScoreStat value="↓↓↓" label="Cascade" color={COSMIC} sub="New matches triggered on fall stack another multiplier." />
            </div>
        </section>
    );
}

function ScoreStat({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
    return (
        <Card accent={color}>
            <div className="text-center">
                <div
                    className="font-display font-black leading-none"
                    style={{ fontSize: 46, color, textShadow: `0 0 22px ${color}55` }}
                >
                    {value}
                </div>
                <h3 className="font-display font-black uppercase text-[13px] tracking-[0.15em] mt-3" style={{ color }}>
                    {label}
                </h3>
                <p className="font-mundial text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>{sub}</p>
            </div>
        </Card>
    );
}

function PowerTiles() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="power-tiles"
                tag="Power tiles"
                title="Bombs, Streaks & Blasts"
                sub="Bigger matches automatically create special power tiles. They sit on the board until you move them — then they detonate. Chain specials for massive plays."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PowerCard
                    color={ORANGE}
                    emoji="💣"
                    title="Bomb"
                    trigger="Match 4 in a row"
                    effect="Clears a 3×3 area when detonated."
                />
                <PowerCard
                    color="#4A9EFF"
                    emoji="⚡"
                    title="VibeStreak"
                    trigger="Match 5 in a row"
                    effect="Lightning strike — clears a full row + column."
                />
                <PowerCard
                    color={COSMIC}
                    emoji="🌌"
                    title="Cosmic Blast"
                    trigger="Match 6+ or any Cosmic 5-match"
                    effect="The big one — clears a huge cross pattern."
                    premium
                />
            </div>
        </section>
    );
}

function PowerCard({
    color,
    emoji,
    title,
    trigger,
    effect,
    premium = false,
}: {
    color: string;
    emoji: string;
    title: string;
    trigger: string;
    effect: string;
    premium?: boolean;
}) {
    return (
        <div
            className="rounded-2xl p-6 text-center relative overflow-hidden"
            style={{
                background: `linear-gradient(180deg, ${color}12, rgba(10,4,24,0.7))`,
                border: `2px solid ${color}88`,
                boxShadow: premium
                    ? `0 0 32px ${color}44, inset 0 0 18px ${color}18`
                    : `0 0 22px ${color}22`,
            }}
        >
            <div
                className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
                style={{ background: `linear-gradient(180deg, ${color}22, transparent)` }}
            />
            <div style={{ fontSize: 46, lineHeight: 1, filter: `drop-shadow(0 0 16px ${color}aa)` }}>{emoji}</div>
            <h3 className="font-display font-black uppercase text-[20px] mt-3" style={{ color }}>{title}</h3>
            <p className="font-mundial text-[12px] italic mt-1.5" style={{ color: `${color}cc` }}>{trigger}</p>
            <p className="font-mundial text-[14px] mt-3" style={{ color: "rgba(255,255,255,0.82)" }}>{effect}</p>
        </div>
    );
}

/* ────────────────────────────────────────────────
   SHAPE BONUSES — the centerpiece visual section.
   ──────────────────────────────────────────────── */
function ShapeBonuses() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="shapes"
                tag="★ Shape bonuses"
                title="The shape multipliers"
                sub="If a match lines up in a specific shape — an L, a T, or a perfect Cross — the whole move gets a massive multiplier on top. These are the secret to huge scores. They trigger when two matching lines share a tile."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <ShapeCard
                    name="L-Shape"
                    mult="×1.5"
                    sub="Two lines meet at a corner"
                    color="#4A9EFF"
                    glow="rgba(74,158,255,0.4)"
                    cells={[
                        [1,0,0,0,0],
                        [1,0,0,0,0],
                        [1,1,1,0,0],
                        [0,0,0,0,0],
                        [0,0,0,0,0],
                    ]}
                />
                <ShapeCard
                    name="T-Shape"
                    mult="×2.5"
                    sub="Line meets the middle of another"
                    color={ORANGE}
                    glow="rgba(255,95,31,0.45)"
                    cells={[
                        [0,0,0,0,0],
                        [0,1,1,1,0],
                        [0,0,1,0,0],
                        [0,0,1,0,0],
                        [0,0,0,0,0],
                    ]}
                    highlight
                />
                <ShapeCard
                    name="Cross"
                    mult="×4"
                    sub="Two lines cross at the middle"
                    color={COSMIC}
                    glow="rgba(179,102,255,0.5)"
                    cells={[
                        [0,0,1,0,0],
                        [0,0,1,0,0],
                        [1,1,1,1,1],
                        [0,0,1,0,0],
                        [0,0,1,0,0],
                    ]}
                    highlight
                />
            </div>

            <Callout tone="gold" label="★ Bonus capsule">
                Land a <strong style={{ color: GOLD }}>T</strong> or <strong style={{ color: GOLD }}>Cross</strong> in any match and you earn a <strong style={{ color: GOLD }}>+1 bonus Pin Capsule</strong> for that game (once per game, capped). On top of whatever capsules you earn from your final score.
            </Callout>
        </section>
    );
}

function ShapeCard({
    name, mult, sub, color, glow, cells, highlight = false,
}: {
    name: string;
    mult: string;
    sub: string;
    color: string;
    glow: string;
    cells: number[][];
    highlight?: boolean;
}) {
    return (
        <div
            className="rounded-2xl p-5 text-center relative overflow-hidden"
            style={{
                background: `linear-gradient(180deg, ${color}14, ${INK_DARKEST})`,
                border: `2px solid ${color}`,
                boxShadow: highlight
                    ? `0 0 32px ${glow}, inset 0 0 22px ${color}22`
                    : `0 0 22px ${glow}`,
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top, ${glow}, transparent 65%)` }}
            />

            {/* Grid */}
            <div className="relative z-10 flex justify-center mb-3">
                <div
                    className="grid grid-cols-5 gap-[5px]"
                    style={{ width: 200, height: 200 }}
                >
                    {cells.flat().map((on, i) => (
                        <div
                            key={i}
                            className="rounded-[4px]"
                            style={{
                                background: on
                                    ? `radial-gradient(circle at 35% 28%, ${color}ee, ${color})`
                                    : "rgba(255,255,255,0.04)",
                                border: on ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
                                boxShadow: on
                                    ? `0 0 12px ${glow}, inset 0 -3px 5px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.4)`
                                    : "none",
                            }}
                        />
                    ))}
                </div>
            </div>

            <div
                className="relative z-10 font-display font-black uppercase text-[20px]"
                style={{ color, letterSpacing: "0.08em" }}
            >
                {name}
            </div>
            <div
                className="relative z-10 font-display font-black leading-none my-1.5"
                style={{
                    fontSize: 44,
                    color,
                    textShadow: `0 0 18px ${glow}, 0 3px 0 rgba(0,0,0,0.5)`,
                    letterSpacing: "-0.02em",
                }}
            >
                {mult}
            </div>
            <div
                className="relative z-10 font-mundial text-[12px]"
                style={{ color: "rgba(255,255,255,0.6)" }}
            >
                {sub}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────
   Capsules.
   ──────────────────────────────────────────────── */
function Capsules() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="capsules"
                tag="Rewards"
                title="Earning Pin Capsules"
                sub="Score high enough and you earn Pin Capsules. Rip them open to reveal a random pin from the 101-pin catalog. Higher scores = more capsules per run."
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStep amount="15,000+" caps="+1 Capsule" sub="Unlock the rewards" color={GOLD} intensity={0.35} />
                <ScoreStep amount="30,000+" caps="+2 Capsules" sub="Solid performance" color={ORANGE} intensity={0.45} />
                <ScoreStep amount="50,000+" caps="+3 Capsules" sub="Big score club" color={COSMIC} intensity={0.6} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <Card accent={GOLD} className="text-center">
                    <GoldCapsuleOrb />
                    <h3 className="font-display font-black uppercase text-[18px] mt-4" style={{ color: GOLD }}>Rip 'em open</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Tap OPEN on a capsule. Tier rolls first (weighted), then a specific pin gets revealed from that tier.
                    </p>
                </Card>
                <Card accent={COSMIC}>
                    <h3 className="font-display font-black uppercase text-[16px] mb-2" style={{ color: COSMIC }}>📅 Daily Challenge bonus</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Capsule payouts are <strong style={{ color: GOLD }}>doubled</strong> in the Daily Challenge:
                    </p>
                    <ul className="font-mundial text-[14px] mt-2 pl-5 m-0" style={{ color: "rgba(255,255,255,0.85)" }}>
                        <li className="mb-1">15K+ → <strong style={{ color: GOLD }}>+2 capsules</strong></li>
                        <li className="mb-1">30K+ → <strong style={{ color: GOLD }}>+4 capsules</strong></li>
                        <li>50K+ → <strong style={{ color: GOLD }}>+6 capsules</strong></li>
                    </ul>
                </Card>
            </div>
        </section>
    );
}

function ScoreStep({ amount, caps, sub, color, intensity }: { amount: string; caps: string; sub: string; color: string; intensity: number }) {
    return (
        <div
            className="rounded-2xl text-center py-7 px-5 relative overflow-hidden"
            style={{
                background: `linear-gradient(180deg, ${color}${Math.round(intensity*50).toString(16).padStart(2,"0")}, ${color}08)`,
                border: `1.5px solid ${color}55`,
                boxShadow: `0 0 ${Math.round(22 + intensity * 24)}px ${color}33, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
        >
            <div
                className="font-display font-black leading-none"
                style={{ fontSize: 32, color, textShadow: `0 3px 0 rgba(0,0,0,0.55), 0 0 20px ${color}55` }}
            >
                {amount}
            </div>
            <div className="font-display font-black uppercase text-[14px] mt-1.5" style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "0.1em" }}>
                {caps}
            </div>
            <div className="font-mundial text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{sub}</div>
        </div>
    );
}

function GoldCapsuleOrb() {
    return (
        <div className="relative mx-auto" style={{ width: 140, height: 140 }}>
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle at 35% 28%, ${GOLD_LIGHT}, ${GOLD} 50%, ${GOLD_DEEP})`,
                    boxShadow: `inset 0 -16px 32px ${GOLD_DEEP}, 0 12px 24px rgba(0,0,0,0.55), 0 0 40px ${GOLD}66`,
                }}
            />
            <div
                className="absolute left-0 right-0 rounded-full"
                style={{
                    top: "50%",
                    height: 6,
                    transform: "translateY(-50%)",
                    background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}, ${GOLD_LIGHT}, transparent)`,
                    boxShadow: `0 0 12px ${GOLD}`,
                }}
            />
            <div
                className="absolute rounded-full flex items-center justify-center"
                style={{
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 42, height: 42,
                    background: `radial-gradient(circle at 35% 30%, #1a0e02, #0a0502)`,
                    border: `2px solid ${GOLD_DEEP}`,
                    color: GOLD,
                    fontSize: 20,
                }}
            >
                🤙
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────
   Pins & rarity — use real badge imagery.
   ──────────────────────────────────────────────── */
function PinsSection() {
    const tiers: Array<keyof typeof TIER_META> = ["common","rare","special","gold","cosmic"];
    return (
        <section className="mb-20">
            <SectionHeader
                id="pins"
                tag="The collection"
                title="Pins & rarity"
                sub="The catalog is 101 unique pins across 5 rarity tiers. Capsules roll tier first (weighted by rarity), then pick a specific pin from that tier. Cosmics are the rarest — there are only 3."
            />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {tiers.map(t => {
                    const m = TIER_META[t];
                    return (
                        <div
                            key={t}
                            className="rounded-2xl p-4 text-center"
                            style={{
                                background: `linear-gradient(180deg, ${m.color}10, ${INK_DARKEST})`,
                                border: `1.5px solid ${m.color}55`,
                                boxShadow: `0 0 18px ${m.glow}`,
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
                            <div
                                className="font-display font-black uppercase text-[11px] tracking-[0.2em] mt-3"
                                style={{ color: m.color }}
                            >
                                {m.label}
                            </div>
                            <div className="font-mundial text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                                {m.count} pins
                            </div>
                        </div>
                    );
                })}
            </div>

            <Callout tone="cosmic" label="Duplicates are useful">
                Opening a capsule you already have adds to your dupe count. Dupes feed the <em style={{ color: COSMIC, fontStyle: "normal", fontWeight: 800 }}>Reroll</em> flow and count toward tier-find quests like "Find 200+ Common pins" — so collecting isn't wasted.
            </Callout>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Collector ladder.
   ──────────────────────────────────────────────── */
function CollectorLadder() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="ladder"
                tag="Status"
                title="The Collector ladder"
                sub="Your tier is based on the % of the catalog you've collected. It shows on your profile. Keep opening capsules to climb."
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
                                    ? { border: `1px solid rgba(255,255,255,0.5)` }
                                    : isCosmic
                                        ? {
                                            background: `radial-gradient(circle at 20% 30%, ${COSMIC}33, transparent 55%), radial-gradient(circle at 80% 75%, ${COSMIC_LIGHT}22, transparent 55%), linear-gradient(180deg, rgba(45,14,84,0.85), rgba(21,6,48,0.92))`,
                                            border: `1px solid ${COSMIC}88`,
                                            boxShadow: `0 0 22px ${COSMIC}55`,
                                        }
                                        : {
                                            background: "rgba(255,255,255,0.025)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                        }
                            }
                        >
                            {isHolo && <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(8,4,20,0.5), rgba(8,4,20,0.7))" }} />}
                            <div
                                className="w-3 h-3 rounded-full relative z-10"
                                style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }}
                            />
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
                                style={{ color: isHolo ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)" }}
                            >
                                {t.pct === 100 ? "100% · 101 pins" : `${t.pct}%+ · ${Math.ceil((t.pct/100) * 101)}+ pins`}
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

/* ────────────────────────────────────────────────
   Daily Challenge.
   ──────────────────────────────────────────────── */
function DailyChallenge() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="daily"
                tag="🎯 Once a day"
                title="The Daily Challenge"
                sub="One run per day. Same board for every player, globally. Pure test of who plays the tile layout best — no luck-of-the-draw on the starting board."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card accent={COSMIC}>
                    <h3 className="font-display font-black uppercase text-[16px] mb-2" style={{ color: COSMIC }}>🌍 Same board, everyone</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        The daily's board is seeded by the date, so every player gets the identical starting layout. Leaderboard reflects pure skill.
                    </p>
                </Card>
                <Card accent={COSMIC}>
                    <h3 className="font-display font-black uppercase text-[16px] mb-2" style={{ color: COSMIC }}>🔒 One shot</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                        One attempt per day. No refreshing, no retries. Commit — then the next Daily unlocks at midnight UTC.
                    </p>
                </Card>
            </div>

            <div
                className="rounded-2xl text-center py-10 px-6 relative overflow-hidden"
                style={{
                    background: `radial-gradient(ellipse at center, ${GOLD}22, transparent 70%), linear-gradient(180deg, ${GOLD}10, ${COSMIC}0a)`,
                    border: `2px solid ${GOLD}77`,
                    boxShadow: `0 0 48px ${GOLD}44`,
                }}
            >
                <div style={{ fontSize: 54, filter: `drop-shadow(0 0 20px ${GOLD}aa)`, marginBottom: 10 }}>👑</div>
                <div
                    className="font-display font-black uppercase text-[11px] tracking-[0.35em]"
                    style={{ color: GOLD, opacity: 0.9 }}
                >
                    Daily Champion Prize
                </div>
                <div
                    className="font-display font-black leading-none mt-2"
                    style={{
                        fontSize: 44,
                        color: GOLD,
                        textShadow: `0 3px 0 rgba(0,0,0,0.55), 0 0 24px ${GOLD}66`,
                    }}
                >
                    +10 PIN CAPSULES
                </div>
                <p className="font-mundial text-[14px] mt-3 max-w-[440px] mx-auto" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Finish #1 on the Daily Challenge leaderboard and the 10-capsule bonus is credited on your next session load.
                </p>
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Quests sampler.
   ──────────────────────────────────────────────── */
function Quests({ quests }: { quests: Array<{ id: string; icon: string; title: string; description: string; capsules: number }> }) {
    return (
        <section className="mb-20">
            <SectionHeader
                id="quests"
                tag="Long-term chases"
                title="Quests"
                sub="There are 55+ quests across two tracks (Journey teaches the basics, Mastery is long-term). Every one is sticky — once unlocked, always unlocked — and each pays out bonus capsules."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quests.map(q => (
                    <div
                        key={q.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                            background: `linear-gradient(90deg, ${COSMIC}12, transparent)`,
                            border: `1px solid ${COSMIC}33`,
                        }}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `radial-gradient(circle at 35% 30%, ${COSMIC_LIGHT}44, ${COSMIC}44)`,
                                border: `1px solid ${COSMIC}77`,
                                fontSize: 20,
                            }}
                        >
                            {q.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-display font-black text-[13px]" style={{ color: "#fff" }}>{q.title}</div>
                            <div className="font-mundial text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{q.description}</div>
                        </div>
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
                            style={{
                                background: `${GOLD}15`,
                                border: `1px solid ${GOLD}44`,
                            }}
                        >
                            <span>💊</span>
                            <span className="font-display font-black text-[11px]" style={{ color: GOLD }}>×{q.capsules}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Rerolls table.
   ──────────────────────────────────────────────── */
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
                tag="Dupes → fresh capsules"
                title="Rerolls"
                sub="Sitting on duplicates? Burn them back into fresh Pin Capsules. Higher-rarity dupes burn more efficiently — one Cosmic dupe is enough on its own."
            />
            <Card accent={COSMIC}>
                <div className="grid gap-y-3" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b" style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.08)" }}>Tier</div>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b" style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.08)" }}>Dupes</div>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b text-right" style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.08)" }}>For</div>
                    {rows.map(r => {
                        const m = TIER_META[r.tier];
                        return (
                            <div key={r.tier} className="contents">
                                <div>
                                    <span
                                        className="inline-block font-display font-black text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
                                        style={{ color: m.color, border: `1px solid ${m.color}55`, background: `${m.color}15` }}
                                    >
                                        {r.label}
                                    </span>
                                </div>
                                <div className="font-mundial font-bold" style={{ color: m.color }}>{r.cost} dupes</div>
                                <div className="font-mundial font-bold text-right" style={{ color: GOLD }}>1 Capsule</div>
                            </div>
                        );
                    })}
                </div>
            </Card>
            <Callout tone="gold" label="Safety net">
                Reroll <strong style={{ color: GOLD }}>never</strong> takes your last copy of a pin. You'll always keep at least one of each unique pin you own.
            </Callout>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Leaderboards.
   ──────────────────────────────────────────────── */
function Leaderboards() {
    const boards = [
        { icon: "🏆", name: "All-Time", color: GOLD,   sub: "Your top Classic score ever. Never resets." },
        { icon: "📅", name: "Weekly",   color: ORANGE, sub: "Best Classic score this week. Resets Monday 00:00 UTC." },
        { icon: "⭐", name: "Daily",    color: "#4A9EFF", sub: "Today's Daily Challenge leaderboard. Resets nightly." },
        { icon: "📌", name: "Pins",     color: COSMIC, sub: "Top pin collectors by completion %." },
    ];
    return (
        <section className="mb-20">
            <SectionHeader
                id="leaderboards"
                tag="Compete"
                title="Leaderboards"
                sub="Four separate rankings — each testing something different. Open the Leaders menu in-game to switch between them."
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {boards.map(b => (
                    <div
                        key={b.name}
                        className="rounded-2xl p-5 text-center"
                        style={{
                            background: `linear-gradient(180deg, ${b.color}14, ${INK_DARKEST})`,
                            border: `1px solid ${b.color}55`,
                            boxShadow: `0 0 18px ${b.color}22`,
                        }}
                    >
                        <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>{b.icon}</div>
                        <h3
                            className="font-display font-black uppercase text-[14px] tracking-[0.15em]"
                            style={{ color: b.color }}
                        >
                            {b.name}
                        </h3>
                        <p className="font-mundial text-[12px] mt-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {b.sub}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Streaks & referrals.
   ──────────────────────────────────────────────── */
function StreakRefer() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="streak"
                tag="Show up, share"
                title="Streaks & referrals"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card accent={ORANGE}>
                    <h3 className="font-display font-black uppercase text-[16px] mb-2" style={{ color: ORANGE }}>🔥 Day streaks</h3>
                    <p className="font-mundial text-[14px] mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Play any game mode at least once per day to keep your streak alive. Milestone quests unlock bonus capsules:
                    </p>
                    <ul className="font-mundial text-[14px] pl-5 m-0" style={{ color: "rgba(255,255,255,0.85)" }}>
                        <li className="mb-1"><strong style={{ color: ORANGE }}>3 days</strong> — Streak Starter (+2 💊)</li>
                        <li className="mb-1"><strong style={{ color: ORANGE }}>7 days</strong> — Devoted (+2 💊)</li>
                        <li><strong style={{ color: ORANGE }}>30 days</strong> — Committed (+3 💊)</li>
                    </ul>
                </Card>
                <Card accent={COSMIC}>
                    <h3 className="font-display font-black uppercase text-[16px] mb-2" style={{ color: COSMIC }}>🤝 Referral link</h3>
                    <p className="font-mundial text-[14px] mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Every player has a referral URL. When a new player signs up with your link:
                    </p>
                    <div
                        className="rounded-lg px-3 py-2 mb-1.5"
                        style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}33` }}
                    >
                        <strong style={{ color: GOLD }}>+2 💊</strong> <span style={{ color: "rgba(255,255,255,0.85)" }}>to you</span>
                    </div>
                    <div
                        className="rounded-lg px-3 py-2"
                        style={{ background: `${COSMIC}12`, border: `1px solid ${COSMIC}33` }}
                    >
                        <strong style={{ color: COSMIC }}>+2 💊</strong> <span style={{ color: "rgba(255,255,255,0.85)" }}>to them</span>
                    </div>
                    <p className="font-mundial text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                        Up to 50 capsules earnable from referrals per account.
                    </p>
                </Card>
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Tips.
   ──────────────────────────────────────────────── */
function Tips() {
    const tips = [
        { n: 1, title: "Look for shape setups before clearing", text: "A move that sets up a T or Cross in your next turn can be worth 3× more than a clean clear. Scan for potential intersections before you swap." },
        { n: 2, title: "Chain power tiles", text: "Swapping a Bomb next to a VibeStreak (or two of anything) detonates both at once. A Cosmic Blast adjacent to anything is a guaranteed huge clear." },
        { n: 3, title: "4-matches aren't wasted", text: "Every 4-match creates a Bomb. Every 5-match creates a VibeStreak. Even if you're not maxing score, you're stocking power tiles." },
        { n: 4, title: "Daily Challenge ≠ Classic", text: "The Daily uses the same board for everyone. Study it at the start and plan a clearing order — you only get 30 moves and one attempt." },
        { n: 5, title: "Open capsules immediately", text: "Duplicates count toward tier-find quests. The sooner you open, the sooner those lifetime counters tick up." },
        { n: 6, title: "Watch the Quests rail", text: "The desktop landing shows 3 progressable quests closest to your current progress. Finishing one unlocks bonus capsules on your next game." },
    ];
    return (
        <section className="mb-20">
            <SectionHeader
                id="tips"
                tag="Get good"
                title="Tips & tricks"
            />
            <div className="flex flex-col gap-3">
                {tips.map(t => (
                    <div
                        key={t.n}
                        className="rounded-xl px-5 py-4 flex gap-4 items-start"
                        style={{
                            background: `linear-gradient(90deg, ${COSMIC}10, transparent)`,
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
                            <div className="font-mundial text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>{t.text}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────
   Shared callout.
   ──────────────────────────────────────────────── */
function Callout({ tone, label, children }: { tone: "gold" | "cosmic"; label: string; children: React.ReactNode }) {
    const c = tone === "gold" ? GOLD : COSMIC;
    return (
        <div
            className="mt-5 rounded-xl px-5 py-4"
            style={{
                background: `linear-gradient(90deg, ${c}12, transparent)`,
                borderLeft: `3px solid ${c}`,
            }}
        >
            <div className="font-display font-black uppercase text-[10px] tracking-[0.3em] mb-1" style={{ color: c }}>{label}</div>
            <div className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.82)" }}>{children}</div>
        </div>
    );
}

/* ────────────────────────────────────────────────
   Footer.
   ──────────────────────────────────────────────── */
function Footer() {
    return (
        <section className="text-center mt-20 pt-12" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div
                className="font-display font-black uppercase text-[10px] tracking-[0.35em] mb-3"
                style={{ color: "rgba(255,255,255,0.35)" }}
            >
                Good Vibes Club
            </div>
            <h2
                className="font-display font-black uppercase"
                style={{ fontSize: 34, color: GOLD, textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 16px ${GOLD}44` }}
            >
                Now go play.
            </h2>
            <p className="font-mundial text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                See you on the leaderboard. 🤙
            </p>
            <div className="flex justify-center mt-6">
                <Link href="/" className="no-underline">
                    <ChunkyButton
                        color={GOLD}
                        deep={GOLD_DEEP}
                        text="#1A0E02"
                        style={{ padding: "12px 28px", fontSize: 13, fontWeight: 900, letterSpacing: "0.22em" }}
                    >
                        OPEN VIBEMATCH
                    </ChunkyButton>
                </Link>
            </div>
        </section>
    );
}
