"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { adminFetch } from "../../_lib/adminFetch";

interface AuditEvent {
    ts: number;
    action: string;
    username: string;
    ipHash: string;
    ua: string;
    meta?: Record<string, string | number | boolean>;
}

interface UserAuditResponse {
    username: string;
    events: AuditEvent[];
    totalReturned: number;
    capped: boolean;
}

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
    "score.post":        { bg: "bg-green-500/15",   text: "text-green-300" },
    "score.rejected":    { bg: "bg-red-500/20",     text: "text-red-300" },
    "capsule.open":      { bg: "bg-blue-500/15",    text: "text-blue-300" },
    "capsule.purchase":  { bg: "bg-yellow-500/15",  text: "text-yellow-300" },
    "reroll.post":       { bg: "bg-purple-500/15",  text: "text-purple-300" },
};

function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function summarizeUa(ua: string): string {
    // The UA is stored at full 200-char truncation; surface a tighter
    // summary in the table to keep rows readable.
    if (!ua) return "(none)";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS · " + (ua.match(/CPU (?:iPhone )?OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") || "?");
    if (/Android/i.test(ua)) return "Android · " + (ua.match(/Android ([\d.]+)/)?.[1] || "?");
    if (/Macintosh/i.test(ua)) return "macOS · " + (ua.match(/Chrome\/([\d.]+)|Safari\/([\d.]+)/i)?.[0] || "");
    if (/Windows/i.test(ua)) return "Windows · " + (ua.match(/Chrome\/([\d.]+)|Edg\/([\d.]+)/i)?.[0] || "");
    if (/Linux/i.test(ua)) return "Linux";
    return ua.slice(0, 60);
}

export default function UserAuditPage({ params }: { params: Promise<{ username: string }> }) {
    const { username: rawUsername } = use(params);
    const username = decodeURIComponent(rawUsername);
    const [data, setData] = useState<UserAuditResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState<string>("all");

    useEffect(() => {
        setLoading(true);
        adminFetch(`/api/admin/audit/user?username=${encodeURIComponent(username)}&limit=500`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [username]);

    const allEvents = data?.events ?? [];
    const filteredEvents = actionFilter === "all"
        ? allEvents
        : allEvents.filter(e => e.action === actionFilter);

    // Count distinct IP hashes for the summary chip
    const distinctIps = new Set(allEvents.map(e => e.ipHash).filter(h => h && h !== "unknown")).size;
    const actionCounts = allEvents.reduce<Record<string, number>>((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/admin/audit" className="text-xs text-white/40 hover:text-white/70 uppercase tracking-wider">
                        ← Audit Log
                    </Link>
                    <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase mt-1">{username}</h1>
                </div>
                <Link
                    href={`/admin/user/${encodeURIComponent(username)}`}
                    className="text-xs text-[#4A9EFF] hover:text-[#FFE048] border border-[#4A9EFF]/40 rounded-full px-3 py-1.5 uppercase tracking-wider font-bold"
                >
                    Full user profile →
                </Link>
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">Total events</div>
                    <div className="text-xl font-display font-black text-white mt-1">{allEvents.length}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">Distinct IP hashes</div>
                    <div className="text-xl font-display font-black text-white mt-1">{distinctIps}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">Score rejections</div>
                    <div className="text-xl font-display font-black text-red-300 mt-1">{actionCounts["score.rejected"] || 0}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">Capsule opens</div>
                    <div className="text-xl font-display font-black text-blue-300 mt-1">{actionCounts["capsule.open"] || 0}</div>
                </div>
            </div>

            {/* Action filter pills */}
            <div className="flex flex-wrap gap-2">
                {(["all", "score.post", "score.rejected", "capsule.open", "capsule.purchase", "reroll.post"] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setActionFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold border transition-all ${
                            actionFilter === s
                                ? "bg-[#FFE048] text-black border-[#FFE048]"
                                : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
                        }`}
                    >
                        {s}{s !== "all" ? ` · ${actionCounts[s] || 0}` : ""}
                    </button>
                ))}
            </div>

            {/* Events table */}
            {loading ? (
                <div className="text-white/40 text-sm py-8 text-center">Loading…</div>
            ) : filteredEvents.length === 0 ? (
                <div className="text-white/40 text-sm py-12 text-center border border-dashed border-white/10 rounded-lg">
                    {allEvents.length === 0
                        ? "No audit events recorded for this user (yet, or beyond the 90-day TTL)."
                        : `No events match filter "${actionFilter}".`}
                </div>
            ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/50">
                            <tr>
                                <th className="text-left px-3 py-2 w-44">Timestamp (UTC)</th>
                                <th className="text-left px-3 py-2 w-36">Action</th>
                                <th className="text-left px-3 py-2 w-40">IP hash</th>
                                <th className="text-left px-3 py-2 w-40">Device</th>
                                <th className="text-left px-3 py-2">Meta</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEvents.map((e, i) => {
                                const style = ACTION_STYLES[e.action] || { bg: "bg-white/5", text: "text-white/60" };
                                return (
                                    <tr key={`${e.ts}-${i}`} className="border-t border-white/[0.05] hover:bg-white/[0.02] align-top">
                                        <td className="px-3 py-2 text-white/70 font-mono whitespace-nowrap">
                                            {formatTimestamp(e.ts)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${style.bg} ${style.text}`}>
                                                {e.action}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {e.ipHash && e.ipHash !== "unknown" ? (
                                                <Link
                                                    href={`/admin/audit/ip/${e.ipHash}`}
                                                    className="font-mono text-[#4A9EFF] hover:text-[#FFE048]"
                                                    title="Show every username seen on this IP"
                                                >
                                                    {e.ipHash}
                                                </Link>
                                            ) : (
                                                <span className="text-white/30 italic">unknown</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-white/60" title={e.ua}>
                                            {summarizeUa(e.ua)}
                                        </td>
                                        <td className="px-3 py-2 text-white/80 font-mono text-[11px] break-all">
                                            {e.meta && Object.keys(e.meta).length > 0
                                                ? Object.entries(e.meta).map(([k, v]) => (
                                                    <span key={k} className="inline-block mr-2 whitespace-nowrap">
                                                        <span className="text-white/40">{k}:</span> {String(v)}
                                                    </span>
                                                ))
                                                : <span className="text-white/30">—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {data?.capped && (
                <div className="text-[11px] text-white/40 text-center">
                    Showing the most recent {data.totalReturned} events; older events exist within the 90-day TTL but
                    are beyond the per-user cap (500).
                </div>
            )}
        </div>
    );
}
