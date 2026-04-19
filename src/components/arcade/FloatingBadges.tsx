"use client";

import { useEffect, useMemo, useState } from "react";
import { PURPLE_BG } from "@/lib/arcade-tokens";

// Curated pool from the Claude Design handoff — 34 visually varied badges.
// We multiply this pool × 8 then shuffle for spawn diversity.
const BADGE_IMAGES = [
    "/badges/any_gvc_1759173799963.webp",
    "/badges/full_send_maverick_1759173982959.webp",
    "/badges/funky_fresh_1759174001274.webp",
    "/badges/gradient_lover_1759173808918.webp",
    "/badges/visooor_enjoyooor_1759174010233.webp",
    "/badges/ladies_night_1759173991853.webp",
    "/badges/multi_type_master_1759173898608.webp",
    "/badges/vibetown_social_club_1759173960008.webp",
    "/badges/plastic_lover_1759173806081.webp",
    "/badges/hail_mary_heroes_1759173953534.webp",
    "/badges/pothead_1759173827603.webp",
    "/badges/rainbow_boombox_1759173875165.webp",
    "/badges/checkmate_1759173863329.webp",
    "/badges/fur_the_win_1759173969828.webp",
    "/badges/poker_face_1759173884906.webp",
    "/badges/rainbow_citizen_1759173791000.webp",
    "/badges/yin_n_yang_1759173942484.webp",
    "/badges/science_goggles_1759173835714.webp",
    "/badges/doge_1759173842640.webp",
    "/badges/captain_1759173895611.webp",
    "/badges/gamer_1759173856821.webp",
    "/badges/pepe_1759173846260.webp",
    "/badges/mountain_goat_1759174026593.webp",
    "/badges/surfer_1759173830462.webp",
    "/badges/astro_balls_1759173838889.webp",
    "/badges/gold_member_1759173793799.webp",
    "/badges/king_1759173882056.webp",
    "/badges/cosmic_guardian1759173818340.webp",
    "/badges/rainbow_visor_1759173849941.webp",
    "/badges/lamp_1759173892925.webp",
    "/badges/one_of_one_1771354994630.webp",
    "/badges/electric_rings_1759173878797.webp",
    "/badges/sugar_rush_1759173860105.webp",
    "/badges/stone_1759173815165.webp",
];

interface FloatingBadgesProps {
    count?: number;
    speed?: number;
}

interface BadgeItem {
    id: number;
    image: string;
    x: number;
    yStart: number;
    yEnd: number;
    size: number;
    rotation: number;
    rotationEnd: number;
    duration: number;
    delay: number;
}

/**
 * Pin-wall background: dozens of GVC badges drift upward and rotate slowly
 * behind the main UI. Uses CSS @keyframes (not per-frame JS) so animation
 * runs on the browser's compositor — GPU-accelerated and essentially free.
 *
 * Ported from the Claude Design handoff; performance-conscious by design.
 */
export default function FloatingBadges({ count = 90, speed = 1 }: FloatingBadgesProps) {
    // Guard against SSR — window isn't available server-side. The badge list
    // populates on mount, leaving an empty purple bg during initial paint.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const items = useMemo<BadgeItem[]>(() => {
        if (typeof window === "undefined") return [];
        const isMobile = window.innerWidth < 520;
        const n = isMobile ? Math.round(count * 0.55) : count;
        const pool: string[] = [];
        for (let i = 0; i < 8; i++) pool.push(...BADGE_IMAGES);
        pool.sort(() => Math.random() - 0.5);
        return pool.slice(0, n).map((img, i) => {
            const rot = Math.random() * 360;
            return {
                id: i,
                image: img,
                x: Math.random() * 118 - 9,
                yStart: 110 + Math.random() * 100,
                yEnd: -40 - Math.random() * 40,
                size: 50 + Math.random() * (isMobile ? 75 : 155),
                rotation: rot,
                rotationEnd: rot + (Math.random() > 0.5 ? 90 : -90),
                duration: (22 + Math.random() * 38) / speed,
                delay: -(Math.random() * 60),
            };
        });
    }, [count, speed, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ background: PURPLE_BG }}
        >
            <style jsx>{`
                @keyframes vmFloatUpAndSpin {
                    0%   { transform: translateY(var(--y-start)) rotate(var(--rot-start)); }
                    100% { transform: translateY(var(--y-end)) rotate(var(--rot-end)); }
                }
                .floating-badge {
                    animation: vmFloatUpAndSpin var(--duration) linear var(--delay) infinite;
                    will-change: transform;
                }
            `}</style>

            {items.map((it) => (
                <div
                    key={it.id}
                    className="absolute floating-badge"
                    style={{
                        left: `${it.x}%`,
                        width: it.size,
                        height: it.size,
                        // Custom-property hack lets us keep a single @keyframes rule shared
                        // across every badge instance — drastically cheaper than per-tile keyframes.
                        ["--y-start" as string]: `${it.yStart}vh`,
                        ["--y-end" as string]: `${it.yEnd}vh`,
                        ["--rot-start" as string]: `${it.rotation}deg`,
                        ["--rot-end" as string]: `${it.rotationEnd}deg`,
                        ["--duration" as string]: `${it.duration}s`,
                        ["--delay" as string]: `${it.delay}s`,
                    } as React.CSSProperties}
                >
                    {/* Plain img (not next/image) — avoids optimization pipeline overhead
                        for bg-only decorations that don't need priority loading. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={it.image}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover rounded-full"
                        style={{ boxShadow: "0 8px 22px rgba(0,0,0,0.55)" }}
                    />
                </div>
            ))}

            {/* Soft vignette so the center stays readable */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(circle at center, transparent 28%, rgba(60,20,90,0.28) 100%)",
                }}
            />
        </div>
    );
}
