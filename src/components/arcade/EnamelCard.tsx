"use client";

import { CSSProperties, ReactNode } from "react";
import { GOLD, GOLD_DEEP, GOLD_DIM } from "@/lib/arcade-tokens";

interface EnamelCardProps {
    children: ReactNode;
    /** Rim color (outer gradient light end). Default: gold. */
    color?: string;
    /** Rim shadow color. */
    deep?: string;
    /** Rim gradient middle stop. */
    dim?: string;
    /** Inner surface background. Defaults to the dark brown-black used by gold cards. */
    inner?: string;
    /** Tilt in degrees (mockups use -0.6° / +0.5° for a sticker feel). */
    tilt?: number;
    /** Extra sink depth to stack ChunkyButton-style drop shadow under the card. */
    depth?: number;
    className?: string;
    style?: CSSProperties;
    onClick?: () => void;
    as?: "div" | "button";
}

/**
 * Gold-enamel-pin card shell: metallic gradient rim, inset top highlight,
 * dark recessed inner surface. Used for mode cards, prize strips, and any
 * "chunky" surface in the arcade UI. Ported from Shared.jsx / EnamelCard.
 */
export default function EnamelCard({
    children,
    color = GOLD,
    deep = GOLD_DEEP,
    dim = GOLD_DIM,
    inner = "linear-gradient(180deg, #2A1A0A 0%, #1A1005 100%)",
    tilt = 0,
    depth = 4,
    className = "",
    style,
    onClick,
    as = "div",
}: EnamelCardProps) {
    const Tag = as;
    return (
        <Tag
            onClick={onClick}
            className={`relative rounded-2xl p-[3px] ${onClick ? "cursor-pointer" : ""} ${className}`}
            style={{
                background: `linear-gradient(180deg, ${color} 0%, ${dim} 40%, ${deep} 100%)`,
                boxShadow: `0 ${depth}px 0 ${deep}, 0 ${depth * 2}px ${depth * 4}px rgba(0,0,0,0.45), 0 0 40px ${color}15`,
                transform: tilt ? `rotate(${tilt}deg)` : undefined,
                ...style,
            }}
        >
            <div className="relative rounded-[13px] overflow-hidden" style={{ background: inner }}>
                {/* Subtle top-half rim highlight to sell the enamel reflection */}
                <div
                    className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
                    style={{ background: `linear-gradient(180deg, ${color}14 0%, transparent 100%)` }}
                />
                {children}
            </div>
        </Tag>
    );
}
