"use client";

import { GOLD, GOLD_LIGHT, GOLD_DEEP } from "@/lib/arcade-tokens";

interface CapsuleIconProps {
    size?: number;
    /** Override the dominant fill color. The radial-gradient still uses
     *  GOLD_LIGHT for the highlight + GOLD_DEEP for the shade band so
     *  the capsule reads with the same shape language regardless of
     *  tint. Pass COSMIC etc. when surfacing a special reward color. */
    color?: string;
    className?: string;
}

/**
 * Canonical Pin Capsule glyph. Use this anywhere a small "+N capsule"
 * affordance appears (achievement rewards, prize tiles, streak rail,
 * etc.) so the iconography stays consistent.
 *
 * Originally defined inline in src/app/game-guide/GameGuideClient.tsx;
 * extracted here so the achievements panel + toast can reuse it
 * without duplicating the gradient stack. The game guide and arcade
 * landing still inline a copy for now — safe to replace later, but
 * not load-bearing.
 */
export default function CapsuleIcon({ size = 14, color = GOLD, className = "" }: CapsuleIconProps) {
    return (
        <span
            className={`inline-block relative align-middle ${className}`}
            style={{ width: size, height: size }}
        >
            <span
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle at 35% 28%, ${GOLD_LIGHT}, ${color} 60%, ${GOLD_DEEP})`,
                    boxShadow: `inset 0 -2px 3px rgba(0,0,0,0.5), 0 0 4px ${color}`,
                }}
            />
            <span
                className="absolute left-0 right-0"
                style={{
                    top: "50%",
                    height: Math.max(1, Math.round(size / 9)),
                    transform: "translateY(-50%)",
                    background: GOLD_LIGHT,
                    opacity: 0.9,
                }}
            />
        </span>
    );
}
