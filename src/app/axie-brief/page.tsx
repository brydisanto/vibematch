import type { Metadata } from "next";
import Image from "next/image";
import {
    GOLD,
    GOLD_DEEP,
    PINK,
    COSMIC,
} from "@/lib/arcade-tokens";
import PartnerFloatingBadges from "@/components/PartnerFloatingBadges";

// Ink panel grounds (match /partner).
const INK_PANEL = "#180630";
const INK_PANEL_LIGHT = "#2D0B4E";
const INK_DARKEST = "#0a0418";

// Axie event accent — the same blue Pin Drop uses to tint partner-event
// surfaces (see the OpenSea event pin on /partner).
const AXIE_BLUE = "#4A9EFF";

const PIN_DROP_PLAY = "https://pindropgame.com";
const CTA_TWITTER = "https://x.com/RonnyGuy";

export const metadata: Metadata = {
    title: "Pin Drop × Axie Infinity — Creator Brief",
    description:
        "Axie Infinity moves into Pin Drop. Nine Axie pins, a grail chase, three leaderboards, and a Good Vibes Club holder board with collectible Axies on the line. Creator brief for media coverage.",
    // Not for public search — a shareable link for creators ahead of launch.
    robots: { index: false, follow: false },
    openGraph: {
        title: "Pin Drop × Axie Infinity — Creator Brief",
        description:
            "Axie Infinity moves into Pin Drop. Collect the set, chase the grail, climb three leaderboards.",
        url: "https://pindropgame.com/axie-brief",
        siteName: "Pin Drop",
        type: "website",
    },
};

export const dynamic = "force-static";

export default function AxieBriefPage() {
    return (
        <main
            className="min-h-screen w-full relative overflow-x-hidden"
            style={{
                background: `radial-gradient(ellipse at top, ${INK_PANEL_LIGHT} 0%, ${INK_PANEL} 55%, ${INK_DARKEST} 100%)`,
            }}
        >
            <PartnerFloatingBadges />
            <Starfield />

            <div className="relative z-10 max-w-[1000px] mx-auto px-5 sm:px-8 pt-10 pb-24">
                <Hero />
                <MetaBar />
                <WhatIsPinDrop />
                <HowToPlay />
                <Collection />
                <Leaderboards />
                <HolderBoard />
                <PrizePool />
                <Scale />
                <Angles />
                <Assets />
                <Footer />
            </div>

            <Animations />
        </main>
    );
}

/* ===== HERO ===== */
function Hero() {
    return (
        <section className="text-center pt-10 sm:pt-14 pb-10 sm:pb-14">
            <div
                className="inline-flex items-center px-4 py-1.5 rounded-full mb-6"
                style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}55` }}
            >
                <span
                    className="font-display font-black text-[10px] tracking-[0.32em] uppercase"
                    style={{ color: GOLD }}
                >
                    Creator Brief
                </span>
            </div>

            <div
                className="mx-auto mb-7 cursor-default"
                style={{ animation: "vmAxieBob 3.2s ease-in-out infinite", width: 300, maxWidth: "62%" }}
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

            <h1
                className="font-display font-black text-white tracking-tight leading-[0.92] text-4xl sm:text-6xl md:text-7xl mb-5"
                style={{ textShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
            >
                Pin Drop{" "}
                <span className="text-white/30 font-black">×</span>{" "}
                <span style={{ color: AXIE_BLUE, textShadow: `0 4px 16px ${AXIE_BLUE}66` }}>
                    Axie Infinity
                </span>
            </h1>

            <p className="max-w-[620px] mx-auto font-mundial text-white/70 text-base sm:text-lg leading-relaxed mb-3">
                Axie Infinity moves into Pin Drop. Match, collect the set, chase the
                grail, climb three leaderboards. A dedicated holder leaderboard puts
                collectible Axies on the line for the Good Vibes Club community.
            </p>

            <div
                className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full font-mundial text-[12px] tracking-[0.06em] text-white/55"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
                Working title
                <span className="font-display font-black tracking-[0.12em] uppercase" style={{ color: GOLD }}>
                    TBA
                </span>
            </div>
        </section>
    );
}

/* ===== META BAR ===== */
function MetaBar() {
    const items: { k: string; v: React.ReactNode }[] = [
        { k: "Format", v: "In-game event" },
        { k: "Partners", v: "GVC × Axie" },
        { k: "Dates", v: <span style={{ color: GOLD }}>TBA</span> },
        {
            k: "Play",
            v: (
                <a href={PIN_DROP_PLAY} target="_blank" rel="noopener noreferrer" style={{ color: AXIE_BLUE }}>
                    pindropgame.com
                </a>
            ),
        },
    ];
    return (
        <div
            className="grid grid-cols-2 sm:grid-cols-4 rounded-2xl overflow-hidden mb-4"
            style={{ background: "rgba(255,255,255,0.07)", gap: 1, border: `1px solid ${GOLD}22` }}
        >
            {items.map((it) => (
                <div key={it.k} className="p-4" style={{ background: "rgba(10,6,24,0.94)" }}>
                    <div className="font-display font-black text-[9px] tracking-[0.22em] uppercase text-white/40">
                        {it.k}
                    </div>
                    <div className="font-mundial font-bold text-white text-[15px] mt-1.5">{it.v}</div>
                </div>
            ))}
        </div>
    );
}

/* ===== WHAT IS PIN DROP ===== */
function WhatIsPinDrop() {
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="Background" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[760px]">
                What is Pin Drop.
            </h2>
            <div
                className="font-mundial text-white/80 leading-relaxed space-y-4 text-[15px] sm:text-base rounded-2xl p-5 sm:p-7 max-w-[820px]"
                style={{
                    background: "rgba(10,6,24,0.94)",
                    border: `1px solid ${GOLD}2a`,
                    boxShadow: "0 12px 32px -12px rgba(0,0,0,0.7)",
                }}
            >
                <p>
                    Pin Drop is a free match-three game from Good Vibes Club, playable
                    instantly in any browser on phone or desktop. Nothing to download,
                    and no wallet needed to jump in. You match tiles on a board to
                    score, and{" "}
                    <strong className="font-bold text-white">scoring earns you capsules.</strong>
                </p>
                <p>
                    Capsules are the heart of the game. Crack one open and it reveals a
                    collectible pin. Players build out a Pin Book over time, chase rare
                    pulls, and compete on global leaderboards.
                </p>
                <p className="text-white/60">
                    During a partner event, the game transforms. The board tiles, the
                    capsule pins, the background art, and the music all take on the
                    partner&apos;s world. For the run of the Axie event, that world is
                    Lunacia.
                </p>
            </div>
        </section>
    );
}

/* ===== HOW TO PLAY ===== */
function HowToPlay() {
    const steps = [
        ["Open the game", "Go to pindropgame.com and start playing. No sign-up required, though connecting an account saves your progress and pins."],
        ["Match to score", "Line up tiles on the board. Higher scores and bigger combos earn more capsules."],
        ["Open capsules", "Each capsule reveals a pin. During the event, capsules can drop Axie pins."],
        ["Collect and chase", "Fill out the rarities, complete the set, and hunt the grail."],
        ["Climb the boards", "Track your standing on the event leaderboards in real time."],
    ];
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="Getting started" />
            <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight mb-8 max-w-[760px]">
                How to play.
            </h2>
            <div className="grid gap-3 max-w-[820px]">
                {steps.map(([title, body], i) => (
                    <div
                        key={title}
                        className="flex items-start gap-4 rounded-xl p-4"
                        style={{ background: "rgba(10,6,24,0.88)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                        <div
                            className="font-display font-black text-sm shrink-0 grid place-items-center rounded-lg"
                            style={{
                                width: 40, height: 40,
                                background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                                color: "#1A0E02",
                            }}
                        >
                            {String(i + 1).padStart(2, "0")}
                        </div>
                        <div>
                            <div className="font-display font-black text-white text-base mb-0.5">{title}</div>
                            <div className="font-mundial text-white/60 text-[14px] leading-relaxed">{body}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ===== COLLECTION ===== */
function Collection() {
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="The collection" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[760px]">
                Nine Axies and a grail.
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
                <Plate
                    big="9"
                    label="Axie pins · 3 rarities"
                    body="Nine pins to collect across three rarities. Rarer pins score higher."
                    color={AXIE_BLUE}
                />
                <Plate
                    big="1"
                    label="Grail pin"
                    body="One grail to chase. Ultra rare, capsule-only, the hardest pull in the event."
                    color={GOLD}
                    featured
                />
            </div>
        </section>
    );
}

function Plate({ big, label, body, color, featured = false }: { big: string; label: string; body: string; color: string; featured?: boolean }) {
    return (
        <div
            className="rounded-2xl p-6"
            style={{
                background: featured
                    ? `linear-gradient(180deg, ${color}18, rgba(6,3,18,0.96))`
                    : "rgba(10,6,24,0.94)",
                border: `1px solid ${featured ? `${color}66` : "rgba(255,255,255,0.08)"}`,
                boxShadow: featured ? `0 12px 32px -10px ${color}33` : "0 12px 32px -14px rgba(0,0,0,0.7)",
            }}
        >
            <div className="font-display font-black text-5xl leading-none" style={{ color }}>{big}</div>
            <div className="font-display font-black text-[11px] tracking-[0.18em] uppercase text-white/45 mt-2">{label}</div>
            <p className="font-mundial text-white/70 text-[14px] leading-relaxed mt-3">{body}</p>
        </div>
    );
}

/* ===== LEADERBOARDS ===== */
function Leaderboards() {
    const boards: { idx: string; name: string; body: string; color: string }[] = [
        { idx: "Board 1", name: "Points", body: "Every pin scores, weighted by rarity. Total points rank you.", color: GOLD },
        { idx: "Board 2", name: "Sets", body: "Complete the full Axie set. Time-gated to the first 500 players to finish, so it rewards speed as much as luck.", color: AXIE_BLUE },
        { idx: "Board 3", name: "Grail Chase", body: "Ranked by the number of grail pins found.", color: PINK },
    ];
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="Three ways to win" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[760px]">
                The leaderboards.
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
                {boards.map((b) => (
                    <div
                        key={b.name}
                        className="rounded-2xl p-5 flex flex-col gap-2.5"
                        style={{
                            background: "rgba(10,6,24,0.94)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderTop: `3px solid ${b.color}`,
                        }}
                    >
                        <div className="font-display font-black text-[11px] tracking-[0.16em] uppercase" style={{ color: b.color }}>{b.idx}</div>
                        <div className="font-display font-black text-white text-lg">{b.name}</div>
                        <p className="font-mundial text-white/60 text-[13.5px] leading-relaxed">{b.body}</p>
                    </div>
                ))}
            </div>
            <div
                className="mt-4 rounded-xl p-4 font-mundial text-[14px] text-white/80"
                style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}40` }}
            >
                <strong className="font-bold" style={{ color: GOLD }}>Tiebreakers:</strong>{" "}
                across all leaderboards, ties are broken by time to goal. The player who
                reached the mark first ranks higher.
            </div>
        </section>
    );
}

/* ===== HOLDER BOARD ===== */
function HolderBoard() {
    const tiers: { rank: string; prize: string; color: string }[] = [
        { rank: "Top 10", prize: "Japanese Axie", color: GOLD },
        { rank: "Ranks 11 to 50", prize: "Nightmare Axie", color: PINK },
        { rank: "Ranks 51 to 100", prize: "Summer Axie", color: AXIE_BLUE },
    ];
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="For Good Vibes Club holders" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[760px]">
                Holder leaderboard.
            </h2>
            <div
                className="rounded-2xl p-6 sm:p-7"
                style={{ background: "rgba(10,6,24,0.94)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 16px 40px -16px rgba(0,0,0,0.7)" }}
            >
                <p className="font-mundial text-white/75 text-[15px] leading-relaxed max-w-[640px]">
                    A separate leaderboard for GVC NFT holders, scored on event play,
                    with wallet verification that supports delegate wallets. The top 100
                    holders win collectible Axies.
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mt-6">
                    {tiers.map((t) => (
                        <div
                            key={t.rank}
                            className="rounded-xl p-4"
                            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${t.color}44` }}
                        >
                            <div className="font-display font-black text-[10px] tracking-[0.14em] uppercase text-white/45">{t.rank}</div>
                            <div className="font-display font-black text-lg mt-2" style={{ color: t.color }}>{t.prize}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ===== PRIZE POOL ===== */
function PrizePool() {
    const prizes: { big: string; title: string; sub: string; color: string }[] = [
        { big: "1", title: "Good Vibes Club NFT", sub: "The grand prize.", color: GOLD },
        { big: "◆", title: "$VIBESTR", sub: "The Good Vibes Club ecosystem token.", color: COSMIC },
        { big: "5K+", title: "Limited edition Axie accessories", sub: "Inspired by Good Vibes Club.", color: PINK },
        { big: "100", title: "Collectible Axies", sub: "Reserved for GVC holders. Japanese, Nightmare, and Summer, per the holder leaderboard.", color: AXIE_BLUE },
    ];
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="What is on the line" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[760px]">
                Prize pool.
            </h2>
            <div
                className="rounded-2xl p-6 sm:p-7"
                style={{
                    background: `radial-gradient(120% 130% at 100% 0%, ${GOLD}1f, transparent 58%), rgba(10,6,24,0.96)`,
                    border: `1px solid ${GOLD}55`,
                    boxShadow: `0 16px 44px -18px ${GOLD}30`,
                }}
            >
                <div className="grid sm:grid-cols-2 gap-3">
                    {prizes.map((p) => (
                        <div
                            key={p.title}
                            className="flex items-start gap-4 rounded-xl p-4"
                            style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                            <div className="font-display font-black text-3xl leading-none shrink-0" style={{ color: p.color, minWidth: "2.6ch" }}>{p.big}</div>
                            <div>
                                <div className="font-display font-black text-white text-[15px] leading-snug">{p.title}</div>
                                <div className="font-mundial text-white/55 text-[13px] mt-1 leading-relaxed">{p.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="font-display font-black text-[10px] tracking-[0.2em] uppercase text-white/40 mt-5">
                    Full prize pool and allocations to be confirmed ahead of launch.
                </p>
            </div>
        </section>
    );
}

/* ===== SCALE ===== */
function Scale() {
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="Scale" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[760px]">
                The biggest Pin Drop event yet.
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                <div className="font-display font-black leading-[0.85] text-6xl sm:text-8xl tabular-nums" style={{ color: AXIE_BLUE, textShadow: `0 6px 22px ${AXIE_BLUE}44` }}>
                    3,000+
                </div>
                <p className="font-mundial text-white/70 text-[15px] leading-relaxed max-w-[380px]">
                    Incoming players projected by the Axie team, on top of the existing
                    Pin Drop base. The largest audience a Pin Drop event has drawn to
                    date.
                </p>
            </div>
        </section>
    );
}

/* ===== ANGLES ===== */
function Angles() {
    const angles = [
        "A free, instant, browser-based on-ramp that brings the Axie audience and the GVC community into the same arena.",
        "A deep prize pool spanning a grand-prize GVC NFT, thousands of GVC-inspired Axie accessories, and collectible Axies for holders.",
        "The 500-player set race as a launch-day storyline, early and fast.",
    ];
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="For coverage" />
            <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight mb-7 max-w-[760px]">
                Angles.
            </h2>
            <div className="grid gap-3 max-w-[820px]">
                {angles.map((a) => (
                    <div key={a} className="flex items-start gap-3 font-mundial text-white/80 text-[15px] leading-relaxed">
                        <span className="font-display font-black shrink-0" style={{ color: GOLD }}>→</span>
                        <span>{a}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ===== ASSETS & LOGISTICS ===== */
function Assets() {
    const rows: [string, string][] = [
        ["Key art, pin renders, board footage, logo lockups", "Link TBA"],
        ["Press and partnership contact", "TBA"],
        ["Embargo and go-live time", "TBA"],
    ];
    return (
        <section className="py-12 sm:py-14">
            <SectionEyebrow label="Assets and logistics" />
            <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight mb-7 max-w-[760px]">
                What you get.
            </h2>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                {rows.map(([k, v], i) => (
                    <div
                        key={k}
                        className="flex items-center justify-between gap-4 flex-wrap p-4"
                        style={{ background: "rgba(10,6,24,0.9)", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <span className="font-mundial text-white/70 text-[14px]">{k}</span>
                        <span className="font-display font-black text-[11px] tracking-[0.14em] uppercase" style={{ color: GOLD }}>{v}</span>
                    </div>
                ))}
            </div>
            <div className="mt-8 text-center">
                <a
                    href={CTA_TWITTER}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-display font-black text-sm tracking-[0.22em] uppercase transition-transform hover:-translate-y-[2px]"
                    style={{
                        background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                        color: "#1A0E02",
                        boxShadow: `0 4px 0 ${GOLD_DEEP}, 0 8px 22px rgba(0,0,0,0.45)`,
                        textShadow: "0 1px 0 rgba(255,255,255,0.25)",
                    }}
                >
                    Cover this event →
                </a>
            </div>
        </section>
    );
}

/* ===== SHARED (matches /partner) ===== */
function SectionEyebrow({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />
            <span className="font-display font-black text-[10px] tracking-[0.32em] uppercase" style={{ color: GOLD }}>
                {label}
            </span>
        </div>
    );
}

function Footer() {
    return (
        <footer className="pt-12 mt-12 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 text-center sm:text-left">
            <div className="font-mundial text-white/40 text-[11px] tracking-[0.18em] uppercase flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span>© 2026 Pin Drop</span>
                <span className="hidden sm:inline text-white/20">·</span>
                <span>Pin Drop × Axie Infinity · Creator Brief</span>
            </div>
            <div className="font-mundial text-white/40 text-[11px] tracking-[0.18em] uppercase">
                A game from{" "}
                <a href="https://x.com/goodvibesclub" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white" style={{ color: GOLD }}>
                    Good Vibes Club
                </a>
            </div>
        </footer>
    );
}

function Starfield() {
    const stars = Array.from({ length: 50 }, (_, i) => {
        const seed = i * 137;
        return {
            x: (seed * 17) % 100,
            y: (seed * 31) % 100,
            size: 1 + ((seed * 7) % 3),
            delay: (seed % 50) / 10,
            dur: 3 + ((seed * 11) % 30) / 10,
        };
    });
    return (
        <div className="pointer-events-none fixed inset-0 z-0">
            {stars.map((s, i) => (
                <span
                    key={i}
                    className="absolute rounded-full bg-white"
                    style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: s.size,
                        height: s.size,
                        opacity: 0.3,
                        animation: `vmAxieTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function Animations() {
    return (
        <style>{`
            @keyframes vmAxieTwinkle {
                0%, 100% { opacity: 0.22; transform: scale(1); }
                50%      { opacity: 0.8; transform: scale(1.3); }
            }
            @keyframes vmAxieBob {
                0%, 100% { transform: translateY(0); }
                50%      { transform: translateY(-6px); }
            }
        `}</style>
    );
}
