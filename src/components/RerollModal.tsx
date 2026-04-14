'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther, parseAbi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { BADGES, TIER_COLORS, TIER_DISPLAY_NAMES, type BadgeTier } from '@/lib/badges';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`;
const VIBESTR_ADDRESS = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const VIBESTR_PER_REROLL = 1;
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 3000;

const BURN_COST: Record<string, number> = {
    blue: 5,
    silver: 4,
    special: 3,
    gold: 2,
    cosmic: 1,
};

const TIER_ORDER: BadgeTier[] = ['blue', 'silver', 'special', 'gold', 'cosmic'];

interface RerollModalProps {
    isOpen: boolean;
    onClose: () => void;
    pins: Record<string, { count: number; firstEarned: string }>;
    onSuccess: () => void; // reload pinbook after reroll
}

function getBurnableDuplicates(pins: Record<string, { count: number }>, tier: BadgeTier): number {
    const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));
    let count = 0;
    for (const [id, data] of Object.entries(pins)) {
        if (badgeTierMap.get(id) === tier && data.count > 1) {
            count += data.count - 1;
        }
    }
    return count;
}

export default function RerollModal({ isOpen, onClose, pins, onSuccess }: RerollModalProps) {
    const { address, isConnected } = useAccount();
    // burns = how many capsules to reroll from each tier
    const [burns, setBurns] = useState<Record<BadgeTier, number>>({ blue: 0, silver: 0, special: 0, gold: 0, cosmic: 0 });
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [statusText, setStatusText] = useState('');
    const pollingRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const addressRef = useRef(address);
    const burnsRef = useRef(burns);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { burnsRef.current = burns; }, [burns]);

    const { writeContractAsync, isPending: isSending, reset: resetTx } = useWriteContract();

    // Computed values across all tiers
    const totalCapsules = Object.values(burns).reduce((s, v) => s + v, 0);
    const totalVibestr = VIBESTR_PER_REROLL * totalCapsules;
    const canBurn = totalCapsules > 0 && TIER_ORDER.every(tier => {
        const qty = burns[tier];
        if (qty <= 0) return true;
        return getBurnableDuplicates(pins, tier) >= BURN_COST[tier] * qty;
    });

    const startPolling = (hash: string) => {
        setVerifying(true);
        pollingRef.current = true;

        const poll = async (attempt: number) => {
            if (!pollingRef.current) return;
            if (attempt >= MAX_POLL_ATTEMPTS) {
                setVerifying(false);
                pollingRef.current = false;
                setError('Taking longer than expected. Please close and check.');
                return;
            }

            setStatusText(attempt === 0 ? 'Confirming on-chain...' : `Confirming... (${attempt}/${MAX_POLL_ATTEMPTS})`);

            try {
                const res = await fetch('/api/pinbook/reroll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        txHash: hash,
                        walletAddress: addressRef.current,
                        burns: burnsRef.current,
                    }),
                });
                const data = await res.json();

                if (data.success) {
                    pollingRef.current = false;
                    setVerifying(false);
                    setSuccess(true);
                    onSuccess();
                    return;
                }

                if (res.status === 404 || res.status === 425 || res.status >= 500) {
                    timerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
                    return;
                }

                pollingRef.current = false;
                setVerifying(false);
                setError(data.error || 'Verification failed');
            } catch {
                timerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
            }
        };

        poll(0);
    };

    const handleReroll = async () => {
        if (!isConnected || !address || !canBurn) return;
        setError(null);

        if (!TREASURY_ADDRESS || !TREASURY_ADDRESS.startsWith('0x')) {
            setError('Config error: treasury not set.');
            return;
        }

        try {
            const hash = await writeContractAsync({
                address: VIBESTR_ADDRESS,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [TREASURY_ADDRESS, parseEther(String(totalVibestr))],
            });
            startPolling(hash);
        } catch (err: any) {
            const raw = err?.shortMessage || err?.message || String(err);
            if (raw.includes('rejected') || raw.includes('User denied')) {
                setError('Transaction was rejected.');
            } else if (raw.includes('insufficient') || raw.includes('exceeds the balance')) {
                setError('Not enough VIBESTR in your wallet.');
            } else {
                setError(`Transaction failed: ${raw.slice(0, 100)}`);
            }
        }
    };

    const handleClose = () => {
        pollingRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        setError(null);
        setSuccess(false);
        setVerifying(false);
        setStatusText('');
        resetTx();
        onClose();
    };

    useEffect(() => {
        return () => {
            pollingRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const isProcessing = isSending || verifying;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={handleClose}
                >
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative rounded-2xl p-[3px] max-w-md w-full shadow-2xl"
                        style={{
                            background: "linear-gradient(180deg, #FF8C42 0%, #c96a20 40%, #8B4514 100%)",
                            boxShadow: "0 2px 0 #8B4514, 0 8px 25px rgba(0,0,0,0.6)",
                        }}
                    >
                        <div className="rounded-[13px] p-6 relative" style={{
                            background: "linear-gradient(180deg, #2A1A0A 0%, #1A1005 100%)",
                        }}>
                            <button onClick={handleClose} className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors z-10">
                                <X size={18} />
                            </button>

                            {success ? (
                                <div className="text-center py-4">
                                    <motion.img
                                        src="/assets/gvc_shaka.png"
                                        alt=""
                                        className="w-16 h-16 mx-auto mb-4 object-contain"
                                        animate={{ rotate: [0, -12, 12, -8, 8, -4, 4, 0] }}
                                        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                                    />
                                    <h2 className="font-display text-2xl font-black text-[#FF8C42] mb-2">Reroll Complete!</h2>
                                    <p className="text-white/70 font-mundial text-sm mb-6">
                                        Burned your duplicates and got {totalCapsules} new {totalCapsules === 1 ? 'capsule' : 'capsules'}. Open them from your Pin Book!
                                    </p>
                                    <button
                                        onClick={handleClose}
                                        className="px-6 py-3 rounded-lg font-black font-mundial uppercase tracking-wider transition-all hover:brightness-110"
                                        style={{ background: "#FF8C42", color: "#1A0633" }}
                                    >
                                        Nice!
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="font-display text-2xl font-black text-[#FF8C42] mb-1 uppercase">Pin Reroll</h2>
                                    <p className="text-white/50 text-xs font-mundial mb-4">
                                        Burn duplicate pins + {VIBESTR_PER_REROLL} $VIBESTR for a new random capsule.
                                    </p>

                                    {/* Per-tier burn controls — Option D: sliders with progress bars */}
                                    <div className="space-y-3 mb-4">
                                        {TIER_ORDER.map(tier => {
                                            const dupes = getBurnableDuplicates(pins, tier);
                                            const cost = BURN_COST[tier];
                                            const maxForTier = Math.min(20, Math.floor(dupes / cost));
                                            const qty = burns[tier];
                                            const pinsBurning = cost * qty;
                                            const fillPct = dupes > 0 ? (pinsBurning / dupes) * 100 : 0;

                                            if (dupes === 0) return null;

                                            return (
                                                <div key={tier}>
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xs font-black uppercase tracking-wider" style={{ color: TIER_COLORS[tier] }}>
                                                                {TIER_DISPLAY_NAMES[tier]}
                                                            </span>
                                                            <span className="text-[10px] text-white/35 font-mundial">{cost} per capsule</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => setBurns(b => ({ ...b, [tier]: Math.max(0, b[tier] - 1) }))}
                                                                disabled={qty <= 0}
                                                                className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 text-sm font-bold disabled:opacity-20 transition-colors"
                                                            >-</button>
                                                            <span className="text-white font-display font-black text-base w-6 text-center">{qty}</span>
                                                            <button
                                                                onClick={() => setBurns(b => ({ ...b, [tier]: Math.min(maxForTier, b[tier] + 1) }))}
                                                                disabled={qty >= maxForTier}
                                                                className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 text-sm font-bold disabled:opacity-20 transition-colors"
                                                            >+</button>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${TIER_COLORS[tier]}15` }}>
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{ width: `${fillPct}%`, background: TIER_COLORS[tier] }}
                                                        />
                                                    </div>
                                                    <div className="text-[9px] text-white/30 font-mundial mt-1">
                                                        {pinsBurning > 0
                                                            ? `Burning ${pinsBurning} of ${dupes} duplicates`
                                                            : `${dupes} duplicates available`
                                                        }
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Cost summary */}
                                    {totalCapsules > 0 && (() => {
                                        const totalPinsBurned = TIER_ORDER.reduce((s, t) => s + BURN_COST[t] * burns[t], 0);
                                        return (
                                            <div
                                                className="rounded-xl p-3 mb-4"
                                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                            >
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-white/40 font-mundial">Total Burned</span>
                                                    <span className="text-white font-bold">{totalPinsBurned} Duplicate {totalPinsBurned === 1 ? 'Pin' : 'Pins'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm mt-1">
                                                    <span className="text-white/40 font-mundial">Cost</span>
                                                    <span className="font-bold text-[#FFE048]">{totalVibestr} $VIBESTR</span>
                                                </div>
                                                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between items-center text-sm">
                                                    <span className="text-white/40 font-mundial">You Get</span>
                                                    <span className="font-bold text-white text-[15px]">{totalCapsules} Random Pin {totalCapsules === 1 ? 'Capsule' : 'Capsules'}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 text-red-400 text-xs text-center">
                                            {error}
                                        </div>
                                    )}

                                    {!isConnected ? (
                                        <div className="flex flex-col items-center gap-3 py-2">
                                            <p className="text-white/50 text-xs font-mundial">Connect your wallet to reroll.</p>
                                            <ConnectButton />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleReroll}
                                            disabled={isProcessing || !canBurn}
                                            className={`w-full py-3 rounded-lg font-black font-mundial uppercase tracking-wider transition-all ${
                                                isProcessing || !canBurn
                                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                    : 'bg-[#FF8C42] text-black hover:brightness-110'
                                            }`}
                                        >
                                            {isSending ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <motion.span
                                                        className="inline-block w-4 h-4 border-2 border-gray-500 border-t-white rounded-full"
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    />
                                                    Confirm in wallet...
                                                </span>
                                            ) : verifying ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <motion.span
                                                        className="inline-block w-4 h-4 border-2 border-gray-500 border-t-[#FF8C42] rounded-full"
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    />
                                                    {statusText}
                                                </span>
                                            ) : totalCapsules > 1 ? `Reroll ${totalCapsules}x for ${totalVibestr} $VIBESTR` : `Reroll for ${totalVibestr} $VIBESTR`}
                                        </button>
                                    )}

                                    <p className="text-white/25 text-[10px] font-mundial text-center mt-3">
                                        Duplicates only burned. You always keep at least 1 of each pin.
                                    </p>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
