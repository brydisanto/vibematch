"use client";

import { useEffect, useState, useMemo } from "react";

/**
 * Subtle twinkling starfield matching the game-guide ambient backdrop.
 * Client-only since it needs Math.random() at mount (avoids SSR hydration
 * mismatch from per-render randomization). Renders nothing during the
 * first paint, then fades in once mounted.
 */
export default function ProfileStarfield() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const stars = useMemo(
        () =>
            Array.from({ length: 80 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size: 1 + Math.random() * 2,
                delay: Math.random() * 4,
                dur: 3 + Math.random() * 3,
            })),
        [],
    );

    if (!mounted) return null;

    return (
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
                        animation: `profileTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                    }}
                />
            ))}
            <style>{`
                @keyframes profileTwinkle {
                    0%, 100% { opacity: 0.22; transform: scale(1); }
                    50%      { opacity: 0.85; transform: scale(1.4); }
                }
            `}</style>
        </div>
    );
}
