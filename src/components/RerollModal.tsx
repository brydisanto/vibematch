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
const VIBESTR_PER_REROLL = 5;
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
    const [selectedTier, setSelectedTier] = useState<BadgeTier>('blue');
    const [quantity, setQuantity] = useState(1);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [statusText, setStatusText] = useState('');
    const pollingRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const addressRef = useRef(address);
    const selectedTierRef = useRef(selectedTier);
    const quantityRef = useRef(quantity);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { selectedTierRef.current = selectedTier; }, [selectedTier]);
    useEffect(() => { quantityRef.current = quantity; }, [quantity]);

    const { writeContractAsync, isPending: isSending, reset: resetTx } = useWriteContract();

    const burnPerReroll = BURN_COST[selectedTier];
    const available = getBurnableDuplicates(pins, selectedTier);
    const totalBurn = burnPerReroll * quantity;
    const totalVibestr = VIBESTR_PER_REROLL * quantity;
    const maxQuantity = Math.min(20, Math.floor(available / burnPerReroll));
    const canBurn = available >= totalBurn && quantity >= 1;

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
                        burnTier: selectedTierRef.current,
                        quantity: quantityRef.current,
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
                                        Burned {totalBurn} {TIER_DISPLAY_NAMES[selectedTier]} {totalBurn === 1 ? 'pin' : 'pins'} and got {quantity} new {quantity === 1 ? 'capsule' : 'capsules'}. Open them from your Pin Book!
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

                                    {/* Tier selector */}
                                    <div className="flex gap-1.5 mb-4">
                                        {TIER_ORDER.map(tier => {
                                            const dupes = getBurnableDuplicates(pins, tier);
                                            const cost = BURN_COST[tier];
                                            const enough = dupes >= cost;
                                            const isSelected = selectedTier === tier;

                                            return (
                                                <button
                                                    key={tier}
                                                    onClick={() => { setSelectedTier(tier); setQuantity(1); }}
                                                    className={`flex-1 min-w-0 rounded-lg p-2 text-center transition-all ${!enough ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    disabled={!enough}
                                                    style={{
                                                        background: isSelected ? `${TIER_COLORS[tier]}15` : 'rgba(255,255,255,0.03)',
                                                        border: isSelected ? `2px solid ${TIER_COLORS[tier]}60` : '2px solid rgba(255,255,255,0.06)',
                                                    }}
                                                >
                                                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TIER_COLORS[tier] }}>
                                                        {TIER_DISPLAY_NAMES[tier].split(' ')[0]}
                                                    </div>
                                                    <div className="text-[11px] font-black text-white mt-0.5">
                                                        {cost}
                                                    </div>
                                                    <div className="text-[8px] text-white/30 mt-0.5">
                                                        {dupes} avail
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Quantity selector */}
                                    {maxQuantity > 1 && (
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-white/50 text-xs font-mundial font-bold uppercase tracking-wider">Quantity</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                                    disabled={quantity <= 1}
                                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 font-bold disabled:opacity-30 transition-colors"
                                                >
                                                    -
                                                </button>
                                                <span className="text-white font-display font-black text-lg w-8 text-center">{quantity}</span>
                                                <button
                                                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                                                    disabled={quantity >= maxQuantity}
                                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 font-bold disabled:opacity-30 transition-colors"
                                                >
                                                    +
                                                </button>
                                                {maxQuantity > 2 && (
                                                    <button
                                                        onClick={() => setQuantity(maxQuantity)}
                                                        className="text-[9px] text-[#FF8C42] font-bold uppercase tracking-wider hover:text-[#FFAA66] transition-colors ml-1"
                                                    >
                                                        Max
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cost summary */}
                                    <div
                                        className="rounded-xl p-3 mb-4"
                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                    >
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-white/50 font-mundial">Burn</span>
                                            <span className="font-bold" style={{ color: TIER_COLORS[selectedTier] }}>
                                                {totalBurn} {TIER_DISPLAY_NAMES[selectedTier]} {totalBurn === 1 ? 'pin' : 'pins'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm mt-1">
                                            <span className="text-white/50 font-mundial">Fee</span>
                                            <span className="font-bold text-[#FFE048]">{totalVibestr} $VIBESTR</span>
                                        </div>
                                        <div className="border-t border-white/10 mt-2 pt-2 flex justify-between items-center text-sm">
                                            <span className="text-white/50 font-mundial">You get</span>
                                            <span className="font-bold text-white">{quantity} Random {quantity === 1 ? 'Capsule' : 'Capsules'}</span>
                                        </div>
                                    </div>

                                    {!canBurn && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3 text-red-400 text-xs text-center">
                                            Not enough duplicates. Need {totalBurn} burnable {TIER_DISPLAY_NAMES[selectedTier]} pins ({burnPerReroll} x {quantity}).
                                        </div>
                                    )}

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
                                            ) : quantity > 1 ? `Reroll ${quantity}x for ${totalVibestr} $VIBESTR` : `Reroll for ${totalVibestr} $VIBESTR`}
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
