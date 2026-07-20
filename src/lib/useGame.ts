"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
    GameState,
    GameMode,
    Position,
    TurnResult,
    Cell,
    MoveLogEntry,
    MoveAction,
    CLASSIC_MOVES,
    createInitialState,
    isAdjacentSwap,
    processTurn,
    triggerSpecialTile,
    hasValidMoves,
    findBestHint,
    computeFrenzyBonusMs,
    FRENZY_INITIAL_MS,
    FRENZY_MAX_MS,
    FRENZY_HEAT_WINDOW_MS,
    FRENZY_HEAT_TRIGGER_COUNT,
    FRENZY_HEAT_DURATION_MS,
} from "./gameEngine";
import { Badge } from "./badges";
import {
    playSelectSound,
    playDeselectSound,
    playInvalidSwapSound,
    playMatchSound,
    playBombSound,
    playCosmicBlastSound,
    playVibestreakSound,
    playGameOverSound,
    playCascadeSound,
    playShapeBonusSound,
    playHintSound,
    playFinalMoveWarning,
    playGameStartSound,
    playTileLandSound,
    startFrenzyBGM,
    stopFrenzyBGM,
    setFrenzyTempo,
    playFrenzyTick,
    playFrenzyFinalTick,
    playFrenzyPenaltySound,
} from "./sounds";

export interface ScorePopup {
    id: string;
    value: number;
    x: number;
    y: number;
    combo: number;
}

/** Flying -1 SECOND bubble used to visualize a Frenzy invalid-swap
 *  penalty. Pops at the midpoint of the two attempted swap cells,
 *  then flies to the HUD timer (sibling animation to ScorePopup). */
export interface TimePenaltyPopup {
    id: string;
    x: number; // board col, fractional (0..7)
    y: number; // board row, fractional (0..7)
}

// Intensity level for match effects — drives animations + haptics
export type MatchIntensity = "normal" | "big" | "mega" | "ultra";

export interface MatchEffect {
    intensity: MatchIntensity;
    scoreGained: number;
    combo: number;
    maxMatchSize: number;
    positions: { row: number; col: number }[];
    timestamp: number;
    cascadeCount: number;
    shapeBonusType?: 'L' | 'T' | 'cross' | null;
    matchedBadgeName?: string;
    /** Tier of the dominant matched badge — drives particle color in
     *  MatchParticles so the burst tells the player WHICH tier they
     *  popped without reading any text. */
    matchedBadgeTier?: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special';
    bonusCapsuleTriggered?: boolean;
    /** Power tiles spawned this turn (from 4+ matches) — drives the
     *  big "BOMB CREATED" / "LASER PARTY" / "COSMIC BLAST" slam-in
     *  label + ring at the spawn position. */
    specialTilesCreated?: { pos: { row: number; col: number }; type: 'bomb' | 'vibestreak' | 'cosmic_blast' }[];
    /** Power tiles that detonated this turn — drives the tinted full-
     *  screen flash (red for bomb, cyan for laser, purple for cosmic). */
    specialTilesTriggered?: { pos: { row: number; col: number }; type: 'bomb' | 'vibestreak' | 'cosmic_blast' }[];
}

export interface UseGameReturn {
    state: GameState | null;
    scorePopups: ScorePopup[];
    lastTurnResult: TurnResult | null;
    matchEffect: MatchEffect | null;
    isAnimating: boolean;
    hintCells: Set<string>;
    hintMessage: string | null;
    invalidSwapCells: { row: number; col: number }[] | null;
    swapAnim: { pos1: Position; pos2: Position } | null;
    /** Timestamp of the most recent Frenzy time penalty (invalid swap
     *  cost the player 1 second of clock). GameBoard subscribes to this
     *  to render a red flash overlay when it changes. Null = no recent
     *  penalty. Resets to null ~600ms after firing. */
    frenzyPenaltyAt: number | null;
    /** Active "-1 SECOND" bubbles flying from the invalid swap to the
     *  HUD timer. One pushed per invalid swap; auto-cleared after the
     *  flight animation. */
    timePenaltyPopups: TimePenaltyPopup[];
    selectTile: (pos: Position) => void;
    swipeTiles: (from: Position, to: Position) => void;
    /** Resolves once the initial board state has been set so callers can
     *  defer the view switch and avoid flashing an empty grid while
     *  badge images preload. */
    startGame: (mode: GameMode, opts?: { seed?: number }) => Promise<void>;
    startGameWithBadges: (mode: GameMode, badges: Badge[], opts?: { seed?: number }) => Promise<void>;
    resetGame: (opts?: { seed?: number }) => Promise<void>;
    /** Behavioral telemetry callbacks. recordEventTrust is invoked by
     *  GameBoard's pointerDown handler to flag synthetic inputs.
     *  getBehavioralMeta is called at game-over to bundle the per-game
     *  signals into the logGame payload. */
    recordEventTrust: (trusted: boolean) => void;
    getBehavioralMeta: () => { webdriver: boolean; untrustedEvents: number; gameDurationMs: number };
}

function getIntensity(score: number, combo: number, maxMatchSize: number): MatchIntensity {
    if (maxMatchSize >= 5 || combo >= 4 || score >= 1500) return "ultra";
    if (maxMatchSize >= 4 || combo >= 3 || score >= 800) return "mega";
    if (combo >= 2 || score >= 400) return "big";
    return "normal";
}

export function useGame(): UseGameReturn {
    const [state, setState] = useState<GameState | null>(null);
    const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
    const [lastTurnResult, setLastTurnResult] = useState<TurnResult | null>(null);
    const [matchEffect, setMatchEffect] = useState<MatchEffect | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [hintCells, setHintCells] = useState<Set<string>>(new Set());
    const [invalidSwapCells, setInvalidSwapCells] = useState<{ row: number; col: number }[] | null>(null);
    // Timestamp of most recent Frenzy time-penalty. Drives the red flash
    // overlay in GameBoard. Cleared ~600ms after the penalty so a single
    // invalid swap doesn't keep flashing indefinitely.
    const [frenzyPenaltyAt, setFrenzyPenaltyAt] = useState<number | null>(null);
    // Flying "-1 SECOND" bubbles. One pushed per invalid Frenzy swap;
    // cleared 1.6s later after the fly-to-timer animation finishes.
    const [timePenaltyPopups, setTimePenaltyPopups] = useState<TimePenaltyPopup[]>([]);
    const [swapAnim, setSwapAnim] = useState<{ pos1: Position; pos2: Position } | null>(null);
    const [hintMessage, setHintMessage] = useState<string | null>(null);
    const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hintMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hintShownThisGame = useRef(false);
    const popupCounter = useRef(0);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // Behavioral telemetry — captured per game, sent with logGame. Lets
    // the server compute timing distributions + flag synthetic-input
    // signatures without us streaming every event. All three reset at
    // game start (applyStartState below).
    const gameStartMsRef = useRef<number>(0);
    const untrustedEventsRef = useRef<number>(0);
    const webdriverRef = useRef<boolean>(false);

    // Read the active tap's trust flag. Browser InputEvents set
    // isTrusted: true; programmatic dispatchEvent / Synthetic events
    // set false. We stash it on a ref during the pointerDown handler
    // (which fires before click), then read it when the move resolves.
    const lastEventTrustedRef = useRef<boolean | null>(null);
    // Mobile no-ops the entire telemetry pipeline. Even though each
    // individual hook is cheap (a ref read + write, plus one
    // performance.now() per move), they cross the GameBoard ->
    // AppClient -> useGame component boundary on every pointerDown
    // and every move resolve. On low-end phones the cross-boundary
    // calls + extra MoveAction field allocation showed up as
    // measurable per-input overhead. Desktop keeps the full telemetry
    // because the perf headroom is there and bot-detection signal is
    // primarily a desktop-attacker concern anyway.
    const recordTrust = useCallback((trusted: boolean) => {
        if (isMobile) return;
        lastEventTrustedRef.current = trusted;
        if (!trusted) untrustedEventsRef.current += 1;
    }, [isMobile]);
    const consumeMoveMeta = useCallback((): { t?: number; trusted?: boolean } => {
        if (isMobile) return {};
        const t = gameStartMsRef.current > 0 ? Math.round(performance.now() - gameStartMsRef.current) : 0;
        // Default to trusted=true when no event was captured (e.g., automation
        // tests / replay-driven UIs); flag a real synthetic input only when
        // the pointerDown handler explicitly recorded false.
        const trusted = lastEventTrustedRef.current !== false;
        lastEventTrustedRef.current = null;
        return { t, trusted };
    }, [isMobile]);

    const resetHintTimer = useCallback((board: Cell[][]) => {
        if (hintTimer.current) clearTimeout(hintTimer.current);
        if (hintMessageTimer.current) clearTimeout(hintMessageTimer.current);
        setHintCells(new Set());
        setHintMessage(null);

        // Only show hint once per game
        if (hintShownThisGame.current) return;

        // Hint highlight at 8 seconds of idle
        hintTimer.current = setTimeout(() => {
            const hint = findBestHint(board);
            if (hint) {
                setHintCells(new Set([
                    `${hint.pos1.row},${hint.pos1.col}`,
                    `${hint.pos2.row},${hint.pos2.col}`,
                ]));
                playHintSound();
                hintShownThisGame.current = true;
            }
        }, 8000);
    }, []);

    // Fire a Frenzy time penalty: subtract 1s from the clock, set the
    // penalty timestamp so GameBoard can render its red flash, play the
    // descending sting, and emit a flying "-1 SECOND" bubble at the
    // midpoint of the two attempted swap cells. No-op outside Frenzy or
    // before the clock arms (the first swap of the game). Capped so the
    // clock can't go below "about to expire" — a player about to lose
    // anyway shouldn't get a "free" penalty (the natural game-over
    // fires immediately).
    const FRENZY_PENALTY_MS = 1000;
    const FRENZY_PENALTY_FLASH_MS = 600;
    const FRENZY_PENALTY_BUBBLE_MS = 1600;
    const firePenaltyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fireFrenzyPenalty = useCallback((a: Position, b: Position) => {
        // Call sites gate by mode === "frenzy" already; this helper
        // assumes Frenzy. The setState updater protects the time
        // deduction against the edge case where the clock hasn't armed
        // yet (first valid match arms frenzyEndsAt).
        setState(prev => {
            if (!prev || prev.gameMode !== "frenzy") return prev;
            if (prev.frenzyEndsAt === null) return prev;
            const newEndsAt = Math.max(Date.now(), prev.frenzyEndsAt - FRENZY_PENALTY_MS);
            return { ...prev, frenzyEndsAt: newEndsAt };
        });
        playFrenzyPenaltySound();
        setFrenzyPenaltyAt(Date.now());
        if (firePenaltyTimer.current) clearTimeout(firePenaltyTimer.current);
        firePenaltyTimer.current = setTimeout(() => setFrenzyPenaltyAt(null), FRENZY_PENALTY_FLASH_MS);

        // Push the flying bubble at the midpoint of the two attempted
        // swap cells. Emitted unconditionally because the call sites
        // already gate on mode === "frenzy".
        popupCounter.current += 1;
        const id = `tp_${popupCounter.current}`;
        const popup: TimePenaltyPopup = {
            id,
            x: (a.col + b.col) / 2,
            y: (a.row + b.row) / 2,
        };
        setTimePenaltyPopups(prev => [...prev, popup]);
        setTimeout(() => {
            setTimePenaltyPopups(prev => prev.filter(p => p.id !== id));
        }, FRENZY_PENALTY_BUBBLE_MS);
    }, []);

    const preloadBadgeImages = useCallback((badges: Badge[]): Promise<void> => {
        // Tiles render with a plain <img>, not Next's optimizer. So we only
        // need to warm the cache for the raw badge URL — the prior dual-URL
        // fetch (raw + /_next/image?...) was paying for an optimizer URL the
        // <img> never actually requests, doubling network work for no benefit.
        // We use decode() rather than just onload so the bitmap is decoded
        // and ready to paint the moment the board mounts. Without decode(),
        // tiles can render briefly empty while the browser does the decode
        // step on first paint.
        const seen = new Set<string>();
        const promises: Promise<void>[] = [];
        for (const badge of badges) {
            if (seen.has(badge.image)) continue;
            seen.add(badge.image);
            const img = new window.Image();
            img.src = badge.image;
            const p = img.decode
                ? img.decode().catch(() => undefined)
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            promises.push(Promise.resolve(p).then(() => undefined));
        }
        return Promise.all(promises).then(() => {});
    }, []);

    const applyStartState = useCallback((initialState: GameState) => {
        setState(initialState);
        setScorePopups([]);
        setLastTurnResult(null);
        setMatchEffect(null);
        setIsAnimating(false);
        setHintMessage(null);
        hintShownThisGame.current = false;
        // Reset behavioral telemetry for this match. WebDriver flag is
        // sticky across the session (browsers don't toggle it mid-game),
        // but timing + untrusted counters restart per game.
        gameStartMsRef.current = performance.now();
        untrustedEventsRef.current = 0;
        lastEventTrustedRef.current = null;
        webdriverRef.current = typeof navigator !== "undefined" && navigator.webdriver === true;
        resetHintTimer(initialState.board);
        playGameStartSound();
    }, [resetHintTimer]);

    const startGame = useCallback(async (mode: GameMode, opts?: { seed?: number }) => {
        // Server-issued seed (Phase 3 replay): when present, createInitialState
        // uses it instead of generating a fresh client-side RNG. This is the
        // only way the server can deterministically reconstruct the same
        // board layout + initial badge draw at score-validation time.
        // Falls back to current behavior when seed is undefined (e.g.,
        // legacy servers, Daily mode which derives its seed from the date).
        const initialState = createInitialState(mode, undefined, opts?.seed);
        await preloadBadgeImages(initialState.gameBadges);
        applyStartState(initialState);
        // Frenzy gets the urgency BGM treatment — forced Werq, sped up.
        if (mode === "frenzy") startFrenzyBGM();
    }, [preloadBadgeImages, applyStartState]);

    const startGameWithBadges = useCallback(async (mode: GameMode, badges: Badge[], opts?: { seed?: number }) => {
        // Vibe Draft mode — player has already drafted the badges; passing
        // both `badges` and `seed` lets the server replay deterministically
        // using the same draft + same RNG stream for refills.
        const initialState = createInitialState(mode, badges, opts?.seed);
        await preloadBadgeImages(initialState.gameBadges);
        applyStartState(initialState);
        if (mode === "frenzy") startFrenzyBGM();
    }, [preloadBadgeImages, applyStartState]);

    const resetGame = useCallback(async (opts?: { seed?: number }) => {
        hintShownThisGame.current = false;
        const mode = state?.gameMode ?? "classic";
        // Use the server-issued seed (if provided) so Play Again games can
        // be replay-verified the same way fresh starts are. Falls back to
        // legacy behavior when undefined.
        const s = createInitialState(mode, undefined, opts?.seed);
        await preloadBadgeImages(s.gameBadges);
        setState(s);
        resetHintTimer(s.board);
        setScorePopups([]);
        setLastTurnResult(null);
        setMatchEffect(null);
        setIsAnimating(false);
        setHintMessage(null);
        playGameStartSound();
    }, [state?.gameMode, resetHintTimer, preloadBadgeImages]);

    // Shared helper: apply a TurnResult to game state with effects
    /**
     * Hit-stop budget by match intensity. The board's actual state update
     * is deferred by this many ms after the impact effects fire, so the
     * player sees the matched tiles flash IN PLACE for a beat before they
     * dissolve into the cascade. Single most underrated juice trick — the
     * micro-pause makes mega+ matches feel weighty.
     */
    const getHitStopMs = useCallback((intensity: MatchIntensity): number => {
        if (intensity === "ultra") return 130;
        if (intensity === "mega") return 80;
        return 0;
    }, []);

    /**
     * Fires the immediate side-effects of a match result: sounds, haptic,
     * matchEffect (drives the visual flash + particles + ring burst),
     * score popup, and isAnimating=true. Returns the computed intensity
     * so the caller can decide hit-stop length.
     *
     * Split out from the state-update path so we can fire effects NOW
     * (during the swap-anim → settle window) but defer the actual board
     * state update by hit-stop ms on bigger matches. The board sits in
     * its post-swap state during the freeze, the flash plays on the
     * matched cells, then the cascade plays out.
     */
    const triggerMatchEffects = useCallback((
        result: TurnResult,
        effectPos: Position,
        costMove: boolean,
        prevMovesLeft: number,
        prevBonusCapsuleAwarded: boolean,
        scoreMultiplier: number = 1,
        gameMode: GameMode = "classic",
    ): MatchIntensity => {
        const newMovesLeft = costMove ? prevMovesLeft - 1 : prevMovesLeft;
        const realMatches = result.matchesFound.filter(m => m.positions.length <= 8);
        const maxMatchSize = realMatches.length > 0 ? Math.max(...realMatches.map(m => m.positions.length)) : 3;
        const allPositions = result.matchesFound.flatMap(m => m.positions);

        // Play match sounds (escalated)
        playMatchSound(result.scoreGained, result.combo, maxMatchSize);

        // Play sounds for special tiles that detonated (chain reactions)
        for (let i = 0; i < result.specialTilesTriggered.length; i++) {
            const special = result.specialTilesTriggered[i];
            setTimeout(() => {
                if (special.type === "bomb") playBombSound();
                else if (special.type === "cosmic_blast") playCosmicBlastSound();
                else if (special.type === "vibestreak") playVibestreakSound();
            }, 100 + i * 200);
        }

        // Play special tile creation sounds
        for (const special of result.specialTilesCreated) {
            setTimeout(() => {
                if (special.type === "bomb") playBombSound();
                else if (special.type === "cosmic_blast") playCosmicBlastSound();
                else if (special.type === "vibestreak") playVibestreakSound();
            }, 200);
        }

        // Play cascade sounds + tile land sounds
        if (result.cascadeCount > 0) {
            for (let i = 0; i < result.cascadeCount; i++) {
                setTimeout(() => playCascadeSound(i + 1), 250 + i * 150);
            }
            // Staggered tile land sounds after final cascade settles
            const landBase = 250 + result.cascadeCount * 150 + 200;
            for (let col = 0; col < 8; col++) {
                setTimeout(() => playTileLandSound(col), landBase + col * 35);
            }
        }

        // Play shape bonus sound
        if (result.shapeBonus?.type) {
            setTimeout(() => playShapeBonusSound(result.shapeBonus!.type), 150);
        }

        // Final move warning heartbeat — frenzy-only tension cue.
        // Was firing in Classic too, where the accelerating thump-thump
        // (0.8s → 0.5s → 0.3s gaps as movesLeft falls) reads as the BGM
        // changing tempo. Players found that confusing in Classic; the
        // urgency cue makes sense only on the time-pressure mode.
        if (costMove && newMovesLeft >= 1 && newMovesLeft <= 3 && gameMode !== "classic" && gameMode !== "daily") {
            setTimeout(() => playFinalMoveWarning(newMovesLeft), 600);
        }

        // Calculate match intensity for visual effects
        const intensity = getIntensity(result.scoreGained, result.combo, maxMatchSize);

        // Find the most common badge across all matches for flash + tinted
        // particles. Track tier alongside name so MatchParticles can color
        // the burst by the dominant matched tier (gold burst on a gold-tier
        // match, cosmic burst on cosmic, etc).
        const badgeCounts = new Map<string, { count: number; name: string; tier: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special' }>();
        for (const match of result.matchesFound) {
            const key = match.badge.id;
            const existing = badgeCounts.get(key);
            if (existing) {
                existing.count += match.positions.length;
            } else {
                badgeCounts.set(key, { count: match.positions.length, name: match.badge.name, tier: match.badge.tier });
            }
        }
        let matchedBadgeName: string | undefined;
        let matchedBadgeTier: 'blue' | 'silver' | 'gold' | 'cosmic' | 'special' | undefined;
        let highestCount = 0;
        for (const [, entry] of badgeCounts) {
            if (entry.count > highestCount) {
                highestCount = entry.count;
                matchedBadgeName = entry.name;
                matchedBadgeTier = entry.tier;
            }
        }

        // Check for T/cross bonus capsule (capped at 1 per game)
        const isBonusShape = result.shapeBonus?.type === 'T' || result.shapeBonus?.type === 'cross';
        const bonusCapsuleTriggered = isBonusShape && !prevBonusCapsuleAwarded;

        // Set match effect for board to consume
        setMatchEffect({
            intensity,
            scoreGained: result.scoreGained,
            combo: result.combo,
            maxMatchSize,
            positions: allPositions,
            timestamp: Date.now(),
            cascadeCount: result.cascadeCount,
            shapeBonusType: result.shapeBonus?.type ?? null,
            matchedBadgeName,
            matchedBadgeTier,
            bonusCapsuleTriggered,
            specialTilesCreated: result.specialTilesCreated.map(s => ({ pos: s.pos, type: s.type })),
            specialTilesTriggered: result.specialTilesTriggered,
        });

        // Haptic feedback on mobile
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            const pattern =
                intensity === "ultra" ? [50, 30, 80]
                    : intensity === "mega" ? [50]
                        : intensity === "big" ? [30]
                            : [15];
            navigator.vibrate(pattern);
        }

        // Clear match effect after animation. Power-tile creations hold
        // a floor of 1800ms — the creation ring + label start on a
        // ~0.45s settle delay (see PowerTileCreationMoment) and the
        // label alone runs 1.1s, so a 1200ms window would unmount it
        // mid-display.
        const baseClearMs = intensity === "ultra" ? 2400 : intensity === "mega" ? 1800 : 1200;
        const clearMs = result.specialTilesCreated.length > 0 ? Math.max(baseClearMs, 1800) : baseClearMs;
        setTimeout(() => setMatchEffect(null), clearMs);

        // Add score popup. scoreMultiplier surfaces Frenzy's heat 2x so
        // the floating number matches what the score tile actually adds.
        const popupId = `popup_${popupCounter.current++}`;
        setScorePopups((pops) => [
            ...pops,
            {
                id: popupId,
                value: Math.round(result.scoreGained * scoreMultiplier),
                x: effectPos.col,
                y: effectPos.row,
                combo: result.combo,
            },
        ]);

        // Remove popup after animation
        setTimeout(() => {
            setScorePopups((pops) => pops.filter((p) => p.id !== popupId));
        }, 2600);

        setLastTurnResult(result);

        // Start animation sequence — blocks new input until cascade settles.
        setIsAnimating(true);

        return intensity;
    }, []);

    /**
     * Pure state update for a turn result. No side effects — those fire
     * via triggerMatchEffects(). Returns the next GameState. Schedules
     * its own settle / game-over timers internally.
     */
    const applyResultState = useCallback((
        prev: GameState,
        result: TurnResult,
        costMove: boolean,
        scoreMultiplier: number = 1,
        moveAction?: MoveAction,
    ): GameState => {
        const isFrenzy = prev.gameMode === "frenzy";
        // Frenzy doesn't burn moves — the clock is the budget. Keeping
        // movesLeft static avoids the moves-exhausted gameover path.
        const newMovesLeft = isFrenzy ? prev.movesLeft : (costMove ? prev.movesLeft - 1 : prev.movesLeft);
        const adjustedScoreGained = Math.round(result.scoreGained * scoreMultiplier);
        const newScore = prev.score + adjustedScoreGained;
        const newMatchCount = prev.matchCount + result.matchesFound.length;
        const newMaxCombo = Math.max(prev.maxCombo, result.combo);

        // Build the move-log entry. Only resolved turns that consume a
        // move get logged — system-fired or zero-cost effects are skipped
        // so the log lines up with the player's actual decisions.
        let moveLogEntry: MoveLogEntry | null = null;
        if (costMove) {
            // Dominant matched tier this turn — picked by count so a 4-
            // match of cosmic dominates a 3-match of common.
            const tierCounts = new Map<string, { count: number; tier: MoveLogEntry['topTier']; name: string }>();
            for (const m of result.matchesFound) {
                const k = m.badge.id;
                const e = tierCounts.get(k);
                if (e) e.count += m.positions.length;
                else tierCounts.set(k, { count: m.positions.length, tier: m.badge.tier, name: m.badge.name });
            }
            let topTier: MoveLogEntry['topTier'] = null;
            let topTierName: string | null = null;
            let bestCount = 0;
            for (const [, e] of tierCounts) {
                if (e.count > bestCount) { bestCount = e.count; topTier = e.tier; topTierName = e.name; }
            }
            moveLogEntry = {
                moveNum: CLASSIC_MOVES - newMovesLeft,
                pointsGained: result.scoreGained,
                matchesFound: result.matchesFound.length,
                cascadeCount: result.cascadeCount,
                maxCombo: result.combo,
                shapeBonus: result.shapeBonus?.type ?? null,
                specialsCreated: result.specialTilesCreated.map(s => s.type),
                specialsTriggered: result.specialTilesTriggered.map(s => s.type),
                topTier,
                topTierName,
            };
        }

        // Bonus capsule check — recomputed here since triggerMatchEffects
        // ran on `prev` separately (could be a stale snapshot if hit-stop
        // delayed us). Re-deriving from the current `prev` keeps the
        // bonus flag flipping based on the latest game state.
        const isBonusShape = result.shapeBonus?.type === 'T' || result.shapeBonus?.type === 'cross';
        const bonusCapsuleTriggered = isBonusShape && !prev.bonusCapsuleAwarded;

        // ===== FRENZY UPDATES =====
        // Bonus time from big matches/combos, heat-streak tracking, and
        // first-swap timer arming all live here so a single match resolution
        // updates every Frenzy field atomically. frenzyEndsAt is the
        // absolute Unix timestamp when the clock should hit zero — bonus
        // time pushes that forward, capped at start + FRENZY_MAX_MS.
        let frenzyEndsAt = prev.frenzyEndsAt;
        let frenzyBonusMsEarned = prev.frenzyBonusMsEarned;
        let frenzyStartedAt = prev.frenzyStartedAt;
        let frenzyLastMatchAt = prev.frenzyLastMatchAt;
        let frenzyConsecutiveQuickMatches = prev.frenzyConsecutiveQuickMatches;
        let frenzyHeatActiveUntil = prev.frenzyHeatActiveUntil;

        if (isFrenzy && result.matchesFound.length > 0) {
            const now = Date.now();
            // Arm the timer on first valid swap so board-load latency
            // doesn't steal time from the player.
            if (frenzyStartedAt === null) {
                frenzyStartedAt = now;
                frenzyEndsAt = now + FRENZY_INITIAL_MS;
            }

            const realMatches = result.matchesFound.filter(m => m.positions.length <= 8);
            const largestMatchSize = realMatches.length > 0
                ? Math.max(...realMatches.map(m => m.positions.length))
                : 3;
            const spawnedSpecial = result.specialTilesCreated.length > 0;
            const bonusMs = computeFrenzyBonusMs({
                largestMatchSize,
                spawnedSpecial,
                comboPeak: result.combo,
            });
            if (bonusMs > 0 && frenzyEndsAt !== null && frenzyStartedAt !== null) {
                // Push end-time forward, capped at the round's max length.
                const cap = frenzyStartedAt + FRENZY_MAX_MS;
                frenzyEndsAt = Math.min(cap, frenzyEndsAt + bonusMs);
                frenzyBonusMsEarned = frenzyBonusMsEarned + bonusMs;
            }

            // Heat streak: matches within FRENZY_HEAT_WINDOW_MS of the
            // previous one stack. Hitting FRENZY_HEAT_TRIGGER_COUNT arms
            // a sustained 3x multiplier for the next FRENZY_HEAT_DURATION_MS.
            // Previously the bonus was 2x AND one-shot (consumed on the
            // next match) — felt rare and small. Now it stays live for the
            // full window so rapid chain-play actually rewards the player
            // proportional to their pace.
            const withinWindow = frenzyLastMatchAt !== null && (now - frenzyLastMatchAt) <= FRENZY_HEAT_WINDOW_MS;
            frenzyConsecutiveQuickMatches = withinWindow ? frenzyConsecutiveQuickMatches + 1 : 1;
            // NOTE: removed the `if (scoreMultiplier > 1) frenzyHeatActiveUntil = null`
            // line — that was the one-shot consumption. Heat now expires
            // purely by time, not by use.
            if (frenzyConsecutiveQuickMatches >= FRENZY_HEAT_TRIGGER_COUNT) {
                frenzyHeatActiveUntil = now + FRENZY_HEAT_DURATION_MS;
                frenzyConsecutiveQuickMatches = 0;
            }
            frenzyLastMatchAt = now;
        }

        // Game-over wind-down + post-cascade cleanup are scheduled here
        // because they need to fire AFTER the state update applies. Frenzy
        // game-over is driven by the timer effect, not by moves.
        const noMovesLeft = !isFrenzy && newMovesLeft <= 0;
        const noValidMoves = !isFrenzy && !noMovesLeft && !hasValidMoves(result.board);
        const gameOver = noMovesLeft || noValidMoves;

        if (gameOver) {
            setTimeout(() => {
                playGameOverSound();
                setState(prev2 => prev2 ? {
                    ...prev2,
                    gamePhase: "gameover",
                    gameOverReason: noValidMoves ? "no_valid_moves" : "moves_exhausted",
                } : prev2);
                setIsAnimating(false);
            }, 1800);
        } else {
            // Cleanup fires when the drop animation has VISUALLY finished:
            // it both releases input (isAnimating=false) and clears
            // dropDistance, and clearing dropDistance removes the
            // .game-tile--dropping class — which snaps the tile to its
            // final position. If that happens before the CSS animation
            // ends, the tile teleports mid-fall. The drop keyframe runs
            // 300ms (column stagger now removed so every column finishes
            // together), so cleanup must be >= 300ms. Mobile Classic used
            // to fire at 120ms, cutting every drop ~40% through — the
            // teleport players saw. 320ms across the board clears just
            // after the animation settles, so gravity always completes
            // before the next queued tap can start a new cascade.
            const cleanupMs = 320;
            setTimeout(() => {
                setIsAnimating(false);
                setState(prev2 => {
                    if (!prev2) return prev2;
                    const cleaned = prev2.board.map(row =>
                        row.map(cell => cell.dropDistance ? { ...cell, dropDistance: 0, isNew: false } : cell)
                    );
                    return { ...prev2, board: cleaned };
                });
            }, cleanupMs);
        }

        return {
            ...prev,
            board: result.board,
            score: newScore,
            movesLeft: newMovesLeft,
            combo: result.combo,
            comboCarry: result.comboCarry,
            maxCombo: newMaxCombo,
            selectedTile: null,
            // If gameover has already been set (e.g., the Frenzy timer
            // expired while this cascade was still settling), DO NOT snap
            // gamePhase back to "playing". Otherwise the gamePhase
            // bounce gameover → playing → gameover fires the end-flow
            // useEffect twice and logs two games (the second
            // earnCapsule trips "Capsule already claimed for this match").
            gamePhase: prev.gamePhase === "gameover" ? "gameover" : "playing",
            gameOverReason: prev.gameOverReason,
            matchCount: newMatchCount,
            totalCascades: prev.totalCascades + result.cascadeCount,
            bonusCapsuleAwarded: prev.bonusCapsuleAwarded || bonusCapsuleTriggered,
            frenzyEndsAt,
            frenzyBonusMsEarned,
            frenzyStartedAt,
            frenzyLastMatchAt,
            frenzyConsecutiveQuickMatches,
            frenzyHeatActiveUntil,
            moveLog: moveLogEntry ? [...prev.moveLog, moveLogEntry] : prev.moveLog,
            // Append to the deterministic action log only when a move was
            // actually consumed AND the caller supplied an action (swap or
            // tap). Skipping system-fired / zero-cost effects keeps the
            // sequence one-to-one with player decisions so a future
            // replay pass can reproduce the game.
            moveSequence: (costMove && moveAction)
                ? [...prev.moveSequence, moveAction]
                : prev.moveSequence,
        };
    }, [isMobile]);

    /**
     * Convenience wrapper for paths that DON'T need hit-stop (e.g. tap-
     * activated power tiles). Fires effects + applies state immediately.
     */
    const applyResult = useCallback((
        prev: GameState,
        result: TurnResult,
        effectPos: Position,
        costMove: boolean,
        moveAction?: MoveAction,
    ): GameState => {
        const heatMul = (prev.gameMode === "frenzy"
            && prev.frenzyHeatActiveUntil !== null
            && prev.frenzyHeatActiveUntil > Date.now()) ? 3 : 1;
        triggerMatchEffects(result, effectPos, costMove, prev.movesLeft, prev.bonusCapsuleAwarded, heatMul, prev.gameMode);
        return applyResultState(prev, result, costMove, heatMul, moveAction);
    }, [triggerMatchEffects, applyResultState]);

    // Input queueing — when the player taps during the isAnimating
    // window (swap anim + hit-stop + cascade settle = up to ~530ms on
    // an ultra match), the tap was being silently dropped. Felt like
    // "tap does nothing" on mobile especially during cascade-heavy
    // play. Now we buffer the most recent tap intent and replay it
    // the moment input opens. Only the LAST queued tap is kept (so
    // mashing doesn't queue up a backlog) and stale ones (>600ms old)
    // are discarded so the player doesn't get a delayed action they
    // forgot about.
    const queuedTapRef = useRef<{ pos: Position; ts: number } | null>(null);
    const queuedSwipeRef = useRef<{ from: Position; to: Position; ts: number } | null>(null);
    const QUEUE_STALENESS_MS = 600;

    const selectTile = useCallback(
        (pos: Position) => {
            if (!state || state.gamePhase !== "playing") return;
            if (isAnimating) {
                queuedTapRef.current = { pos, ts: performance.now() };
                queuedSwipeRef.current = null;
                return;
            }
            queuedTapRef.current = null;
            setHintCells(new Set());
            setHintMessage(null);

            // No tile selected yet — select this one
            if (!state.selectedTile) {
                playSelectSound();
                setState({ ...state, selectedTile: pos });
                return;
            }

            // Clicking same tile — if special, activate on double-click; otherwise deselect
            if (state.selectedTile.row === pos.row && state.selectedTile.col === pos.col) {
                const cell = state.board[pos.row]?.[pos.col];
                if (cell?.isSpecial) {
                    const result = triggerSpecialTile(state.board, pos, state.gameBadges, state.rng);
                    if (result) {
                        if (cell.isSpecial === "bomb") playBombSound();
                        else if (cell.isSpecial === "cosmic_blast") playCosmicBlastSound();
                        else if (cell.isSpecial === "vibestreak") playVibestreakSound();
                        else playBombSound();
                        const meta = consumeMoveMeta();
                        const tapAction: MoveAction = { kind: 'tap', at: pos, t: meta.t, trusted: meta.trusted };
                        setState(prev => prev ? applyResult(prev, result, pos, true, tapAction) : prev);
                        // Re-arm the hint timer against the post-detonation board.
                        // Without this, a hint scheduled before the tap-activate
                        // would still hold a closure reference to the pre-blast
                        // board; firing 8s later it would highlight two tiles that
                        // no longer exist (or now hold different badges), surfacing
                        // as "the hint doesn't actually form a match" bug reports.
                        resetHintTimer(result.board);
                        return;
                    }
                }
                playDeselectSound();
                setState({ ...state, selectedTile: null });
                return;
            }

            // Not adjacent — reselect new tile
            if (!isAdjacentSwap(state.selectedTile, pos)) {
                playSelectSound();
                setState({ ...state, selectedTile: pos });
                return;
            }

            // Adjacent tile — attempt swap
            const result = processTurn(state.board, state.selectedTile, pos, state.gameBadges, state.comboCarry, state.rng);

            if (!result) {
                // Invalid swap — no match. Animate bounce then deselect.
                // Frenzy adds a 1-second time penalty + red flash + sting
                // sound on top so random/sloppy tapping has a real cost.
                // No-op outside Frenzy.
                playInvalidSwapSound();
                if (state.gameMode === "frenzy") {
                    fireFrenzyPenalty(state.selectedTile, pos);
                }
                resetHintTimer(state.board);
                setInvalidSwapCells([state.selectedTile, pos]);
                setTimeout(() => setInvalidSwapCells(null), 400);
                // Functional update is critical here: fireFrenzyPenalty
                // queues a functional setState that decrements frenzyEndsAt.
                // A non-functional `setState({ ...state, ... })` would spread
                // the stale captured `state` and silently overwrite the
                // penalty time deduction.
                setState(prev => prev ? { ...prev, selectedTile: null } : prev);
                return;
            }

            // Valid swap — show slide animation first, then apply turn result
            const swapPos1 = state.selectedTile;
            const swapPos2 = pos;
            const swapMeta = consumeMoveMeta();
            const swapAction: MoveAction = { kind: 'swap', from: swapPos1, to: swapPos2, t: swapMeta.t, trusted: swapMeta.trusted };
            resetHintTimer(result.board);
            setSwapAnim({ pos1: swapPos1, pos2: swapPos2 });
            setState({ ...state, selectedTile: null });
            setIsAnimating(true);
            setTimeout(() => {
                setSwapAnim(null);
                // Heat 3x is a one-shot per arming, so we lock the
                // multiplier here against the swap-time snapshot. Hit-stop
                // pipeline: fire match effects (sounds, flash, particles)
                // immediately, then defer the actual board state update by
                // hit-stop ms on mega/ultra so the player sees the matched
                // tiles flash IN PLACE before the cascade.
                const heatMul = (state?.gameMode === "frenzy"
                    && state.frenzyHeatActiveUntil !== null
                    && state.frenzyHeatActiveUntil > Date.now()) ? 3 : 1;
                const intensity = state ? triggerMatchEffects(result, pos, true, state.movesLeft, state.bonusCapsuleAwarded, heatMul, state.gameMode) : "normal";
                const hitStop = getHitStopMs(intensity);
                const apply = () => setState(prev => prev ? applyResultState(prev, result, true, heatMul, swapAction) : prev);
                if (hitStop > 0) setTimeout(apply, hitStop); else apply();
            }, isMobile ? 280 : 240);
        },
        [state, isAnimating, applyResult, applyResultState, triggerMatchEffects, getHitStopMs, resetHintTimer, isMobile, fireFrenzyPenalty]
    );

    const swipeTiles = useCallback(
        (from: Position, to: Position) => {
            if (!state || state.gamePhase !== "playing") return;
            if (!isAdjacentSwap(from, to)) return;
            if (isAnimating) {
                queuedSwipeRef.current = { from, to, ts: performance.now() };
                queuedTapRef.current = null;
                return;
            }
            queuedSwipeRef.current = null;
            setHintCells(new Set());
            setHintMessage(null);

            // Attempt swap
            const result = processTurn(state.board, from, to, state.gameBadges, state.comboCarry, state.rng);

            if (!result) {
                // Frenzy time-penalty + sting; no-op outside Frenzy.
                playInvalidSwapSound();
                if (state.gameMode === "frenzy") {
                    fireFrenzyPenalty(from, to);
                }
                resetHintTimer(state.board);
                setInvalidSwapCells([from, to]);
                setTimeout(() => setInvalidSwapCells(null), 400);
                return;
            }

            // Valid swap — animate then apply
            const swipeMeta = consumeMoveMeta();
            const swipeAction: MoveAction = { kind: 'swap', from, to, t: swipeMeta.t, trusted: swipeMeta.trusted };
            resetHintTimer(result.board);
            setSwapAnim({ pos1: from, pos2: to });
            setState({ ...state, selectedTile: null });
            setIsAnimating(true);
            setTimeout(() => {
                setSwapAnim(null);
                const heatMul = (state?.gameMode === "frenzy"
                    && state.frenzyHeatActiveUntil !== null
                    && state.frenzyHeatActiveUntil > Date.now()) ? 3 : 1;
                const intensity = state ? triggerMatchEffects(result, to, true, state.movesLeft, state.bonusCapsuleAwarded, heatMul, state.gameMode) : "normal";
                const hitStop = getHitStopMs(intensity);
                const apply = () => setState(prev => prev ? applyResultState(prev, result, true, heatMul, swipeAction) : prev);
                if (hitStop > 0) setTimeout(apply, hitStop); else apply();
            }, isMobile ? 280 : 240);
        },
        [state, isAnimating, applyResultState, triggerMatchEffects, getHitStopMs, resetHintTimer, isMobile, fireFrenzyPenalty]
    );

    // ===== FRENZY VISIBILITY HANDLING =====
    // Previously this hook forfeited the round immediately on tab-away
    // to prevent a "pause-by-backgrounding" exploit. In practice it
    // punished accidental tab flips (notifications, mobile interruptions,
    // alt-tab) — players reported coming back to an instant 0:00 game
    // over. Removed because the exploit it prevented doesn't actually
    // exist: frenzyEndsAt is an absolute Unix timestamp and the wall
    // clock keeps ticking during tab-away, so a player who tabs away
    // loses real time and gains no advantage. If the round expired
    // while hidden, the expiry effect below applies gameover on the
    // first paint after tab focus. Net: no exploit surface, friendlier
    // UX, no special-case code path.

    // ===== FRENZY EXPIRY =====
    // Schedules a SINGLE setTimeout for when frenzyEndsAt arrives. Reschedules
    // if the player earns bonus time (frenzyEndsAt moves forward). No
    // per-frame setState — the parent never re-renders just because the
    // clock advances. Mid-cascade animations run to completion uninterrupted.
    useEffect(() => {
        if (!state) return;
        if (state.gameMode !== "frenzy") return;
        if (state.gamePhase !== "playing") return;
        if (state.frenzyEndsAt === null) return;

        const msUntilExpiry = state.frenzyEndsAt - Date.now();
        if (msUntilExpiry <= 0) {
            playGameOverSound();
            setState(prev => prev ? {
                ...prev,
                gamePhase: "gameover",
                gameOverReason: "time_expired",
            } : prev);
            return;
        }

        const id = setTimeout(() => {
            playGameOverSound();
            setState(prev => prev ? {
                ...prev,
                gamePhase: "gameover",
                gameOverReason: "time_expired",
            } : prev);
        }, msUntilExpiry);

        return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state?.gameMode, state?.gamePhase, state?.frenzyEndsAt]);

    // ===== FRENZY AUDIO + URGENCY TICKS =====
    // Runs its own interval but never touches React state, so it can't
    // force re-renders. Reads frenzyEndsAt + Date.now() to know remaining
    // ms; only pokes bgmAudio.playbackRate when crossing a tempo band
    // boundary, and only plays a tick beep when crossing a whole-second
    // boundary in the last 10s. Audio rate changes are coarse (3 bands)
    // so mobile Safari doesn't stutter from constant time-stretching.
    const lastFrenzyRateBandRef = useRef<number | null>(null);
    const lastFrenzyTickSecondRef = useRef<number | null>(null);
    useEffect(() => {
        if (!state) return;
        if (state.gameMode !== "frenzy") return;
        if (state.gamePhase !== "playing") return;
        if (state.frenzyEndsAt === null) return;

        const endsAt = state.frenzyEndsAt;
        const id = setInterval(() => {
            const ms = endsAt - Date.now();

            // 3 discrete bands: > 30s = original, 30-15s = fast, < 15s = hectic.
            const band = ms > 30_000 ? 0 : ms > 15_000 ? 1 : 2;
            if (band !== lastFrenzyRateBandRef.current) {
                lastFrenzyRateBandRef.current = band;
                setFrenzyTempo(ms);
            }

            if (ms > 0 && ms <= 10_000) {
                const sec = Math.ceil(ms / 1000);
                if (sec !== lastFrenzyTickSecondRef.current) {
                    lastFrenzyTickSecondRef.current = sec;
                    if (sec <= 3) playFrenzyFinalTick();
                    else playFrenzyTick();
                }
            }
        }, 500);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state?.gameMode, state?.gamePhase, state?.frenzyEndsAt]);

    // Stop the Frenzy BGM treatment (rate + track restore) when the
    // round ends, no matter what triggered the end (time out, visibility
    // hide, manual abort). Mirrored on mode change away from frenzy.
    useEffect(() => {
        if (state?.gameMode === "frenzy" && state.gamePhase === "gameover") {
            stopFrenzyBGM();
        }
    }, [state?.gameMode, state?.gamePhase]);

    // Replay queued input when the animating window clears. Only one
    // queued action exists at a time (selectTile / swipeTiles each
    // clear the other when buffering) so we just check both and fire
    // the freshest if not stale.
    useEffect(() => {
        if (isAnimating) return;
        const now = performance.now();
        const tap = queuedTapRef.current;
        const swipe = queuedSwipeRef.current;
        queuedTapRef.current = null;
        queuedSwipeRef.current = null;
        if (swipe && now - swipe.ts <= QUEUE_STALENESS_MS) {
            swipeTiles(swipe.from, swipe.to);
        } else if (tap && now - tap.ts <= QUEUE_STALENESS_MS) {
            selectTile(tap.pos);
        }
    }, [isAnimating, selectTile, swipeTiles]);

    const getBehavioralMeta = useCallback(() => ({
        webdriver: webdriverRef.current,
        untrustedEvents: untrustedEventsRef.current,
        gameDurationMs: gameStartMsRef.current > 0
            ? Math.round(performance.now() - gameStartMsRef.current)
            : 0,
    }), []);

    return {
        state,
        scorePopups,
        lastTurnResult,
        matchEffect,
        isAnimating,
        hintCells,
        hintMessage,
        invalidSwapCells,
        swapAnim,
        frenzyPenaltyAt,
        timePenaltyPopups,
        selectTile,
        swipeTiles,
        startGame,
        startGameWithBadges,
        resetGame,
        recordEventTrust: recordTrust,
        getBehavioralMeta,
    };
}
