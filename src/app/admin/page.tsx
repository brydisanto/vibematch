"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch, adminDownload } from "./_lib/adminFetch";

interface Overview {
    totalUsers: number;
    totalPinbookUsers: number;
    totalCapsulesEarned: number;
    totalPinsCollected: number;
    totalTransactions: number;
    totalVibestrSpent: number;
    totalGamesGranted: number;
}

interface User {
    username: string;
    lowercaseUsername: string;
    createdAt: string | null;
    avatarUrl: string;
    walletAddress: string | null;
    capsules: number;
    totalEarned: number;
    totalOpened: number;
    uniquePins: number;
    highScore: number;
    vibestrSpent: number;
    purchaseCount: number;
}

export default function AdminDashboard() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        adminFetch("/api/admin/overview").then(r => r.json()).then(setOverview).catch(() => {});
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await adminFetch(`/api/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
                const data = await res.json();
                setUsers(data.users || []);
                setTotal(data.total || 0);
                setShown(data.shown || 0);
            } catch {
                setUsers([]);
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [search]);

    return (
        <div className="space-y-8">
            {/* Overview cards */}
            <div>
                <h1 className="text-2xl font-display font-black mb-4 text-[#FFE048] uppercase">Overview</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Users" value={overview?.totalUsers ?? "—"} />
                    <StatCard label="Active (have pinbook)" value={overview?.totalPinbookUsers ?? "—"} />
                    <StatCard label="Capsules Earned" value={overview?.totalCapsulesEarned ?? "—"} />
                    <StatCard label="Pins Collected" value={overview?.totalPinsCollected ?? "—"} />
                    <StatCard label="Transactions" value={overview?.totalTransactions ?? "—"} accent />
                    <StatCard label="VIBESTR Spent" value={overview ? Number(overview.totalVibestrSpent).toLocaleString() : "—"} accent />
                    <StatCard label="Games Purchased" value={overview?.totalGamesGranted ?? "—"} accent />
                    <StatCard label="Avg / Tx" value={
                        overview && overview.totalTransactions > 0
                            ? (overview.totalVibestrSpent / overview.totalTransactions).toFixed(1)
                            : "—"
                    } accent />
                </div>
            </div>

            {/* Users */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-display font-black text-[#FFE048] uppercase">
                        Users <span className="text-white/40 text-sm font-normal">({shown} of {total})</span>
                        <button
                            type="button"
                            onClick={() => adminDownload("/api/admin/export?type=users", "users.csv").catch(() => {})}
                            className="ml-3 text-[10px] text-[#FFE048] hover:text-[#FFE858] uppercase tracking-wider font-bold"
                        >
                            Export CSV
                        </button>
                    </h2>
                    <input
                        type="text"
                        placeholder="Search username..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:border-[#FFE048]"
                    />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr className="text-left text-white/60">
                                <th className="px-4 py-3">Username</th>
                                <th className="px-4 py-3">Wallet</th>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3 text-right">High Score</th>
                                <th className="px-4 py-3 text-right">Unique Pins</th>
                                <th className="px-4 py-3 text-right">Capsules</th>
                                <th className="px-4 py-3 text-right">Earned</th>
                                <th className="px-4 py-3 text-right">Opened</th>
                                <th className="px-4 py-3 text-right">VIBESTR Spent</th>
                                <th className="px-4 py-3 text-right">Purchases</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && users.length === 0 && (
                                <tr><td colSpan={11} className="px-4 py-8 text-center text-white/40">Loading...</td></tr>
                            )}
                            {!loading && users.length === 0 && (
                                <tr><td colSpan={11} className="px-4 py-8 text-center text-white/40">No users found</td></tr>
                            )}
                            {users.map(u => (
                                <tr key={u.lowercaseUsername} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="px-4 py-3 font-bold whitespace-nowrap">{u.username}</td>
                                    <td className="px-4 py-3 text-white/40 text-xs font-mono whitespace-nowrap">
                                        {u.walletAddress ? `${u.walletAddress.slice(0, 6)}...${u.walletAddress.slice(-4)}` : "---"}
                                    </td>
                                    <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-white font-bold">
                                        {u.highScore > 0 ? u.highScore.toLocaleString() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">{u.uniquePins}</td>
                                    <td className="px-4 py-3 text-right text-[#FFE048]">{u.capsules}</td>
                                    <td className="px-4 py-3 text-right">{u.totalEarned}</td>
                                    <td className="px-4 py-3 text-right">{u.totalOpened}</td>
                                    <td className="px-4 py-3 text-right text-[#FFE048] font-bold">
                                        {u.vibestrSpent > 0 ? u.vibestrSpent.toLocaleString() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {u.purchaseCount > 0 ? u.purchaseCount : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link
                                            href={`/admin/user/${u.lowercaseUsername}`}
                                            className="text-[#B366FF] hover:underline text-xs"
                                        >
                                            View →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
    return (
        <div className={`rounded-xl p-4 border ${accent ? "bg-[#FFE048]/5 border-[#FFE048]/20" : "bg-white/5 border-white/10"}`}>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</div>
            <div className={`text-2xl font-display font-black mt-1 ${accent ? "text-[#FFE048]" : "text-white"}`}>{value}</div>
        </div>
    );
}
