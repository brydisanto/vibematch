'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther, parseAbi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`;
const VIBESTR_ADDRESS = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 3000;
const MAX_BONUS_PER_DAY = 10;

interface Package {
    size: 1 | 5 | 10;
    price: string;
    pricePerGame: string;
    discount?: string;
    featured?: boolean;
}

const PACKAGES: Package[] = [
    { size: 1, price: '1', pricePerGame: '1' },
    { size: 5, price: '3', pricePerGame: '0.6', discount: '40% off' },
    { size: 10, price: '5', pricePerGame: '0.5', discount: '50% off', featured: true },
];

interface BuyPrizeGamesModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBonus: number;
    onSuccess: (newBonusTotal: number) => void;
}

export default function BuyPrizeGamesModal({ isOpen, onClose, currentBonus, onSuccess }: BuyPrizeGamesModalProps) {
    const { address, isConnected } = useAccount();
    const [selectedSize, setSelectedSize] = useState<1 | 5 | 10>(10);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [statusText, setStatusText] = useState('');
    const pollingRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const addressRef = useRef(address);
    const selectedSizeRef = useRef(selectedSize);
    const onSuccessRef = useRef(onSuccess);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { selectedSizeRef.current = selectedSize; }, [selectedSize]);
    useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

    const { writeContractAsync, isPending: isSending, reset: resetTx } = useWriteContract();

    const remaining = MAX_BONUS_PER_DAY - currentBonus;
    const selectedPkg = PACKAGES.find(p => p.size === selectedSize)!;
    const cannotAfford = selectedPkg.size > remaining;

    const startPolling = (hash: string) => {
        setVerifying(true);
        pollingRef.current = true;

        const poll = async (attempt: number) => {
            if (!pollingRef.current) return;

            if (attempt >= MAX_POLL_ATTEMPTS) {
                setVerifying(false);
                pollingRef.current = false;
                setError('Transaction is taking longer than expected. Please close and check again.');
                return;
            }

            setStatusText(attempt === 0 ? 'Confirming on-chain...' : `Confirming... (${attempt}/${MAX_POLL_ATTEMPTS})`);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const res = await fetch('/api/pinbook/purchase-prize-games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        txHash: hash,
                        walletAddress: addressRef.current,
                        packageSize: selectedSizeRef.current,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                const data = await res.json();

                if (data.success) {
                    pollingRef.current = false;
                    setVerifying(false);
                    setSuccess(true);
                    onSuccessRef.current(data.bonusPrizeGames);
                    return;
                }

                if (res.status === 404 || res.status >= 500) {
                    timerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
                    return;
                }

                pollingRef.current = false;
                setVerifying(false);
                setError(data.error || 'Verification failed');
            } catch (e) {
                timerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
            }
        };

        poll(0);
    };

    const handleBuy = async () => {
        if (!isConnected || !address || cannotAfford) return;
        setError(null);

        // Guard against missing env vars at runtime
        if (!TREASURY_ADDRESS || !TREASURY_ADDRESS.startsWith('0x')) {
            console.error('[BuyPrizeGames] Missing NEXT_PUBLIC_TREASURY_ADDRESS', { TREASURY_ADDRESS });
            setError('Config error: treasury address not set. Please contact support.');
            return;
        }

        try {
            console.log('[BuyPrizeGames] Sending tx', {
                token: VIBESTR_ADDRESS,
                treasury: TREASURY_ADDRESS,
                amount: selectedPkg.price,
                from: address,
            });
            const hash = await writeContractAsync({
                address: VIBESTR_ADDRESS,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [TREASURY_ADDRESS, parseEther(selectedPkg.price)],
            });
            console.log('[BuyPrizeGames] Tx hash:', hash);
            startPolling(hash);
        } catch (err: any) {
            // Log the full error so we can diagnose
            console.error('[BuyPrizeGames] writeContractAsync failed:', err);
            const raw = err?.shortMessage || err?.message || String(err);

            if (raw.includes('rejected') || raw.includes('User denied') || raw.includes('User rejected')) {
                setError('Transaction was rejected.');
            } else if (raw.includes('insufficient funds') || raw.includes('exceeds the balance')) {
                setError('Not enough VIBESTR in your wallet.');
            } else if (raw.includes('chain') || raw.includes('network')) {
                setError('Please switch your wallet to Ethereum mainnet.');
            } else {
                // Show the raw shortMessage so you can diagnose
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
                            background: "linear-gradient(180deg, #FFE048 0%, #c9a84c 40%, #8B6914 100%)",
                            boxShadow: "0 2px 0 #8B6914, 0 8px 25px rgba(0,0,0,0.6)",
                        }}
                    >
                        <div className="rounded-[13px] p-6 relative" style={{
                            background: "linear-gradient(180deg, #2A1A0A 0%, #1A1005 100%)",
                        }}>
                            <button
                                onClick={handleClose}
                                className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors z-10"
                            >
                                <X size={18} />
                            </button>

                            {success ? (
                                <div className="text-center py-4">
                                    <motion.div
                                        className="text-5xl mb-4"
                                        animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                                        transition={{ duration: 1.5, repeat: 2 }}
                                    >
                                        🫧
                                    </motion.div>
                                    <h2 className="font-display text-2xl font-black text-[#FFE048] mb-2">Purchase Complete!</h2>
                                    <p className="text-white/70 font-mundial text-sm mb-6">
                                        {selectedPkg.size} prize {selectedPkg.size === 1 ? 'game' : 'games'} added. Go crush it!
                                    </p>
                                    <button
                                        onClick={handleClose}
                                        className="px-6 py-3 bg-[#FFE048] text-black font-black font-mundial uppercase tracking-wider rounded-lg hover:bg-[#FFE858] transition-all"
                                    >
                                        Let&apos;s Vibe!
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="font-display text-2xl font-black text-[#FFE048] mb-1 uppercase">More Prize Games</h2>
                                    <p className="text-white/50 text-xs font-mundial mb-4">
                                        Out of prize games? Pay with $VIBESTR to keep playing for capsules.
                                    </p>

                                    {currentBonus > 0 && (
                                        <p className="text-[#FFE048]/70 text-[10px] font-mundial mb-3">
                                            You&apos;ve already added {currentBonus} bonus {currentBonus === 1 ? 'game' : 'games'} today. Max {MAX_BONUS_PER_DAY}/day.
                                        </p>
                                    )}

                                    {/* Package options */}
                                    <div className="flex flex-col gap-2 mb-4">
                                        {PACKAGES.map(pkg => {
                                            const disabled = pkg.size > remaining;
                                            const isSelected = selectedSize === pkg.size;
                                            return (
                                                <button
                                                    key={pkg.size}
                                                    onClick={() => !disabled && setSelectedSize(pkg.size)}
                                                    disabled={disabled}
                                                    className={`relative rounded-xl p-3 text-left transition-all ${
                                                        disabled ? 'opacity-30 cursor-not-allowed' : ''
                                                    }`}
                                                    style={{
                                                        background: isSelected
                                                            ? "linear-gradient(135deg, rgba(255,224,72,0.15), rgba(255,224,72,0.05))"
                                                            : "rgba(255,255,255,0.03)",
                                                        border: isSelected
                                                            ? "2px solid rgba(255,224,72,0.6)"
                                                            : "2px solid rgba(255,255,255,0.08)",
                                                    }}
                                                >
                                                    {pkg.featured && !disabled && (
                                                        <span className="absolute -top-2 -right-2 bg-[#FFE048] text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Best Value
                                                        </span>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="font-display text-2xl font-black text-white">
                                                                    {pkg.size}
                                                                </span>
                                                                <span className="text-white/60 text-xs font-mundial">
                                                                    {pkg.size === 1 ? 'prize game' : 'prize games'}
                                                                </span>
                                                            </div>
                                                            {pkg.discount && (
                                                                <div className="text-[#FFE048] text-[10px] font-bold mt-0.5">
                                                                    {pkg.discount} · {pkg.pricePerGame} $VIBESTR each
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[#FFE048] font-display text-xl font-black">
                                                                {pkg.price}
                                                            </div>
                                                            <div className="text-white/40 text-[10px] font-mundial tracking-wider">
                                                                $VIBESTR
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 text-red-400 text-xs text-center">
                                            {error}
                                        </div>
                                    )}

                                    {!isConnected ? (
                                        <div className="flex flex-col items-center gap-3 py-2">
                                            <p className="text-white/50 text-xs font-mundial">
                                                Connect your wallet to purchase.
                                            </p>
                                            <ConnectButton />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleBuy}
                                            disabled={isProcessing || cannotAfford}
                                            className={`w-full py-3 rounded-lg font-black font-mundial uppercase tracking-wider transition-all ${
                                                isProcessing || cannotAfford
                                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                    : 'bg-[#FFE048] text-black hover:bg-[#FFE858]'
                                            }`}
                                        >
                                            {isSending ? 'Confirm in wallet...' :
                                                verifying ? statusText :
                                                cannotAfford ? 'Exceeds daily limit' :
                                                `Buy for ${selectedPkg.price} $VIBESTR`}
                                        </button>
                                    )}

                                    <p className="text-white/30 text-[10px] font-mundial text-center mt-3">
                                        Bonus games reset at midnight UTC · Max 10 purchased games per day
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
