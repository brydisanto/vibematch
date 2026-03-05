"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Sample of badge filenames from /public/badges
const BADGE_IMAGES = [
    "/badges/anchorman_1771355025752.webp",
    "/badges/baller_1759173868839.webp",
    "/badges/captain_1759173895611.webp",
    "/badges/doge_1759173842640.webp",
    "/badges/gold_member_1759173793799.webp",
    "/badges/king_1759173882056.webp",
    "/badges/pepe_1759173846260.webp",
    "/badges/rainbow_bubble_goggles_1759173853819.webp",
    "/badges/showtime_1759173995136.webp",
    "/badges/stone_1759173815165.webp",
    "/badges/surfer_1759173830462.webp",
    "/badges/toy_bricks_1759173887659.webp",
    "/badges/chris_favorite_badge_1759173988815.webp",
    "/badges/gud_meat_1759173936766.webp",
    "/badges/party_in_the_back_1759173998578.webp"
];

interface FloatingBadgeDef {
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

export default function FloatingBadges() {
    const [badges, setBadges] = useState<FloatingBadgeDef[]>([]);

    useEffect(() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const count = isMobile ? 30 : 60; // More dense than 35, but less crazy than 320

        // Generate random badges
        const generated = Array.from({ length: count }).map((_, i) => {
            const size = Math.random() * 80 + 40; // 40px to 120px
            const duration = Math.random() * 20 + 20; // 20s to 40s
            return {
                id: i,
                image: BADGE_IMAGES[Math.floor(Math.random() * BADGE_IMAGES.length)],
                x: Math.random() * 100, // 0 to 100%
                yStart: 110, // Start below screen
                yEnd: -20, // Move above screen
                size,
                rotation: Math.random() * 360,
                rotationEnd: Math.random() * 360 + (Math.random() > 0.5 ? 360 : -360), // Rotate while moving
                duration,
                delay: Math.random() * 15,
            };
        });
        setBadges(generated);
    }, []);

    // Return empty div on server, or while generating
    if (badges.length === 0) return <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" />;

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {badges.map((b) => (
                <div
                    key={b.id}
                    className="absolute pointer-events-none floating-badge"
                    style={{
                        left: `${b.x}%`,
                        width: b.size,
                        height: b.size,
                        "--y-start": `${b.yStart}vh`,
                        "--y-end": `${b.yEnd}vh`,
                        "--rot-start": `${b.rotation}deg`,
                        "--rot-end": `${b.rotationEnd}deg`,
                        "--duration": `${b.duration}s`,
                        "--delay": `${b.delay}s`,
                    } as React.CSSProperties}
                >
                    <Image
                        src={b.image}
                        alt=""
                        width={b.size}
                        height={b.size}
                        className="rounded-full shadow-2xl object-cover mix-blend-normal"
                        loading="lazy"
                    />
                </div>
            ))}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(circle at center, rgba(143,32,179,0.05) 15%, rgba(91,21,122,0.2) 60%, rgba(45,8,64,0.4) 100%)"
                }}
            />
        </div>
    );
}
