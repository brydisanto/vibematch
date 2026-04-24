import type { Metadata } from "next";
import GameGuideClient from "./GameGuideClient";

export const metadata: Metadata = {
    title: "VibeMatch — Player Guide",
    description:
        "Everything you need to master VibeMatch — scoring, power tiles, shape bonuses, the Collector ladder, and the Daily Challenge.",
    openGraph: {
        title: "VibeMatch — Player Guide",
        description: "Match badges. Score big. Climb the Collector ladder.",
        images: ["/assets/logo.png"],
    },
};

export default function GameGuidePage() {
    return <GameGuideClient />;
}
