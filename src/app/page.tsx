"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameMode } from "@/lib/gameEngine";
import { useGame } from "@/lib/useGame";
import GameBoard from "@/components/GameBoard";
import GameHUD from "@/components/GameHUD";
import GameOver from "@/components/GameOver";
import LandingPage from "@/components/LandingPage";
import InstructionsModal from "@/components/InstructionsModal";
import FlameBackground from "@/components/FlameBackground";
import { ArrowLeft, HelpCircle } from "lucide-react";
import Image from "next/image";
import { Toaster } from "react-hot-toast";

type AppView = "landing" | "playing";

export default function Home() {
  const [view, setView] = useState<AppView>("landing");
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string, avatarUrl: string } | null>(null);
  const game = useGame();

  const handleStartGame = (mode: GameMode, username?: string, avatarUrl?: string) => {
    if (username) {
      setUserProfile({ username, avatarUrl: avatarUrl || "" });
    }
    game.startGame(mode);
    setIsDealing(true);
    setView("playing");
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
      <Toaster position="top-center" toastOptions={{ style: { background: '#2A2333', color: '#fff', border: '1px solid #3A3344' } }} />
      <FlameBackground />
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
                src="/assets/bg-new.jpg"
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
            <div className="flex-shrink-0 z-40 px-4 pt-3 pb-2 relative">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleGoHome}
                  className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                >
                  <ArrowLeft size={16} className="text-white/80 group-hover:text-black transition-colors" />
                </button>

                <div className="relative pointer-events-none flex items-center justify-center -mb-4 z-50">
                  <Image
                    src="/assets/logo-cropped.png"
                    alt="VIBE MATCH"
                    width={400}
                    height={200}
                    className="w-auto h-24 sm:h-32 lg:h-40 drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                    priority
                  />
                </div>

                <button
                  onClick={() => setShowInstructions(true)}
                  className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                >
                  <HelpCircle size={15} className="text-white/80 group-hover:text-black transition-colors" />
                </button>
              </div>
            </div>

            {/* Game Layout — Royal Match style: HUD left, Board center */}
            <div className="flex-1 flex items-center justify-center px-3 sm:px-6 pb-3 min-h-0 relative z-10">
              <div className="h-full flex flex-row gap-4 items-center justify-center">
                {/* Left HUD — stacked vertically taking full height */}
                <div className="hidden lg:flex flex-col justify-center w-56 flex-shrink-0" style={{ height: "min(100%, min(680px, calc(100vh - 140px)))" }}>
                  <GameHUD state={game.state} />
                </div>

                {/* Board — fills available height */}
                <div className="flex-shrink-0" style={{ width: "min(100%, min(680px, calc(100vh - 140px)))", height: "min(100%, min(680px, calc(100vh - 140px)))" }}>
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

                {/* Mobile HUD — below board on small screens */}
                <div className="lg:hidden absolute bottom-2 left-2 right-2 z-30">
                  <GameHUD state={game.state} />
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
    </main>
  );
}
