"use client";

import { useEffect, useState } from "react";
import { GameMode } from "@/lib/gameEngine";
import LandingPageQuest from "./LandingPageQuest";
import LandingPageArcade from "./LandingPageArcade";

interface LandingPageProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
    onLogout?: () => void;
    onOpenPinBook?: (initialTab?: "collection" | "leaderboard" | "capsules") => void;
    onOpenAchievements?: () => void;
    onOpenBuyPrizeGames?: () => void;
    onOpenReroll?: () => void;
    onProfileUpdate?: (username: string, avatarUrl: string) => void;
    onAuthSuccess?: (username: string, avatarUrl: string) => void;
    capsuleCount?: number;
    achievementCount?: number;
    classicPlays?: number;
    bonusPrizeGames?: number;
    pinsCollected?: number;
    pins?: Record<string, { count: number; firstEarned: string }>;
    questsCompleted?: number;
    referralCode?: string | null;
    userProfile?: { username: string; avatarUrl: string } | null;
}

/**
 * Landing-page dispatcher. Routes to one of three treatments:
 *
 *   - ≥1024px AND logged-in → LandingPageArcade (desktop cabinet)
 *   - anything else          → LandingPageQuest (mobile cards)
 *
 * Guests on desktop intentionally fall through to the Quest layout so
 * the sign-in flow stays simple and uncluttered; the arcade cabinet
 * assumes an authenticated player with a pinbook + score history.
 */
export default function LandingPage(props: LandingPageProps) {
    const [isDesktop, setIsDesktop] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const mq = window.matchMedia("(min-width: 1024px)");
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    // SSR / pre-mount: render mobile. Prevents hydration mismatch for
    // desktop viewers and keeps the first paint predictable.
    if (!mounted) {
        return <LandingPageQuest {...props} />;
    }

    if (isDesktop && props.userProfile) {
        return (
            <LandingPageArcade
                onStartGame={props.onStartGame}
                onShowInstructions={props.onShowInstructions}
                onLogout={props.onLogout}
                onOpenPinBook={props.onOpenPinBook}
                onOpenAchievements={props.onOpenAchievements}
                onOpenBuyPrizeGames={props.onOpenBuyPrizeGames}
                onProfileUpdate={props.onProfileUpdate}
                capsuleCount={props.capsuleCount}
                classicPlays={props.classicPlays}
                bonusPrizeGames={props.bonusPrizeGames}
                pinsCollected={props.pinsCollected}
                pins={props.pins}
                questsCompleted={props.questsCompleted}
                userProfile={props.userProfile}
            />
        );
    }

    return <LandingPageQuest {...props} />;
}
