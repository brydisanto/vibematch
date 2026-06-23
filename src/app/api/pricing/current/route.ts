/**
 * GET /api/pricing/current
 *
 * Returns the active PricingSnapshot for client display. Cached briefly
 * at the edge so a logged-out player loading the landing page doesn't
 * hammer KV — the snapshot only changes once per cron refresh anyway.
 */

import { NextResponse } from 'next/server';
import { getPricingSnapshot } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const snapshot = await getPricingSnapshot();
        return NextResponse.json(snapshot, {
            headers: {
                // The cron refreshes daily; serving a 30s edge cache is
                // safe and shields KV from modal mount thunder.
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            },
        });
    } catch (e) {
        console.error('[pricing/current] error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
