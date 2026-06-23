/**
 * GET /api/admin/pricing/refresh
 *
 * Vercel Cron target. Reads current ETH/USD + VIBESTR/USD, builds a
 * PricingSnapshot, writes it to KV. Returns the snapshot so the cron
 * logs show what was applied.
 *
 * Auth: Bearer token in Authorization header must match CRON_SECRET.
 * Vercel attaches this header automatically on cron-triggered
 * requests as long as CRON_SECRET is set in the project's env vars.
 *
 * Set the cadence in vercel.json (currently daily at 8:00 UTC =
 * 4 AM ET).
 *
 * Manual trigger (e.g. after a sudden VIBESTR price move):
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://pindropgame.com/api/admin/pricing/refresh
 */

import { NextResponse } from 'next/server';
import {
    refreshPricingSnapshot,
    buildPricingSnapshot,
} from '@/lib/pricing-refresh';
import { invalidatePricingCache, pricingKvKey } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('[pricing/refresh] CRON_SECRET not set — refusing to run');
        return false;
    }
    const auth = req.headers.get('authorization') || '';
    return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
    if (!authorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const url = new URL(req.url);
        // ?dry=1 lets you preview without writing — handy for spot-checking
        // current market math from an admin shell without the cron firing.
        const isDry = url.searchParams.get('dry') === '1';
        if (isDry) {
            const snapshot = await buildPricingSnapshot();
            return NextResponse.json({ applied: false, key: pricingKvKey(), snapshot });
        }
        const snapshot = await refreshPricingSnapshot();
        // Drop the local module cache so the next read on this serverless
        // instance sees the new snapshot immediately.
        invalidatePricingCache();
        console.log(`[pricing/refresh] OK → ${pricingKvKey()}; eth=$${snapshot.ethUsdMills/1000} vibestr=$${snapshot.vibestrUsdMills/1000}`);
        return NextResponse.json({ applied: true, key: pricingKvKey(), snapshot });
    } catch (e) {
        console.error('[pricing/refresh] error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
