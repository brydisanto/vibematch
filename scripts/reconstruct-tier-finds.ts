/**
 * One-off: reconstruct `pinbook.totalFoundByTier` for a target username
 * by summing current held counts + historical reroll burns from
 * `tx:*:processed` records. Fills the lifetime-find gap the automatic
 * backfill can't cover (it only sees current holdings).
 *
 * Usage: tsx scripts/reconstruct-tier-finds.ts <username>
 */
import { kv } from "@vercel/kv";
import { BADGES, type BadgeTier } from "../src/lib/badges";

const username = (process.argv[2] || "").toLowerCase().trim();
if (!username) {
    console.error("Usage: tsx scripts/reconstruct-tier-finds.ts <username>");
    process.exit(1);
}

const tierOf = new Map(BADGES.map(b => [b.id, b.tier]));

async function main() {
    const pinKey = `pinbook:${username}`;
    const pinbook = await kv.get(pinKey) as {
        pins: Record<string, { count: number }>;
        totalFoundByTier?: Partial<Record<BadgeTier, number>>;
    } | null;

    if (!pinbook) {
        console.error(`No pinbook for ${username}`);
        process.exit(1);
    }

    const held: Record<BadgeTier, number> = { blue: 0, silver: 0, special: 0, gold: 0, cosmic: 0 };
    for (const [id, entry] of Object.entries(pinbook.pins || {})) {
        const t = tierOf.get(id);
        if (!t) continue;
        held[t] += entry?.count || 0;
    }

    // Sum burns across all finalized reroll txs for this user.
    const burns: Record<BadgeTier, number> = { blue: 0, silver: 0, special: 0, gold: 0, cosmic: 0 };
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const [next, batch] = await kv.scan(cursor, { match: "tx:*:processed", count: 200 }) as [string | number, string[]];
        cursor = next;
        keys.push(...batch);
        if (keys.length > 10000) break;
    } while (cursor !== 0 && cursor !== "0");

    let matchedTxs = 0;
    for (const k of keys) {
        const raw = await kv.get(k);
        if (!raw) continue;
        const rec = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (rec.type !== "reroll" || rec.username !== username || rec.status !== "finalized") continue;
        matchedTxs++;
        for (const b of rec.burns || []) {
            if (!b?.tier) continue;
            burns[b.tier as BadgeTier] += b.pinsNeeded || 0;
        }
    }

    const reconstructed: Record<BadgeTier, number> = {
        blue: held.blue + burns.blue,
        silver: held.silver + burns.silver,
        special: held.special + burns.special,
        gold: held.gold + burns.gold,
        cosmic: held.cosmic + burns.cosmic,
    };

    const before = pinbook.totalFoundByTier;
    const next = { ...(pinbook as object), totalFoundByTier: reconstructed };
    await kv.set(pinKey, next);

    console.log(JSON.stringify({
        username,
        rerollTxsFound: matchedTxs,
        held,
        burns,
        reconstructed,
        before,
    }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
