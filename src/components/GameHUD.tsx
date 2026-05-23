"use client";

import { GameState, FRENZY_INITIAL_MS } from "@/lib/gameEngine";
import { useEffect, useState, useRef } from "react";

function formatFrenzyClock(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GameHUDProps {
    state: GameState;
    username?: string;
    hideMetrics?: boolean;
    hideHighScores?: boolean;
    /** True when the current classic match was started outside the
     *  daily prize cap. Drives a small "EXTRA PLAY" pill so the
     *  player isn't surprised when the score doesn't save. */
    isExtraPlay?: boolean;
}
const TOTAL_MOVES = 30;

// Utility to format scores with a stylized low-hanging comma
const formatScoreWithCommas = (value: number) => {
    if (value <= 0) return "—";
    return value.toLocaleString();
};

/* ===== Card wrapper — enamel pin style ===== */
function HudCard({
    children,
    borderColor = "rgba(179, 102, 255, 0.5)",
    glowColor = "rgba(156, 101, 240, 0.2)",
    borderProgress,
    className = "",
}: {
    children: React.ReactNode;
    borderColor?: string;
    glowColor?: string;
    borderProgress?: number; // 0-1, fraction of border filled
    className?: string;
}) {
    // Outer shell IS the border — padding trick
    const rimBg = borderProgress !== undefined
        ? `conic-gradient(from 0deg, ${borderColor} ${borderProgress * 360}deg, rgba(255,255,255,0.1) ${borderProgress * 360}deg)`
        : borderColor;

    return (
        <div
            className={`relative w-full rounded-xl flex flex-col items-center justify-center overflow-hidden ${className}`}
            style={{
                background: "linear-gradient(180deg, #3A1061 0%, #21083B 50%, #110321 100%)",
                border: borderProgress !== undefined ? 'none' : `1.5px solid ${borderColor}`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
            }}
        >
            {/* Conic progress border for moves */}
            {borderProgress !== undefined && (
                <div
                    className="absolute inset-0 rounded-xl pointer-events-none z-0"
                    style={{
                        background: `conic-gradient(from 0deg, ${borderColor} ${borderProgress * 360}deg, rgba(255,255,255,0.15) ${borderProgress * 360}deg)`,
                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude",
                        padding: "2.5px",
                        borderRadius: "inherit",
                    }}
                />
            )}
            {/* Gloss */}
            <div
                className="absolute inset-x-0 top-0 h-1/2 pointer-events-none z-0"
                style={{ background: "linear-gradient(180deg, rgba(179,102,255,0.06) 0%, transparent 100%)" }}
            />
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center overflow-hidden px-2">
                {children}
            </div>
        </div>
    );
}

/* ===== HEAT 3x — Frenzy sustained multiplier indicator =====
 * Sticks around for FRENZY_HEAT_DURATION_MS once triggered (3 quick
 * matches in a row), multiplying every match score by 3x during that
 * window. Was 2x + one-shot — bumped to 3x + sustained so rapid
 * chain-play actually rewards Frenzy players at a Classic-comparable
 * scale. */
function HeatChip({ floating = false }: { floating?: boolean }) {
    // floating=true: chip is positioned absolutely by its parent (mobile),
    // so we drop the `mt-1` margin and enforce whitespace-nowrap so it
    // renders as a clean horizontal pill instead of wrapping to two lines
    // when the parent has no width constraint.
    // floating=false: chip sits in the flow as a sibling of the score
    // (desktop), keeps its `mt-1` separator.
    return (
        <div
            className={`${floating ? "" : "mt-1"} px-2 py-0.5 rounded-full text-[10px] font-display font-black tracking-wider uppercase select-none pointer-events-none whitespace-nowrap hud-heat-pulse`}
            style={{
                color: "#0a0015",
                background: "linear-gradient(135deg, #FFE048 0%, #FF8C00 100%)",
                border: "1px solid rgba(255,224,72,0.9)",
                boxShadow: "0 0 14px rgba(255,140,0,0.6), 0 0 4px rgba(255,224,72,0.9)",
                textShadow: "0 1px 0 rgba(255,224,72,0.6)",
            }}
        >
            HEAT 3x
        </div>
    );
}

/* ===== FINAL MOVE! pulsing indicator ===== */
function FinalMoveBanner() {
    return (
        <div
            className="absolute inset-x-0 bottom-1 font-display font-black text-[10px] sm:text-xs tracking-widest uppercase select-none text-center pointer-events-none hud-final-move-pulse"
            style={{
                color: "#FFE048",
                textShadow: "0 0 8px rgba(255,224,72,0.8), 0 1px 2px rgba(0,0,0,0.8)",
            }}
        >
            FINAL MOVE!
        </div>
    );
}

export default function GameHUD({ state, username, hideMetrics = false, hideHighScores = false, isExtraPlay = false }: GameHUDProps) {
    const { score, movesLeft, combo, gameMode, frenzyEndsAt, frenzyHeatActiveUntil } = state;
    const isFrenzy = gameMode === "frenzy";

    // ===== FRENZY TIMER (local-state ticker) =====
    // 1000ms cadence — mm:ss only changes once per second anyway, and
    // every re-render of the HUD also repaints the conic-gradient timer
    // ring (mask composite is expensive on mobile). Re-rendering 1x/sec
    // is plenty; 4x/sec was burning paint cycles for no visible gain.
    const [frenzyTickNow, setFrenzyTickNow] = useState(() => Date.now());
    useEffect(() => {
        if (!isFrenzy || frenzyEndsAt === null) return;
        const id = setInterval(() => setFrenzyTickNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [isFrenzy, frenzyEndsAt]);

    const frenzyMsRemaining = isFrenzy
        ? (frenzyEndsAt === null ? FRENZY_INITIAL_MS : Math.max(0, frenzyEndsAt - frenzyTickNow))
        : 0;
    const frenzySecondsRemaining = Math.ceil(frenzyMsRemaining / 1000);
    const frenzyProgress = isFrenzy ? Math.min(1, frenzyMsRemaining / FRENZY_INITIAL_MS) : 0;
    let frenzyBorderColor = "#FFE048";
    let frenzyGlow = "rgba(255,224,72,0.35)";
    let frenzyTextColor = "text-white";
    if (frenzySecondsRemaining <= 10) {
        frenzyBorderColor = "#EF4444";
        frenzyGlow = "rgba(239,68,68,0.4)";
        frenzyTextColor = "text-red-400";
    } else if (frenzySecondsRemaining <= 20) {
        frenzyBorderColor = "#FF5F1F";
        frenzyGlow = "rgba(255,95,31,0.35)";
        frenzyTextColor = "text-[#FF8C00]";
    } else if (frenzySecondsRemaining <= 30) {
        frenzyBorderColor = "#FF8C00";
        frenzyGlow = "rgba(255,140,0,0.35)";
    }

    // HEAT 3x is sustained until expiry. Schedule a single timeout for when the
    // arming window closes so the chip disappears at the right moment —
    // beats polling every 250ms which was forcing constant HUD re-renders
    // (and via the parent, GameBoard re-renders) on mobile.
    const [, setHeatTick] = useState(0);
    useEffect(() => {
        if (!isFrenzy || frenzyHeatActiveUntil === null) return;
        const msUntilExpiry = frenzyHeatActiveUntil - Date.now();
        if (msUntilExpiry <= 0) {
            setHeatTick(t => t + 1);
            return;
        }
        const id = setTimeout(() => setHeatTick(t => t + 1), msUntilExpiry + 50);
        return () => clearTimeout(id);
    }, [isFrenzy, frenzyHeatActiveUntil]);
    const heatActive = isFrenzy && frenzyHeatActiveUntil !== null && frenzyHeatActiveUntil > Date.now();

    // Fetch high scores
    const [personalBest, setPersonalBest] = useState<number>(0);
    const [globalBest, setGlobalBest] = useState<number>(0);
    const [globalBestUser, setGlobalBestUser] = useState<string>("");

    useEffect(() => {
        // Only fetch at the start of a game or when explicitly requested
        if (score > 0 && personalBest > 0 && globalBest > 0) return;

        const effectiveUsername = username || localStorage.getItem('vibematch_username');
        const url = `/api/scores?mode=${gameMode}${effectiveUsername ? `&username=${effectiveUsername}` : ''}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.leaderboard && data.leaderboard.length > 0) {
                    setGlobalBest(data.leaderboard[0].score);
                    setGlobalBestUser(data.leaderboard[0].username);
                }

                // Use explicit personal best from API if available (handles users outside top 10)
                if (data.personalBest !== undefined && data.personalBest !== null) {
                    setPersonalBest(data.personalBest);
                } else if (effectiveUsername && data.leaderboard) {
                    // Fallback to checking leaderboard (multi-layer safety)
                    const userScore = data.leaderboard.find((s: { username: string }) => s.username.toLowerCase() === effectiveUsername.toLowerCase());
                    if (userScore) setPersonalBest(userScore.score);
                }
            })
            .catch(() => { });
    }, [gameMode, username, score]);

    // Feature 3: Personal Best banner state
    const [showPBBanner, setShowPBBanner] = useState(false);
    const prevScoreRef = useRef(score);
    const pbAlreadyCelebrated = useRef(false);

    useEffect(() => {
        const prev = prevScoreRef.current;
        prevScoreRef.current = score;

        if (
            personalBest > 0 &&
            !pbAlreadyCelebrated.current &&
            prev < personalBest &&
            score >= personalBest
        ) {
            pbAlreadyCelebrated.current = true;
            setShowPBBanner(true);
            setTimeout(() => setShowPBBanner(false), 2800);
        }
    }, [score, personalBest]);

    useEffect(() => {
        if (score === 0) {
            pbAlreadyCelebrated.current = false;
            setShowPBBanner(false);
        }
    }, [score]);

    // Track score changes for bump animation
    const [scoreBumping, setScoreBumping] = useState(false);
    const prevScoreBumpRef = useRef(score);
    useEffect(() => {
        if (score !== prevScoreBumpRef.current && score > 0) {
            setScoreBumping(true);
            const timer = setTimeout(() => setScoreBumping(false), 300);
            prevScoreBumpRef.current = score;
            return () => clearTimeout(timer);
        }
        prevScoreBumpRef.current = score;
    }, [score]);

    // Displayed score lags the real `score` and tweens up smoothly so
    // the visible number ticks UP as score-fly popups arrive at the
    // box, instead of jumping immediately on state update. Tween length
    // is matched roughly to the score-fly hold + flight (~1s) so the
    // counter finishes climbing right around when the last popup lands.
    const [displayedScore, setDisplayedScore] = useState(score);
    const tweenStartRef = useRef<number | null>(null);
    const tweenFromRef = useRef(score);
    const tweenRafRef = useRef<number | null>(null);

    useEffect(() => {
        // Snap immediately on score reset (game start / new game) so we
        // don't see a count-down to 0 from the previous run.
        if (score === 0) {
            if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
            tweenStartRef.current = null;
            tweenFromRef.current = 0;
            setDisplayedScore(0);
            return;
        }

        if (score === displayedScore) return;

        // Frenzy: skip the rAF tween entirely. Matches fire every ~400ms
        // and the 750ms tween keeps the HUD re-rendering at 60fps for
        // its full duration, which on mobile causes subpixel-blur of the
        // gold WebkitTextStroke text (reads as a "hazy" score). Snap
        // directly to the new value; the score popups still provide the
        // climbing-feedback animation.
        if (isFrenzy) {
            if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
            tweenStartRef.current = null;
            setDisplayedScore(score);
            return;
        }

        // Hold a beat before starting the tween so the popup can pop +
        // hold at its match position before the counter starts moving.
        // After this delay, tween from current displayed value to the
        // new score over ~700ms.
        const HOLD_MS = 220;
        const TWEEN_MS = 750;
        const fromValue = displayedScore;
        const targetValue = score;
        tweenFromRef.current = fromValue;

        const startTween = (t: number) => {
            tweenStartRef.current = t;
            const step = (now: number) => {
                if (tweenStartRef.current == null) return;
                const elapsed = now - tweenStartRef.current;
                if (elapsed >= TWEEN_MS) {
                    setDisplayedScore(targetValue);
                    tweenStartRef.current = null;
                    return;
                }
                // Ease-out cubic so the ticker decelerates as it lands.
                const t01 = elapsed / TWEEN_MS;
                const eased = 1 - Math.pow(1 - t01, 3);
                const val = Math.round(fromValue + (targetValue - fromValue) * eased);
                setDisplayedScore(val);
                tweenRafRef.current = requestAnimationFrame(step);
            };
            tweenRafRef.current = requestAnimationFrame(step);
        };

        const holdTimer = setTimeout(() => {
            startTween(performance.now());
        }, HOLD_MS);

        return () => {
            clearTimeout(holdTimer);
            if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
            tweenStartRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [score]);

    // Track moves changes for bump animation
    const [movesBumping, setMovesBumping] = useState(false);
    const prevMovesRef = useRef(movesLeft);
    useEffect(() => {
        if (movesLeft !== prevMovesRef.current) {
            setMovesBumping(true);
            const timer = setTimeout(() => setMovesBumping(false), 350);
            prevMovesRef.current = movesLeft;
            return () => clearTimeout(timer);
        }
    }, [movesLeft]);

    // Track combo changes for animation
    const [comboBumping, setComboBumping] = useState(false);
    const prevComboRef = useRef(combo);
    useEffect(() => {
        if (combo !== prevComboRef.current) {
            setComboBumping(true);
            const timer = setTimeout(() => setComboBumping(false), 350);
            prevComboRef.current = combo;
            return () => clearTimeout(timer);
        }
    }, [combo]);

    // Moves ring color for the border
    const movesProgress = movesLeft / TOTAL_MOVES;
    let movesBorderColor: string;
    let movesGlow: string;
    if (movesProgress > 0.6) {
        movesBorderColor = "#FFE048";
        movesGlow = "rgba(255,224,72,0.35)";
    } else if (movesProgress > 0.35) {
        movesBorderColor = "#FF8C00";
        movesGlow = "rgba(255,140,0,0.35)";
    } else if (movesProgress > 0.15) {
        movesBorderColor = "#FF5F1F";
        movesGlow = "rgba(255,95,31,0.35)";
    } else {
        movesBorderColor = "#EF4444";
        movesGlow = "rgba(239,68,68,0.4)";
    }

    // When only showing high scores (mobile bottom row)
    if (hideMetrics) {
        return (
            <div className="flex gap-1.5 px-1 py-1">
                <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[75px] sm:min-h-[90px] px-1 sm:p-2">
                    <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">YOUR BEST</div>
                    <div className="font-display text-2xl font-black text-[#FFE048]" style={{ textShadow: "0 0 12px rgba(255,224,72,0.3)" }}>{personalBest > 0 ? personalBest.toLocaleString() : '—'}</div>
                </HudCard>
                <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[75px] sm:min-h-[90px] px-1 sm:p-2">
                    <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">GLOBAL BEST</div>
                    <div className="font-display text-2xl font-black text-[#C48CFF]" style={{ textShadow: "0 0 12px rgba(196,140,255,0.3)" }}>{globalBest > 0 ? globalBest.toLocaleString() : '—'}</div>
                </HudCard>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col h-full justify-between gap-2.5 sm:gap-3 w-full overflow-hidden">

            {/* Feature 3: Personal Best banner — large, central overlay */}
            {showPBBanner && (
                <div
                    className="fixed inset-x-0 top-[8%] sm:top-[10%] z-[60] flex justify-center pointer-events-none hud-pb-banner-enter"
                >
                    <div
                        className="font-display font-black text-xl sm:text-2xl tracking-wider uppercase select-none px-5 py-2.5 rounded-xl"
                        style={{
                            color: "#FFE048",
                            background: "linear-gradient(135deg, #2a0845 0%, #1a042d 100%)",
                            border: "2px solid rgba(255,224,72,0.8)",
                            boxShadow: "0 0 30px rgba(255,224,72,0.4), 0 6px 24px rgba(0,0,0,0.7)",
                            textShadow: "0 0 12px rgba(255,224,72,0.7), 0 2px 4px rgba(0,0,0,0.8)",
                        }}
                    >
                        NEW PERSONAL BEST!
                    </div>
                </div>
            )}

            {/* Mobile metrics row (top HUD on mobile) */}
            {hideHighScores && (
                <div className="flex gap-1.5 w-full px-1">
                    {/* Score — HeatChip is wrapped in a relative div so it
                        can float outside the overflow-hidden HudCard
                        without expanding the card height (which would
                        push the board down on mobile). */}
                    <div className="relative flex-1 flex">
                        <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[64px] sm:min-h-[100px] px-1 sm:p-2">
                            <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">SCORE</div>
                            <div
                                className={`font-display text-3xl font-black leading-none text-center ${!isFrenzy && scoreBumping ? "hud-score-bump" : ""}`}
                                style={isFrenzy
                                    ? { color: "#FFE048", textShadow: "0 2px 0 #8b6b15, 0 3px 4px rgba(0,0,0,0.5)" }
                                    : { color: "#FFE048", WebkitTextStroke: "1px #c9a84c", textShadow: "0 2px 0 #8b6b15, 0 0 15px rgba(255, 224, 72, 0.4)" }}
                            >
                                <span
                                    data-hud-score-target
                                    className={!isFrenzy && scoreBumping ? "hud-score-flash" : ""}
                                    style={{ display: "inline-block" }}
                                >
                                    {displayedScore.toLocaleString()}
                                </span>
                            </div>
                        </HudCard>
                        {heatActive && (
                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                                <HeatChip floating />
                            </div>
                        )}
                    </div>
                    {/* Moves / Frenzy Timer */}
                    <div className="relative flex-1">
                        {!isFrenzy && movesLeft <= 3 && (
                            <div className="absolute inset-0 rounded-xl pointer-events-none z-10 hud-low-moves-warning" />
                        )}
                        {isFrenzy && frenzySecondsRemaining <= 10 && frenzyMsRemaining > 0 && (
                            <div className="absolute inset-0 rounded-xl pointer-events-none z-10 hud-low-moves-warning" />
                        )}
                        <HudCard
                            borderColor={isFrenzy ? frenzyBorderColor : movesBorderColor}
                            glowColor={isFrenzy ? frenzyGlow : movesGlow}
                            borderProgress={isFrenzy ? undefined : movesLeft / TOTAL_MOVES}
                            className="flex flex-col items-center justify-center min-h-[64px] sm:min-h-[100px] px-1 sm:p-2 w-full"
                        >
                            <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">{isFrenzy ? "TIME" : "MOVES"}</div>
                            {isFrenzy ? (
                                <div
                                    data-hud-timer-target
                                    className={`font-display text-3xl font-black leading-none ${frenzyTextColor}`}
                                    style={frenzySecondsRemaining <= 10 ? {
                                        textShadow: "0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 10px rgba(0,0,0,0.5)",
                                    } : { textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
                                >
                                    {formatFrenzyClock(frenzyMsRemaining)}
                                </div>
                            ) : (
                                <div
                                    className={`font-display text-4xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"} ${movesBumping ? "hud-moves-bump" : ""}`}
                                    style={movesLeft <= 3 ? {
                                        textShadow: "0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 10px rgba(0,0,0,0.5)",
                                    } : { textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
                                >
                                    {movesLeft}
                                </div>
                            )}
                            {!isFrenzy && movesLeft === 1 && <FinalMoveBanner />}
                        </HudCard>
                    </div>
                    {/* Combo */}
                    <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[64px] sm:min-h-[100px] px-1 sm:p-2">
                        <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">COMBO</div>
                        <div
                            className={`font-display text-4xl font-black leading-none ${combo >= 3 ? "text-[#FF5F1F]" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"} ${comboBumping ? "hud-combo-pop" : ""}`}
                        >
                            {combo > 0 ? combo : "—"}
                        </div>
                    </HudCard>
                </div>
            )}

            {/* Desktop-only cards below */}
            {!hideHighScores && (
                <>
                    {/* Score Card */}
                    <HudCard className="flex-1 min-h-0 py-2">
                        <div className="text-[#B399D4] text-[10px] sm:text-xs font-black tracking-[0.2em] font-mundial mb-0.5">
                            SCORE
                        </div>
                        <div
                            className={`font-display text-2xl sm:text-3xl font-black leading-none text-center w-full truncate ${!isFrenzy && scoreBumping ? "hud-score-bump" : ""}`}
                            style={isFrenzy
                                ? { color: "#FFE048", textShadow: "0 3px 0 #8b6b15, 0 5px 8px rgba(0,0,0,0.6)" }
                                : {
                                    color: "#FFE048",
                                    WebkitTextStroke: "1px #c9a84c",
                                    textShadow: "0 4px 0 #8b6b15, 0 8px 10px rgba(0,0,0,0.8), 0 0 30px rgba(255, 224, 72, 0.4)",
                                }}
                        >
                            <span
                                data-hud-score-target
                                className={!isFrenzy && scoreBumping ? "hud-score-flash" : ""}
                                style={{ display: "inline-block" }}
                            >
                                {formatScoreWithCommas(displayedScore)}
                            </span>
                        </div>
                        {heatActive && <HeatChip />}
                    </HudCard>

                    {/* Moves / Frenzy Timer — border acts as radial indicator */}
                    <div className="relative flex-1 min-h-0">
                        {!isFrenzy && movesLeft <= 3 && (
                            <div className="absolute inset-0 rounded-xl pointer-events-none z-10 hud-low-moves-warning" />
                        )}
                        {isFrenzy && frenzySecondsRemaining <= 10 && frenzyMsRemaining > 0 && (
                            <div className="absolute inset-0 rounded-xl pointer-events-none z-10 hud-low-moves-warning" />
                        )}
                        <HudCard
                            borderColor={isFrenzy ? frenzyBorderColor : movesBorderColor}
                            glowColor={isFrenzy ? frenzyGlow : movesGlow}
                            borderProgress={isFrenzy ? undefined : movesLeft / TOTAL_MOVES}
                            className="flex-1 min-h-0 py-2 w-full h-full"
                        >
                            <div className="text-[#B399D4] text-[10px] sm:text-xs font-black tracking-[0.2em] font-mundial mb-0.5">
                                {isFrenzy ? "TIME" : "MOVES"}
                            </div>
                            {isFrenzy ? (
                                <div
                                    data-hud-timer-target
                                    className={`font-display text-2xl sm:text-3xl font-black leading-none ${frenzyTextColor}`}
                                    style={frenzySecondsRemaining <= 10 ? {
                                        textShadow: "0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 10px rgba(0,0,0,0.5)",
                                    } : { textShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                                >
                                    {formatFrenzyClock(frenzyMsRemaining)}
                                </div>
                            ) : (
                                <div
                                    className={`font-display text-3xl sm:text-4xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"} ${movesBumping ? "hud-moves-bump" : ""}`}
                                    style={movesLeft <= 3 ? {
                                        textShadow: "0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 10px rgba(0,0,0,0.5)",
                                    } : { textShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                                >
                                    {movesLeft}
                                </div>
                            )}
                            {!isFrenzy && movesLeft === 1 && <FinalMoveBanner />}
                        </HudCard>
                    </div>

                    {/* Combo Card */}
                    <HudCard className="flex-[0.7] min-h-0 py-2">
                        <div className="text-[#B399D4] text-[10px] sm:text-xs font-black tracking-[0.2em] font-mundial mb-0.5">
                            COMBO
                        </div>
                        <div
                            className={`font-display text-2xl sm:text-3xl font-black leading-none ${combo >= 3 ? "text-[#FF5F1F]" : combo >= 2 ? "text-[#FFE048]" : "text-white/60"} ${comboBumping ? "hud-combo-pop" : ""}`}
                            style={{ textShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                        >
                            {combo > 0 ? `×${combo}` : "—"}
                        </div>
                    </HudCard>

                    {/* High Scores Card */}
                    <HudCard className="flex-1 min-h-0 py-2">
                        <div className="flex flex-col items-center w-full min-w-0">
                            <div className="text-[#B399D4] text-[10px] sm:text-xs font-black tracking-[0.15em] font-mundial">
                                YOUR BEST
                            </div>
                            <div className="font-display tracking-normal sm:tracking-[-0.02em] text-lg sm:text-xl font-black text-[#FFE048] w-full text-center truncate" style={{ textShadow: '0 0 15px rgba(255,224,72,0.5), 0 2px 4px rgba(0,0,0,0.5)' }}>
                                {formatScoreWithCommas(personalBest)}
                            </div>
                        </div>

                        <div className="w-[85%] h-[1px] bg-white/20 my-1 rounded-full" />

                        <div className="flex flex-col items-center w-full min-w-0">
                            <div className="text-[#B399D4] text-[10px] sm:text-xs font-black tracking-[0.15em] font-mundial">
                                GLOBAL BEST
                            </div>
                            <div className="font-display tracking-normal sm:tracking-[-0.02em] text-lg sm:text-xl font-black text-[#C48CFF] w-full text-center truncate" style={{ textShadow: '0 0 15px rgba(196,140,255,0.4), 0 2px 4px rgba(0,0,0,0.5)' }}>
                                {formatScoreWithCommas(globalBest)}
                            </div>
                        </div>
                    </HudCard>
                </>
            )}
        </div>
    );
}
