import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const clampText = (s: string | null, max = 32): string =>
    (s ?? '').slice(0, max);

const clampScore = (s: string | null): number => {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.floor(n), 1_000_000);
};

const clampCapsules = (s: string | null): number => {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.floor(n), 10);
};

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const user = clampText(searchParams.get('user'), 24) || 'player';
    const score = clampScore(searchParams.get('score'));
    const capsules = clampCapsules(searchParams.get('capsules'));

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '60px 72px',
                    backgroundColor: '#0a0114',
                    backgroundImage:
                        'radial-gradient(circle at 20% 30%, rgba(179,102,255,0.35), transparent 45%), radial-gradient(circle at 80% 75%, rgba(255,215,0,0.22), transparent 50%)',
                    color: '#ffffff',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
            >
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 900,
                        letterSpacing: 4,
                        color: '#B366FF',
                        textTransform: 'uppercase',
                    }}
                >
                    VibeMatch
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                        style={{
                            fontSize: 180,
                            fontWeight: 900,
                            color: '#FFD700',
                            lineHeight: 1,
                            letterSpacing: -4,
                        }}
                    >
                        {score.toLocaleString()}
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 4,
                            color: 'rgba(255,255,255,0.55)',
                            marginTop: 12,
                        }}
                    >
                        {user}&apos;s run
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                    }}
                >
                    {capsules > 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                padding: '14px 26px',
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, #B366FF, #6C5CE7)',
                                fontSize: 26,
                                fontWeight: 800,
                                color: 'white',
                            }}
                        >
                            {capsules} {capsules === 1 ? 'capsule earned' : 'capsules earned'}
                        </div>
                    ) : (
                        <div />
                    )}
                    <div
                        style={{
                            fontSize: 22,
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.5)',
                            letterSpacing: 1,
                        }}
                    >
                        A Good Vibes Club Game
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
