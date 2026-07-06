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
 *  - VIBESTR/USD: env var VIBESTR_USD_PER_TOKEN (e.g. "0.004").
 *    Falls back to hardcoded $0.004 if unset. VIBESTR is illiquid
 *    enough that a manual env-var anchor is the simplest reliable
 *    source until / unless we wire a Uniswap pool read.
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

const USDC_USD_MILLS = 1000;
const ETH_USD_FALLBACK_MILLS = 3_000_000;
const VIBESTR_USD_FALLBACK_MILLS = 3; // $0.003

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

function getVibestrUsdMills(): number {
    const raw = process.env.VIBESTR_USD_PER_TOKEN;
    if (raw) {
        const usd = parseFloat(raw);
        if (isFinite(usd) && usd > 0) return Math.round(usd * 1000);
    }
    return VIBESTR_USD_FALLBACK_MILLS;
}

function ceilToWholeToken(wei: bigint, decimals: number): bigint {
    const scale = BigInt(10) ** BigInt(decimals);
    const rem = wei % scale;
    if (rem === BigInt(0)) return wei;
    return wei - rem + scale;
}

export async function buildPricingSnapshot(): Promise<PricingSnapshot> {
    const [ethUsdMills, vibestrUsdMills] = await Promise.all([
        getEthUsdMills(),
        Promise.resolve(getVibestrUsdMills()),
    ]);
    const packages = {} as Record<typeof PRICING_PACKAGE_IDS[number], PricingPackageEntry>;
    for (const id of PRICING_PACKAGE_IDS) {
        const anchors = PACKAGE_USD_ANCHORS[id];
        const rawVibestrWei = BigInt(weiForUsd(anchors.vibestrUsdMills, vibestrUsdMills, VIBESTR_DECIMALS));
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
