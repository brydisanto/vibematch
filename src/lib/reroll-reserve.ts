import { BADGES, type BadgeTier } from "./badges";

/**
 * How much reroll "fuel" a player is sitting on. Duplicates of a base badge
 * beyond the first are burnable (the reroll always keeps >=1 of each). The
 * reroll burn cost per capsule differs by tier, so the number of rerolls this
 * reserve is actually worth is the sum of floor(burnable / cost) per tier.
 *
 * Mirrors BURN_COST + getBurnableDuplicates in RerollModal. Used by the
 * one-time reroll-reserve nudge (AppClient) to decide whether a player has
 * enough dry powder to be worth prompting.
 */
const BURN_COST: Record<BadgeTier, number> = { blue: 5, silver: 4, special: 3, gold: 2, cosmic: 1 };

export function rerollReserve(
    pins: Record<string, { count: number }>,
): { burnableDupes: number; rerolls: number } {
    const tierMap = new Map(BADGES.map((b) => [b.id, b.tier]));
    const perTier: Record<BadgeTier, number> = { blue: 0, silver: 0, special: 0, gold: 0, cosmic: 0 };
    let burnableDupes = 0;
    for (const [id, data] of Object.entries(pins)) {
        const tier = tierMap.get(id);
        if (!tier) continue;
        const burnable = Math.max(0, (data.count || 0) - 1);
        if (burnable > 0) {
            perTier[tier] += burnable;
            burnableDupes += burnable;
        }
    }
    const rerolls = (Object.keys(perTier) as BadgeTier[]).reduce(
        (sum, tier) => sum + Math.floor(perTier[tier] / BURN_COST[tier]),
        0,
    );
    return { burnableDupes, rerolls };
}
