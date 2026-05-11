"use client";

import { Cell, Position, SpecialTileType } from "@/lib/gameEngine";
import { TIER_COLORS, TIER_BORDER_COLORS, BadgeTier } from "@/lib/badges";
import { ScorePopup, MatchEffect } from "@/lib/useGame";
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

const EMPTY_HINT_SET = new Set<string>();

/* ===== EFFECT PRIORITY SYSTEM ===== */
const EFFECT_PRIORITY: Record<string, number> = {
    ComboStreakBanner: 6,
    ShapeAnnouncement: 5,
    ScreenFlash: 4,
    TileRingBurst: 3,
    TileMatchFlash: 2,
    ScreenEdgeGlow: 1,
};
const MAX_SIMULTANEOUS_EFFECTS = typeof window !== 'undefined' && window.innerWidth < 768 ? 4 : 7;

/* ===== RESPONSIVE PARTICLE CAPS ===== */
function getParticleCap(): number {
    if (typeof window === 'undefined') return 140;
    const w = window.innerWidth;
    if (w < 768) return 16;
    if (w < 1024) return 40;
    return 80;
}

interface GameBoardProps {
    board: Cell[][];
    selectedTile: Position | null;
    onTileClick: (pos: Position) => void;
    onSwipe?: (from: Position, to: Position) => void;
    scorePopups: ScorePopup[];
    isAnimating: boolean;
    matchEffect: MatchEffect | null;
    combo: number;
    score: number;
    isDealing?: boolean;
    hintCells?: Set<string>;
    invalidSwapCells?: { row: number; col: number }[] | null;
    swapAnim?: { pos1: Position; pos2: Position } | null;
    isPrizeGame?: boolean;
}

/* ===== FULL-TILE IMMERSIVE SPECIAL EFFECTS ===== */
function BombOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_0_20px_rgba(255,0,0,0.8)]">
            <div
                className="bomb-border absolute inset-0 border-[3px] sm:border-[4px] border-[#FF3333] rounded-lg sm:rounded-xl"
            />
            {/* Warning crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center opacity-80">
                <div className="w-[80%] h-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div className="absolute h-[80%] w-[2px] bg-[#FFE048] shadow-[0_0_8px_#FFE048]" />
                <div
                    className="bomb-core absolute w-4 h-4 rounded-full bg-[#FF3333] shadow-[0_0_15px_#FF3333]"
                />
            </div>
        </div>
    );
}

function LaserPartyOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_0_24px_rgba(74,158,255,0.9)]">
            {/* Pulsing bright border */}
            <div
                className="laser-border absolute inset-0 border-[3px] sm:border-[4px] border-[#4A9EFF] rounded-lg sm:rounded-xl"
            />
            {/* Scanning laser lines — horizontal + vertical */}
            <div className="laser-scan-h absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4AE0FF] to-transparent shadow-[0_0_12px_#4AE0FF,0_0_24px_#4A9EFF] opacity-90" />
            <div className="laser-scan-v absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#4AE0FF] to-transparent shadow-[0_0_12px_#4AE0FF,0_0_24px_#4A9EFF] opacity-90" />
            {/* Center energy core */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="laser-core w-3 h-3 rounded-full bg-[#4AE0FF] shadow-[0_0_16px_#4AE0FF,0_0_32px_#4A9EFF]" />
            </div>
        </div>
    );
}

function CosmicBlastOverlay() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg sm:rounded-xl overflow-hidden">
            {/* Outer pulsing inset glow */}
            <div
                className="cosmic-outer-glow absolute inset-0 rounded-lg sm:rounded-xl"
                style={{
                    boxShadow: "inset 0 0 10px rgba(179,102,255,0.7), inset 0 0 20px rgba(255,107,157,0.35)",
                }}
            />
            {/* Swirling galactic vortex */}
            <div
                className="cosmic-ring absolute -inset-6"
                style={{
                    background: "conic-gradient(from 0deg at 50% 50%, rgba(179,102,255,0) 0%, rgba(255,107,157,0.85) 25%, rgba(179,102,255,0) 50%, rgba(74,158,255,0.85) 75%, rgba(179,102,255,0) 100%)"
                }}
            />
            {/* Energy Core */}
            <div
                className="cosmic-glow absolute inset-[10%] rounded-full border-2 border-[#B366FF]/60"
                style={{
                    background: "radial-gradient(circle, rgba(179,102,255,0.35) 0%, rgba(179,102,255,0.08) 60%, transparent 100%)",
                }}
            />
            {/* Center pinpoint */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="cosmic-core-dot w-2.5 h-2.5 rounded-full"
                    style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(179,102,255,0.5) 60%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(179,102,255,0.9), 0 0 14px rgba(179,102,255,0.5)",
                    }}
                />
            </div>
        </div>
    );
}

/* ===== TIER CSS CLASS MAP ===== */
const TIER_IDLE_CLASS: Record<BadgeTier, string> = {
    blue: "tile-tier-blue",
    silver: "tile-tier-silver",
    special: "",
    gold: "tile-tier-gold",
    cosmic: "tile-tier-cosmic",
};

/* ===== MATCH PARTICLES — Enhanced per-tier ===== */
function MatchParticles({ effect }: { effect: MatchEffect }) {
    const [particles, setParticles] = useState<
        { id: number; x: number; y: number; tx: number; ty: number; color: string; size: number; delay: number; rotate: number; isSquare: boolean; duration: number; initialScale: number }[]
    >([]);

    const particleCap = useMemo(() => getParticleCap(), []);

    useEffect(() => {
        // Tier-biased color palettes — the burst tells the player WHICH
        // tier they popped without reading any text. The dominant matched
        // tier picks the palette; if no tier (rare edge case) we fall back
        // to the neutral mixed palette.
        const PALETTES: Record<string, string[]> = {
            // Cosmic match → purple/pink/magenta with white sparkle
            cosmic: ["#B366FF", "#FF6B9D", "#D8B4FE", "#FF6BD8", "#FFFFFF", "#E879F9", "#FFE048"],
            // Gold match → warm yellows/oranges + white
            gold:   ["#FFE048", "#FFB800", "#FFF4B0", "#FF8C00", "#FFFFFF", "#FF5F1F", "#FFD700"],
            // Silver match → cool blues/cyans + white
            silver: ["#4A9EFF", "#7DD3FC", "#22D3EE", "#A5F3FC", "#FFFFFF", "#0EA5E9", "#FFE048"],
            // Blue (common) tier → green/cyan tints. Still vibrant so a
            // basic 3-match doesn't feel drab.
            blue:   ["#2EFF2E", "#4ADE80", "#22D3EE", "#A7F3D0", "#FFFFFF", "#FFE048", "#86EFAC"],
            // Special collection-only badges — same neutral mix as fallback.
            special: ["#FFE048", "#FF5F1F", "#B366FF", "#4A9EFF", "#FF6B9D", "#2EFF2E", "#FFFFFF"],
        };
        const colors = PALETTES[effect.matchedBadgeTier ?? "blue"] ?? PALETTES.blue;

        // Particle counts bumped on every tier — baseline 3-matches were
        // feeling flat. Mobile cap (16) still applies, so the bigger
        // numbers only fully express on tablet/desktop.
        const rawCount =
            effect.intensity === "ultra" ? 160
                : effect.intensity === "mega" ? 110
                    : effect.intensity === "big" ? 80
                        : 55;
        const count = Math.min(rawCount, particleCap);

        const newParticles = Array.from({ length: count }, (_, i) => {
            const origin = effect.positions[Math.floor(Math.random() * effect.positions.length)];
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
            const distance =
                effect.intensity === "ultra" ? 180 + Math.random() * 320
                    : effect.intensity === "mega" ? 145 + Math.random() * 260
                        : effect.intensity === "big" ? 120 + Math.random() * 220
                            : 100 + Math.random() * 180;

            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance + 50 + Math.random() * 40;

            return {
                id: i,
                x: (origin.col / 8) * 100 + 6.25,
                y: (origin.row / 8) * 100 + 6.25,
                tx,
                ty,
                color: colors[Math.floor(Math.random() * colors.length)],
                // Slightly larger particles across every tier for more
                // legibility, especially on the baseline tier.
                size: effect.intensity === "ultra" ? 8 + Math.random() * 16
                    : effect.intensity === "mega" ? 6 + Math.random() * 13
                        : effect.intensity === "big" ? 5 + Math.random() * 12
                            : 5 + Math.random() * 10,
                delay: Math.random() * 0.1,
                rotate: Math.random() * 720 - 360,
                isSquare: Math.random() > 0.55,
                duration: 0.75 + Math.random() * 0.55,
                initialScale: 2 + Math.random() * 2.4,
            };
        });

        setParticles(newParticles);
    }, [effect, particleCap]);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="match-particle"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        borderRadius: p.isSquare ? "2px" : "50%",
                        "--p-tx": `${p.tx}px`,
                        "--p-ty": `${p.ty}px`,
                        "--p-scale": p.initialScale,
                        "--p-duration": `${p.duration}s`,
                        "--p-delay": `${p.delay}s`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}

/* ===== TILE RING BURST — CSS-only expanding ring from each matched tile =====
 *
 * Now fires on every tier (was big+ only). Baseline 3-matches felt flat
 * without it; a small ring here is a cheap, legible "yes, that landed"
 * cue. Color is tier-keyed: gold base, escalates to orange/cosmic on
 * bigger matches.
 */
function TileRingBurst({ effect }: { effect: MatchEffect }) {
    const ringColor =
        effect.intensity === "ultra" ? "#B366FF"
            : effect.intensity === "mega" ? "#FF5F1F"
                : "#FFE048";

    // Baseline scale ~3, escalates up to 6 for ultra. Smaller ring on
    // normal matches feels right — pop, not boom.
    const finalScale =
        effect.intensity === "ultra" ? 6
            : effect.intensity === "mega" ? 5
                : effect.intensity === "big" ? 4
                    : 3;

    return (
        <>
            {effect.positions.map((pos, i) => (
                <div
                    key={i}
                    className="absolute rounded-full pointer-events-none ring-burst-effect"
                    style={{
                        left: `${(pos.col / 8) * 100 + 6.25}%`,
                        top: `${(pos.row / 8) * 100 + 6.25}%`,
                        width: 28,
                        height: 28,
                        marginLeft: -14,
                        marginTop: -14,
                        border: `${effect.intensity === "normal" ? 2 : 3}px solid ${ringColor}`,
                        '--ring-final-scale': finalScale,
                        animationDelay: `${i * 0.035}s`,
                    } as React.CSSProperties}
                />
            ))}
        </>
    );
}

/* ===== FEATURE 1: TILE MATCH FLASH — white-hot crunch pop at each matched tile ===== */
function TileMatchFlash({ effect, cellSize }: { effect: MatchEffect; cellSize: number }) {
    if (cellSize === 0) return null;

    return (
        <>
            {effect.positions.map((pos, i) => (
                <div
                    key={i}
                    className="absolute pointer-events-none tile-match-flash-effect"
                    style={{
                        left: cellSize * pos.col + cellSize / 2,
                        top: cellSize * pos.row + cellSize / 2,
                        zIndex: 35,
                    }}
                >
                    <div
                        style={{
                            width: cellSize * 0.9,
                            height: cellSize * 0.9,
                            transform: "translateX(-50%) translateY(-50%)",
                            background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,224,72,0.6) 45%, transparent 70%)",
                            borderRadius: "50%",
                        }}
                    />
                </div>
            ))}
        </>
    );
}

/* ===== SHOCKWAVE RING — every match tier =====
 *
 * Was big+ only; now fires on basic 3-matches too with a smaller scale
 * (handled in CSS via the .shockwave-ring base class). Single radial
 * wave at the match center sells the impact cheaply.
 */
function ShockwaveRing({ effect }: { effect: MatchEffect }) {
    const centerPos = effect.positions[Math.floor(effect.positions.length / 2)];
    const extraClass =
        effect.intensity === "ultra" ? "shockwave-ring-ultra"
            : effect.intensity === "mega" ? "shockwave-ring-mega"
                : effect.intensity === "big" ? ""
                    : "shockwave-ring-baseline";

    return (
        <div
            className={`shockwave-ring ${extraClass}`}
            style={{
                left: `${(centerPos.col / 8) * 100 + 6.25}%`,
                top: `${(centerPos.row / 8) * 100 + 6.25}%`,
            }}
        />
    );
}

/* ===== SCREEN EDGE GLOW — Big+ matches ===== */
function ScreenEdgeGlow({ intensity }: { intensity: string }) {
    if (intensity === "normal") return null;
    const cls =
        intensity === "ultra" ? "screen-edge-glow-ultra"
            : intensity === "mega" ? "screen-edge-glow-mega"
                : "screen-edge-glow";
    return <div className={`screen-edge-glow ${cls}`} />;
}

/* ===== SCREEN FLASH — CSS-only =====
 *
 * Baseline matches now flash gold-tinted (was a faint neutral white)
 * and at a noticeably stronger opacity so even a basic 3-match has a
 * visible "crack" of brightness across the board. Bigger tiers were
 * already fine; just bumped baseline.
 */
function ScreenFlash({ intensity }: { intensity: string }) {
    const color =
        intensity === "ultra" ? "rgba(179, 102, 255, 0.30)"
            : intensity === "mega" ? "rgba(255, 95, 31, 0.24)"
                : intensity === "big" ? "rgba(255, 224, 72, 0.18)"
                    : "rgba(255, 224, 72, 0.14)";

    const durClass =
        intensity === "ultra" ? "screen-flash--ultra"
            : intensity === "mega" ? "screen-flash--mega"
                : "screen-flash--normal";

    return (
        <div
            className={`absolute inset-0 pointer-events-none z-30 rounded-2xl screen-flash-effect ${durClass}`}
            style={{ backgroundColor: color }}
        />
    );
}



/* ===== POWER TILE DETONATION FLASH — full viewport via portal =====
 *
 * Type-coded full-screen detonation effect when a power tile triggers.
 * Renders to document.body via portal so it covers the entire viewport
 * including everything outside the board (HUD, padding, edges) — the
 * board has transformed ancestors (Framer Motion) which would
 * otherwise constrain `position: fixed` to the board's bounding box.
 *
 *  - Bomb        → red shockwave + dark vignette ring expanding outward
 *  - Vibestreak  → cyan flash + horizontal scan-line streaks
 *  - Cosmic Blast → purple/pink radial vortex with conic ray sweep
 *
 * If multiple power tiles trigger in one turn (chain reaction), the
 * highest-impact type wins (cosmic > vibestreak > bomb).
 */
function PowerTileDetonationFlash({ effect }: { effect: MatchEffect }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const triggered = effect.specialTilesTriggered;
    if (!mounted || !triggered || triggered.length === 0) return null;

    // Pick dominant type — cosmic always wins, then vibestreak, then bomb.
    const types = new Set(triggered.map(t => t.type));
    const dominant = types.has("cosmic_blast") ? "cosmic_blast"
        : types.has("vibestreak") ? "vibestreak"
            : "bomb";

    const overlay = (() => {
        if (dominant === "bomb") {
            return (
                <>
                    {/* Red wash, brightest at center, fading to dark edges */}
                    <div className="absolute inset-0 power-screen-bomb-wash" />
                    {/* Dark vignette ring expanding outward — explosion shockwave */}
                    <div className="absolute inset-0 power-screen-bomb-vignette" />
                </>
            );
        }
        if (dominant === "vibestreak") {
            return (
                <>
                    {/* Cyan tint flash */}
                    <div className="absolute inset-0 power-screen-laser-wash" />
                    {/* Horizontal scan-line streaks across the viewport */}
                    <div className="absolute inset-0 power-screen-laser-streaks" />
                </>
            );
        }
        // cosmic_blast
        return (
            <>
                {/* Radial purple/pink wash */}
                <div className="absolute inset-0 power-screen-cosmic-wash" />
                {/* Slow-spinning conic ray sweep — galactic vortex */}
                <div className="absolute inset-0 power-screen-cosmic-vortex" />
            </>
        );
    })();

    return createPortal(
        <div
            // The wrapper is `position: fixed` so it covers the whole
            // viewport. z-index sits above the game UI but below any
            // top-of-screen modals (toasts, primer, capsule sequence).
            className="fixed inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: 80 }}
            // Key on timestamp so two consecutive detonations re-mount
            // and re-run their entry keyframes instead of the second one
            // being a no-op because the elements are already there.
            key={effect.timestamp}
        >
            {overlay}
        </div>,
        document.body
    );
}

/* ===== POWER TILE CREATION MOMENT =====
 *
 * Slammed-in label + tier-colored expanding ring at each spawn position
 * when a 4+ match creates a power tile. Currently the spawn is silent
 * visually — the player just notices a special tile sitting on the
 * board after the cascade settles. Now they get a beat to register
 * "I just made this."
 */
function PowerTileCreationMoment({ effect, cellSize }: { effect: MatchEffect; cellSize: number }) {
    const created = effect.specialTilesCreated;
    if (!created || created.length === 0 || cellSize === 0) return null;

    const STYLES = {
        bomb:         { label: "BOMB!",         color: "#FF3333", glow: "rgba(255,51,51,0.85)" },
        vibestreak:   { label: "LASER PARTY!",  color: "#4AE0FF", glow: "rgba(74,224,255,0.85)" },
        cosmic_blast: { label: "COSMIC BLAST!", color: "#B366FF", glow: "rgba(179,102,255,0.95)" },
    };

    // Pick the highest-tier creation as the headline label (one banner
    // even if a turn happens to spawn multiple specials — rare but
    // happens on cascade-side-effect creations).
    const types = new Set(created.map(c => c.type));
    const headline = types.has("cosmic_blast") ? STYLES.cosmic_blast
        : types.has("vibestreak") ? STYLES.vibestreak
            : STYLES.bomb;

    return (
        <>
            {/* Per-spawn rings — color-coded to the special being made. */}
            {created.map((c, i) => {
                const style = STYLES[c.type];
                return (
                    <div
                        key={i}
                        className="absolute pointer-events-none power-tile-create-ring"
                        style={{
                            left: cellSize * c.pos.col + cellSize / 2,
                            top: cellSize * c.pos.row + cellSize / 2,
                            zIndex: 38,
                            width: cellSize * 1.4,
                            height: cellSize * 1.4,
                            marginLeft: -(cellSize * 1.4) / 2,
                            marginTop: -(cellSize * 1.4) / 2,
                            border: `4px solid ${style.color}`,
                            borderRadius: "50%",
                            boxShadow: `0 0 30px ${style.glow}, inset 0 0 20px ${style.glow}`,
                            animationDelay: `${i * 0.08}s`,
                        }}
                    />
                );
            })}

            {/* Slammed-in headline label, screen-center. Uses the same
                layered treatment as the combo banners: white fill +
                tier-colored stroke + solid drop-shadow band beneath in
                the same color, so the text reads as four stacked layers
                (white body → colored outline → colored shadow band →
                blurry black shadow). */}
            <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-39 power-tile-create-label"
                style={{ top: "-15%" }}
            >
                <div
                    className="font-display font-black text-5xl sm:text-7xl uppercase tracking-tight select-none"
                    style={{
                        color: "#FFFFFF",
                        WebkitTextStroke: `5px ${headline.color}`,
                        paintOrder: "stroke fill",
                        textShadow: `0 0 35px ${headline.glow}, 0 0 70px ${headline.glow}, 0 6px 0 ${headline.color}, 0 8px 16px rgba(0,0,0,0.85)`,
                        letterSpacing: "-0.01em",
                    }}
                >
                    {headline.label}
                </div>
            </div>
        </>
    );
}

/* ===== COMBO STREAK BANNER — Street Fighter style, CSS-only =====
 *
 * Reverted to the existing production treatment per user feedback:
 * the pulsing radial wash + conic ray sweep + drop-shadow glow throb
 * added in the juice pass were reading as an overwhelming color
 * burst that obscured the board. Only the keysmash label string and
 * the tier color palette are juice-pass; everything else here is
 * the pre-juice production banner exactly.
 */
function ComboStreakBanner({ effect }: { effect: MatchEffect }) {
    if (effect.combo < 2) return null;

    // Combo 6+ uses the intentional keysmash label — the joke is that
    // hitting a 6-combo is so overwhelming you just bash the keyboard.
    // Don't "fix" this string. It's the punchline.
    //
    // All tiers share the "layered" treatment that RAD! had: WHITE fill
    // + tier-colored stroke + matching solid drop-shadow underneath.
    // The white body + colored outline + colored shadow band gives the
    // text a stacked, dimensional read that solid-color fills (the old
    // VIBES / ELECTRIC / MAX STOKED treatment) didn't have.
    const COMBO_TIERS = [
        // Keysmash is 22 chars — at the standard text-6xl/8xl sizing it
        // overflows the viewport on mobile. Drop to text-3xl on phones
        // (still chunky enough to read as a combo banner) while keeping
        // text-7xl on sm+ where there's room.
        { minCombo: 6, label: "rkf4trrgrggrgh;[['11]", fill: "#FFFFFF", stroke: "#B366FF", shadow: "rgba(179,102,255,0.95)", rotate: -2, size: "text-3xl sm:text-7xl", italic: true },
        { minCombo: 5, label: "MAX STOKED!!!!",   fill: "#FFFFFF", stroke: "#B366FF", shadow: "rgba(179,102,255,0.85)", rotate: 3,  size: "text-6xl sm:text-8xl", italic: false },
        { minCombo: 4, label: "ELECTRIC!!!",      fill: "#FFFFFF", stroke: "#FFE048", shadow: "rgba(255,224,72,0.95)",  rotate: -2, size: "text-6xl sm:text-8xl", italic: true },
        { minCombo: 3, label: "EPIC!!",           fill: "#FFFFFF", stroke: "#FF6B9D", shadow: "rgba(255,107,157,0.9)",  rotate: 2,  size: "text-6xl sm:text-8xl", italic: false },
        // Combo 2 rotates between RAD!/DOPE!/SICK! per banner — `labelPool`
        // overrides `label` when present. Pick is locked per-banner via
        // useMemo below so it doesn't flicker mid-animation.
        { minCombo: 2, label: "RAD!", labelPool: ["RAD!", "DOPE!", "SICK!"] as readonly string[], fill: "#FFFFFF", stroke: "#FFEE2E", shadow: "rgba(255,238,46,0.9)", rotate: -3, size: "text-7xl sm:text-9xl", italic: false },
    ];

    const tier = COMBO_TIERS.find(t => effect.combo >= t.minCombo) ?? COMBO_TIERS[COMBO_TIERS.length - 1];

    // Lock the random label pick for the banner's full lifetime so it
    // doesn't reshuffle mid-animation across re-renders. Keyed on
    // effect.timestamp — each new banner gets a fresh roll.
    const displayLabel = useMemo(() => {
        const pool = (tier as { labelPool?: readonly string[] }).labelPool;
        if (pool && pool.length > 0) {
            return pool[Math.floor(Math.random() * pool.length)];
        }
        return tier.label;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effect.timestamp]);

    return (
        <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 combo-banner-enter"
        >
            {/* Static radial background flash — original production
                treatment. Single layer at 30% opacity. */}
            <div
                className="absolute inset-0 opacity-30"
                style={{ background: `radial-gradient(ellipse at center, ${tier.shadow} 0%, transparent 65%)` }}
            />

            {/* Main combo text */}
            <div
                className={`relative font-display ${tier.size} font-black leading-none text-center select-none ${tier.italic ? "italic" : ""} combo-text-pop`}
                style={{
                    color: tier.fill,
                    WebkitTextStroke: `4px ${tier.stroke}`,
                    paintOrder: "stroke fill",
                    textShadow: `0 0 40px ${tier.shadow}, 0 0 80px ${tier.shadow}, 0 6px 0 ${tier.stroke}, 0 8px 20px rgba(0,0,0,0.8)`,
                    letterSpacing: "-0.02em",
                    '--combo-rotate': `${tier.rotate}deg`,
                    '--combo-rotate-start': `${tier.rotate * 2}deg`,
                } as React.CSSProperties}
            >
                {displayLabel}
            </div>

            {/* xN COMBO sub-label */}
            <div
                className="font-display font-black tracking-[0.2em] text-white text-2xl sm:text-3xl uppercase mt-2 select-none combo-sublabel-enter"
                style={{
                    WebkitTextStroke: "1.5px rgba(0,0,0,0.6)",
                    paintOrder: "stroke fill",
                    textShadow: `0 0 20px ${tier.shadow}, 0 2px 8px rgba(0,0,0,0.9)`,
                }}
            >
                x{effect.combo} COMBO
            </div>
        </div>
    );
}

/* ===== CASCADE CHAIN LABEL — bottom zone, CSS-only ===== */
function CascadeLabel({ effect }: { effect: MatchEffect }) {
    if (effect.cascadeCount < 1) return null;

    const label =
        effect.cascadeCount >= 4 ? `VIBE CHAIN x${effect.cascadeCount}!`
            : effect.cascadeCount >= 3 ? "VIBE CHAIN x3!"
                : effect.cascadeCount >= 2 ? "VIBE CHAIN x2!"
                    : "VIBE WAVE!";

    const color =
        effect.cascadeCount >= 3 ? "#B366FF"
            : effect.cascadeCount >= 2 ? "#4A9EFF"
                : "#2EFF2E";

    return (
        <div
            className="absolute bottom-[10%] left-0 right-0 flex justify-center pointer-events-none cascade-label-enter"
        >
            <span
                className="font-display font-black text-2xl sm:text-3xl tracking-wider uppercase select-none"
                style={{
                    color,
                    WebkitTextStroke: "1.5px rgba(0,0,0,0.75)",
                    paintOrder: "stroke fill",
                    textShadow: `0 0 22px ${color}, 0 0 44px ${color}60, 0 2px 8px rgba(0,0,0,0.9)`,
                }}
            >
                {label}
            </span>
        </div>
    );
}

/* ===== SHAPE ANNOUNCEMENT — top zone, CSS-only ===== */
function ShapeAnnouncement({ effect }: { effect: MatchEffect }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const SHAPE_INFO: Record<string, { label: string; multiplierLabel: string }> = {
        L: { label: "L-SHAPE!", multiplierLabel: "1.5\u00D7" },
        T: { label: "T-SHAPE!", multiplierLabel: "2.5\u00D7" },
        cross: { label: "\u2726 CROSS!", multiplierLabel: "4\u00D7" },
    };

    const shapeType = effect.shapeBonusType;
    const hasShape = shapeType != null && shapeType in SHAPE_INFO;
    const hasRowStreak = effect.maxMatchSize >= 5;

    if (!mounted || (!hasShape && !hasRowStreak)) return null;

    let label: string;
    let subtext: string | null = null;

    if (hasShape) {
        const info = SHAPE_INFO[shapeType!];
        label = info.label;
        subtext = info.multiplierLabel;
    } else {
        label = effect.maxMatchSize >= 6 ? "SIX IN A ROW!" : "5 IN A ROW!";
    }

    return createPortal(
        <div
            className="fixed left-0 right-0 flex flex-col items-center pointer-events-none shape-announce-enter"
            style={{ top: "10vh", zIndex: 75 }}
            key={effect.timestamp}
        >
            {/* Confetti burst from the badge \u2014 12 sparkles fanning out
                while the label slams in. Pure CSS positioning + transform
                via inline keyframes through CSS vars. */}
            <div className="relative">
                {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i / 12) * Math.PI * 2;
                    const dist = 80 + (i % 3) * 18;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist - 8;
                    const colors = ["#FFE048", "#FF5F1F", "#B366FF", "#FFFFFF", "#FF6B9D"];
                    const color = colors[i % colors.length];
                    return (
                        <span
                            key={i}
                            className="absolute left-1/2 top-1/2 rounded-full shape-confetti-particle"
                            style={{
                                width: 6 + (i % 3) * 2,
                                height: 6 + (i % 3) * 2,
                                background: color,
                                boxShadow: `0 0 8px ${color}`,
                                '--cf-tx': `${tx}px`,
                                '--cf-ty': `${ty}px`,
                                animationDelay: `${(i % 4) * 30}ms`,
                            } as React.CSSProperties}
                        />
                    );
                })}

                {/* Layered headline label (white fill + gold stroke +
                    matching drop-shadow band \u2014 same family as the combo
                    banner / power tile labels). */}
                <span
                    className="relative font-display font-black text-3xl sm:text-5xl tracking-widest uppercase select-none px-5 py-2 rounded-full"
                    style={{
                        color: "#FFFFFF",
                        background: "rgba(10,5,28,0.55)",
                        backdropFilter: "blur(2px)",
                        border: "2px solid rgba(255,224,72,0.85)",
                        WebkitTextStroke: "3px #FFE048",
                        paintOrder: "stroke fill",
                        textShadow: "0 0 28px rgba(255,224,72,0.95), 0 0 56px rgba(255,224,72,0.5), 0 4px 0 #FFE048, 0 6px 14px rgba(0,0,0,0.9)",
                        boxShadow: "0 0 24px rgba(255,224,72,0.45), 0 0 60px rgba(255,224,72,0.2)",
                    }}
                >
                    {hasShape ? label : `\u2B50 ${label} \u2B50`}
                </span>
            </div>

            {subtext && (
                <span
                    className="font-display font-black text-lg sm:text-2xl tracking-[0.18em] uppercase select-none mt-2 shape-subtext-enter px-3 py-0.5 rounded-full"
                    style={{
                        color: "#FFFFFF",
                        background: "rgba(10,5,28,0.6)",
                        WebkitTextStroke: "1.5px #FFE048",
                        paintOrder: "stroke fill",
                        textShadow: "0 0 16px rgba(255,224,72,0.85), 0 2px 0 #FFE048, 0 4px 10px rgba(0,0,0,0.9)",
                    }}
                >
                    {subtext} BONUS
                </span>
            )}
        </div>,
        document.body
    );
}

/* ===== FEATURE 2: MILESTONE BANNER — score threshold celebration, CSS-only ===== */
const MILESTONE_THRESHOLDS = [1000, 5000, 10000, 25000, 50000];

function MilestoneBanner({ milestone }: { milestone: number }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const label = milestone >= 10000 ? `${milestone / 1000}K` : `${milestone}`;

    return createPortal(
        <div
            className="fixed left-0 right-0 flex flex-col items-center justify-center pointer-events-none milestone-banner-enter"
            // Stacks slightly below the ShapeAnnouncement (10vh) so the
            // two don't collide when a milestone-crossing turn also
            // landed an L/T/Cross. Still well above the board so it
            // stays out of the centered combo banner's lane.
            style={{ top: "20vh", zIndex: 76 }}
            key={milestone}
        >
            {/* Layered headline — white fill + cosmic stroke + matching
                cosmic drop-shadow band underneath, same family as the
                rest of the banners. Cosmic color marks milestones as
                "permanence" beats vs the gold "you scored" beats. */}
            <span
                className="relative font-display font-black text-3xl sm:text-5xl tracking-wider uppercase select-none px-6 py-2 rounded-full"
                style={{
                    color: "#FFFFFF",
                    background: "rgba(10,5,28,0.6)",
                    backdropFilter: "blur(2px)",
                    border: "2px solid rgba(179,102,255,0.85)",
                    WebkitTextStroke: "3px #B366FF",
                    paintOrder: "stroke fill",
                    textShadow: "0 0 32px rgba(179,102,255,0.95), 0 0 64px rgba(179,102,255,0.5), 0 4px 0 #B366FF, 0 6px 16px rgba(0,0,0,0.9)",
                    boxShadow: "0 0 28px rgba(179,102,255,0.5), 0 0 60px rgba(179,102,255,0.25)",
                }}
            >
                {label} MILESTONE!
            </span>
            <span
                className="relative font-mundial font-black tracking-[0.2em] text-xs sm:text-sm uppercase mt-2 select-none px-2.5 py-0.5 rounded-full"
                style={{
                    color: "#FFFFFF",
                    background: "rgba(10,5,28,0.55)",
                    WebkitTextStroke: "1px #B366FF",
                    paintOrder: "stroke fill",
                    textShadow: "0 0 14px rgba(179,102,255,0.8), 0 2px 0 #B366FF, 0 3px 8px rgba(0,0,0,0.9)",
                }}
            >
                BONUS SCORE!
            </span>
        </div>,
        document.body
    );
}

/* ===== FEATURE 6: HOT STREAK PARTICLES — CSS-only fire embers at combo >= 4 ===== */
function HotStreakParticles({ combo }: { combo: number }) {
    if (combo < 4) return null;
    const isUltra = combo >= 6;
    const count = isUltra ? 12 : 8;
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            {Array.from({ length: count }, (_, i) => {
                const xPct = 5 + (i / count) * 90;
                const delay = (i * 0.18) % 1.2;
                const dur = 1.4 + (i % 3) * 0.3;
                const size = isUltra ? 4 + (i % 3) * 2 : 3 + (i % 2) * 2;
                const travelY = -(60 + (i % 4) * 25);
                const driftX = (i % 2 === 0 ? -1 : 1) * (i % 3 + 1) * 6;
                const color = i % 3 === 0 ? "#FF5F1F" : i % 3 === 1 ? "#FFE048" : "#FF8C00";
                return (
                    <div
                        key={i}
                        className="absolute rounded-full hot-streak-particle"
                        style={{
                            left: `${xPct}%`,
                            bottom: "0%",
                            width: size,
                            height: size,
                            background: color,
                            '--hs-x0': `${driftX}px`,
                            '--hs-y0': '0px',
                            '--hs-x1': '0px',
                            '--hs-y1': `${travelY}px`,
                            '--hs-duration': `${dur}s`,
                            '--hs-delay': `${delay}s`,
                        } as React.CSSProperties}
                    />
                );
            })}
        </div>
    );
}

/* ===== MAIN BOARD COMPONENT ===== */
export default function GameBoard({
    board,
    selectedTile,
    onTileClick,
    onSwipe,
    scorePopups,
    isAnimating,
    matchEffect,
    combo,
    score,
    isDealing = false,
    hintCells = EMPTY_HINT_SET,
    invalidSwapCells = null,
    swapAnim = null,
    isPrizeGame = false,
}: GameBoardProps) {
    const [effectsQueue, setEffectsQueue] = useState<MatchEffect[]>([]);
    const gridRef = useRef<HTMLDivElement>(null);
    const [cellSize, setCellSize] = useState(0);
    const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, []);

    // Track active effect types for priority throttling
    const activeEffectCount = useMemo(() => {
        let count = 0;
        for (const effect of effectsQueue) {
            if (effect.combo >= 2) count++; // ComboStreakBanner
            if (effect.shapeBonusType || effect.maxMatchSize >= 5) count++; // ShapeAnnouncement
            count++; // ScreenFlash always
            if (effect.intensity !== "normal") count += 2; // TileRingBurst + ScreenEdgeGlow
            count++; // TileMatchFlash
        }
        return count;
    }, [effectsQueue]);

    const shouldShowEffect = useCallback((effectName: string): boolean => {
        if (activeEffectCount <= MAX_SIMULTANEOUS_EFFECTS) return true;
        const priority = EFFECT_PRIORITY[effectName] ?? 0;
        // Suppress low-priority effects when overloaded
        return priority >= 3;
    }, [activeEffectCount]);

    // ===== SWIPE/DRAG GESTURE HANDLING =====
    const swipeStartTile = useRef<Position | null>(null);
    const swipeStartXY = useRef<{ x: number; y: number } | null>(null);
    const didSwipe = useRef(false);
    const SWIPE_THRESHOLD = 18;

    const handlePointerDown = useCallback((e: React.PointerEvent, row: number, col: number) => {
        if (isAnimating) return;
        swipeStartTile.current = { row, col };
        swipeStartXY.current = { x: e.clientX, y: e.clientY };
        didSwipe.current = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [isAnimating]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!swipeStartTile.current || !swipeStartXY.current || didSwipe.current || !onSwipe) return;
        const dx = e.clientX - swipeStartXY.current.x;
        const dy = e.clientY - swipeStartXY.current.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

        let targetRow = swipeStartTile.current.row;
        let targetCol = swipeStartTile.current.col;

        if (absDx > absDy) {
            targetCol += dx > 0 ? 1 : -1;
        } else {
            targetRow += dy > 0 ? 1 : -1;
        }

        if (targetRow < 0 || targetRow >= 8 || targetCol < 0 || targetCol >= 8) return;

        didSwipe.current = true;
        onSwipe(swipeStartTile.current, { row: targetRow, col: targetCol });
        swipeStartTile.current = null;
        swipeStartXY.current = null;
    }, [isAnimating, onSwipe]);

    const handlePointerUp = useCallback(() => {
        swipeStartTile.current = null;
        swipeStartXY.current = null;
    }, []);

    // Feature 2: milestone tracking
    const prevScoreRef = useRef(score);
    const [milestone, setMilestone] = useState<number | null>(null);

    useEffect(() => {
        const prev = prevScoreRef.current;
        prevScoreRef.current = score;
        const crossed = MILESTONE_THRESHOLDS.find(t => prev < t && score >= t);
        if (crossed !== undefined) {
            setMilestone(crossed);
            const timer = setTimeout(() => setMilestone(null), 2200);
            return () => clearTimeout(timer);
        }
    }, [score]);

    useEffect(() => {
        const update = () => {
            if (gridRef.current?.firstElementChild) {
                const rect = gridRef.current.firstElementChild.getBoundingClientRect();
                const gapPx = window.innerWidth >= 640 ? 4 : 2;
                setCellSize(rect.width + gapPx);
            }
        };
        update();
        const ro = new ResizeObserver(update);
        if (gridRef.current) ro.observe(gridRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (matchEffect) {
            setEffectsQueue(prev => {
                const next = [...prev, matchEffect];
                return next.length > 2 ? next.slice(-2) : next;
            });
            setTimeout(() => {
                setEffectsQueue(prev => prev.filter(e => e.timestamp !== matchEffect.timestamp));
            }, 2800);
        }
    }, [matchEffect]);

    // Board shake for mega+ matches
    const shakeClass = matchEffect?.intensity === "ultra"
        ? "animate-[board-shake_0.4s_ease-out]"
        : matchEffect?.intensity === "mega"
            ? "animate-[board-shake_0.25s_ease-out]"
            : "";

    // Board glow escalates with combo
    const boardGlowClass =
        combo >= 4 ? "board-glow-fire"
            : combo >= 2 ? "board-glow-hot"
                : "board-glow";

    // Board border gradient escalates with combo
    const boardBorderGradient =
        combo >= 4
            ? "from-[#B366FF]/60 via-[#FF5F1F]/50 to-[#B366FF]/60"
            : combo >= 2
                ? "from-[#FF5F1F]/50 via-[#FFE048]/40 to-[#FF5F1F]/50"
                : "from-[#FFE048]/40 via-[#FF5F1F]/25 to-[#FFE048]/40";

    return (
        <div className="relative w-full h-full">
            {/* Feature 2: Milestone Banner */}
            {milestone !== null && (
                <MilestoneBanner key={milestone} milestone={milestone} />
            )}

            {/* Board container with combo-reactive glow */}
            <div
                className={`${boardGlowClass} rounded-2xl p-[3px] ${shakeClass} transition-all duration-300 h-full ${isPrizeGame ? "prize-game-pulse" : ""}`}
                style={{
                    background: "linear-gradient(180deg, #FFE048 0%, #c9a84c 40%, #8B6914 100%)",
                    boxShadow: "0 2px 0 #8B6914, 0 4px 8px rgba(0,0,0,0.5), 0 8px 25px rgba(0,0,0,0.4)",
                }}
            >
                <div className="rounded-[13px] bg-[#111]/95 p-1 sm:p-2 h-full" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    <div
                        ref={gridRef}
                        className="grid gap-[2px] sm:gap-1 h-full"
                        style={{
                            gridTemplateColumns: `repeat(8, 1fr)`,
                            gridTemplateRows: `repeat(8, 1fr)`,
                            touchAction: "none",
                        }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        {board.map((row, rowIdx) =>
                            row.map((cell, colIdx) => {
                                const isSelected =
                                    selectedTile?.row === rowIdx && selectedTile?.col === colIdx;
                                const isHinted = hintCells.has(`${rowIdx},${colIdx}`);
                                const invalidIdx = invalidSwapCells?.findIndex(c => c.row === rowIdx && c.col === colIdx) ?? -1;
                                const isInvalidSwap = invalidIdx !== -1;
                                const isSwap1 = swapAnim?.pos1.row === rowIdx && swapAnim?.pos1.col === colIdx;
                                const isSwap2 = swapAnim?.pos2.row === rowIdx && swapAnim?.pos2.col === colIdx;
                                const swapDx = isSwap1 ? (swapAnim!.pos2.col - swapAnim!.pos1.col) * cellSize
                                    : isSwap2 ? (swapAnim!.pos1.col - swapAnim!.pos2.col) * cellSize : 0;
                                const swapDy = isSwap1 ? (swapAnim!.pos2.row - swapAnim!.pos1.row) * cellSize
                                    : isSwap2 ? (swapAnim!.pos1.row - swapAnim!.pos2.row) * cellSize : 0;
                                const tierColor = TIER_COLORS[cell.badge.tier];
                                const tierBorder = TIER_BORDER_COLORS[cell.badge.tier];
                                const tierClass = TIER_IDLE_CLASS[cell.badge.tier];
                                const Overlay =
                                    cell.isSpecial === "bomb" ? BombOverlay
                                        : cell.isSpecial === "vibestreak" ? LaserPartyOverlay
                                            : cell.isSpecial === "cosmic_blast" ? CosmicBlastOverlay
                                                : null;

                                const dealDelay = isDealing ? (rowIdx * 0.06 + colIdx * 0.02) : 0;
                                const isNewDrop = cell.isNew && !isDealing;
                                const isDroppingTile = !isDealing && (cell.dropDistance ?? 0) > 0;
                                const dropPx = isDroppingTile ? (cell.dropDistance! * cellSize) : 0;

                                // Determine if tile is currently animating (for will-change)
                                const isTileAnimating = isInvalidSwap || isSwap1 || isSwap2 || isDroppingTile || isDealing;

                                return (
                                    <button
                                        key={cell.id}
                                        className={`
                                            game-tile
                                            cursor-pointer hover:brightness-110
                                            relative aspect-square rounded-lg sm:rounded-xl overflow-hidden
                                            transition-colors duration-150
                                            border-2
                                            ${tierClass}
                                            ${isSelected ? "tile-selected z-10" : ""}
                                            ${cell.isSpecial ? "special-glow" : ""}
                                            ${isDealing ? "tile-deal" : ""}
                                            ${isHinted && !isSelected ? "ring-[3px] ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]" : ""}
                                            ${isInvalidSwap ? "game-tile--invalid-shake" : ""}
                                            ${isDroppingTile && !isSwap1 && !isSwap2 ? "game-tile--dropping" : ""}
                                            ${(isSwap1 || isSwap2) ? "game-tile--swapping" : ""}
                                            ${isTileAnimating ? "game-tile--animating" : ""}
                                        `}
                                        style={{
                                            borderColor: isSelected ? tierColor : tierBorder,
                                            animationDelay: isDealing ? `${dealDelay}s` : undefined,
                                            '--swap-dx': (isSwap1 || isSwap2) ? `${swapDx}px` : undefined,
                                            '--swap-dy': (isSwap1 || isSwap2) ? `${swapDy}px` : undefined,
                                            '--drop-distance': isDroppingTile ? `${-dropPx}px` : undefined,
                                            '--drop-delay': isDroppingTile ? `${colIdx * 0.02}s` : undefined,
                                        } as React.CSSProperties}
                                        onPointerDown={(e) => handlePointerDown(e, rowIdx, colIdx)}
                                        onClick={() => {
                                            if (didSwipe.current) { didSwipe.current = false; return; }
                                            onTileClick({ row: rowIdx, col: colIdx });
                                        }}
                                        disabled={isAnimating}
                                    >
                                        {/* Badge image. Plain <img> instead of next/image:
                                            with unoptimized=true Next was adding zero value
                                            (no transformer, no blur), but loading="lazy" on
                                            non-priority tiles plus IntersectionObserver
                                            wakeup was leaving rows 3-7 blank for ~1s after
                                            the board mounted. Plain img + eager + sync
                                            decoding pulls from the warm cache (via
                                            preloadBadgeImages) and paints immediately. */}
                                        <div
                                            className="absolute inset-[2px] sm:inset-[3px] rounded-md sm:rounded-lg overflow-hidden"
                                            style={{ backgroundColor: `${tierColor}40` }}
                                        >
                                            <img
                                                src={cell.badge.image}
                                                alt={cell.badge.name}
                                                loading="eager"
                                                decoding="sync"
                                                fetchPriority="high"
                                                draggable={false}
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        </div>

                                        {Overlay && <Overlay />}

                                        {/* Hint pulse overlay — CSS only */}
                                        {isHinted && !isSelected && (
                                            <div className="absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none hint-pulse-overlay" />
                                        )}

                                        {/* Selected highlight ring — CSS only */}
                                        {isSelected && (
                                            <div
                                                className="absolute inset-0 rounded-lg sm:rounded-xl selected-highlight-ring"
                                                style={{
                                                    border: `2px solid ${tierColor}`,
                                                    '--sel-color': tierColor,
                                                    '--sel-border': tierBorder,
                                                } as React.CSSProperties}
                                            />
                                        )}

                                        {/* Feature 5: Tile Selection Ripple — CSS only */}
                                        {isSelected && (
                                            <div
                                                className="absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none tile-select-ripple"
                                                style={{
                                                    border: "2px solid rgba(255, 224, 72, 0.8)",
                                                    borderRadius: "inherit",
                                                }}
                                            />
                                        )}

                                        {/* Hover brightening handled by CSS hover:brightness-110 */}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Feature 6: Hot Streak Particles */}
            <HotStreakParticles combo={combo} />

            {/* === HIERARCHICAL MATCH EFFECTS LAYER === */}
            {effectsQueue.map(effect => (
                <div key={effect.timestamp} className="absolute inset-0 pointer-events-none z-40">
                    {/* Particle burst */}
                    <MatchParticles effect={effect} />

                    {/* Per-tile ring burst */}
                    {shouldShowEffect('TileRingBurst') && <TileRingBurst effect={effect} />}

                    {/* Feature 1: Tile Match Flash */}
                    {shouldShowEffect('TileMatchFlash') && <TileMatchFlash effect={effect} cellSize={cellSize} />}

                    {/* Shockwave ring */}
                    <ShockwaveRing effect={effect} />

                    {/* Screen edge glow */}
                    {shouldShowEffect('ScreenEdgeGlow') && <ScreenEdgeGlow intensity={effect.intensity} />}

                    {/* Screen flash */}
                    {shouldShowEffect('ScreenFlash') && <ScreenFlash intensity={effect.intensity} />}

                    {/* Power tile detonation tint — overlays on top of
                        ScreenFlash, color-coded to the special type. */}
                    <PowerTileDetonationFlash effect={effect} />

                    {/* Power tile creation moment — slammed-in label +
                        tier ring at each spawn. */}
                    <PowerTileCreationMoment effect={effect} cellSize={cellSize} />

                    {/* Combo streak banner */}
                    {shouldShowEffect('ComboStreakBanner') && <ComboStreakBanner effect={effect} />}

                    {/* Cascade chain label */}
                    <CascadeLabel effect={effect} />

                    {/* Shape/streak announcement (top zone) */}
                    {shouldShowEffect('ShapeAnnouncement') && <ShapeAnnouncement effect={effect} />}
                </div>
            ))}

            {/* Score popups layer. Each popup pops at its match position,
                holds, then accelerates toward the HUD score box (Candy
                Crush-style) — so the player sees the points "fly into"
                the score they're growing. ScoreFlyPopup encapsulates
                the per-popup target lookup. */}
            {scorePopups.map((popup) => (
                <ScoreFlyPopup key={popup.id} popup={popup} />
            ))}
        </div>
    );
}

/* ===== SCORE FLY POPUP =====
 *
 * Pops at the match position with magnitude-scaled styling, holds
 * briefly so the player can read the number, then flies toward the
 * HUD score box and fades out as if "absorbed" into the score total.
 *
 * The target-x / target-y CSS variables are computed at mount time
 * via getBoundingClientRect on this popup vs. the marked HUD score
 * element ([data-hud-score-target]). The CSS animation interpolates
 * to those values in its second half.
 *
 * If the HUD target can't be found (initial render race, layout
 * change), the popup falls back to the original drift-up behavior.
 */
function ScoreFlyPopup({ popup }: { popup: ScorePopup }) {
    const ref = useRef<HTMLDivElement>(null);
    const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

    useLayoutEffect(() => {
        if (!ref.current) return;
        const popupRect = ref.current.getBoundingClientRect();
        // Multiple HUDs can mount on mobile (top + bottom) — pick the
        // one with non-zero size, i.e. actually visible at this break.
        const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-hud-score-target]"));
        const targetEl = candidates.find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        });
        if (!targetEl) return;
        const targetRect = targetEl.getBoundingClientRect();
        const dx = (targetRect.left + targetRect.width / 2) - (popupRect.left + popupRect.width / 2);
        const dy = (targetRect.top + targetRect.height / 2) - (popupRect.top + popupRect.height / 2);
        setTarget({ x: dx, y: dy });
    }, []);

    // When the popup arrives at the HUD score box, briefly pulse the
    // score number so it reads as "absorbed". Uses the same target
    // element we computed delta to. Re-queries on fire because the
    // ref'd HUD element could have been unmounted (e.g. on mobile
    // breakpoint switch mid-flight) — fail silently if so.
    useEffect(() => {
        const el = ref.current;
        if (!el || !target) return;
        const onEnd = () => {
            const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-hud-score-target]"));
            const targetEl = candidates.find(c => {
                const r = c.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (!targetEl) return;
            // Restart the animation by removing/re-adding the class —
            // chained popups landing in quick succession should each
            // re-pulse, not just the first.
            targetEl.classList.remove("score-arrived-pulse");
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            targetEl.offsetWidth; // force reflow so the class re-add re-runs the keyframe
            targetEl.classList.add("score-arrived-pulse");
            setTimeout(() => targetEl.classList.remove("score-arrived-pulse"), 420);
        };
        el.addEventListener("animationend", onEnd, { once: true });
        return () => el.removeEventListener("animationend", onEnd);
    }, [target]);

    // Magnitude-tier styling — same five buckets as before.
    const v = popup.value;
    const popupTier = v >= 10000 ? "epic"
        : v >= 5000 ? "huge"
            : v >= 2000 ? "big"
                : v >= 750 ? "medium"
                    : "small";
    const tierStyles: Record<string, {
        text: string; px: string; py: string; border: string;
        color: string; glow: string; bg: string; gradient?: string;
    }> = {
        small:  { text: "text-xl sm:text-2xl",       px: "px-2.5", py: "py-0.5", border: "1.5px solid rgba(255,224,72,0.4)",  color: "#FFE048", glow: "0 0 10px rgba(255,224,72,0.6)",                          bg: "rgba(0,0,0,0.7)" },
        medium: { text: "text-2xl sm:text-3xl",      px: "px-3",   py: "py-1",   border: "2px solid rgba(255,224,72,0.6)",    color: "#FFE048", glow: "0 0 16px rgba(255,224,72,0.85), 0 0 32px rgba(255,224,72,0.4)", bg: "rgba(0,0,0,0.78)" },
        big:    { text: "text-3xl sm:text-4xl",      px: "px-3.5", py: "py-1",   border: "2.5px solid rgba(255,184,0,0.85)",  color: "#FFE048", glow: "0 0 22px rgba(255,184,0,1), 0 0 44px rgba(255,95,31,0.55)",     bg: "rgba(0,0,0,0.82)" },
        huge:   { text: "text-4xl sm:text-5xl",      px: "px-4",   py: "py-1.5", border: "3px solid rgba(255,224,72,1)",      color: "#FFF4B0", glow: "0 0 28px rgba(255,224,72,1), 0 0 56px rgba(255,95,31,0.85)",     bg: "rgba(20,8,40,0.92)", gradient: "linear-gradient(135deg, #FFF4B0 0%, #FFE048 50%, #FF8C00 100%)" },
        epic:   { text: "text-5xl sm:text-6xl",      px: "px-5",   py: "py-2",   border: "3px solid rgba(255,255,255,1)",     color: "#FFFFFF", glow: "0 0 36px rgba(179,102,255,1), 0 0 72px rgba(255,224,72,0.85), 0 0 100px rgba(255,107,157,0.6)", bg: "rgba(10,4,28,0.95)", gradient: "linear-gradient(135deg, #FFE048 0%, #FF6B9D 33%, #B366FF 66%, #FFE048 100%)" },
    };
    const t = tierStyles[popupTier];

    // Pick the animation: fly-to-hud if we have a target, fall back to
    // the original drift-up otherwise. Big tiers (huge/epic) get a
    // longer hold + slower flight so they have presence before they
    // fly into the score box.
    const driftX = ((popup.x % 3) - 1) * 14;
    const isBig = popupTier === "epic" || popupTier === "huge";
    const animClass = target
        ? (isBig ? "score-fly-to-hud-big" : "score-fly-to-hud")
        : (isBig ? "score-popup-float-big" : "score-popup-float");

    return (
        <div
            ref={ref}
            className={`absolute pointer-events-none z-50 flex items-center justify-center ${animClass}`}
            style={{
                left: `${(popup.x / 8) * 100 + 6.25}%`,
                top: `${(popup.y / 8) * 100 + 6.25}%`,
                '--popup-drift-x': `${driftX}px`,
                '--target-x': target ? `${target.x}px` : "0px",
                '--target-y': target ? `${target.y}px` : "-60px",
            } as React.CSSProperties}
        >
            <span
                className={`font-display font-black ${t.text} ${t.px} ${t.py} rounded-full whitespace-nowrap`}
                style={{
                    color: t.color,
                    background: t.bg,
                    border: t.border,
                    textShadow: t.gradient ? "none" : t.glow,
                    boxShadow: t.gradient ? t.glow : undefined,
                }}
            >
                {t.gradient ? (
                    <span
                        style={{
                            backgroundImage: t.gradient,
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.85))",
                        }}
                    >
                        +{popup.value.toLocaleString()}
                    </span>
                ) : (
                    <>+{popup.value.toLocaleString()}</>
                )}
            </span>
        </div>
    );
}
