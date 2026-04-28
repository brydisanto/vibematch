import type { Metadata } from "next";
import GameGuideClient from "./GameGuideClient";

export const metadata: Metadata = {
    title: "Pin Drop, How to Play",
    description:
        "Everything you need to master Pin Drop. Scoring, power tiles, shape bonuses, the Collector ladder, and the Daily Challenge.",
    openGraph: {
        title: "Pin Drop, How to Play",
        description: "Match pins. Score big. Climb the Collector ladder.",
        images: ["/assets/logo-v3.png"],
    },
};

export default function GameGuidePage() {
    return <GameGuideClient />;
}
