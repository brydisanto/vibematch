"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameMode } from "@/lib/gameEngine";
import { useGame } from "@/lib/useGame";
import { Badge, BADGES, selectDraftPool, getDailySeed } from "@/lib/badges";
import GameBoard from "@/components/GameBoard";
import GameHUD from "@/components/GameHUD";
import GameOver from "@/components/GameOver";
import LandingPage from "@/components/LandingPage";
import VibeDraft from "@/components/VibeDraft";
import InstructionsModal from "@/components/InstructionsModal";
import AuthModal from "@/components/AuthModal";
import FlameBackground from "@/components/FlameBackground";
import SettingsModal from "@/components/SettingsModal";
import PinBook from "@/components/PinBook";
import VibeCapsule from "@/components/VibeCapsule";
import { ArrowLeft, Volume2, VolumeX, Menu, BookOpen } from "lucide-react";
import { isMuted, toggleMute, startBGM, stopBGM, switchBGMTrack, unlockAudio, playUIClick } from "@/lib/sounds";
import { usePinBook } from "@/lib/usePinBook";
import { useAchievements } from "@/lib/useAchievements";
import { checkAchievements, checkMidGameAchievements, checkRetroactiveAchievements, type GameEndStats, type PlayerContext } from "@/lib/achievements";
import AchievementToast from "@/components/AchievementToast";
import AchievementsPanel from "@/components/AchievementsPanel";
import Image from "next/image";

type AppView = "landing" | "drafting" | "playing";

export default function Home() {
  const [view, setView] = useState<AppView>("landing");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSystemAuthModal, setShowSystemAuthModal] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string, avatarUrl: string } | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [trackLabel, setTrackLabel] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draftPool, setDraftPool] = useState<Badge[]>([]);
  const [draftMode, setDraftMode] = useState<GameMode>("classic");
  const [showPinBook, setShowPinBook] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const [capsuleEarned, setCapsuleEarned] = useState(false);
  const [bonusCapsuleFlash, setBonusCapsuleFlash] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const trackLabelTimeout = useRef<NodeJS.Timeout | null>(null);
  const game = useGame();
  const pinBook = usePinBook();
  const achievements = useAchievements();

  // Per-game session stats for achievements (not in GameState)
  const gameSessionStats = useRef({
    bombsCreated: 0,
    vibestreaksCreated: 0,
    cosmicBlastsCreated: 0,
    crossCount: 0,
    shapesLanded: [] as { type: string; count: number }[],
  });

  useEffect(() => {
    // Restore reduce-motion preference on mount
    if (localStorage.getItem("vibematch_reduce_motion") === "true") {
      document.documentElement.classList.add("reduce-motion");
    }
  }, []);

  useEffect(() => {
    // Sync profile on mount
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUserProfile({ username: data.user.username, avatarUrl: data.user.avatarUrl });
          pinBook.load(); // Load pin book for authenticated user
          achievements.load(); // Load achievements for authenticated user
        }
      })
      .catch(err => console.error("Initial session check failed:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Retroactive achievement check — awards achievements for progress made before the system existed
  const retroChecked = useRef(false);
  useEffect(() => {
    if (!achievements.state.loaded || !pinBook.state.loaded || !userProfile?.username || retroChecked.current) return;
    retroChecked.current = true;

    // Build badge tier lookup
    const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));

    // Build player context from pinbook
    const ctx: PlayerContext = {
      streak: 0,
      uniquePins: Object.keys(pinBook.state.pins).length,
      totalPinsOpened: pinBook.state.totalOpened || 0,
      hasSilverPin: false,
      hasGoldPin: false,
      hasCosmicPin: false,
      commonPinCount: 0,
      rarePinCount: 0,
      legendaryPinCount: 0,
      cosmicPinCount: 0,
      gamesPlayedToday: 0,
    };

    for (const badgeId of Object.keys(pinBook.state.pins)) {
      const tier = badgeTierMap.get(badgeId);
      if (tier === "blue") ctx.commonPinCount++;
      if (tier === "silver") { ctx.hasSilverPin = true; ctx.rarePinCount++; }
      if (tier === "gold") { ctx.hasGoldPin = true; ctx.legendaryPinCount++; }
      if (tier === "cosmic") { ctx.hasCosmicPin = true; ctx.cosmicPinCount++; }
    }

    // Fetch streak then check
    fetch(`/api/streak?username=${userProfile.username}`)
      .then(r => r.json())
      .then(s => {
        ctx.streak = s.streak || 0;
        const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
        if (ids.length > 0) achievements.unlock(ids);
      })
      .catch(() => {
        // Check without streak data
        const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
        if (ids.length > 0) achievements.unlock(ids);
      });
  }, [achievements.state.loaded, pinBook.state.loaded, userProfile?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track classic game played + earn capsule when game ends
  useEffect(() => {
    if (game.state?.gamePhase === "gameover" && userProfile?.username) {
      const mode = game.state.gameMode || 'classic';
      // Track every classic game toward daily cap (win or lose)
      if (mode === 'classic') {
        pinBook.trackGame();
      }
      // Award capsule if score threshold met
      if (game.state.score >= 15000) {
        pinBook.earnCapsule(game.state.score, mode).then(earned => {
          if (earned) setCapsuleEarned(true);
        });
      }
    }
  }, [game.state?.gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Award bonus capsule when T/cross shape is made (1 per game)
  useEffect(() => {
    if (game.matchEffect?.bonusCapsuleTriggered && userProfile?.username) {
      const mode = game.state?.gameMode || 'classic';
      pinBook.earnBonusCapsule(mode).then(earned => {
        if (earned) {
          setBonusCapsuleFlash(true);
          setTimeout(() => setBonusCapsuleFlash(false), 2000);
        }
      });
    }
  }, [game.matchEffect?.timestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accumulate per-game stats + check mid-game achievements after each turn
  useEffect(() => {
    if (!game.lastTurnResult || !userProfile?.username) return;
    const result = game.lastTurnResult;
    const stats = gameSessionStats.current;

    // Accumulate specials created
    for (const s of result.specialTilesCreated) {
      if (s.type === "bomb") stats.bombsCreated++;
      else if (s.type === "vibestreak") stats.vibestreaksCreated++;
      else if (s.type === "cosmic_blast") stats.cosmicBlastsCreated++;
    }

    // Accumulate shape bonuses
    if (result.shapeBonus?.type) {
      if (result.shapeBonus.type === "cross") stats.crossCount++;
      const existing = stats.shapesLanded.find(s => s.type === result.shapeBonus!.type);
      if (existing) existing.count++;
      else stats.shapesLanded.push({ type: result.shapeBonus.type, count: 1 });
    }

    // Check mid-game achievements
    if (achievements.state.loaded) {
      const specials = result.specialTilesCreated.map(s => s.type);
      const midGameIds = checkMidGameAchievements(
        result.combo,
        result.cascadeCount,
        specials,
        result.shapeBonus?.type ?? null,
        achievements.getUnlockedSet(),
      );
      if (midGameIds.length > 0) {
        achievements.unlock(midGameIds);
      }
    }
  }, [game.lastTurnResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check end-of-game achievements
  useEffect(() => {
    if (game.state?.gamePhase !== "gameover" || !userProfile?.username || !achievements.state.loaded) return;
    const gs = game.state;
    const stats = gameSessionStats.current;

    const gameEndStats: GameEndStats = {
      score: gs.score,
      maxCombo: gs.maxCombo,
      totalCascades: gs.totalCascades,
      matchCount: gs.matchCount,
      bombsCreated: stats.bombsCreated,
      vibestreaksCreated: stats.vibestreaksCreated,
      cosmicBlastsCreated: stats.cosmicBlastsCreated,
      shapesLanded: stats.shapesLanded,
      crossCount: stats.crossCount,
      gameMode: gs.gameMode,
    };

    // Build player context from pinbook state
    const playerCtx: PlayerContext = {
      streak: 0, // fetched separately, not critical for most achievements
      uniquePins: Object.keys(pinBook.state.pins).length,
      totalPinsOpened: pinBook.state.totalOpened || 0,
      hasSilverPin: false,
      hasGoldPin: false,
      hasCosmicPin: false,
      commonPinCount: 0,
      rarePinCount: 0,
      legendaryPinCount: 0,
      cosmicPinCount: 0,
      gamesPlayedToday: 0,
    };

    // Check pin tiers by cross-referencing with badge definitions
    const badgeTierMap = new Map(BADGES.map(b => [b.id, b.tier]));
    for (const badgeId of Object.keys(pinBook.state.pins)) {
      const tier = badgeTierMap.get(badgeId);
      if (tier === "blue") playerCtx.commonPinCount++;
      if (tier === "silver") { playerCtx.hasSilverPin = true; playerCtx.rarePinCount++; }
      if (tier === "gold") { playerCtx.hasGoldPin = true; playerCtx.legendaryPinCount++; }
      if (tier === "cosmic") { playerCtx.hasCosmicPin = true; playerCtx.cosmicPinCount++; }
    }

    const ids = checkAchievements(gameEndStats, playerCtx, achievements.getUnlockedSet());
    if (ids.length > 0) {
      achievements.unlock(ids);
    }
  }, [game.state?.gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMute = () => {
    playUIClick();
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

    // Crucial for iOS/Safari: MUST interact with AudioContext during a direct click/tap event
    unlockAudio();

    // Vibe Draft disabled for now — slows down replayability
    // To re-enable: route classic mode to drafting view with selectDraftPool()
    game.startGame(mode);
    setCapsuleEarned(false);
    gameSessionStats.current = { bombsCreated: 0, vibestreaksCreated: 0, cosmicBlastsCreated: 0, crossCount: 0, shapesLanded: [] };
    setIsDealing(true);
    setView("playing");
    startBGM();
  };

  const handleDraftComplete = (drafted: Badge[]) => {
    game.startGameWithBadges(draftMode, drafted);
    setIsDealing(true);
    setView("playing");
    startBGM();
  };

  // Clear dealing state after animation completes
  useEffect(() => {
    if (isDealing) {
      const timeout = setTimeout(() => setIsDealing(false), 1200);
      return () => clearTimeout(timeout);
    }
  }, [isDealing]);

  const handleGoHome = () => {
    playUIClick();
    stopBGM();
    pinBook.load(); // Refresh to get updated classicPlays count
    setView("landing");
  };

  const handlePlayAgain = () => {
    setIsDealing(true);
    game.resetGame();
  };

  // Record streak when any game ends (daily or classic)
  useEffect(() => {
    if (game.state?.gamePhase === "gameover" && userProfile?.username) {
      fetch('/api/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userProfile.username }),
      }).catch(() => { });
    }
  }, [game.state?.gamePhase, userProfile?.username]);

  const movesLeft = game.state?.movesLeft ?? 30;
  const combo = game.state?.combo ?? 0;

  return (
    <main className="min-h-screen bg-[#050505] relative">

      {view === "playing" && <FlameBackground />}
      <AnimatePresence mode="wait">
        {view === "landing" ? (
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
              onLogout={() => setUserProfile(null)}
              onOpenPinBook={() => setShowPinBook(true)}
              onOpenAchievements={() => { setShowAchievements(true); achievements.markSeen(); }}
              capsuleCount={pinBook.state.capsules}
              achievementCount={achievements.unseenCount}
              classicPlays={pinBook.state.classicPlays}
              userProfile={userProfile}
            />
          </motion.div>
        ) : view === "drafting" ? (
          <VibeDraft
            key="drafting"
            pool={draftPool}
            onDraftComplete={handleDraftComplete}
            onBack={() => setView("landing")}
          />
        ) : game.state ? (
          <motion.div
            key="playing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-screen flex flex-col overflow-hidden relative"
          >
            <div className="absolute inset-0 z-0 bg-[#0a0015]">
              <Image
                src="/vibematchbg2.jpg"
                alt="Background"
                fill
                className="object-cover object-center"
                priority
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=="
              />
            </div>

            {/* Top bar — Back + Logo + Help */}
            <div className="flex-shrink-0 z-40 px-3 sm:px-4 pt-1 pb-0 relative">
              <div className="flex items-start justify-between w-full">
                <div className="flex-1 flex justify-start gap-2 pt-1 sm:pt-4">
                  <button
                    onClick={handleGoHome}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                  >
                    <ArrowLeft className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                  </button>
                  {userProfile && (
                    <button
                      onClick={() => { playUIClick(); setShowPinBook(true); }}
                      className="relative w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#6C5CE7] flex items-center justify-center shadow-lg hover:bg-[#6C5CE7] transition-all duration-200 group"
                    >
                      <BookOpen className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                      {pinBook.state.capsules > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF5F1F] text-white text-[9px] font-bold flex items-center justify-center">
                          {pinBook.state.capsules}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                <div className="pointer-events-none flex items-center justify-center z-50">
                  <Image
                    src="/assets/logo-cropped.png"
                    alt="VIBE MATCH"
                    width={500}
                    height={250}
                    className="w-auto h-16 sm:h-28 lg:h-36 drop-shadow-[0_12px_45px_rgba(0,0,0,0.85)] object-contain"
                    priority
                  />
                </div>

                <div className="flex-1 flex justify-end items-start gap-2 pt-1 sm:pt-4 relative">
                  <button
                    onClick={handleSwitchTrack}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#b366ff] flex items-center justify-center shadow-lg hover:bg-[#b366ff] transition-all duration-200 group"
                    title="Switch track"
                  >
                    <span className="text-white/80 group-hover:text-black transition-colors text-base">♫</span>
                  </button>
                  <button
                    onClick={handleToggleMute}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#c9a84c] flex items-center justify-center shadow-lg hover:bg-[#FFE048] hover:border-[#FFE048] transition-all duration-200 group"
                    title={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? (
                      <VolumeX className="w-5 h-5 text-white/50 group-hover:text-black transition-colors" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                    )}
                  </button>
                  <button
                    onClick={() => { playUIClick(); setShowSettings(true); }}
                    className="w-10 h-10 rounded-full bg-[#111]/90 border-2 border-[#b366ff] flex items-center justify-center shadow-lg hover:bg-[#b366ff] transition-all duration-200 group"
                  >
                    <Menu className="w-5 h-5 text-white/80 group-hover:text-black transition-colors" />
                  </button>
                  <AnimatePresence>
                    {trackLabel && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-12 sm:top-16 bg-[#2A2333]/95 border border-[#b366ff]/50 rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap pointer-events-none"
                      >
                        <span className="font-display tracking-wide text-sm text-white">{trackLabel}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Game Layout — Royal Match style: HUD left, Board center */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center pt-1 pb-2 px-1 sm:p-4 gap-2 sm:gap-4 overflow-y-auto w-full relative z-10">
              {/* Left HUD — Desktop only */}
              <div className="hidden lg:flex flex-col justify-center w-56 flex-shrink-0 min-w-0" style={{ height: "min(100vw - 16px, calc(100vh - 280px), 680px)" }}>
                <GameHUD state={game.state} username={userProfile?.username} />
              </div>

              {/* Mobile HUD Top — Metrics only */}
              <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pb-1 order-first">
                <div className="w-full">
                  <GameHUD state={game.state} username={userProfile?.username} hideHighScores />
                </div>
              </div>

              {/* Board — fills available height, capped */}
              <div className="flex-shrink-0 relative overflow-visible flex items-center justify-center -mb-1 sm:-mb-2" style={{
                height: "min(100vw - 8px, calc(100dvh - 220px), 680px)",
                width: "min(100vw - 8px, calc(100dvh - 220px), 680px)",
              }}
              >
                <div className="absolute inset-0">
                  <GameBoard
                    board={game.state.board}
                    selectedTile={game.state.selectedTile}
                    onTileClick={game.selectTile}
                    onSwipe={game.swipeTiles}
                    scorePopups={game.scorePopups}
                    isAnimating={game.isAnimating}
                    matchEffect={game.matchEffect}
                    combo={combo}
                    score={game.state.score}
                    isDealing={isDealing}
                    hintCells={game.hintCells}
                    invalidSwapCells={game.invalidSwapCells}
                    swapAnim={game.swapAnim}
                  />
                </div>
              </div>
              {/* Mobile HUD Bottom — High Scores only */}
              <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pt-0 pb-2 relative z-10 px-0 sm:px-2">
                <div className="w-full">
                  <GameHUD state={game.state} username={userProfile?.username} hideMetrics />
                </div>
              </div>
            </div>

            {/* Bonus Capsule Flash — BIG celebratory moment */}
            <AnimatePresence>
              {bonusCapsuleFlash && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
                >
                  {/* Screen flash */}
                  <motion.div
                    className="absolute inset-0"
                    initial={{ backgroundColor: "rgba(255,224,72,0.6)" }}
                    animate={{ backgroundColor: "rgba(255,224,72,0)" }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />

                  {/* Expanding shockwave ring */}
                  <motion.div
                    className="absolute rounded-full border-[3px] border-[#FFE048]"
                    style={{ width: 100, height: 100, boxShadow: "0 0 30px rgba(255,224,72,0.6), inset 0 0 30px rgba(255,224,72,0.3)" }}
                    initial={{ scale: 0.2, opacity: 1 }}
                    animate={{ scale: 6, opacity: 0 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />

                  {/* Second ring, delayed */}
                  <motion.div
                    className="absolute rounded-full border-2 border-[#B366FF]"
                    style={{ width: 80, height: 80, boxShadow: "0 0 20px rgba(179,102,255,0.4)" }}
                    initial={{ scale: 0.2, opacity: 0.8 }}
                    animate={{ scale: 5, opacity: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  />

                  {/* Radial burst particles */}
                  {Array.from({ length: 16 }, (_, i) => {
                    const angle = (i / 16) * Math.PI * 2;
                    const dist = 150 + Math.random() * 100;
                    return (
                      <motion.div
                        key={`bonus-particle-${i}`}
                        className="absolute rounded-full"
                        style={{
                          width: 4 + Math.random() * 4,
                          height: 4 + Math.random() * 4,
                          background: i % 3 === 0 ? "#FFE048" : i % 3 === 1 ? "#FF5F1F" : "#B366FF",
                          boxShadow: `0 0 8px ${i % 3 === 0 ? "#FFE048" : i % 3 === 1 ? "#FF5F1F" : "#B366FF"}`,
                        }}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                        animate={{
                          x: Math.cos(angle) * dist,
                          y: Math.sin(angle) * dist,
                          opacity: 0,
                          scale: 0,
                        }}
                        transition={{ duration: 0.6 + Math.random() * 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.random() * 0.1 }}
                      />
                    );
                  })}

                  {/* Capsule icon + text */}
                  <div className="relative text-center">
                    {/* Pulsing glow behind */}
                    <motion.div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full"
                      style={{ background: "radial-gradient(circle, rgba(255,224,72,0.4) 0%, rgba(179,102,255,0.15) 50%, transparent 70%)" }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.5, 1.2], opacity: [0, 1, 0.6] }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />

                    <motion.div
                      initial={{ scale: 0, y: 20 }}
                      animate={{ scale: [0, 1.3, 1], y: -10 }}
                      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                      <div
                        className="text-4xl sm:text-5xl font-black tracking-wider font-display"
                        style={{
                          background: "linear-gradient(135deg, #FFE048, #FF5F1F, #B366FF, #FFE048)",
                          backgroundSize: "200% 200%",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          animation: "ath-gradient-shift 1s ease-in-out infinite",
                          filter: "drop-shadow(0 0 20px rgba(255,224,72,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                          WebkitTextStroke: "1px rgba(255,255,255,0.2)",
                        }}
                      >
                        BONUS CAPSULE!
                      </div>
                      <motion.div
                        className="text-sm sm:text-base text-white/80 mt-2 font-display tracking-[0.2em] uppercase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.3 }}
                        style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
                      >
                        Shape match bonus
                      </motion.div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                  onRequestLogin={() => setShowSystemAuthModal(true)}
                  capsuleEarned={capsuleEarned}
                  onOpenPinBook={() => setShowPinBook(true)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Floating sound controls — draft screen only (gameplay uses settings modal) */}
      {view === "drafting" && (
        <div className="fixed top-3 right-3 z-[60] flex items-center gap-2">
          <AnimatePresence>
            {trackLabel && (
              <motion.div
                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-[#2A2333]/95 border border-[#b366ff]/50 rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap pointer-events-none"
              >
                <span className="font-display tracking-wide text-sm text-white">{trackLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleSwitchTrack}
            className="w-9 h-9 rounded-full bg-[#111]/90 border border-[#b366ff]/60 flex items-center justify-center shadow-lg hover:bg-[#b366ff] transition-all duration-200 group"
            title="Switch track"
          >
            <span className="text-white/70 group-hover:text-white text-sm">♫</span>
          </button>
          <button
            onClick={handleToggleMute}
            className="w-9 h-9 rounded-full bg-[#111]/90 border border-[#c9a84c]/60 flex items-center justify-center shadow-lg hover:bg-[#FFE048] transition-all duration-200 group"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-white/50 group-hover:text-black transition-colors" />
            ) : (
              <Volume2 className="w-4 h-4 text-white/80 group-hover:text-black transition-colors" />
            )}
          </button>
        </div>
      )}

      {/* Instructions Modal */}
      <InstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Pin Book Modal */}
      <PinBook
        isOpen={showPinBook}
        onClose={() => setShowPinBook(false)}
        onOpenCapsule={async () => {
          const reveal = await pinBook.openCapsule();
          if (reveal) {
            setShowPinBook(false);
            setShowCapsule(true);
          }
        }}
        pins={pinBook.state.pins}
        unopenedCapsules={pinBook.state.capsules}
        currentUsername={userProfile?.username}
      />

      {/* Vibe Capsule Opening Animation */}
      {pinBook.pendingReveal && (
        <VibeCapsule
          isOpen={showCapsule}
          badge={pinBook.pendingReveal.badge}
          tier={pinBook.pendingReveal.tier}
          isDuplicate={pinBook.pendingReveal.isDuplicate}
          duplicateCount={pinBook.pendingReveal.duplicateCount}
          quickOpen={false}
          onComplete={async () => {
            await pinBook.collectReveal();
            setShowCapsule(false);
            setShowPinBook(true); // Return to pin book after collecting
          }}
        />
      )}

      {/* Achievement Toast */}
      <AchievementToast
        event={achievements.pendingToasts[0] ?? null}
        onDismiss={achievements.dismissToast}
      />

      {/* Achievements Panel */}
      <AchievementsPanel
        isOpen={showAchievements}
        onClose={() => setShowAchievements(false)}
        unlocked={achievements.state.unlocked}
      />

      {/* Global Auth Modal for Game Over Save Score */}
      <AuthModal
        isOpen={showSystemAuthModal}
        onClose={() => setShowSystemAuthModal(false)}
        onSuccess={(username, avatarUrl) => {
          setUserProfile({ username, avatarUrl });
          localStorage.setItem('vibematch_username', username);
          setShowSystemAuthModal(false);
          pinBook.load(); // Load pin book after login
          achievements.load(); // Load achievements after login
        }}
      />
    </main >
  );
}
