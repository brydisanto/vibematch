'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useSendTransaction } from 'wagmi';
import { parseAbi, formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`;
const VIBESTR_ADDRESS = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TOKEN_DECIMALS = { vibestr: 18, usdc: 6, eth: 18 } as const;
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1500;
// Mirror of MAX_BONUS_PRIZE_GAMES_PER_DAY in src/app/api/pinbook/route.ts.
const MAX_BONUS_PER_DAY = 15;

type PaymentRail = 'vibestr' | 'usdc' | 'eth';
type PackageSize = 1 | 5 | 10;
const PACKAGE_IDS: Record<PackageSize, string> = {
    1: 'prize-games-1',
    5: 'prize-games-5',
    10: 'prize-games-10',
};
const PACKAGE_DISCOUNTS: Record<PackageSize, string | undefined> = {
    1: undefined,
    5: '20% off',
    10: '33% off',
};
interface PricingPackageEntry {
    usdMills: number;
    vibestrUsdMills: number;
    vibestrWei: string;
    usdcWei: string;
    ethWei: string;
}
interface PricingSnapshot {
    updatedAt: number;
    ethUsdMills: number;
    vibestrUsdMills: number;
    packages: Record<string, PricingPackageEntry>;
}

function railWei(entry: PricingPackageEntry, rail: PaymentRail): bigint {
    const raw = rail === 'vibestr' ? entry.vibestrWei : rail === 'usdc' ? entry.usdcWei : entry.ethWei;
    try { return BigInt(raw); } catch { return BigInt(0); }
}
function railUsdMills(entry: PricingPackageEntry, rail: PaymentRail): number {
    return rail === 'vibestr' ? entry.vibestrUsdMills : entry.usdMills;
}
function formatTokenAmount(
    wei: bigint,
    decimals: number,
    maxFrac = 4,
    minFrac = 0,
    exactDecimals?: number,
): string {
    if (exactDecimals !== undefined) {
        return Number(formatUnits(wei, decimals)).toFixed(exactDecimals);
    }
    if (wei === BigInt(0)) return minFrac > 0 ? `0.${'0'.repeat(minFrac)}` : '0';
    const s = formatUnits(wei, decimals);
    if (!s.includes('.')) {
        return minFrac > 0 ? `${s}.${'0'.repeat(minFrac)}` : s;
    }
    const [whole, frac] = s.split('.');
    let trimmed = frac.replace(/0+$/, '').slice(0, maxFrac);
    if (trimmed.length < minFrac) trimmed = trimmed.padEnd(minFrac, '0');
    return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}
function formatUsdFromMills(mills: number): string {
    return `$${(mills / 1000).toFixed(2)}`;
}

/** Decimal-aware big-number renderer — keeps "1.1" from collapsing into
 *  "11" by shrinking the fractional part so the dot reads clearly. */
function TokenAmount({ value }: { value: string }) {
    if (!value.includes(".")) return <>{value}</>;
    const [whole, frac] = value.split(".");
    return <>{whole}<span style={{ fontSize: "0.62em", letterSpacing: "0.02em" }}>.{frac}</span></>;
}
const RAIL_LABELS: Record<PaymentRail, string> = { vibestr: '$VIBESTR', usdc: 'USDC', eth: 'ETH' };
const PACKAGE_SIZES: PackageSize[] = [1, 5, 10];

interface BuyPrizeGamesModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBonus: number;
    onSuccess: (newBonusTotal: number) => void;
}

export default function BuyPrizeGamesModal({ isOpen, onClose, currentBonus, onSuccess }: BuyPrizeGamesModalProps) {
    const { address, isConnected } = useAccount();
    const [selectedSize, setSelectedSize] = useState<PackageSize>(10);
    const [paymentRail, setPaymentRail] = useState<PaymentRail>('vibestr');
    const [pricing, setPricing] = useState<PricingSnapshot | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [statusText, setStatusText] = useState('');
    const pollingRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const addressRef = useRef(address);
    const selectedSizeRef = useRef(selectedSize);
    const paymentRailRef = useRef(paymentRail);
    const onSuccessRef = useRef(onSuccess);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { selectedSizeRef.current = selectedSize; }, [selectedSize]);
    useEffect(() => { paymentRailRef.current = paymentRail; }, [paymentRail]);
    useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

    // Pull the active pricing snapshot when the modal opens. Falls
    // back to FALLBACK_PRICING server-side, so cost rendering shows
    // sensible numbers even on a fresh deploy without KV.
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        fetch('/api/pricing/current')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (cancelled || !data) return;
                setPricing(data as PricingSnapshot);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [isOpen]);

    const { writeContractAsync, isPending: isWriting, reset: resetTx } = useWriteContract();
    const { sendTransactionAsync, isPending: isSendingEth } = useSendTransaction();
    const isSending = isWriting || isSendingEth;

    const remaining = MAX_BONUS_PER_DAY - currentBonus;
    const selectedPackageId = PACKAGE_IDS[selectedSize];
    const selectedEntry = pricing?.packages[selectedPackageId] ?? null;
    const selectedRequiredWei = selectedEntry ? railWei(selectedEntry, paymentRail) : BigInt(0);
    const selectedUsdMills = selectedEntry ? railUsdMills(selectedEntry, paymentRail) : 0;
    const railDecimals = TOKEN_DECIMALS[paymentRail];
    const selectedTokenDisplay = selectedEntry
        ? paymentRail === 'eth'
        ? formatTokenAmount(selectedRequiredWei, railDecimals, 5, 0, 5)
        : formatTokenAmount(selectedRequiredWei, railDecimals, 2, paymentRail === 'usdc' ? 2 : 0)
        : '—';
    const cannotAfford = selectedSize > remaining;

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
                        paymentRail: paymentRailRef.current,
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

                // Retry on: not found (404), server error (5xx), or awaiting confirmations (425)
                if (res.status === 404 || res.status === 425 || res.status >= 500) {
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
        if (!selectedEntry || selectedRequiredWei <= BigInt(0)) {
            setError('Pricing not loaded yet. Please try again.');
            return;
        }

        const capturedRail = paymentRail;
        const capturedRequiredWei = selectedRequiredWei;

        try {
            console.log('[BuyPrizeGames] Sending tx', {
                rail: capturedRail,
                treasury: TREASURY_ADDRESS,
                requiredWei: capturedRequiredWei.toString(),
                from: address,
            });
            let hash: `0x${string}`;
            if (capturedRail === 'eth') {
                hash = await sendTransactionAsync({
                    to: TREASURY_ADDRESS,
                    value: capturedRequiredWei,
                });
            } else {
                const tokenAddress = capturedRail === 'usdc' ? (USDC_ADDRESS as `0x${string}`) : (VIBESTR_ADDRESS as `0x${string}`);
                hash = await writeContractAsync({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [TREASURY_ADDRESS, capturedRequiredWei],
                });
            }
            console.log('[BuyPrizeGames] Tx hash:', hash);
            startPolling(hash);
        } catch (err: any) {
            // Log the full error so we can diagnose
            console.error('[BuyPrizeGames] tx submit failed:', err);
            const raw = err?.shortMessage || err?.message || String(err);

            if (raw.includes('rejected') || raw.includes('User denied') || raw.includes('User rejected')) {
                setError('Transaction was rejected.');
            } else if (raw.includes('insufficient funds') || raw.includes('exceeds the balance')) {
                setError(`Not enough ${RAIL_LABELS[capturedRail]} in your wallet.`);
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
                                    <motion.img
                                        src="/assets/gvc_shaka.png"
                                        alt=""
                                        className="w-16 h-16 mx-auto mb-4 object-contain"
                                        animate={{ rotate: [0, -12, 12, -8, 8, -4, 4, 0] }}
                                        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                                    />
                                    <h2 className="font-display text-2xl font-black text-[#FFE048] mb-2">Purchase Complete!</h2>
                                    <p className="text-white/70 font-mundial text-sm mb-6">
                                        {selectedSize} prize {selectedSize === 1 ? 'game' : 'games'} added. Go crush it!
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
                                    <h2 className="font-display text-2xl font-black text-[#FFE048] mb-4 uppercase">More Bonus Games</h2>

                                    {currentBonus > 0 && (
                                        <p className="text-[#FFE048]/70 text-[10px] font-mundial mb-3">
                                            You&apos;ve already added {currentBonus} bonus {currentBonus === 1 ? 'game' : 'games'} today. Max {MAX_BONUS_PER_DAY}/day.
                                        </p>
                                    )}

                                    {/* Payment-rail toggle. Mirrors the RerollModal
                                        treatment for consistency. */}
                                    {isConnected && (
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between mb-1.5 px-1">
                                                <span className="font-display text-[10px] tracking-[0.2em] uppercase text-white/45">Pay with</span>
                                                {pricing && (
                                                    <span className="font-mundial text-[10px] text-white/30">Updated {new Date(pricing.updatedAt * 1000).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {(['vibestr', 'usdc', 'eth'] as PaymentRail[]).map(rail => {
                                                    const selected = paymentRail === rail;
                                                    return (
                                                        <button
                                                            key={rail}
                                                            type="button"
                                                            onClick={() => setPaymentRail(rail)}
                                                            disabled={isProcessing}
                                                            className={`relative py-2 rounded-lg font-display text-[12px] tracking-[0.15em] uppercase transition-all disabled:opacity-40 ${
                                                                selected
                                                                    ? 'bg-[#FFE048] text-black shadow-md'
                                                                    : 'bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80 border border-white/[0.08]'
                                                            }`}
                                                            style={{ fontWeight: 600 }}
                                                        >
                                                            {RAIL_LABELS[rail]}
                                                            {rail === 'vibestr' && (
                                                                <span
                                                                    className="absolute -top-1.5 -right-1.5 font-display text-[9px] tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                                                                    style={{
                                                                        background: selected ? '#1A0633' : '#FFE048',
                                                                        color: selected ? '#FFE048' : '#1A0633',
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    -10%
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Package options — prices flow from the active
                                        pricing snapshot + selected rail. */}
                                    <div className="flex flex-col gap-2 mb-4">
                                        {PACKAGE_SIZES.map(size => {
                                            const disabled = size > remaining;
                                            const isSelected = selectedSize === size;
                                            const entry = pricing?.packages[PACKAGE_IDS[size]] ?? null;
                                            const totalWei = entry ? railWei(entry, paymentRail) : BigInt(0);
                                            const perGameWei = entry ? totalWei / BigInt(size) : BigInt(0);
                                            const totalDisplay = entry
                                                ? (paymentRail === 'eth'
                                                    ? formatTokenAmount(totalWei, railDecimals, 5, 0, 5)
                                                    : formatTokenAmount(totalWei, railDecimals, 2, paymentRail === 'usdc' ? 2 : 0))
                                                : '—';
                                            const perGameDisplay = entry
                                                ? (paymentRail === 'eth'
                                                    ? formatTokenAmount(perGameWei, railDecimals, 5, 0, 5)
                                                    : formatTokenAmount(perGameWei, railDecimals, 2, paymentRail === 'usdc' ? 2 : 0))
                                                : '—';
                                            const usdMills = entry ? railUsdMills(entry, paymentRail) : 0;
                                            const discount = PACKAGE_DISCOUNTS[size];
                                            const featured = size === 10;
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => !disabled && setSelectedSize(size)}
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
                                                    {featured && !disabled && (
                                                        <span className="absolute -top-2 -right-2 bg-[#FFE048] text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Best Value
                                                        </span>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="font-display text-2xl font-black text-white">
                                                                    {size}
                                                                </span>
                                                                <span className="text-white/60 text-xs font-mundial">
                                                                    {size === 1 ? 'bonus game' : 'bonus games'}
                                                                </span>
                                                            </div>
                                                            {discount && (
                                                                <div className="text-[#FFE048] text-[10px] font-bold mt-0.5">
                                                                    {discount} · {perGameDisplay} {RAIL_LABELS[paymentRail]} each
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[#FFE048] font-display text-xl font-black">
                                                                {paymentRail === "usdc" && "$"}
                                                                <TokenAmount value={totalDisplay} />
                                                            </div>
                                                            <div className="text-white/40 text-[10px] font-mundial tracking-wider">
                                                                {RAIL_LABELS[paymentRail]}
                                                                {usdMills > 0 && paymentRail !== "usdc" && (
                                                                    <span className="text-white/30"> · ~{formatUsdFromMills(usdMills)}</span>
                                                                )}
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
                                                        className="inline-block w-4 h-4 border-2 border-gray-500 border-t-[#FFE048] rounded-full"
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    />
                                                    {statusText}
                                                </span>
                                            ) : cannotAfford ? 'Exceeds daily limit' :
                                                `Buy for ${paymentRail === 'usdc' ? '$' : ''}${selectedTokenDisplay} ${RAIL_LABELS[paymentRail]}`}
                                        </button>
                                    )}

                                    <p className="text-white/30 text-[10px] font-mundial text-center mt-3">
                                        You may purchase up to 15 Bonus Games per day. Resets at noon ET.
                                    </p>
                                    <p className="text-white/35 text-[9px] font-mundial text-center mt-2 leading-snug">
                                        Using $VIBESTR does not increase the probability of any specific outcome. Every pin is earnable for free.
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
