import { Badge, BADGES } from "./badges";
import { Cell, GameState, Position, Match } from "./gameEngine";

// ---------------------------------------------------------------------------
// Cinematic Mode
// ---------------------------------------------------------------------------
// Deterministic 8x8 board + scripted move sequence for capturing trailer
// footage. First move creates a 5-badge cosmic match -> cosmic_blast special.
// Second move (double-tap center of 5-match) detonates cosmic_blast for a
// game-wide wipe. After moves, score is forced above the capsule threshold
// and a cosmic capsule reveal is shown.
// ---------------------------------------------------------------------------

const BOARD_SIZE = 8;
let cinematicCellId = 0;
const nextId = () => `cine_${cinematicCellId++}`;

// Ordered badge picks: [0]=cosmic, [1]=gold, [2]=silver, [3-5]=blue
// Falls back gracefully if a badge is missing from the registry.
function pickBadge(id: string, fallbackTier: Badge["tier"]): Badge {
    const byId = BADGES.find(b => b.id === id && !b.collectOnly);
    if (byId) return byId;
    const byTier = BADGES.find(b => b.tier === fallbackTier && !b.collectOnly);
    if (!byTier) throw new Error(`No badge for tier ${fallbackTier}`);
    return byTier;
}

export function pickCinematicBadges(): Badge[] {
    // Order: cosmic, gold, silver, blue, blue, blue
    return [
        pickBadge("cosmic_guardian", "cosmic"),   // A - the hero (5-match target)
        pickBadge("astro_balls", "gold"),          // B
        pickBadge("rainbow_boombox", "silver"),    // C
        pickBadge("any_gvc", "blue"),              // D
        pickBadge("funky_fresh", "blue"),          // E
        pickBadge("gradient_lover", "blue"),       // F
    ];
}

// Deterministic pattern function: (2*row + col) % 6 yields no 3-in-a-row
// horizontally (six unique badges) and no 3-in-a-column (row stride of 2
// creates cycle of length 3 in each column — no consecutive repeats).
function patternIndex(row: number, col: number): number {
    return (2 * row + col) % 6;
}

export function createCinematicBoard(badges: Badge[]): Cell[][] {
    const board: Cell[][] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = {
                badge: badges[patternIndex(row, col)],
                id: nextId(),
            };
        }
    }

    // Patch row 4 to set up the 5-match: A A F A A E F B
    // Pattern row 4 was: F B C A D E F B.
    // After patch, swapping (3,2)->(4,2) turns row 4 cols 0..4 into A A A A A.
    const A = badges[0];  // cosmic hero
    const F = badges[5];  // blue filler
    const E = badges[4];
    const B = badges[1];
    board[4][0] = { badge: A, id: nextId() };
    board[4][1] = { badge: A, id: nextId() };
    board[4][2] = { badge: F, id: nextId() };  // the gap — will become A after swap
    board[4][3] = { badge: A, id: nextId() };
    board[4][4] = { badge: A, id: nextId() };
    board[4][5] = { badge: E, id: nextId() };
    board[4][6] = { badge: F, id: nextId() };
    board[4][7] = { badge: B, id: nextId() };

    // Ensure (3,2) is A (the tile we swap DOWN into row 4 col 2).
    // Pattern (3,2) = (2*3+2)%6 = 8%6 = 2 = C (silver). Override to A.
    board[3][2] = { badge: A, id: nextId() };

    // Ensure the vertical column at col 2 has no 3-A's
    // Col 2: row 0=(2), 1=(4), 2=(0)=A!, 3=(2)=overridden to A, 4=F, 5=(2)=C, 6=(2)=F, 7=(4)=A
    // Problem: (2,2)=A and (3,2)=A makes 2-A vertically in col 2. After swap (4,2)=A.
    // Then col 2 has A at rows 2,3,4 -> vertical 3-match. That's fine for the cascade
    // but causes an INITIAL match at rows 2,3 neighborhood if (1,2)=A. Let's check.
    // (1,2): pattern (2*1+2)%6 = 4 = E. So col 2 top-to-bottom: D,E,A,A,F,C,F,A.
    // No initial 3-in-a-column. But need to override (2,2) since it was pattern index 0 = A.
    // Actually we WANT (2,2) to NOT be A so there's no initial match. Override to F.
    board[2][2] = { badge: F, id: nextId() };

    // Also verify (4,7) = B, (5,7) = (2*5+7)%6 = 17%6 = 5 = F — ok
    // And row 3: (3,0)=D,(3,1)=E,(3,2)=A (patched),(3,3)=B,(3,4)=C,(3,5)=A,(3,6)=D,(3,7)=E
    // (3,5) = (2*3+5)%6 = 11%6 = 5 = F. Not A. Check OK.
    // Row 5 col 1: (2*5+1)%6 = 11%6 = 5 = F. Not A. So (4,1)=A and (5,1)=F. No vertical.

    return board;
}

export function createCinematicState(): GameState {
    const gameBadges = pickCinematicBadges();
    const board = createCinematicBoard(gameBadges);
    return {
        board,
        score: 0,
        movesLeft: 30,
        combo: 0,
        maxCombo: 0,
        comboCarry: 0,
        selectedTile: null,
        gameBadges,
        gameMode: "classic",
        gamePhase: "playing",
        matchCount: 0,
        totalCascades: 0,
        dailySeed: undefined,
        gameOverReason: null,
        bonusCapsuleAwarded: false,
    };
}

// ---------------------------------------------------------------------------
// Move script. Each entry runs at tMs after cinematic state is loaded.
// ---------------------------------------------------------------------------

export interface CinematicMove {
    tMs: number;
    kind: "swipe" | "tap-special" | "show-capsule" | "tap-capsule" | "end";
    from?: Position;
    to?: Position;
    target?: Position;
}

export const CINEMATIC_SCRIPT: CinematicMove[] = [
    // t=1.4s — Swipe (3,2) down into (4,2). Creates horizontal 5-match on
    // row 4 cols 0-4, which yields a cosmic_blast special at the middle (4,2).
    { tMs: 1400, kind: "swipe", from: { row: 3, col: 2 }, to: { row: 4, col: 2 } },

    // t=5.2s — Cascade from move 1 has settled. Double-tap (4,2) to activate
    // the cosmic_blast special: clears every tile of the cosmic badge on the
    // board + another massive cascade.
    { tMs: 5200, kind: "tap-special", target: { row: 4, col: 2 } },

    // t=9.0s — After blast settles, force a capsule reveal. The cinematic
    // hook overrides score to push past 15K if it hasn't organically.
    { tMs: 9000, kind: "show-capsule" },

    // Capsule auto-advance is handled by VibeCapsule's autoAdvanceMs prop,
    // which the AppClient passes on the cinematic capsule. That triggers
    // crack -> reveal at t ≈ 12.2s (9s show + 3.2s auto-advance).

    // t=22s — Sequence complete. Main harness stops recording here.
    { tMs: 22000, kind: "end" },
];

// Badge to show in the cinematic capsule reveal — use the cosmic hero so
// the shell + glow match the tier most dramatic for trailer footage.
export function cinematicCapsuleBadge(): { badge: Badge; tier: Badge["tier"] } {
    const badge = pickBadge("cosmic_guardian", "cosmic");
    return { badge, tier: "cosmic" };
}

// Utility: detect whether the current URL has cinematic mode active.
export function isCinematicMode(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get("cinematic") === "1";
    } catch {
        return false;
    }
}
