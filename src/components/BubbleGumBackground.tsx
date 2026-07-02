'use client';

import { useEffect, useState } from 'react';

const NUM_BUBBLES = 22;

/**
 * Full-viewport background used during the "playing" view while the
 * Craig's Bubble Gum Blast event is live. Renders a static Bubble Gum
 * cityscape backdrop image with a set of drifting bubble particles on
 * top for a soft parallax effect.
 *
 * Mirrors FlameBackground's shape (fixed inset-0, pointer-events-none,
 * particles overlaid on an ambient tint) so swapping the two in
 * AppClient is a one-line change.
 */
export default function BubbleGumBackground() {
    const [bubbles, setBubbles] = useState<Array<{
        id: number; left: string; size: number; duration: number; delay: number;
        drift: number; opacity: number;
    }>>([]);

    useEffect(() => {
        const next = Array.from({ length: NUM_BUBBLES }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            size: Math.random() * 22 + 10,
            duration: Math.random() * 14 + 12,
            delay: Math.random() * 12,
            drift: Math.random() * 80 - 40,
            opacity: 0.35 + Math.random() * 0.3,
        }));
        setBubbles(next);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Cityscape backdrop. object-cover crops on wide screens so
                the buildings frame the play surface rather than getting
                letterboxed. Slight brightness pull-down + saturation
                boost keeps the pink palette readable behind gameplay UI. */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: "url(/backgrounds/game-bg-bubble-gum.png)",
                    filter: "brightness(0.88) saturate(1.05)",
                }}
            />

            {/* Vignette + gradient to darken edges + bottom third so the
                tile grid, HUD, and buttons have contrast against the
                busy backdrop. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at center, transparent 40%, rgba(20,4,32,0.35) 100%), linear-gradient(to top, rgba(20,4,32,0.55), transparent 45%)",
                }}
            />

            {/* Drifting bubbles — pure CSS reusing the existing flame-
                particle keyframe from globals.css. Same drift/travel
                variables, just larger + softer with a pink tint. */}
            {bubbles.map(bubble => (
                <div
                    key={bubble.id}
                    className="flame-particle"
                    style={{
                        position: 'absolute',
                        left: bubble.left,
                        bottom: '-8%',
                        width: bubble.size,
                        height: bubble.size,
                        borderRadius: '50%',
                        background:
                            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(255,180,220,0.6) 40%, rgba(210,106,255,0.35) 100%)",
                        boxShadow: "0 0 12px rgba(255,180,220,0.35)",
                        '--flame-drift': `${bubble.drift}px`,
                        '--flame-travel': '-120vh',
                        '--flame-opacity': bubble.opacity,
                        '--flame-duration': `${bubble.duration}s`,
                        '--flame-delay': `${bubble.delay}s`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}
