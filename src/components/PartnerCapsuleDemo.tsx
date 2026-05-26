"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { GOLD, GOLD_DEEP } from "@/lib/arcade-tokens";

const CapsuleSphere3D = lazy(() => import("./CapsuleSphere3D"));

const OS_BLUE = "#4A9EFF";
const CAPSULE_GREEN = "#5FD66A";

type Phase = "idle" | "appear" | "anticipate" | "crack" | "reveal" | "collect";

interface PartnerCapsuleDemoProps {
    onRevealed?: () => void;
}

/**
 * Partner-page capsule demo built on the real game's <CapsuleSphere3D>.
 *
 * Phase ladder mirrors VibeCapsule's orchestration: idle → anticipate (charge)
 * → crack (shell shatter + shockwave) → reveal (pin shown via overlay) → idle.
 * We use the "cosmic" tier color so the shell carries the deep purple+gold
 * iridescence that reads on the partner page's blue/ink backdrop.
 */
export default function PartnerCapsuleDemo({ onRevealed }: PartnerCapsuleDemoProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [renderKey, setRenderKey] = useState(0);
    const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }, []);

    useEffect(() => clearTimers, [clearTimers]);

    const playSounds = useCallback(async (kind: "select" | "crack" | "reveal") => {
        if (typeof window === "undefined") return;
        try {
            const sfx = await import("@/lib/sounds");
            if (kind === "select") sfx.playSelectSound?.();
            else if (kind === "crack") sfx.playMatch4Sound?.();
            else if (kind === "reveal") sfx.playMilestoneSound?.();
        } catch {
            /* sound unavailable — ignore */
        }
    }, []);

    const handleTap = useCallback(() => {
        if (phase === "anticipate") {
            // Player skips the anticipate hold — go straight to crack
            clearTimers();
            playSounds("crack");
            setPhase("crack");
            timers.current.push(
                setTimeout(() => {
                    setPhase("reveal");
                    playSounds("reveal");
                    onRevealed?.();
                }, 750),
            );
            return;
        }
        if (phase === "idle" || phase === "appear") {
            clearTimers();
            playSounds("select");
            setPhase("anticipate");
            // Auto-advance to crack after the anticipate charge-up window
            timers.current.push(
                setTimeout(() => {
                    playSounds("crack");
                    setPhase("crack");
                }, 1600),
            );
            timers.current.push(
                setTimeout(() => {
                    setPhase("reveal");
                    playSounds("reveal");
                    onRevealed?.();
                }, 1600 + 750),
            );
        }
    }, [phase, clearTimers, onRevealed, playSounds]);

    const reset = () => {
        clearTimers();
        setRenderKey((k) => k + 1);
        setPhase("idle");
    };

    const isRevealed = phase === "reveal" || phase === "collect";

    return (
        <div className="w-full max-w-[320px] mx-auto">
            <div
                className="relative rounded-2xl px-4 py-6 sm:py-7 overflow-hidden"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(74,158,255,0.18) 0%, rgba(12,8,28,0.94) 55%, rgba(8,4,20,0.96) 100%)",
                    border: `1px solid ${OS_BLUE}55`,
                    boxShadow: `0 0 32px ${OS_BLUE}22, 0 12px 32px -12px rgba(0,0,0,0.6)`,
                }}
            >
                <div
                    className="font-display font-black text-[10px] tracking-[0.28em] uppercase text-center mb-3"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                >
                    Capsule Pull
                </div>

                <div className="relative h-[210px] sm:h-[230px] flex items-center justify-center overflow-hidden">
                    <Suspense fallback={<CapsuleFallback />}>
                        <div
                            className="absolute top-1/2 left-1/2 cursor-pointer select-none"
                            style={{
                                width: 700,
                                height: 700,
                                transform: "translate(-50%, -50%) scale(0.46)",
                                transformOrigin: "center center",
                                visibility: isRevealed ? "hidden" : "visible",
                            }}
                        >
                            <CapsuleSphere3D
                                key={renderKey}
                                tier="cosmic"
                                phase={phase}
                                onTap={handleTap}
                            />
                        </div>
                    </Suspense>

                    {isRevealed && (
                        <>
                            {[0, 1, 2, 3].map((i) => (
                                <span
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        width: 60 + i * 36,
                                        height: 60 + i * 36,
                                        border: `1.5px solid ${OS_BLUE}${["88", "55", "33", "1c"][i]}`,
                                        animation: `vmCapsuleRing 1.4s ease-out ${i * 0.08}s forwards`,
                                        opacity: 0,
                                    }}
                                />
                            ))}
                            <div
                                className="relative z-10 flex items-center justify-center"
                                style={{
                                    width: 140,
                                    height: 140,
                                    animation:
                                        "vmCapsulePinPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/badges/promo/opensea.webp"
                                    alt="Aye Aye, Captain!"
                                    className="w-full h-full object-contain"
                                    draggable={false}
                                    style={{
                                        filter: `drop-shadow(0 0 14px ${OS_BLUE}cc) drop-shadow(0 6px 16px rgba(0,0,0,0.5))`,
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-2 text-center min-h-[76px] flex flex-col items-center justify-start">
                    {isRevealed ? (
                        <div
                            className="flex flex-col items-center gap-2"
                            style={{
                                animation: "vmCapsuleLabelIn 0.5s ease-out 0.05s both",
                            }}
                        >
                            <div
                                className="font-display font-black text-white text-[15px] sm:text-[17px] leading-tight"
                                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                            >
                                Aye Aye, Captain!
                            </div>
                            <span
                                className="font-display font-black text-[9px] tracking-[0.26em] uppercase px-2.5 py-1 rounded"
                                style={{ background: OS_BLUE, color: "#fff" }}
                            >
                                Event
                            </span>
                            <span
                                className="font-display font-black text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded mt-0.5"
                                style={{
                                    color: CAPSULE_GREEN,
                                    border: `1px solid ${CAPSULE_GREEN}`,
                                    textShadow: `0 0 6px ${CAPSULE_GREEN}99`,
                                }}
                            >
                                New Pin Collected!
                            </span>
                        </div>
                    ) : (
                        <div className="font-mundial text-white/55 text-[11px] sm:text-[12px] leading-snug px-2">
                            {phase === "anticipate"
                                ? "Tap again to rip it open."
                                : phase === "crack"
                                  ? "Cracking..."
                                  : "Sealed Pin Capsule. Tap to rip it open and see what drops."}
                        </div>
                    )}
                </div>

                <div className="mt-3 flex justify-center">
                    <button
                        type="button"
                        onClick={isRevealed ? reset : handleTap}
                        disabled={phase === "crack"}
                        className="font-display font-black text-[11px] sm:text-[12px] tracking-[0.22em] uppercase px-5 py-2.5 rounded-full transition-transform hover:-translate-y-[1px] disabled:opacity-50 disabled:hover:translate-y-0"
                        style={{
                            background: isRevealed
                                ? `linear-gradient(180deg, ${OS_BLUE} 0%, #1F5DBF 100%)`
                                : `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                            color: isRevealed ? "#fff" : "#1A0E02",
                            boxShadow: isRevealed
                                ? `0 2px 0 #1F5DBF, 0 4px 12px rgba(0,0,0,0.4)`
                                : `0 2px 0 ${GOLD_DEEP}, 0 4px 12px rgba(0,0,0,0.4)`,
                            textShadow: isRevealed
                                ? "0 1px 0 rgba(0,0,0,0.3)"
                                : "0 1px 0 rgba(255,255,255,0.25)",
                        }}
                    >
                        {isRevealed
                            ? "Rip Another"
                            : phase === "anticipate"
                              ? "Tap to Crack"
                              : "Rip the Capsule"}
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes vmCapsulePinPop {
                    0% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                    60% {
                        opacity: 1;
                        transform: scale(1.12);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes vmCapsuleRing {
                    0% {
                        opacity: 0;
                        transform: scale(0.6);
                    }
                    25% {
                        opacity: 0.9;
                        transform: scale(1.05);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.7);
                    }
                }
                @keyframes vmCapsuleLabelIn {
                    0% {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

function CapsuleFallback() {
    return (
        <div
            className="rounded-full"
            style={{
                width: 180,
                height: 180,
                background:
                    "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4), rgba(140,80,200,0.7) 45%, rgba(40,10,80,0.9) 100%)",
                boxShadow: "0 0 30px rgba(179,102,255,0.45)",
                animation: "vmCapsuleFallbackPulse 1.6s ease-in-out infinite",
            }}
        />
    );
}
