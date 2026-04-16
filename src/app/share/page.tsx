import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = "https://vibematch.app";

type SP = { user?: string; score?: string; capsules?: string };

function sanitize(params: SP) {
    const user = (params.user ?? "").toString().slice(0, 24) || "player";
    const scoreNum = Number(params.score);
    const score = Number.isFinite(scoreNum) && scoreNum >= 0
        ? Math.min(Math.floor(scoreNum), 1_000_000)
        : 0;
    const capsulesNum = Number(params.capsules);
    const capsules = Number.isFinite(capsulesNum) && capsulesNum >= 0
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
    const { user, score, capsules } = sanitize(params);

    const ogUrl = `${BASE_URL}/api/og/score?user=${encodeURIComponent(user)}&score=${score}&capsules=${capsules}`;
    const title = `${user} scored ${score.toLocaleString()} on VibeMatch`;
    const description = capsules > 0
        ? `${capsules} ${capsules === 1 ? "capsule" : "capsules"} earned. A Good Vibes Club Game.`
        : "Match badges, earn capsules, collect pins. A Good Vibes Club Game.";

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `${BASE_URL}/share?user=${encodeURIComponent(user)}&score=${score}&capsules=${capsules}`,
            images: [{ url: ogUrl, width: 1200, height: 630 }],
            siteName: "VibeMatch",
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

export default async function SharePage({
    searchParams,
}: {
    searchParams: Promise<SP>;
}) {
    const params = await searchParams;
    const { user, score, capsules } = sanitize(params);
    const playUrl = `/?ref=${encodeURIComponent(user)}`;

    return (
        <div
            style={{
                minHeight: "100vh",
                background:
                    "radial-gradient(circle at 20% 30%, rgba(179,102,255,0.25), transparent 45%), radial-gradient(circle at 80% 75%, rgba(255,215,0,0.18), transparent 50%), #0a0114",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px 20px",
                fontFamily: "var(--font-mundial), system-ui, sans-serif",
            }}
        >
            <div
                style={{
                    maxWidth: 480,
                    width: "100%",
                    textAlign: "center",
                }}
            >
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: 3,
                        color: "#B366FF",
                        textTransform: "uppercase",
                        marginBottom: 32,
                    }}
                >
                    VibeMatch
                </div>

                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.55)",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        marginBottom: 12,
                    }}
                >
                    {user}&apos;s run
                </div>

                <div
                    style={{
                        fontSize: 88,
                        fontWeight: 900,
                        color: "#FFD700",
                        lineHeight: 1,
                        letterSpacing: -2,
                        marginBottom: 16,
                        textShadow: "0 0 40px rgba(255,215,0,0.3)",
                    }}
                >
                    {score.toLocaleString()}
                </div>

                {capsules > 0 && (
                    <div
                        style={{
                            display: "inline-block",
                            padding: "8px 18px",
                            borderRadius: 20,
                            background: "linear-gradient(135deg, #B366FF, #6C5CE7)",
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: 1.5,
                            textTransform: "uppercase",
                            marginBottom: 40,
                        }}
                    >
                        {capsules} {capsules === 1 ? "capsule earned" : "capsules earned"}
                    </div>
                )}

                <div style={{ marginTop: capsules > 0 ? 8 : 40 }}>
                    <Link
                        href={playUrl}
                        style={{
                            display: "inline-block",
                            padding: "16px 40px",
                            borderRadius: 14,
                            background: "linear-gradient(135deg, #FFD700, #FFA500)",
                            color: "#2A1810",
                            fontSize: 14,
                            fontWeight: 800,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            textDecoration: "none",
                            boxShadow: "0 6px 20px rgba(255,165,0,0.3)",
                        }}
                    >
                        Play VibeMatch
                    </Link>
                </div>

                <div
                    style={{
                        marginTop: 24,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: 1,
                    }}
                >
                    A Good Vibes Club Game
                </div>
            </div>
        </div>
    );
}
