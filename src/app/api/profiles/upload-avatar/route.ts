import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { kv } from '@vercel/kv';
import { getSession } from '@/lib/auth';

/**
 * POST /api/profiles/upload-avatar
 *
 * Accepts a JPEG/PNG/WebP image (multipart form, field "file") and stores
 * it in the project's Vercel Blob store. Returns the resulting public
 * https://*.public.blob.vercel-storage.com URL — never the inline file
 * bytes — so leaderboard reads and avatar renders are tiny URL strings
 * instead of the ~120KB data:image base64 URIs we used to serve.
 *
 * Replaces the old upload path where ProfileModal called canvas.toDataURL
 * and POSTed the resulting base64 to /api/profiles. That worked but blew
 * up the leaderboard payload, broke Next.js Image's srcset on mobile, and
 * meant every avatar render shipped 120KB+ of base64 over the wire.
 *
 * Auth: must be logged in; uploaded blob is tagged with the username so a
 * subsequent upload from the same user can locate and delete the previous
 * blob (avoids orphan accumulation in the store).
 *
 * Limits:
 *   - 2 MB max body size
 *   - Allowed content types: image/jpeg, image/png, image/webp
 *   - One avatar at a time per user
 */

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.username) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const username = (session.username as string).toLowerCase();

        const formData = await req.formData().catch(() => null);
        if (!formData) {
            return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
        }
        const file = formData.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
        }
        if (file.size > MAX_AVATAR_BYTES) {
            return NextResponse.json({ error: 'Avatar must be 2 MB or smaller' }, { status: 413 });
        }
        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json({ error: 'Avatar must be JPEG, PNG, or WebP' }, { status: 415 });
        }

        // Delete previous avatar blob if one exists. The avatarUrl on the
        // user profile records the live blob URL; if it's a Blob URL we
        // can pass it directly to del(). Old base64 data: URIs aren't on
        // Blob storage, so we just skip the delete for those.
        const profileKey = `user:${username}`;
        const existingProfile = await kv.get(profileKey) as { avatarUrl?: string } | null;
        const previousUrl = existingProfile?.avatarUrl ?? '';
        if (previousUrl.includes('.public.blob.vercel-storage.com/')) {
            try { await del(previousUrl); } catch (e) { console.warn('Failed to delete previous avatar blob:', e); }
        }

        // Pathname keys the blob to a username + timestamp so race uploads
        // don't collide and CDNs can't serve a stale cached blob from a
        // previous upload with the same path.
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const pathname = `avatars/${username}-${Date.now()}.${ext}`;

        const uploaded = await put(pathname, file, {
            access: 'public',
            contentType: file.type,
            // addRandomSuffix prevents accidental overwrite if two
            // simultaneous uploads happen to hit the same pathname.
            addRandomSuffix: true,
        });

        return NextResponse.json({ url: uploaded.url });
    } catch (e) {
        console.error('Avatar upload error:', e);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
