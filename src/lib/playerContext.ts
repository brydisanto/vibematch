import { BADGES, type BadgeTier } from './badges';
import type { PlayerContext } from './achievements';

const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));

/**
 * Build a PlayerContext from stored pinbook state.
 * Single source of truth — used by page.tsx, achievements API, etc.
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
        gamesPlayedToday: opts?.gamesPlayedToday || 0,
        referralCount: opts?.referralCount || 0,
        hasUploadedAvatar: !!opts?.hasUploadedAvatar,
        hasChangedMusic: !!opts?.hasChangedMusic,
        hasPurchasedPrizeGame: !!opts?.hasPurchasedPrizeGame,
        hasVibestrWallet: !!opts?.hasVibestrWallet,
    };

    for (const badgeId of Object.keys(pins)) {
        const tier = badgeTierMap.get(badgeId);
        if (tier === 'blue') ctx.commonPinCount++;
        if (tier === 'silver') { ctx.hasSilverPin = true; ctx.rarePinCount++; }
        if (tier === 'special') { ctx.hasSpecialPin = true; ctx.specialPinCount++; }
        if (tier === 'gold') { ctx.hasGoldPin = true; ctx.legendaryPinCount++; }
        if (tier === 'cosmic') { ctx.hasCosmicPin = true; ctx.cosmicPinCount++; }
    }

    return ctx;
}
