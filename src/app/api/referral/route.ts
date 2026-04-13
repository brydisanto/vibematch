import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_REFERRAL_CAPSULES = 50;

export interface ReferralStats {
    referralCode: string;
    totalReferrals: number;
    capsulesCredited: number;
    referredUsers: string[]; // usernames of people they referred
}

function emptyStats(username: string): ReferralStats {
    return {
        referralCode: username,
        totalReferrals: 0,
        capsulesCredited: 0,
        referredUsers: [],
    };
}

// GET — fetch referral stats for the logged-in user
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const username = (session.username as string).toLowerCase();
        const key = `referral:${username}`;
        const stats = (await kv.get(key)) as ReferralStats | null;

        return NextResponse.json({
            ...(stats || emptyStats(username)),
            maxCapsules: MAX_REFERRAL_CAPSULES,
            capped: (stats?.capsulesCredited || 0) >= MAX_REFERRAL_CAPSULES,
        });
    } catch (e) {
        console.error('Referral GET error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

/**
 * Process a referral credit. Called internally by the registration endpoint.
 * Not a public API — no route handler for POST here.
 *
 * Returns true if the referral was successfully credited.
 */
export async function processReferral(referrerUsername: string, newUsername: string): Promise<boolean> {
    const referrer = referrerUsername.toLowerCase();
    const newUser = newUsername.toLowerCase();

    // Can't self-refer
    if (referrer === newUser) return false;

    // Check referrer exists
    const referrerAuth = await kv.get(`user_auth:${referrer}`);
    if (!referrerAuth) return false;

    // Check this new user hasn't already been referred by someone
    const alreadyReferred = await kv.get(`referral:credited:${newUser}`);
    if (alreadyReferred) return false;

    // Get referrer's stats
    const referralKey = `referral:${referrer}`;
    const stats = ((await kv.get(referralKey)) as ReferralStats | null) || emptyStats(referrer);

    // Check cap
    if (stats.capsulesCredited >= MAX_REFERRAL_CAPSULES) return false;

    // Credit referrer: +1 capsule to their pinbook
    const referrerPinbookKey = `pinbook:${referrer}`;
    const referrerPinbook = (await kv.get(referrerPinbookKey)) as any;
    if (referrerPinbook) {
        referrerPinbook.capsules = (referrerPinbook.capsules || 0) + 1;
        referrerPinbook.totalEarned = (referrerPinbook.totalEarned || 0) + 1;
        await kv.set(referrerPinbookKey, referrerPinbook);
    } else {
        // Referrer has no pinbook yet — create one with 1 capsule
        await kv.set(referrerPinbookKey, {
            pins: {},
            capsules: 1,
            totalOpened: 0,
            totalEarned: 1,
        });
    }

    // Credit new user: +1 capsule (their pinbook may not exist yet at registration time,
    // so we create it if needed)
    const newUserPinbookKey = `pinbook:${newUser}`;
    const newUserPinbook = (await kv.get(newUserPinbookKey)) as any;
    if (newUserPinbook) {
        newUserPinbook.capsules = (newUserPinbook.capsules || 0) + 1;
        newUserPinbook.totalEarned = (newUserPinbook.totalEarned || 0) + 1;
        await kv.set(newUserPinbookKey, newUserPinbook);
    } else {
        await kv.set(newUserPinbookKey, {
            pins: {},
            capsules: 1,
            totalOpened: 0,
            totalEarned: 1,
        });
    }

    // Update referrer stats
    stats.totalReferrals += 1;
    stats.capsulesCredited += 1;
    stats.referredUsers.push(newUser);
    await kv.set(referralKey, stats);

    // Mark the new user as referred (prevents double-credit)
    await kv.set(`referral:credited:${newUser}`, { by: referrer, at: Date.now() });

    console.log(`[Referral] ${referrer} referred ${newUser} — capsule credited to both`);
    return true;
}
