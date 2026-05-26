"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GOLD, GOLD_DEEP } from "@/lib/arcade-tokens";

const OS_BLUE = "#4A9EFF";
const CAPSULE_GREEN = "#5FD66A";

type Stage = "sealed" | "shaking" | "opening" | "revealed";

interface PartnerCapsuleDemoProps {
    /** Optional callback when the capsule reaches the revealed state. */
    onRevealed?: () => void;
}

/**
 * Self-contained capsule-rip demo for the partner page.
 *
 * Stage flow: sealed → shaking (~0.6s) → opening (~0.6s) → revealed (idle
 * until reset). All visuals are CSS — no sprites, no asset dependencies
 * beyond the OpenSea pin image so the component is easy to swap if the
 * partner pin changes.
 */
export default function PartnerCapsuleDemo({ onRevealed }: PartnerCapsuleDemoProps) {
    const [stage, setStage] = useState<Stage>("sealed");
    const stageTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const clearTimers = useCallback(() => {
        stageTimers.current.forEach(clearTimeout);
        stageTimers.current = [];
    }, []);

    useEffect(() => clearTimers, [clearTimers]);

    const handleRip = () => {
        if (stage !== "sealed" && stage !== "revealed") return;
        clearTimers();

        // Best-effort sound. Sounds module no-ops if audio context is
        // locked (no prior gesture), so wrap defensively.
        playSounds("rip");

        setStage("shaking");
        stageTimers.current.push(
            setTimeout(() => {
                setStage("opening");
                playSounds("open");
            }, 600),
        );
        stageTimers.current.push(
            setTimeout(() => {
                setStage("revealed");
                playSounds("reveal");
                onRevealed?.();
            }, 1200),
        );
    };

    const isOpenedOrAfter = stage === "opening" || stage === "revealed";
    const isShakingOrAfter = stage === "shaking" || isOpenedOrAfter;

    return (
        <div className="w-full max-w-[320px] mx-auto">
            <div
                className="relative rounded-2xl px-4 py-6 sm:py-7 overflow-hidden h-full"
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

                <div className="relative h-[200px] sm:h-[220px] flex items-center justify-center">
                    {/* Glow halo */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: isOpenedOrAfter
                                ? `radial-gradient(circle at 50% 50%, ${OS_BLUE}55 0%, ${OS_BLUE}11 35%, transparent 65%)`
                                : `radial-gradient(circle at 50% 50%, ${GOLD}33 0%, ${GOLD}0d 30%, transparent 60%)`,
                            transition: "background 600ms ease-out",
                        }}
                    />

                    {/* Concentric rings — appear during reveal */}
                    {isOpenedOrAfter &&
                        [0, 1, 2, 3].map((i) => (
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

                    {/* Sparkles — visible only in sealed/shaking state */}
                    {!isOpenedOrAfter && (
                        <div className="absolute inset-0 pointer-events-none">
                            {SPARKLE_POSITIONS.map((p, i) => (
                                <span
                                    key={i}
                                    className="absolute rounded-full"
                                    style={{
                                        left: `${p.x}%`,
                                        top: `${p.y}%`,
                                        width: p.s,
                                        height: p.s,
                                        background: GOLD,
                                        boxShadow: `0 0 ${p.s * 1.5}px ${GOLD}`,
                                        animation: `vmCapsuleSparkle ${p.d}s ease-in-out ${p.delay}s infinite`,
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Capsule body (sealed or breaking apart) */}
                    {!isOpenedOrAfter && (
                        <div
                            className="relative"
                            style={{
                                width: 110,
                                height: 140,
                                animation:
                                    stage === "shaking"
                                        ? "vmCapsuleShake 0.6s ease-in-out"
                                        : isShakingOrAfter
                                          ? undefined
                                          : "vmCapsuleIdle 3.2s ease-in-out infinite",
                            }}
                        >
                            <CapsuleVisual />
                        </div>
                    )}

                    {/* Burst flash */}
                    {stage === "opening" && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: `radial-gradient(circle at 50% 50%, #fff 0%, ${OS_BLUE} 25%, transparent 60%)`,
                                animation: "vmCapsuleBurst 0.6s ease-out forwards",
                            }}
                        />
                    )}

                    {/* Pin reveal */}
                    {isOpenedOrAfter && (
                        <div
                            className="relative z-10 flex items-center justify-center"
                            style={{
                                width: 130,
                                height: 130,
                                animation: "vmCapsulePinPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
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
                    )}
                </div>

                <div className="mt-4 text-center min-h-[88px] flex flex-col items-center justify-start">
                    {stage === "revealed" ? (
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
                            Sealed Pin Capsule. Tap to rip it open and see what
                            drops.
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-center">
                    <button
                        type="button"
                        onClick={handleRip}
                        disabled={stage === "shaking" || stage === "opening"}
                        className="font-display font-black text-[11px] sm:text-[12px] tracking-[0.22em] uppercase px-5 py-2.5 rounded-full transition-transform hover:-translate-y-[1px] disabled:opacity-50 disabled:hover:translate-y-0"
                        style={{
                            background:
                                stage === "revealed"
                                    ? `linear-gradient(180deg, ${OS_BLUE} 0%, #1F5DBF 100%)`
                                    : `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                            color: stage === "revealed" ? "#fff" : "#1A0E02",
                            boxShadow:
                                stage === "revealed"
                                    ? `0 2px 0 #1F5DBF, 0 4px 12px rgba(0,0,0,0.4)`
                                    : `0 2px 0 ${GOLD_DEEP}, 0 4px 12px rgba(0,0,0,0.4)`,
                            textShadow:
                                stage === "revealed"
                                    ? "0 1px 0 rgba(0,0,0,0.3)"
                                    : "0 1px 0 rgba(255,255,255,0.25)",
                        }}
                    >
                        {stage === "revealed" ? "Rip Another" : "Rip the Capsule"}
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes vmCapsuleIdle {
                    0%,
                    100% {
                        transform: translateY(0) rotate(-2deg);
                    }
                    50% {
                        transform: translateY(-6px) rotate(2deg);
                    }
                }
                @keyframes vmCapsuleShake {
                    0%,
                    100% {
                        transform: translateX(0) rotate(0deg);
                    }
                    10% {
                        transform: translateX(-4px) rotate(-4deg);
                    }
                    20% {
                        transform: translateX(5px) rotate(4deg);
                    }
                    30% {
                        transform: translateX(-6px) rotate(-5deg);
                    }
                    40% {
                        transform: translateX(6px) rotate(5deg);
                    }
                    50% {
                        transform: translateX(-7px) rotate(-6deg);
                    }
                    60% {
                        transform: translateX(7px) rotate(6deg);
                    }
                    70% {
                        transform: translateX(-5px) rotate(-4deg);
                    }
                    80% {
                        transform: translateX(5px) rotate(4deg);
                    }
                    90% {
                        transform: translateX(-3px) rotate(-2deg);
                    }
                }
                @keyframes vmCapsuleBurst {
                    0% {
                        opacity: 0;
                        transform: scale(0.4);
                    }
                    30% {
                        opacity: 1;
                        transform: scale(1.2);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(2);
                    }
                }
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
                @keyframes vmCapsuleSparkle {
                    0%,
                    100% {
                        opacity: 0.25;
                        transform: scale(0.7);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.3);
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

const SPARKLE_POSITIONS = [
    { x: 18, y: 28, s: 4, d: 2.2, delay: 0 },
    { x: 78, y: 22, s: 5, d: 2.6, delay: 0.4 },
    { x: 24, y: 70, s: 3, d: 1.8, delay: 0.8 },
    { x: 80, y: 65, s: 4, d: 2.4, delay: 1.2 },
    { x: 50, y: 12, s: 3, d: 2, delay: 0.6 },
    { x: 12, y: 50, s: 3, d: 2.8, delay: 1.6 },
    { x: 86, y: 48, s: 4, d: 2.2, delay: 0.2 },
];

function CapsuleVisual() {
    return (
        <div className="relative w-full h-full">
            {/* Bottom half — blue */}
            <div
                className="absolute left-0 right-0 bottom-0 rounded-b-[55px]"
                style={{
                    height: "50%",
                    background: `linear-gradient(180deg, #2D7AD9 0%, #1F5DBF 60%, #0E3F8E 100%)`,
                    boxShadow:
                        "inset -6px -6px 12px rgba(0,0,0,0.45), inset 4px 4px 8px rgba(255,255,255,0.18)",
                }}
            />
            {/* Top half — gold */}
            <div
                className="absolute left-0 right-0 top-0 rounded-t-[55px]"
                style={{
                    height: "50%",
                    background: `linear-gradient(180deg, #FFDF6B 0%, #F5B936 55%, #C98F1A 100%)`,
                    boxShadow:
                        "inset -6px 6px 12px rgba(0,0,0,0.3), inset 4px -4px 8px rgba(255,255,255,0.45)",
                }}
            />
            {/* Seam line */}
            <div
                className="absolute left-1 right-1"
                style={{
                    top: "calc(50% - 2px)",
                    height: 4,
                    background:
                        "linear-gradient(90deg, rgba(0,0,0,0.6), rgba(0,0,0,0.85), rgba(0,0,0,0.6))",
                    borderRadius: 2,
                    boxShadow: "0 1px 0 rgba(255,255,255,0.2)",
                }}
            />
            {/* Top highlight */}
            <div
                className="absolute"
                style={{
                    left: "22%",
                    top: "10%",
                    width: "30%",
                    height: "16%",
                    background:
                        "radial-gradient(ellipse, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
                    borderRadius: "50%",
                    transform: "rotate(-18deg)",
                }}
            />
        </div>
    );
}

async function playSounds(kind: "rip" | "open" | "reveal") {
    if (typeof window === "undefined") return;
    try {
        const sfx = await import("@/lib/sounds");
        if (kind === "rip") {
            sfx.playSelectSound();
        } else if (kind === "open") {
            sfx.playMatch4Sound?.();
        } else if (kind === "reveal") {
            sfx.playMilestoneSound?.();
        }
    } catch {
        // sounds are best-effort; ignore in unsupported environments
    }
}
