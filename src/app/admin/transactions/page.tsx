"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Transaction {
    txHash: string;
    username: string;
    wallet: string;
    packageSize: number;
    amount: string;
    timestamp: number;
}

export default function TransactionsPage() {
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/transactions").then(r => r.json()).then(data => {
            setTxs(data.transactions || []);
            setLoading(false);
        });
    }, []);

    const totalSpent = txs.reduce((sum, tx) => sum + parseFloat(tx.amount || "0"), 0);
    const totalGames = txs.reduce((sum, tx) => sum + Number(tx.packageSize || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-baseline justify-between">
                <h1 className="text-2xl font-display font-black text-[#FFE048] uppercase">Transactions</h1>
                <div className="flex gap-6 text-sm text-white/60">
                    <div>
                        <span className="text-white/40">Total:</span>{" "}
                        <span className="text-[#FFE048] font-bold">{totalSpent.toLocaleString()} VIBESTR</span>
                    </div>
                    <div>
                        <span className="text-white/40">Games granted:</span>{" "}
                        <span className="text-white font-bold">{totalGames}</span>
                    </div>
                    <div>
                        <span className="text-white/40">Count:</span>{" "}
                        <span className="text-white font-bold">{txs.length}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr className="text-left text-white/60">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Wallet</th>
                            <th className="px-4 py-3 text-right">Package</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3">Tx Hash</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Loading...</td></tr>}
                        {!loading && txs.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No transactions yet</td></tr>
                        )}
                        {txs.map(tx => (
                            <tr key={tx.txHash} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="px-4 py-3 text-xs text-white/60">
                                    {new Date(tx.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <Link href={`/admin/user/${tx.username}`} className="text-[#B366FF] hover:underline font-bold">
                                        {tx.username}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-white/60">
                                    {tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {tx.packageSize} {tx.packageSize === 1 ? "game" : "games"}
                                </td>
                                <td className="px-4 py-3 text-right text-[#FFE048] font-bold">
                                    {parseFloat(tx.amount).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono">
                                    <a
                                        href={`https://etherscan.io/tx/${tx.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#B366FF] hover:underline"
                                    >
                                        {tx.txHash.slice(0, 10)}...
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
