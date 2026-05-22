"use client";

import { useState } from "react";
import { adminFetch } from "../_lib/adminFetch";

interface OrphanTx {
    txHash: string;
    fromWallet: string;
    amount: number;
    timestamp: number;
    reason: "no_kv_record" | "missing_amount" | "amount_mismatch";
    kvRecordedAmount?: number;
}

interface OrphanGroup {
    wallet: string;
    txCount: number;
    totalAmount: number;
    txs: OrphanTx[];
}

interface AuditResult {
    treasuryAddress: string;
    onchainTransferCount: number;
    onchainTotal: number;
    kvRecordedTotal: number;
    unaccountedAmount: number;
    orphanCount: number;
    orphansByWallet: OrphanGroup[];
}

const REASON_LABELS: Record<OrphanTx["reason"], string> = {
    no_kv_record: "No KV record",
    missing_amount: "Reserved but no amount",
    amount_mismatch: "Amount mismatch",
};

function formatNum(n: number): string {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTs(ts: number): string {
    return new Date(ts * 1000).toISOString().slice(0, 19).replace("T", " ");
}

function shortHash(h: string): string {
    return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function shortWallet(w: string): string {
    return `${w.slice(0, 8)}…${w.slice(-4)}`;
}

export default function TreasuryAuditPanel() {
    const [data, setData] = useState<AuditResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedWallet, setExpandedWallet] = useState<string | null>(null);

    const runAudit = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch("/api/admin/audit-treasury");
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || `HTTP ${res.status}`);
                if (json.hint) setError(prev => `${prev} — ${json.hint}`);
                return;
            }
            setData(json as AuditResult);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#15101F] rounded-lg border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-lg font-display font-black text-[#FFE048] uppercase">Treasury Audit</h2>
                <button
                    type="button"
                    onClick={runAudit}
                    disabled={loading}
                    className="px-3 py-1.5 rounded bg-[#FFE048] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#FFE858] disabled:opacity-50 disabled:cursor-wait"
                >
                    {loading ? "Auditing…" : data ? "Re-run" : "Run audit"}
                </button>
            </div>

            <p className="text-xs text-white/40 mb-3 leading-relaxed">
                Compares on-chain VIBESTR transfers to treasury against KV tx records.
                Identifies VIBESTR that landed in treasury without a matching record (= unaccounted spend).
                Read-only — does not modify KV.
            </p>

            {error && (
                <div className="text-red-400 text-sm py-3 px-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {error}
                </div>
            )}

            {data && (
                <>
                    {/* Headline stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        <Stat label="On-chain inflows" value={formatNum(data.onchainTotal)} sub={`${data.onchainTransferCount} txs`} />
                        <Stat label="KV recorded" value={formatNum(data.kvRecordedTotal)} />
                        <Stat
                            label="Unaccounted"
                            value={formatNum(data.unaccountedAmount)}
                            tone={data.unaccountedAmount > 0.5 ? "warn" : "ok"}
                        />
                        <Stat
                            label="Orphan txs"
                            value={data.orphanCount}
                            tone={data.orphanCount > 0 ? "warn" : "ok"}
                        />
                    </div>

                    {/* Orphan list */}
                    {data.orphansByWallet.length === 0 ? (
                        <div className="text-sm text-green-400/80 py-3 px-3 bg-green-500/5 border border-green-500/15 rounded-lg">
                            No orphan transactions. Every on-chain treasury inflow has a matching KV record.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-white/40 uppercase tracking-wider font-bold">
                                Orphans by wallet ({data.orphansByWallet.length})
                            </div>
                            {data.orphansByWallet.map(group => {
                                const open = expandedWallet === group.wallet;
                                return (
                                    <div key={group.wallet} className="bg-black/30 rounded-lg border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedWallet(open ? null : group.wallet)}
                                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]"
                                        >
                                            <div className="flex items-center gap-2 text-left">
                                                <span className="text-white/40 text-xs">{open ? "▼" : "▶"}</span>
                                                <a
                                                    href={`https://etherscan.io/address/${group.wallet}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-mono text-xs text-[#B399D4] hover:text-[#FFE048]"
                                                >
                                                    {shortWallet(group.wallet)}
                                                </a>
                                                <span className="text-white/40 text-xs">·</span>
                                                <span className="text-white/70 text-xs">
                                                    {group.txCount} {group.txCount === 1 ? "tx" : "txs"}
                                                </span>
                                            </div>
                                            <div className="font-display text-base font-black text-[#FFE048]">
                                                {formatNum(group.totalAmount)} <span className="text-[10px] text-white/40">VIBESTR</span>
                                            </div>
                                        </button>
                                        {open && (
                                            <div className="px-3 pb-3 pt-1 space-y-1">
                                                {group.txs.map(tx => (
                                                    <div
                                                        key={tx.txHash}
                                                        className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-black/40 border border-white/5"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <a
                                                                href={`https://etherscan.io/tx/${tx.txHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-mono text-[#B399D4] hover:text-[#FFE048] flex-shrink-0"
                                                            >
                                                                {shortHash(tx.txHash)}
                                                            </a>
                                                            <span className="text-white/30 flex-shrink-0">{formatTs(tx.timestamp)}</span>
                                                            <span
                                                                className="text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase flex-shrink-0"
                                                                style={{
                                                                    background: tx.reason === "amount_mismatch" ? "rgba(255,140,0,0.15)" : "rgba(239,68,68,0.15)",
                                                                    color: tx.reason === "amount_mismatch" ? "#FF8C00" : "#EF4444",
                                                                }}
                                                            >
                                                                {REASON_LABELS[tx.reason]}
                                                            </span>
                                                        </div>
                                                        <div className="font-mono text-white/80 flex-shrink-0">
                                                            {formatNum(tx.amount)}
                                                            {tx.kvRecordedAmount !== undefined && (
                                                                <span className="text-white/30 ml-2">
                                                                    (KV had {formatNum(tx.kvRecordedAmount)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Stat({ label, value, sub, tone = "neutral" }: {
    label: string;
    value: string | number;
    sub?: string;
    tone?: "neutral" | "ok" | "warn";
}) {
    const color = tone === "warn" ? "#EF4444" : tone === "ok" ? "#4ADE80" : "#fff";
    return (
        <div className="bg-black/30 rounded-lg border border-white/5 p-3">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">{label}</div>
            <div className="font-display font-black text-xl" style={{ color }}>{value}</div>
            {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
        </div>
    );
}
