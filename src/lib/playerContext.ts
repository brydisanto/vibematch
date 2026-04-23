import { BADGES, type BadgeTier } from './badges';
import type { PlayerContext } from './achievements';

const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));

/**
 * Build a PlayerContext from stored pinbook state.
 * Single source of truth — used by page.tsx, achievements API, etc.
 *
 * `totalFoundByTier` is the authoritative lifetime-find counter; when
 * it's missing (legacy pinbook) we backfill from current held counts
 * so the new tier-find achievements have a sane starting value for
 * existing players.
 */
export function buildPlayerContext(
    pins: Record<string, { count: number; firstEarned?: string }>,
    opts?: {
        totalPinsOpened?: number;
        streak?: number;
        gamesPlayedToday?: number;
        referralCount?: number;
        hasUploadedAvatar?: boolean;
        hasChangedMusic?: boolean;
        hasPurchasedPrizeGame?: boolean;
        hasVibestrWallet?: boolean;
        /** Lifetime per-tier pin-find counters from pinbook.totalFoundByTier. */
        totalFoundByTier?: Partial<Record<BadgeTier, number>>;
    }
): PlayerContext {
    const ctx: PlayerContext = {
        streak: opts?.streak || 0,
        uniquePins: Object.keys(pins).length,
        totalPinsOpened: opts?.totalPinsOpened || 0,
        hasSilverPin: false,
        hasGoldPin: false,
        hasSpecialPin: false,
        hasCosmicPin: false,
        commonPinCount: 0,
        rarePinCount: 0,
        specialPinCount: 0,
        legendaryPinCount: 0,
        cosmicPinCount: 0,
        totalFoundCommon: 0,
        totalFoundRare: 0,
        totalFoundSpecial: 0,
        totalFoundLegendary: 0,
        totalFoundCosmic: 0,
        gamesPlayedToday: opts?.gamesPlayedToday || 0,
        referralCount: opts?.referralCount || 0,
        hasUploadedAvatar: !!opts?.hasUploadedAvatar,
        hasChangedMusic: !!opts?.hasChangedMusic,
        hasPurchasedPrizeGame: !!opts?.hasPurchasedPrizeGame,
        hasVibestrWallet: !!opts?.hasVibestrWallet,
    };

    // Per-tier held / flag counts from the pins object (unique pins).
    for (const badgeId of Object.keys(pins)) {
        const tier = badgeTierMap.get(badgeId);
        if (tier === 'blue') ctx.commonPinCount++;
        if (tier === 'silver') { ctx.hasSilverPin = true; ctx.rarePinCount++; }
        if (tier === 'special') { ctx.hasSpecialPin = true; ctx.specialPinCount++; }
        if (tier === 'gold') { ctx.hasGoldPin = true; ctx.legendaryPinCount++; }
        if (tier === 'cosmic') { ctx.hasCosmicPin = true; ctx.cosmicPinCount++; }
    }

    // Lifetime per-tier finds. If the authoritative counter is present,
    // use it. Otherwise backfill from the current held-count sum so
    // pre-existing accounts get credit for pins they currently hold.
    const found = opts?.totalFoundByTier;
    if (found) {
        ctx.totalFoundCommon = found.blue || 0;
        ctx.totalFoundRare = found.silver || 0;
        ctx.totalFoundSpecial = found.special || 0;
        ctx.totalFoundLegendary = found.gold || 0;
        ctx.totalFoundCosmic = found.cosmic || 0;
    } else {
        for (const [badgeId, entry] of Object.entries(pins)) {
            const tier = badgeTierMap.get(badgeId);
            const c = entry?.count || 0;
            if (tier === 'blue') ctx.totalFoundCommon += c;
            else if (tier === 'silver') ctx.totalFoundRare += c;
            else if (tier === 'special') ctx.totalFoundSpecial += c;
            else if (tier === 'gold') ctx.totalFoundLegendary += c;
            else if (tier === 'cosmic') ctx.totalFoundCosmic += c;
        }
    }

    return ctx;
}
