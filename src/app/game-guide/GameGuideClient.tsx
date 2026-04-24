"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
    Home, Flame, Trophy, Calendar, Pin, Star, HandHeart, Zap, Target, Sparkles,
    TrendingUp, ArrowRight, Lock, Globe, Lightbulb,
} from "lucide-react";
import { FloatingBadges, ChunkyButton } from "@/components/arcade";
import {
    GOLD, GOLD_DEEP, GOLD_LIGHT, GOLD_DIM,
    COSMIC, COSMIC_DEEP, COSMIC_LIGHT,
    ORANGE, ORANGE_DEEP, PINK,
    INK_DEEP, INK_PANEL, INK_PANEL_LIGHT, INK_DARKEST,
} from "@/lib/arcade-tokens";
import { ALL_ACHIEVEMENTS } from "@/lib/achievements";

/* ────────────────────────────────────────────────────────────────
   Tier palette (sourced from VibeCapsule + Pin Book patterns so the
   guide visually matches the live game).
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
    { id: "how-to-play", label: "How to play" },
    { id: "scoring", label: "Scoring moves" },
    { id: "power-tiles", label: "Power tiles" },
    { id: "shapes", label: "Shape bonuses" },
    { id: "capsules", label: "Pin Capsules" },
    { id: "pins", label: "Pins and rarity" },
    { id: "ladder", label: "Collector ladder" },
    { id: "daily", label: "Daily Challenge" },
    { id: "quests", label: "Quests" },
    { id: "rerolls", label: "Rerolls" },
    { id: "leaderboards", label: "Leaderboards" },
    { id: "streak", label: "Streaks and referrals" },
    { id: "tips", label: "Tips and tricks" },
];

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
            <FloatingBadges count={80} speed={0.6} />
            <StarField />

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
                <Tips />

                <Footer />
            </div>
        </main>
    );
}

/* ────────────────────────────────────────────────────────────────
   Shared UI primitives.
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
        <span
            className="inline-block relative align-middle"
            style={{ width: size, height: size }}
        >
            <span
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle at 35% 28%, ${GOLD_LIGHT}, ${color} 60%, ${GOLD_DEEP})`,
                    boxShadow: `inset 0 -2px 3px rgba(0,0,0,0.5), 0 0 4px ${color}`,
                }}
            />
            <span
                className="absolute left-0 right-0"
                style={{
                    top: "50%",
                    height: 1.5,
                    transform: "translateY(-50%)",
                    background: GOLD_LIGHT,
                    opacity: 0.9,
                }}
            />
        </span>
    );
}

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
                            opacity: 0.32,
                            animation: `vmGuideTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                        }}
                    />
                ))}
            </div>
            <style>{`
                @keyframes vmGuideTwinkle {
                    0%, 100% { opacity: 0.22; transform: scale(1); }
                    50% { opacity: 0.85; transform: scale(1.4); }
                }
                @keyframes vmGuideBob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes vmHoloSpin { to { --holo-angle: 360deg; } }
                @property --holo-angle {
                    syntax: "<angle>";
                    inherits: false;
                    initial-value: 0deg;
                }
                @keyframes vmCapsuleBob {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-4px) rotate(-2deg); }
                }
                @keyframes vmShapeFlash {
                    0%, 100% { filter: brightness(1); }
                    50% { filter: brightness(1.4); }
                }
            `}</style>
        </>
    );
}

/* ────────────────────────────────────────────────────────────────
   Top bar.
   ──────────────────────────────────────────────────────────────── */
function TopBar() {
    return (
        <div className="flex items-center justify-between mb-12">
            <Link href="/" className="group flex items-center gap-2.5 cursor-pointer no-underline">
                <div className="transition-transform duration-200 group-hover:[transform:rotate(-12deg)_scale(1.08)]">
                    <Shaka size={32} />
                </div>
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
                    style={{ padding: "9px 18px", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em" }}
                >
                    OPEN GAME
                </ChunkyButton>
            </Link>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────
   Hero.
   ──────────────────────────────────────────────────────────────── */
function Hero() {
    return (
        <section className="text-center pt-6 pb-10">
            <div
                className="inline-flex items-center gap-2 font-display font-black text-[10px] tracking-[0.35em] uppercase px-4 py-1.5 rounded-full mb-6"
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
                style={{ color: "rgba(255,255,255,0.78)" }}
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

/* ────────────────────────────────────────────────────────────────
   Section shells.
   ──────────────────────────────────────────────────────────────── */
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
                <p className="font-mundial mt-3 text-[15px] max-w-[680px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {sub}
                </p>
            )}
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
                background: "linear-gradient(180deg, rgba(26,10,46,0.85), rgba(12,4,24,0.9))",
                border: `1px solid ${accent}33`,
                boxShadow: `0 4px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)`,
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
                background: `linear-gradient(90deg, ${c}15, rgba(12,4,24,0.8))`,
                borderLeft: `3px solid ${c}`,
                border: `1px solid ${c}22`,
            }}
        >
            <div className="font-display font-black uppercase text-[10px] tracking-[0.3em] mb-1" style={{ color: c }}>
                {label}
            </div>
            <div className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.92)" }}>
                {children}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────
   TOC.
   ──────────────────────────────────────────────────────────────── */
function TableOfContents() {
    return (
        <nav
            className="mt-8 mb-16 rounded-2xl px-6 py-5"
            style={{
                background: "rgba(12,4,24,0.7)",
                border: "1px solid rgba(179,102,255,0.2)",
                backdropFilter: "blur(4px)",
            }}
        >
            <div className="font-display font-black text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>
                What is in here
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 list-none p-0 m-0">
                {SECTIONS.map((s, i) => (
                    <li key={s.id}>
                        <a
                            href={`#${s.id}`}
                            className="font-mundial text-[13px] no-underline transition-colors hover:text-white"
                            style={{ color: "rgba(255,255,255,0.7)" }}
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

/* ────────────────────────────────────────────────────────────────
   SECTION: How to play.
   ──────────────────────────────────────────────────────────────── */
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
                    <div className="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style={{ background: `${COSMIC}22`, border: `1px solid ${COSMIC}66` }}>
                        <ArrowRight size={18} style={{ color: COSMIC }} />
                    </div>
                    <h3 className="font-display font-black text-[17px] mb-2" style={{ color: "#fff" }}>Swap and match</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Tap a badge then a neighbor to swap them. If the swap lines up 3+ same badges in a row or column, they clear.
                    </p>
                </Card>
                <Card>
                    <div className="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style={{ background: `${COSMIC}22`, border: `1px solid ${COSMIC}66` }}>
                        <TrendingUp size={18} style={{ color: COSMIC }} />
                    </div>
                    <h3 className="font-display font-black text-[17px] mb-2" style={{ color: "#fff" }}>Cascade</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        When tiles clear, the ones above drop down and new tiles appear. Chain matches are cascades and multiply score.
                    </p>
                </Card>
                <Card>
                    <div className="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style={{ background: `${COSMIC}22`, border: `1px solid ${COSMIC}66` }}>
                        <Target size={18} style={{ color: COSMIC }} />
                    </div>
                    <h3 className="font-display font-black text-[17px] mb-2" style={{ color: "#fff" }}>30 moves</h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        You get 30 moves per Classic run. Bigger matches, combos, and shapes all multiply what each move is worth.
                    </p>
                </Card>
            </div>
            <Callout tone="cosmic" label="Stuck?">
                If you do not move for 8 seconds, the game quietly highlights a valid swap for you. You get one hint per run.
            </Callout>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Scoring.
   ──────────────────────────────────────────────────────────────── */
function Scoring() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="scoring"
                tag="Score math"
                title="Scoring your moves"
                sub="Every match starts with a base score, then multipliers stack on top. Three things drive the multiplier: match length, combos, and cascades. Hit all three and a 3-match can swing five figures."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStat value="3+" label="Match length" color={GOLD} sub="3 is base. 4 and 5 pay more AND create power tiles." />
                <ScoreStat value="xN" label="Combo" color={ORANGE} sub="Chain matches quickly and the combo multiplier climbs." />
                <ScoreStat value=". . ." label="Cascade" color={COSMIC} sub="New matches triggered on fall stack another multiplier." />
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
                    style={{ fontSize: 46, color, textShadow: `0 0 22px ${color}55, 0 3px 0 rgba(0,0,0,0.55)` }}
                >
                    {value}
                </div>
                <h3 className="font-display font-black uppercase text-[13px] tracking-[0.15em] mt-3" style={{ color: "#fff" }}>
                    {label}
                </h3>
                <p className="font-mundial text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,0.72)" }}>{sub}</p>
            </div>
        </Card>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Power tiles (interactive, reuses real overlay look).
   ──────────────────────────────────────────────────────────────── */
function PowerTiles() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="power-tiles"
                tag="Power tiles"
                title="Bombs, Laser Parties and Blasts"
                sub="Bigger matches automatically create special power tiles. They sit on the board until you move them, then they detonate. Chain specials for massive plays."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PowerTileDemo
                    kind="bomb"
                    name="Bomb"
                    trigger="Match 4 in a row"
                    effect="Clears a 3x3 area when detonated."
                    accent="#FF3333"
                    glow="rgba(255,51,51,0.45)"
                />
                <PowerTileDemo
                    kind="laser"
                    name="Laser Party"
                    trigger="Match 5 in a row"
                    effect="Lightning strike. Clears a full row and column."
                    accent="#4A9EFF"
                    glow="rgba(74,158,255,0.5)"
                />
                <PowerTileDemo
                    kind="cosmic"
                    name="Cosmic Blast"
                    trigger="Match 6+ or any Cosmic 5-match"
                    effect="The big one. Clears a huge cross pattern."
                    accent={COSMIC}
                    glow="rgba(179,102,255,0.55)"
                    premium
                />
            </div>
        </section>
    );
}

function PowerTileDemo({
    kind, name, trigger, effect, accent, glow, premium = false,
}: {
    kind: "bomb" | "laser" | "cosmic";
    name: string;
    trigger: string;
    effect: string;
    accent: string;
    glow: string;
    premium?: boolean;
}) {
    return (
        <div
            className="rounded-2xl p-6 text-center relative overflow-hidden"
            style={{
                background: "linear-gradient(180deg, rgba(26,10,46,0.92), rgba(12,4,24,0.95))",
                border: `2px solid ${accent}88`,
                boxShadow: premium
                    ? `0 0 36px ${glow}, inset 0 0 18px ${accent}18`
                    : `0 0 22px ${glow}`,
            }}
        >
            <div
                className="absolute inset-x-0 top-0 h-[30%] pointer-events-none"
                style={{ background: `linear-gradient(180deg, ${accent}16, transparent)` }}
            />

            {/* Demo tile with the real in-game overlay style. */}
            <div className="relative flex justify-center mb-4">
                <div
                    className="relative rounded-xl overflow-hidden"
                    style={{
                        width: 96, height: 96,
                        background: "rgba(20,10,40,0.9)",
                        border: "1.5px solid rgba(255,255,255,0.1)",
                    }}
                >
                    <Image
                        src="/badges/any_gvc_1759173799963.webp"
                        alt=""
                        fill
                        sizes="96px"
                        unoptimized
                        className="object-cover opacity-85"
                    />
                    {kind === "bomb" && <DemoBombOverlay />}
                    {kind === "laser" && <DemoLaserOverlay />}
                    {kind === "cosmic" && <DemoCosmicOverlay />}
                </div>
            </div>

            <h3 className="font-display font-black uppercase text-[20px]" style={{ color: "#fff", letterSpacing: "0.06em" }}>
                {name}
            </h3>
            <p className="font-mundial text-[12px] italic mt-1.5" style={{ color: accent }}>
                {trigger}
            </p>
            <p className="font-mundial text-[14px] mt-3" style={{ color: "rgba(255,255,255,0.88)" }}>
                {effect}
            </p>
        </div>
    );
}

/* In-guide copies of the real overlays. Same CSS class names as the live
   game (bomb-border / laser-scan-h / etc.) so they inherit the globals.css
   keyframe animations and look pixel-identical to the GameBoard rendering. */

function DemoBombOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden"
            style={{ boxShadow: "inset 0 0 20px rgba(255,0,0,0.8)" }}>
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
        <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden"
            style={{ boxShadow: "inset 0 0 24px rgba(74,158,255,0.9)" }}>
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
            <div className="cosmic-outer-glow absolute inset-0 rounded-xl"
                style={{ boxShadow: "inset 0 0 10px rgba(179,102,255,0.7), inset 0 0 20px rgba(255,107,157,0.35)" }} />
            <div className="cosmic-ring absolute -inset-6"
                style={{ background: "conic-gradient(from 0deg at 50% 50%, rgba(179,102,255,0) 0%, rgba(255,107,157,0.85) 25%, rgba(179,102,255,0) 50%, rgba(74,158,255,0.85) 75%, rgba(179,102,255,0) 100%)" }} />
            <div className="cosmic-glow absolute inset-[10%] rounded-full border-2 border-[#B366FF]/60"
                style={{ background: "radial-gradient(circle, rgba(179,102,255,0.35) 0%, rgba(179,102,255,0.08) 60%, transparent 100%)" }} />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="cosmic-core-dot w-2.5 h-2.5 rounded-full"
                    style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(179,102,255,0.5) 60%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(179,102,255,0.9), 0 0 14px rgba(179,102,255,0.5)",
                    }} />
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Shape bonuses (INTERACTIVE).
   ──────────────────────────────────────────────────────────────── */
function ShapeBonuses() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="shapes"
                tag="Shape bonuses"
                title="The shape multipliers"
                sub="If a match lines up in a specific shape (an L, a T, or a perfect Cross) the whole move gets a massive multiplier on top. These are the secret to huge scores. They trigger when two matching lines share a tile. Tap a card to see the shape animate in."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <ShapeCard
                    name="L-Shape"
                    mult="x1.5"
                    sub="Two lines meet at a corner"
                    color="#4A9EFF"
                    glow="rgba(74,158,255,0.45)"
                    sequence={[
                        [0,0], [1,0], [2,0], [2,1], [2,2],
                    ]}
                />
                <ShapeCard
                    name="T-Shape"
                    mult="x2.5"
                    sub="Line meets the middle of another"
                    color={ORANGE}
                    glow="rgba(255,95,31,0.5)"
                    sequence={[
                        [1,1], [1,2], [1,3], [2,2], [3,2],
                    ]}
                    highlight
                />
                <ShapeCard
                    name="Cross"
                    mult="x4"
                    sub="Two lines cross at the middle"
                    color={COSMIC}
                    glow="rgba(179,102,255,0.55)"
                    sequence={[
                        [2,0], [2,1], [2,2], [2,3], [2,4],
                        [0,2], [1,2], [3,2], [4,2],
                    ]}
                    highlight
                />
            </div>

            <Callout tone="gold" label="Bonus capsule">
                Land a <strong style={{ color: GOLD }}>T</strong> or <strong style={{ color: GOLD }}>Cross</strong> in any match and you earn a <strong style={{ color: GOLD }}>+1 bonus Pin Capsule</strong> for that game (once per game, capped). On top of whatever capsules you earn from your final score.
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
    sequence: Array<[number, number]>; // [row, col] order of cells to light
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

    // On mount, auto-play once after a short delay so the shape reads.
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
                background: `linear-gradient(180deg, ${color}14, rgba(12,4,24,0.95))`,
                border: `2px solid ${color}`,
                boxShadow: highlight
                    ? `0 0 36px ${glow}, inset 0 0 22px ${color}22`
                    : `0 0 24px ${glow}`,
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
            <div
                className="relative z-10 font-display font-black uppercase text-[20px]"
                style={{ color: "#fff", letterSpacing: "0.08em" }}
            >
                {name}
            </div>
            <div
                className="relative z-10 font-display font-black leading-none my-1.5"
                style={{
                    fontSize: 44,
                    color,
                    textShadow: `0 0 18px ${glow}, 0 3px 0 rgba(0,0,0,0.55)`,
                    letterSpacing: "-0.02em",
                }}
            >
                {mult}
            </div>
            <div className="relative z-10 font-mundial text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                {sub}
            </div>
            <div className="relative z-10 font-display font-black text-[9px] tracking-[0.25em] mt-3 uppercase" style={{ color: `${color}cc` }}>
                Tap to replay
            </div>
        </button>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Capsules (with interactive Pokeball-style capsule).
   ──────────────────────────────────────────────────────────────── */
function Capsules() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="capsules"
                tag="Rewards"
                title="Earning Pin Capsules"
                sub="Score high enough and you earn Pin Capsules. Rip them open to reveal a random pin from the 101-pin catalog. Higher scores give more capsules per run."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStep amount="15,000+" caps="+1 Capsule" sub="Unlock the rewards" color={GOLD} intensity={0.35} />
                <ScoreStep amount="30,000+" caps="+2 Capsules" sub="Solid performance" color={ORANGE} intensity={0.45} />
                <ScoreStep amount="50,000+" caps="+3 Capsules" sub="Big score club" color={COSMIC} intensity={0.6} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <Card accent={GOLD} className="text-center">
                    <CapsuleVisual />
                    <h3 className="font-display font-black uppercase text-[18px] mt-4" style={{ color: "#fff" }}>
                        Rip them open
                    </h3>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Tap OPEN on a capsule. Tier rolls first (weighted), then a specific pin gets revealed from that tier. Tap the capsule to preview the crack.
                    </p>
                </Card>
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>
                            Daily Challenge bonus
                        </h3>
                    </div>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Capsule payouts are <strong style={{ color: GOLD }}>doubled</strong> in the Daily Challenge:
                    </p>
                    <ul className="font-mundial text-[14px] mt-2 pl-5 m-0" style={{ color: "rgba(255,255,255,0.95)" }}>
                        <li className="mb-1">15K+ gives <strong style={{ color: GOLD }}>+2 capsules</strong></li>
                        <li className="mb-1">30K+ gives <strong style={{ color: GOLD }}>+4 capsules</strong></li>
                        <li>50K+ gives <strong style={{ color: GOLD }}>+6 capsules</strong></li>
                    </ul>
                </Card>
            </div>
        </section>
    );
}

/* Pokeball-style capsule matching the real VibeCapsule visual language.
   Two hemispheres with a visible seam, dark chrome shell, tier-colored
   glowing core seen through a gold rim. Tap it to play a crack sequence. */
function CapsuleVisual() {
    const [phase, setPhase] = useState<"idle" | "crack">("idle");

    const trigger = () => {
        if (phase === "crack") return;
        setPhase("crack");
        setTimeout(() => setPhase("idle"), 1500);
    };

    return (
        <button
            type="button"
            onClick={trigger}
            aria-label="Preview capsule crack"
            className="relative mx-auto block cursor-pointer focus:outline-none"
            style={{
                width: 168,
                height: 168,
                background: "none",
                border: "none",
                padding: 0,
                animation: "vmCapsuleBob 3.2s ease-in-out infinite",
            }}
        >
            {/* Halo */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    inset: -24,
                    background: `radial-gradient(circle, ${GOLD}66 0%, ${GOLD}22 40%, transparent 72%)`,
                    filter: "blur(6px)",
                }}
            />

            {/* Top hemisphere: detaches and rises on crack */}
            <div
                className="absolute left-0 right-0 overflow-hidden"
                style={{
                    top: 0,
                    height: "50%",
                    borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                    background: `
                        radial-gradient(circle at 32% 24%, rgba(255,255,255,0.55) 0%, transparent 26%),
                        radial-gradient(ellipse at 50% 80%, ${GOLD}38, transparent 60%),
                        linear-gradient(180deg, #1a1508 0%, #0a0806 100%)
                    `,
                    boxShadow: `inset 0 -6px 14px ${GOLD_DEEP}, 0 6px 14px rgba(0,0,0,0.45)`,
                    transformOrigin: "50% 100%",
                    transform: phase === "crack" ? "translateY(-32px) rotate(10deg)" : "translateY(0) rotate(0deg)",
                    transition: "transform 0.35s cubic-bezier(0.3,0.1,0.3,1.2)",
                    zIndex: 3,
                }}
            />

            {/* Bottom hemisphere */}
            <div
                className="absolute left-0 right-0 overflow-hidden"
                style={{
                    bottom: 0,
                    height: "50%",
                    borderRadius: "0 0 50% 50% / 0 0 100% 100%",
                    background: `
                        radial-gradient(circle at 60% 80%, rgba(0,0,0,0.55) 0%, transparent 55%),
                        radial-gradient(ellipse at 50% 20%, ${GOLD}44, transparent 60%),
                        linear-gradient(180deg, #0e0806 0%, #050202 100%)
                    `,
                    boxShadow: `inset 0 6px 14px rgba(0,0,0,0.7), 0 8px 18px rgba(0,0,0,0.5)`,
                    zIndex: 2,
                }}
            />

            {/* Gold seam / equator band */}
            <div
                className="absolute left-0 right-0"
                style={{
                    top: "calc(50% - 3px)",
                    height: 6,
                    background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD_LIGHT} 20%, ${GOLD_LIGHT} 80%, ${GOLD_DEEP})`,
                    boxShadow: `0 0 10px ${GOLD}, 0 2px 4px rgba(0,0,0,0.55)`,
                    zIndex: 4,
                    borderRadius: 2,
                }}
            />

            {/* Center emblem disk */}
            <div
                className="absolute rounded-full flex items-center justify-center"
                style={{
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 42,
                    height: 42,
                    background: `radial-gradient(circle at 35% 30%, ${GOLD_LIGHT}, ${GOLD} 55%, ${GOLD_DEEP})`,
                    border: `2px solid ${GOLD_DEEP}`,
                    boxShadow: `0 2px 6px rgba(0,0,0,0.6), inset 0 -3px 6px ${GOLD_DEEP}, 0 0 10px ${GOLD}88`,
                    zIndex: 5,
                }}
            >
                <Shaka size={24} />
            </div>

            {/* Crack-moment light burst */}
            {phase === "crack" && (
                <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        inset: -10,
                        background: `radial-gradient(circle, ${GOLD}cc 0%, ${GOLD}66 35%, transparent 70%)`,
                        animation: "vmShapeFlash 0.6s ease-out 1",
                        zIndex: 1,
                    }}
                />
            )}
        </button>
    );
}

function ScoreStep({ amount, caps, sub, color, intensity }: { amount: string; caps: string; sub: string; color: string; intensity: number }) {
    return (
        <div
            className="rounded-2xl text-center py-7 px-5 relative overflow-hidden"
            style={{
                background: `linear-gradient(180deg, rgba(12,4,24,0.85), rgba(5,2,16,0.95))`,
                border: `1.5px solid ${color}77`,
                boxShadow: `0 0 ${Math.round(22 + intensity * 24)}px ${color}44, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
        >
            <div
                className="absolute inset-x-0 top-0 h-[40%] pointer-events-none"
                style={{ background: `linear-gradient(180deg, ${color}22, transparent)` }}
            />
            <div
                className="relative font-display font-black leading-none"
                style={{ fontSize: 32, color, textShadow: `0 3px 0 rgba(0,0,0,0.6), 0 0 20px ${color}66` }}
            >
                {amount}
            </div>
            <div className="relative font-display font-black uppercase text-[14px] mt-2" style={{ color: "#fff", letterSpacing: "0.1em" }}>
                {caps}
            </div>
            <div className="relative font-mundial text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                {sub}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Pins and rarity.
   ──────────────────────────────────────────────────────────────── */
function PinsSection() {
    const tiers: Array<keyof typeof TIER_META> = ["common","rare","special","gold","cosmic"];
    return (
        <section className="mb-20">
            <SectionHeader
                id="pins"
                tag="The collection"
                title="Pins and rarity"
                sub="The catalog is 101 unique pins across 5 rarity tiers. Capsules roll tier first (weighted by rarity), then pick a specific pin from that tier. Cosmics are the rarest: there are only 3."
            />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {tiers.map(t => {
                    const m = TIER_META[t];
                    return (
                        <div
                            key={t}
                            className="rounded-2xl p-4 text-center"
                            style={{
                                background: `linear-gradient(180deg, ${m.color}14, rgba(12,4,24,0.92))`,
                                border: `1.5px solid ${m.color}66`,
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
                            <div className="font-mundial text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                                {m.count} pins
                            </div>
                        </div>
                    );
                })}
            </div>
            <Callout tone="cosmic" label="Duplicates are useful">
                Opening a capsule you already have adds to your dupe count. Dupes feed the <em style={{ color: COSMIC, fontStyle: "normal", fontWeight: 800 }}>Reroll</em> flow and count toward tier-find quests like &quot;Find 200+ Common pins&quot;. Collecting isn&apos;t wasted.
            </Callout>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Collector ladder.
   ──────────────────────────────────────────────────────────────── */
function CollectorLadder() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="ladder"
                tag="Status"
                title="The Collector ladder"
                sub="Your tier is based on the percent of the catalog you have collected. It shows on your profile. Keep opening capsules to climb."
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
                                            background: `radial-gradient(circle at 20% 30%, ${COSMIC}33, transparent 55%), radial-gradient(circle at 80% 75%, ${COSMIC_LIGHT}22, transparent 55%), linear-gradient(180deg, rgba(45,14,84,0.88), rgba(21,6,48,0.95))`,
                                            border: `1px solid ${COSMIC}88`,
                                            boxShadow: `0 0 22px ${COSMIC}55`,
                                        }
                                        : {
                                            background: "rgba(12,4,24,0.78)",
                                            border: "1px solid rgba(255,255,255,0.08)",
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
                                style={{ color: isHolo ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.7)" }}
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

/* ────────────────────────────────────────────────────────────────
   SECTION: Daily Challenge.
   ──────────────────────────────────────────────────────────────── */
function DailyChallenge() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="daily"
                tag="Once a day"
                title="The Daily Challenge"
                sub="One run per day. Same board for every player, globally. Pure test of who plays the tile layout best. No luck-of-the-draw on the starting board."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <Globe size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>
                            Same board, everyone
                        </h3>
                    </div>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        The daily board is seeded by the date, so every player gets the identical starting layout. Leaderboard reflects pure skill.
                    </p>
                </Card>
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <Lock size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>
                            One shot
                        </h3>
                    </div>
                    <p className="font-mundial text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                        One attempt per day. No refreshing, no retries. Commit, and the next Daily unlocks at midnight UTC.
                    </p>
                </Card>
            </div>

            <div
                className="rounded-2xl text-center py-10 px-6 relative overflow-hidden"
                style={{
                    background: `radial-gradient(ellipse at center, ${GOLD}22, transparent 70%), linear-gradient(180deg, rgba(26,10,46,0.9), rgba(12,4,24,0.95))`,
                    border: `2px solid ${GOLD}88`,
                    boxShadow: `0 0 48px ${GOLD}44`,
                }}
            >
                <CrownBadge />
                <div className="font-display font-black uppercase text-[11px] tracking-[0.35em] mt-4" style={{ color: GOLD, opacity: 0.95 }}>
                    Daily Champion Prize
                </div>
                <div
                    className="font-display font-black leading-none mt-3"
                    style={{
                        fontSize: 44,
                        color: GOLD,
                        textShadow: `0 3px 0 rgba(0,0,0,0.55), 0 0 24px ${GOLD}66`,
                    }}
                >
                    +10 PIN CAPSULES
                </div>
                <p className="font-mundial text-[14px] mt-3 max-w-[440px] mx-auto" style={{ color: "rgba(255,255,255,0.82)" }}>
                    Finish #1 on the Daily Challenge leaderboard and the 10-capsule bonus is credited on your next session load.
                </p>
            </div>
        </section>
    );
}

/* SVG crown, matching the gold treatment of VibeMatch's champion pill. */
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
            <path
                d="M8 46 L12 20 L24 32 L32 14 L40 32 L52 20 L56 46 Z"
                fill="url(#crownGrad)"
                stroke="#6B4A0F"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <rect x="8" y="46" width="48" height="7" rx="2" fill="url(#crownGrad)" stroke="#6B4A0F" strokeWidth="1.5" />
            <circle cx="32" cy="10" r="3" fill={GOLD_LIGHT} />
        </svg>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Quests.
   ──────────────────────────────────────────────────────────────── */
function Quests({ quests }: { quests: Array<{ id: string; icon: string; title: string; description: string; capsules: number }> }) {
    return (
        <section className="mb-20">
            <SectionHeader
                id="quests"
                tag="Long-term chases"
                title="Quests"
                sub="There are 55+ quests across two tracks (Journey teaches the basics, Mastery is long-term). Every one is sticky: once unlocked, always unlocked. Each pays out bonus capsules."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quests.map(q => (
                    <div
                        key={q.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                            background: "rgba(12,4,24,0.78)",
                            border: `1px solid ${COSMIC}33`,
                        }}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `radial-gradient(circle at 35% 30%, ${COSMIC_LIGHT}44, ${COSMIC}44)`,
                                border: `1px solid ${COSMIC}77`,
                            }}
                        >
                            <QuestIcon id={q.id} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-display font-black text-[13px]" style={{ color: "#fff" }}>{q.title}</div>
                            <div className="font-mundial text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{q.description}</div>
                        </div>
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}55` }}
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
    // Map a quest id to a lucide icon with a tier-appropriate color.
    const map: Record<string, { icon: React.ReactNode; color: string }> = {
        first_combo:      { icon: <Flame size={18} />,     color: ORANGE },
        first_bomb:       { icon: <Target size={18} />,    color: "#FF3333" },
        score_25k:        { icon: <Trophy size={18} />,    color: GOLD },
        combo_8:          { icon: <Flame size={18} />,     color: ORANGE },
        all_cosmic:       { icon: <Sparkles size={18} />,  color: COSMIC },
        found_cosmic_10:  { icon: <Star size={18} />,      color: COSMIC },
        streak_7:         { icon: <Calendar size={18} />,  color: ORANGE },
        pins_69:          { icon: <Pin size={18} />,       color: COSMIC },
    };
    const m = map[id] ?? { icon: <Star size={18} />, color: COSMIC };
    return <span style={{ color: m.color }}>{m.icon}</span>;
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Rerolls.
   ──────────────────────────────────────────────────────────────── */
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
                sub="Sitting on duplicates? Burn them back into fresh Pin Capsules. Higher-rarity dupes burn more efficiently: one Cosmic dupe is enough on its own."
            />
            <Card accent={COSMIC}>
                <div className="grid gap-y-3" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b" style={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.1)" }}>Tier</div>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b" style={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.1)" }}>Dupes</div>
                    <div className="font-display font-black text-[10px] tracking-[0.25em] uppercase pb-2 border-b text-right" style={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.1)" }}>For</div>
                    {rows.map(r => {
                        const m = TIER_META[r.tier];
                        return (
                            <div key={r.tier} className="contents">
                                <div>
                                    <span
                                        className="inline-block font-display font-black text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
                                        style={{ color: m.color, border: `1px solid ${m.color}77`, background: `${m.color}18` }}
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
                Reroll <strong style={{ color: GOLD }}>never</strong> takes your last copy of a pin. You will always keep at least one of each unique pin you own.
            </Callout>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Leaderboards.
   ──────────────────────────────────────────────────────────────── */
function Leaderboards() {
    const boards = [
        { icon: <Trophy size={26} />, name: "All-Time", color: GOLD,    sub: "Your top Classic score ever. Never resets." },
        { icon: <Calendar size={26} />, name: "Weekly", color: ORANGE,  sub: "Best Classic score this week. Resets Monday 00:00 UTC." },
        { icon: <Star size={26} />,    name: "Daily",   color: "#4A9EFF", sub: "Today's Daily Challenge leaderboard. Resets nightly." },
        { icon: <Pin size={26} />,     name: "Pins",    color: COSMIC,  sub: "Top pin collectors by completion percent." },
    ];
    return (
        <section className="mb-20">
            <SectionHeader
                id="leaderboards"
                tag="Compete"
                title="Leaderboards"
                sub="Four separate rankings, each testing something different. Open the Leaders menu in-game to switch between them."
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {boards.map(b => (
                    <div
                        key={b.name}
                        className="rounded-2xl p-5 text-center"
                        style={{
                            background: `linear-gradient(180deg, ${b.color}14, rgba(12,4,24,0.92))`,
                            border: `1px solid ${b.color}66`,
                            boxShadow: `0 0 18px ${b.color}22`,
                        }}
                    >
                        <div className="flex justify-center mb-2" style={{ color: b.color }}>{b.icon}</div>
                        <h3 className="font-display font-black uppercase text-[14px] tracking-[0.15em]" style={{ color: b.color }}>
                            {b.name}
                        </h3>
                        <p className="font-mundial text-[12px] mt-1.5" style={{ color: "rgba(255,255,255,0.72)" }}>
                            {b.sub}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Streak + Referrals.
   ──────────────────────────────────────────────────────────────── */
function StreakRefer() {
    return (
        <section className="mb-20">
            <SectionHeader
                id="streak"
                tag="Show up, share"
                title="Streaks and referrals"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card accent={ORANGE}>
                    <div className="flex items-center gap-2 mb-2">
                        <Flame size={18} style={{ color: ORANGE }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>Day streaks</h3>
                    </div>
                    <p className="font-mundial text-[14px] mb-3" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Play any game mode at least once per day to keep your streak alive. Milestone quests unlock bonus capsules:
                    </p>
                    <ul className="font-mundial text-[14px] pl-5 m-0" style={{ color: "rgba(255,255,255,0.95)" }}>
                        <li className="mb-1 flex items-center gap-1.5"><strong style={{ color: ORANGE }}>3 days</strong> Streak Starter <span className="inline-flex items-center gap-0.5"><CapsuleIcon size={11} /> x2</span></li>
                        <li className="mb-1 flex items-center gap-1.5"><strong style={{ color: ORANGE }}>7 days</strong> Devoted <span className="inline-flex items-center gap-0.5"><CapsuleIcon size={11} /> x2</span></li>
                        <li className="flex items-center gap-1.5"><strong style={{ color: ORANGE }}>30 days</strong> Committed <span className="inline-flex items-center gap-0.5"><CapsuleIcon size={11} /> x3</span></li>
                    </ul>
                </Card>
                <Card accent={COSMIC}>
                    <div className="flex items-center gap-2 mb-2">
                        <HandHeart size={18} style={{ color: COSMIC }} />
                        <h3 className="font-display font-black uppercase text-[16px]" style={{ color: "#fff" }}>Referral link</h3>
                    </div>
                    <p className="font-mundial text-[14px] mb-2" style={{ color: "rgba(255,255,255,0.78)" }}>
                        Every player has a referral URL. When a new player signs up with your link:
                    </p>
                    <div className="rounded-lg px-3 py-2 mb-1.5 flex items-center gap-2" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}44` }}>
                        <CapsuleIcon size={13} /> <strong style={{ color: GOLD }}>+2</strong> <span style={{ color: "rgba(255,255,255,0.9)" }}>to you</span>
                    </div>
                    <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: `${COSMIC}14`, border: `1px solid ${COSMIC}44` }}>
                        <CapsuleIcon size={13} color={COSMIC} /> <strong style={{ color: COSMIC }}>+2</strong> <span style={{ color: "rgba(255,255,255,0.9)" }}>to them</span>
                    </div>
                    <p className="font-mundial text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Up to 50 capsules earnable from referrals per account.
                    </p>
                </Card>
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────
   SECTION: Tips.
   ──────────────────────────────────────────────────────────────── */
function Tips() {
    const tips = [
        { n: 1, title: "Look for shape setups before clearing", text: "A move that sets up a T or Cross in your next turn can be worth 3x more than a clean clear. Scan for potential intersections before you swap." },
        { n: 2, title: "Chain power tiles", text: "Swapping a Bomb next to a Laser Party (or two of anything) detonates both at once. A Cosmic Blast adjacent to anything is a guaranteed huge clear." },
        { n: 3, title: "4-matches are never wasted", text: "Every 4-match creates a Bomb. Every 5-match creates a Laser Party. Even if you are not maxing score, you are stocking power tiles." },
        { n: 4, title: "Daily Challenge is not Classic", text: "The Daily uses the same board for everyone. Study it at the start and plan a clearing order. You only get 30 moves and one attempt." },
        { n: 5, title: "Open capsules immediately", text: "Duplicates count toward tier-find quests. The sooner you open, the sooner those lifetime counters tick up." },
        { n: 6, title: "Watch the Quests rail", text: "The desktop landing shows 3 progressable quests closest to your current progress. Finishing one unlocks bonus capsules on your next game." },
    ];
    return (
        <section className="mb-20">
            <SectionHeader
                id="tips"
                tag="Get good"
                title="Tips and tricks"
            />
            <div className="flex flex-col gap-3">
                {tips.map(t => (
                    <div
                        key={t.n}
                        className="rounded-xl px-5 py-4 flex gap-4 items-start"
                        style={{
                            background: "rgba(12,4,24,0.78)",
                            border: `1px solid ${COSMIC}22`,
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
                            <div className="font-mundial text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.78)" }}>{t.text}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────
   Footer.
   ──────────────────────────────────────────────────────────────── */
function Footer() {
    return (
        <section className="text-center mt-20 pt-12" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="font-display font-black uppercase text-[10px] tracking-[0.35em] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Good Vibes Club
            </div>
            <h2 className="font-display font-black uppercase" style={{ fontSize: 34, color: GOLD, textShadow: `0 2px 0 rgba(0,0,0,0.5), 0 0 16px ${GOLD}44` }}>
                Now go play.
            </h2>
            <p className="font-mundial text-[14px] mt-2 flex items-center justify-center gap-1.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                See you on the leaderboard. <Shaka size={16} />
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
