"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch } from "../_lib/adminFetch";

interface TopIpEntry {
    hash: string;
    count: number;
}

interface TopIpsResponse {
    hashes: TopIpEntry[];
    scanned: number;
    returned: number;
}

export default function AuditIndexPage() {
    const router = useRouter();
    const [usernameInput, setUsernameInput] = useState("");
    const [topIps, setTopIps] = useState<TopIpsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [minUsers, setMinUsers] = useState(2);

    const fetchTopIps = (force = false) => {
        setLoading(topIps === null);
        if (force) setRefreshing(true);
        const params = new URLSearchParams({
            limit: "50",
            minUsers: String(minUsers),
            ...(force ? { force: "1" } : {}),
        });
        adminFetch(`/api/admin/audit/top-ips?${params}`)
            .then(r => r.json())
            .then(d => {
                setTopIps(d);
                setLoading(false);
                setRefreshing(false);
            })
            .catch(() => {
                setLoading(false);
                setRefreshing(false);
            });
    };

    useEffect(() => {
        fetchTopIps(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minUsers]);

    const onSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const u = usernameInput.trim();
        if (!u) return;
        router.push(`/admin/audit/${encodeURIComponent(u.toLowerCase())}`);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">Audit Log</h1>
                <div className="text-xs text-white/40">
                    Active retention: 90 days · hashed IPs (sha256 + server pepper)
                </div>
            </div>

            {/* Username lookup */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-sm font-display font-black text-white/80 uppercase tracking-wider mb-3">
                    Look up by username
                </h2>
                <form onSubmit={onSearch} className="flex gap-2">
                    <input
                        type="text"
                        value={usernameInput}
                        onChange={e => setUsernameInput(e.target.value)}
                        placeholder="username"
                        className="flex-1 bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFE048]/60"
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#FFE048] text-black font-display font-black text-sm uppercase tracking-wider hover:brightness-110 transition-all"
                    >
                        Open timeline
                    </button>
                </form>
                <p className="text-[11px] text-white/40 mt-2">
                    Returns the most recent 200 audit events for the user (LPUSH order, newest first).
                </p>
            </section>

            {/* Top IPs by username count */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-sm font-display font-black text-white/80 uppercase tracking-wider">
                            Top IPs by username count
                        </h2>
                        <p className="text-[11px] text-white/40 mt-1">
                            IP hashes touched by multiple usernames. Shared devices (family, library)
                            and multi-account farms both surface here — manual review needed.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-white/50">
                            Min users:
                            <select
                                value={minUsers}
                                onChange={e => setMinUsers(parseInt(e.target.value, 10))}
                                className="ml-2 bg-black/40 border border-white/20 rounded px-2 py-1 text-white text-xs"
                            >
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                            </select>
                        </label>
                        <button
                            onClick={() => fetchTopIps(true)}
                            disabled={refreshing}
                            className="px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider font-bold bg-white/5 text-white/70 border border-white/10 hover:border-white/30 transition-all disabled:opacity-50"
                        >
                            {refreshing ? "Scanning…" : "Refresh"}
                        </button>
                    </div>
                </div>

                {loading && !topIps ? (
                    <div className="text-white/40 text-sm py-8 text-center">Scanning audit:ip:* keys…</div>
                ) : !topIps || topIps.hashes.length === 0 ? (
                    <div className="text-white/40 text-sm py-8 text-center">
                        No IP hashes match {minUsers}+ users. {topIps ? `Scanned ${topIps.scanned}.` : ""}
                    </div>
                ) : (
                    <>
                        <div className="text-[11px] text-white/40 mb-2">
                            Scanned {topIps.scanned} IP hash{topIps.scanned === 1 ? "" : "es"}, showing {topIps.returned}.
                        </div>
                        <div className="rounded-lg border border-white/10 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/50">
                                    <tr>
                                        <th className="text-left px-4 py-2 w-32">Users</th>
                                        <th className="text-left px-4 py-2">IP hash</th>
                                        <th className="text-right px-4 py-2 w-32">Inspect</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topIps.hashes.map(row => (
                                        <tr key={row.hash} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                                            <td className="px-4 py-2 font-display font-black text-[#FFE048]">{row.count}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-white/70">{row.hash}</td>
                                            <td className="px-4 py-2 text-right">
                                                <Link
                                                    href={`/admin/audit/ip/${row.hash}`}
                                                    className="text-[#4A9EFF] hover:text-[#FFE048] text-xs uppercase tracking-wider font-bold"
                                                >
                                                    View →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
