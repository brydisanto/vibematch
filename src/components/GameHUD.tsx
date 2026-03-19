"use client";

import { GameState } from "@/lib/gameEngine";
import { useEffect, useState, useRef } from "react";

interface GameHUDProps {
    state: GameState;
    username?: string;
    hideMetrics?: boolean;
    hideHighScores?: boolean;
}
const TOTAL_MOVES = 30;

// Utility to format scores with a stylized low-hanging comma
const formatScoreWithCommas = (value: number) => {
    if (value <= 0) return "—";
    return value.toLocaleString();
};

/* ===== Card wrapper for consistent styling ===== */
function HudCard({
    children,
    borderColor = "rgba(179, 102, 255, 0.8)",
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
    const usesProgressBorder = borderProgress !== undefined;

    return (
        <div
            className={`relative w-full rounded-2xl flex flex-col items-center justify-center ${className}`}
            style={{
                padding: "3px",
                boxShadow: `0 8px 16px rgba(0,0,0,0.6), 0 0 20px ${glowColor}`,
                background: usesProgressBorder
                    ? `conic-gradient(from 0deg, ${borderColor} ${borderProgress! * 360}deg, rgba(255,255,255,0.1) ${borderProgress! * 360}deg)`
                    : borderColor,
                borderRadius: "1rem",
            }}
        >
            {/* Inner card — sits inside the 3px "border" padding */}
            <div
                className="absolute inset-[3px] z-0 rounded-[calc(1rem-3px)] overflow-hidden"
                style={{
                    background: "linear-gradient(180deg, #3A1061 0%, #21083B 50%, #110321 100%)",
                    boxShadow: "inset 0 6px 15px rgba(0,0,0,0.7), inset 0 -2px 5px rgba(0,0,0,0.5)",
                }}
            >
                {/* Inner highlight shimmer */}
                <div
                    className="absolute inset-0 z-0 opacity-60 pointer-events-none"
                    style={{
                        background: "radial-gradient(ellipse at 85% 0%, rgba(255,224,72,0.3) 0%, rgba(180,140,255,0.1) 40%, transparent 70%)",
                    }}
                />
            </div>
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center overflow-hidden px-2">
                {children}
            </div>
        </div>
    );
}

/* ===== FINAL MOVE! pulsing indicator ===== */
function FinalMoveBanner() {
    return (
        <div
            className="font-display font-black text-sm sm:text-base tracking-widest uppercase select-none text-center mt-1 hud-final-move-pulse"
            style={{
                color: "#FFE048",
                textShadow: "0 0 12px rgba(255,224,72,0.8), 0 0 24px rgba(255,224,72,0.4), 0 2px 4px rgba(0,0,0,0.8)",
            }}
        >
            FINAL MOVE!
        </div>
    );
}

export default function GameHUD({ state, username, hideMetrics = false, hideHighScores = false }: GameHUDProps) {
    const { score, movesLeft, combo, gameMode } = state;

    // Fetch high scores
    const [personalBest, setPersonalBest] = useState<number>(0);
    const [globalBest, setGlobalBest] = useState<number>(0);
    const [globalBestUser, setGlobalBestUser] = useState<string>("");

    useEffect(() => {
        // Only fetch at the start of a game or when explicitly requested
        if (score > 0 && personalBest > 0 && globalBest > 0) return;

        const effectiveUsername = username || localStorage.getItem('vibematch_username');
        const url = `/api/scores?mode=${gameMode}&skip_avatars=true${effectiveUsername ? `&username=${effectiveUsername}` : ''}`;

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
        <div className="relative flex flex-col h-full justify-between gap-1.5 sm:gap-2 w-full overflow-hidden">

            {/* Feature 3: Personal Best banner — large, central overlay */}
            {showPBBanner && (
                <div
                    className="fixed inset-x-0 top-[8%] sm:top-[10%] z-[60] flex justify-center pointer-events-none hud-pb-banner-enter"
                >
                    <div
                        className="font-display font-black text-3xl sm:text-4xl tracking-wider uppercase select-none px-6 py-3 rounded-2xl"
                        style={{
                            color: "#FFE048",
                            background: "linear-gradient(135deg, rgba(42,8,69,0.95) 0%, rgba(26,4,45,0.95) 100%)",
                            border: "2px solid rgba(255,224,72,0.6)",
                            boxShadow: "0 0 40px rgba(255,224,72,0.5), 0 0 80px rgba(255,224,72,0.2), 0 8px 32px rgba(0,0,0,0.8)",
                            WebkitTextStroke: "1px #8b6b15",
                            textShadow: "0 0 20px rgba(255,224,72,0.9), 0 0 40px rgba(255,224,72,0.4), 0 4px 8px rgba(0,0,0,0.9)",
                            paintOrder: "stroke fill",
                        }}
                    >
                        NEW PERSONAL BEST!
                    </div>
                </div>
            )}

            {/* Mobile metrics row (top HUD on mobile) */}
            {hideHighScores && (
                <div className="flex gap-1.5 w-full -mt-1 px-1">
                    {/* Score */}
                    <HudCard className="flex-1 flex flex-col items-center justify-center min-h-[64px] sm:min-h-[100px] px-1 sm:p-2">
                        <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">SCORE</div>
                        <div
                            className={`font-display text-3xl font-black leading-none text-center ${scoreBumping ? "hud-score-bump" : ""}`}
                            style={{ color: "#FFE048", WebkitTextStroke: "1px #c9a84c", textShadow: "0 2px 0 #8b6b15, 0 0 15px rgba(255, 224, 72, 0.4)" }}
                        >
                            <span
                                className={scoreBumping ? "hud-score-flash" : ""}
                                style={{ display: "inline-block" }}
                            >
                                {score.toLocaleString()}
                            </span>
                        </div>
                    </HudCard>
                    {/* Moves */}
                    <div className="relative flex-1">
                        {movesLeft <= 3 && (
                            <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 hud-low-moves-warning" />
                        )}
                        <HudCard borderColor={movesBorderColor} glowColor={movesGlow} className="flex flex-col items-center justify-center min-h-[64px] sm:min-h-[100px] px-1 sm:p-2 w-full">
                            <div className="text-[#B399D4] text-[9.5px] font-black tracking-[0.15em] font-mundial mb-1">MOVES</div>
                            <div
                                className={`font-display text-4xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"} ${movesBumping ? "hud-moves-bump" : ""}`}
                                style={movesLeft <= 3 ? {
                                    textShadow: "0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 10px rgba(0,0,0,0.5)",
                                } : { textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
                            >
                                {movesLeft}
                            </div>
                            {movesLeft === 1 && <FinalMoveBanner />}
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
                            className={`font-display text-2xl sm:text-3xl font-black leading-none text-center w-full truncate ${scoreBumping ? "hud-score-bump" : ""}`}
                            style={{
                                color: "#FFE048",
                                WebkitTextStroke: "1px #c9a84c",
                                textShadow: "0 4px 0 #8b6b15, 0 8px 10px rgba(0,0,0,0.8), 0 0 30px rgba(255, 224, 72, 0.4)",
                            }}
                        >
                            <span
                                className={scoreBumping ? "hud-score-flash" : ""}
                                style={{ display: "inline-block" }}
                            >
                                {formatScoreWithCommas(score)}
                            </span>
                        </div>
                    </HudCard>

                    {/* Moves Card — border acts as radial indicator */}
                    <div className="relative flex-1 min-h-0">
                        {movesLeft <= 3 && (
                            <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 hud-low-moves-warning" />
                        )}
                        <HudCard borderColor={movesBorderColor} glowColor={movesGlow} borderProgress={movesLeft / TOTAL_MOVES} className="flex-1 min-h-0 py-2 w-full h-full">
                            <div className="text-[#B399D4] text-[10px] sm:text-xs font-black tracking-[0.2em] font-mundial mb-0.5">
                                MOVES
                            </div>
                            <div
                                className={`font-display text-3xl sm:text-4xl font-black leading-none ${movesLeft <= 3 ? "text-red-400" : movesLeft <= 5 ? "text-[#FF8C00]" : "text-white"} ${movesBumping ? "hud-moves-bump" : ""}`}
                                style={movesLeft <= 3 ? {
                                    textShadow: "0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 10px rgba(0,0,0,0.5)",
                                } : { textShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                            >
                                {movesLeft}
                            </div>
                            {movesLeft === 1 && <FinalMoveBanner />}
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
