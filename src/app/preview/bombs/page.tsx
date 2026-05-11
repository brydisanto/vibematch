"use client";

import { useRef, useState } from "react";

/* ============================================================
 * Bomb-sound preview / shootout.
 *
 * Four distinct variants so we can pick the one that feels most
 * satisfying when the player detonates a Bomb power tile.
 *
 * Self-contained: own AudioContext, own playNote/playNoise. No
 * imports from src/lib/sounds.ts so we can iterate freely without
 * cross-contaminating the production sound code.
 * ============================================================ */

type OscShape = OscillatorType;

function useAudio() {
    const ctxRef = useRef<AudioContext | null>(null);
    const getCtx = (): AudioContext | null => {
        if (typeof window === "undefined") return null;
        if (!ctxRef.current) {
            const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) return null;
            ctxRef.current = new Ctor();
        }
        if (ctxRef.current.state === "suspended") ctxRef.current.resume();
        return ctxRef.current;
    };
    return { getCtx };
}

/* ---------- low-level helpers (mirror the prod helpers, self-contained) ---------- */

function note(
    ctx: AudioContext,
    freq: number | { from: number; to: number; sweep?: "exp" | "lin" },
    duration: number,
    type: OscShape,
    volume: number,
    delay: number = 0,
    attackMs: number = 8,
) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    const t0 = ctx.currentTime + delay;
    if (typeof freq === "number") {
        osc.frequency.setValueAtTime(freq, t0);
    } else {
        osc.frequency.setValueAtTime(freq.from, t0);
        if (freq.sweep === "lin") {
            osc.frequency.linearRampToValueAtTime(freq.to, t0 + duration);
        } else {
            osc.frequency.exponentialRampToValueAtTime(Math.max(freq.to, 0.01), t0 + duration);
        }
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volume, t0 + attackMs / 1000);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
}

function noise(
    ctx: AudioContext,
    duration: number,
    volume: number,
    delay: number = 0,
    filter: BiquadFilterType = "highpass",
    freq: number = 2000,
    Q: number = 1,
) {
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
}

/**
 * Optional waveshaper for "distorted" / "crunchy" variants. Returns a
 * GainNode-equivalent that you can chain through if you want analog-style
 * saturation. Used in variant D.
 */
function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 44100;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

function noteThroughShaper(
    ctx: AudioContext,
    freq: number | { from: number; to: number; sweep?: "exp" | "lin" },
    duration: number,
    type: OscShape,
    volume: number,
    distortion: number,
    delay: number = 0,
) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(distortion);
    shaper.oversample = "4x";
    osc.type = type;
    const t0 = ctx.currentTime + delay;
    if (typeof freq === "number") {
        osc.frequency.setValueAtTime(freq, t0);
    } else {
        osc.frequency.setValueAtTime(freq.from, t0);
        const ramp = freq.sweep === "lin" ? osc.frequency.linearRampToValueAtTime : osc.frequency.exponentialRampToValueAtTime;
        ramp.call(osc.frequency, Math.max(freq.to, 0.01), t0 + duration);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volume, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(shaper);
    shaper.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
}

/* ============================================================
 *  VARIANT A — "Cinematic Boom"
 *
 *  Heavy, weighty, movie-explosion DNA. Deep sub-bass downsweep
 *  with a long rumble tail. Feels dramatic and final.
 *  Best fit: high-stakes detonations.
 * ============================================================ */
function playBombA(ctx: AudioContext) {
    // Bright impact crack — the "kuh" before the boom
    noise(ctx, 0.05, 0.5, 0, "highpass", 4500);
    // Sharp mid-impact body — bandpassed in the chest-thump range
    noise(ctx, 0.18, 0.55, 0, "bandpass", 240, 0.7);
    // Deep sub-bass downsweep — slow and weighty. 85Hz → 28Hz over 850ms.
    note(ctx, { from: 85, to: 28 }, 0.9, "sine", 0.6, 0, 6);
    // Mid-body growl layer — colors the sub with harmonics
    note(ctx, { from: 180, to: 50 }, 0.35, "square", 0.12, 0, 6);
    // Long lowpass rumble tail — debris cloud, dust, aftermath
    noise(ctx, 0.7, 0.28, 0.08, "lowpass", 350);
    // Late high-freq sparkle — burning embers
    noise(ctx, 0.4, 0.06, 0.15, "bandpass", 6000, 5);
}

/* ============================================================
 *  VARIANT B — "Arcade Punch"
 *
 *  Snappy, satisfying, classic match-3 style. Quick attack,
 *  defined punch, fast decay. Feels playful but powerful.
 *  Best fit: rapid chain detonations where you don't want a
 *  long tail muddying subsequent matches.
 * ============================================================ */
function playBombB(ctx: AudioContext) {
    // Sharp click — bright transient
    noise(ctx, 0.025, 0.55, 0, "highpass", 5500);
    // Punchy mid body — slightly higher bandpass for "pop" not "boom"
    noise(ctx, 0.1, 0.5, 0, "bandpass", 380, 1.2);
    // Sub kick — fast pitch drop, big initial slam
    note(ctx, { from: 120, to: 55 }, 0.32, "sine", 0.55, 0, 4);
    // Bright harmonic accent — triangle gives a hint of melody/clarity
    note(ctx, { from: 320, to: 110 }, 0.16, "triangle", 0.18, 0.005, 4);
    // Quick lowpass tail — short enough to clear before next match
    noise(ctx, 0.22, 0.18, 0.04, "lowpass", 600);
}

/* ============================================================
 *  VARIANT C — "Sub-Bass Drop"
 *
 *  Modern EDM/dubstep style. Massive low-end emphasis. The
 *  "drop" is the main event — pitch slides down hard, the
 *  whole thing feels like a bass cabinet being tested.
 *  Best fit: confidently modern, low-end heavy.
 * ============================================================ */
function playBombC(ctx: AudioContext) {
    // Initial tight transient
    noise(ctx, 0.02, 0.5, 0, "highpass", 5000);
    // Two-stage sub: high hit then deep slide
    note(ctx, 130, 0.05, "sine", 0.5, 0, 2);
    // The DROP — slow exponential from 110 → 24Hz over 700ms.
    // This is the centerpiece — should rattle.
    note(ctx, { from: 110, to: 24 }, 0.85, "sine", 0.7, 0.04, 8);
    // Mid-low growl to add harmonic content (sub alone is "felt" not "heard"
    // on small speakers; this gives it audible character)
    note(ctx, { from: 220, to: 60 }, 0.4, "sawtooth", 0.1, 0.03, 6);
    // Filtered noise wash — fills in the gap between sub and mid
    noise(ctx, 0.5, 0.22, 0.05, "bandpass", 180, 1.5);
    // Late sub-octave layer — adds weight at the tail
    note(ctx, 32, 0.5, "sine", 0.18, 0.2, 10);
}

/* ============================================================
 *  VARIANT D — "Crunchy Demolition"
 *
 *  Aggressive, distorted, chunky. Multiple saturated layers,
 *  hard attack. Less "boom" more "SMASH". Feels destructive
 *  and slightly chaotic.
 *  Best fit: high-energy / aggressive games.
 * ============================================================ */
function playBombD(ctx: AudioContext) {
    // Bright crunchy initial — through waveshaper for saturation
    noteThroughShaper(ctx, { from: 280, to: 90 }, 0.18, "sawtooth", 0.35, 30, 0);
    // Distorted square punch — the meat
    noteThroughShaper(ctx, { from: 90, to: 38 }, 0.35, "square", 0.4, 20, 0);
    // Clean sub underneath to anchor
    note(ctx, { from: 70, to: 32 }, 0.5, "sine", 0.45, 0, 4);
    // Bright noisy crack on top
    noise(ctx, 0.06, 0.4, 0, "highpass", 3000);
    // Chunky mid noise for "rubble"
    noise(ctx, 0.25, 0.32, 0.02, "bandpass", 200, 2);
    // Late staggered debris hits — 3 quick pops
    noise(ctx, 0.04, 0.15, 0.12, "bandpass", 500, 3);
    noise(ctx, 0.04, 0.12, 0.2, "bandpass", 700, 3);
    noise(ctx, 0.04, 0.1, 0.28, "bandpass", 350, 3);
    // Lowpass rumble tail
    noise(ctx, 0.45, 0.18, 0.1, "lowpass", 400);
}

/* ============================================================
 *  UI
 * ============================================================ */

const VARIANTS = [
    {
        id: "A",
        name: "Cinematic Boom",
        tag: "Heavy / Dramatic",
        description: "Deep sub-bass downsweep, long rumble tail. Movie-explosion DNA. Feels weighty and final.",
        play: playBombA,
        accent: "#FF5F1F",
    },
    {
        id: "B",
        name: "Arcade Punch",
        tag: "Snappy / Punchy",
        description: "Quick attack, defined body, fast decay. Classic match-3 satisfaction. Clears fast for chain matches.",
        play: playBombB,
        accent: "#FFE048",
    },
    {
        id: "C",
        name: "Sub-Bass Drop",
        tag: "Modern / Bass-Heavy",
        description: "Pitch slide 110Hz → 24Hz. The DROP is the main event. Feels like a bass cabinet being tested.",
        play: playBombC,
        accent: "#B366FF",
    },
    {
        id: "D",
        name: "Crunchy Demolition",
        tag: "Aggressive / Distorted",
        description: "Saturated square layers + scattered debris hits. Less BOOM, more SMASH. Destructive energy.",
        play: playBombD,
        accent: "#FF3333",
    },
] as const;

export default function BombSoundsPreview() {
    const { getCtx } = useAudio();
    const [active, setActive] = useState<string | null>(null);

    const playVariant = (variant: (typeof VARIANTS)[number]) => {
        const ctx = getCtx();
        if (!ctx) return;
        setActive(variant.id);
        variant.play(ctx);
        setTimeout(() => setActive(prev => (prev === variant.id ? null : prev)), 1200);
    };

    return (
        <div
            className="min-h-screen w-full bg-[#0a051c] text-white"
            style={{
                backgroundImage:
                    "radial-gradient(ellipse at top, rgba(179,102,255,0.15) 0%, transparent 60%), radial-gradient(ellipse at bottom, rgba(255,95,31,0.12) 0%, transparent 60%)",
            }}
        >
            <div className="max-w-3xl mx-auto px-5 py-12">
                <div className="mb-10">
                    <p className="font-display uppercase tracking-[0.3em] text-xs text-yellow-300/80 mb-2">
                        Pin Drop · Sound Preview
                    </p>
                    <h1 className="font-display font-black text-4xl sm:text-5xl uppercase tracking-tight leading-none mb-3">
                        Bomb sound shootout
                    </h1>
                    <p className="text-white/70 max-w-xl text-sm sm:text-base">
                        Four candidate sounds for the Bomb power tile detonation. Tap each to audition.
                        Pick the one that feels most satisfying — like you&apos;re actually blowing something up.
                        Use headphones or decent speakers; the differences are mostly in the sub-bass register.
                    </p>
                </div>

                <div className="space-y-4">
                    {VARIANTS.map(v => {
                        const isActive = active === v.id;
                        return (
                            <button
                                key={v.id}
                                onClick={() => playVariant(v)}
                                className="w-full text-left p-5 sm:p-6 rounded-2xl border-2 transition-all duration-150 group hover:-translate-y-0.5"
                                style={{
                                    background: isActive
                                        ? `linear-gradient(135deg, ${v.accent}22, rgba(10,5,28,0.85))`
                                        : "rgba(15,8,32,0.7)",
                                    borderColor: isActive ? v.accent : "rgba(255,255,255,0.12)",
                                    boxShadow: isActive
                                        ? `0 0 30px ${v.accent}66, 0 0 60px ${v.accent}33`
                                        : "0 2px 12px rgba(0,0,0,0.4)",
                                }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-3 mb-1.5">
                                            <span
                                                className="font-display font-black text-3xl sm:text-4xl leading-none"
                                                style={{ color: v.accent }}
                                            >
                                                {v.id}
                                            </span>
                                            <span className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight">
                                                {v.name}
                                            </span>
                                        </div>
                                        <p
                                            className="font-display uppercase tracking-[0.2em] text-[10px] sm:text-xs mb-2"
                                            style={{ color: v.accent }}
                                        >
                                            {v.tag}
                                        </p>
                                        <p className="text-white/75 text-sm leading-relaxed">{v.description}</p>
                                    </div>
                                    <div
                                        className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                                        style={{
                                            background: `radial-gradient(circle, ${v.accent}, ${v.accent}88)`,
                                            boxShadow: `0 0 24px ${v.accent}88`,
                                        }}
                                    >
                                        <span className="text-2xl sm:text-3xl">{isActive ? "*" : "▶"}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-10 p-4 rounded-xl border border-white/10 bg-black/30 text-sm text-white/60">
                    <p className="font-display uppercase tracking-[0.2em] text-[10px] text-yellow-300/70 mb-1">
                        How to pick
                    </p>
                    <p>
                        Tap each at least twice (the first play primes the audio context on iOS). Then tap them in
                        sequence to compare. Tell me which letter wins and I&apos;ll wire it into the game.
                    </p>
                </div>
            </div>
        </div>
    );
}
