// Collection tier derived from pin-collection percentage. Used in profile pills,
// leaderboard rows, and anywhere we want to label a player's collection status.

export type TierId =
    | "rookie"
    | "pro_plastic"
    | "big_vibes"
    | "all_gold"
    | "shadow_funk"
    | "cosmic"
    | "one_of_one";

export interface TierInfo {
    id: TierId;
    label: string;
    // Primary color used for tier pills / text.
    color: string;
    // Darker accent used for shadow / rim.
    accent: string;
    // Inclusive lower bound of the percentage band (0–100).
    minPercent: number;
}

// Ordered highest → lowest so a simple .find() picks the first matching tier.
const TIERS: TierInfo[] = [
    { id: "one_of_one", label: "One-Of-One", color: "#FFFFFF",   accent: "#A8A8A8", minPercent: 100 },
    { id: "cosmic",     label: "Cosmic",     color: "#B366FF",   accent: "#6B1FC0", minPercent: 90 },
    { id: "shadow_funk",label: "Shadow Funk",color: "#D946EF",   accent: "#86198F", minPercent: 75 },
    { id: "all_gold",   label: "69K Gold",   color: "#FFE048",   accent: "#8B6914", minPercent: 50 },
    { id: "big_vibes",  label: "Big Vibes",  color: "#FFB547",   accent: "#B87333", minPercent: 25 },
    { id: "pro_plastic",label: "Pro Plastic",color: "#E5E7EB",   accent: "#6B7280", minPercent: 10 },
    { id: "rookie",     label: "Rookie",     color: "#9CA3AF",   accent: "#4B5563", minPercent: 0 },
];

/**
 * Returns the tier info for a given pin-collection percentage (0–100).
 * Clamps out-of-range values to the nearest band.
 */
export function getTier(percent: number): TierInfo {
    const p = Math.max(0, Math.min(100, percent));
    return TIERS.find(t => p >= t.minPercent) ?? TIERS[TIERS.length - 1];
}

/**
 * Convenience: compute tier from unique pin count + total available.
 */
export function getTierByCount(uniquePins: number, totalAvailable: number): TierInfo {
    if (totalAvailable <= 0) return TIERS[TIERS.length - 1];
    return getTier((uniquePins / totalAvailable) * 100);
}

/**
 * Full tier list, in display order (lowest → highest) — useful for legends.
 */
export function getAllTiers(): TierInfo[] {
    return [...TIERS].reverse();
}
