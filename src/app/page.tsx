import type { Metadata } from "next";
import AppClient from "./AppClient";

const BASE_URL = "https://vibematch.app";
const DEFAULT_TITLE = "Pin Drop | Good Vibes Club";
const DEFAULT_DESCRIPTION =
    "Match-3 puzzle game featuring GVC pins. Match pins, score big, climb the leaderboard.";

type SP = {
    user?: string;
    score?: string;
    capsules?: string;
    ref?: string;
};

function sanitizeShareParams(params: SP) {
    const user = (params.user ?? "").toString().slice(0, 24);
    const scoreNum = Number(params.score);
    const score =
        Number.isFinite(scoreNum) && scoreNum >= 0
            ? Math.min(Math.floor(scoreNum), 1_000_000)
            : 0;
    const capsulesNum = Number(params.capsules);
    const capsules =
        Number.isFinite(capsulesNum) && capsulesNum >= 0
            ? Math.min(Math.floor(capsulesNum), 10)
            : 0;
    return { user, score, capsules };
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<SP>;
}): Promise<Metadata> {
    const params = await searchParams;
    const { user, score, capsules } = sanitizeShareParams(params);

    // Only switch to the share-specific card when a share URL is present
    // (both user and score must be non-default).
    const isShare = !!user && score > 0;

    if (!isShare) {
        return {
            title: DEFAULT_TITLE,
            description: DEFAULT_DESCRIPTION,
        };
    }

    const ogUrl = `${BASE_URL}/api/og/score?user=${encodeURIComponent(
        user,
    )}&score=${score}&capsules=${capsules}`;
    const title = `${user} scored ${score.toLocaleString()} on Pin Drop`;
    const description =
        capsules > 0
            ? `${capsules} ${capsules === 1 ? "capsule" : "capsules"} earned. A Good Vibes Club Game.`
            : "Match pins, earn capsules, collect 'em all. A Good Vibes Club Game.";

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `${BASE_URL}/?user=${encodeURIComponent(user)}&score=${score}&capsules=${capsules}`,
            images: [{ url: ogUrl, width: 1200, height: 630 }],
            siteName: "Pin Drop",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogUrl],
        },
    };
}

export default function Page() {
    return <AppClient />;
}
