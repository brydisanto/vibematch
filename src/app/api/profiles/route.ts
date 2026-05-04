import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { invalidateLeaderboardCache } from '@/app/api/scores/route';
import type { LeaderboardEntry } from '@/app/api/pinbook/leaderboard/route';

// Avatars are hosted on our own infra + a small allowlist of image CDNs. Anything
// else gets rejected before being stored, so a compromised session can't persist
// a `javascript:` / `data:text/html` URL that would XSS other players on render.
const AVATAR_HOST_ALLOWLIST = new Set([
    'pindropgame.com',
    'www.pindropgame.com',
    'cdn.pindropgame.com',
    'vibematch.app',
    'www.vibematch.app',
    'cdn.vibematch.app',
    'opensea.io',
    'i.seadn.io',
    'raw.githubusercontent.com',
    'vercel-storage.com',
    'public.blob.vercel-storage.com',
    'googleusercontent.com',
    'lh3.googleusercontent.com',
    'imgur.com',
    'i.imgur.com',
    'ipfs.io',
]);

const MAX_AVATAR_URL_LENGTH = 500;

/**
 * Validates avatarUrl server-side before persisting. Empty string clears the
 * avatar; otherwise the URL must be https:, under 500 chars, and point at an
 * allowlisted host (or a subdomain of one). Returns null if valid; error
 * message string if rejected.
 */
function validateAvatarUrl(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return 'Avatar URL must be a string';
    if (value.length > MAX_AVATAR_URL_LENGTH) return 'Avatar URL too long';
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return 'Avatar URL is not a valid URL';
    }
    if (url.protocol !== 'https:') return 'Avatar URL must use https:';
    const host = url.hostname.toLowerCase();
    // Allow exact match or any subdomain of an allowlisted apex.
    const allowed = [...AVATAR_HOST_ALLOWLIST].some(apex => host === apex || host.endsWith(`.${apex}`));
    if (!allowed) return `Avatar host "${host}" is not allowed`;
    return null;
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.username) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { username, avatarUrl, walletAddress } = body;

        const sessionUsername = (session.username as string).toLowerCase();

        // Wallet-only update: just save the wallet address to the existing profile
        if (walletAddress && !username) {
            const key = `user:${sessionUsername}`;
            const existing = (await kv.get(key)) as any || {};
            await kv.set(key, { ...existing, walletAddress: walletAddress.toLowerCase() });
            return NextResponse.json({ success: true, walletLinked: true });
        }

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 });
        }

        // Prevent users from updating other people's profiles
        if (username.toLowerCase() !== sessionUsername) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Validate avatarUrl before persisting — blocks XSS / SSRF via stored URL.
        const avatarError = validateAvatarUrl(avatarUrl);
        if (avatarError) {
            return NextResponse.json({ error: avatarError }, { status: 400 });
        }

        const key = `user:${username.toLowerCase()}`;
        const existing = (await kv.get(key)) as any || {};
        await kv.set(key, { ...existing, username, avatarUrl });

        // Bust score leaderboard cache so updated avatar shows immediately
        invalidateLeaderboardCache();

        // Update avatar in pinbook leaderboard entry if it exists
        const pinbookLb = (await kv.get('pinbook:leaderboard')) as LeaderboardEntry[] | null;
        if (pinbookLb) {
            const idx = pinbookLb.findIndex(e => e.username.toLowerCase() === username.toLowerCase());
            if (idx >= 0 && pinbookLb[idx].avatarUrl !== avatarUrl) {
                pinbookLb[idx] = { ...pinbookLb[idx], avatarUrl };
                await kv.set('pinbook:leaderboard', pinbookLb);
            }
        }

        return NextResponse.json({ success: true, profile: { username, avatarUrl } });
    } catch (error) {
        console.error('KV error saving profile:', error);
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    // Gate on session to block unauthenticated user enumeration (previously
    // anyone could probe arbitrary usernames). Signed-in users can still look
    // up anyone's profile — leaderboards + pin book need other players'
    // avatars. Also strip internal/PII fields like walletAddress from the
    // response for non-self lookups.
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isSelf = (session.username as string).toLowerCase() === username.toLowerCase();

    try {
        const key = `user:${username.toLowerCase()}`;
        const profile = await kv.get(key) as { username?: string; avatarUrl?: string; walletAddress?: string } | null;

        if (profile) {
            // For other-user lookups, return only public fields.
            const payload = isSelf
                ? profile
                : { username: profile.username, avatarUrl: profile.avatarUrl };
            return NextResponse.json({ profile: payload }, {
                headers: { 'Cache-Control': 'private, max-age=30' }
            });
        } else {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('KV error fetching profile:', error);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}
