'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useSendTransaction } from 'wagmi';
import { parseAbi, formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { BADGES, TIER_COLORS, TIER_DISPLAY_NAMES, type BadgeTier } from '@/lib/badges';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`;
// Token addresses + decimals — mirror src/lib/pricing.ts.
const VIBESTR_ADDRESS = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TOKEN_DECIMALS = { vibestr: 18, usdc: 6, eth: 18 } as const;
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1500;

type PaymentRail = 'vibestr' | 'usdc' | 'eth';
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
    return `$${(mills / 1000).toFixed(mills % 100 === 0 ? 2 : 2)}`;
}

/** Big-number renderer for heavy display fonts. The period glyph is
 *  tiny at font-black weights and visually merges with adjacent digits
 *  — "$1.10" ends up reading as "$110". Fix: split whole and fractional,
 *  wrap the decimal in an inline-block with explicit horizontal margin
 *  so it can't visually collide with the digits on either side. */
function TokenAmount({ value }: { value: string }) {
    if (!value.includes(".")) {
        return <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{value}</span>;
    }
    const [whole, frac] = value.split(".");
    return (
        <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
            {whole}
            <span style={{ margin: "0 0.12em", display: "inline-block", fontSize: "1.5em", lineHeight: 0, verticalAlign: "middle" }}>.</span>
            {frac}
        </span>
    );
}

// localStorage key for stranded-reroll recovery. Scoped per wallet so a
// connect-disconnect-reconnect dance can't replay the wrong user's plan.
// Joker's reroll went on-chain but writeContractAsync never resolved on
// his mobile Safari + WalletConnect session, so the client never POSTed
// the txHash. That's the canonical failure this guards against — page
// reload, app switch, or dropped wallet promise all leave a paid tx
// uncredited unless we can find it again from disk.
const PENDING_REROLL_PREFIX = 'pindrop:reroll_pending:';
const PENDING_REROLL_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7-day TTL
function pendingRerollKey(wallet: string | undefined): string | null {
    if (!wallet || typeof window === 'undefined') return null;
    return `${PENDING_REROLL_PREFIX}${wallet.toLowerCase()}`;
}
interface PendingReroll {
    burns: Record<string, number>;
    walletAddress: string;
    startedAt: number;
    txHash?: string;
    /** Tracks which token was used so a recovery flow knows how to
     *  verify the tx. Older entries (pre dynamic-pricing) default to
     *  'vibestr'. */
    paymentRail?: 'vibestr' | 'usdc' | 'eth';
}
function readPendingReroll(wallet: string | undefined): PendingReroll | null {
    const key = pendingRerollKey(wallet);
    if (!key) return null;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PendingReroll;
        if (Date.now() - parsed.startedAt > PENDING_REROLL_MAX_AGE_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
function writePendingReroll(wallet: string | undefined, entry: PendingReroll): void {
    const key = pendingRerollKey(wallet);
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(entry)); } catch {}
}
function clearPendingReroll(wallet: string | undefined): void {
    const key = pendingRerollKey(wallet);
    if (!key) return;
    try { localStorage.removeItem(key); } catch {}
}

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

    // Fresh server-side pin counts. Pulled when the modal opens (and again
    // right before signing) so we never let the user submit a burn plan
    // built on stale state from a prior reroll. Previously the modal trusted
    // the `pins` prop, which could lag behind the server by a tick after a
    // successful reroll — that race burned VIBESTR without awarding capsules
    // when the server caught the discrepancy AFTER the on-chain tx settled.
    const [livePins, setLivePins] = useState<Record<string, { count: number; firstEarned: string }>>(pins);
    const [refreshing, setRefreshing] = useState(false);

    // Stranded-reroll recovery state. Populated on modal open if
    // localStorage has a pending entry for this wallet that never
    // completed. With a txHash we silently resume polling; without one
    // we show a banner asking the user to paste it. The bottom-of-modal
    // "Recover a paid tx" link lets users recover from cleared storage
    // / different device too.
    const [recovery, setRecovery] = useState<PendingReroll | null>(null);
    const [showManualRecover, setShowManualRecover] = useState(false);
    const [manualTxHash, setManualTxHash] = useState('');

    // Dynamic pricing snapshot + selected payment rail. Snapshot is
    // fetched from /api/pricing/current on modal open; falls back to
    // the in-bundle FALLBACK_PRICING (shipped from src/lib/pricing.ts)
    // if the request fails. paymentRail flips which token is used for
    // the on-chain transfer + which wei amount the server verifies.
    const [paymentRail, setPaymentRail] = useState<PaymentRail>('vibestr');
    const [pricing, setPricing] = useState<PricingSnapshot | null>(null);
    const paymentRailRef = useRef(paymentRail);
    useEffect(() => { paymentRailRef.current = paymentRail; }, [paymentRail]);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { burnsRef.current = burns; }, [burns]);

    // Refetch pins whenever the modal opens. Falls back to the prop if the
    // network call fails — better stale than empty.
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setRefreshing(true);
        fetch('/api/pinbook')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (cancelled) return;
                if (data?.pins) setLivePins(data.pins);
            })
            .catch(() => { /* keep prop fallback */ })
            .finally(() => { if (!cancelled) setRefreshing(false); });
        return () => { cancelled = true; };
    }, [isOpen]);

    // Fetch the active pricing snapshot when the modal opens. Server's
    // /api/pricing/current is edge-cached 30s so reopening rapidly
    // doesn't thrash KV.
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        fetch('/api/pricing/current')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (cancelled || !data) return;
                setPricing(data as PricingSnapshot);
            })
            .catch(() => { /* leave null — UI handles loading state */ });
        return () => { cancelled = true; };
    }, [isOpen]);

    // Keep livePins in sync if the prop changes while the modal is closed —
    // matters for the initial open after a long-running session.
    useEffect(() => { if (!isOpen) setLivePins(pins); }, [pins, isOpen]);

    // On modal open with a connected wallet, check localStorage for a
    // stranded reroll. If we have a txHash already, silently re-enter
    // the polling loop — the server is idempotent, so a duplicate POST
    // either credits the user (if not yet processed) or returns 409
    // (already credited). Either path lands them on the success screen.
    useEffect(() => {
        if (!isOpen || !address) return;
        const pending = readPendingReroll(address);
        if (!pending) return;
        setRecovery(pending);
        if (pending.paymentRail) setPaymentRail(pending.paymentRail);
        if (pending.txHash) {
            // Restore the burns into the UI so the summary copy matches,
            // then resume tracking. Polling will null out localStorage on
            // success or 409.
            setBurns(pending.burns as Record<BadgeTier, number>);
            startPolling(
                pending.txHash,
                pending.burns as Record<BadgeTier, number>,
                pending.paymentRail ?? 'vibestr',
            );
        }
        // No txHash → user finished the wallet signature on a different
        // surface, the page reloaded, etc. Show the banner so they can
        // paste it manually (or dismiss if they actually cancelled).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, address]);

    const resumeWithHash = (hash: string) => {
        if (!address) return;
        const burnsToUse = recovery?.burns ?? burns;
        const railToUse: PaymentRail = recovery?.paymentRail ?? paymentRail;
        writePendingReroll(address, {
            burns: burnsToUse as Record<string, number>,
            walletAddress: address,
            startedAt: recovery?.startedAt ?? Date.now(),
            txHash: hash,
            paymentRail: railToUse,
        });
        setBurns(burnsToUse as Record<BadgeTier, number>);
        setShowManualRecover(false);
        setManualTxHash('');
        startPolling(hash, burnsToUse as Record<BadgeTier, number>, railToUse);
    };

    const dismissRecovery = () => {
        if (!address) return;
        clearPendingReroll(address);
        setRecovery(null);
    };

    const { writeContractAsync, isPending: isWriting, reset: resetTx } = useWriteContract();
    const { sendTransactionAsync, isPending: isSendingEth } = useSendTransaction();
    const isSending = isWriting || isSendingEth;

    // Computed values across all tiers — driven by livePins.
    const totalCapsules = Object.values(burns).reduce((s, v) => s + v, 0);
    // Resolve the per-capsule pricing entry from the snapshot. When the
    // snapshot hasn't loaded yet we display 0 amounts and disable the
    // confirm button — better than a flash of stale numbers.
    const rerollEntry = pricing?.packages['reroll-per-capsule'] ?? null;
    const totalRerollWei = rerollEntry
        ? railWei(rerollEntry, paymentRail) * BigInt(totalCapsules)
        : BigInt(0);
    const totalUsdMills = rerollEntry
        ? railUsdMills(rerollEntry, paymentRail) * totalCapsules
        : 0;
    const railLabel: Record<PaymentRail, string> = { vibestr: '$VIBESTR', usdc: 'USDC', eth: 'ETH' };
    const railDecimals = TOKEN_DECIMALS[paymentRail];
    const totalTokenDisplay = rerollEntry
        ? (paymentRail === 'eth'
            ? formatTokenAmount(totalRerollWei, railDecimals, 5, 0, 5)
            : formatTokenAmount(totalRerollWei, railDecimals, 2, paymentRail === 'usdc' ? 2 : 0))
        : '—';
    // Mirror server's MAX_REROLLS_PER_TX. Kept here so the UI can block
    // signing for over-cap rerolls instead of letting the user sign a tx
    // that the server will reject (which used to mean lost VIBESTR).
    const MAX_REROLLS_PER_TX = 50;
    const overCap = totalCapsules > MAX_REROLLS_PER_TX;
    const canBurn = totalCapsules > 0 && !overCap && !!rerollEntry && TIER_ORDER.every(tier => {
        const qty = burns[tier];
        if (qty <= 0) return true;
        return getBurnableDuplicates(livePins, tier) >= BURN_COST[tier] * qty;
    });

    // MAX REROLL — set every tier counter to the highest reroll quantity
    // its duplicates support, capped by the per-tier 20-row UI cap + the
    // server's 50-rerolls-per-tx limit. Iterates blue → cosmic so the
    // cap (when it bites) burns cheaper duplicates first and preserves
    // rare-tier dupes. No-op when no tier has enough dupes for even one
    // reroll.
    const canMaxReroll = TIER_ORDER.some(t => getBurnableDuplicates(livePins, t) >= BURN_COST[t]);
    const handleMaxReroll = () => {
        let remaining = MAX_REROLLS_PER_TX;
        const next: Record<BadgeTier, number> = { blue: 0, silver: 0, special: 0, gold: 0, cosmic: 0 };
        for (const tier of TIER_ORDER) {
            if (remaining <= 0) break;
            const dupes = getBurnableDuplicates(livePins, tier);
            const maxForTier = Math.min(20, Math.floor(dupes / BURN_COST[tier]));
            const take = Math.min(maxForTier, remaining);
            next[tier] = take;
            remaining -= take;
        }
        setBurns(next);
    };

    const startPolling = (hash: string, capturedBurns: Record<BadgeTier, number>, capturedRail: PaymentRail = 'vibestr') => {
        setVerifying(true);
        pollingRef.current = true;

        // Capture the wallet address at poll start too
        const wallet = addressRef.current;

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
                        walletAddress: wallet,
                        burns: capturedBurns,
                        paymentRail: capturedRail,
                    }),
                });
                const data = await res.json();

                if (data.success) {
                    clearPendingReroll(wallet);
                    pollingRef.current = false;
                    setVerifying(false);
                    setSuccess(true);
                    onSuccess();
                    return;
                }

                // 409 = already processed (recovery path hit a tx the
                // server already credited). Treat as success so the user
                // sees the same complete-state UI; the pinbook reload
                // surfaces the capsules they already got.
                if (res.status === 409) {
                    clearPendingReroll(wallet);
                    pollingRef.current = false;
                    setVerifying(false);
                    setSuccess(true);
                    onSuccess();
                    return;
                }

                // Retry on: not found (404), awaiting confirmation (425), server error (5xx)
                // Don't retry on: 400 (bad request)
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

        // Capture burns at click time — don't rely on refs during async polling
        const capturedBurns = { ...burns };

        // Final pre-flight refresh against the server. The window between
        // the modal opening and the user clicking can span a full reroll
        // happening in another tab (or a previous reroll's pinbook reload
        // not yet propagating). Fetching here closes that race so the
        // user never signs a VIBESTR tx the server will reject for
        // not-enough-pins reasons.
        try {
            const freshRes = await fetch('/api/pinbook');
            if (freshRes.ok) {
                const fresh = await freshRes.json();
                if (fresh?.pins) {
                    setLivePins(fresh.pins);
                    const stillValid = TIER_ORDER.every(tier => {
                        const qty = capturedBurns[tier];
                        if (qty <= 0) return true;
                        return getBurnableDuplicates(fresh.pins, tier) >= BURN_COST[tier] * qty;
                    });
                    if (!stillValid) {
                        setError('Your pin counts changed since you opened this. Review your selection and try again.');
                        return;
                    }
                }
            }
        } catch {
            // Network blip — fall through to the tx attempt. The server
            // will still validate, just without our pre-flight protection.
        }

        // Snapshot must be loaded — we read the canonical wei amount
        // from it. Bail with a clear error if the user managed to click
        // before pricing fetched.
        if (!rerollEntry || totalRerollWei <= BigInt(0)) {
            setError('Pricing not loaded yet. Please try again.');
            return;
        }

        const capturedRail = paymentRail;
        const capturedRequiredWei = totalRerollWei;
        console.log('[Reroll] Starting:', { burns: capturedBurns, rail: capturedRail, requiredWei: capturedRequiredWei.toString() });

        // Persist the burn plan + rail to localStorage BEFORE handing
        // control to the wallet. If writeContractAsync never resolves
        // (mobile Safari backgrounding the tab mid-confirm, WalletConnect
        // dropping the callback, etc.) the tx still settles on-chain —
        // this entry is what lets us recover on next mount or via manual
        // paste.
        writePendingReroll(address, {
            burns: capturedBurns,
            walletAddress: address,
            startedAt: Date.now(),
            paymentRail: capturedRail,
        });

        try {
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
            // Persist the hash the moment we have it, before polling starts.
            // If the network call below blows up, the next mount can resume.
            writePendingReroll(address, {
                burns: capturedBurns,
                walletAddress: address,
                startedAt: Date.now(),
                txHash: hash,
                paymentRail: capturedRail,
            });
            startPolling(hash, capturedBurns, capturedRail);
        } catch (err: any) {
            const raw = err?.shortMessage || err?.message || String(err);
            if (raw.includes('rejected') || raw.includes('User denied')) {
                clearPendingReroll(address);
                setError('Transaction was rejected.');
            } else if (raw.includes('insufficient') || raw.includes('exceeds the balance')) {
                clearPendingReroll(address);
                setError(`Not enough ${railLabel[capturedRail]} in your wallet.`);
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
                                    {/* Recovery banner — appears when localStorage has a
                                        stranded reroll for this wallet with no resolved
                                        txHash. User pastes the hash + we replay the
                                        original burn plan against the server. */}
                                    {recovery && !recovery.txHash && !verifying && (
                                        <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.4)' }}>
                                            <div className="font-display text-xs font-black uppercase tracking-wider text-[#FF8C42] mb-1">Recover your reroll</div>
                                            <p className="text-white/70 text-[11px] font-mundial mb-2 leading-snug">
                                                Looks like you started a reroll that didn't finish. If your wallet broadcast the transaction, paste the hash to credit your capsules.
                                            </p>
                                            <input
                                                type="text"
                                                value={manualTxHash}
                                                onChange={e => setManualTxHash(e.target.value.trim())}
                                                placeholder="0x... transaction hash"
                                                className="w-full px-2.5 py-2 rounded-md bg-black/40 border border-white/10 text-white text-[11px] font-mono mb-2 outline-none focus:border-[#FF8C42]/60"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => resumeWithHash(manualTxHash)}
                                                    disabled={!/^0x[0-9a-fA-F]{64}$/.test(manualTxHash)}
                                                    className="flex-1 px-3 py-2 rounded-md font-display font-black text-[10px] tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                                                    style={{ background: '#FF8C42', color: '#1A0633' }}
                                                >
                                                    Verify
                                                </button>
                                                <button
                                                    onClick={dismissRecovery}
                                                    className="px-3 py-2 rounded-md font-display font-black text-[10px] tracking-wider uppercase text-white/50 hover:text-white"
                                                    style={{ background: 'rgba(255,255,255,0.05)' }}
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <p className="text-white/50 text-xs font-mundial flex-1 min-w-0">
                                            Burn duplicate pins + a small payment for a new random capsule.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleMaxReroll}
                                            disabled={!canMaxReroll}
                                            className="shrink-0 px-3 py-1.5 rounded-md font-display font-black text-[10px] tracking-[0.18em] uppercase transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                                            style={{
                                                background: "rgba(255,140,66,0.15)",
                                                border: "1px solid rgba(255,140,66,0.55)",
                                                color: "#FF8C42",
                                            }}
                                            title="Fill every tier counter to its max within the 50-reroll cap"
                                        >
                                            Max Reroll
                                        </button>
                                    </div>

                                    {/* Per-tier burn controls — Option C: two-column rows */}
                                    <div className="space-y-2 mb-4">
                                        {TIER_ORDER.map(tier => {
                                            const dupes = getBurnableDuplicates(livePins, tier);
                                            const cost = BURN_COST[tier];
                                            const maxForTier = Math.min(20, Math.floor(dupes / cost));
                                            const qty = burns[tier];

                                            return (
                                                <div
                                                    key={tier}
                                                    className={`flex items-center justify-between rounded-xl px-3.5 py-3 ${dupes === 0 ? 'opacity-25' : ''}`}
                                                    style={{
                                                        background: qty > 0 ? `${TIER_COLORS[tier]}10` : 'rgba(255,255,255,0.02)',
                                                        border: qty > 0 ? `1px solid ${TIER_COLORS[tier]}40` : '1px solid rgba(255,255,255,0.06)',
                                                    }}
                                                >
                                                    <div>
                                                        <div className="font-display text-xs font-black uppercase tracking-wider" style={{ color: TIER_COLORS[tier] }}>
                                                            {TIER_DISPLAY_NAMES[tier]}
                                                        </div>
                                                        <div className="text-[11px] text-white/50 font-mundial mt-0.5">
                                                            {cost} per capsule <span className="text-white/15 mx-1">|</span> <span className="font-bold" style={{ color: TIER_COLORS[tier] }}>{dupes} available</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => setBurns(b => ({ ...b, [tier]: Math.max(0, b[tier] - 1) }))}
                                                            disabled={qty <= 0 || dupes === 0}
                                                            className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 text-sm font-bold disabled:opacity-20 transition-colors"
                                                        >-</button>
                                                        <span className="text-white font-display font-black text-base w-6 text-center">{qty}</span>
                                                        <button
                                                            onClick={() => setBurns(b => ({ ...b, [tier]: Math.min(maxForTier, b[tier] + 1) }))}
                                                            disabled={qty >= maxForTier || dupes === 0}
                                                            className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 text-sm font-bold disabled:opacity-20 transition-colors"
                                                        >+</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Payment-rail toggle. Three pill buttons; the
                                        selected one is filled with the orange accent,
                                        unselected are subtle. VIBESTR is the default
                                        and carries a "save 10%" tag so users notice
                                        the discount. */}
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
                                                    const labels: Record<PaymentRail, string> = { vibestr: '$VIBESTR', usdc: 'USDC', eth: 'ETH' };
                                                    return (
                                                        <button
                                                            key={rail}
                                                            type="button"
                                                            onClick={() => setPaymentRail(rail)}
                                                            disabled={isProcessing}
                                                            className={`relative py-2 rounded-lg font-display text-[12px] tracking-[0.15em] uppercase transition-all disabled:opacity-40 ${
                                                                selected
                                                                    ? 'bg-[#FF8C42] text-black shadow-md'
                                                                    : 'bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80 border border-white/[0.08]'
                                                            }`}
                                                            style={{ fontWeight: 600 }}
                                                        >
                                                            {labels[rail]}
                                                            {rail === 'vibestr' && (
                                                                <span
                                                                    className="absolute -top-1.5 -right-1.5 font-display text-[9px] tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                                                                    style={{
                                                                        background: selected ? '#1A0633' : '#FF8C42',
                                                                        color: selected ? '#FF8C42' : '#1A0633',
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
                                                    <span className="text-right">
                                                        <span className="font-bold text-[#FFE048]">
                                                            {paymentRail === "usdc" && "$"}
                                                            {totalTokenDisplay} {railLabel[paymentRail]}
                                                        </span>
                                                        {totalUsdMills > 0 && paymentRail !== "usdc" && (
                                                            <span className="block font-mundial text-[11px] text-white/60 mt-0.5 tabular-nums">≈ {formatUsdFromMills(totalUsdMills)} USD</span>
                                                        )}
                                                    </span>
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
                                            ) : overCap ? `Max ${MAX_REROLLS_PER_TX} per reroll — please reduce` : (() => {
                                                const dollarPrefix = paymentRail === 'usdc' ? '$' : '';
                                                const priceStr = `${dollarPrefix}${totalTokenDisplay} ${railLabel[paymentRail]}`;
                                                return totalCapsules > 1
                                                    ? `Reroll ${totalCapsules}x for ${priceStr}`
                                                    : `Reroll for ${priceStr}`;
                                            })()}
                                        </button>
                                    )}

                                    {/* Always-visible recovery escape hatch — covers users
                                        whose localStorage was cleared, who paid on a
                                        different device, or who closed the modal before
                                        the recovery banner could fire. Reuses the current
                                        burn selection so the server can match the txHash
                                        against an explicit burn plan. */}
                                    {isConnected && !verifying && !recovery && (
                                        <div className="mt-3">
                                            {showManualRecover ? (
                                                <div className="rounded-xl p-3" style={{ background: 'rgba(255,140,66,0.06)', border: '1px solid rgba(255,140,66,0.3)' }}>
                                                    <p className="text-white/70 text-[11px] font-mundial mb-2 leading-snug">
                                                        Pick the same burns you submitted, paste your tx hash, and we'll credit your capsules. Wrong burns will be queued for a refund.
                                                    </p>
                                                    <input
                                                        type="text"
                                                        value={manualTxHash}
                                                        onChange={e => setManualTxHash(e.target.value.trim())}
                                                        placeholder="0x... transaction hash"
                                                        className="w-full px-2.5 py-2 rounded-md bg-black/40 border border-white/10 text-white text-[11px] font-mono mb-2 outline-none focus:border-[#FF8C42]/60"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => resumeWithHash(manualTxHash)}
                                                            disabled={!/^0x[0-9a-fA-F]{64}$/.test(manualTxHash) || totalCapsules === 0}
                                                            className="flex-1 px-3 py-2 rounded-md font-display font-black text-[10px] tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                                                            style={{ background: '#FF8C42', color: '#1A0633' }}
                                                        >
                                                            Verify
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowManualRecover(false); setManualTxHash(''); }}
                                                            className="px-3 py-2 rounded-md font-display font-black text-[10px] tracking-wider uppercase text-white/50 hover:text-white"
                                                            style={{ background: 'rgba(255,255,255,0.05)' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowManualRecover(true)}
                                                    className="w-full text-center text-white/35 hover:text-white/60 text-[11px] font-mundial underline underline-offset-2 transition-colors"
                                                >
                                                    Already paid? Recover your tx
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-white/25 text-[10px] font-mundial text-center mt-3">
                                        Duplicates only burned. You always keep at least 1 of each pin.
                                    </p>
                                    <p className="text-white/35 text-[9px] font-mundial text-center mt-1.5 leading-snug">
                                        Use of $VIBESTR does not increase the probability of any specific outcome. Every pin is earnable for free.
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
