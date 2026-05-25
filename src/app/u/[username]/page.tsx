import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getProfile, type ProfileResponse } from "@/lib/profile";
import { BADGES, TIER_COLORS, TIER_DISPLAY_NAMES, type Badge, type BadgeTier } from "@/lib/badges";
import {
    GOLD,
    GOLD_DEEP,
    ORANGE,
    ORANGE_DEEP,
    COSMIC,
    COSMIC_DEEP,
    PINK,
    PINK_DEEP,
    INK_PANEL,
    INK_PANEL_LIGHT,
    INK_DARKEST,
} from "@/lib/arcade-tokens";
import Link from "next/link";
import Image from "next/image";
import ProfileStarfield from "./ProfileStarfield";
import ProfileShowcaseTabs from "./ProfileShowcaseTabs";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// Solid card surface — sits opaquely over the radial purple bg so the
// stats / pin cards / recent-run rows have visible weight instead of
// looking translucent. Slightly lighter than INK_PANEL for contrast.
const CARD_BG = "#1F0942";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type PageParams = { username: string };

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
    const { username } = await params;
    const profile = await getProfile(username);
    if (!profile) {
        return { title: "Player not found — Pin Drop" };
    }
    const description = profile.best.allTime !== null
        ? `${profile.username} — best score ${profile.best.allTime.toLocaleString()}, ${profile.pins.unique} pins collected.`
        : `${profile.username}'s Pin Drop profile.`;
    return {
        title: `${profile.username} — Pin Drop`,
        description,
        openGraph: {
            title: `${profile.username} — Pin Drop`,
            description,
            type: "profile",
            images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
        },
        twitter: {
            card: "summary",
            title: `${profile.username} — Pin Drop`,
            description,
            images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
        },
    };
}

function formatJoinedDate(iso: string | null): string | null {
    if (!iso) return null;
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch {
        return null;
    }
}

export default async function ProfilePage({ params }: { params: Promise<PageParams> }) {
    const { username } = await params;
    const profile = await getProfile(username);
    if (!profile) notFound();

    return <ProfileView profile={profile} />;
}

function ProfileView({ profile }: { profile: ProfileResponse }) {
    const joined = formatJoinedDate(profile.joinedAt);
    const tier = profile.tier;
    const isHolo = tier.id === "one_of_one";
    const isCosmic = tier.id === "cosmic";
    return (
        <div
            className="min-h-screen w-full flex flex-col items-stretch px-4 py-6 sm:px-8 sm:py-10 relative"
            style={{
                background: `radial-gradient(ellipse at top, ${INK_PANEL_LIGHT} 0%, ${INK_PANEL} 55%, ${INK_DARKEST} 100%)`,
            }}
        >
            <ProfileStarfield />
            <div className="relative z-10 flex flex-col items-stretch">
            {/* Top nav */}
            <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-6">
                <Link
                    href="/"
                    className="font-display text-[11px] tracking-[0.28em] text-white/60 hover:text-white transition-colors"
                >
                    ← PIN DROP
                </Link>
                <div className="font-display text-[10px] tracking-[0.32em]" style={{ color: GOLD }}>
                    PROFILE
                </div>
            </div>

            {/* Hero — nameplate adopts the player's collector-tier visual
                treatment (holo for One-Of-One, cosmic nebula for Cosmic,
                tinted gradient for the lower tiers) so the card reads as
                a trophy case for the player's collection level. Wrapped
                in a chunky 2px tier-color frame + drop shadow to match
                the home-screen CAPSULES tile treatment. The tier-
                specific CSS lives at the bottom of this file. */}
            <div
                className="w-full max-w-4xl mx-auto rounded-2xl p-[2px] mb-6"
                style={{
                    background: `linear-gradient(180deg, ${tier.color} 0%, ${tier.accent} 100%)`,
                    boxShadow: `0 4px 0 ${tier.accent}, 0 8px 18px rgba(0,0,0,0.45)`,
                }}
            >
            <div
                className={`profileHero w-full rounded-[14px] p-6 sm:p-8 relative overflow-hidden ${isHolo ? "tier-holo" : ""} ${isCosmic ? "tier-cosmic" : ""}`}
                style={isHolo || isCosmic ? undefined : {
                    // Dark panel with tier-tinted ambient glows. Earlier the
                    // inner bg used tier.color}26 alpha, but the chunky 100%
                    // tier-color outer frame bled through, washing the entire
                    // card in a flat tier color (gold-on-gold disappeared,
                    // magenta-on-magenta clashed with the pills). Now the
                    // surface is opaque dark like the stat tiles, with a soft
                    // top + bottom tier glow so the tier identity reads
                    // without blanketing the content.
                    background: `
                        radial-gradient(ellipse at 50% 0%, ${tier.color}1f, transparent 55%),
                        radial-gradient(ellipse at 50% 100%, ${tier.accent}17, transparent 50%),
                        linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)
                    `,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06)`,
                }}
            >
                {/* Dark scrim above the holo conic gradient so white text
                    sits on something readable instead of fighting rainbow
                    sweep. Matches the TierInfoModal one-of-one row. */}
                {isHolo && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(180deg, rgba(8,4,20,0.55), rgba(8,4,20,0.72))" }}
                    />
                )}
                {/* Cosmic twinkle particle field — six sparkles drifting
                    on staggered cycles so the pattern never reads synced. */}
                {isCosmic && (
                    <div className="absolute inset-0 pointer-events-none" aria-hidden>
                        <span className="tier-cosmic-particle" style={{ left: "8%", top: "22%", animationDelay: "0s" }} />
                        <span className="tier-cosmic-particle" style={{ left: "20%", top: "70%", animationDelay: "0.6s" }} />
                        <span className="tier-cosmic-particle" style={{ left: "40%", top: "14%", animationDelay: "1.2s" }} />
                        <span className="tier-cosmic-particle" style={{ left: "62%", top: "62%", animationDelay: "1.8s" }} />
                        <span className="tier-cosmic-particle" style={{ left: "82%", top: "28%", animationDelay: "2.4s" }} />
                        <span className="tier-cosmic-particle" style={{ left: "92%", top: "78%", animationDelay: "3.0s" }} />
                    </div>
                )}
                {/* Tier badge — top-right corner. Formatted as
                    "TIER: <LABEL>" per request, with tier-specific
                    styling so it's the only place tier is shown in
                    the nameplate (no duplicate pill in the rank row). */}
                <div
                    className={`absolute top-4 right-4 sm:top-5 sm:right-5 px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 ${isHolo ? "tier-holo-pill" : ""}`}
                    style={isHolo || isCosmic ? {
                        background: isHolo ? "rgba(8,4,20,0.55)" : "rgba(45,14,84,0.55)",
                        border: `1px solid ${isHolo ? "rgba(255,255,255,0.75)" : "rgba(179,102,255,0.85)"}`,
                        boxShadow: isHolo
                            ? "0 0 14px rgba(255,255,255,0.45)"
                            : "0 0 16px rgba(179,102,255,0.55)",
                    } : {
                        background: `${tier.color}1f`,
                        border: `1px solid ${tier.color}80`,
                        boxShadow: `0 0 12px -4px ${tier.color}aa`,
                    }}
                >
                    <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${isHolo ? "tier-holo-dot" : ""} ${isCosmic ? "tier-cosmic-dot" : ""}`}
                        style={isHolo || isCosmic ? undefined : { background: tier.color, boxShadow: `0 0 6px ${tier.color}` }}
                    />
                    <span
                        className="font-display font-black text-[10px] tracking-[0.22em] uppercase"
                        style={{
                            color: isHolo ? "#FFFFFF" : isCosmic ? "#E8C8FF" : tier.color,
                            textShadow: isHolo
                                ? "0 0 6px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.9)"
                                : isCosmic
                                    ? "0 0 10px rgba(179,102,255,0.65), 0 1px 2px rgba(0,0,0,0.7)"
                                    : undefined,
                        }}
                    >
                        TIER: {tier.label}
                    </span>
                </div>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mt-2 sm:mt-0 relative z-10">
                    <ProfileAvatar avatarUrl={profile.avatarUrl} username={profile.username} />
                    <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                        <h1
                            className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight"
                            style={isHolo ? { textShadow: "0 1px 4px rgba(0,0,0,0.85)" } : undefined}
                        >
                            {profile.username}
                        </h1>
                        {joined && (
                            <div className="font-mundial text-[10px] tracking-[0.22em] uppercase text-white/50 mt-2">
                                Joined {joined}
                            </div>
                        )}
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
                            {profile.rank.score !== null && (
                                <RankPill
                                    label="SCORE RANK"
                                    value={`#${profile.rank.score}`}
                                    color={GOLD}
                                />
                            )}
                            {profile.rank.pins !== null && (
                                <RankPill
                                    label="PIN RANK"
                                    value={`#${profile.rank.pins}`}
                                    color={ORANGE}
                                />
                            )}
                            {profile.streak > 0 && (
                                <RankPill
                                    label="STREAK"
                                    value={`${profile.streak} ${profile.streak === 1 ? "DAY" : "DAYS"}`}
                                    color={ORANGE}
                                />
                            )}
                            {profile.rank.score === null && profile.rank.pins === null && profile.streak === 0 && (
                                <span className="font-mundial text-[10px] tracking-[0.22em] uppercase text-white/50">
                                    Not yet ranked
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </div>

            {/* Stats grid — chunky tiles matching the home-screen
                CAPSULES / EXTRA PINS treatment: 2px tier-color gradient
                frame around a dark inner panel, with a "pressed-in"
                bottom shadow. */}
            <div className="w-full max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="BEST SCORE" value={profile.best.allTime !== null ? profile.best.allTime.toLocaleString() : "—"} accent={GOLD} deep={GOLD_DEEP} />
                <StatCard label="TODAY'S DAILY" value={profile.best.daily !== null ? profile.best.daily.toLocaleString() : "—"} accent={ORANGE} deep={ORANGE_DEEP} />
                <StatCard label="GAMES PLAYED" value={profile.gamesPlayed.toLocaleString()} accent={COSMIC} deep={COSMIC_DEEP} />
                <StatCard
                    label="PIN COMPLETION"
                    value={
                        <>
                            {profile.pins.unique}
                            <span className="text-white/35"> / {BADGES.length}</span>
                            <span className="text-[14px] sm:text-[16px] text-white/55 font-display font-black ml-1.5">
                                ({profile.pins.completion}%)
                            </span>
                        </>
                    }
                    accent={PINK}
                    deep={PINK_DEEP}
                />
            </div>

            {/* Showcase — tabs between the full pin book (tier-grouped
                grid with locked "???" slots) and the trophy case
                (event trophies + Daily Champion count). PIN COMPLETION
                lives in the stats grid above, so the showcase section
                no longer carries a duplicate count line. */}
            <div className="w-full max-w-4xl mx-auto mb-10">
                <ProfileShowcaseTabs
                    pinBook={<PinShowcase topPins={profile.pins.topPins} />}
                    trophyCase={<TrophyCase data={profile.trophyCase} />}
                />
            </div>

            {/* Footer */}
            <div className="w-full max-w-4xl mx-auto text-center pb-6">
                <Link
                    href="/"
                    className="inline-block font-display text-[11px] tracking-[0.28em] px-6 py-3 rounded-lg transition-all"
                    style={{
                        color: GOLD,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${GOLD}33`,
                    }}
                >
                    PLAY PIN DROP →
                </Link>
            </div>
            </div>
            {/* Tier-specific CSS — mirrors TierInfoModal so the nameplate
                reads as the same trophy you see in the COLLECTOR TIERS
                modal. Holo (One-Of-One) uses a slow-rotating conic
                gradient + dark scrim. Cosmic uses a breathing purple
                nebula plus twinkling particle field. Both ignore the
                inline backplate styles via tier-* classes. */}
            <style>{`
                .profileHero.tier-holo,
                .profileTrophyHolo {
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
                        conic-gradient(
                            from var(--profile-holo-angle, 0deg),
                            #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff,
                            #84fab0, #fad0c4, #ffdde1, #ff6ad5
                        );
                    background-blend-mode: overlay, normal;
                    animation: profileHoloSpin 8s linear infinite;
                    border: 1px solid rgba(255,255,255,0.55);
                    box-shadow: 0 0 28px rgba(255,255,255,0.22), inset 0 0 28px rgba(255,255,255,0.12);
                }
                .tier-holo-dot {
                    width: 6px;
                    height: 6px;
                    background: conic-gradient(
                        from 0deg,
                        #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff,
                        #84fab0, #fad0c4, #ffdde1, #ff6ad5
                    );
                    box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
                    animation: profileHoloDotSpin 4s linear infinite;
                }
                @keyframes profileHoloSpin {
                    to { --profile-holo-angle: 360deg; }
                }
                @keyframes profileHoloDotSpin {
                    to { transform: rotate(360deg); }
                }
                @property --profile-holo-angle {
                    syntax: "<angle>";
                    inherits: false;
                    initial-value: 0deg;
                }
                .profileHero.tier-cosmic {
                    background:
                        radial-gradient(circle at 18% 28%, rgba(179,102,255,0.42), transparent 55%),
                        radial-gradient(circle at 82% 75%, rgba(216,160,255,0.35), transparent 55%),
                        linear-gradient(180deg, rgba(45,14,84,0.85), rgba(21,6,48,0.92));
                    border: 1px solid rgba(179,102,255,0.65);
                    animation: profileCosmicBreathe 4.5s ease-in-out infinite;
                }
                .tier-cosmic-dot {
                    width: 6px;
                    height: 6px;
                    background: radial-gradient(circle at 30% 30%, #E8C8FF, #B366FF 55%, #6B1FC0);
                    box-shadow:
                        0 0 8px rgba(179,102,255,0.9),
                        0 0 16px rgba(179,102,255,0.55);
                    animation: profileCosmicDotPulse 2.2s ease-in-out infinite;
                }
                .tier-cosmic-particle {
                    position: absolute;
                    width: 3px;
                    height: 3px;
                    border-radius: 50%;
                    background: #E8C8FF;
                    box-shadow:
                        0 0 6px rgba(232,200,255,0.95),
                        0 0 12px rgba(179,102,255,0.75);
                    opacity: 0;
                    animation: profileCosmicTwinkle 3.6s ease-in-out infinite;
                }
                @keyframes profileCosmicBreathe {
                    0%, 100% {
                        box-shadow: 0 0 28px rgba(179,102,255,0.4), inset 0 0 28px rgba(179,102,255,0.18);
                    }
                    50% {
                        box-shadow: 0 0 40px rgba(179,102,255,0.65), inset 0 0 34px rgba(179,102,255,0.3);
                    }
                }
                @keyframes profileCosmicDotPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.35); opacity: 0.8; }
                }
                @keyframes profileCosmicTwinkle {
                    0%, 100% { opacity: 0; transform: scale(0.6); }
                    40%      { opacity: 1; transform: scale(1.1); }
                    60%      { opacity: 1; transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
}

function ProfileAvatar({ avatarUrl, username }: { avatarUrl: string | null; username: string }) {
    const src = avatarUrl || "/assets/gvc_shaka.png";
    const isDataUrl = !!avatarUrl && avatarUrl.startsWith("data:");
    // Matches the main-page avatar: outer gold glow, spinning conic
    // gradient ring, cosmic→pink inner bg, fall back to shaka if no
    // avatar uploaded. Larger size for the hero.
    return (
        <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    inset: -22,
                    background: `radial-gradient(circle, ${GOLD}bf 0%, ${GOLD}59 40%, transparent 75%)`,
                    filter: "blur(6px)",
                    opacity: 0.7,
                }}
            />
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: `conic-gradient(from 0deg, ${GOLD} 0deg, ${GOLD}00 90deg, ${GOLD} 180deg, ${GOLD}00 270deg, ${GOLD} 360deg)`,
                    padding: 2,
                }}
            >
                <div className="w-full h-full rounded-full" style={{ background: "#180630" }} />
            </div>
            <div
                className="absolute rounded-full overflow-hidden flex items-center justify-center"
                style={{
                    inset: 4,
                    background: `linear-gradient(135deg, ${COSMIC}, ${PINK})`,
                    boxShadow: `inset 0 -6px 14px ${COSMIC_DEEP}, inset 0 3px 6px rgba(255,255,255,0.2)`,
                }}
            >
                {isDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={src}
                        alt={username}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : avatarUrl ? (
                    <Image
                        src={src}
                        alt={username}
                        fill
                        sizes="116px"
                        className="object-cover"
                    />
                ) : (
                    <Image
                        src={src}
                        alt=""
                        fill
                        sizes="116px"
                        className="object-contain p-3"
                    />
                )}
            </div>
        </div>
    );
}

function RankPill({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${color}55`,
            }}
        >
            <span className="font-mundial text-[9px] tracking-[0.22em] uppercase text-white/50">
                {label}
            </span>
            <span className="font-display font-black text-[13px]" style={{ color }}>
                {value}
            </span>
        </div>
    );
}

function StatCard({ label, value, accent, deep }: { label: string; value: React.ReactNode; accent: string; deep: string }) {
    // Chunky tile: outer p-[2px] frame in accent → deep gradient acts as
    // a thick "metal" border, inner panel is the dark gradient background
    // used by the home-screen CAPSULES / EXTRA PINS tiles, drop shadow
    // gives the pressed-in feel.
    return (
        <div
            className="rounded-xl p-[2px]"
            style={{
                background: `linear-gradient(180deg, ${accent} 0%, ${deep} 100%)`,
                boxShadow: `0 3px 0 ${deep}, 0 5px 12px rgba(0,0,0,0.45)`,
            }}
        >
            <div
                className="rounded-[10px] px-4 py-4 flex flex-col items-start"
                style={{ background: "linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)" }}
            >
                <span className="font-mundial text-[9px] tracking-[0.22em] uppercase text-white/50">
                    {label}
                </span>
                <span
                    className="font-display font-black text-[22px] sm:text-[26px] tabular-nums mt-1"
                    style={{ color: accent, textShadow: `0 2px 0 ${deep}` }}
                >
                    {value}
                </span>
            </div>
        </div>
    );
}

// Trophy Case — running record of special-event achievements. Right
// now the only ongoing event is the OpenSea promo (Aye Aye, Captain!)
// and the Daily Challenge champion bonus. Tiles use the same "soft
// raised glow" treatment as PinBook tiles (subtle accent-tinted bg
// + accent border + soft accent glow) rather than the chunky
// gold-framed treatment used by the nameplate and stat tiles, so
// the section visually differentiates from what sits above it.
// Each trophy gets a partner-appropriate glow color.
const OPENSEA_BLUE = "#4A9EFF";

function getEventAccent(eventId: string): string {
    if (eventId === "promo_opensea") return OPENSEA_BLUE;
    return GOLD;
}

function TrophyCase({ data }: { data: ProfileResponse["trophyCase"] }) {
    const hasEvents = data.events.length > 0;
    const hasDailyWins = data.dailyWins > 0;
    const hasPinDrop = data.completedPinBook;
    const isEmpty = !hasEvents && !hasDailyWins && !hasPinDrop;
    if (isEmpty) {
        return (
            <div
                className="rounded-xl px-6 py-10 text-center"
                style={{
                    background: `linear-gradient(135deg, ${GOLD}10, ${GOLD}05)`,
                    border: `1.5px solid ${GOLD}30`,
                    boxShadow: `0 0 14px ${GOLD}22, 0 0 28px ${GOLD}10`,
                }}
            >
                <div className="font-display font-black text-lg text-white/85 mb-2">
                    No trophies yet
                </div>
                <div className="font-mundial text-[11px] tracking-[0.22em] uppercase text-white/40">
                    Collect event pins and win daily challenges to fill this case.
                </div>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {hasPinDrop && <PinDropTrophyCard totalPins={BADGES.length} />}
            {data.events.map(event => (
                <EventTrophyCard key={event.id} event={event} />
            ))}
            {hasDailyWins && <DailyWinsCard wins={data.dailyWins} />}
        </div>
    );
}

function PinDropTrophyCard({ totalPins }: { totalPins: number }) {
    // Exclusive trophy for completing the pin book. Uses the same
    // animated holo treatment as the One-Of-One tier nameplate /
    // PinBook "ONE OF ONE" row — rainbow conic gradient behind a
    // dark scrim — because reaching 100% IS the One-Of-One tier.
    // No accent border; the rotating frame is the border.
    return (
        <div className="profileTrophyHolo rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-transform hover:-translate-y-[2px]">
            {/* Dark scrim so text + the badge stand on something
                readable instead of fighting the rainbow sweep. */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(180deg, rgba(8,4,20,0.62), rgba(8,4,20,0.78))" }}
            />
            <div className="relative w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] mb-3 z-10">
                <Image
                    src="/badges/pin_drop_complete.webp"
                    alt="Pin Drop completionist badge"
                    fill
                    sizes="100px"
                    className="object-contain drop-shadow-[0_4px_18px_rgba(255,255,255,0.45)]"
                    unoptimized
                />
            </div>
            <div className="relative z-10 font-mundial text-[9px] tracking-[0.28em] uppercase text-white/70">
                EXCLUSIVE BADGE
            </div>
            <div
                className="relative z-10 font-display font-black text-xl sm:text-2xl text-white leading-tight mt-0.5"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
            >
                PIN DROP!
            </div>
            <div
                className="relative z-10 w-full h-px my-3"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)" }}
            />
            <div className="relative z-10 flex items-end justify-center gap-4 w-full">
                <TrophyStat value={`${totalPins}`} label="PINS" color="#FFFFFF" />
                <TrophyStat value="100%" label="COMPLETION" color="#FFFFFF" />
            </div>
        </div>
    );
}

function TrophyShell({
    accent,
    children,
}: {
    accent: string;
    children: ReactNode;
}) {
    // Square-ish trophy plaque. PinBook-style soft accent glow +
    // semi-transparent accent border, no chunky frame, no thick
    // drop shadow. Distinct from the gold-framed nameplate +
    // stat tiles above so the section reads as a different
    // surface. Hover lift makes the trophy feel interactive.
    return (
        <div
            className="rounded-xl p-4 flex flex-col items-center text-center transition-transform hover:-translate-y-[2px]"
            style={{
                background: `linear-gradient(135deg, ${accent}18, ${accent}06)`,
                border: `1.5px solid ${accent}40`,
                boxShadow: `0 0 14px ${accent}33, 0 0 28px ${accent}18`,
            }}
        >
            {children}
        </div>
    );
}

function EventTrophyCard({ event }: { event: ProfileResponse["trophyCase"]["events"][number] }) {
    const accent = getEventAccent(event.id);
    return (
        <TrophyShell accent={accent}>
            <div className="relative w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] mb-3">
                <Image
                    src={event.image}
                    alt={event.name}
                    fill
                    sizes="100px"
                    className="object-contain"
                    unoptimized
                />
            </div>
            <div className="font-display font-black text-sm sm:text-base text-white leading-tight line-clamp-2 min-h-[2.4em] flex items-center">
                {event.name}
            </div>
            <div className="font-mundial text-[9px] tracking-[0.22em] uppercase text-white/45 mt-1">
                {event.partnerName} EVENT
            </div>
            <div
                className="w-full h-px my-3"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }}
            />
            <div className="flex items-end justify-center gap-4 w-full">
                <TrophyStat value={`×${event.owned}`} label="COLLECTED" color={accent} />
                {event.rank !== null && (
                    <TrophyStat value={`#${event.rank}`} label="RANK" color={ORANGE} />
                )}
            </div>
        </TrophyShell>
    );
}

function DailyWinsCard({ wins }: { wins: number }) {
    return (
        <TrophyShell accent={ORANGE}>
            <div
                className="w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] mb-3 rounded-full flex items-center justify-center"
                style={{
                    background: `radial-gradient(circle at 35% 28%, ${ORANGE}, ${ORANGE_DEEP})`,
                    border: `1.5px solid ${ORANGE}77`,
                    boxShadow: `0 0 18px ${ORANGE}55, inset 0 -8px 16px ${ORANGE_DEEP}`,
                }}
            >
                <span
                    className="font-display font-black text-3xl sm:text-4xl text-white"
                    style={{ textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}
                >
                    {wins}
                </span>
            </div>
            <div className="font-display font-black text-sm sm:text-base text-white leading-tight line-clamp-2 min-h-[2.4em] flex items-center">
                {wins === 1 ? "Champion Win" : "Champion Wins"}
            </div>
            <div className="font-mundial text-[9px] tracking-[0.22em] uppercase text-white/45 mt-1">
                DAILY CHALLENGE
            </div>
            <div
                className="w-full h-px my-3"
                style={{ background: `linear-gradient(90deg, transparent, ${ORANGE}40, transparent)` }}
            />
            <div className="font-mundial text-[9px] tracking-[0.18em] uppercase text-white/40">
                FORWARD-TRACKING
            </div>
        </TrophyShell>
    );
}

function TrophyStat({ value, label, color }: { value: string; label: string; color: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="font-display font-black text-base tabular-nums" style={{ color }}>
                {value}
            </span>
            <span className="font-mundial text-[8px] tracking-[0.22em] uppercase text-white/45 mt-0.5">
                {label}
            </span>
        </div>
    );
}

// Mirrors PinBook's design: BADGES grouped by tier in PinBook's
// canonical order (cosmic → blue). Each tier section gets a colored
// dot + name + owned/total header. Owned pins render full art with a
// tier-color tint + glow + a duplicate-count chip; unowned slots
// render as a flat dark card with a faded "???" label.
const TIER_ORDER: BadgeTier[] = ["cosmic", "gold", "special", "silver", "blue"];

const TIER_GLOW: Record<BadgeTier, string> = {
    cosmic: "0 0 12px rgba(179, 102, 255, 0.6), 0 0 24px rgba(179, 102, 255, 0.25)",
    gold: "0 0 12px rgba(255, 224, 72, 0.5), 0 0 24px rgba(255, 224, 72, 0.2)",
    special: "0 0 12px rgba(255, 140, 66, 0.5), 0 0 24px rgba(255, 140, 66, 0.2)",
    silver: "0 0 12px rgba(74, 158, 255, 0.5), 0 0 24px rgba(74, 158, 255, 0.2)",
    blue: "0 0 10px rgba(224, 224, 224, 0.3), 0 0 20px rgba(224, 224, 224, 0.1)",
};

function PinShowcase({ topPins }: { topPins: ProfileResponse["pins"]["topPins"] }) {
    const ownedById = new Map(topPins.map(p => [p.id, p]));
    const groupedBadges: Record<BadgeTier, Badge[]> = {
        cosmic: [],
        gold: [],
        special: [],
        silver: [],
        blue: [],
    };
    for (const badge of BADGES) {
        groupedBadges[badge.tier].push(badge);
    }
    return (
        <div className="flex flex-col gap-6">
            {TIER_ORDER.map(tier => {
                const badges = groupedBadges[tier];
                if (badges.length === 0) return null;
                const tierColor = TIER_COLORS[tier];
                const tierName = TIER_DISPLAY_NAMES[tier];
                const ownedInTier = badges.filter(b => ownedById.has(b.id)).length;
                return (
                    <div key={tier}>
                        <div className="flex items-center gap-2.5 mb-3">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: tierColor, boxShadow: `0 0 8px ${tierColor}` }}
                            />
                            <h3
                                className="font-display text-sm font-black uppercase tracking-wider"
                                style={{ color: tierColor }}
                            >
                                {tierName}
                            </h3>
                            <span className="text-white/30 text-[10px] font-mundial font-bold">
                                {ownedInTier}/{badges.length}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-8 gap-2 sm:gap-2.5">
                            {badges.map(badge => (
                                <PinSlot
                                    key={badge.id}
                                    badge={badge}
                                    owned={ownedById.get(badge.id)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function PinSlot({
    badge,
    owned,
}: {
    badge: Badge;
    owned: ProfileResponse["pins"]["topPins"][number] | undefined;
}) {
    const tierColor = TIER_COLORS[badge.tier];
    const isOwned = !!owned;
    const count = owned?.count ?? 0;
    return (
        <div className="relative">
            <div
                className="relative rounded-xl overflow-hidden"
                style={{
                    background: isOwned
                        ? `linear-gradient(135deg, ${tierColor}15, ${tierColor}08)`
                        : CARD_BG,
                    border: `1.5px solid ${isOwned ? `${tierColor}40` : "rgba(255,255,255,0.06)"}`,
                    boxShadow: isOwned ? TIER_GLOW[badge.tier] : "none",
                }}
            >
                <div className="relative aspect-square p-2">
                    <Image
                        src={badge.image}
                        alt={isOwned ? badge.name : "Undiscovered"}
                        fill
                        sizes="(max-width: 640px) 80px, 100px"
                        className="object-contain p-1.5"
                        style={isOwned ? undefined : { filter: "brightness(0)", opacity: 0.15 }}
                        unoptimized
                    />
                </div>
                <div className="px-1.5 pb-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                                background: isOwned ? tierColor : "rgba(255,255,255,0.15)",
                            }}
                        />
                        <span
                            className={`text-[9px] sm:text-[10px] font-mundial font-bold leading-tight truncate ${
                                isOwned ? "text-white/80" : "text-white/20"
                            }`}
                        >
                            {isOwned ? badge.name : "???"}
                        </span>
                    </div>
                </div>
                {isOwned && count > 1 && (
                    <div
                        className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                        style={{
                            background: tierColor,
                            boxShadow: `0 0 8px ${tierColor}80`,
                        }}
                    >
                        <span className="text-[9px] font-black font-mundial text-black leading-none">
                            x{count}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
