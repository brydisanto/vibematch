"use client";

import { Component, ReactNode, useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { adminFetch } from "../../_lib/adminFetch";

interface AnomalyFlag {
    id: string;
    label: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

interface GameLogEntry {
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
    gameOverReason: string;
    matchId: string | null;
    validatedMatch: boolean;
    flags: AnomalyFlag[];
    severity?: 'low' | 'medium' | 'high' | 'critical' | 'none';
}

interface TxRecord {
    txHash: string;
    /** Bonus-game packages have packageSize; reroll txs leave this undefined. */
    packageSize?: number;
    /** Reroll txs are tagged 'reroll'; bonus-game purchases have no `type` field. */
    type?: string;
    amount?: string;
    timestamp?: number;
    wallet?: string;
    burns?: { tier: string; pinsNeeded: number }[];
    totalCapsules?: number;
}

interface UserDetail {
    auth: {
        username: string;
        createdAt: string;
        banned?: boolean;
        bannedAt?: number;
        bannedBy?: string;
        bannedReason?: string;
        preBanScore?: number;
    } | null;
    profile: { username: string; avatarUrl: string } | null;
    pinbook: {
        pins: Record<string, { count: number; firstEarned: string }>;
        capsules: number;
        totalOpened: number;
        totalEarned: number;
    } | null;
    streak: { streak: number; lastPlayed: string } | null;
    achievements: unknown;
    leaderboardEntry: unknown;
    highScore: number;
    dailyHighScore: number;
    totalVibestrSpent: number;
    totalBonusGamesPurchased: number;
    dailyTrackers: Array<{
        date?: string;
        classicPlays?: number;
        bonusPrizeGames?: number;
        capsulesEarned?: number;
        capsulesOpened?: number;
        pinsFound?: number;
        newPinsFound?: number;
        vibestrSpent?: number;
    }>;
    transactions: TxRecord[];
    gameLog: GameLogEntry[];
    tombstone?: {
        deletedAt?: number;
        deletedBy?: string;
        reason?: string;
        canonicalUsername?: string;
    } | null;
}

interface AuditEntry {
    timestamp: number;
    admin: string;
    type: "plays" | "capsules" | "ban" | "unban" | "delete";
    amount?: number;
    note?: string;
    reason?: string;
}

/**
 * Inline error boundary so a render-time crash on this page surfaces the
 * actual stack trace instead of Next.js's generic "Application error"
 * fallback. Without this, malformed data anywhere in the page tree blows
 * up the whole route with no diagnostic.
 */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
        return { error };
    }
    componentDidCatch(error: Error, info: { componentStack?: string | null }) {
        console.error("[admin/user] render crash:", error, info);
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

export default function AdminUserPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const [data, setData] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [grants, setGrants] = useState<AuditEntry[]>([]);

    const refresh = useCallback(() => {
        setLoading(true);
        setError(null);
        adminFetch(`/api/admin/user/${username}`)
            .then(r => r.json())
            .then(d => {
                if (d?.error) {
                    setError(d.error);
                } else {
                    setData(d as UserDetail);
                }
                setLoading(false);
            })
            .catch(e => {
                setError(e?.message || "Admin authorization required");
                setLoading(false);
            });
        adminFetch(`/api/admin/grant?username=${username}`)
            .then(r => r.json())
            .then(d => setGrants(Array.isArray(d?.entries) ? d.entries : []))
            .catch(() => setGrants([]));
    }, [username]);

    useEffect(() => { refresh(); }, [refresh]);

    if (loading) return <div className="text-white/40">Loading...</div>;
    if (error) return <div className="text-red-400">{error}</div>;
    if (!data) return null;

    return (
        <PageErrorBoundary>
            <UserDetailView data={data} username={username} grants={grants} onAfterGrant={refresh} />
        </PageErrorBoundary>
    );
}

function UserDetailView({
    data,
    username,
    grants,
    onAfterGrant,
}: {
    data: UserDetail;
    username: string;
    grants: AuditEntry[];
    onAfterGrant: () => void;
}) {
    // Defensive normalizers — every field is treated as potentially missing
    // so a malformed row from KV (legacy data, partial writes, etc.) doesn't
    // crash the whole page. Render falls back to "—" / 0 instead.
    const transactions: TxRecord[] = Array.isArray(data.transactions) ? data.transactions : [];
    const dailyTrackers = Array.isArray(data.dailyTrackers) ? data.dailyTrackers : [];
    const gameLog = Array.isArray(data.gameLog) ? data.gameLog : [];

    const pinsArr = data.pinbook?.pins && typeof data.pinbook.pins === "object"
        ? Object.entries(data.pinbook.pins)
        : [];
    const totalPinsOwned = pinsArr.reduce((sum, [, v]) => {
        const count = (v as { count?: number } | number | null);
        if (typeof count === "number") return sum + count;
        return sum + (count?.count ?? 0);
    }, 0);
    const totalVibestrSpent = typeof data.totalVibestrSpent === "number"
        ? data.totalVibestrSpent
        : transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || "0"), 0);

    const purchaseTxs = transactions.filter(tx => tx.type !== "reroll");
    const rerollTxs = transactions.filter(tx => tx.type === "reroll");

    const isBanned = data.auth?.banned === true;
    const isDeleted = !!data.tombstone && !data.auth;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">
                        {data.profile?.username || data.auth?.username || username}
                    </h1>
                    {isBanned && (
                        <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-300">
                            Banned
                        </span>
                    )}
                    {isDeleted && (
                        <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-white/10 border border-white/30 text-white/70">
                            Deleted
                        </span>
                    )}
                </div>
                <Link href="/admin" className="text-sm text-white/50 hover:text-white">← Back</Link>
            </div>

            {isBanned && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
                    <div className="font-display font-black uppercase tracking-wider text-red-300 text-xs mb-1">
                        Account banned
                    </div>
                    <div className="text-white/80">
                        Banned {data.auth?.bannedAt ? new Date(data.auth.bannedAt).toLocaleString() : "—"}
                        {data.auth?.bannedBy && <> by <span className="font-mono">{data.auth.bannedBy}</span></>}
                        {data.auth?.bannedReason && <> &middot; <span className="italic">&ldquo;{data.auth.bannedReason}&rdquo;</span></>}
                    </div>
                    {typeof data.auth?.preBanScore === "number" && data.auth.preBanScore > 0 && (
                        <div className="text-white/60 text-xs mt-1">
                            Pre-ban classic high score: {data.auth.preBanScore.toLocaleString()} (will be restored on unban)
                        </div>
                    )}
                </div>
            )}

            {isDeleted && (
                <div className="rounded-xl border border-white/30 bg-white/5 p-4 text-sm">
                    <div className="font-display font-black uppercase tracking-wider text-white/70 text-xs mb-1">
                        Account deleted
                    </div>
                    <div className="text-white/70">
                        Deleted {data.tombstone?.deletedAt ? new Date(data.tombstone.deletedAt).toLocaleString() : "—"}
                        {data.tombstone?.deletedBy && <> by <span className="font-mono">{data.tombstone.deletedBy}</span></>}
                        {data.tombstone?.reason && <> &middot; <span className="italic">&ldquo;{data.tombstone.reason}&rdquo;</span></>}
                    </div>
                </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="High Score" value={data.highScore > 0 ? data.highScore.toLocaleString() : "—"} highlight />
                <StatCard label="Daily High Score" value={data.dailyHighScore > 0 ? data.dailyHighScore.toLocaleString() : "—"} />
                <StatCard label="Unique Pins" value={pinsArr.length} />
                <StatCard label="Total Pins" value={totalPinsOwned} />
                <StatCard label="Capsules (Unopened)" value={data.pinbook?.capsules || 0} />
                <StatCard label="Total Earned" value={data.pinbook?.totalEarned || 0} />
                <StatCard label="Total Opened" value={data.pinbook?.totalOpened || 0} />
                <StatCard label="Current Streak" value={data.streak?.streak || 0} />
                <StatCard label="Purchases" value={purchaseTxs.length} accent />
                <StatCard label="Rerolls" value={rerollTxs.length} accent />
                <StatCard label="VIBESTR Spent" value={totalVibestrSpent.toLocaleString()} accent />
                <StatCard label="Bonus Games Bought" value={data.totalBonusGamesPurchased || 0} accent />
            </div>

            {/* Account info */}
            <Section title="Account">
                <Row label="Username" value={data.profile?.username || data.auth?.username || "—"} />
                <Row label="Created" value={data.auth?.createdAt ? new Date(data.auth.createdAt).toLocaleString() : "—"} />
                <Row label="Last Played" value={data.streak?.lastPlayed || "—"} />
            </Section>

            {/* Account actions: ban / unban / delete */}
            {!isDeleted && (
                <AccountActionsSection
                    username={username}
                    isBanned={isBanned}
                    onActed={onAfterGrant}
                />
            )}

            {/* Admin grants */}
            <GrantSection username={username} grants={grants} onGranted={onAfterGrant} />

            {/* Transactions */}
            <Section title={`Transactions (${transactions.length})`}>
                {transactions.length === 0 ? (
                    <div className="text-white/40 text-sm">No transactions yet</div>
                ) : (
                    <div className="space-y-2">
                        {transactions.map(tx => (
                            <TransactionRow key={tx.txHash || `${tx.timestamp}-${tx.amount}`} tx={tx} />
                        ))}
                    </div>
                )}
            </Section>

            {/* Game Log */}
            <Section title={`Game Log (last ${gameLog.length} games)`}>
                {gameLog.length === 0 ? (
                    <div className="text-white/40 text-sm">No games logged yet</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="text-white/60 border-b border-white/10">
                                <tr>
                                    <th className="text-left py-2 px-2">Date</th>
                                    <th className="text-left py-2 px-2">Mode</th>
                                    <th className="text-right py-2 px-2">Score</th>
                                    <th className="text-right py-2 px-2">Matches</th>
                                    <th className="text-right py-2 px-2">Max Combo</th>
                                    <th className="text-right py-2 px-2">Cascades</th>
                                    <th className="text-right py-2 px-2">Bombs</th>
                                    <th className="text-right py-2 px-2">Streaks</th>
                                    <th className="text-right py-2 px-2">Cosmic</th>
                                    <th className="text-right py-2 px-2">Cross</th>
                                    <th className="text-center py-2 px-2">Valid</th>
                                    <th className="text-left py-2 px-2">Flags</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gameLog.map((g, i) => {
                                    const flags = Array.isArray(g.flags) ? g.flags : [];
                                    return (
                                        <tr key={i} className={`border-b border-white/5 ${flags.length > 0 ? "bg-red-500/5" : ""}`}>
                                            <td className="py-2 px-2 text-white/50 whitespace-nowrap">
                                                {g.timestamp
                                                    ? new Date(g.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                                                    : "—"}
                                            </td>
                                            <td className="py-2 px-2">
                                                <span className={g.gameMode === "daily" ? "text-[#B366FF]" : "text-white/70"}>
                                                    {g.gameMode || "—"}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-right font-bold text-[#FFE048]">
                                                {(g.score ?? 0).toLocaleString()}
                                            </td>
                                            <td className="py-2 px-2 text-right">{g.matchCount ?? 0}</td>
                                            <td className="py-2 px-2 text-right">{g.maxCombo ?? 0}</td>
                                            <td className="py-2 px-2 text-right">{g.totalCascades ?? 0}</td>
                                            <td className="py-2 px-2 text-right">{g.bombsCreated ?? 0}</td>
                                            <td className="py-2 px-2 text-right">{g.vibestreaksCreated ?? 0}</td>
                                            <td className="py-2 px-2 text-right">{g.cosmicBlastsCreated ?? 0}</td>
                                            <td className="py-2 px-2 text-right">{g.crossCount ?? 0}</td>
                                            <td className="py-2 px-2 text-center">
                                                {g.validatedMatch ? (
                                                    <span className="text-green-400">✓</span>
                                                ) : (
                                                    <span className="text-white/20">—</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2">
                                                {flags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {flags.map(f => (
                                                            <span key={f.id} className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded" title={f.id}>
                                                                {f.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[10px] text-white/30 mt-3">
                    Retains last 500 games per user. Flags highlight statistically unusual values for manual review.
                    &quot;Valid&quot; = game was logged with a server-issued match token (classic mode only).
                </p>
            </Section>

            {/* Daily activity */}
            <Section title={`Daily Activity (last ${dailyTrackers.length} days)`}>
                {dailyTrackers.length === 0 ? (
                    <div className="text-white/40 text-sm">No daily activity recorded</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="text-white/60 text-xs">
                            <tr>
                                <th className="text-left py-2">Date</th>
                                <th className="text-right py-2">Classic Plays</th>
                                <th className="text-right py-2">Bonus Games</th>
                                <th className="text-right py-2">Capsules Earned</th>
                                <th className="text-right py-2">Capsules Opened</th>
                                <th className="text-right py-2">Pins Found</th>
                                <th className="text-right py-2">New Pins</th>
                                <th className="text-right py-2">$VIBESTR Spent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyTrackers.map((d, i) => (
                                <tr key={d.date || i} className="border-b border-white/5">
                                    <td className="py-2 font-mono">{d.date || "—"}</td>
                                    <td className="py-2 text-right">{d.classicPlays || 0}</td>
                                    <td className="py-2 text-right text-[#FFE048]">{d.bonusPrizeGames || 0}</td>
                                    <td className="py-2 text-right">{d.capsulesEarned || 0}</td>
                                    <td className="py-2 text-right">{d.capsulesOpened || 0}</td>
                                    <td className="py-2 text-right">{d.pinsFound || 0}</td>
                                    <td className="py-2 text-right text-[#2EEA88]">{d.newPinsFound || 0}</td>
                                    <td className="py-2 text-right text-[#B366FF]">
                                        {d.vibestrSpent ? d.vibestrSpent.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <p className="text-[10px] text-white/30 mt-3">
                    Capsule and pin counters started tracking 2026-05-21. Days before that show 0 across the new columns regardless of actual activity.
                </p>
            </Section>

            {/* Pins */}
            {pinsArr.length > 0 && (
                <Section title={`Pins Collected (${pinsArr.length})`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {pinsArr.map(([id, entry]) => {
                            const count = typeof entry === "number"
                                ? entry
                                : (entry as { count?: number } | null)?.count ?? 0;
                            return (
                                <div key={id} className="bg-white/5 rounded px-3 py-2 flex justify-between">
                                    <span className="font-mono text-white/70 truncate">{id}</span>
                                    <span className="text-[#FFE048] font-bold ml-2">×{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {/* Raw data */}
            <Section title="Raw Data">
                <details className="text-xs">
                    <summary className="cursor-pointer text-white/60 hover:text-white">View raw JSON</summary>
                    <pre className="mt-2 bg-black/30 rounded p-3 overflow-auto text-white/80">{JSON.stringify(data, null, 2)}</pre>
                </details>
            </Section>
        </div>
    );
}

function TransactionRow({ tx }: { tx: TxRecord }) {
    const isReroll = tx.type === "reroll";
    const wallet = typeof tx.wallet === "string" && tx.wallet.length >= 10
        ? `${tx.wallet.slice(0, 6)}...${tx.wallet.slice(-4)}`
        : tx.wallet || "—";
    const txHashLabel = typeof tx.txHash === "string" && tx.txHash.length >= 12
        ? `${tx.txHash.slice(0, 10)}...`
        : tx.txHash || "—";
    const amount = parseFloat(tx.amount || "0");

    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div>
                <div className="font-bold text-sm flex items-center gap-2">
                    {isReroll ? (
                        <>
                            <span className="text-[#B366FF]">Reroll</span>
                            {typeof tx.totalCapsules === "number" && (
                                <span className="text-white/60 text-xs">→ {tx.totalCapsules} capsule{tx.totalCapsules === 1 ? "" : "s"}</span>
                            )}
                        </>
                    ) : (
                        <span>
                            {tx.packageSize ?? "?"} bonus game{tx.packageSize === 1 ? "" : "s"}
                        </span>
                    )}
                </div>
                <div className="text-xs text-white/50">
                    {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "—"} · {wallet}
                </div>
            </div>
            <div className="text-right">
                <div className="text-[#FFE048] font-bold">{amount.toLocaleString()} VIBESTR</div>
                {tx.txHash ? (
                    <a
                        href={`https://etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#B366FF] hover:underline text-xs font-mono"
                    >
                        {txHashLabel}
                    </a>
                ) : (
                    <span className="text-white/30 text-xs font-mono">{txHashLabel}</span>
                )}
            </div>
        </div>
    );
}

function AccountActionsSection({
    username,
    isBanned,
    onActed,
}: {
    username: string;
    isBanned: boolean;
    onActed: () => void;
}) {
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState<null | "ban" | "unban" | "delete">(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteEcho, setDeleteEcho] = useState(""); // type-to-confirm
    const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

    const submit = async (action: "ban" | "unban" | "delete") => {
        if (action === "delete" && deleteEcho.toLowerCase() !== username.toLowerCase()) {
            setFeedback({ kind: "err", msg: `Type "${username}" exactly to confirm deletion` });
            return;
        }
        setPending(action);
        setFeedback(null);
        try {
            const res = await adminFetch("/api/admin/account-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, action, reason: reason.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) {
                setFeedback({ kind: "err", msg: data?.error || `HTTP ${res.status}` });
            } else {
                const msg = action === "ban"
                    ? `Banned. Pre-ban high score saved: ${data.preBanScore != null ? Number(data.preBanScore).toLocaleString() : "—"}`
                    : action === "unban"
                        ? `Unbanned. Restored leaderboard score: ${data.restoredScore != null ? Number(data.restoredScore).toLocaleString() : "—"}`
                        : `Deleted. ${data.keysDeleted ?? 0} KV key(s) removed.`;
                setFeedback({ kind: "ok", msg });
                setReason("");
                setConfirmDelete(false);
                setDeleteEcho("");
                onActed();
            }
        } catch (e) {
            setFeedback({ kind: "err", msg: (e as Error)?.message || "Request failed" });
        } finally {
            setPending(null);
        }
    };

    return (
        <Section title="Account Actions">
            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                        Reason (recorded in audit log)
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g. impossible-score forgery in game log"
                        className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-[#FFE048]"
                        disabled={!!pending}
                        maxLength={500}
                    />
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {!isBanned ? (
                        <button
                            onClick={() => submit("ban")}
                            disabled={!!pending}
                            className="bg-orange-500/20 border border-orange-500/50 text-orange-200 font-display font-black uppercase text-sm tracking-wider px-5 py-2 rounded hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {pending === "ban" ? "Banning..." : "Ban"}
                        </button>
                    ) : (
                        <button
                            onClick={() => submit("unban")}
                            disabled={!!pending}
                            className="bg-green-500/20 border border-green-500/50 text-green-200 font-display font-black uppercase text-sm tracking-wider px-5 py-2 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {pending === "unban" ? "Unbanning..." : "Unban"}
                        </button>
                    )}

                    {!confirmDelete ? (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            disabled={!!pending}
                            className="bg-red-500/15 border border-red-500/50 text-red-200 font-display font-black uppercase text-sm tracking-wider px-5 py-2 rounded hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Delete account
                        </button>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2 bg-red-500/5 border border-red-500/30 rounded px-3 py-2 w-full md:w-auto">
                            <span className="text-xs text-red-200">
                                Type <span className="font-mono font-bold">{username}</span> to confirm:
                            </span>
                            <input
                                type="text"
                                value={deleteEcho}
                                onChange={e => setDeleteEcho(e.target.value)}
                                className="bg-black/40 border border-red-500/40 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-400 w-40"
                                disabled={!!pending}
                            />
                            <button
                                onClick={() => submit("delete")}
                                disabled={!!pending || deleteEcho.toLowerCase() !== username.toLowerCase()}
                                className="bg-red-600 text-white font-display font-black uppercase text-xs tracking-wider px-3 py-1.5 rounded hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {pending === "delete" ? "Deleting..." : "Confirm delete"}
                            </button>
                            <button
                                onClick={() => { setConfirmDelete(false); setDeleteEcho(""); }}
                                disabled={!!pending}
                                className="text-white/60 hover:text-white text-xs px-2 py-1.5"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {feedback && (
                    <div className={`text-sm rounded px-3 py-2 ${feedback.kind === "ok" ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
                        {feedback.msg}
                    </div>
                )}

                <p className="text-[10px] text-white/40 leading-relaxed">
                    <strong>Ban</strong> blocks login + game starts + score submission and removes the user from leaderboards.
                    Reversible: Unban restores their pre-ban classic high score to the leaderboard.
                    {" "}<strong>Delete</strong> wipes the auth record, pinbook, profile, daily trackers, and leaderboard entries.
                    Game logs and on-chain transaction records are preserved for forensics. A tombstone is written so the audit trail survives.
                </p>
            </div>
        </Section>
    );
}

function GrantSection({
    username,
    grants,
    onGranted,
}: {
    username: string;
    grants: AuditEntry[];
    onGranted: () => void;
}) {
    const [type, setType] = useState<"plays" | "capsules">("capsules");
    const [amount, setAmount] = useState(1);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

    const submit = async () => {
        if (!Number.isInteger(amount) || amount <= 0) {
            setFeedback({ kind: "err", msg: "Amount must be a positive integer" });
            return;
        }
        setSubmitting(true);
        setFeedback(null);
        try {
            const res = await adminFetch("/api/admin/grant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, type, amount, note: note.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) {
                setFeedback({ kind: "err", msg: data?.error || `HTTP ${res.status}` });
            } else {
                const balanceTxt = type === "plays"
                    ? `bonus plays today: ${data.balance?.plays ?? "?"}`
                    : `total capsules: ${data.balance?.capsules ?? "?"}`;
                setFeedback({ kind: "ok", msg: `Granted ${amount} ${type}. ${balanceTxt}` });
                setNote("");
                onGranted();
            }
        } catch (e) {
            setFeedback({ kind: "err", msg: (e as Error)?.message || "Request failed" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Section title="Grant">
            <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">Type</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value as "plays" | "capsules")}
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#FFE048]"
                            disabled={submitting}
                        >
                            <option value="capsules">Pin Capsules</option>
                            <option value="plays">Bonus Plays (today)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">Amount</label>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={amount}
                            onChange={e => setAmount(parseInt(e.target.value, 10) || 0)}
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-24 focus:outline-none focus:border-[#FFE048]"
                            disabled={submitting}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">Note (optional)</label>
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="e.g. compensation for daily challenge bug"
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-[#FFE048]"
                            disabled={submitting}
                            maxLength={200}
                        />
                    </div>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="bg-[#FFE048] text-black font-display font-black uppercase text-sm tracking-wider px-5 py-2 rounded hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Granting..." : "Grant"}
                    </button>
                </div>

                {feedback && (
                    <div className={`text-sm rounded px-3 py-2 ${feedback.kind === "ok" ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
                        {feedback.msg}
                    </div>
                )}

                <p className="text-[10px] text-white/40">
                    Bonus plays credit today&apos;s daily tracker only. Capsules credit the user&apos;s pinbook (unopened balance + lifetime earned).
                    Cap of 100 per call. Every grant is logged below for audit.
                </p>

                {grants.length > 0 && (
                    <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2">Audit log ({grants.length})</div>
                        <div className="space-y-1">
                            {grants.map((g, i) => {
                                const isAccountAction = g.type === "ban" || g.type === "unban" || g.type === "delete";
                                const accentClass = g.type === "ban" || g.type === "delete"
                                    ? "text-red-300"
                                    : g.type === "unban"
                                        ? "text-green-300"
                                        : "text-[#FFE048]";
                                const label = isAccountAction
                                    ? g.type.toUpperCase()
                                    : `+${g.amount ?? 0} ${g.type}`;
                                const note = g.note || g.reason;
                                return (
                                    <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs py-1.5 border-b border-white/5 last:border-0">
                                        <span className="text-white/40 font-mono whitespace-nowrap">
                                            {new Date(g.timestamp).toLocaleString()}
                                        </span>
                                        <span className={`font-bold whitespace-nowrap ${accentClass}`}>{label}</span>
                                        <span className="text-white/50 whitespace-nowrap">by {g.admin}</span>
                                        {note && <span className="text-white/70 italic">&ldquo;{note}&rdquo;</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Section>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h2 className="text-lg font-display font-black text-[#FFE048] uppercase mb-3">{title}</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">{children}</div>
        </div>
    );
}

function StatCard({ label, value, accent, highlight }: { label: string; value: string | number; accent?: boolean; highlight?: boolean }) {
    const bgClass = highlight
        ? "bg-[#B366FF]/10 border-[#B366FF]/30"
        : accent
            ? "bg-[#FFE048]/5 border-[#FFE048]/20"
            : "bg-white/5 border-white/10";
    const textClass = highlight ? "text-[#B366FF]" : accent ? "text-[#FFE048]" : "text-white";
    return (
        <div className={`rounded-xl p-4 border ${bgClass}`}>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</div>
            <div className={`text-2xl font-display font-black mt-1 ${textClass}`}>{value}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
            <span className="text-white/50">{label}</span>
            <span className="font-mono">{value}</span>
        </div>
    );
}
