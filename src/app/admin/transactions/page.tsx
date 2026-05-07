"use client";

import { Component, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch, adminDownload } from "../_lib/adminFetch";

interface Transaction {
    txHash?: string;
    username?: string;
    wallet?: string;
    /** Bonus-game purchases have packageSize; reroll txs don't. */
    packageSize?: number;
    /** Reroll txs are tagged "reroll"; bonus-game purchases have no `type`. */
    type?: string;
    /** Pending / finalized / failed. */
    status?: string;
    amount?: string;
    timestamp?: number;
    /** Reroll-specific. */
    totalCapsules?: number;
}

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
        return { error };
    }
    componentDidCatch(error: Error, info: { componentStack?: string | null }) {
        console.error("[admin/transactions] render crash:", error, info);
    }
    render() {
        if (this.state.error) {
            return (
                <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5 text-sm">
                    <div className="font-display font-black text-red-300 uppercase tracking-wider mb-2 text-xs">
                        Page render error
                    </div>
                    <div className="text-white/80 font-mono whitespace-pre-wrap">
                        {this.state.error.message || String(this.state.error)}
                    </div>
                    {this.state.error.stack && (
                        <details className="mt-3">
                            <summary className="cursor-pointer text-white/50 hover:text-white text-xs">Stack trace</summary>
                            <pre className="mt-2 bg-black/30 rounded p-3 overflow-auto text-[11px] text-white/70">
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

type TypeFilter = "all" | "purchase" | "reroll";
type StatusFilter = "all" | "finalized" | "pending" | "failed";

export default function TransactionsPage() {
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    useEffect(() => {
        adminFetch("/api/admin/transactions")
            .then(r => r.json())
            .then(data => {
                setTxs(Array.isArray(data?.transactions) ? data.transactions : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        return txs.filter(tx => {
            const isReroll = tx.type === "reroll";
            const status = tx.status || "finalized";
            if (typeFilter === "purchase" && isReroll) return false;
            if (typeFilter === "reroll" && !isReroll) return false;
            if (statusFilter !== "all" && status !== statusFilter) return false;
            return true;
        });
    }, [txs, typeFilter, statusFilter]);

    // Stats are computed across the filtered set so the header reflects
    // what's actually in the table.
    const purchases = filtered.filter(tx => tx.type !== "reroll");
    const rerolls = filtered.filter(tx => tx.type === "reroll");
    const totalSpent = filtered.reduce((sum, tx) => sum + parseFloat(tx.amount || "0"), 0);
    const totalGames = purchases.reduce((sum, tx) => sum + Number(tx.packageSize || 0), 0);
    const totalRerollCapsules = rerolls.reduce((sum, tx) => sum + Number(tx.totalCapsules || 0), 0);

    return (
        <PageErrorBoundary>
            <div className="space-y-6">
                <div className="flex items-baseline justify-between flex-wrap gap-3">
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">Transactions</h1>
                        <button
                            type="button"
                            onClick={() => adminDownload("/api/admin/export?type=transactions", "transactions.csv").catch(() => {})}
                            className="text-[10px] text-[#FFE048] hover:text-[#FFE858] uppercase tracking-wider font-bold"
                        >
                            Export CSV
                        </button>
                    </div>
                    <div className="flex gap-x-6 gap-y-1 text-sm text-white/60 flex-wrap">
                        <div>
                            <span className="text-white/40">Total:</span>{" "}
                            <span className="text-[#FFE048] font-bold">{totalSpent.toLocaleString()} VIBESTR</span>
                        </div>
                        <div>
                            <span className="text-white/40">Purchases:</span>{" "}
                            <span className="text-white font-bold">{purchases.length}</span>{" "}
                            <span className="text-white/40">({totalGames} games)</span>
                        </div>
                        <div>
                            <span className="text-white/40">Rerolls:</span>{" "}
                            <span className="text-[#B366FF] font-bold">{rerolls.length}</span>{" "}
                            <span className="text-white/40">({totalRerollCapsules} capsules)</span>
                        </div>
                        <div>
                            <span className="text-white/40">Total rows:</span>{" "}
                            <span className="text-white font-bold">{filtered.length}</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap text-xs">
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                        {(["all", "purchase", "reroll"] as TypeFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setTypeFilter(f)}
                                className={`px-3 py-1.5 rounded font-display font-black uppercase tracking-wider text-[10px] transition-colors ${
                                    typeFilter === f ? "bg-[#FFE048] text-black" : "text-white/60 hover:text-white"
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                        {(["all", "finalized", "pending", "failed"] as StatusFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={`px-3 py-1.5 rounded font-display font-black uppercase tracking-wider text-[10px] transition-colors ${
                                    statusFilter === f ? "bg-[#FFE048] text-black" : "text-white/60 hover:text-white"
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr className="text-left text-white/60">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Wallet</th>
                                <th className="px-4 py-3 text-right">Package / Output</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3">Tx Hash</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">Loading...</td></tr>}
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">No transactions match the filters</td></tr>
                            )}
                            {filtered.map((tx, i) => (
                                <TxRow key={tx.txHash || `${tx.timestamp}-${i}`} tx={tx} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageErrorBoundary>
    );
}

function TxRow({ tx }: { tx: Transaction }) {
    const isReroll = tx.type === "reroll";
    const status = tx.status || "finalized";
    const wallet = typeof tx.wallet === "string" && tx.wallet.length >= 10
        ? `${tx.wallet.slice(0, 6)}...${tx.wallet.slice(-4)}`
        : tx.wallet || "—";
    const txHashShort = typeof tx.txHash === "string" && tx.txHash.length >= 12
        ? `${tx.txHash.slice(0, 10)}...`
        : tx.txHash || "—";
    const amount = parseFloat(tx.amount || "0");

    const typeBadge = isReroll
        ? { label: "Reroll", cls: "bg-[#B366FF]/15 text-[#B366FF] border-[#B366FF]/30" }
        : { label: "Purchase", cls: "bg-[#FFE048]/15 text-[#FFE048] border-[#FFE048]/30" };

    const statusBadge: Record<string, string> = {
        finalized: "bg-green-500/15 text-green-300 border-green-500/30",
        pending:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
        failed:    "bg-red-500/15 text-red-300 border-red-500/30",
    };

    const rowClass = status === "failed"
        ? "bg-red-500/5 border-b border-white/5 hover:bg-red-500/10"
        : status === "pending"
            ? "bg-yellow-500/5 border-b border-white/5 hover:bg-yellow-500/10"
            : "border-b border-white/5 hover:bg-white/[0.02]";

    return (
        <tr className={rowClass}>
            <td className="px-4 py-3 text-xs text-white/60">
                {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "—"}
            </td>
            <td className="px-4 py-3">
                <span className={`text-[10px] font-display font-black uppercase tracking-wider px-2 py-0.5 rounded border ${typeBadge.cls}`}>
                    {typeBadge.label}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={`text-[10px] font-display font-black uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[status] || statusBadge.finalized}`}>
                    {status}
                </span>
            </td>
            <td className="px-4 py-3">
                {tx.username ? (
                    <Link href={`/admin/user/${tx.username}`} className="text-[#B366FF] hover:underline font-bold">
                        {tx.username}
                    </Link>
                ) : (
                    <span className="text-white/30">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-xs font-mono text-white/60">
                {wallet}
            </td>
            <td className="px-4 py-3 text-right text-xs">
                {isReroll
                    ? <span className="text-white/80">{tx.totalCapsules ?? 0} capsule{(tx.totalCapsules ?? 0) === 1 ? "" : "s"}</span>
                    : <span>{tx.packageSize ?? "?"} game{tx.packageSize === 1 ? "" : "s"}</span>}
            </td>
            <td className="px-4 py-3 text-right text-[#FFE048] font-bold">
                {amount.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-xs font-mono">
                {tx.txHash ? (
                    <a
                        href={`https://etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#B366FF] hover:underline"
                    >
                        {txHashShort}
                    </a>
                ) : (
                    <span className="text-white/30">{txHashShort}</span>
                )}
            </td>
        </tr>
    );
}
