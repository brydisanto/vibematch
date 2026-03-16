"use client";

import { motion } from "framer-motion";
import { User, BookOpen, HelpCircle, Crown } from "lucide-react";
import { useState } from "react";

/* ─── Shared button config ─── */
const BUTTONS = [
    { id: "profile", label: "Profile", loginLabel: "Login", icon: User },
    { id: "pins", label: "Pins", icon: BookOpen, requiresLogin: true },
    { id: "rules", label: "Rules", icon: HelpCircle },
    { id: "leaderboards", label: "Leaderboards", icon: Crown },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  OPTION 1 — Unified Glass Panel                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const ICON_COLORS_1: Record<string, string> = {
    profile: "#4A9EFF",
    pins: "#B366FF",
    rules: "#FFE048",
    leaderboards: "#FF5F1F",
};

function Option1({ isLoggedIn }: { isLoggedIn: boolean }) {
    return (
        <div
            className="rounded-2xl p-1.5 relative overflow-hidden"
            style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
            }}
        >
            {/* Top highlight */}
            <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div className="grid grid-cols-4 gap-1">
                {BUTTONS.map((btn) => {
                    const Icon = btn.icon;
                    const disabled = btn.requiresLogin && !isLoggedIn;
                    const color = disabled ? "rgba(255,255,255,0.25)" : ICON_COLORS_1[btn.id];
                    return (
                        <button
                            key={btn.id}
                            disabled={disabled}
                            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all duration-200 hover:bg-white/[0.06] active:scale-95 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                            <Icon
                                size={20}
                                style={{ color }}
                                className="transition-transform duration-200 group-hover:scale-105"
                            />
                            <span
                                className="text-[11px] font-mundial font-bold tracking-wider uppercase"
                                style={{ color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.70)" }}
                            >
                                {btn.id === "profile" && !isLoggedIn ? btn.loginLabel : btn.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  OPTION 2 — Monochrome Purple Pills                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function Option2({ isLoggedIn }: { isLoggedIn: boolean }) {
    return (
        <div className="grid grid-cols-4 gap-2">
            {BUTTONS.map((btn) => {
                const Icon = btn.icon;
                const disabled = btn.requiresLogin && !isLoggedIn;
                return (
                    <button
                        key={btn.id}
                        disabled={disabled}
                        className="flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{
                            background: disabled
                                ? "linear-gradient(180deg, #1A0633 0%, #120422 100%)"
                                : "linear-gradient(180deg, #2D0B4E 0%, #1A0633 100%)",
                            border: `1px solid ${disabled ? "rgba(179,102,255,0.08)" : "rgba(179,102,255,0.20)"}`,
                            boxShadow: disabled
                                ? "none"
                                : "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.3)",
                        }}
                    >
                        <Icon
                            size={20}
                            style={{
                                color: disabled ? "rgba(179,102,255,0.25)" : "rgba(179,102,255,0.85)",
                            }}
                        />
                        <span
                            className="text-[10px] font-mundial font-bold tracking-wider uppercase"
                            style={{
                                color: disabled ? "rgba(179,102,255,0.25)" : "rgba(179,102,255,0.85)",
                            }}
                        >
                            {btn.id === "profile" && !isLoggedIn ? btn.loginLabel : btn.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  OPTION 3 — Dark Cards with Accent Glow                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const ACCENT_COLORS_3: Record<string, string> = {
    profile: "#4A9EFF",
    pins: "#B366FF",
    rules: "#FFE048",
    leaderboards: "#FF5F1F",
};

function Option3({ isLoggedIn }: { isLoggedIn: boolean }) {
    return (
        <div className="grid grid-cols-4 gap-2.5">
            {BUTTONS.map((btn) => {
                const Icon = btn.icon;
                const disabled = btn.requiresLogin && !isLoggedIn;
                const accent = ACCENT_COLORS_3[btn.id];
                return (
                    <button
                        key={btn.id}
                        disabled={disabled}
                        className="group flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{
                            background: "#1A0835",
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                            borderLeft: "1px solid rgba(255,255,255,0.06)",
                            borderRight: "1px solid rgba(255,255,255,0.06)",
                            borderBottom: disabled
                                ? "3px solid rgba(255,255,255,0.08)"
                                : `3px solid ${accent}`,
                            boxShadow: disabled
                                ? "none"
                                : `0 4px 12px ${accent}18, 0 1px 3px rgba(0,0,0,0.3)`,
                        }}
                    >
                        <Icon
                            size={22}
                            style={{
                                color: disabled ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.70)",
                            }}
                            className="transition-colors duration-200 group-hover:!text-white"
                        />
                        <span
                            className="text-[10px] font-mundial font-bold tracking-wider uppercase transition-colors duration-200"
                            style={{
                                color: disabled ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.50)",
                            }}
                        >
                            {btn.id === "profile" && !isLoggedIn ? btn.loginLabel : btn.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Preview Page                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-white/30 text-[10px] font-mundial uppercase tracking-[0.2em]">
                {label}
            </span>
            <div
                className="w-[390px] rounded-2xl p-5 relative overflow-hidden"
                style={{
                    background: "linear-gradient(180deg, #21083B 0%, #110321 100%)",
                    border: "1px solid rgba(179,102,255,0.15)",
                }}
            >
                {children}
            </div>
        </div>
    );
}

function DesktopFrame({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-white/30 text-[10px] font-mundial uppercase tracking-[0.2em]">
                {label}
            </span>
            <div
                className="w-full max-w-[720px] rounded-2xl p-8 relative overflow-hidden"
                style={{
                    background: "linear-gradient(180deg, #21083B 0%, #110321 100%)",
                    border: "1px solid rgba(179,102,255,0.15)",
                }}
            >
                {children}
            </div>
        </div>
    );
}

export default function ButtonPreview() {
    const [isLoggedIn, setIsLoggedIn] = useState(true);

    return (
        <div
            className="min-h-screen py-12 px-6"
            style={{ background: "#0a0114" }}
        >
            <div className="max-w-[1400px] mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="font-display text-3xl font-black text-white mb-2">
                        Button Section Options
                    </h1>
                    <p className="text-white/40 text-sm font-mundial mb-6">
                        Comparing all 3 designs at mobile (390px) and desktop (720px) widths
                    </p>

                    {/* Login toggle */}
                    <button
                        onClick={() => setIsLoggedIn(!isLoggedIn)}
                        className="px-5 py-2.5 rounded-xl font-mundial font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{
                            background: isLoggedIn
                                ? "linear-gradient(135deg, #2ECC71, #27AE60)"
                                : "linear-gradient(135deg, #FF5F1F, #E74C3C)",
                            color: "#fff",
                            boxShadow: isLoggedIn
                                ? "0 0 20px rgba(46,204,113,0.3)"
                                : "0 0 20px rgba(255,95,31,0.3)",
                        }}
                    >
                        {isLoggedIn ? "Logged In" : "Logged Out"} — Click to Toggle
                    </button>
                </div>

                {/* ═══ OPTION 1 ═══ */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-[#4A9EFF]/20 flex items-center justify-center text-[#4A9EFF] font-display font-black text-sm">1</div>
                        <div>
                            <h2 className="font-display text-xl font-black text-white">Unified Glass Panel</h2>
                            <p className="text-white/40 text-xs font-mundial">Frosted glass container, colored icons only</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-8 justify-center">
                        <PhoneFrame label="Mobile (390px)">
                            <Option1 isLoggedIn={isLoggedIn} />
                        </PhoneFrame>
                        <DesktopFrame label="Desktop (720px)">
                            <Option1 isLoggedIn={isLoggedIn} />
                        </DesktopFrame>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-16" />

                {/* ═══ OPTION 2 ═══ */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-[#B366FF]/20 flex items-center justify-center text-[#B366FF] font-display font-black text-sm">2</div>
                        <div>
                            <h2 className="font-display text-xl font-black text-white">Monochrome Purple Pills</h2>
                            <p className="text-white/40 text-xs font-mundial">Tonal purple, toolbar-like cohesion</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-8 justify-center">
                        <PhoneFrame label="Mobile (390px)">
                            <Option2 isLoggedIn={isLoggedIn} />
                        </PhoneFrame>
                        <DesktopFrame label="Desktop (720px)">
                            <Option2 isLoggedIn={isLoggedIn} />
                        </DesktopFrame>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-16" />

                {/* ═══ OPTION 3 ═══ */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-[#FFE048]/20 flex items-center justify-center text-[#FFE048] font-display font-black text-sm">3</div>
                        <div>
                            <h2 className="font-display text-xl font-black text-white">Dark Cards with Accent Glow</h2>
                            <p className="text-white/40 text-xs font-mundial">Colored bottom borders, neon underglow</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-8 justify-center">
                        <PhoneFrame label="Mobile (390px)">
                            <Option3 isLoggedIn={isLoggedIn} />
                        </PhoneFrame>
                        <DesktopFrame label="Desktop (720px)">
                            <Option3 isLoggedIn={isLoggedIn} />
                        </DesktopFrame>
                    </div>
                </div>
            </div>
        </div>
    );
}
