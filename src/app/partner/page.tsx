import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
    GOLD,
    GOLD_DEEP,
    ORANGE,
    COSMIC,
    PINK,
    INK_PANEL,
    INK_PANEL_LIGHT,
    INK_DARKEST,
} from "@/lib/arcade-tokens";

export const metadata: Metadata = {
    title: "Partner with Pin Drop",
    description:
        "Bring your community into Pin Drop — a match-3 puzzle game with a pin-collection meta. Custom pins, custom leaderboards, live events for your holders.",
    openGraph: {
        title: "Partner with Pin Drop",
        description:
            "Bring your community into Pin Drop — a match-3 puzzle game with a pin-collection meta.",
        url: "https://pindropgame.com/partner",
        siteName: "Pin Drop",
        images: [{ url: "https://pindropgame.com/badges/promo/opensea.webp" }],
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Partner with Pin Drop",
        description:
            "Bring your community into Pin Drop. Custom pins, custom leaderboards, live events.",
        images: ["https://pindropgame.com/badges/promo/opensea.webp"],
    },
};

const CTA_TWITTER = "https://x.com/brydisanto";
const PIN_DROP_PLAY = "https://pindropgame.com";

export default function PartnerPage() {
    return (
        <main
            className="min-h-screen w-full relative overflow-x-hidden"
            style={{
                background: `radial-gradient(ellipse at top, ${INK_PANEL_LIGHT} 0%, ${INK_PANEL} 55%, ${INK_DARKEST} 100%)`,
            }}
        >
            <Starfield />

            <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 pt-8 pb-24">
                <TopBar />
                <Hero />
                <WhatIsPinDrop />
                <CoreLoop />
                <Insertions />
                <CaseStudy />
                <FinalCTA />
                <Footer />
            </div>

            <Animations />
        </main>
    );
}

function TopBar() {
    return (
        <div className="flex items-center justify-between mb-16 sm:mb-24">
            <Link
                href="/"
                className="flex items-center gap-2 font-display font-black text-[12px] tracking-[0.28em] uppercase text-white/60 hover:text-white transition-colors"
            >
                <Image
                    src="/assets/gvc_shaka.png"
                    alt=""
                    width={28}
                    height={28}
                    className="object-contain"
                />
                Pin Drop
            </Link>
            <a
                href={CTA_TWITTER}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display font-black text-[11px] tracking-[0.28em] uppercase transition-colors"
                style={{ color: GOLD }}
            >
                DM us →
            </a>
        </div>
    );
}

function Hero() {
    return (
        <section className="text-center pt-6 pb-16 sm:pb-24">
            <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
                style={{
                    background: `${GOLD}12`,
                    border: `1px solid ${GOLD}55`,
                }}
            >
                <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}` }}
                />
                <span
                    className="font-display font-black text-[10px] tracking-[0.32em] uppercase"
                    style={{ color: GOLD }}
                >
                    Partnerships
                </span>
            </div>
            <h1
                className="font-display font-black text-white tracking-tight leading-[0.95] text-4xl sm:text-6xl md:text-7xl mb-5"
                style={{ textShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
            >
                Bring your community
                <br />
                <span style={{ color: GOLD, textShadow: `0 4px 14px ${GOLD}55` }}>
                    into Pin Drop.
                </span>
            </h1>
            <p className="max-w-[640px] mx-auto font-mundial text-white/65 text-base sm:text-lg leading-relaxed mb-8">
                A custom co-designed pin, a live leaderboard for your holders, a permanent
                spot in every player&apos;s trophy case. Run a partnership event with us
                inside a game people already play every day.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                    href={CTA_TWITTER}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-7 py-4 rounded-xl font-display font-black text-sm tracking-[0.22em] uppercase transition-transform hover:-translate-y-[2px]"
                    style={{
                        background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                        color: "#1A0E02",
                        boxShadow: `0 3px 0 ${GOLD_DEEP}, 0 6px 18px rgba(0,0,0,0.45)`,
                        textShadow: "0 1px 0 rgba(255,255,255,0.25)",
                    }}
                >
                    Start a Conversation →
                </a>
                <a
                    href={PIN_DROP_PLAY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-4 rounded-xl font-display font-black text-sm tracking-[0.22em] uppercase transition-colors"
                    style={{
                        color: "#fff",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.12)",
                    }}
                >
                    Try the Game
                </a>
            </div>
        </section>
    );
}

function WhatIsPinDrop() {
    return (
        <section className="py-12 sm:py-16">
            <SectionEyebrow label="What is Pin Drop" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-6 max-w-[820px]">
                A match-3 puzzle game with a pin-collection meta.
            </h2>
            <div className="grid md:grid-cols-2 gap-10 items-center">
                <div className="font-mundial text-white/65 leading-relaxed space-y-4 text-[15px] sm:text-base">
                    <p>
                        Players match tiles to score. Big scores award pin capsules.
                        Cracking a capsule drops one of 100+ collectible pins, each with
                        a rarity tier — Common, Rare, Strategic, Legendary, Cosmic, and
                        the ultra-rare One-Of-One.
                    </p>
                    <p>
                        The hook isn&apos;t the matching. It&apos;s the pin-book — a
                        growing collection that players check in on every single day,
                        race up the leaderboards with, and trade duplicates for new
                        capsules. The match-3 is the engine. The pins are the soul.
                    </p>
                    <p>
                        We launched in early 2026 and the community is built around{" "}
                        <a
                            href="https://opensea.io/collection/good-vibes-club"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-dotted underline-offset-4"
                            style={{ color: GOLD }}
                        >
                            Good Vibes Club
                        </a>
                        , an NFT collection on Ethereum that&apos;s been online since
                        2021. The players show up daily.
                    </p>
                </div>
                <div className="relative">
                    <div
                        className="rounded-2xl p-4 sm:p-6"
                        style={{
                            background:
                                "linear-gradient(180deg, rgba(255,224,72,0.08), rgba(0,0,0,0.4))",
                            border: `1px solid ${GOLD}33`,
                            boxShadow: `0 12px 32px -10px ${GOLD}33`,
                        }}
                    >
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                {
                                    image: "/badges/promo/opensea.webp",
                                    tier: "Event",
                                    color: COSMIC,
                                    label: "Aye Aye, Captain!",
                                },
                                {
                                    image: "/badges/cosmic_guardian1759173818340.webp",
                                    tier: "Cosmic",
                                    color: COSMIC,
                                    label: "Cosmic Guardian",
                                },
                                {
                                    image: "/badges/gold_member_1759173793799.webp",
                                    tier: "Legendary",
                                    color: GOLD,
                                    label: "Gold Member",
                                },
                                {
                                    image: "/badges/highkeymoments_1_1771433768524.webp",
                                    tier: "Legendary",
                                    color: GOLD,
                                    label: "Highkey Moments",
                                },
                                {
                                    image: "/badges/any_gvc_1759173799963.webp",
                                    tier: "Common",
                                    color: "#E0E0E0",
                                    label: "Citizen of Vibetown",
                                },
                                {
                                    image: "/badges/full_send_maverick_1759173982959.webp",
                                    tier: "Legendary",
                                    color: GOLD,
                                    label: "Full Send Maverick",
                                },
                            ].map((pin) => (
                                <PinTile key={pin.label} {...pin} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function PinTile({
    image,
    tier,
    color,
    label,
}: {
    image: string;
    tier: string;
    color: string;
    label: string;
}) {
    return (
        <div
            className="rounded-xl p-3 flex flex-col items-center text-center"
            style={{
                background: `linear-gradient(135deg, ${color}15, ${color}06)`,
                border: `1.5px solid ${color}40`,
                boxShadow: `0 0 10px ${color}33`,
            }}
        >
            <div className="relative aspect-square w-full mb-2">
                <Image
                    src={image}
                    alt={label}
                    fill
                    sizes="120px"
                    className="object-contain"
                    unoptimized
                />
            </div>
            <div
                className="font-mundial text-[8px] tracking-[0.22em] uppercase mb-0.5"
                style={{ color }}
            >
                {tier}
            </div>
            <div className="font-display font-black text-[10px] text-white leading-tight line-clamp-2">
                {label}
            </div>
        </div>
    );
}

function CoreLoop() {
    const steps = [
        {
            n: 1,
            label: "Score",
            body: "Players match tiles in Classic, Daily, or Frenzy modes.",
            color: GOLD,
        },
        {
            n: 2,
            label: "Win Capsules",
            body: "High scores award sealed pin capsules.",
            color: ORANGE,
        },
        {
            n: 3,
            label: "Rip Them Open",
            body: "Cracking a capsule reveals a random pin from the catalog.",
            color: PINK,
        },
        {
            n: 4,
            label: "Collect + Climb",
            body: "Build the pin book. Climb leaderboards. Earn tier upgrades.",
            color: COSMIC,
        },
    ];
    return (
        <section className="py-12 sm:py-16">
            <SectionEyebrow label="Core Loop" />
            <h2 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight mb-10 max-w-[820px]">
                The same loop that keeps trading-card collectors hooked, in your
                browser.
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {steps.map((step) => (
                    <div
                        key={step.n}
                        className="rounded-xl p-5 relative overflow-hidden"
                        style={{
                            background: `linear-gradient(180deg, ${step.color}10, rgba(0,0,0,0.25))`,
                            border: `1px solid ${step.color}33`,
                        }}
                    >
                        <div
                            className="font-display font-black text-5xl leading-none mb-3"
                            style={{ color: step.color, textShadow: `0 0 18px ${step.color}55` }}
                        >
                            {step.n}
                        </div>
                        <div
                            className="font-display font-black text-sm tracking-[0.18em] uppercase mb-1.5"
                            style={{ color: step.color }}
                        >
                            {step.label}
                        </div>
                        <div className="font-mundial text-white/55 text-[12px] leading-relaxed">
                            {step.body}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Insertions() {
    const items = [
        {
            n: 1,
            title: "Custom Co-Designed Pin",
            body: "We co-design a hero pin with your team to live as a real game asset. It appears as a board tile players can match + as a floating background element on the home screen. The pin embodies your brand inside the gameplay loop.",
            example: "OpenSea's “Aye Aye, Captain!” pin",
            image: "/badges/promo/opensea.webp",
        },
        {
            n: 2,
            title: "Permanent Spot in Player Trophy Cases",
            body: "Your pin drops from capsules during the event and is collected by players forever. Every player who finds one gets a permanent badge in their public profile's Trophy Case — a memento that lives on long after the event ends.",
            example: "Every Aye Aye, Captain! collector keeps their pin",
            image: "/badges/promo/opensea.webp",
        },
        {
            n: 3,
            title: "Custom Event Leaderboard + Prizes",
            body: "A live leaderboard ranks the top collectors of your custom pin during the event window. You supply the prize pool — NFTs, allowlist slots, cash, merch, your call. Top finders earn real rewards from your community.",
            example: "OpenSea contributed prizes for top Aye Aye finders",
            image: "/badges/promo/opensea.webp",
        },
        {
            n: 4,
            title: "Custom Board Background",
            body: "The match-3 board carries a co-designed background skin during the event so every game session is visually branded with your community's identity.",
            example: "OpenSea-themed board during the live event",
            image: "/assets/logo.png",
        },
        {
            n: 5,
            title: "Custom Logo Treatment",
            body: "Your logo locks up with the Pin Drop wordmark above the board during the event — a permanent co-brand visible on every screenshot, every share, every minute of gameplay.",
            example: "Pin Drop × OpenSea wordmark in the header",
            image: "/assets/logo.png",
        },
    ];
    return (
        <section className="py-16 sm:py-24">
            <SectionEyebrow label="The Surface Area" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-3 max-w-[820px]">
                Five ways your community lives inside Pin Drop.
            </h2>
            <p className="font-mundial text-white/55 text-sm sm:text-base max-w-[680px] mb-12">
                Every partnership uses the same five insertion points — we shape them
                to your event. Below: how OpenSea did it for their launch event with us.
            </p>
            <div className="space-y-4">
                {items.map((item) => (
                    <InsertionRow key={item.n} {...item} />
                ))}
            </div>
        </section>
    );
}

function InsertionRow({
    n,
    title,
    body,
    example,
    image,
}: {
    n: number;
    title: string;
    body: string;
    example: string;
    image: string;
}) {
    return (
        <div
            className="rounded-2xl p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[auto_1fr_160px] gap-5 sm:gap-7 items-start"
            style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${GOLD}1a`,
            }}
        >
            <div
                className="font-display font-black text-4xl sm:text-6xl leading-none shrink-0"
                style={{ color: GOLD, textShadow: `0 0 18px ${GOLD}40` }}
            >
                {String(n).padStart(2, "0")}
            </div>
            <div>
                <h3 className="font-display font-black text-white text-xl sm:text-2xl mb-2 tracking-tight">
                    {title}
                </h3>
                <p className="font-mundial text-white/60 text-[14px] sm:text-[15px] leading-relaxed mb-3">
                    {body}
                </p>
                <div className="flex items-center gap-2 mt-3">
                    <span
                        className="font-mundial font-bold text-[9px] tracking-[0.22em] uppercase px-2 py-1 rounded"
                        style={{
                            color: COSMIC,
                            background: `${COSMIC}15`,
                            border: `1px solid ${COSMIC}40`,
                        }}
                    >
                        Example
                    </span>
                    <span className="font-mundial text-white/70 text-[13px]">
                        {example}
                    </span>
                </div>
            </div>
            <div className="hidden sm:flex items-center justify-center">
                <div
                    className="relative w-[140px] h-[140px] rounded-xl p-3 flex items-center justify-center"
                    style={{
                        background: "linear-gradient(180deg, rgba(179,102,255,0.08), rgba(0,0,0,0.2))",
                        border: `1px solid ${COSMIC}33`,
                    }}
                >
                    <Image
                        src={image}
                        alt=""
                        width={120}
                        height={120}
                        className="object-contain"
                        unoptimized
                    />
                </div>
            </div>
        </div>
    );
}

function CaseStudy() {
    return (
        <section className="py-12 sm:py-16">
            <SectionEyebrow label="Case Study" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-10 max-w-[820px]">
                OpenSea × Pin Drop
            </h2>
            <div
                className="rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr]"
                style={{
                    background:
                        "linear-gradient(135deg, rgba(74,158,255,0.18), rgba(0,0,0,0.4))",
                    border: "1.5px solid rgba(74,158,255,0.45)",
                    boxShadow: "0 0 32px rgba(74,158,255,0.18)",
                }}
            >
                <div
                    className="flex items-center justify-center p-8 sm:p-10"
                    style={{
                        background:
                            "radial-gradient(circle at 50% 50%, rgba(74,158,255,0.22), transparent 65%)",
                    }}
                >
                    <Image
                        src="/badges/promo/opensea.webp"
                        alt="Aye Aye, Captain!"
                        width={200}
                        height={200}
                        className="object-contain"
                        unoptimized
                        style={{
                            filter: "drop-shadow(0 4px 18px rgba(74,158,255,0.55))",
                        }}
                    />
                </div>
                <div className="p-6 sm:p-8 flex flex-col justify-center gap-4">
                    <div className="font-mundial text-[10px] tracking-[0.22em] uppercase text-white/45">
                        Launch Event · 2026
                    </div>
                    <h3 className="font-display font-black text-white text-2xl sm:text-3xl tracking-tight">
                        “Aye Aye, Captain!” — the OpenSea community pin
                    </h3>
                    <p className="font-mundial text-white/60 text-[14px] sm:text-[15px] leading-relaxed">
                        OpenSea co-designed a hero pin with us for their on-platform
                        launch event. It dropped from capsules during the event window,
                        appeared on the game board as a matchable tile, lived as a
                        floating background element on the home screen, and gave every
                        collector a permanent slot in their Trophy Case. OpenSea
                        contributed prizes for the top of the event leaderboard.
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <CaseStat n="100+" label="Pins minted to players" />
                        <CaseStat n="5" label="Days of partnership coverage" />
                        <CaseStat n="∞" label="Pins kept by collectors forever" />
                    </div>
                </div>
            </div>
        </section>
    );
}

function CaseStat({ n, label }: { n: string; label: string }) {
    return (
        <div>
            <div
                className="font-display font-black text-2xl sm:text-3xl"
                style={{ color: "#4A9EFF" }}
            >
                {n}
            </div>
            <div className="font-mundial text-[10px] tracking-[0.18em] uppercase text-white/45 mt-1 leading-tight">
                {label}
            </div>
        </div>
    );
}

function FinalCTA() {
    return (
        <section className="py-16 sm:py-24 text-center">
            <h2 className="font-display font-black text-white text-4xl sm:text-6xl tracking-tight mb-5 leading-[0.95]">
                Let&apos;s build
                <br />
                <span style={{ color: GOLD, textShadow: `0 4px 14px ${GOLD}55` }}>
                    something together.
                </span>
            </h2>
            <p className="font-mundial text-white/60 max-w-[560px] mx-auto text-base sm:text-lg leading-relaxed mb-9">
                Tell us about your community, your event window, and what you&apos;d
                like the prize pool to look like. We&apos;ll draft a partnership shape
                in 48 hours.
            </p>
            <a
                href={CTA_TWITTER}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-9 py-5 rounded-xl font-display font-black text-base tracking-[0.22em] uppercase transition-transform hover:-translate-y-[2px]"
                style={{
                    background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                    color: "#1A0E02",
                    boxShadow: `0 4px 0 ${GOLD_DEEP}, 0 8px 22px rgba(0,0,0,0.45)`,
                    textShadow: "0 1px 0 rgba(255,255,255,0.25)",
                }}
            >
                DM @brydisanto on X →
            </a>
        </section>
    );
}

function Footer() {
    return (
        <footer className="pt-12 mt-12 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
            <div className="font-mundial text-white/35 text-[11px] tracking-[0.18em] uppercase">
                Pin Drop · A Good Vibes Club joint
            </div>
            <div className="flex items-center gap-6 font-mundial text-[11px] tracking-[0.18em] uppercase">
                <a
                    href={PIN_DROP_PLAY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/40 hover:text-white transition-colors"
                >
                    pindropgame.com
                </a>
                <a
                    href={CTA_TWITTER}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors"
                    style={{ color: GOLD }}
                >
                    @brydisanto
                </a>
            </div>
        </footer>
    );
}

function SectionEyebrow({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }}
            />
            <span
                className="font-display font-black text-[10px] tracking-[0.32em] uppercase"
                style={{ color: GOLD }}
            >
                {label}
            </span>
        </div>
    );
}

function Starfield() {
    // Static deterministic starfield (server-rendered) — matches the
    // /game-guide + /u/[username] ambient backdrop. Deterministic offsets
    // so the page is fully SSR-safe with no hydration mismatch.
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
                        animation: `vmPartnerTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function Animations() {
    return (
        <style>{`
            @keyframes vmPartnerTwinkle {
                0%, 100% { opacity: 0.22; transform: scale(1); }
                50%      { opacity: 0.8; transform: scale(1.3); }
            }
        `}</style>
    );
}

export const dynamic = "force-static";
