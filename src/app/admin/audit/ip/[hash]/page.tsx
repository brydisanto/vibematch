"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { adminFetch } from "../../../_lib/adminFetch";

interface IpAuditResponse {
    hash: string;
    usernames: string[];
    count: number;
}

export default function IpAuditPage({ params }: { params: Promise<{ hash: string }> }) {
    const { hash } = use(params);
    const [data, setData] = useState<IpAuditResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        adminFetch(`/api/admin/audit/ip?hash=${encodeURIComponent(hash)}`)
            .then(r => r.json().then(j => ({ ok: r.ok, body: j })))
            .then(({ ok, body }) => {
                if (!ok) {
                    setError(body?.error || "Read failed");
                    setLoading(false);
                    return;
                }
                setData(body);
                setLoading(false);
            })
            .catch(err => {
                setError(String(err));
                setLoading(false);
            });
    }, [hash]);

    const isSuspect = data ? data.count >= 3 : false;

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/audit" className="text-xs text-white/40 hover:text-white/70 uppercase tracking-wider">
                    ← Audit Log
                </Link>
                <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase mt-1">IP fanout</h1>
                <div className="font-mono text-sm text-white/70 mt-1">{hash}</div>
            </div>

            {error ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300 text-sm">
                    {error}
                </div>
            ) : loading ? (
                <div className="text-white/40 text-sm py-8 text-center">Loading…</div>
            ) : !data || data.usernames.length === 0 ? (
                <div className="text-white/40 text-sm py-12 text-center border border-dashed border-white/10 rounded-lg">
                    No usernames recorded for this IP hash. Either it&apos;s a new hash whose audit window has
                    aged out, or you typed it wrong.
                </div>
            ) : (
                <>
                    {/* Suspect chip */}
                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wider font-bold border ${
                            isSuspect
                                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                : "bg-white/5 text-white/60 border-white/10"
                        }`}>
                            {data.count} username{data.count === 1 ? "" : "s"} on this IP
                        </div>
                        {isSuspect && (
                            <div className="text-xs text-orange-300/80">
                                Multi-user IP — could be a shared device (family/library) or a multi-account farm.
                                Cross-check timelines below.
                            </div>
                        )}
                    </div>

                    {/* Usernames list */}
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/50">
                                <tr>
                                    <th className="text-left px-4 py-2">Username</th>
                                    <th className="text-right px-4 py-2 w-44">Open timeline</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.usernames.map(u => (
                                    <tr key={u} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                                        <td className="px-4 py-2 text-white">{u}</td>
                                        <td className="px-4 py-2 text-right">
                                            <Link
                                                href={`/admin/audit/${encodeURIComponent(u)}`}
                                                className="text-[#4A9EFF] hover:text-[#FFE048] text-xs uppercase tracking-wider font-bold"
                                            >
                                                Audit →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
