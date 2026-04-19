"use client";

import Image from "next/image";
import { GOLD } from "@/lib/arcade-tokens";

interface PrizeCoinProps {
    size?: number;
    glow?: boolean;
    spin?: boolean;
    coinColor?: string;
}

const CITIZEN_BADGE = "/badges/any_gvc_1759173799963.webp";

/**
 * Prize Game "coin" — the Citizen of Vibetown badge rendered as a coin. Used
 * anywhere the prize-game economy is surfaced (energy bar, shop drawer, etc.).
 * Optional spin animation for low-credit / attention states.
 */
export default function PrizeCoin({
    size = 56,
    glow = true,
    spin = false,
    coinColor = GOLD,
}: PrizeCoinProps) {
    return (
        <span
            className="relative inline-flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            {glow && (
                <span
                    className="absolute inset-[-25%] pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${coinColor}4d 0%, transparent 60%)` }}
                />
            )}
            <Image
                src={CITIZEN_BADGE}
                alt=""
                width={size}
                height={size}
                style={{
                    width: size,
                    height: size,
                    objectFit: "contain",
                    animation: spin ? "vmCoinSpin 2.2s linear infinite" : undefined,
                    filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.5))",
                }}
            />
            <style jsx>{`
                @keyframes vmCoinSpin {
                    0% { transform: rotateY(0deg); }
                    50% { transform: rotateY(180deg); }
                    100% { transform: rotateY(360deg); }
                }
            `}</style>
        </span>
    );
}
