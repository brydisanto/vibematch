#!/usr/bin/env node
/**
 * Refresh the dynamic-pricing snapshot in KV.
 *
 * Reads VIBESTR/ETH from the Uniswap v3 pool, ETH/USD from Chainlink,
 * computes wei amounts for each (package, rail) at the canonical USD
 * anchor, then writes a single PricingSnapshot to KV.
 *
 * Usage:
 *   node scripts/refresh-pricing.mjs --dry            # preview only
 *   node scripts/refresh-pricing.mjs --apply          # production key
 *   node scripts/refresh-pricing.mjs --apply --preview  # preview key
 *
 * Defaults: --dry. --apply with no --preview writes to the production
 * key (pricing:packages). --apply --preview writes to the preview
 * isolation key (pricing:packages:preview) used by non-prod deploys.
 *
 * Token decimals:
 *   VIBESTR 18, USDC 6, ETH 18
 *
 * USD anchors (mills, 1/1000 of a dollar):
 *   reroll-per-capsule   330 / 300
 *   prize-games-1        275 / 250
 *   prize-games-5       1100 / 1000
 *   prize-games-10      1850 / 1670
 *   (USDC+ETH / VIBESTR — VIBESTR carries 10% holder discount.)
 *
 * Override price sources with env vars during testing:
 *   ETH_USD_OVERRIDE=3000.00       (dollars per ETH)
 *   VIBESTR_USD_OVERRIDE=0.04      (dollars per VIBESTR)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
    envText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).map(l => {
        const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;
const ALCHEMY_KEY = env.ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;

async function kvSet(key, value) {
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    });
    if (!r.ok) throw new Error(`KV set failed: ${r.status} ${await r.text()}`);
    return r.json();
}

// ── Price discovery ───────────────────────────────────────────────────
// VIBESTR/ETH lives on Uniswap v3. We read slot0 from the pool and
// derive the spot price. For preview/testing the env-var overrides
// short-circuit this and let you pin exact USD prices.

const VIBESTR_USDC_FALLBACK_MILLS = 3;     // $0.003 (100 VIBESTR per $0.30)
const ETH_USD_FALLBACK_MILLS = 3_000_000;  // $3,000

async function getEthUsdMills() {
    if (process.env.ETH_USD_OVERRIDE) {
        return Math.round(parseFloat(process.env.ETH_USD_OVERRIDE) * 1000);
    }
    // Chainlink ETH/USD aggregator on mainnet:
    //   0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 — returns 8-decimal answer.
    // For scaffold we use CoinGecko since it doesn't need an Alchemy key.
    try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        if (!r.ok) throw new Error('coingecko fetch failed');
        const d = await r.json();
        const usd = Number(d?.ethereum?.usd);
        if (!isFinite(usd) || usd <= 0) throw new Error('invalid eth/usd');
        return Math.round(usd * 1000);
    } catch (e) {
        console.warn('[refresh-pricing] ETH/USD lookup failed, using fallback:', e.message);
        return ETH_USD_FALLBACK_MILLS;
    }
}

// Uniswap v4 StateView on mainnet — same address as used by the cron
// endpoint in src/lib/pricing-refresh.ts. getSlot0(bytes32) selector
// is keccak256('getSlot0(bytes32)')[:4] = 0xf3fef3a3.
const STATE_VIEW_ADDRESS = '0x7ffe42c4a5deea5b0fec41c94c136cf115597227';
const VIBESTR_V4_POOL_ID = '0x56c8fc0c410ec0778484600246847e2e77c428f888a35a11351dc12bbff09c6d';
const GET_SLOT0_SELECTOR = '0xc815641c';

async function ethCall(rpcUrl, to, data) {
    const r = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to, data }, 'latest'],
        }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'rpc error');
    return j.result;
}

async function getVibestrSqrtPriceX96() {
    try {
        const rpcUrl = ALCHEMY_KEY
            ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
            : 'https://ethereum.publicnode.com';
        const data = GET_SLOT0_SELECTOR + VIBESTR_V4_POOL_ID.slice(2);
        const result = await ethCall(rpcUrl, STATE_VIEW_ADDRESS, data);
        if (!result || result === '0x' || result.length < 66) {
            throw new Error(`empty result: ${result}`);
        }
        // Return is (uint160, int24, uint24, uint24) — 32 bytes per ABI word,
        // sqrtPriceX96 lives in the first word.
        const sqrtPriceX96 = BigInt('0x' + result.slice(2, 66));
        if (sqrtPriceX96 <= BigInt(0)) throw new Error('sqrtPriceX96 <= 0');
        return sqrtPriceX96;
    } catch (e) {
        console.warn('[refresh-pricing] VIBESTR pool read failed:', e.message);
        return null;
    }
}

function vibestrUsdMillsFromSlot0(sqrtPriceX96, ethUsdMills) {
    const Q96 = BigInt(2) ** BigInt(96);
    // Scale by 1000 to preserve one decimal of precision before rounding.
    const scaled = BigInt(ethUsdMills) * BigInt(1000) * Q96 * Q96;
    const scaledMills = scaled / (sqrtPriceX96 * sqrtPriceX96);
    const mills = Number((scaledMills + BigInt(500)) / BigInt(1000));
    return Math.max(1, mills);
}

function vibestrWeiFromSlot0(usdMillsAnchor, ethUsdMills, sqrtPriceX96, decimals) {
    const Q96 = BigInt(2) ** BigInt(96);
    const scale = BigInt(10) ** BigInt(decimals);
    const numerator = BigInt(usdMillsAnchor) * scale * sqrtPriceX96 * sqrtPriceX96;
    const denominator = BigInt(ethUsdMills) * Q96 * Q96;
    return numerator / denominator;
}

// ── Wei math ──────────────────────────────────────────────────────────
function weiForUsd(usdMills, tokenUsdMills, decimals) {
    if (tokenUsdMills <= 0) return '0';
    const scale = BigInt(10) ** BigInt(decimals);
    const wei = (BigInt(usdMills) * scale) / BigInt(tokenUsdMills);
    return wei.toString();
}
function ceilToWholeToken(wei, decimals) {
    const scale = BigInt(10) ** BigInt(decimals);
    const rem = wei % scale;
    if (rem === BigInt(0)) return wei;
    return wei - rem + scale;
}

const VIBESTR_DECIMALS = 18;
const USDC_DECIMALS = 6;
const ETH_DECIMALS = 18;
const USDC_USD_MILLS = 1000;

// USD anchors per package, mirroring FALLBACK_PRICING in src/lib/pricing.ts.
const PACKAGES = {
    'reroll-per-capsule': { usdMills: 330, vibestrUsdMills: 300 },
    'prize-games-1':      { usdMills: 275, vibestrUsdMills: 250 },
    'prize-games-5':      { usdMills: 1100, vibestrUsdMills: 1000 },
    'prize-games-10':     { usdMills: 1850, vibestrUsdMills: 1670 },
};

async function buildSnapshot() {
    const ethUsdMills = await getEthUsdMills();

    // Env override → pool read → hardcoded fallback.
    const envRaw = process.env.VIBESTR_USD_OVERRIDE;
    const envMills =
        envRaw && isFinite(parseFloat(envRaw)) && parseFloat(envRaw) > 0
            ? Math.round(parseFloat(envRaw) * 1000)
            : null;
    const sqrtPriceX96 = envMills === null ? await getVibestrSqrtPriceX96() : null;
    const vibestrUsdMills =
        envMills ??
        (sqrtPriceX96 !== null
            ? vibestrUsdMillsFromSlot0(sqrtPriceX96, ethUsdMills)
            : VIBESTR_USDC_FALLBACK_MILLS);

    const packages = {};
    for (const [id, anchors] of Object.entries(PACKAGES)) {
        // Live pool read → precise wei from sqrtPriceX96. Otherwise
        // route through the mill-rounded price. VIBESTR still ceils
        // to whole tokens either way so the display number is clean
        // and we never under-charge.
        const rawVibestrWei =
            sqrtPriceX96 !== null
                ? vibestrWeiFromSlot0(anchors.vibestrUsdMills, ethUsdMills, sqrtPriceX96, VIBESTR_DECIMALS)
                : BigInt(weiForUsd(anchors.vibestrUsdMills, vibestrUsdMills, VIBESTR_DECIMALS));
        const vibestrWei = ceilToWholeToken(rawVibestrWei, VIBESTR_DECIMALS).toString();
        packages[id] = {
            usdMills: anchors.usdMills,
            vibestrUsdMills: anchors.vibestrUsdMills,
            vibestrWei,
            usdcWei:    weiForUsd(anchors.usdMills,         USDC_USD_MILLS,   USDC_DECIMALS),
            ethWei:     weiForUsd(anchors.usdMills,         ethUsdMills,      ETH_DECIMALS),
        };
    }
    return {
        updatedAt: Math.floor(Date.now() / 1000),
        ethUsdMills,
        vibestrUsdMills,
        packages,
    };
}

// ── Main ──────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const preview = args.has('--preview');
const kvKey = preview ? 'pricing:packages:preview' : 'pricing:packages';

console.log(`refresh-pricing ${apply ? '--apply' : '(dry run)'} → ${kvKey}\n`);
const snapshot = await buildSnapshot();
console.log(`ETH/USD: $${(snapshot.ethUsdMills / 1000).toFixed(2)}`);
console.log(`VIBESTR/USD: $${(snapshot.vibestrUsdMills / 1000).toFixed(4)}`);
console.log('Packages:');
for (const [id, p] of Object.entries(snapshot.packages)) {
    console.log(`  ${id.padEnd(22)} usd=$${(p.usdMills/1000).toFixed(3)} | vibestr=$${(p.vibestrUsdMills/1000).toFixed(3)} (10% off)`);
    console.log(`    vibestrWei=${p.vibestrWei}`);
    console.log(`    usdcWei=   ${p.usdcWei}`);
    console.log(`    ethWei=    ${p.ethWei}`);
}

if (!apply) {
    console.log('\nDry-run. Pass --apply to write to KV.');
    console.log(`(--preview writes to pricing:packages:preview; omit for production key.)`);
    process.exit(0);
}

console.log(`\nWriting to KV key: ${kvKey} ...`);
await kvSet(kvKey, snapshot);
console.log('Done.');
