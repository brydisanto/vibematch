"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../_lib/adminFetch";

interface DailyStats {
    date: string;
    dau: number;
    newUsers: number;
    classicPlays: number;
    capsulesEarned: number;
    rerolls: number;
    vibestrSpent: number;
}

type SeriesKey = "dau" | "newUsers" | "classicPlays" | "capsulesEarned" | "rerolls" | "vibestrSpent";

interface SeriesDef {
    key: SeriesKey;
    label: string;
    color: string;
    format?: (v: number) => string;
}

const SERIES: SeriesDef[] = [
    { key: "dau", label: "DAU", color: "#B366FF" },
    { key: "newUsers", label: "New Users", color: "#22D3EE" },
    { key: "classicPlays", label: "Games Played", color: "#FFE048" },
    { key: "capsulesEarned", label: "Capsules Earned", color: "#4ADE80" },
    { key: "rerolls", label: "Rerolls", color: "#FF8C42" },
    { key: "vibestrSpent", label: "$VIBESTR Spent", color: "#FF6B9D", format: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
];

const CHART_W = 1000;
const CHART_H = 280;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

export default function DailyStatsChart() {
    const [stats, setStats] = useState<DailyStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);
    const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
        dau: true,
        newUsers: true,
        classicPlays: true,
        capsulesEarned: true,
        rerolls: true,
        vibestrSpent: true,
    });
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        adminFetch(`/api/admin/stats/daily?days=${days}`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(data => setStats(data.stats || []))
            .catch(e => setError(e instanceof Error ? e.message : "Failed to load"))
            .finally(() => setLoading(false));
    }, [days]);

    // Per-series Y-axis scale. Each series gets its own scale because the
    // magnitudes are wildly different (DAU = 0-200, VIBESTR Spent = 0-50000).
    const scales = useMemo(() => {
        const out: Record<SeriesKey, { min: number; max: number }> = {} as Record<SeriesKey, { min: number; max: number }>;
        for (const s of SERIES) {
            const values = stats.map(d => d[s.key] as number);
            const max = values.length > 0 ? Math.max(...values, 1) : 1;
            out[s.key] = { min: 0, max };
        }
        return out;
    }, [stats]);

    const xAt = (i: number) => {
        if (stats.length <= 1) return PAD_L;
        return PAD_L + (i / (stats.length - 1)) * PLOT_W;
    };
    const yAt = (value: number, key: SeriesKey) => {
        const { max } = scales[key];
        if (max <= 0) return PAD_T + PLOT_H;
        return PAD_T + PLOT_H - (value / max) * PLOT_H;
    };

    const pathForSeries = (key: SeriesKey): string => {
        if (stats.length === 0) return "";
        return stats.map((d, i) => {
            const x = xAt(i).toFixed(1);
            const y = yAt(d[key] as number, key).toFixed(1);
            return `${i === 0 ? "M" : "L"}${x},${y}`;
        }).join(" ");
    };

    // X-axis ticks: show ~6 evenly spaced date labels
    const xTicks = useMemo(() => {
        if (stats.length === 0) return [] as { x: number; label: string }[];
        const targetCount = Math.min(7, stats.length);
        const step = Math.max(1, Math.floor((stats.length - 1) / (targetCount - 1)));
        const out: { x: number; label: string }[] = [];
        for (let i = 0; i < stats.length; i += step) {
            const date = stats[i].date;
            const short = date.slice(5); // MM-DD
            out.push({ x: xAt(i), label: short });
        }
        // Always include the last point
        const last = stats.length - 1;
        if (out.length === 0 || out[out.length - 1].label !== stats[last].date.slice(5)) {
            out.push({ x: xAt(last), label: stats[last].date.slice(5) });
        }
        return out;
    }, [stats]);

    const hoverData = hoverIdx != null && hoverIdx >= 0 && hoverIdx < stats.length ? stats[hoverIdx] : null;

    const toggle = (key: SeriesKey) => setVisible(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="bg-[#15101F] rounded-lg border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-lg font-display font-black text-[#FFE048] uppercase">Daily Activity</h2>
                <div className="flex items-center gap-2 text-xs">
                    {[7, 14, 30, 60, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-2.5 py-1 rounded ${days === d ? "bg-[#FFE048] text-black font-bold" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {/* Legend / series toggles */}
            <div className="flex items-center gap-3 flex-wrap mb-3 text-xs">
                {SERIES.map(s => (
                    <button
                        key={s.key}
                        onClick={() => toggle(s.key)}
                        className="flex items-center gap-1.5 transition-opacity"
                        style={{ opacity: visible[s.key] ? 1 : 0.35 }}
                    >
                        <span
                            className="inline-block w-3 h-3 rounded-sm"
                            style={{ background: s.color, boxShadow: `0 0 6px ${s.color}88` }}
                        />
                        <span className="text-white/80">{s.label}</span>
                    </button>
                ))}
            </div>

            {loading && <div className="text-white/40 text-sm py-12 text-center">Loading…</div>}
            {error && !loading && <div className="text-red-400 text-sm py-12 text-center">{error}</div>}

            {!loading && !error && stats.length > 0 && (
                <div className="relative">
                    <svg
                        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                        className="w-full h-auto"
                        preserveAspectRatio="none"
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const xPct = (e.clientX - rect.left) / rect.width;
                            const svgX = xPct * CHART_W;
                            if (svgX < PAD_L || svgX > CHART_W - PAD_R) { setHoverIdx(null); return; }
                            const t = (svgX - PAD_L) / PLOT_W;
                            const idx = Math.round(t * (stats.length - 1));
                            setHoverIdx(Math.max(0, Math.min(stats.length - 1, idx)));
                        }}
                        onMouseLeave={() => setHoverIdx(null)}
                    >
                        {/* Y gridlines */}
                        {[0, 0.25, 0.5, 0.75, 1].map(g => (
                            <line
                                key={g}
                                x1={PAD_L}
                                x2={CHART_W - PAD_R}
                                y1={PAD_T + PLOT_H - g * PLOT_H}
                                y2={PAD_T + PLOT_H - g * PLOT_H}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={1}
                            />
                        ))}

                        {/* X-axis labels */}
                        {xTicks.map((t, i) => (
                            <text
                                key={`${t.label}-${i}`}
                                x={t.x}
                                y={CHART_H - 10}
                                fontSize={11}
                                fill="rgba(255,255,255,0.4)"
                                textAnchor="middle"
                                fontFamily="ui-monospace, monospace"
                            >
                                {t.label}
                            </text>
                        ))}

                        {/* Series polylines */}
                        {SERIES.map(s => visible[s.key] && (
                            <path
                                key={s.key}
                                d={pathForSeries(s.key)}
                                stroke={s.color}
                                strokeWidth={2}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ filter: `drop-shadow(0 0 4px ${s.color}66)` }}
                            />
                        ))}

                        {/* Hover marker */}
                        {hoverIdx != null && (
                            <>
                                <line
                                    x1={xAt(hoverIdx)}
                                    x2={xAt(hoverIdx)}
                                    y1={PAD_T}
                                    y2={PAD_T + PLOT_H}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth={1}
                                    strokeDasharray="3,3"
                                />
                                {SERIES.map(s => visible[s.key] && (
                                    <circle
                                        key={s.key}
                                        cx={xAt(hoverIdx)}
                                        cy={yAt(stats[hoverIdx][s.key] as number, s.key)}
                                        r={3.5}
                                        fill={s.color}
                                        stroke="#15101F"
                                        strokeWidth={1.5}
                                    />
                                ))}
                            </>
                        )}
                    </svg>

                    {/* Tooltip */}
                    {hoverData && (
                        <div className="absolute top-0 right-0 bg-[#1A1525] border border-white/10 rounded-lg p-3 text-xs shadow-xl pointer-events-none">
                            <div className="font-mono text-white/60 mb-1.5">{hoverData.date}</div>
                            {SERIES.filter(s => visible[s.key]).map(s => {
                                const value = hoverData[s.key] as number;
                                const formatted = s.format ? s.format(value) : value.toLocaleString();
                                return (
                                    <div key={s.key} className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: s.color }} />
                                            <span className="text-white/70">{s.label}</span>
                                        </span>
                                        <span className="font-mono text-white">{formatted}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <p className="text-[10px] text-white/30 mt-3">
                Capsules + games counters started tracking 2026-05-21. Earlier days show 0 across those columns regardless of actual activity.
            </p>
        </div>
    );
}
