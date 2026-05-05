import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Per-user FTUE flag store. Mirrors localStorage's vm_ftue_v1 blob, but
 * keyed at `ftue_flags:<username>` in KV so signing in on a new browser
 * doesn't replay the entire first-time experience. The client merges the
 * server set with whatever it has locally, then writes new marks to both.
 *
 * Flags are intentionally one-way (set once, never reset) — to wipe them
 * for testing, hit the URL with ?resetFtue=1 (which only clears
 * localStorage; server keys stay until the KV key expires or is deleted
 * out of band).
 */

// Match the union in src/lib/useFtue.ts. Anything not in this set is
// rejected so callers can't write arbitrary keys into the user's blob.
const VALID_FLAGS = new Set([
    "primerShown",
    "firstMoveShown",
    "bombHintShown",
    "vibestreakHintShown",
    "cosmicBlastHintShown",
    "firstCapsuleShown",
    "firstFailShown",
]);

type FtueBlob = Record<string, boolean>;

function keyFor(username: string) {
    return `ftue_flags:${username}`;
}

export async function GET() {
    const session = await getSession();
    if (!session?.username) {
        return NextResponse.json({ flags: {} });
    }
    const username = (session.username as string).toLowerCase();
    try {
        const data = (await kv.get(keyFor(username))) as FtueBlob | null;
        return NextResponse.json(
            { flags: data || {} },
            { headers: { "Cache-Control": "private, max-age=10" } }
        );
    } catch (error) {
        console.error("ftue GET error:", error);
        return NextResponse.json({ flags: {} });
    }
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.username) {
        // No session = no server persistence. Client falls back to
        // localStorage-only — this is the guest-mode path.
        return NextResponse.json({ ok: true, persisted: false });
    }
    const username = (session.username as string).toLowerCase();
    try {
        const body = await req.json();
        const flag = body?.flag as string | undefined;
        if (!flag || !VALID_FLAGS.has(flag)) {
            return NextResponse.json({ error: "Invalid flag" }, { status: 400 });
        }
        const key = keyFor(username);
        const current = ((await kv.get(key)) as FtueBlob | null) || {};
        if (current[flag]) {
            return NextResponse.json({ ok: true, persisted: true, alreadySet: true });
        }
        current[flag] = true;
        await kv.set(key, current);
        return NextResponse.json({ ok: true, persisted: true });
    } catch (error) {
        console.error("ftue POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
