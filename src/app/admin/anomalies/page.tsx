"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AnomalyFlag {
    id: string;
    label: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

interface FlaggedGame {
    username: string;
    timestamp: number;
    gameMode: string;
    score: number;
    matchCount: number;
    maxCombo: number;
    totalCascades: number;
    bombsCreated: number;
    vibestreaksCreated: number;
    cosmicBlastsCreated: number;
    crossCount: number;
    gameOverReason?: string;
    matchId?: string | null;
    validatedMatch?: boolean;
    flags: AnomalyFlag[];
    severity: 'low' | 'medium' | 'high' | 'critical';
}

interface UserSummary {
    username: string;
    flaggedCount: number;
    maxSeverity: string;
}

interface AnomaliesResponse {
    flaggedGames: FlaggedGame[];
    totalFlagged: number;
    totalGamesScanned: number;
    totalUsersFlagged: number;
    usersFlagged: UserSummary[];
}

type SeverityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/40" },
    high: { bg: "bg-orange-500/20", text: "text-orange-300", border: "border-orange-500/40" },
    medium: { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/40" },
    low: { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/40" },
    none: { bg: "bg-white/5", text: "text-white/50", border: "border-white/10" },
};

export default function AnomaliesPage() {
    const [data, setData] = useState<AnomaliesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [severity, setSeverity] = useState<SeverityFilter>('low');

    useEffect(() => {
        setLoading(true);
        const param = severity === 'all' ? 'low' : severity;
        fetch(`/api/admin/anomalies?severity=${param}`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [severity]);

    const filteredGames = (data?.flaggedGames || []).filter(g => {
        if (severity === 'all') return true;
        return g.severity === severity;
    });

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">Anomalies</h1>
                <div className="flex gap-2">
                    {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setSeverity(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider font-bold border transition-all ${
                                severity === s
                                    ? "bg-[#FFE048] text-black border-[#FFE048]"
                                    : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Flagged Games"
                    value={data?.totalFlagged ?? "—"}
                    accent={data && data.totalFlagged > 0 ? "red" : "none"}
                />
                <StatCard label="Games Scanned" value={data?.totalGamesScanned ?? "—"} />
                <StatCard
                    label="Users Flagged"
                    value={data?.totalUsersFlagged ?? "—"}
                    accent={data && data.totalUsersFlagged > 0 ? "red" : "none"}
                />
                <StatCard
                    label="Filter"
                    value={severity.toUpperCase()}
                />
            </div>

            {/* Flagged users summary */}
            {data && data.usersFlagged.length > 0 && (
                <div>
                    <h2 className="text-lg font-display font-black text-[#FFE048] uppercase mb-3">
                        Users with Flagged Games
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {data.usersFlagged.map(u => {
                            const style = SEVERITY_STYLES[u.maxSeverity] || SEVERITY_STYLES.low;
                            return (
                                <Link
                                    key={u.username}
                                    href={`/admin/user/${u.username}`}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${style.bg} ${style.border} ${style.text} hover:brightness-125 transition-all`}
                                >
                                    <span className="font-bold">{u.username}</span>
                                    <span className="opacity-70">×{u.flaggedCount}</span>
                                    <span className="uppercase text-[9px] font-bold">{u.maxSeverity}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Flagged games table */}
            <div>
                <h2 className="text-lg font-display font-black text-[#FFE048] uppercase mb-3">
                    Flagged Games ({filteredGames.length})
                </h2>
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-white/40">Scanning game logs…</div>
                    ) : filteredGames.length === 0 ? (
                        <div className="p-8 text-center text-white/40">
                            No flagged games {severity !== 'all' && `at ${severity} severity or above`}.
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="text-white/60 border-b border-white/10 bg-white/5">
                                <tr>
                                    <th className="text-left py-3 px-3">Severity</th>
                                    <th className="text-left py-3 px-3">User</th>
                                    <th className="text-left py-3 px-3">Date</th>
                                    <th className="text-left py-3 px-3">Mode</th>
                                    <th className="text-right py-3 px-3">Score</th>
                                    <th className="text-right py-3 px-3">Matches</th>
                                    <th className="text-right py-3 px-3">Combo</th>
                                    <th className="text-right py-3 px-3">Cascades</th>
                                    <th className="text-right py-3 px-3">Bombs</th>
                                    <th className="text-right py-3 px-3">Cosmic</th>
                                    <th className="text-left py-3 px-3">Flags</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGames.map((g, i) => {
                                    const style = SEVERITY_STYLES[g.severity] || SEVERITY_STYLES.low;
                                    return (
                                        <tr key={i} className={`border-b border-white/5 ${style.bg}`}>
                                            <td className="py-2 px-3">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${style.bg} ${style.text} border ${style.border}`}>
                                                    {g.severity}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3">
                                                <Link
                                                    href={`/admin/user/${g.username}`}
                                                    className="text-[#B366FF] hover:underline font-bold"
                                                >
                                                    {g.username}
                                                </Link>
                                            </td>
                                            <td className="py-2 px-3 text-white/50 whitespace-nowrap">
                                                {new Date(g.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className={g.gameMode === "daily" ? "text-[#B366FF]" : "text-white/70"}>
                                                    {g.gameMode}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-[#FFE048]">
                                                {g.score.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-3 text-right">{g.matchCount}</td>
                                            <td className="py-2 px-3 text-right">{g.maxCombo}</td>
                                            <td className="py-2 px-3 text-right">{g.totalCascades}</td>
                                            <td className="py-2 px-3 text-right">{g.bombsCreated}</td>
                                            <td className="py-2 px-3 text-right">{g.cosmicBlastsCreated}</td>
                                            <td className="py-2 px-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {g.flags.map(f => (
                                                        <span
                                                            key={f.id}
                                                            className={`text-[9px] px-1.5 py-0.5 rounded ${SEVERITY_STYLES[f.severity].bg} ${SEVERITY_STYLES[f.severity].text}`}
                                                            title={f.id}
                                                        >
                                                            {f.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                <p className="text-[10px] text-white/30 mt-3">
                    Scans the last 200 games per user (up to 5000 users). Anomalies are detected via heuristic
                    thresholds — "critical" means the stat is essentially impossible, "high" is very unusual,
                    "medium" is worth reviewing, "low" is mildly suspicious. Tune thresholds in
                    <code className="text-white/50 mx-1">src/lib/game-anomalies.ts</code>.
                </p>
            </div>
        </div>
    );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'red' | 'none' }) {
    const bgClass = accent === 'red'
        ? "bg-red-500/10 border-red-500/30"
        : "bg-white/5 border-white/10";
    const textClass = accent === 'red' ? "text-red-300" : "text-white";
    return (
        <div className={`rounded-xl p-4 border ${bgClass}`}>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</div>
            <div className={`text-2xl font-display font-black mt-1 ${textClass}`}>{value}</div>
        </div>
    );
}
