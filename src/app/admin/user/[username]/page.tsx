"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

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
    const totalVibestrSpent = data.transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

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
                <StatCard label="Unique Pins" value={pinsArr.length} />
                <StatCard label="Total Pins" value={totalPinsOwned} />
                <StatCard label="Capsules (Unopened)" value={data.pinbook?.capsules || 0} />
                <StatCard label="Total Earned" value={data.pinbook?.totalEarned || 0} />
                <StatCard label="Current Streak" value={data.streak?.streak || 0} />
                <StatCard label="Total Opened" value={data.pinbook?.totalOpened || 0} />
                <StatCard label="Transactions" value={data.transactions.length} accent />
                <StatCard label="VIBESTR Spent" value={totalVibestrSpent.toLocaleString()} accent />
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

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
    return (
        <div className={`rounded-xl p-4 border ${accent ? "bg-[#FFE048]/5 border-[#FFE048]/20" : "bg-white/5 border-white/10"}`}>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</div>
            <div className={`text-2xl font-display font-black mt-1 ${accent ? "text-[#FFE048]" : "text-white"}`}>{value}</div>
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
