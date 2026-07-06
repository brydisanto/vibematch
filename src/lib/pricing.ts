/**
 * Dynamic pricing layer for capsule rerolls + bonus-prize-game purchases.
 *
 * Architecture (see also: refresh-pricing.mjs, /api/pricing/current):
 *  - A daily cron computes the current USD-anchored wei amount for each
 *    (package × payment rail) combo by reading VIBESTR/ETH from Uniswap
 *    and ETH/USD from Chainlink, then writes a single PricingSnapshot
 *    to KV.
 *  - Server routes (reroll, purchase-prize-games) read the snapshot at
 *    submit time to validate the tx amount against the current price.
 *  - Client modals fetch the snapshot at mount time to display the
 *    correct number for the chosen rail.
 *
 * Three rails:
 *  - VIBESTR: ERC-20 transfer to treasury. Carries a 10% discount on
 *    the USD anchor (encoded as separate vibestrUsdCents per package).
 *  - USDC:    ERC-20 transfer to treasury, 6 decimals, 1:1 with USD.
 *  - ETH:     Native transfer to treasury. Same USD as USDC.
 *
 * Fallback behavior: if KV is missing the snapshot (fresh deploy,
 * cron not yet fired), the server uses FALLBACK_PRICING below — the
 * user-supplied baseline. Lets the feature ship before the first
 * cron run.
 */

import { kv } from '@vercel/kv';

export type PaymentRail = 'vibestr' | 'usdc' | 'eth';

export const PRICING_PACKAGE_IDS = [
    'reroll-per-capsule',
    'prize-games-1',
    'prize-games-5',
    'prize-games-10',
] as const;
export type PricingPackageId = (typeof PRICING_PACKAGE_IDS)[number];

export interface PricingPackageEntry {
    /** USD anchor for the non-VIBESTR rails (ETH + USDC), in mills
     *  (1/1000 of a dollar). $0.275 = 275. Mills keeps fractional-cent
     *  package prices exact (e.g. bonus-1 is $0.275, not $0.28). */
    usdMills: number;
    /** USD anchor for the VIBESTR rail, in mills. Separate from
     *  usdMills so VIBESTR can carry a holder discount. */
    vibestrUsdMills: number;
    /** Wei amount for each rail. String to survive JSON round-trips
     *  for the 256-bit VIBESTR/ETH values. */
    vibestrWei: string;
    usdcWei: string;
    ethWei: string;
}

export interface PricingSnapshot {
    /** Unix seconds, set by the refresh script. */
    updatedAt: number;
    /** Mills per ETH at refresh time (1 ETH worth in 1/1000 USD).
     *  Surfaced for transparency on the admin dashboard. */
    ethUsdMills: number;
    /** Mills per VIBESTR at refresh time. */
    vibestrUsdMills: number;
    packages: Record<PricingPackageId, PricingPackageEntry>;
}

// Mainnet token addresses — verified before adding to client + server.
export const VIBESTR_TOKEN_ADDRESS = '0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196';
export const USDC_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

export const VIBESTR_DECIMALS = 18;
export const USDC_DECIMALS = 6;
export const ETH_DECIMALS = 18;

/**
 * Hardcoded fallback used when KV is empty. Mirrors the prices in
 * the build brief:
 *   reroll   $0.30 → VIBESTR | $0.33 → USDC/ETH (10% VIBESTR discount)
 *   bonus 1  $0.25 → VIBESTR | $0.275 → USDC/ETH
 *   bonus 5  $1.00 → VIBESTR | $1.10  → USDC/ETH
 *   bonus 10 $1.67 → VIBESTR | $1.85  → USDC/ETH
 *
 * Wei amounts use placeholder ETH = $3,000 and VIBESTR = $0.003 so the
 * UI can boot without KV. The cron-refreshed values overwrite these
 * on every refresh.
 */
const ETH_USD_FALLBACK_MILLS = 3_000_000;     // $3,000/ETH (in mills)
const VIBESTR_USD_FALLBACK_MILLS = 3;         // $0.003/VIBESTR (100 VIBESTR per $0.30 reroll)
const USDC_USD_MILLS = 1000;                   // $1.00 exactly

export function weiForUsd(usdMills: number, tokenUsdMills: number, decimals: number): string {
    // wei = (usdMills * 10^decimals) / tokenUsdMills
    // BigInt math throughout so 256-bit wei values don't overflow.
    if (tokenUsdMills <= 0) return '0';
    const scale = BigInt(10) ** BigInt(decimals);
    const wei = (BigInt(usdMills) * scale) / BigInt(tokenUsdMills);
    return wei.toString();
}

/** Round a wei amount UP to the nearest whole token (multiples of
 *  10^decimals). Applied to VIBESTR amounts so the player-facing
 *  number never has a decimal like "62.5 VIBESTR" — always a clean
 *  whole. Rounding up ensures the USD anchor is always >= the
 *  target, never under-priced. */
function ceilToWholeToken(wei: bigint, decimals: number): bigint {
    const scale = BigInt(10) ** BigInt(decimals);
    const rem = wei % scale;
    if (rem === BigInt(0)) return wei;
    return wei - rem + scale;
}

function buildFallbackPackage(
    usdMills: number,
    vibestrUsdMills: number,
): PricingPackageEntry {
    const rawVibestrWei = BigInt(weiForUsd(vibestrUsdMills, VIBESTR_USD_FALLBACK_MILLS, VIBESTR_DECIMALS));
    const ceiledVibestrWei = ceilToWholeToken(rawVibestrWei, VIBESTR_DECIMALS);
    return {
        usdMills,
        vibestrUsdMills,
        vibestrWei: ceiledVibestrWei.toString(),
        usdcWei: weiForUsd(usdMills, USDC_USD_MILLS, USDC_DECIMALS),
        ethWei: weiForUsd(usdMills, ETH_USD_FALLBACK_MILLS, ETH_DECIMALS),
    };
}

export const FALLBACK_PRICING: PricingSnapshot = {
    updatedAt: 0,
    ethUsdMills: ETH_USD_FALLBACK_MILLS,
    vibestrUsdMills: VIBESTR_USD_FALLBACK_MILLS,
    packages: {
        'reroll-per-capsule': buildFallbackPackage(330, 300),    // $0.33 / $0.30
        'prize-games-1':      buildFallbackPackage(275, 250),    // $0.275 / $0.25
        'prize-games-5':      buildFallbackPackage(1100, 1000),  // $1.10 / $1.00
        'prize-games-10':     buildFallbackPackage(1850, 1670),  // $1.85 / $1.67
    },
};

/**
 * KV key the snapshot is written to / read from. Preview deploys use
 * a separate key so seeding test prices on a feature branch can't
 * accidentally apply to production users.
 */
export function pricingKvKey(): string {
    // VERCEL_ENV is "production" / "preview" / "development". Anything
    // other than production reads from the preview key so feature
    // branches stay isolated.
    return process.env.VERCEL_ENV === 'production'
        ? 'pricing:packages'
        : 'pricing:packages:preview';
}

// Small in-memory cache so a burst of requests on the same serverless
// instance doesn't hammer KV. 30s window — well under the daily
// refresh cadence, so reads stay fresh.
let cached: { snapshot: PricingSnapshot; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getPricingSnapshot(): Promise<PricingSnapshot> {
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.snapshot;
    }
    try {
        const stored = await kv.get(pricingKvKey()) as PricingSnapshot | null;
        const snapshot = stored ?? FALLBACK_PRICING;
        cached = { snapshot, fetchedAt: now };
        return snapshot;
    } catch (e) {
        console.error('[pricing] KV read failed, using fallback:', e);
        return FALLBACK_PRICING;
    }
}

/**
 * Resolve the required wei amount for a (package, rail) at submit
 * time. Server routes call this just before the on-chain transfer
 * verification. Returns BigInt(0) if the package or rail is unrecognized
 * (caller should reject the request rather than verify against 0).
 */
export async function getRequiredWei(
    packageId: PricingPackageId,
    rail: PaymentRail,
    multiplier = 1,
): Promise<bigint> {
    const snapshot = await getPricingSnapshot();
    const entry = snapshot.packages[packageId];
    if (!entry) return BigInt(0);
    const raw =
        rail === 'vibestr' ? entry.vibestrWei :
        rail === 'usdc'    ? entry.usdcWei :
        rail === 'eth'     ? entry.ethWei :
        '0';
    try {
        return BigInt(raw) * BigInt(multiplier);
    } catch {
        return BigInt(0);
    }
}

/** Reset the in-memory cache. Called by /api/pricing/refresh after a
 *  successful refresh so the new snapshot takes effect on the local
 *  serverless instance immediately. */
export function invalidatePricingCache(): void {
    cached = null;
}
