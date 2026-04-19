"use client";

import { CSSProperties, ReactNode, useState } from "react";
import { GOLD, GOLD_DEEP } from "@/lib/arcade-tokens";

interface ChunkyButtonProps {
    children: ReactNode;
    color?: string;
    deep?: string;
    text?: string;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
    ariaLabel?: string;
}

/**
 * Arcade-style 3D press button. Renders a tall drop-shadow that collapses
 * when pressed, giving a satisfying mechanical-button feel. Ported from the
 * Claude Design Shared.jsx primitive; identical behavior + look.
 */
export default function ChunkyButton({
    children,
    color = GOLD,
    deep = GOLD_DEEP,
    text = "#1A0633",
    onClick,
    disabled,
    className = "",
    style,
    ariaLabel,
}: ChunkyButtonProps) {
    const [pressed, setPressed] = useState(false);

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            onClick={onClick}
            className={`relative select-none transition-transform ${className}`}
            style={{
                background: `linear-gradient(180deg, ${color} 0%, ${deep} 100%)`,
                color: text,
                border: "none",
                borderRadius: 14,
                boxShadow: pressed ? `0 1px 0 ${deep}` : `0 5px 0 ${deep}, 0 8px 14px rgba(0,0,0,0.4)`,
                transform: pressed ? "translateY(4px)" : "translateY(0)",
                textShadow: "0 1px 0 rgba(255,255,255,0.25)",
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                ...style,
            }}
        >
            {children}
        </button>
    );
}
