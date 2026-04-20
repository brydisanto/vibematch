"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
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
import PrizeGamesOnboarding from "@/components/PrizeGamesOnboarding";
import dynamic from "next/dynamic";

// Wallet-dependent components loaded client-only (RainbowKit uses localStorage)
const BuyPrizeGamesModal = dynamic(() => import("@/components/BuyPrizeGamesModal"), { ssr: false });
const RerollModal = dynamic(() => import("@/components/RerollModal"), { ssr: false });
const WalletProvider = dynamic(
  () => import("@/components/WalletProvider").then(m => m.WalletProvider),
  { ssr: false, loading: () => <>{/* placeholder */}</> }
);
import { ArrowLeft, Volume2, VolumeX, Menu, BookOpen } from "lucide-react";
import { isMuted, toggleMute, startBGM, stopBGM, switchBGMTrack, unlockAudio, playUIClick } from "@/lib/sounds";
import { usePinBook } from "@/lib/usePinBook";
import { useAchievements } from "@/lib/useAchievements";
import { checkAchievements, checkMidGameAchievements, checkRetroactiveAchievements, type GameEndStats, type PlayerContext } from "@/lib/achievements";
import { buildPlayerContext } from "@/lib/playerContext";
import AchievementToast from "@/components/AchievementToast";
import AchievementsPanel from "@/components/AchievementsPanel";
import Image from "next/image";
import { useFtue } from "@/lib/useFtue";
import FtuePrimer from "@/components/FtuePrimer";
import FtueHint, { type HintKind } from "@/components/FtueHint";
import FtuePostGame from "@/components/FtuePostGame";

type AppView = "landing" | "drafting" | "playing";

export default function AppClient() {
  const [view, setView] = useState<AppView>("landing");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSystemAuthModal, setShowSystemAuthModal] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Capture ?ref= query param on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref && ref.trim()) {
        setReferralCode(ref.trim());
      }
    } catch {
      // SSR or URL parse error
    }
  }, []);

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
  const [showBuyPrizeGames, setShowBuyPrizeGames] = useState(false);
  const [prizeOnboarding, setPrizeOnboarding] = useState<null | { variant: "running-low" | "capped"; remaining: number }>(null);
  const [showReroll, setShowReroll] = useState(false);
  const trackLabelTimeout = useRef<NodeJS.Timeout | null>(null);
  const game = useGame();
  const pinBook = usePinBook();
  const achievements = useAchievements();
  const ftue = useFtue();

  // FTUE UI state — primer card before first Classic game, in-game hints, post-game modal
  const [ftuePending, setFtuePending] = useState<null | { mode: GameMode; username?: string; avatarUrl?: string }>(null);
  const [ftueHint, setFtueHint] = useState<HintKind | null>(null);
  const [ftuePostGame, setFtuePostGame] = useState<null | "capsule" | "tryAgain">(null);
  // Holds the in-flight logGame → earnCapsule → achievements promise so that
  // handlePlayAgain can wait for it before issuing a new trackGame. Without
  // this, trackGame can race logGame at the server and the pinbook route's
  // "abandoned previous match" guard wrongly burns the new match's prize
  // eligibility, causing 15K+ runs to yield zero capsules.
  const gameEndPromiseRef = useRef<Promise<void> | null>(null);

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

    const ctx = buildPlayerContext(pinBook.state.pins, { totalPinsOpened: pinBook.state.totalOpened });

    // Fetch streak + referral count in parallel, then check retroactive achievements
    Promise.all([
      fetch(`/api/streak?username=${userProfile.username}`).then(r => r.json()).catch(() => ({ streak: 0 })),
      fetch('/api/referral').then(r => r.json()).catch(() => ({ totalReferrals: 0 })),
    ]).then(([streakData, referralData]) => {
      ctx.streak = streakData.streak || 0;
      ctx.referralCount = referralData.totalReferrals || 0;
      const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
      if (ids.length > 0) achievements.unlock(ids);
    });
  }, [achievements.state.loaded, pinBook.state.loaded, userProfile?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // FTUE post-game modal is triggered from inside the game-end async flow
  // below — only once the server has actually confirmed (or rejected) the
  // capsule. Two one-shot variants fire independently:
  //   - "capsule": first time a capsule is actually earned -> push to Pin Book
  //   - "tryAgain": first time a classic game ends without a capsule

  // Unified game-end flow: trackGame → logGame → earnCapsule → achievements
  // Must run sequentially so each step has the state it depends on:
  // - logGame depends on trackGame's match token
  // - earnCapsule depends on trackGame's match token
  // - achievements depends on logGame's stored match stats for gameplay verification
  useEffect(() => {
    if (game.state?.gamePhase !== "gameover" || !userProfile?.username || !achievements.state.loaded) return;
    const mode = game.state.gameMode || 'classic';
    const gs = game.state;
    const stats = gameSessionStats.current;

    gameEndPromiseRef.current = (async () => {
      // Match token was already issued at game START (handleStartGame).
      // No need to call trackGame here — just use the existing token.

      // 1. Log game stats (persists authoritative stats keyed by matchId for achievements)
      await pinBook.logGame({
        score: gs.score || 0,
        matchCount: gs.matchCount || 0,
        maxCombo: gs.maxCombo || 0,
        totalCascades: gs.totalCascades || 0,
        bombsCreated: stats.bombsCreated || 0,
        vibestreaksCreated: stats.vibestreaksCreated || 0,
        cosmicBlastsCreated: stats.cosmicBlastsCreated || 0,
        crossCount: stats.crossCount || 0,
        shapesLanded: stats.shapesLanded || [],
        gameOverReason: gs.gameOverReason || 'unknown',
      }, mode);

      // 3. Award capsule if score threshold met. Also gates which first-time
      // FTUE modal (if any) fires on this game-over.
      let actuallyEarnedCapsule = false;
      if (gs.score >= 15000) {
        const result = await pinBook.earnCapsule(gs.score, mode);
        if (result.earned) {
          setCapsuleEarned(true);
          actuallyEarnedCapsule = true;
        } else {
          // Silent failures were the root cause of "scored 15K+ got nothing"
          // confusion. Surface the specific reason instead.
          if (result.capped) {
            toast.error("Daily play cap reached — buy prize games for more capsules.");
          } else if (result.reason) {
            toast.error(`Capsule not awarded: ${result.reason}`);
          } else {
            toast.error("Could not award capsule. Try again.");
          }
        }
      }

      // First-time FTUE modal — only in classic mode.
      //   - If this is the user's first-ever actual capsule earn, push them
      //     to the Pin Book with the "First Capsule" reveal modal.
      //   - Else if this is their first game ending without a capsule, show
      //     the "So close" encouragement modal.
      if (mode === "classic") {
        if (actuallyEarnedCapsule && !ftue.has("firstCapsuleShown")) {
          ftue.mark("firstCapsuleShown");
          setTimeout(() => setFtuePostGame("capsule"), 800);
        } else if (!actuallyEarnedCapsule && !ftue.has("firstFailShown")) {
          ftue.mark("firstFailShown");
          setTimeout(() => setFtuePostGame("tryAgain"), 800);
        }
      }

      // 4. Check end-of-game achievements with match context for server-side verification
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
      const playerCtx = buildPlayerContext(pinBook.state.pins, { totalPinsOpened: pinBook.state.totalOpened });
      const ids = checkAchievements(gameEndStats, playerCtx, achievements.getUnlockedSet());
      if (ids.length > 0) {
        await achievements.unlock(ids, { matchId: pinBook.getActiveMatchId(), gameMode: mode });
      }

      // 5. First-time prize-games onboarding: show a one-time modal when the user
      // first runs low or hits the cap in classic mode. Gated by localStorage so
      // each variant only fires once ever per user.
      if (mode === 'classic' && userProfile?.username) {
        try {
          const effectiveCap = 10 + (pinBook.state.bonusPrizeGames || 0);
          const remaining = Math.max(0, effectiveCap - pinBook.state.classicPlays);
          const seenKey = `vibematch_prize_onboarding:${userProfile.username.toLowerCase()}`;
          const seen = JSON.parse(localStorage.getItem(seenKey) || '{}') as { runningLow?: boolean; capped?: boolean };

          if (remaining === 0 && !seen.capped) {
            seen.capped = true;
            localStorage.setItem(seenKey, JSON.stringify(seen));
            setPrizeOnboarding({ variant: 'capped', remaining: 0 });
          } else if (remaining <= 3 && remaining > 0 && !seen.runningLow) {
            seen.runningLow = true;
            localStorage.setItem(seenKey, JSON.stringify(seen));
            setPrizeOnboarding({ variant: 'running-low', remaining });
          }
        } catch {
          // localStorage unavailable — silently skip
        }
      }
    })();
    // Swallow unhandled errors on the promise itself so awaiters don't crash
    gameEndPromiseRef.current.catch(() => {});
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

  // FTUE contextual hints — fire once per flag, only for Classic mode.
  // Kept separate from the stats/achievements effect below so hints fire for
  // guests too (not gated on userProfile.username).
  // Priority: capsule > vibestreak > bomb (rarest feels most rewarding).
  useEffect(() => {
    if (!game.lastTurnResult) return;
    if (game.state?.gameMode !== "classic") return;
    const result = game.lastTurnResult;
    const createdTypes = new Set(result.specialTilesCreated.map(s => s.type));
    if (!ftue.has("cosmicBlastHintShown") && createdTypes.has("cosmic_blast")) {
      ftue.mark("cosmicBlastHintShown");
      setFtueHint("cosmicBlast");
    } else if (!ftue.has("vibestreakHintShown") && createdTypes.has("vibestreak")) {
      ftue.mark("vibestreakHintShown");
      setFtueHint("vibestreak");
    } else if (!ftue.has("bombHintShown") && createdTypes.has("bomb")) {
      ftue.mark("bombHintShown");
      setFtueHint("bomb");
    }
    // No mid-game capsule flash — the game-over screen already shows the
    // "Pin Capsule Earned!" confirmation, and the server is the source of
    // truth for whether the capsule actually awarded.
  }, [game.lastTurnResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // FTUE first-move nudge — if a first-time classic player sits on the board
  // for 5s without making a move, show a gentle "swap two adjacent badges" hint.
  useEffect(() => {
    if (ftue.has("firstMoveShown")) return;
    if (view !== "playing") return;
    if (game.state?.gameMode !== "classic") return;
    if (game.lastTurnResult) return; // they've already moved
    const t = setTimeout(() => {
      ftue.mark("firstMoveShown");
      setFtueHint("firstMove");
    }, 5000);
    return () => clearTimeout(t);
  }, [view, game.state?.gameMode, game.lastTurnResult]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleStartGame = async (mode: GameMode, username?: string, avatarUrl?: string) => {
    // First-time Classic player: show the primer card before kicking off.
    // Daily games skip the primer (one-shot players shouldn't be gated).
    if (mode === "classic" && !ftue.has("primerShown")) {
      // iOS Safari: unlock audio synchronously during this tap so later BGM starts work.
      unlockAudio();
      setFtuePending({ mode, username, avatarUrl });
      return;
    }
    await actuallyStartGame(mode, username, avatarUrl);
  };

  const actuallyStartGame = async (mode: GameMode, username?: string, avatarUrl?: string) => {
    if (username) {
      setUserProfile({ username, avatarUrl: avatarUrl || "" });
    }

    // Crucial for iOS/Safari: MUST interact with AudioContext during a direct click/tap event
    unlockAudio();

    // Issue match token at game START. For daily, the server atomically sets
    // the daily_played marker here — if it's already set (e.g. user refreshed
    // mid-daily), the server rejects and we route back to landing.
    if (username) {
      const result = await pinBook.trackGame(mode);
      if (!result.ok) {
        if (result.error === 'Daily already played today') {
          toast.error("You already played the Daily Challenge today! Come back tomorrow.");
        } else {
          toast.error("Could not start game. Try again.");
        }
        return;
      }
    }

    // Reset per-game FTUE UI state
    setFtueHint(null);
    setFtuePostGame(null);

    // Vibe Draft disabled for now — slows down replayability
    // To re-enable: route classic mode to drafting view with selectDraftPool()
    game.startGame(mode);
    setCapsuleEarned(false);
    gameSessionStats.current = { bombsCreated: 0, vibestreaksCreated: 0, cosmicBlastsCreated: 0, crossCount: 0, shapesLanded: [] };
    setIsDealing(true);
    setView("playing");
    startBGM();
  };

  const handleFtuePrimerContinue = async () => {
    ftue.mark("primerShown");
    const pending = ftuePending;
    setFtuePending(null);
    if (pending) {
      await actuallyStartGame(pending.mode, pending.username, pending.avatarUrl);
    }
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

  const handlePlayAgain = async () => {
    // Only classic supports "play again" — daily is one per day. If we're here
    // for a classic game, issue a fresh match token at the new game's start.
    const mode = game.state?.gameMode;
    if (mode === 'classic' && userProfile?.username) {
      // CRITICAL: wait for the prior game's end flow (logGame + earnCapsule +
      // achievements) to finish before issuing a new trackGame. Otherwise the
      // server sees the previous match as "unlogged + <5min old" and burns
      // the new match's prizeEligible flag — which silently kills capsule
      // rewards even on 15K+ runs.
      if (gameEndPromiseRef.current) {
        await gameEndPromiseRef.current.catch(() => {});
      }
      const result = await pinBook.trackGame(mode);
      if (!result.ok) {
        toast.error("Could not start game. Try again.");
        return;
      }
    }
    // Reset per-game FTUE UI so hints / modals can still fire on future games
    setFtueHint(null);
    setFtuePostGame(null);
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
              bonusPrizeGames={pinBook.state.bonusPrizeGames}
              pinsCollected={Object.keys(pinBook.state.pins).length}
              onOpenBuyPrizeGames={() => setShowBuyPrizeGames(true)}
              referralCode={referralCode}
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

                <div className="pointer-events-none flex items-center justify-center z-50 mt-1 sm:mt-2">
                  <Image
                    src="/assets/logo.png"
                    alt="VIBE MATCH"
                    width={1000}
                    height={627}
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
              <div className="hidden lg:flex flex-col justify-center w-56 flex-shrink-0 min-w-0 -mb-1 sm:-mb-2" style={{ height: "min(100vw - 8px, calc(100dvh - 220px), 680px)" }}>
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
                    isPrizeGame={(game.state?.gameMode || 'classic') === 'classic' && pinBook.state.classicPlays < (10 + pinBook.state.bonusPrizeGames)}
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
        onStartGame={() => handleStartGame("classic", userProfile?.username, userProfile?.avatarUrl)}
        onOpenReroll={() => { setShowPinBook(false); setShowReroll(true); }}
        onOpenBuyPrizeGames={() => { setShowPinBook(false); setShowBuyPrizeGames(true); }}
        prizeGamesRemaining={Math.max(0, (10 + pinBook.state.bonusPrizeGames) - pinBook.state.classicPlays)}
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

            // Re-check achievements after new pin collected (tier completions, etc.)
            if (userProfile?.username) {
              const ctx = buildPlayerContext(pinBook.state.pins, { totalPinsOpened: pinBook.state.totalOpened });
              const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
              if (ids.length > 0) achievements.unlock(ids);
            }
          }}
        />
      )}


      {/* Reroll Modal */}
      {showReroll && (
        <WalletProvider>
          <RerollModal
            isOpen={showReroll}
            onClose={() => setShowReroll(false)}
            pins={pinBook.state.pins}
            onSuccess={() => pinBook.load()}
          />
        </WalletProvider>
      )}

      {/* Buy Prize Games Modal — only mount when open (keeps wallet context scoped) */}
      {showBuyPrizeGames && (
        <WalletProvider>
          <BuyPrizeGamesModal
            isOpen={showBuyPrizeGames}
            onClose={() => setShowBuyPrizeGames(false)}
            currentBonus={pinBook.state.bonusPrizeGames}
            onSuccess={(newBonusTotal) => {
              pinBook.setBonusPrizeGames(newBonusTotal);
            }}
          />
        </WalletProvider>
      )}

      {/* First-time prize games onboarding (running-low or capped variants) */}
      <PrizeGamesOnboarding
        isOpen={prizeOnboarding !== null}
        variant={prizeOnboarding?.variant || "running-low"}
        remaining={prizeOnboarding?.remaining || 0}
        onClose={() => setPrizeOnboarding(null)}
        onBuy={() => {
          setPrizeOnboarding(null);
          setShowBuyPrizeGames(true);
        }}
      />

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
        referralCode={referralCode}
        onSuccess={(username, avatarUrl) => {
          setUserProfile({ username, avatarUrl });
          localStorage.setItem('vibematch_username', username);
          setShowSystemAuthModal(false);
          pinBook.load(); // Load pin book after login
          achievements.load(); // Load achievements after login
        }}
      />

      {/* FTUE: pre-game primer card (first Classic game only) */}
      <AnimatePresence>
        {ftuePending && (
          <FtuePrimer onContinue={handleFtuePrimerContinue} />
        )}
      </AnimatePresence>

      {/* FTUE: in-game contextual hints (one-shot each, auto-dismiss) */}
      <AnimatePresence>
        {ftueHint && view === "playing" && (
          <FtueHint kind={ftueHint} onDismiss={() => setFtueHint(null)} />
        )}
      </AnimatePresence>

      {/* FTUE: post-game one-shot modals (capsule or tryAgain), only while game is over */}
      <AnimatePresence>
        {ftuePostGame && game.state?.gamePhase === "gameover" && (
          <FtuePostGame
            variant={ftuePostGame}
            score={game.state.score}
            onPrimary={() => {
              const variant = ftuePostGame;
              setFtuePostGame(null);
              if (variant === "capsule") {
                // "Show Me" → open pin book so they can open the capsule
                setShowPinBook(true);
              } else {
                // "Play Again" on try-again variant
                if (game.state?.gameMode === "classic" && userProfile?.username) {
                  pinBook.trackGame("classic").then(result => {
                    if (result.ok) {
                      setFtueHint(null);
                      setIsDealing(true);
                      game.resetGame();
                    }
                  });
                }
              }
            }}
            onSecondary={() => {
              const variant = ftuePostGame;
              setFtuePostGame(null);
              if (variant === "capsule") {
                // "Play Again" secondary on capsule variant
                if (game.state?.gameMode === "classic" && userProfile?.username) {
                  pinBook.trackGame("classic").then(result => {
                    if (result.ok) {
                      setFtueHint(null);
                      setIsDealing(true);
                      game.resetGame();
                    }
                  });
                }
              } else {
                // "Home" secondary on try-again variant
                stopBGM();
                pinBook.load();
                setView("landing");
              }
            }}
          />
        )}
      </AnimatePresence>
    </main >
  );
}
