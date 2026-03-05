"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameMode } from "@/lib/gameEngine";
import { useGame } from "@/lib/useGame";
import GameBoard from "@/components/GameBoard";
import GameHUD from "@/components/GameHUD";
import GameOver from "@/components/GameOver";
import LandingPage from "@/components/LandingPage";
import InstructionsModal from "@/components/InstructionsModal";
import FlameBackground from "@/components/FlameBackground";
import { ArrowLeft, HelpCircle, Volume2, VolumeX, Music } from "lucide-react";
import { isMuted, toggleMute, startBGM, switchBGMTrack } from "@/lib/sounds";
import Image from "next/image";

type AppView = "landing" | "playing";

export default function Home() {
  const [view, setView] = useState<AppView>("landing");
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string, avatarUrl: string } | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [trackLabel, setTrackLabel] = useState<string | null>(null);
  const trackLabelTimeout = useRef<NodeJS.Timeout | null>(null);
  const game = useGame();

  const handleToggleMute = () => {
    const newMuted = toggleMute(!muted);
    setMuted(newMuted);
  };

  const handleSwitchTrack = () => {
    const trackName = switchBGMTrack();
    // Show inline label next to music button
    if (trackLabelTimeout.current) clearTimeout(trackLabelTimeout.current);
    setTrackLabel(muted ? `🔇 ${trackName}` : `🎵 ${trackName}`);
    trackLabelTimeout.current = setTimeout(() => setTrackLabel(null), 2500);
  };

  const handleStartGame = (mode: GameMode, username?: string, avatarUrl?: string) => {
    if (username) {
      setUserProfile({ username, avatarUrl: avatarUrl || "" });
    }
    game.startGame(mode);
    setIsDealing(true);
    setView("playing");
    startBGM(); // Initialize retro loop
  };

  // Clear dealing state after animation completes
  useEffect(() => {
    if (isDealing) {
      const timeout = setTimeout(() => setIsDealing(false), 1200);
      return () => clearTimeout(timeout);
    }
  }, [isDealing]);

  const handleGoHome = () => {
    setView("landing");
  };

  const handlePlayAgain = () => {
    setIsDealing(true);
    game.resetGame();
  };

  const movesLeft = game.state?.movesLeft ?? 30;
  const combo = game.state?.combo ?? 0;

  return (
    <main className="min-h-screen bg-[#050505] relative">

      {view === "playing" && <FlameBackground />}
      <AnimatePresence mode="wait">
        {view === "landing" || !game.state ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LandingPage
              onStartGame={handleStartGame}
              onShowInstructions={() => setShowInstructions(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="playing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-screen flex flex-col overflow-hidden relative"
          >
            <div className="absolute inset-0 z-0">
              <Image
                src="/vibematchbg2.jpg"
                alt="Background"
                fill
                className="object-cover object-center"
                quality={100}
                priority
              />
              {/* Subtle overlay for readability */}
              <div className="absolute inset-0 bg-black/0" />
            </div>

            {/* Top bar — Back + Logo + Help */}
            <div className="flex-shrink-0 z-40 px-3 sm:px-4 pt-3 pb-2 relative">
              <div className="flex items-start justify-between w-full">
                <div className="flex-1 flex justify-start pt-1 sm:pt-4">
                  <button
                    onClick={handleGoHome}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                  >
                    <ArrowLeft className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                  </button>
                </div>

                <div className="pointer-events-none flex items-center justify-center z-50">
                  <Image
                    src="/assets/logo-cropped.png"
                    alt="VIBE MATCH"
                    width={500}
                    height={250}
                    className="w-auto h-28 sm:h-40 lg:h-48 drop-shadow-[0_12px_45px_rgba(0,0,0,0.85)] object-contain"
                    priority
                  />
                </div>

                <div className="flex-1 flex justify-end items-start gap-2 pt-1 sm:pt-4">
                  <button
                    onClick={handleToggleMute}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                  >
                    {muted ? (
                      <VolumeX className="w-5 h-5 text-white/50 group-hover:text-black transition-colors" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                    )}
                  </button>
                  <button
                    onClick={handleSwitchTrack}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#b366ff] flex items-center justify-center shadow-lg hover:bg-[#b366ff] transition-all duration-200 group"
                  >
                    <Music className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                  </button>
                  <AnimatePresence>
                    {trackLabel && (
                      <motion.div
                        initial={{ opacity: 0, x: 10, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 10, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-14 top-1 sm:top-4 bg-[#2A2333]/95 border border-[#b366ff]/50 rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap pointer-events-none"
                      >
                        <span className="font-display tracking-wide text-sm text-white">{trackLabel}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setShowInstructions(true)}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                  >
                    <HelpCircle className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                  </button>
                </div>
              </div>
            </div>

            {/* Game Layout — Royal Match style: HUD left, Board center */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center p-2 sm:p-4 gap-2 sm:gap-4 overflow-y-auto w-full relative z-10">
              {/* Left HUD — Desktop only */}
              <div className="hidden lg:flex flex-col justify-center w-56 flex-shrink-0" style={{ height: "min(100vw - 16px, calc(100vh - 280px), 680px)" }}>
                <GameHUD state={game.state} />
              </div>

              {/* Mobile HUD Top — Metrics only */}
              <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pb-1 order-first">
                <div className="w-full">
                  <GameHUD state={game.state} hideHighScores />
                </div>
              </div>

              {/* Board — fills available height, capped */}
              <div className="flex-shrink-0 relative overflow-visible flex items-center justify-center -mb-1 sm:-mb-2" style={{
                height: "min(100vw - 16px, calc(100vh - 280px), 680px)",
                width: "min(100vw - 16px, calc(100vh - 280px), 680px)",
              }}
              >
                <div className="absolute inset-0">
                  <GameBoard
                    board={game.state.board}
                    selectedTile={game.state.selectedTile}
                    onTileClick={game.selectTile}
                    scorePopups={game.scorePopups}
                    isAnimating={game.isAnimating}
                    matchEffect={game.matchEffect}
                    combo={combo}
                    isDealing={isDealing}
                  />
                </div>
              </div>
              {/* Mobile HUD Bottom — High Scores only */}
              <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pt-0 pb-2 relative z-10 px-0 sm:px-2">
                <div className="w-full">
                  <GameHUD state={game.state} hideMetrics />
                </div>
              </div>
            </div>

            {/* Moves Warning Vignette */}
            {movesLeft <= 5 && game.state.gamePhase === "playing" && (
              <div className={movesLeft <= 3 ? "moves-critical-vignette" : "moves-warning-vignette"} />
            )}

            {/* Game Over */}
            <AnimatePresence>
              {game.state.gamePhase === "gameover" && (
                <GameOver
                  state={game.state}
                  userProfile={userProfile}
                  onPlayAgain={handlePlayAgain}
                  onGoHome={handleGoHome}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Modal */}
      <InstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </main >
  );
}
