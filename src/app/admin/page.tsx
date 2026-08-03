"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch, adminDownload } from "./_lib/adminFetch";
import DailyStatsChart from "./_components/DailyStatsChart";
import TreasuryAuditPanel from "./_components/TreasuryAuditPanel";
import { PROMO_EVENT_SETS } from "@/lib/promo-badges";

/**
 * Reroll reconciliation. Runs the same job the hourly cron runs: auto-credit
 * owed reroll refunds and recover stuck (paid-but-uncredited) reroll
 * reservations. Surfaces anything that needs a human.
 */
function RerollReconcilePanel() {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<null | {
        summary: { refundsCredited: number; stuckRecovered: number; stuckReleased: number; needsReview: number };
        needsReview: Array<{ username: string; txHash: string; reason: string }>;
    }>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setRunning(true);
        setError(null);
        try {
            const res = await adminFetch("/api/admin/reconcile-rerolls");
            if (!res.ok) throw new Error(`Reconcile failed (${res.status})`);
            setResult(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Reconcile failed");
        } finally {
            setRunning(false);
        }
    };

    const s = result?.summary;
    const stat = (label: string, n: number, tone: string) => (
        <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-center">
            <div className="text-2xl font-display font-black tabular-nums" style={{ color: tone }}>{n}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{label}</div>
        </div>
    );

    return (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xl font-display font-black text-[#FFE048] uppercase mb-1">Reroll Reconciliation</h2>
            <p className="text-white/40 text-xs mb-4">
                Credits owed reroll refunds and recovers paid-but-uncredited rerolls (mobile drops, timeouts). Runs hourly on a cron; this button runs it now.
            </p>
            <button
                type="button"
                disabled={running}
                onClick={run}
                className="rounded-lg bg-[#FFE048] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black hover:bg-[#FFE858] disabled:opacity-50"
            >
                {running ? "Running..." : "Run reconcile now"}
            </button>
            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
            {s && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        {stat("Refunds credited", s.refundsCredited, "#4ADE80")}
                        {stat("Stuck recovered", s.stuckRecovered, "#4ADE80")}
                        {stat("Bogus released", s.stuckReleased, "#B366FF")}
                        {stat("Needs review", s.needsReview, s.needsReview > 0 ? "#F87171" : "#FFFFFF66")}
                    </div>
                    {result!.needsReview.length > 0 && (
                        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-wider text-red-300/80 mb-2">Needs manual review</div>
                            <div className="space-y-1">
                                {result!.needsReview.map((r) => (
                                    <div key={r.txHash} className="text-[11px] text-white/60 font-mono break-all">
                                        <span className="text-white/80">{r.username}</span> — {r.reason} — {r.txHash}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Purchase (restock-plays) reconciliation. Runs the same job the hourly cron
 * runs: credit paid-but-unrecorded purchases, and surface the two cases the
 * cron can't auto-resolve — over-cap payments (need a credit/refund decision)
 * and payments from wallets not linked to any account (need manual ID).
 */
function PurchaseReconcilePanel() {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<null | {
        credited: number; refundQueued: number; unresolved: number;
        pendingRefunds: Array<{ username: string; packageSize: number; amount: string; rail: string; reason: string; txHash: string }>;
        unresolvedPayments: Array<{ from: string; amount: string; rail: string; reason: string; txHash: string }>;
    }>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setRunning(true);
        setError(null);
        try {
            const res = await adminFetch("/api/admin/reconcile-purchases");
            if (!res.ok) throw new Error(`Reconcile failed (${res.status})`);
            setResult(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Reconcile failed");
        } finally {
            setRunning(false);
        }
    };

    const stat = (label: string, n: number, tone: string) => (
        <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-center">
            <div className="text-2xl font-display font-black tabular-nums" style={{ color: tone }}>{n}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{label}</div>
        </div>
    );

    return (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xl font-display font-black text-[#FFE048] uppercase mb-1">Purchase Reconciliation</h2>
            <p className="text-white/40 text-xs mb-4">
                Credits paid-but-unrecorded restock purchases (mobile drops, timeouts). Surfaces over-cap payments and payments from unlinked wallets that need a manual call. Runs hourly on a cron; this runs it now.
            </p>
            <button
                type="button"
                disabled={running}
                onClick={run}
                className="rounded-lg bg-[#FFE048] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black hover:bg-[#FFE858] disabled:opacity-50"
            >
                {running ? "Running..." : "Run reconcile now"}
            </button>
            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
            {result && (
                <>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        {stat("Credited", result.credited, "#4ADE80")}
                        {stat("Over-cap refunds", result.refundQueued, result.pendingRefunds.length > 0 ? "#FBBF24" : "#FFFFFF66")}
                        {stat("Unlinked payments", result.unresolved, result.unresolvedPayments.length > 0 ? "#F87171" : "#FFFFFF66")}
                    </div>
                    {result.pendingRefunds.length > 0 && (
                        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-2">Over-cap payments awaiting credit/refund</div>
                            <div className="space-y-1">
                                {result.pendingRefunds.map((r) => (
                                    <div key={r.txHash} className="text-[11px] text-white/60 break-all">
                                        <span className="text-white/85 font-semibold">{r.username}</span> — {r.packageSize} games ({r.amount} {r.rail}) — {r.reason}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {result.unresolvedPayments.length > 0 && (
                        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-wider text-red-300/80 mb-2">Payments from unlinked wallets (manual ID)</div>
                            <div className="space-y-1">
                                {result.unresolvedPayments.map((r) => (
                                    <div key={r.txHash} className="text-[11px] text-white/60 font-mono break-all">
                                        {r.amount} {r.rail} from {r.from} — {r.reason}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Event results export. Pick any event set and download the full participant
 * record (rank, points, full sets, set-finish time, grails, wallet, email,
 * GVC flag, created-at) as CSV. Ranking mirrors the live leaderboard cascade.
 */
function EventExportPanel() {
    const events = PROMO_EVENT_SETS;
    const [selected, setSelected] = useState(events[events.length - 1]?.id ?? "");
    const [busy, setBusy] = useState(false);
    const chosen = events.find(e => e.id === selected);

    return (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xl font-display font-black text-[#FFE048] uppercase mb-1">Event Results</h2>
            <p className="text-white/40 text-xs mb-4">
                Full participant record for a chosen event: rankings, scores, wallets, and recovery emails where available.
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={selected}
                    onChange={e => setSelected(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#FFE048]"
                >
                    {events.map(ev => (
                        <option key={ev.id} value={ev.id} className="bg-[#1a1a1a]">
                            {ev.name}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    disabled={!selected || busy}
                    onClick={() => {
                        setBusy(true);
                        adminDownload(
                            `/api/admin/export?type=event&event=${encodeURIComponent(selected)}`,
                            `event-${selected}.csv`,
                        ).catch(() => {}).finally(() => setBusy(false));
                    }}
                    className="rounded-lg bg-[#FFE048] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black hover:bg-[#FFE858] disabled:opacity-50"
                >
                    {busy ? "Exporting..." : "Export CSV"}
                </button>
            </div>
            {chosen && (
                <p className="text-white/30 text-[11px] mt-3">
                    {chosen.name}{chosen.partnerName ? ` (${chosen.partnerName})` : ""}
                    {chosen.endsAt ? ` — ends ${new Date(chosen.endsAt).toISOString().split("T")[0]}` : ""}
                </p>
            )}
        </div>
    );
}

// Sortable columns. The string union doubles as the column id for the
// header click handlers and as the discriminator for the sort comparator.
type SortKey =
    | "username"
    | "wallet"
    | "createdAt"
    | "highScore"
    | "uniquePins"
    | "capsules"
    | "totalEarned"
    | "totalOpened"
    | "vibestrSpent"
    | "purchaseCount"
    | "rerollCount";

type SortDir = "asc" | "desc";

interface SortableHeaderProps {
    label: string;
    column: SortKey;
    activeKey: SortKey;
    dir: SortDir;
    onClick: (k: SortKey) => void;
    align?: "left" | "right";
}

function SortableHeader({ label, column, activeKey, dir, onClick, align = "left" }: SortableHeaderProps) {
    const active = column === activeKey;
    const arrow = active ? (dir === "asc" ? "▲" : "▼") : "";
    return (
        <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:text-white`}
            onClick={() => onClick(column)}
            title={`Sort by ${label}`}
        >
            <span>{label}</span>
            {arrow && <span className="ml-1 text-[#FFE048] text-[10px]">{arrow}</span>}
        </th>
    );
}

interface Overview {
    totalUsers: number;
    totalPinbookUsers: number;
    totalCapsulesEarned: number;
    totalPinsCollected: number;
    totalTransactions: number;
    totalPurchaseTxs?: number;
    totalRerolls?: number;
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
    rerollCount?: number;
}

export default function AdminDashboard() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [shown, setShown] = useState(0);
    const [sortKey, setSortKey] = useState<SortKey>("highScore");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const sortedUsers = useMemo(() => {
        const arr = [...users];
        const cmp = (a: User, b: User): number => {
            const dir = sortDir === "asc" ? 1 : -1;
            switch (sortKey) {
                case "username":
                    return dir * a.username.localeCompare(b.username);
                case "wallet":
                    return dir * (a.walletAddress || "").localeCompare(b.walletAddress || "");
                case "createdAt": {
                    const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dir * (aT - bT);
                }
                case "highScore":
                    return dir * ((a.highScore || 0) - (b.highScore || 0));
                case "uniquePins":
                    return dir * ((a.uniquePins || 0) - (b.uniquePins || 0));
                case "capsules":
                    return dir * ((a.capsules || 0) - (b.capsules || 0));
                case "totalEarned":
                    return dir * ((a.totalEarned || 0) - (b.totalEarned || 0));
                case "totalOpened":
                    return dir * ((a.totalOpened || 0) - (b.totalOpened || 0));
                case "vibestrSpent":
                    return dir * ((a.vibestrSpent || 0) - (b.vibestrSpent || 0));
                case "purchaseCount":
                    return dir * ((a.purchaseCount || 0) - (b.purchaseCount || 0));
                case "rerollCount":
                    return dir * ((a.rerollCount || 0) - (b.rerollCount || 0));
                default:
                    return 0;
            }
        };
        arr.sort(cmp);
        return arr;
    }, [users, sortKey, sortDir]);

    const handleSort = (col: SortKey) => {
        if (col === sortKey) {
            // Toggle direction if same column.
            setSortDir(d => (d === "asc" ? "desc" : "asc"));
        } else {
            // New column: default to descending for numeric-ish columns,
            // ascending for username so alphabetical reads naturally.
            setSortKey(col);
            setSortDir(col === "username" || col === "wallet" ? "asc" : "desc");
        }
    };

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
                    <StatCard label="Pin Rerolls" value={overview?.totalRerolls ?? "—"} accent />
                </div>
            </div>

            {/* Daily activity chart */}
            <DailyStatsChart />

            {/* Treasury audit — diffs on-chain inflows against KV tx records */}
            <TreasuryAuditPanel />

            <EventExportPanel />

            <RerollReconcilePanel />

            <PurchaseReconcilePanel />

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
                                <SortableHeader label="Username"     column="username"     activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                                <SortableHeader label="Wallet"       column="wallet"       activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                                <SortableHeader label="Created"      column="createdAt"    activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                                <SortableHeader label="High Score"   column="highScore"    activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="Unique Pins"  column="uniquePins"   activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="Capsules"     column="capsules"     activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="Earned"       column="totalEarned"  activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="Opened"       column="totalOpened"  activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="VIBESTR Spent" column="vibestrSpent" activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="Purchases"    column="purchaseCount" activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <SortableHeader label="Rerolls"      column="rerollCount"  activeKey={sortKey} dir={sortDir} onClick={handleSort} align="right" />
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && users.length === 0 && (
                                <tr><td colSpan={12} className="px-4 py-8 text-center text-white/40">Loading...</td></tr>
                            )}
                            {!loading && users.length === 0 && (
                                <tr><td colSpan={12} className="px-4 py-8 text-center text-white/40">No users found</td></tr>
                            )}
                            {sortedUsers.map(u => (
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
                                    <td className="px-4 py-3 text-right text-[#B366FF]">
                                        {u.rerollCount && u.rerollCount > 0 ? u.rerollCount : "—"}
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
