"use client";

import { useEffect, useState } from "react";
import { GameMode } from "@/lib/gameEngine";
import LandingPageQuest from "./LandingPageQuest";

interface LandingPageProps {
    onStartGame: (mode: GameMode, username?: string, avatarUrl?: string) => void;
    onShowInstructions?: () => void;
    onLogout?: () => void;
    onOpenPinBook?: () => void;
    onOpenAchievements?: () => void;
    onOpenBuyPrizeGames?: () => void;
    onAuthSuccess?: (username: string, avatarUrl: string) => void;
    capsuleCount?: number;
    achievementCount?: number;
    classicPlays?: number;
    bonusPrizeGames?: number;
    pinsCollected?: number;
    referralCode?: string | null;
    userProfile?: { username: string; avatarUrl: string } | null;
}

/**
 * Landing-page dispatcher. Chooses between the Quest (mobile) and Arcade
 * (desktop) layouts based on viewport width. ≥1024px (iPad landscape and
 * larger) gets the desktop arcade cabinet; everything below gets the mobile
 * Quest Cards layout.
 *
 * This file is intentionally thin — all landing logic lives in the two
 * layout components.
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

    // SSR / pre-mount: render mobile layout. Prevents layout-flash for
    // desktop users, but keeps the first paint predictable.
    if (!mounted || !isDesktop) {
        return <LandingPageQuest {...props} />;
    }

    // Phase 4 will swap this to <LandingPageArcade {...props} />. Until
    // then, desktop viewers see the mobile layout centered — still good,
    // just not the full cabinet treatment yet.
    return <LandingPageQuest {...props} />;
}
