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
import PartnerFloatingBadges from "@/components/PartnerFloatingBadges";

export const metadata: Metadata = {
    title: "Partner with Pin Drop",
    description:
        "Bring your community into Pin Drop, a match-3 puzzle game with a pin-collection meta. Custom pins, custom leaderboards, live events for your holders.",
    openGraph: {
        title: "Partner with Pin Drop",
        description:
            "Bring your community into Pin Drop, a match-3 puzzle game with a pin-collection meta.",
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

const CTA_TWITTER = "https://x.com/RonnyGuy";
const PIN_DROP_PLAY = "https://pindropgame.com";

export default function PartnerPage() {
    return (
        <main
            className="min-h-screen w-full relative overflow-x-hidden"
            style={{
                background: `radial-gradient(ellipse at top, ${INK_PANEL_LIGHT} 0%, ${INK_PANEL} 55%, ${INK_DARKEST} 100%)`,
            }}
        >
            <PartnerFloatingBadges />
            <Starfield />

            <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 pt-10 pb-24">
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

function Hero() {
    return (
        <section className="text-center pt-12 sm:pt-16 pb-16 sm:pb-24">
            <div
                className="inline-flex items-center px-4 py-1.5 rounded-full mb-5"
                style={{
                    background: `${GOLD}12`,
                    border: `1px solid ${GOLD}55`,
                }}
            >
                <span
                    className="font-display font-black text-[10px] tracking-[0.32em] uppercase"
                    style={{ color: GOLD }}
                >
                    Partnerships
                </span>
            </div>
            <div
                className="mx-auto mb-6 cursor-default"
                style={{
                    animation: "vmPartnerBob 3.2s ease-in-out infinite",
                    width: 360,
                    maxWidth: "75%",
                }}
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
                    href={PIN_DROP_PLAY}
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
                    Try the Game →
                </a>
                <a
                    href={CTA_TWITTER}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-4 rounded-xl font-display font-black text-sm tracking-[0.22em] uppercase transition-colors"
                    style={{
                        color: "#fff",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.12)",
                    }}
                >
                    Message Us
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
                        Pin Drop is a casual puzzle game where players match Pin
                        tiles to score points.{" "}
                        <strong className="font-bold text-white">
                            Big scores award Pin Capsules.
                        </strong>{" "}
                        Cracking a capsule drops one of 100+ collectible pins across
                        six rarity tiers: Common, Rare, Strategic, Legendary, Cosmic,
                        and the ultra-rare One-Of-One. &ldquo;Event&rdquo; pins get
                        added to the mix when partners join.
                    </p>
                    <p>
                        Three game modes exist: Classic (30 turns), Frenzy
                        (60 seconds), and the Daily Challenge (1 try per day, same
                        board for everyone).
                    </p>
                    <p>
                        The Pin Book is the core meta game. It&apos;s an
                        ever-growing collection that players work towards completing,
                        and serves as the foundation for custom leaderboards and
                        special events.
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
                                    color: "#4A9EFF",
                                    label: "Aye Aye, Captain!",
                                    featured: true,
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
    featured = false,
}: {
    image: string;
    tier: string;
    color: string;
    label: string;
    /** When true, the tile is rendered as the OpenSea event partner ,
     *  brighter accent fill + a "PARTNER PIN" ribbon, with a soft
     *  breathing glow to draw the eye in a grid of similar tiles. */
    featured?: boolean;
}) {
    return (
        <div
            className={`relative rounded-xl p-3 flex flex-col items-center text-center ${
                featured ? "partner-featured" : ""
            }`}
            style={{
                background: featured
                    ? `linear-gradient(135deg, ${color}33, ${color}10)`
                    : `linear-gradient(135deg, ${color}15, ${color}06)`,
                border: featured
                    ? `2px solid ${color}cc`
                    : `1.5px solid ${color}40`,
                boxShadow: featured
                    ? `0 0 22px ${color}66, 0 0 40px ${color}33, inset 0 0 14px ${color}22`
                    : `0 0 10px ${color}33`,
            }}
        >
            {featured && (
                <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-display font-black uppercase whitespace-nowrap z-10"
                    style={{
                        fontSize: 8,
                        letterSpacing: "0.22em",
                        background: color,
                        color: "#0A0418",
                        boxShadow: `0 2px 6px ${color}55`,
                    }}
                >
                    Partner Pin
                </div>
            )}
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
            <div
                className={`font-display font-black text-[10px] leading-tight line-clamp-2 ${
                    featured ? "text-white" : "text-white"
                }`}
                style={featured ? { textShadow: `0 0 8px ${color}66` } : undefined}
            >
                {label}
            </div>
        </div>
    );
}

function CoreLoop() {
    const steps = [
        {
            n: 1,
            label: "Score Big",
            body: "Players match pin tiles in Classic, Daily, or Frenzy modes.",
            color: GOLD,
        },
        {
            n: 2,
            label: "Win Capsules",
            body: "High scores award sealed Pin Capsules. Higher scores = win more capsules.",
            color: ORANGE,
        },
        {
            n: 3,
            label: "Rip 'Em Open",
            body: "Each capsule reveals a random pin from the catalog. Event pins are inserted as potential pulls.",
            color: PINK,
        },
        {
            n: 4,
            label: "Collect & Climb",
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
    const items: InsertionItem[] = [
        {
            n: 1,
            title: "Custom Co-Designed Pin",
            body: "We co-design a hero pin with your team that lives as a playable game asset. It appears as a board tile players can match and as a floating background element on the home screen. The pin embodies your brand inside the gameplay loop.",
            example: "OpenSea's “Aye Aye, Captain!” pin",
            preview: "pin",
        },
        {
            n: 2,
            title: "Special Event Insert",
            body: "Your custom pin enters the global Pin Capsule pool for the duration of your event window. Every capsule players rip carries a chance at your pin as a limited-time find, complete with an EVENT chip and a branded New Pin Collected celebration moment.",
            example: "Aye Aye, Captain! dropped from capsules during the OpenSea window",
            preview: "capsulePull",
        },
        {
            n: 3,
            title: "Custom Event Leaderboard + Prizes",
            body: "A live leaderboard ranks the top collectors of your custom pin during the event window. You supply the prize pool: NFTs, allowlist slots, cash, merch, your call. Top finders earn real rewards from your community.",
            example: "OpenSea contributed NFT prizes for top “Aye Aye, Captain!” pin finders",
            preview: "leaderboard",
        },
        {
            n: 4,
            title: "Permanent Spot in Player Trophy Cases",
            body: "Your pin drops from capsules during the event and is collected by players. Every player who finds one gets a permanent badge in their public profile's Trophy Case that flexes their rank and accumulation.",
            preview: "trophy",
        },
        {
            n: 5,
            title: "Custom Board Background",
            body: "The entire game scene carries a co-designed background skin during the event so every session is visually wrapped in your community's identity. Skyline, palette, ambient details, all tuned to your brand.",
            example: "OpenSea-themed board scene during the live event",
            preview: "board",
        },
        {
            n: 6,
            title: "Custom Logo Treatment",
            body: "Your logo locks up with the Pin Drop wordmark above the board during the event, a permanent co-brand visible on every screenshot, every share, every minute of gameplay.",
            example: "Pin Drop × OpenSea wordmark in the header",
            preview: "logo",
        },
    ];
    return (
        <section className="py-16 sm:py-24">
            <SectionEyebrow label="The Surface Area" />
            <h2 className="font-display font-black text-white text-3xl sm:text-5xl tracking-tight mb-3 max-w-[820px]">
                Six ways your community can live inside Pin Drop.
            </h2>
            <p className="font-mundial text-white/55 text-sm sm:text-base max-w-[760px] mb-12">
                Every partnership can leverage six placements. We shape them to your
                brand and event. See below for examples of how OpenSea did it for
                their launch event with us.
            </p>
            <div className="space-y-4">
                {items.map((item) => (
                    <InsertionRow key={item.n} {...item} />
                ))}
            </div>
        </section>
    );
}

type PreviewType = "pin" | "capsulePull" | "leaderboard" | "trophy" | "board" | "logo";

type InsertionItem = {
    n: number;
    title: string;
    body: string;
    example?: string;
    preview: PreviewType;
};

function InsertionRow({
    n,
    title,
    body,
    example,
    preview,
}: InsertionItem) {
    return (
        <div
            className="rounded-2xl p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[auto_1fr_200px] gap-5 sm:gap-7 items-start"
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
                {example && (
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
                )}
            </div>
            <div className="hidden sm:flex items-center justify-center">
                <InsertionPreview type={preview} />
            </div>
        </div>
    );
}

function InsertionPreview({ type }: { type: PreviewType }) {
    switch (type) {
        case "pin":
            return <PinPreview />;
        case "capsulePull":
            return <CapsulePullPreview />;
        case "leaderboard":
            return <LeaderboardPreview />;
        case "trophy":
            return <TrophyCasePreview />;
        case "board":
            return <BoardPreview />;
        case "logo":
            return <LogoLockupPreview />;
    }
}

const OS_BLUE = "#4A9EFF";
const CAPSULE_GREEN = "#5FD66A";

function PreviewFrame({
    children,
    accent = OS_BLUE,
    pad = true,
}: {
    children: React.ReactNode;
    accent?: string;
    pad?: boolean;
}) {
    return (
        <div
            className={`relative w-[180px] h-[180px] rounded-xl ${pad ? "p-3" : ""} flex items-center justify-center overflow-hidden`}
            style={{
                background: `linear-gradient(180deg, ${accent}14, rgba(0,0,0,0.5))`,
                border: `1px solid ${accent}44`,
                boxShadow: `0 0 18px -6px ${accent}55`,
            }}
        >
            {children}
        </div>
    );
}

function PinPreview() {
    return (
        <PreviewFrame>
            <Image
                src="/badges/promo/opensea.webp"
                alt=""
                width={150}
                height={150}
                className="object-contain"
                unoptimized
                style={{ filter: `drop-shadow(0 6px 18px ${OS_BLUE}99)` }}
            />
        </PreviewFrame>
    );
}

function CapsulePullPreview() {
    return (
        <PreviewFrame pad={false}>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                <div className="relative flex items-center justify-center mb-1.5">
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="absolute rounded-full"
                            style={{
                                width: 60 + i * 20,
                                height: 60 + i * 20,
                                border: `1px solid ${OS_BLUE}${["55", "30", "18"][i]}`,
                            }}
                        />
                    ))}
                    <Image
                        src="/badges/promo/opensea.webp"
                        alt=""
                        width={56}
                        height={56}
                        className="object-contain relative z-10"
                        unoptimized
                        style={{ filter: `drop-shadow(0 0 10px ${OS_BLUE}88)` }}
                    />
                </div>
                <div
                    className="font-display font-black text-white text-[11px] leading-tight text-center mb-1"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                >
                    Aye Aye, Captain!
                </div>
                <span
                    className="font-display font-black text-[7px] tracking-[0.24em] uppercase px-2 py-[2px] rounded mb-1"
                    style={{ background: OS_BLUE, color: "#fff" }}
                >
                    Event
                </span>
                <span
                    className="font-display font-black text-[7px] tracking-[0.18em] uppercase px-2 py-[2px] rounded"
                    style={{
                        color: CAPSULE_GREEN,
                        border: `1px solid ${CAPSULE_GREEN}`,
                        textShadow: `0 0 6px ${CAPSULE_GREEN}88`,
                    }}
                >
                    New Pin Collected
                </span>
            </div>
        </PreviewFrame>
    );
}

function LeaderboardPreview() {
    const rows = [
        { rank: 1, name: "laserguy", score: "28", color: GOLD },
        { rank: 2, name: "bunya", score: "27", color: "#C9C9C9" },
        { rank: 3, name: "btdwayne", score: "27", color: "#C97D3F" },
    ];
    return (
        <PreviewFrame>
            <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="font-display font-black text-[7px] tracking-[0.18em] uppercase text-white/35">
                        Leaderboards
                    </span>
                    <span
                        className="font-display font-black text-[6px] tracking-[0.22em] uppercase px-1.5 py-[2px] rounded"
                        style={{ background: "#fff", color: "#000" }}
                    >
                        Event
                    </span>
                </div>
                <div className="flex flex-col items-center mb-1.5">
                    <Image
                        src="/badges/promo/opensea.webp"
                        alt=""
                        width={28}
                        height={28}
                        className="object-contain"
                        unoptimized
                        style={{ filter: `drop-shadow(0 2px 4px ${OS_BLUE}77)` }}
                    />
                </div>
                <div className="space-y-1">
                    {rows.map((r) => (
                        <div
                            key={r.rank}
                            className="flex items-center gap-1.5 px-1.5 py-[3px] rounded"
                            style={{
                                background: `${r.color}10`,
                                border: `1px solid ${r.color}55`,
                            }}
                        >
                            <span
                                className="font-display font-black text-[8px] w-2 text-center"
                                style={{ color: r.color }}
                            >
                                {r.rank}
                            </span>
                            <span className="font-display font-black text-white text-[8px] truncate flex-1">
                                {r.name}
                            </span>
                            <span
                                className="font-display font-black text-[8px]"
                                style={{ color: r.color }}
                            >
                                {r.score}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </PreviewFrame>
    );
}

function TrophyCasePreview() {
    return (
        <PreviewFrame>
            <div className="w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="font-display font-black text-[6px] tracking-[0.22em] uppercase text-white/35">
                        Pin Book
                    </span>
                    <span
                        className="font-display font-black text-[6px] tracking-[0.22em] uppercase pb-[2px]"
                        style={{ color: GOLD, borderBottom: `1.5px solid ${GOLD}` }}
                    >
                        Trophy Case
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <div
                        className="rounded-md p-1.5 flex flex-col items-center"
                        style={{
                            background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.3))",
                            border: "1px solid rgba(255,255,255,0.08)",
                        }}
                    >
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center mb-1"
                            style={{
                                background: `radial-gradient(circle, ${GOLD}55, transparent 70%)`,
                                border: `1.5px solid ${GOLD}`,
                            }}
                        >
                            <span
                                className="font-display font-black text-[5px] leading-none text-white text-center"
                                style={{ textShadow: `0 0 4px ${GOLD}` }}
                            >
                                PIN
                                <br />
                                DROP
                            </span>
                        </div>
                        <div
                            className="font-display font-black text-[6px] text-white leading-tight text-center"
                        >
                            Pin Drop!
                        </div>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                            <div className="text-center">
                                <div
                                    className="font-display font-black text-[8px]"
                                    style={{ color: GOLD }}
                                >
                                    101
                                </div>
                                <div className="font-mundial text-[4px] tracking-[0.18em] uppercase text-white/40">
                                    Pins
                                </div>
                            </div>
                            <div className="text-center">
                                <div
                                    className="font-display font-black text-[8px]"
                                    style={{ color: GOLD }}
                                >
                                    100%
                                </div>
                                <div className="font-mundial text-[4px] tracking-[0.18em] uppercase text-white/40">
                                    Done
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        className="rounded-md p-1.5 flex flex-col items-center"
                        style={{
                            background: `linear-gradient(135deg, ${OS_BLUE}22, rgba(0,0,0,0.3))`,
                            border: `1.5px solid ${OS_BLUE}aa`,
                            boxShadow: `0 0 10px ${OS_BLUE}44`,
                        }}
                    >
                        <Image
                            src="/badges/promo/opensea.webp"
                            alt=""
                            width={28}
                            height={28}
                            className="object-contain mb-1"
                            unoptimized
                        />
                        <div className="font-display font-black text-[6px] text-white leading-tight text-center">
                            Aye Aye, Captain!
                        </div>
                        <div
                            className="font-mundial text-[4px] tracking-[0.18em] uppercase mt-0.5"
                            style={{ color: OS_BLUE }}
                        >
                            OpenSea Event
                        </div>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                            <div className="text-center">
                                <div
                                    className="font-display font-black text-[8px]"
                                    style={{ color: OS_BLUE }}
                                >
                                    ×27
                                </div>
                                <div className="font-mundial text-[4px] tracking-[0.18em] uppercase text-white/40">
                                    Got
                                </div>
                            </div>
                            <div className="text-center">
                                <div
                                    className="font-display font-black text-[8px]"
                                    style={{ color: ORANGE }}
                                >
                                    #2
                                </div>
                                <div className="font-mundial text-[4px] tracking-[0.18em] uppercase text-white/40">
                                    Rank
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PreviewFrame>
    );
}

function BoardPreview() {
    const tileColors = [GOLD, PINK, COSMIC, ORANGE, "#5fd1a3"];
    const tiles = Array.from({ length: 20 }, (_, i) => {
        const seed = (i * 13 + 7) % tileColors.length;
        const isPartner = i === 6 || i === 13;
        return { color: isPartner ? OS_BLUE : tileColors[seed], isPartner };
    });
    return (
        <PreviewFrame pad={false} accent={OS_BLUE}>
            <div className="relative w-full h-full overflow-hidden rounded-xl">
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(180deg, #FFB7D5 0%, #FF8FB8 18%, ${OS_BLUE}88 45%, #1B3A6A 80%, #0E2244 100%)`,
                    }}
                />
                <div
                    className="absolute left-0 right-0 top-[28%] h-[18%]"
                    style={{
                        clipPath:
                            "polygon(0% 100%, 0% 60%, 5% 50%, 9% 65%, 14% 30%, 19% 55%, 24% 35%, 29% 70%, 35% 45%, 41% 60%, 47% 25%, 53% 55%, 59% 40%, 65% 65%, 72% 35%, 78% 55%, 84% 40%, 90% 60%, 96% 35%, 100% 50%, 100% 100%)",
                        background: "linear-gradient(180deg, #C44A8E 0%, #6B2A52 100%)",
                        opacity: 0.85,
                    }}
                />
                <div
                    className="absolute bottom-1 left-0 right-0 h-[6%]"
                    style={{
                        background: "linear-gradient(180deg, #5BA5C6 0%, #2A4D7A 100%)",
                    }}
                />
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
                    <Image
                        src="/assets/logo-v3.png"
                        alt=""
                        width={44}
                        height={30}
                        className="object-contain"
                        unoptimized
                        style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.5))` }}
                    />
                </div>
                <div
                    className="absolute inset-x-3 bottom-2 top-[48%] rounded-md p-1"
                    style={{
                        background: "rgba(8,12,28,0.78)",
                        border: `1.5px solid ${GOLD}cc`,
                        boxShadow: `0 0 10px ${GOLD}44, inset 0 0 8px rgba(0,0,0,0.6)`,
                    }}
                >
                    <div className="grid grid-cols-5 gap-[2px] w-full h-full">
                        {tiles.map((t, i) => (
                            <div
                                key={i}
                                className="rounded-[2px]"
                                style={{
                                    background: `linear-gradient(135deg, ${t.color}cc, ${t.color}66)`,
                                    boxShadow: t.isPartner
                                        ? `0 0 6px ${OS_BLUE}, inset 0 0 3px ${OS_BLUE}aa`
                                        : `inset 0 0 2px rgba(255,255,255,0.25)`,
                                    border: t.isPartner
                                        ? `1px solid ${OS_BLUE}`
                                        : "1px solid rgba(255,255,255,0.18)",
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </PreviewFrame>
    );
}

function LogoLockupPreview() {
    const tileColors = [GOLD, PINK, COSMIC, ORANGE, "#5fd1a3"];
    const tiles = Array.from({ length: 16 }, (_, i) => {
        const seed = (i * 11 + 3) % tileColors.length;
        const isPartner = i === 5 || i === 10;
        return { color: isPartner ? OS_BLUE : tileColors[seed], isPartner };
    });
    return (
        <PreviewFrame pad={false} accent={OS_BLUE}>
            <div className="relative w-full h-full overflow-hidden rounded-xl">
                <div
                    className="absolute inset-0"
                    style={{
                        background: `radial-gradient(circle at 50% 25%, ${OS_BLUE}55 0%, ${OS_BLUE}22 40%, rgba(0,0,0,0.6) 100%)`,
                    }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-start px-2 pt-3 gap-2">
                    <div className="flex items-center gap-1.5">
                        <Image
                            src="/assets/logo-v3.png"
                            alt="Pin Drop"
                            width={66}
                            height={45}
                            className="object-contain"
                            unoptimized
                            style={{ filter: `drop-shadow(0 2px 6px ${GOLD}55)` }}
                        />
                        <span
                            className="font-display font-black text-white/55 text-sm leading-none"
                            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                        >
                            ×
                        </span>
                        <Image
                            src="/badges/promo/opensea.webp"
                            alt=""
                            width={26}
                            height={26}
                            className="object-contain"
                            unoptimized
                            style={{ filter: `drop-shadow(0 0 6px ${OS_BLUE}88)` }}
                        />
                    </div>
                    <div
                        className="w-[88%] flex-1 rounded-md p-1 mb-2"
                        style={{
                            background: "rgba(8,12,28,0.8)",
                            border: `1.5px solid ${GOLD}cc`,
                            boxShadow: `0 0 10px ${GOLD}33, inset 0 0 8px rgba(0,0,0,0.6)`,
                        }}
                    >
                        <div className="grid grid-cols-4 gap-[2px] w-full h-full">
                            {tiles.map((t, i) => (
                                <div
                                    key={i}
                                    className="rounded-[2px]"
                                    style={{
                                        background: `linear-gradient(135deg, ${t.color}cc, ${t.color}66)`,
                                        boxShadow: t.isPartner
                                            ? `0 0 5px ${OS_BLUE}, inset 0 0 3px ${OS_BLUE}aa`
                                            : "inset 0 0 2px rgba(255,255,255,0.25)",
                                        border: t.isPartner
                                            ? `1px solid ${OS_BLUE}`
                                            : "1px solid rgba(255,255,255,0.18)",
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </PreviewFrame>
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
                        “Aye Aye, Captain!” the OpenSea community pin
                    </h3>
                    <p className="font-mundial text-white/60 text-[14px] sm:text-[15px] leading-relaxed">
                        OpenSea co-designed a hero pin with us for their on-platform
                        launch event. It dropped from capsules during the event window,
                        appeared on the game board as a matchable tile, lived as a
                        floating background element on the home screen, and gave every
                        collector a permanent slot in their Trophy Case. OpenSea
                        contributed prizes for the top of the event leaderboard.
                    </p>
                </div>
            </div>
        </section>
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
            <p className="font-mundial text-white/60 max-w-[820px] mx-auto text-base sm:text-lg leading-relaxed mb-9">
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
                DM @RonnyGuy to Partner →
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
                    @RonnyGuy
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
    // Static deterministic starfield (server-rendered) , matches the
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
            @keyframes vmPartnerBob {
                0%, 100% { transform: translateY(0); }
                50%      { transform: translateY(-6px); }
            }
            /* Featured (OpenSea partner) pin tile , gentle pulsing
               glow that draws the eye amongst the other six pins in
               the showcase grid without dominating the layout. */
            .partner-featured {
                animation: vmPartnerFeaturedGlow 3.4s ease-in-out infinite;
            }
            @keyframes vmPartnerFeaturedGlow {
                0%, 100% { transform: translateY(0); filter: brightness(1); }
                50%      { transform: translateY(-2px); filter: brightness(1.12); }
            }
        `}</style>
    );
}

export const dynamic = "force-static";
