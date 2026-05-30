"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "../_lib/adminFetch";

interface RejectionRow {
    ts: number;
    username: string;
    matchId: string;
    mode: string;
    submitted: number;
    computed: number;
    delta: number;
    movesConsumed: number;
    matchCount: number;
    maxCombo: number;
    totalCascades: number;
    bombsCreated: number;
}

interface OffenderRow {
    username: string;
    count: number;
    largestDelta: number;
    largestDeltaSubmitted: number;
    largestDeltaTs: number;
    mostRecentTs: number;
    sample: RejectionRow;
}

interface ApiResponse {
    windowDays: number;
    scanned: number;
    totalRejections: number;
    uniqueOffenders: number;
    recent: RejectionRow[];
    offenders: OffenderRow[];
}

const TABS = [
    { id: "offenders", label: "Repeat offenders" },
    { id: "recent", label: "Recent rejections" },
] as const;
type TabId = typeof TABS[number]["id"];

function fmtScore(n: number): string {
    return n.toLocaleString();
}

function fmtDate(ts: number): string {
    const d = new Date(ts);
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${month}-${day} ${hh}:${mm}`;
}

export default function RejectionsPage() {
    const [tab, setTab] = useState<TabId>("offenders");
    const [days, setDays] = useState(14);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        adminFetch(`/api/admin/rejections?limit=500&days=${days}`)
            .then(r => r.json())
            .then((d: ApiResponse) => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [days]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">Score Rejections</h1>
                    <p className="text-xs text-white/40 mt-1">
                        Submissions blocked by REPLAY_ENFORCEMENT=reject. Snapshots include
                        seed + move sequence, 90-day retention.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/40">Window:</span>
                    {[1, 7, 14, 30, 90].map(d => (
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

            {/* Top-line stat strip */}
            {data && !loading && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Rejections in window</div>
                        <div className="text-2xl font-display font-black text-white mt-1">{data.totalRejections}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Unique offenders</div>
                        <div className="text-2xl font-display font-black text-white mt-1">{data.uniqueOffenders}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Repeat offenders (2+)</div>
                        <div className="text-2xl font-display font-black text-[#FF6B6B] mt-1">
                            {data.offenders.filter(o => o.count >= 2).length}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 border-b border-white/10">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-display font-black uppercase tracking-wider border-b-2 -mb-px transition-all ${tab === t.id ? "text-[#FFE048] border-[#FFE048]" : "text-white/50 border-transparent hover:text-white/80"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading && <div className="text-white/40 text-sm py-12 text-center">Loading…</div>}

            {!loading && data && tab === "offenders" && (
                <div className="rounded-lg border border-white/10 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/50">
                            <tr>
                                <th className="text-left px-3 py-2">User</th>
                                <th className="text-right px-3 py-2">Rejections</th>
                                <th className="text-right px-3 py-2">Largest Δ</th>
                                <th className="text-right px-3 py-2">Largest submitted</th>
                                <th className="text-right px-3 py-2">Most recent</th>
                                <th className="text-right px-3 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.offenders.length === 0 && (
                                <tr><td colSpan={6} className="px-3 py-8 text-center text-white/40">No rejections in this window.</td></tr>
                            )}
                            {data.offenders.map(o => (
                                <tr key={o.username} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                                    <td className="px-3 py-2 font-display font-black text-white">{o.username}</td>
                                    <td className={`px-3 py-2 text-right font-display font-black ${o.count >= 2 ? "text-[#FF6B6B]" : "text-[#FFE048]"}`}>
                                        {o.count}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-white/80">{fmtScore(o.largestDelta)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-white/60">{fmtScore(o.largestDeltaSubmitted)}</td>
                                    <td className="px-3 py-2 text-right text-white/50 text-xs">{fmtDate(o.mostRecentTs)}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Link
                                            href={`/admin/user/${o.username.toLowerCase()}`}
                                            className="text-[#4A9EFF] hover:text-[#FFE048] text-xs uppercase tracking-wider font-bold"
                                        >
                                            Profile →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && data && tab === "recent" && (
                <div className="rounded-lg border border-white/10 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/50">
                            <tr>
                                <th className="text-left px-3 py-2">When</th>
                                <th className="text-left px-3 py-2">User</th>
                                <th className="text-right px-3 py-2">Submitted</th>
                                <th className="text-right px-3 py-2">Replay</th>
                                <th className="text-right px-3 py-2">Δ</th>
                                <th className="text-right px-3 py-2">Moves</th>
                                <th className="text-right px-3 py-2">Bombs (replay)</th>
                                <th className="text-right px-3 py-2">Combo</th>
                                <th className="text-left px-3 py-2">Match ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.recent.length === 0 && (
                                <tr><td colSpan={9} className="px-3 py-8 text-center text-white/40">No rejections in this window.</td></tr>
                            )}
                            {data.recent.map(r => (
                                <tr key={`${r.ts}-${r.matchId}`} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                                    <td className="px-3 py-2 text-white/50 text-xs whitespace-nowrap">{fmtDate(r.ts)}</td>
                                    <td className="px-3 py-2 font-display font-black text-white">
                                        <Link href={`/admin/user/${r.username.toLowerCase()}`} className="hover:text-[#FFE048]">
                                            {r.username}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-white/80">{fmtScore(r.submitted)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-white/60">{fmtScore(r.computed)}</td>
                                    <td className={`px-3 py-2 text-right font-mono font-bold ${Math.abs(r.delta) > 10000 ? "text-[#FF6B6B]" : "text-white/80"}`}>
                                        {r.delta > 0 ? "+" : ""}{fmtScore(r.delta)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-white/60">{r.movesConsumed}</td>
                                    <td className="px-3 py-2 text-right text-white/60">{r.bombsCreated}</td>
                                    <td className="px-3 py-2 text-right text-white/60">{r.maxCombo}</td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-white/30 whitespace-nowrap">{r.matchId?.slice(0, 8)}…</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
