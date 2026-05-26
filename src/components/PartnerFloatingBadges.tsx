"use client";

import { useEffect, useMemo, useState } from "react";

const BADGE_IMAGES = [
    "/badges/any_gvc_1759173799963.webp",
    "/badges/full_send_maverick_1759173982959.webp",
    "/badges/funky_fresh_1759174001274.webp",
    "/badges/gradient_lover_1759173808918.webp",
    "/badges/visooor_enjoyooor_1759174010233.webp",
    "/badges/multi_type_master_1759173898608.webp",
    "/badges/vibetown_social_club_1759173960008.webp",
    "/badges/hail_mary_heroes_1759173953534.webp",
    "/badges/rainbow_boombox_1759173875165.webp",
    "/badges/checkmate_1759173863329.webp",
    "/badges/fur_the_win_1759173969828.webp",
    "/badges/rainbow_citizen_1759173791000.webp",
    "/badges/yin_n_yang_1759173942484.webp",
    "/badges/science_goggles_1759173835714.webp",
    "/badges/captain_1759173895611.webp",
    "/badges/gamer_1759173856821.webp",
    "/badges/mountain_goat_1759174026593.webp",
    "/badges/surfer_1759173830462.webp",
    "/badges/astro_balls_1759173838889.webp",
    "/badges/gold_member_1759173793799.webp",
    "/badges/king_1759173882056.webp",
    "/badges/cosmic_guardian1759173818340.webp",
    "/badges/rainbow_visor_1759173849941.webp",
    "/badges/one_of_one_1771354994630.webp",
    "/badges/electric_rings_1759173878797.webp",
    "/badges/sugar_rush_1759173860105.webp",
    "/badges/promo/opensea.webp",
    "/badges/highkeymoments_1_1771433768524.webp",
];

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
    opacity: number;
}

export default function PartnerFloatingBadges() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const items = useMemo<BadgeItem[]>(() => {
        if (typeof window === "undefined") return [];
        const isMobile = window.innerWidth < 768;
        const n = isMobile ? 22 : 48;
        const pool: string[] = [];
        for (let i = 0; i < 6; i++) pool.push(...BADGE_IMAGES);
        pool.sort(() => Math.random() - 0.5);
        return pool.slice(0, n).map((img, i) => {
            const rot = Math.random() * 360;
            return {
                id: i,
                image: img,
                x: Math.random() * 110 - 5,
                yStart: 110 + Math.random() * 80,
                yEnd: -30 - Math.random() * 40,
                size: 50 + Math.random() * (isMobile ? 70 : 140),
                rotation: rot,
                rotationEnd: rot + (Math.random() > 0.5 ? 120 : -120),
                duration: 35 + Math.random() * 55,
                delay: -(Math.random() * 90),
                opacity: 0.08 + Math.random() * 0.14,
            };
        });
    }, [mounted]);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <style jsx>{`
                @keyframes vmPartnerBadgeDrift {
                    0% {
                        transform: translateY(var(--y-start)) rotate(var(--rot-start));
                    }
                    100% {
                        transform: translateY(var(--y-end)) rotate(var(--rot-end));
                    }
                }
                .partner-badge {
                    animation: vmPartnerBadgeDrift var(--duration) linear var(--delay) infinite;
                    will-change: transform;
                }
            `}</style>

            {items.map((it) => (
                <div
                    key={it.id}
                    className="absolute partner-badge"
                    style={{
                        left: `${it.x}%`,
                        width: it.size,
                        height: it.size,
                        opacity: it.opacity,
                        ["--y-start" as string]: `${it.yStart}vh`,
                        ["--y-end" as string]: `${it.yEnd}vh`,
                        ["--rot-start" as string]: `${it.rotation}deg`,
                        ["--rot-end" as string]: `${it.rotationEnd}deg`,
                        ["--duration" as string]: `${it.duration}s`,
                        ["--delay" as string]: `${it.delay}s`,
                    } as React.CSSProperties}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={it.image}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover rounded-full"
                        style={{ boxShadow: "0 8px 22px rgba(0,0,0,0.45)" }}
                    />
                </div>
            ))}

            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at center, transparent 30%, rgba(8,4,20,0.55) 100%)",
                }}
            />
        </div>
    );
}
