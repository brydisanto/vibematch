"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

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

interface UserDetail {
    auth: { username: string; createdAt: string } | null;
    profile: { username: string; avatarUrl: string } | null;
    pinbook: {
        pins: Record<string, { count: number; firstEarned: string }>;
        capsules: number;
        totalOpened: number;
        totalEarned: number;
    } | null;
    streak: { streak: number; lastPlayed: string } | null;
    achievements: any;
    leaderboardEntry: any;
    highScore: number;
    dailyHighScore: number;
    totalVibestrSpent: number;
    totalBonusGamesPurchased: number;
    dailyTrackers: Array<{
        date: string;
        classicPlays: number;
        bonusPrizeGames?: number;
    }>;
    transactions: Array<{
        txHash: string;
        packageSize: number;
        amount: string;
        timestamp: number;
        wallet: string;
    }>;
    gameLog: GameLogEntry[];
}

export default function AdminUserPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const [data, setData] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/admin/user/${username}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) {
                    setError(d.error);
                } else {
                    setData(d);
                }
                setLoading(false);
            });
    }, [username]);

    if (loading) return <div className="text-white/40">Loading...</div>;
    if (error) return <div className="text-red-400">{error}</div>;
    if (!data) return null;

    const pinsArr = data.pinbook?.pins ? Object.entries(data.pinbook.pins) : [];
    const totalPinsOwned = pinsArr.reduce((sum, [_, v]) => sum + v.count, 0);
    const totalVibestrSpent = data.totalVibestrSpent ?? data.transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">
                    {data.profile?.username || data.auth?.username || username}
                </h1>
                <Link href="/admin" className="text-sm text-white/50 hover:text-white">← Back</Link>
            </div>

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
                <StatCard label="Transactions" value={data.transactions.length} accent />
                <StatCard label="VIBESTR Spent" value={totalVibestrSpent.toLocaleString()} accent />
                <StatCard label="Bonus Games Bought" value={data.totalBonusGamesPurchased || 0} accent />
                <StatCard label="Games Logged" value={data.gameLog?.length || 0} />
            </div>

            {/* Account info */}
            <Section title="Account">
                <Row label="Username" value={data.profile?.username || data.auth?.username || "—"} />
                <Row label="Created" value={data.auth?.createdAt ? new Date(data.auth.createdAt).toLocaleString() : "—"} />
                <Row label="Last Played" value={data.streak?.lastPlayed || "—"} />
            </Section>

            {/* Transactions */}
            <Section title={`Transactions (${data.transactions.length})`}>
                {data.transactions.length === 0 ? (
                    <div className="text-white/40 text-sm">No transactions yet</div>
                ) : (
                    <div className="space-y-2">
                        {data.transactions.map(tx => (
                            <div key={tx.txHash} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div>
                                    <div className="font-bold text-sm">
                                        {tx.packageSize} {tx.packageSize === 1 ? "prize game" : "prize games"}
                                    </div>
                                    <div className="text-xs text-white/50">
                                        {new Date(tx.timestamp).toLocaleString()} · {tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[#FFE048] font-bold">{parseFloat(tx.amount).toLocaleString()} VIBESTR</div>
                                    <a
                                        href={`https://etherscan.io/tx/${tx.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#B366FF] hover:underline text-xs font-mono"
                                    >
                                        {tx.txHash.slice(0, 10)}...
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Game Log — forensic trail for anomaly detection */}
            <Section title={`Game Log (last ${data.gameLog?.length || 0} games)`}>
                {!data.gameLog || data.gameLog.length === 0 ? (
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
                                {data.gameLog.map((g, i) => (
                                    <tr key={i} className={`border-b border-white/5 ${g.flags.length > 0 ? "bg-red-500/5" : ""}`}>
                                        <td className="py-2 px-2 text-white/50 whitespace-nowrap">
                                            {new Date(g.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </td>
                                        <td className="py-2 px-2">
                                            <span className={g.gameMode === "daily" ? "text-[#B366FF]" : "text-white/70"}>
                                                {g.gameMode}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold text-[#FFE048]">
                                            {g.score.toLocaleString()}
                                        </td>
                                        <td className="py-2 px-2 text-right">{g.matchCount}</td>
                                        <td className="py-2 px-2 text-right">{g.maxCombo}</td>
                                        <td className="py-2 px-2 text-right">{g.totalCascades}</td>
                                        <td className="py-2 px-2 text-right">{g.bombsCreated}</td>
                                        <td className="py-2 px-2 text-right">{g.vibestreaksCreated}</td>
                                        <td className="py-2 px-2 text-right">{g.cosmicBlastsCreated}</td>
                                        <td className="py-2 px-2 text-right">{g.crossCount}</td>
                                        <td className="py-2 px-2 text-center">
                                            {g.validatedMatch ? (
                                                <span className="text-green-400">✓</span>
                                            ) : (
                                                <span className="text-white/20">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2">
                                            {g.flags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {g.flags.map(f => (
                                                        <span key={f.id} className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded" title={f.id}>
                                                            {f.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[10px] text-white/30 mt-3">
                    Retains last 500 games per user. Flags highlight statistically unusual values for manual review.
                    "Valid" = game was logged with a server-issued match token (classic mode only).
                </p>
            </Section>

            {/* Daily activity */}
            <Section title={`Daily Activity (last ${data.dailyTrackers.length} days)`}>
                {data.dailyTrackers.length === 0 ? (
                    <div className="text-white/40 text-sm">No daily activity recorded</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="text-white/60 text-xs">
                            <tr>
                                <th className="text-left py-2">Date</th>
                                <th className="text-right py-2">Classic Plays</th>
                                <th className="text-right py-2">Bonus Games</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.dailyTrackers.map(d => (
                                <tr key={d.date} className="border-b border-white/5">
                                    <td className="py-2 font-mono">{d.date}</td>
                                    <td className="py-2 text-right">{d.classicPlays || 0}</td>
                                    <td className="py-2 text-right text-[#FFE048]">{d.bonusPrizeGames || 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Section>

            {/* Pins */}
            {pinsArr.length > 0 && (
                <Section title={`Pins Collected (${pinsArr.length})`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {pinsArr.map(([id, data]) => (
                            <div key={id} className="bg-white/5 rounded px-3 py-2 flex justify-between">
                                <span className="font-mono text-white/70 truncate">{id}</span>
                                <span className="text-[#FFE048] font-bold ml-2">×{data.count}</span>
                            </div>
                        ))}
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
