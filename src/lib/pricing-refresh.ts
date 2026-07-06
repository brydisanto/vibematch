/**
 * Pricing-refresh logic, shared by:
 *  - scripts/refresh-pricing.mjs (CLI / launchd)
 *  - /api/admin/pricing/refresh (Vercel Cron)
 *
 * Computes a PricingSnapshot from current market prices (ETH/USD,
 * VIBESTR/USD) and writes it to the KV key for the calling
 * environment (production vs preview).
 *
 * Price discovery:
 *  - ETH/USD: CoinGecko (free, no key). Falls back to hardcoded
 *    $3,000 if the fetch fails.
 *  - VIBESTR/USD: Uniswap v4 pool via StateView.getSlot0. VIBESTR
 *    is currency1 (by address ordering vs WETH/native ETH), so
 *    price = (2^96 / sqrtPriceX96)^2 gives WETH-per-VIBESTR; times
 *    ethUsdMills = VIBESTR/USD. Env var VIBESTR_USD_PER_TOKEN
 *    overrides for testing / emergencies. Hardcoded $0.003 fallback
 *    if both fail.
 */

import { kv } from '@vercel/kv';
import {
    PRICING_PACKAGE_IDS,
    VIBESTR_DECIMALS,
    USDC_DECIMALS,
    ETH_DECIMALS,
    weiForUsd,
    pricingKvKey,
    type PricingSnapshot,
    type PricingPackageEntry,
} from './pricing';
import { getMainnetClient } from './eth-rpc';
import { parseAbi } from 'viem';

const USDC_USD_MILLS = 1000;
const ETH_USD_FALLBACK_MILLS = 3_000_000;
const VIBESTR_USD_FALLBACK_MILLS = 3; // $0.003

// Uniswap v4 StateView helper on mainnet — exposes getSlot0(poolId).
// Reads the singleton PoolManager's storage without needing extsload
// slot math ourselves.
const STATE_VIEW_ADDRESS = '0x7ffe42c4a5deea5b0fec41c94c136cf115597227' as const;
const STATE_VIEW_ABI = parseAbi([
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
]);
// VIBESTR/WETH v4 pool. currency0 = WETH (or native ETH), currency1
// = VIBESTR — sorted by address, VIBESTR (0xd0cC...) > WETH
// (0xC02a...) so VIBESTR is always the higher-address side.
const VIBESTR_V4_POOL_ID =
    '0x56c8fc0c410ec0778484600246847e2e77c428f888a35a11351dc12bbff09c6d' as const;

// USD anchors per package. Mirror FALLBACK_PRICING in src/lib/pricing.ts;
// the cron blesses these into KV on every fire so they stay authoritative.
const PACKAGE_USD_ANCHORS: Record<typeof PRICING_PACKAGE_IDS[number], { usdMills: number; vibestrUsdMills: number }> = {
    'reroll-per-capsule': { usdMills: 330, vibestrUsdMills: 300 },
    'prize-games-1':      { usdMills: 275, vibestrUsdMills: 250 },
    'prize-games-5':      { usdMills: 1100, vibestrUsdMills: 1000 },
    'prize-games-10':     { usdMills: 1850, vibestrUsdMills: 1670 },
};

async function getEthUsdMills(): Promise<number> {
    if (process.env.ETH_USD_OVERRIDE) {
        return Math.round(parseFloat(process.env.ETH_USD_OVERRIDE) * 1000);
    }
    try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
            // Tight timeout — if CoinGecko is slow we'd rather fall back
            // than have the cron hang past its 60s budget.
            signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw new Error(`coingecko ${r.status}`);
        const d = await r.json();
        const usd = Number(d?.ethereum?.usd);
        if (!isFinite(usd) || usd <= 0) throw new Error('invalid eth/usd');
        return Math.round(usd * 1000);
    } catch (e) {
        console.warn('[pricing-refresh] ETH/USD lookup failed, using fallback:', e);
        return ETH_USD_FALLBACK_MILLS;
    }
}

/**
 * Read the current VIBESTR/WETH v4 pool sqrtPriceX96. Returns null
 * if the read fails so callers can fall through to env / hardcoded
 * fallbacks. Same math is used later to compute both a
 * display-friendly vibestrUsdMills value AND (crucially) the
 * precise per-package vibestrWei — see buildPricingSnapshot.
 */
async function getVibestrSqrtPriceX96(): Promise<bigint | null> {
    try {
        const client = getMainnetClient();
        const result = await client.readContract({
            address: STATE_VIEW_ADDRESS,
            abi: STATE_VIEW_ABI,
            functionName: 'getSlot0',
            args: [VIBESTR_V4_POOL_ID],
        });
        // viem returns a tuple: [sqrtPriceX96, tick, protocolFee, lpFee]
        const sqrtPriceX96 = (result as readonly [bigint, number, number, number])[0];
        if (sqrtPriceX96 <= BigInt(0)) throw new Error('sqrtPriceX96 <= 0');
        return sqrtPriceX96;
    } catch (e) {
        console.warn('[pricing-refresh] VIBESTR pool read failed:', e);
        return null;
    }
}

/**
 * VIBESTR/USD in mills, rounded to nearest. For the snapshot's
 * ethUsdMills / vibestrUsdMills fields only — the per-package
 * vibestrWei uses sqrtPriceX96 directly for full precision.
 *   sqrtPriceX96 = sqrt(price1/price0) * 2^96
 *   price1/price0 = VIBESTR per WETH (both 18 decimals)
 *   VIBESTR/USD = ETH/USD × (2^96)^2 / sqrtPriceX96^2
 */
function vibestrUsdMillsFromSlot0(sqrtPriceX96: bigint, ethUsdMills: number): number {
    const Q96 = BigInt(2) ** BigInt(96);
    // Scale by 1000 to preserve one decimal of precision before rounding.
    const scaled = BigInt(ethUsdMills) * BigInt(1000) * Q96 * Q96;
    const scaledMills = scaled / (sqrtPriceX96 * sqrtPriceX96);
    // Round to nearest whole mill.
    const mills = Number((scaledMills + BigInt(500)) / BigInt(1000));
    return Math.max(1, mills);
}

/**
 * Compute vibestrWei for a USD-mills anchor with FULL precision by
 * plugging sqrtPriceX96 directly into the wei formula instead of
 * routing through the mill-rounded price. Prevents 5-10% overcharge
 * that would show up if we did the math via truncated mills.
 *
 *   usdMills / 1000 = wei * pricePerWei
 *   pricePerWei     = ethUsd × Q96^2 / (sqrtPriceX96^2 × 10^18)
 *   wei             = usdMills × 10^18 × sqrtPriceX96^2
 *                     / (ethUsdMills × Q96^2)
 */
function vibestrWeiFromSlot0(
    usdMillsAnchor: number,
    ethUsdMills: number,
    sqrtPriceX96: bigint,
): bigint {
    const Q96 = BigInt(2) ** BigInt(96);
    const scale = BigInt(10) ** BigInt(VIBESTR_DECIMALS);
    const numerator = BigInt(usdMillsAnchor) * scale * sqrtPriceX96 * sqrtPriceX96;
    const denominator = BigInt(ethUsdMills) * Q96 * Q96;
    return numerator / denominator;
}

function ceilToWholeToken(wei: bigint, decimals: number): bigint {
    const scale = BigInt(10) ** BigInt(decimals);
    const rem = wei % scale;
    if (rem === BigInt(0)) return wei;
    return wei - rem + scale;
}

export async function buildPricingSnapshot(): Promise<PricingSnapshot> {
    const ethUsdMills = await getEthUsdMills();

    // Env override wins over the pool read — pin a price for testing
    // or freeze if slot0 starts returning garbage.
    const envRaw = process.env.VIBESTR_USD_PER_TOKEN;
    const envMills =
        envRaw && isFinite(parseFloat(envRaw)) && parseFloat(envRaw) > 0
            ? Math.round(parseFloat(envRaw) * 1000)
            : null;

    const sqrtPriceX96 = envMills === null ? await getVibestrSqrtPriceX96() : null;
    const vibestrUsdMills =
        envMills ??
        (sqrtPriceX96 !== null
            ? vibestrUsdMillsFromSlot0(sqrtPriceX96, ethUsdMills)
            : VIBESTR_USD_FALLBACK_MILLS);

    const packages = {} as Record<typeof PRICING_PACKAGE_IDS[number], PricingPackageEntry>;
    for (const id of PRICING_PACKAGE_IDS) {
        const anchors = PACKAGE_USD_ANCHORS[id];
        // If we have a live sqrtPriceX96, use it directly so we don't
        // lose precision routing through mill-rounded prices. Otherwise
        // fall through to the mill-based weiForUsd path.
        const rawVibestrWei =
            sqrtPriceX96 !== null
                ? vibestrWeiFromSlot0(anchors.vibestrUsdMills, ethUsdMills, sqrtPriceX96)
                : BigInt(weiForUsd(anchors.vibestrUsdMills, vibestrUsdMills, VIBESTR_DECIMALS));
        const ceiledVibestrWei = ceilToWholeToken(rawVibestrWei, VIBESTR_DECIMALS);
        packages[id] = {
            usdMills: anchors.usdMills,
            vibestrUsdMills: anchors.vibestrUsdMills,
            vibestrWei: ceiledVibestrWei.toString(),
            usdcWei:    weiForUsd(anchors.usdMills, USDC_USD_MILLS, USDC_DECIMALS),
            ethWei:     weiForUsd(anchors.usdMills, ethUsdMills,    ETH_DECIMALS),
        };
    }
    return {
        updatedAt: Math.floor(Date.now() / 1000),
        ethUsdMills,
        vibestrUsdMills,
        packages,
    };
}

/**
 * Build the snapshot + write it to the KV key for the current
 * environment (production or preview). Returns the snapshot that
 * was written so the caller can verify / log it.
 */
export async function refreshPricingSnapshot(): Promise<PricingSnapshot> {
    const snapshot = await buildPricingSnapshot();
    await kv.set(pricingKvKey(), snapshot);
    return snapshot;
}
