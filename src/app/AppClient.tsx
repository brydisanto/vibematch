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
import MoveLogModal from "@/components/MoveLogModal";
import AuthModal from "@/components/AuthModal";
import FlameBackground from "@/components/FlameBackground";
import BubbleGumBackground from "@/components/BubbleGumBackground";
import { isPromoActive, getPrimaryActiveEvent } from "@/lib/promo-badges";
import SettingsModal from "@/components/SettingsModal";
import PinBook from "@/components/PinBook";
import VibeCapsule from "@/components/VibeCapsule";
import CapsuleSequence from "@/components/CapsuleSequence";
import PrizeGamesOnboarding from "@/components/PrizeGamesOnboarding";
import dynamic from "next/dynamic";

// Wallet-dependent components loaded client-only (RainbowKit uses localStorage)
const BuyPrizeGamesModal = dynamic(() => import("@/components/arcade/PrizeShopDrawer"), { ssr: false });
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
  const [showMoveLog, setShowMoveLog] = useState(false);
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
  const [pinBookInitialTab, setPinBookInitialTab] = useState<"collection" | "leaderboard" | "capsules">("collection");
  const [showCapsule, setShowCapsule] = useState(false);
  const [capsuleSequenceCount, setCapsuleSequenceCount] = useState(0);
  const [capsuleSequenceMode, setCapsuleSequenceMode] = useState<"chain" | "bulk">("chain");
  const [showCapsuleSequence, setShowCapsuleSequence] = useState(false);
  const [capsuleEarned, setCapsuleEarned] = useState(false);
  const [bonusCapsuleFlash, setBonusCapsuleFlash] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  // Cached streak + referral count from the retroactive-achievement
  // useEffect so the AchievementsPanel can render accurate progress
  // bars for streak / refer quests without re-fetching on open.
  const [streakSnapshot, setStreakSnapshot] = useState(0);
  const [referralSnapshot, setReferralSnapshot] = useState(0);
  const [showBuyPrizeGames, setShowBuyPrizeGames] = useState(false);
  const [prizeOnboarding, setPrizeOnboarding] = useState<null | { variant: "running-low" | "capped"; remaining: number }>(null);
  const [showReroll, setShowReroll] = useState(false);
  // WalletProvider lazy-mount gate. Mounting WagmiProvider +
  // QueryClientProvider + RainbowKitProvider at root on every render
  // was the dominant mobile-perf regression vs the Frenzy branch — even
  // when no wallet UI was visible. Defer mount until a wallet-using
  // surface actually needs the context, then stay mounted for the
  // session so connection state persists across modal opens.
  const [walletReady, setWalletReady] = useState(false);
  useEffect(() => {
    if (showReroll || showBuyPrizeGames) {
      setWalletReady(true);
    }
  }, [showReroll, showBuyPrizeGames]);
  // Wallet-touching surfaces nested deep in landing components (Profile
  // modal -> WalletTracker + RainbowConnectButton) can't lift their open
  // state up. Expose a global so any click handler can flip walletReady
  // sync, and React batches it with the consumer's own state update so
  // WagmiProvider mounts in the same render the child needs context.
  useEffect(() => {
    (window as unknown as { __pdEnsureWallet?: () => void }).__pdEnsureWallet = () => setWalletReady(true);
    return () => {
      delete (window as unknown as { __pdEnsureWallet?: () => void }).__pdEnsureWallet;
    };
  }, []);
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
  // Defense in depth against the Frenzy gamePhase bounce: even if a
  // gameover → playing → gameover transition slips through, only run
  // the end-flow (log + earnCapsule + achievements) once per matchId.
  // Cleared in handleStartGame so the next match's matchId can re-trigger.
  const lastProcessedGameOverMatchIdRef = useRef<string | null>(null);

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

          // Check for unclaimed Daily Champion bonus. Server is idempotent
          // per-day — hitting this multiple times only credits once. If the
          // user is yesterday's #1, they get +3 capsules with a toast.
          fetch("/api/daily-champ-bonus")
            .then(r => r.ok ? r.json() : null)
            .then(bonus => {
              if (bonus?.claimed && bonus.capsules > 0) {
                toast.success(
                  `🏆 Daily Champion! +${bonus.capsules} capsules for winning yesterday's challenge.`,
                  { duration: 6000 }
                );
                // Reload pinbook so the rail's capsule count reflects the new total.
                pinBook.load();
              }
            })
            .catch(() => { /* non-critical */ });
        }
      })
      .catch(err => console.error("Initial session check failed:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // `musicChangedTick` lets ProfileModal / SettingsModal signal a BGM-track
  // change up to this component, so the music-change journey quest can
  // trigger retroactively without waiting for the next game to end.
  // ProfileModal dispatches a `vm:music-changed` window event; we bump
  // the tick to re-fire the retroactive check.
  const [musicChangedTick, setMusicChangedTick] = useState(0);
  useEffect(() => {
    const handler = () => setMusicChangedTick(t => t + 1);
    window.addEventListener("vm:music-changed", handler);
    return () => window.removeEventListener("vm:music-changed", handler);
  }, []);

  // Retroactive achievement check. Re-runs on mount AND whenever any
  // context flag that drives a journey/mastery quest changes — avatar URL,
  // bonus prize games, or a music-change tick — so quests like Face Lift
  // / Set The Vibe fire immediately after the user does the thing, not
  // only after their next game.
  useEffect(() => {
    if (!achievements.state.loaded || !pinBook.state.loaded || !userProfile?.username) return;

    // Fetch streak + referral count + user-flags in parallel, then check
    // retroactive achievements. We need the flags from /api/user-flags so the
    // client-side ctx knows about server-set signals like vibestrHolder
    // (otherwise wallet_vibestr never makes it into the unlock POST body).
    Promise.all([
      fetch(`/api/streak?username=${userProfile.username}`).then(r => r.json()).catch(() => ({ streak: 0 })),
      fetch('/api/referral').then(r => r.json()).catch(() => ({ totalReferrals: 0 })),
      fetch('/api/user-flags').then(r => r.json()).catch(() => ({ flags: {} })),
    ]).then(([streakData, referralData, flagsData]) => {
      const flags = (flagsData?.flags || {}) as {
        musicChanged?: boolean;
        avatarUploaded?: boolean;
        prizeGamePurchased?: boolean;
        vibestrHolder?: boolean;
      };
      const ctx = buildPlayerContext(pinBook.state.pins, {
        totalPinsOpened: pinBook.state.totalOpened,
        totalFoundByTier: pinBook.state.totalFoundByTier,
        hasUploadedAvatar:
          !!userProfile?.avatarUrl || !!flags.avatarUploaded,
        hasChangedMusic:
          (typeof window !== "undefined" && localStorage.getItem("vibematch_bgm_track") !== null) ||
          !!flags.musicChanged,
        hasPurchasedPrizeGame:
          (pinBook.state.bonusPrizeGames || 0) > 0 || !!flags.prizeGamePurchased,
        hasVibestrWallet: !!flags.vibestrHolder,
        // pinbook.classicPlays is the today's classic+frenzy play count
        // (resets nightly via the daily-tracker key). Includes bonus games
        // since the server increments it on every trackGame regardless of
        // base vs bonus. Without this, the Weekly Warrior quest
        // (daily_cap, "Play 15 games in one day") could never unlock —
        // gamesPlayedToday defaulted to 0.
        gamesPlayedToday: pinBook.state.classicPlays,
        lifetimeRerollsCompleted: pinBook.state.lifetimeRerollsCompleted,
        lifetimeBonusGamesPurchased: pinBook.state.lifetimeBonusGamesPurchased,
        hasCollectedEventPin: pinBook.state.hasCollectedEventPin,
      });
      ctx.streak = streakData.streak || 0;
      ctx.referralCount = referralData.totalReferrals || 0;
      setStreakSnapshot(ctx.streak);
      setReferralSnapshot(ctx.referralCount);
      const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
      if (ids.length > 0) {
        achievements.unlock(ids).then(unlockedIds => {
          // Achievements award capsules server-side — reload the pinbook so
          // the capsule count in the UI reflects them without a page refresh.
          if (unlockedIds.length > 0) pinBook.load();
        });
      }
    });
  }, [
    achievements.state.loaded,
    pinBook.state.loaded,
    userProfile?.username,
    userProfile?.avatarUrl,
    pinBook.state.bonusPrizeGames,
    musicChangedTick,
    // Tier-find counts so cross-threshold collects (e.g. picking up your
    // 10th Cosmic) re-fire the retroactive achievement check without
    // requiring a page reload. Each one is a primitive so React's shallow
    // compare works without ref churn.
    pinBook.state.totalFoundByTier?.blue,
    pinBook.state.totalFoundByTier?.silver,
    pinBook.state.totalFoundByTier?.special,
    pinBook.state.totalFoundByTier?.gold,
    pinBook.state.totalFoundByTier?.cosmic,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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
  //
  // Note: achievements.state.loaded is NOT a guard at the top level. If a
  // player finishes a game before their achievements have loaded (slow
  // network on landing), we still need to logGame + earnCapsule. Skipping
  // them entirely caused the "Previous game wasn't finished" toast to
  // wrongly fire on the next play: the unlogged match was treated as
  // abandoned and burned the new match's prize eligibility. Achievements
  // checking is conditionally skipped further down instead.
  useEffect(() => {
    if (game.state?.gamePhase !== "gameover" || !userProfile?.username) return;
    // Dedupe by matchId. The Frenzy timer can fire gameover twice
    // when a late-cascade adds bonus time (gamePhase bounces gameover
    // → playing → gameover). Without this guard, logGame writes a
    // second feed entry and earnCapsule rejects with "Capsule already
    // claimed for this match".
    const currentMatchId = pinBook.getActiveMatchId();
    if (currentMatchId && lastProcessedGameOverMatchIdRef.current === currentMatchId) {
      return;
    }
    if (currentMatchId) lastProcessedGameOverMatchIdRef.current = currentMatchId;
    const mode = game.state.gameMode || 'classic';
    const gs = game.state;
    const stats = gameSessionStats.current;

    gameEndPromiseRef.current = (async () => {
      // Match token was already issued at game START (handleStartGame).
      // No need to call trackGame here — just use the existing token.

      // 1. Log game stats (persists authoritative stats keyed by matchId for achievements)
      //    moveSequence is the deterministic record of player actions —
      //    Phase 2 of the server-authoritative score scope. Stored
      //    server-side now; Phase 3 will replay it to validate the score.
      //    behavioral is Tier-1 bot-detection telemetry: navigator.webdriver
      //    flag, count of untrusted PointerEvents, and total game duration.
      const behavioral = game.getBehavioralMeta();
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
      }, mode, gs.moveSequence ?? [], behavioral);

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
          // confusion. Surface the specific reason instead. The server
          // returns `abandonedPrevious: true` when the anti-refresh-shop
          // rule burned this match — that's distinct from a legitimate
          // daily-cap exhaustion and the copy should say so.
          const r = result as { capped?: boolean; abandonedPrevious?: boolean; reason?: string };
          if (r.abandonedPrevious) {
            toast.error("No capsule. Previous game wasn't finished before starting this one.");
          } else if (r.capped) {
            toast.error("Daily play cap reached. Buy bonus games for more capsules.");
          } else if (r.reason) {
            toast.error(`Capsule not awarded: ${r.reason}`);
          } else {
            toast.error("Could not award capsule. Try again.");
          }
        }
      }

      // First-time FTUE modal — only in classic mode.
      //   - If this is the user's first-ever actual capsule earn, push them
      //     to the Pin Book with the "First Capsule" reveal modal.
      //   - Else if this is their first game ending UNDER the 15K capsule
      //     threshold, show the "So close" encouragement modal. Guard on
      //     score<15K so the modal doesn't fire (with its "hit 15K+ next
      //     time" copy) on high-score runs that legitimately missed a
      //     capsule for other reasons (e.g. abandonedPrevious anti-abuse).
      if (mode === "classic") {
        if (actuallyEarnedCapsule && !ftue.has("firstCapsuleShown")) {
          ftue.mark("firstCapsuleShown");
          setTimeout(() => setFtuePostGame("capsule"), 800);
        } else if (!actuallyEarnedCapsule && gs.score < 15000 && !ftue.has("firstFailShown")) {
          ftue.mark("firstFailShown");
          setTimeout(() => setFtuePostGame("tryAgain"), 800);
        }
      }

      // 4. Check end-of-game achievements with match context for server-side
      //    verification. Skip if achievements haven't loaded yet — without
      //    the loaded unlock set, checkAchievements would re-fire every
      //    eligible achievement, causing duplicate-unlock noise on the
      //    server. Better to no-op than to spam.
      if (achievements.state.loaded) {
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
        const playerCtx = buildPlayerContext(pinBook.state.pins, {
          totalPinsOpened: pinBook.state.totalOpened,
          totalFoundByTier: pinBook.state.totalFoundByTier,
          hasUploadedAvatar: !!userProfile?.avatarUrl,
          hasChangedMusic: typeof window !== "undefined" && localStorage.getItem("vibematch_bgm_track") !== null,
          hasPurchasedPrizeGame: (pinBook.state.bonusPrizeGames || 0) > 0,
          gamesPlayedToday: pinBook.state.classicPlays,
          lifetimeRerollsCompleted: pinBook.state.lifetimeRerollsCompleted,
          lifetimeBonusGamesPurchased: pinBook.state.lifetimeBonusGamesPurchased,
          hasCollectedEventPin: pinBook.state.hasCollectedEventPin,
        });
        const ids = checkAchievements(gameEndStats, playerCtx, achievements.getUnlockedSet());
        if (ids.length > 0) {
          await achievements.unlock(ids, { matchId: pinBook.getActiveMatchId(), gameMode: mode });
        }
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

      // Mark this match as finished on the client so the next trackGame
      // call can tell the server "the user really did finish this", even
      // if logGame's POST landed in the retry queue. Without this, a
      // failed-then-retried logGame leaves the server thinking the match
      // was abandoned and the next game gets falsely flagged EXTRA PLAY.
      pinBook.markGameFinished(pinBook.getActiveMatchId());
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
          // Was 2s — bumped to 2.6s so the bigger confetti + longer
          // hold of the headline have room to breathe before fade.
          setTimeout(() => setBonusCapsuleFlash(false), 2600);
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
    // Only fire FTUE hints for specials the player ACTUALLY produced with
    // their swap — not cascade side-effects (e.g. a random 6-in-a-row that
    // forms when bomb-cleared cells refill with fresh tiles would otherwise
    // pop "For matching 6 in a row" even though the player just exploded
    // bombs).
    const createdTypes = new Set(
      result.specialTilesCreated.filter(s => s.isInitial).map(s => s.type)
    );
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

    // If the previous game's end flow is still running (logGame clears the
    // activeMatch pointer on completion), wait for it. Otherwise a rapid
    // HOME→PLAY can race trackGame before the old match is marked logged,
    // tripping the abandonedPrevious anti-abuse rule on the new match and
    // silently killing its prize eligibility.
    if (gameEndPromiseRef.current) {
      await gameEndPromiseRef.current.catch(() => {});
    }
    // Reset the gameover-dedupe guard so the new match's matchId can
    // re-trigger the end-flow useEffect.
    lastProcessedGameOverMatchIdRef.current = null;

    // Issue match token at game START. For daily, the server atomically sets
    // the daily_played marker here — if it's already set (e.g. user refreshed
    // mid-daily), the server rejects and we route back to landing.
    // Server also issues a deterministic seed for Classic + Frenzy (Phase 3
    // replay verification); we capture it and thread it into startGame so the
    // client renders the same board the server will replay against.
    let serverSeed: number | undefined;
    if (username) {
      const result = await pinBook.trackGame(mode);
      if (!result.ok) {
        if (result.outOfPlays) {
          // Hard cap hit. Open the buy-bonus-games modal so the player
          // can get more attempts or come back tomorrow.
          toast.error("Out of plays today! Buy bonus games or come back tomorrow.");
          setShowBuyPrizeGames(true);
        } else if (result.error === 'Daily already played today') {
          toast.error("You already played the Daily Challenge today! Come back tomorrow.");
        } else {
          toast.error("Could not start game. Try again.");
        }
        return;
      }
      serverSeed = result.seed;
    }

    // Reset per-game FTUE UI state
    setFtueHint(null);
    setFtuePostGame(null);

    // Vibe Draft disabled for now — slows down replayability
    // To re-enable: route classic mode to drafting view with selectDraftPool()
    // Await startGame so badge images finish preloading BEFORE the view
    // switches — otherwise the board renders with an empty grid until
    // the images finish loading a beat later.
    setCapsuleEarned(false);
    gameSessionStats.current = { bombsCreated: 0, vibestreaksCreated: 0, cosmicBlastsCreated: 0, crossCount: 0, shapesLanded: [] };
    await game.startGame(mode, { seed: serverSeed });
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

  const handleDraftComplete = async (drafted: Badge[]) => {
    // Await so badge images preload before the view switches — keeps
    // the board from flashing empty tiles on mount.
    await game.startGameWithBadges(draftMode, drafted);
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
    let playAgainSeed: number | undefined;
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
        if (result.outOfPlays) {
          // Cap hit on play-again. Bounce them home and pop the buy modal.
          toast.error("Out of plays today! Buy bonus games or come back tomorrow.");
          setShowBuyPrizeGames(true);
          stopBGM();
          setView("landing");
          return;
        }
        toast.error("Could not start game. Try again.");
        return;
      }
      playAgainSeed = result.seed;
    }
    // Reset per-game FTUE UI so hints / modals can still fire on future games
    setFtueHint(null);
    setFtuePostGame(null);
    // Await so badge images preload before dealing animation fires.
    await game.resetGame({ seed: playAgainSeed });
    setIsDealing(true);
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

  // Lazy-wrap the entire tree in WalletProvider only once a wallet
  // flow is requested. Wagmi + RainbowKit + QueryClient mounting at
  // root was running react-context machinery + RainbowKit DOM injection
  // on every parent render during gameplay, which on iPhone Safari
  // showed up as a measurable mobile lag vs the Frenzy branch. Once
  // mounted, the provider stays mounted for the session so wallet
  // connection state persists across modal opens (the original reason
  // for hoisting it). Wallet-aware modals (Reroll, BuyPrizeGames,
  // ProfileModal, etc.) all live inside `inner`, so once the wrap
  // flips on they get the context they expect.
  const inner = (
    <main className="min-h-screen bg-[#050505] relative">

      {view === "playing" && (() => {
        // Swap the default flame ambience for the Bubble Gum cityscape
        // while a set event (Craig's Bubble Gum Blast) is running.
        // Falls back to FlameBackground the moment the event ends /
        // no set is active, so unrelated future promos keep their
        // native aesthetic.
        const useBubbleGum = isPromoActive() && getPrimaryActiveEvent()?.kind === "set";
        return useBubbleGum ? <BubbleGumBackground /> : <FlameBackground />;
      })()}
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
              onOpenPinBook={(tab) => { setPinBookInitialTab(tab ?? "collection"); setShowPinBook(true); }}
              onProfileUpdate={(username, avatarUrl) => {
                // Propagate saved avatar/username up so the rail re-renders
                // without a page reload. Also re-runs the retroactive effect
                // (depends on avatarUrl) so Face Lift fires immediately.
                setUserProfile({ username, avatarUrl });
              }}
              onOpenAchievements={() => { setShowAchievements(true); achievements.markSeen(); }}
              capsuleCount={pinBook.state.capsules}
              achievementCount={achievements.unseenCount}
              classicPlays={pinBook.state.classicPlays}
              bonusPrizeGames={pinBook.state.bonusPrizeGames}
              pinsCollected={Object.keys(pinBook.state.pins).length}
              pins={pinBook.state.pins}
              questsCompleted={Object.keys(achievements.state.unlocked).length}
              unlockedAchievementIds={Object.keys(achievements.state.unlocked)}
              onOpenBuyPrizeGames={() => setShowBuyPrizeGames(true)}
              onOpenReroll={() => setShowReroll(true)}
              onAuthSuccess={(username, avatarUrl) => {
                setUserProfile({ username, avatarUrl });
                localStorage.setItem('vibematch_username', username);
                pinBook.load();
                achievements.load();
              }}
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

            {/* Top bar — Back + Logo + Help. Logo is absolutely centered
                so the asymmetric button groups (2 left, 3 right) can't
                drag it off the screen midline. Safe-area-inset-top is
                added for PWA / standalone mode where the OS status bar
                isn't reserved by the browser chrome. */}
            <div className="flex-shrink-0 z-40 px-3 sm:px-4 pt-[max(0.25rem,env(safe-area-inset-top))] pb-0 relative">
              {/* min-height reserves space for the absolutely-positioned
                  logo so the game board below sits below it instead of
                  underneath. Heights mirror logo h-20 / sm:h-32 / lg:h-44
                  (80 / 128 / 176px) plus the small top margin. */}
              <div className="relative flex items-start justify-between w-full min-h-[5.5rem] sm:min-h-[9rem] lg:min-h-[12rem]">
                <div className="flex-1 flex justify-start gap-2 pt-1 sm:pt-4 z-10">
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

                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 flex items-center justify-center z-20 mt-1 sm:mt-2">
                  <Image
                    src="/assets/logo-v3.png"
                    alt="PIN DROP"
                    width={1854}
                    height={1623}
                    className="w-auto h-20 sm:h-32 lg:h-44 drop-shadow-[0_12px_45px_rgba(0,0,0,0.85)] object-contain"
                    priority
                    style={{ animation: "vmInGameLogoBob 3.2s ease-in-out infinite" }}
                  />
                </div>

                <div className="flex-1 flex justify-end items-start gap-2 pt-1 sm:pt-4 relative z-10">
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

            {/* Game Layout — Royal Match style: HUD left, Board center.
                Negative top margin compensates for the larger PIN DROP
                header logo so the board sits where it did pre-rebrand. */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center -mt-4 lg:-mt-8 pt-1 pb-2 px-1 sm:p-4 gap-2 sm:gap-4 overflow-y-auto w-full relative z-10">
              {/* Left HUD — Desktop only */}
              <div className="hidden lg:flex flex-col justify-center w-56 flex-shrink-0 min-w-0 -mb-1 sm:-mb-2" style={{ height: "min(100vw - 8px, calc(100dvh - 220px), 680px)" }}>
                <GameHUD
                  state={game.state}
                  username={userProfile?.username}
                  isExtraPlay={pinBook.currentMatchIsExtra}
                  onScoreClick={() => { playUIClick(); setShowMoveLog(true); }}
                />
              </div>

              {/* Mobile HUD Top — Metrics only */}
              <div className="lg:hidden w-full max-w-[680px] flex-shrink-0 pb-1 order-first">
                <div className="w-full">
                  <GameHUD
                    state={game.state}
                    username={userProfile?.username}
                    hideHighScores
                    isExtraPlay={pinBook.currentMatchIsExtra}
                    onScoreClick={() => { playUIClick(); setShowMoveLog(true); }}
                  />
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
                    isPrizeGame={(game.state?.gameMode || 'classic') === 'classic' && !pinBook.currentMatchIsExtra}
                    gameMode={game.state?.gameMode}
                    frenzyPenaltyAt={game.frenzyPenaltyAt}
                    timePenaltyPopups={game.timePenaltyPopups}
                    onPointerTrust={game.recordEventTrust}
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

                  {/* Big confetti burst — bumped from 16 → 56 particles
                      across two waves (32 fast inner + 24 slower outer)
                      with rectangular streamer shapes mixed in to read
                      as proper celebration confetti, not just sparkles. */}
                  {/* Particles converted from per-particle Framer Motion
                      animations to CSS-only — the previous 56 motion.div
                      instances each ran their own JS animation loop,
                      which was the source of the laggy pop-up. Each
                      particle is now a plain <div> with CSS vars
                      (--bp-tx, --bp-ty, etc.) driving the .bonus-particle
                      keyframe, which the browser can GPU-accelerate
                      across the whole set in one composited layer. */}
                  {Array.from({ length: 22 }, (_, i) => {
                    const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                    const dist = 180 + Math.random() * 140;
                    const colors = ["#FFE048", "#FF5F1F", "#B366FF", "#FF6B9D", "#4A9EFF", "#FFFFFF"];
                    const color = colors[i % colors.length];
                    const isStreamer = i % 4 === 0;
                    return (
                      <div
                        key={`bonus-particle-${i}`}
                        className={`absolute bonus-particle ${isStreamer ? "rounded-sm" : "rounded-full"}`}
                        style={{
                          width: isStreamer ? 4 + Math.random() * 3 : 5 + Math.random() * 5,
                          height: isStreamer ? 14 + Math.random() * 8 : 5 + Math.random() * 5,
                          background: color,
                          ['--bp-tx' as string]: `${Math.cos(angle) * dist}px`,
                          ['--bp-ty' as string]: `${Math.sin(angle) * dist}px`,
                          ['--bp-rotate' as string]: `${(i % 2 === 0 ? 1 : -1) * (180 + Math.random() * 360)}deg`,
                          ['--bp-duration' as string]: `${0.75 + Math.random() * 0.35}s`,
                          ['--bp-delay' as string]: `${Math.random() * 0.08}s`,
                        } as React.CSSProperties}
                      />
                    );
                  })}

                  {/* Outer wave: bigger, slower, longer travel with
                      gravity drift. Only outer particles keep a glow so
                      the burst still reads as celebratory without paying
                      the box-shadow cost on every inner dot. */}
                  {Array.from({ length: 14 }, (_, i) => {
                    const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                    const dist = 320 + Math.random() * 180;
                    const colors = ["#FFE048", "#FF5F1F", "#B366FF", "#FF6B9D", "#FFFFFF"];
                    const color = colors[i % colors.length];
                    return (
                      <div
                        key={`bonus-outer-${i}`}
                        className="absolute rounded-full bonus-particle-outer"
                        style={{
                          width: 8 + Math.random() * 6,
                          height: 8 + Math.random() * 6,
                          background: color,
                          boxShadow: `0 0 10px ${color}`,
                          ['--bp-tx' as string]: `${Math.cos(angle) * dist}px`,
                          ['--bp-ty' as string]: `${Math.sin(angle) * dist + 80}px`,
                          ['--bp-rotate' as string]: `${(i % 2 === 0 ? 1 : -1) * 180}deg`,
                          ['--bp-duration' as string]: `${1.4 + Math.random() * 0.5}s`,
                          ['--bp-delay' as string]: `${0.05 + Math.random() * 0.15}s`,
                        } as React.CSSProperties}
                      />
                    );
                  })}

                  {/* Capsule icon + text */}
                  <div className="relative text-center">
                    {/* Pulsing glow behind */}
                    <motion.div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full"
                      style={{ background: "radial-gradient(circle, rgba(255,224,72,0.55) 0%, rgba(179,102,255,0.25) 45%, transparent 75%)" }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.6, 1.3], opacity: [0, 1, 0.7] }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />

                    <motion.div
                      initial={{ scale: 0, y: 20 }}
                      animate={{ scale: [0, 1.35, 1], y: -10 }}
                      transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                      {/* Hybrid treatment — rainbow gradient fill (the
                          old "ath-gradient-shift" look) layered ON TOP
                          of a solid white duplicate that carries the
                          layered drop-band + gold stroke + glow halo.
                          Two stacked spans: bottom = white-fill layered
                          text, top = gradient-clipped shimmer overlay.
                          Reads as "letters shimmer rainbow inside their
                          own gold-outlined dimensional bodies". */}
                      <div className="relative text-5xl sm:text-7xl font-black tracking-wide font-display uppercase">
                        {/* Bottom layer: layered white text (stroke +
                            drop-band + glow halos). */}
                        <span
                          className="block"
                          style={{
                            color: "#FFFFFF",
                            WebkitTextStroke: "5px #FFE048",
                            paintOrder: "stroke fill",
                            textShadow: "0 0 24px rgba(255,224,72,0.9), 0 6px 0 #FFE048, 0 9px 18px rgba(0,0,0,0.85)",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          BONUS CAPSULE!
                        </span>
                        {/* Top layer: rainbow gradient-clipped fill that
                            shimmers. Absolutely positioned on top of
                            the white layer; transparent fill +
                            gradient background means only the LETTER
                            INTERIORS show the rainbow, while the stroke
                            and drop-band from below remain visible. */}
                        <span
                          aria-hidden
                          className="block absolute inset-0 bonus-capsule-shimmer"
                          style={{
                            backgroundImage: "linear-gradient(135deg, #FFE048 0%, #FF6B9D 25%, #B366FF 50%, #4A9EFF 75%, #FFE048 100%)",
                            backgroundSize: "300% 100%",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          BONUS CAPSULE!
                        </span>
                      </div>
                      <motion.div
                        className="text-base sm:text-lg mt-3 font-display font-black tracking-[0.22em] uppercase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.3 }}
                        style={{
                          color: "#FFFFFF",
                          WebkitTextStroke: "1.5px #FFE048",
                          paintOrder: "stroke fill",
                          textShadow: "0 0 18px rgba(255,224,72,0.85), 0 2px 0 #FFE048, 0 4px 10px rgba(0,0,0,0.9)",
                        }}
                      >
                        Shape Match Bonus
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
                  onOpenPinBook={() => { setPinBookInitialTab("capsules"); setShowPinBook(true); }}
                  matchId={pinBook.getActiveMatchId() ?? undefined}
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

      {/* Move Breakdown Modal — opened by tapping the SCORE box during a
          Classic/Daily game. Lazy-mounted UI; data lives on game.state.moveLog. */}
      <MoveLogModal
        isOpen={showMoveLog}
        onClose={() => setShowMoveLog(false)}
        moveLog={game.state?.moveLog ?? []}
        totalScore={game.state?.score ?? 0}
      />

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Pin Book Modal */}
      <PinBook
        isOpen={showPinBook}
        onClose={() => setShowPinBook(false)}
        initialTab={pinBookInitialTab}
        onStartGame={() => handleStartGame("classic", userProfile?.username, userProfile?.avatarUrl)}
        onOpenReroll={() => { setShowPinBook(false); setShowReroll(true); }}
        onOpenBuyPrizeGames={() => { setShowPinBook(false); setShowBuyPrizeGames(true); }}
        prizeGamesRemaining={Math.max(0, (10 + pinBook.state.bonusPrizeGames) - pinBook.state.classicPlays)}
        onOpenCapsule={async (requestedMode) => {
          const count = pinBook.state.capsules;
          if (count <= 0) return;
          if (requestedMode === "one" && count === 1) {
            const reveal = await pinBook.openCapsule();
            if (reveal) {
              setShowPinBook(false);
              setShowCapsule(true);
            }
            return;
          }
          // "one" with count > 1 → chain mode with escape button.
          // "all" → bulk mode (pre-roll everything, single hero reveal, summary).
          setShowPinBook(false);
          setCapsuleSequenceCount(count);
          setCapsuleSequenceMode(requestedMode === "all" ? "bulk" : "chain");
          setShowCapsuleSequence(true);
        }}
        pins={pinBook.state.pins}
        unopenedCapsules={pinBook.state.capsules}
        currentUsername={userProfile?.username}
      />

      {/* Vibe Capsule Opening Animation (single capsule) */}
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
            setPinBookInitialTab("capsules");
            setShowPinBook(true); // Return to pin book after collecting

            // Re-check achievements after new pin collected (tier completions, etc.)
            if (userProfile?.username) {
              const ctx = buildPlayerContext(pinBook.state.pins, {
                totalPinsOpened: pinBook.state.totalOpened,
                totalFoundByTier: pinBook.state.totalFoundByTier,
                hasUploadedAvatar: !!userProfile?.avatarUrl,
                hasChangedMusic: typeof window !== "undefined" && localStorage.getItem("vibematch_bgm_track") !== null,
                hasPurchasedPrizeGame: (pinBook.state.bonusPrizeGames || 0) > 0,
                gamesPlayedToday: pinBook.state.classicPlays,
                lifetimeRerollsCompleted: pinBook.state.lifetimeRerollsCompleted,
                lifetimeBonusGamesPurchased: pinBook.state.lifetimeBonusGamesPurchased,
                hasCollectedEventPin: pinBook.state.hasCollectedEventPin,
              });
              const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
              if (ids.length > 0) {
                achievements.unlock(ids).then(unlockedIds => {
                  if (unlockedIds.length > 0) pinBook.load();
                });
              }
            }
          }}
        />
      )}

      {/* Multi-capsule chain / bulk flow */}
      {showCapsuleSequence && (
        <CapsuleSequence
          isOpen={showCapsuleSequence}
          count={capsuleSequenceCount}
          mode={capsuleSequenceMode}
          openCapsule={pinBook.openCapsule}
          collectReveal={pinBook.collectReveal}
          rollAndCollectCapsule={pinBook.rollAndCollectCapsule}
          onClose={() => {
            setShowCapsuleSequence(false);
            setPinBookInitialTab("capsules");
            setShowPinBook(true);
            // Re-sync server state so anything the server auto-credited
            // during a bulk run (e.g. a stale pending reveal from a prior
            // interrupted session) shows up in the UI immediately.
            pinBook.load();

            // Re-check achievements after the full run completes.
            if (userProfile?.username) {
              const ctx = buildPlayerContext(pinBook.state.pins, {
                totalPinsOpened: pinBook.state.totalOpened,
                totalFoundByTier: pinBook.state.totalFoundByTier,
                hasUploadedAvatar: !!userProfile?.avatarUrl,
                hasChangedMusic: typeof window !== "undefined" && localStorage.getItem("vibematch_bgm_track") !== null,
                hasPurchasedPrizeGame: (pinBook.state.bonusPrizeGames || 0) > 0,
                gamesPlayedToday: pinBook.state.classicPlays,
                lifetimeRerollsCompleted: pinBook.state.lifetimeRerollsCompleted,
                lifetimeBonusGamesPurchased: pinBook.state.lifetimeBonusGamesPurchased,
                hasCollectedEventPin: pinBook.state.hasCollectedEventPin,
              });
              const ids = checkRetroactiveAchievements(ctx, achievements.getUnlockedSet());
              if (ids.length > 0) {
                achievements.unlock(ids).then(unlockedIds => {
                  if (unlockedIds.length > 0) pinBook.load();
                });
              }
            }
          }}
        />
      )}


      {/* Reroll Modal — wallet context comes from the root WalletProvider */}
      {showReroll && (
        <RerollModal
          isOpen={showReroll}
          onClose={() => setShowReroll(false)}
          pins={pinBook.state.pins}
          onSuccess={() => pinBook.load()}
        />
      )}

      {/* Buy Prize Games Modal — wallet context comes from root */}
      {showBuyPrizeGames && (
        <BuyPrizeGamesModal
          isOpen={showBuyPrizeGames}
          onClose={() => setShowBuyPrizeGames(false)}
          currentBonus={pinBook.state.bonusPrizeGames}
          onSuccess={(newBonusTotal) => {
            pinBook.setBonusPrizeGames(newBonusTotal);
          }}
        />
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

      {/* Achievements Panel — build a PlayerContext from live pinbook
          state plus the last-fetched streak/referral snapshots so each
          card can render its own progress bar without extra fetches. */}
      <AchievementsPanel
        isOpen={showAchievements}
        onClose={() => setShowAchievements(false)}
        unlocked={achievements.state.unlocked}
        playerContext={userProfile?.username ? (() => {
          const ctx = buildPlayerContext(pinBook.state.pins, {
            totalPinsOpened: pinBook.state.totalOpened,
            totalFoundByTier: pinBook.state.totalFoundByTier,
            hasUploadedAvatar: !!userProfile.avatarUrl,
            hasChangedMusic: typeof window !== "undefined" && localStorage.getItem("vibematch_bgm_track") !== null,
            hasPurchasedPrizeGame: (pinBook.state.bonusPrizeGames || 0) > 0,
            gamesPlayedToday: pinBook.state.classicPlays,
            lifetimeRerollsCompleted: pinBook.state.lifetimeRerollsCompleted,
            lifetimeBonusGamesPurchased: pinBook.state.lifetimeBonusGamesPurchased,
            hasCollectedEventPin: pinBook.state.hasCollectedEventPin,
          });
          ctx.streak = streakSnapshot;
          ctx.referralCount = referralSnapshot;
          return ctx;
        })() : undefined}
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
            onPrimary={async () => {
              const variant = ftuePostGame;
              setFtuePostGame(null);
              if (variant === "capsule") {
                // "Show Me" → open pin book so they can open the capsule
                setShowPinBook(true);
              } else {
                // "Play Again" on try-again variant
                if (game.state?.gameMode === "classic" && userProfile?.username) {
                  // Wait for the just-finished game's logGame to land before
                  // issuing the new trackGame. Otherwise the server still
                  // sees the previous match as unlogged + recent and burns
                  // the new match's prizeEligible flag.
                  if (gameEndPromiseRef.current) {
                    await gameEndPromiseRef.current.catch(() => {});
                  }
                  const result = await pinBook.trackGame("classic");
                  if (result.ok) {
                    setFtueHint(null);
                    setIsDealing(true);
                    game.resetGame();
                  } else if (result.outOfPlays) {
                    // Hard cap hit. Bounce home + open the buy modal.
                    toast.error("Out of plays today! Buy bonus games or come back tomorrow.");
                    stopBGM();
                    setView("landing");
                    setShowBuyPrizeGames(true);
                  }
                }
              }
            }}
            onSecondary={async () => {
              const variant = ftuePostGame;
              setFtuePostGame(null);
              if (variant === "capsule") {
                // "Play Again" secondary on capsule variant
                if (game.state?.gameMode === "classic" && userProfile?.username) {
                  if (gameEndPromiseRef.current) {
                    await gameEndPromiseRef.current.catch(() => {});
                  }
                  const result = await pinBook.trackGame("classic");
                  if (result.ok) {
                    setFtueHint(null);
                    setIsDealing(true);
                    game.resetGame();
                  } else if (result.outOfPlays) {
                    // Hard cap hit. Bounce home + open the buy modal.
                    toast.error("Out of plays today! Buy bonus games or come back tomorrow.");
                    stopBGM();
                    setView("landing");
                    setShowBuyPrizeGames(true);
                  }
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

  return walletReady ? <WalletProvider>{inner}</WalletProvider> : inner;
}
