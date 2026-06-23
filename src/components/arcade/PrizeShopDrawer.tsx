"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, useSendTransaction } from "wagmi";
import { parseAbi, formatUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
    GOLD, GOLD_DIM, GOLD_DEEP,
    COSMIC, COSMIC_DEEP,
} from "@/lib/arcade-tokens";
import ChunkyButton from "./ChunkyButton";
import PrizeCoin from "./PrizeCoin";

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`;
const VIBESTR_ADDRESS = "0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const TOKEN_DECIMALS = { vibestr: 18, usdc: 6, eth: 18 } as const;
const erc20Abi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1500;
// Mirror of MAX_BONUS_PRIZE_GAMES_PER_DAY in src/app/api/pinbook/route.ts.
const MAX_BONUS_PER_DAY = 15;

type PackSize = 1 | 5 | 10;
type PaymentRail = "vibestr" | "usdc" | "eth";

interface Pack {
    size: PackSize;
    label: string;
    discount?: string;
    featured?: boolean;
}

// Layout-only metadata; prices come from the live pricing snapshot.
const PACKS: Pack[] = [
    { size: 1, label: "Single" },
    { size: 5, label: "Stack", discount: "20% OFF" },
    { size: 10, label: "Mega Pack", discount: "BEST VALUE, 33% OFF", featured: true },
];

const PACKAGE_IDS: Record<PackSize, string> = {
    1: "prize-games-1",
    5: "prize-games-5",
    10: "prize-games-10",
};
const RAIL_LABELS: Record<PaymentRail, string> = { vibestr: "$VIBESTR", usdc: "USDC", eth: "ETH" };

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
    const raw = rail === "vibestr" ? entry.vibestrWei : rail === "usdc" ? entry.usdcWei : entry.ethWei;
    try { return BigInt(raw); } catch { return BigInt(0); }
}
function railUsdMills(entry: PricingPackageEntry, rail: PaymentRail): number {
    return rail === "vibestr" ? entry.vibestrUsdMills : entry.usdMills;
}
function formatTokenAmount(wei: bigint, decimals: number, maxFrac = 4): string {
    if (wei === BigInt(0)) return "0";
    const s = formatUnits(wei, decimals);
    if (!s.includes(".")) return s;
    const [whole, frac] = s.split(".");
    const trimmed = frac.replace(/0+$/, "").slice(0, maxFrac);
    return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}
function formatUsdFromMills(mills: number): string {
    return `$${(mills / 1000).toFixed(2)}`;
}

/** Render a numeric string with the fractional part shrunk so the
 *  decimal point doesn't visually merge into adjacent digits at heavy
 *  display weights. "1.1" → "1" + ".1" (smaller). Returns the input
 *  string unchanged when there's no decimal. */
function TokenAmount({ value }: { value: string }) {
    if (!value.includes(".")) return <>{value}</>;
    const [whole, frac] = value.split(".");
    return (
        <>
            {whole}
            <span style={{ fontSize: "0.62em", letterSpacing: "0.02em" }}>
                .{frac}
            </span>
        </>
    );
}

interface PrizeShopDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    currentBonus: number;
    /** Called with the new total bonus count after a successful purchase. */
    onSuccess: (newBonusTotal: number) => void;
}

/**
 * Bottom-sheet drawer that sells prize games via $VIBESTR. Visual design
 * from Claude Design (Shared.jsx → PrizeShopDrawer); wallet / tx flow
 * ported from the existing BuyPrizeGamesModal so onchain behavior is
 * unchanged.
 *
 * Flow:
 *   Connect → Select pack → Confirm → Submit tx → Poll server → Success
 */
export default function PrizeShopDrawer({
    isOpen,
    onClose,
    currentBonus,
    onSuccess,
}: PrizeShopDrawerProps) {
    const { address, isConnected } = useAccount();
    const { writeContractAsync, isPending: isWriting, reset: resetTx } = useWriteContract();
    const { sendTransactionAsync, isPending: isSendingEth } = useSendTransaction();
    const isSending = isWriting || isSendingEth;

    const [selected, setSelected] = useState<PackSize>(5);
    const [paymentRail, setPaymentRail] = useState<PaymentRail>("vibestr");
    const [pricing, setPricing] = useState<PricingSnapshot | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Refs for async handlers that outlive the render they were created in.
    const pollingRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const addressRef = useRef(address);
    const selectedRef = useRef<PackSize>(selected);
    const paymentRailRef = useRef<PaymentRail>(paymentRail);
    const onSuccessRef = useRef(onSuccess);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    useEffect(() => { paymentRailRef.current = paymentRail; }, [paymentRail]);
    useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

    // Reset drawer state whenever it reopens.
    useEffect(() => {
        if (isOpen) {
            setDone(false);
            setError(null);
            setVerifying(false);
            setStatusText("");
            setSelected(5);
            setPaymentRail("vibestr");
        }
    }, [isOpen]);

    // Fetch the active pricing snapshot when the drawer opens.
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        fetch("/api/pricing/current")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (cancelled || !data) return;
                setPricing(data as PricingSnapshot);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [isOpen]);

    // Best-effort cleanup if the component unmounts mid-poll.
    useEffect(() => {
        return () => {
            pollingRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const remaining = MAX_BONUS_PER_DAY - currentBonus;
    const selectedPack = PACKS.find(p => p.size === selected)!;
    const cannotAfford = selectedPack.size > remaining;
    const selectedEntry = pricing?.packages[PACKAGE_IDS[selected]] ?? null;
    const selectedRequiredWei = selectedEntry ? railWei(selectedEntry, paymentRail) : BigInt(0);
    const railDecimals = TOKEN_DECIMALS[paymentRail];
    const selectedTokenDisplay = selectedEntry
        ? formatTokenAmount(selectedRequiredWei, railDecimals, paymentRail === "eth" ? 6 : 2)
        : "—";

    const startPolling = (hash: string) => {
        setVerifying(true);
        pollingRef.current = true;

        const poll = async (attempt: number) => {
            if (!pollingRef.current) return;
            if (attempt >= MAX_POLL_ATTEMPTS) {
                setVerifying(false);
                pollingRef.current = false;
                setError("Transaction is taking longer than expected. Please close and check again.");
                return;
            }
            setStatusText(attempt === 0 ? "Confirming on-chain…" : `Confirming… (${attempt}/${MAX_POLL_ATTEMPTS})`);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const res = await fetch("/api/pinbook/purchase-prize-games", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        txHash: hash,
                        walletAddress: addressRef.current,
                        packageSize: selectedRef.current,
                        paymentRail: paymentRailRef.current,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = await res.json();

                if (data.success) {
                    pollingRef.current = false;
                    setVerifying(false);
                    setDone(true);
                    onSuccessRef.current(data.bonusPrizeGames);
                    return;
                }

                // Retry on transient conditions.
                if (res.status === 404 || res.status === 425 || res.status >= 500) {
                    timerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
                    return;
                }

                pollingRef.current = false;
                setVerifying(false);
                setError(data.error || "Verification failed");
            } catch {
                // Network blip — retry the same attempt bucket.
                timerRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
            }
        };

        poll(0);
    };

    const handleBuy = async () => {
        if (!isConnected || !address || cannotAfford) return;
        setError(null);

        if (!TREASURY_ADDRESS || !TREASURY_ADDRESS.startsWith("0x")) {
            console.error("[PrizeShopDrawer] Missing NEXT_PUBLIC_TREASURY_ADDRESS", { TREASURY_ADDRESS });
            setError("Config error: treasury address not set. Please contact support.");
            return;
        }
        if (!selectedEntry || selectedRequiredWei <= BigInt(0)) {
            setError("Pricing not loaded yet. Please try again.");
            return;
        }

        const capturedRail = paymentRail;
        const capturedRequiredWei = selectedRequiredWei;

        try {
            let hash: `0x${string}`;
            if (capturedRail === "eth") {
                hash = await sendTransactionAsync({
                    to: TREASURY_ADDRESS,
                    value: capturedRequiredWei,
                });
            } else {
                const tokenAddress = capturedRail === "usdc" ? (USDC_ADDRESS as `0x${string}`) : (VIBESTR_ADDRESS as `0x${string}`);
                hash = await writeContractAsync({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [TREASURY_ADDRESS, capturedRequiredWei],
                });
            }
            startPolling(hash);
        } catch (err: unknown) {
            console.error("[PrizeShopDrawer] tx submit failed:", err);
            const raw = err instanceof Error ? (err as Error & { shortMessage?: string }).shortMessage || err.message : String(err);
            if (raw.includes("rejected") || raw.includes("User denied") || raw.includes("User rejected")) {
                setError("Transaction was rejected.");
            } else if (raw.includes("insufficient funds") || raw.includes("exceeds the balance")) {
                setError(`Not enough ${RAIL_LABELS[capturedRail]} in your wallet.`);
            } else if (raw.includes("chain") || raw.includes("network")) {
                setError("Please switch your wallet to Ethereum mainnet.");
            } else {
                setError(`Transaction failed: ${raw.slice(0, 100)}`);
            }
        }
    };

    const handleClose = () => {
        pollingRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        setError(null);
        setDone(false);
        setVerifying(false);
        setStatusText("");
        resetTx();
        onClose();
    };

    const isProcessing = isSending || verifying;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Scrim */}
                    <motion.div
                        onClick={handleClose}
                        className="fixed inset-0 z-[190]"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                    {/* Drawer */}
                    <motion.div
                        className="fixed left-0 right-0 bottom-0 z-[200] px-2 pb-2"
                        initial={{ y: "110%" }}
                        animate={{ y: "0%" }}
                        exit={{ y: "110%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 32 }}
                    >
                        <div
                            className="relative mx-auto max-w-[520px] rounded-[22px] p-[2px] overflow-hidden"
                            style={{
                                background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 40%, ${GOLD_DEEP} 100%)`,
                                boxShadow: `0 -6px 30px ${GOLD}22, 0 2px 0 ${GOLD_DEEP}`,
                            }}
                        >
                            <div
                                className="rounded-[20px] px-5 pt-4 pb-5"
                                style={{ background: "linear-gradient(180deg, #2A1A0A 0%, #120A03 100%)" }}
                            >
                                {/* Grab handle */}
                                <div
                                    className="mx-auto mb-3 rounded-full"
                                    style={{ width: 40, height: 4, background: `${GOLD}55` }}
                                />

                                {done ? (
                                    <SuccessState onClose={handleClose} />
                                ) : !isConnected ? (
                                    <ConnectState currentBonus={currentBonus} />
                                ) : (
                                    <PurchaseState
                                        selected={selected}
                                        setSelected={setSelected}
                                        remaining={remaining}
                                        currentBonus={currentBonus}
                                        cannotAfford={cannotAfford}
                                        selectedPack={selectedPack}
                                        error={error}
                                        statusText={statusText}
                                        isProcessing={isProcessing}
                                        onBuy={handleBuy}
                                        onClose={handleClose}
                                        paymentRail={paymentRail}
                                        setPaymentRail={setPaymentRail}
                                        pricing={pricing}
                                        selectedTokenDisplay={selectedTokenDisplay}
                                    />
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/* ---------------- State subviews ---------------- */

function ConnectState({ currentBonus }: { currentBonus: number }) {
    return (
        <div className="text-center py-4">
            <h3
                className="font-display font-black uppercase leading-none mb-2"
                style={{ color: GOLD, fontSize: 22, textShadow: "0 2px 0 rgba(0,0,0,0.4)" }}
            >
                Restock Bonus Games
            </h3>
            <p className="text-white/55 text-[12px] font-mundial mb-5 tracking-wide">
                Connect a wallet to pay with $VIBESTR.
                {currentBonus > 0 && ` You've added ${currentBonus} bonus today.`}
            </p>
            <div className="flex justify-center">
                <ConnectButton />
            </div>
        </div>
    );
}

interface PurchaseStateProps {
    selected: PackSize;
    setSelected: (s: PackSize) => void;
    remaining: number;
    currentBonus: number;
    cannotAfford: boolean;
    selectedPack: Pack;
    error: string | null;
    statusText: string;
    isProcessing: boolean;
    onBuy: () => void;
    onClose: () => void;
    paymentRail: PaymentRail;
    setPaymentRail: (r: PaymentRail) => void;
    pricing: PricingSnapshot | null;
    selectedTokenDisplay: string;
}

function PurchaseState({
    selected, setSelected, remaining, currentBonus, cannotAfford,
    selectedPack, error, statusText, isProcessing, onBuy, onClose,
    paymentRail, setPaymentRail, pricing, selectedTokenDisplay,
}: PurchaseStateProps) {
    const railDecimals = TOKEN_DECIMALS[paymentRail];
    return (
        <>
            <div className="flex items-end justify-between mb-1">
                <div>
                    <h3
                        className="font-display font-black uppercase leading-none"
                        style={{ color: GOLD, fontSize: 22, textShadow: "0 2px 0 rgba(0,0,0,0.4)" }}
                    >
                        Restock Bonus Games
                    </h3>
                    {currentBonus > 0 && (
                        <p className="text-white/45 text-[11px] font-mundial mt-1 tracking-wide">
                            +{currentBonus} bonus today
                        </p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-white/40 hover:text-white text-xs font-bold tracking-wider"
                >
                    CLOSE ✕
                </button>
            </div>

            {/* Payment-rail toggle. Same shape as the other purchase
                surfaces — VIBESTR pill carries the -10% holder discount tag. */}
            <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="font-display text-[10px] tracking-[0.2em] uppercase text-white/45">Pay with</span>
                    {pricing && (
                        <span className="font-mundial text-[10px] text-white/30">Updated {new Date(pricing.updatedAt * 1000).toLocaleDateString()}</span>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {(["vibestr", "usdc", "eth"] as PaymentRail[]).map(rail => {
                        const sel = paymentRail === rail;
                        return (
                            <button
                                key={rail}
                                type="button"
                                onClick={() => setPaymentRail(rail)}
                                disabled={isProcessing}
                                className="relative py-2 rounded-lg font-display font-black text-[11px] tracking-[0.15em] uppercase transition-all disabled:opacity-40"
                                style={{
                                    background: sel ? GOLD : "rgba(255,255,255,0.04)",
                                    color: sel ? "#1A0633" : "rgba(255,255,255,0.55)",
                                    border: sel ? "none" : "1px solid rgba(255,255,255,0.08)",
                                    boxShadow: sel ? `0 4px 12px ${GOLD}33` : "none",
                                }}
                            >
                                {RAIL_LABELS[rail]}
                                {rail === "vibestr" && (
                                    <span
                                        className="absolute -top-1.5 -right-1.5 font-display text-[8px] tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                                        style={{
                                            background: sel ? "#1A0633" : GOLD,
                                            color: sel ? GOLD : "#1A0633",
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

            <div className="mt-4 flex flex-col gap-2.5">
                {PACKS.map(p => {
                    const isSel = selected === p.size;
                    const packDisabled = p.size > remaining;
                    const entry = pricing?.packages[PACKAGE_IDS[p.size]] ?? null;
                    const totalWei = entry ? railWei(entry, paymentRail) : BigInt(0);
                    const totalDisplay = entry
                        ? formatTokenAmount(totalWei, railDecimals, paymentRail === "eth" ? 6 : 2)
                        : "—";
                    const usdMills = entry ? railUsdMills(entry, paymentRail) : 0;
                    return (
                        <button
                            key={p.size}
                            onClick={() => !packDisabled && setSelected(p.size)}
                            disabled={packDisabled}
                            className="relative text-left rounded-xl transition-all"
                            style={{
                                padding: 2,
                                background: isSel
                                    ? `linear-gradient(135deg, ${p.featured ? COSMIC : GOLD}, ${p.featured ? COSMIC_DEEP : GOLD_DEEP})`
                                    : "rgba(255,255,255,0.06)",
                                transform: isSel ? "translateY(-1px)" : "none",
                                boxShadow: isSel ? `0 6px 20px ${p.featured ? COSMIC : GOLD}44` : "none",
                                opacity: packDisabled ? 0.35 : 1,
                                cursor: packDisabled ? "not-allowed" : "pointer",
                            }}
                        >
                            <div
                                className="rounded-[10px] px-3.5 py-3 flex items-center gap-3.5"
                                style={{ background: "#150818" }}
                            >
                                {/* Stacked coins illustration — centered in a fixed
                                    box so every pack's icon sits at the same
                                    visual center (previously the stacks were
                                    top/left-anchored and looked offset). */}
                                <div className="relative shrink-0 flex items-center justify-center" style={{ width: 58, height: 52 }}>
                                    {(() => {
                                        const coinCount = p.size >= 5 ? 3 : p.size > 1 ? 2 : 1;
                                        const baseSize = 44;
                                        const stackStep = 8; // vertical spacing between stacked coins
                                        const stackWidth = 4 * (coinCount - 1); // horizontal fan
                                        const stackHeight = baseSize + stackStep * (coinCount - 1);
                                        return (
                                            <div
                                                className="relative"
                                                style={{ width: baseSize + stackWidth, height: stackHeight }}
                                            >
                                                {[...Array(coinCount)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="absolute"
                                                        style={{
                                                            left: i * 4,
                                                            top: stackHeight - baseSize - i * stackStep,
                                                            zIndex: i,
                                                        }}
                                                    >
                                                        <PrizeCoin
                                                            size={baseSize - i * 2}
                                                            coinColor={p.featured ? COSMIC : GOLD}
                                                            glow={isSel && i === coinCount - 1}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    {p.size >= 5 && (
                                        <span
                                            className="absolute -top-1 -right-1 font-display font-black text-[10px] px-1.5 py-0.5 rounded-md"
                                            style={{
                                                background: p.featured ? COSMIC : GOLD,
                                                color: "#1A0633",
                                                zIndex: 5,
                                            }}
                                        >
                                            ×{p.size}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="font-display font-black text-white uppercase text-[17px] tracking-tight leading-none">
                                            {p.label}
                                        </span>
                                        <span className="text-white/40 text-[10px] font-mundial">
                                            {p.size} Bonus Game{p.size === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    {p.discount && (
                                        <div
                                            className="text-[10px] font-black tracking-wider mt-1"
                                            style={{ color: p.featured ? COSMIC : GOLD }}
                                        >
                                            {p.discount}
                                        </div>
                                    )}
                                </div>

                                <div className="text-right shrink-0">
                                    <div
                                        className="font-display font-black leading-none"
                                        style={{ color: p.featured ? COSMIC : GOLD, fontSize: 20 }}
                                    >
                                        <TokenAmount value={totalDisplay} />
                                    </div>
                                    <div className="text-white/40 text-[9px] font-mundial tracking-widest">
                                        {RAIL_LABELS[paymentRail]}
                                    </div>
                                    {usdMills > 0 && (
                                        <div className="text-white/30 text-[9px] font-mundial mt-0.5">
                                            ~{formatUsdFromMills(usdMills)}
                                        </div>
                                    )}
                                </div>

                                {isSel && (
                                    <div
                                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                                        style={{
                                            background: p.featured ? COSMIC : GOLD,
                                            boxShadow: `0 0 12px ${p.featured ? COSMIC : GOLD}`,
                                        }}
                                    />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {cannotAfford && (
                <p className="text-[#FFB547] text-[11px] font-mundial text-center mt-3">
                    Only {remaining} slot{remaining === 1 ? "" : "s"} left today — pick a smaller pack.
                </p>
            )}

            {error && (
                <p className="text-[#FF8A70] text-[11px] font-mundial text-center mt-3">
                    {error}
                </p>
            )}

            {isProcessing && statusText && (
                <p className="text-white/60 text-[11px] font-mundial text-center mt-3">
                    {statusText}
                </p>
            )}

            <ChunkyButton
                onClick={onBuy}
                disabled={cannotAfford || isProcessing}
                className="w-full mt-5 font-display uppercase tracking-[0.12em]"
                style={{ padding: "14px 18px", fontSize: 14, fontWeight: 900 }}
            >
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <span
                            className="inline-block w-4 h-4 border-2 rounded-full"
                            style={{
                                borderColor: "rgba(0,0,0,0.25)",
                                borderTopColor: "#1A0633",
                                animation: "vmSpinner 0.8s linear infinite",
                            }}
                        />
                        Confirming…
                    </span>
                ) : (
                    `Buy for ${selectedTokenDisplay} ${RAIL_LABELS[paymentRail]}`
                )}
            </ChunkyButton>

            <style jsx>{`
                @keyframes vmSpinner { to { transform: rotate(360deg); } }
            `}</style>

            <p className="text-white/25 text-[9px] font-mundial text-center mt-3 tracking-wider">
                You may purchase up to {MAX_BONUS_PER_DAY} Bonus Games per day. Resets at noon ET.
            </p>
            <p className="text-white/30 text-[9px] font-mundial text-center mt-1.5 leading-snug">
                Using $VIBESTR does not increase the probability of any specific outcome. Every pin is earnable for free.
            </p>
        </>
    );
}

function SuccessState({ onClose }: { onClose: () => void }) {
    return (
        <div className="text-center py-6">
            <motion.div
                animate={{ rotate: [0, -14, 14, -8, 8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.2 }}
                style={{ width: 64, height: 64, margin: "0 auto 12px", position: "relative" }}
            >
                <Image
                    src="/assets/gvc_shaka.png"
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                />
            </motion.div>
            <h3
                className="font-display text-2xl font-black uppercase"
                style={{ color: GOLD }}
            >
                Bonus Games Loaded
            </h3>
            <p className="text-white/60 text-xs mt-1 mb-5 font-mundial tracking-wide">
                You&apos;re stacked and ready to rock. Go crush it.
            </p>
            <ChunkyButton
                onClick={onClose}
                style={{ padding: "14px 28px", fontWeight: 900, letterSpacing: "0.1em", fontSize: 14 }}
            >
                Go Play
            </ChunkyButton>
        </div>
    );
}
