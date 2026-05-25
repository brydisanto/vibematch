import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getProfile, type ProfileResponse } from "@/lib/profile";
import { TIER_COLORS, TIER_DISPLAY_NAMES, type BadgeTier } from "@/lib/badges";
import {
    GOLD,
    ORANGE,
    COSMIC,
    COSMIC_DEEP,
    PINK,
    INK_PANEL,
    INK_PANEL_LIGHT,
    INK_DARKEST,
} from "@/lib/arcade-tokens";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";
export const revalidate = 60;

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

function formatRunDate(ts: number): string {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
        return "";
    }
}

function modeLabel(mode: string): string {
    return (mode || "classic").toUpperCase().replace(/[_-]/g, " ");
}

function modeColor(mode: string): string {
    if (mode === "daily") return ORANGE;
    return GOLD;
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
    return (
        <div
            className="min-h-screen w-full flex flex-col items-stretch px-4 py-6 sm:px-8 sm:py-10"
            style={{
                background: `radial-gradient(ellipse at top, ${INK_PANEL_LIGHT} 0%, ${INK_PANEL} 55%, ${INK_DARKEST} 100%)`,
            }}
        >
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

            {/* Hero — tier-tinted backplate so the entire card reads as a
                trophy case for the player's collection level. */}
            <div className="w-full max-w-4xl mx-auto rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden"
                style={{
                    background: `linear-gradient(180deg, ${tier.color}22, ${tier.accent}1a 60%, rgba(255,255,255,0.02))`,
                    border: `1px solid ${tier.color}55`,
                    boxShadow: `0 10px 40px -10px ${tier.color}55, inset 0 1px 0 rgba(255,255,255,0.06)`,
                }}
            >
                {/* Tier badge in the top-right corner of the hero */}
                <div
                    className="absolute top-4 right-4 sm:top-5 sm:right-5 px-2.5 py-1 rounded-full flex items-center gap-1.5"
                    style={{
                        background: `${tier.color}1f`,
                        border: `1px solid ${tier.color}80`,
                        boxShadow: `0 0 12px -4px ${tier.color}aa`,
                    }}
                >
                    <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: tier.color, boxShadow: `0 0 6px ${tier.color}` }}
                    />
                    <span
                        className="font-display font-black text-[10px] tracking-[0.22em] uppercase"
                        style={{ color: tier.color }}
                    >
                        {tier.label}
                    </span>
                </div>
                <div
                    className="absolute inset-x-0 bottom-0 h-1 pointer-events-none"
                    style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, ${tier.accent}, transparent)` }}
                />
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mt-2 sm:mt-0">
                    <ProfileAvatar avatarUrl={profile.avatarUrl} username={profile.username} />
                    <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                        <h1 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight">
                            {profile.username}
                        </h1>
                        {joined && (
                            <div className="font-mundial text-[10px] tracking-[0.22em] uppercase text-white/40 mt-2">
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
                            <RankPill
                                label="TIER"
                                value={tier.label}
                                color={tier.color}
                            />
                            {profile.rank.score === null && profile.rank.pins === null && (
                                <span className="font-mundial text-[10px] tracking-[0.22em] uppercase text-white/40">
                                    Not yet ranked
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <div className="w-full max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="BEST SCORE" value={profile.best.allTime !== null ? profile.best.allTime.toLocaleString() : "—"} accent={GOLD} />
                <StatCard label="TODAY'S DAILY" value={profile.best.daily !== null ? profile.best.daily.toLocaleString() : "—"} accent={ORANGE} />
                <StatCard label="GAMES PLAYED" value={profile.gamesPlayed.toLocaleString()} accent={GOLD} />
                <StatCard label="PIN COMPLETION" value={`${profile.pins.completion}%`} accent={ORANGE} />
            </div>

            {/* Pin showcase */}
            <div className="w-full max-w-4xl mx-auto mb-6">
                <SectionHeader label="PIN SHOWCASE" accent={GOLD} />
                {profile.pins.topPins.length === 0 ? (
                    <EmptyState text="No pins collected yet." />
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {profile.pins.topPins.map(pin => (
                            <PinCard key={pin.id} pin={pin} />
                        ))}
                    </div>
                )}
                <TierBreakdown byTier={profile.pins.byTier} unique={profile.pins.unique} total={profile.pins.total} />
            </div>

            {/* Recent runs */}
            <div className="w-full max-w-4xl mx-auto mb-10">
                <SectionHeader label="RECENT RUNS" accent={GOLD} />
                {profile.recentRuns.length === 0 ? (
                    <EmptyState text="No runs yet." />
                ) : (
                    <div className="flex flex-col gap-2">
                        {profile.recentRuns.map((run, i) => (
                            <div
                                key={`${run.timestamp}-${i}`}
                                className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: `1px solid ${GOLD}15`,
                                }}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span
                                        className="font-display text-[9px] tracking-[0.18em] px-2 py-1 rounded-sm font-black"
                                        style={{
                                            color: "#1A0E02",
                                            background: modeColor(run.mode),
                                        }}
                                    >
                                        {modeLabel(run.mode)}
                                    </span>
                                    <span className="font-mundial text-[11px] text-white/50">
                                        {formatRunDate(run.timestamp)}
                                    </span>
                                </div>
                                <span className="font-display font-black tabular-nums text-[15px] text-white">
                                    {run.score.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
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

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div
            className="rounded-xl px-4 py-4 flex flex-col items-start"
            style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${accent}22`,
            }}
        >
            <span className="font-mundial text-[9px] tracking-[0.22em] uppercase text-white/40">
                {label}
            </span>
            <span className="font-display font-black text-[22px] sm:text-[26px] tabular-nums mt-1" style={{ color: accent }}>
                {value}
            </span>
        </div>
    );
}

function SectionHeader({ label, accent }: { label: string; accent: string }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <span className="font-display text-[10px] tracking-[0.32em]" style={{ color: accent }}>
                {label}
            </span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div
            className="rounded-xl px-5 py-8 text-center font-mundial text-[11px] uppercase tracking-[0.22em] text-white/40"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.08)",
            }}
        >
            {text}
        </div>
    );
}

function PinCard({ pin }: { pin: ProfileResponse["pins"]["topPins"][number] }) {
    const color = TIER_COLORS[pin.tier];
    return (
        <div
            className="rounded-xl p-3 flex flex-col items-center text-center"
            style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${color}55`,
                boxShadow: `0 6px 20px -8px ${color}55`,
            }}
        >
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2">
                <Image
                    src={pin.image}
                    alt={pin.name}
                    fill
                    sizes="80px"
                    className="object-contain"
                    unoptimized
                />
            </div>
            <span
                className="font-mundial text-[8px] tracking-[0.22em] uppercase mb-1"
                style={{ color }}
            >
                {TIER_DISPLAY_NAMES[pin.tier]}
            </span>
            <span className="font-display font-black text-[10px] text-white/90 leading-tight line-clamp-2">
                {pin.name}
            </span>
            {pin.count > 1 && (
                <span className="font-mundial text-[9px] text-white/40 mt-1">
                    ×{pin.count}
                </span>
            )}
        </div>
    );
}

function TierBreakdown({ byTier, unique, total }: { byTier: Record<BadgeTier, number>; unique: number; total: number }) {
    const tiers: BadgeTier[] = ["cosmic", "gold", "special", "silver", "blue"];
    const hasAny = tiers.some(t => byTier[t] > 0);
    if (!hasAny) return null;
    return (
        <div className="mt-4 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div className="flex flex-wrap gap-3">
                {tiers.map(t => byTier[t] > 0 && (
                    <div key={t} className="flex items-center gap-1.5">
                        <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: TIER_COLORS[t] }}
                        />
                        <span className="font-mundial text-[10px] tracking-[0.18em] uppercase text-white/50">
                            {TIER_DISPLAY_NAMES[t]}
                        </span>
                        <span className="font-display font-black text-[11px] tabular-nums text-white/90">
                            {byTier[t]}
                        </span>
                    </div>
                ))}
            </div>
            <div className="font-mundial text-[10px] tracking-[0.18em] uppercase text-white/40">
                {unique} unique · {total} total
            </div>
        </div>
    );
}
