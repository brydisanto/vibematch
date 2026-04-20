import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { kv } from "@vercel/kv";

// Lazy init: resolve JWT_SECRET at first use, not at module load.
// This prevents Next.js build from failing when env vars aren't available.
let _key: Uint8Array | null = null;
function getKey(): Uint8Array {
    if (!_key) {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error(
                "JWT_SECRET environment variable is not set. " +
                "Set a strong, random secret before starting the server."
            );
        }
        _key = new TextEncoder().encode(jwtSecret);
    }
    return _key;
}

export const SESSION_COOKIE_NAME = "vibematch_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Create a JWT session bound to a unique jti stored in KV.
 * Revoking a session is as simple as deleting its KV entry.
 */
export async function encrypt(payload: any) {
    // Generate a unique session id and store it in KV as an active session
    const jti = crypto.randomUUID();
    const username = payload?.username || "";
    await kv.set(`session:${jti}`, { username, createdAt: Date.now() }, { ex: SESSION_TTL_SECONDS });

    return await new SignJWT({ ...payload, jti })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(getKey());
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, getKey(), {
        algorithms: ["HS256"],
    });
    // Check KV for an active session; if missing, the session has been revoked
    const jti = payload.jti as string | undefined;
    if (jti) {
        const active = await kv.get(`session:${jti}`);
        if (!active) {
            throw new Error("Session revoked");
        }
    }
    return payload;
}

/** Revoke the given jti so the session stops validating. */
export async function revokeSession(jti: string): Promise<void> {
    if (!jti) return;
    await kv.del(`session:${jti}`);
}

// Fix #2: PBKDF2 password hashing via SubtleCrypto (Edge Runtime compatible).
// Stored format: "pbkdf2:<salt_hex>:<hash_hex>"
// Legacy format (plain SHA-256 hex string) is still recognised in verifyPassword.

export async function hashPassword(password: string): Promise<string> {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 200_000,
            hash: "SHA-256",
        },
        keyMaterial,
        256
    );

    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return `pbkdf2:${saltHex}:${hashHex}`;
}

/**
 * Detect a legacy raw SHA-256 hash. These pre-date PBKDF2 and are now
 * considered compromised material after the 2026-04-20 platform incident.
 * Callers should force a rotation flow on matched accounts instead of
 * auto-rehashing under the user's existing password.
 */
export function isLegacyHash(storedHash: string): boolean {
    return !storedHash.startsWith("pbkdf2:");
}

// Verify a password against a stored hash.
// Supports both:
//   - New format: "pbkdf2:<salt_hex>:<hash_hex>"
//   - Legacy format: plain SHA-256 hex (backward compatibility for existing users)
export async function verifyPassword(
    password: string,
    storedHash: string
): Promise<boolean> {
    if (storedHash.startsWith("pbkdf2:")) {
        // New PBKDF2 format
        const parts = storedHash.split(":");
        if (parts.length !== 3) return false;
        const saltHex = parts[1];
        const expectedHashHex = parts[2];

        const saltBytes = new Uint8Array(
            saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
        );

        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveBits"]
        );

        const hashBuffer = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: saltBytes,
                iterations: 200_000,
                hash: "SHA-256",
            },
            keyMaterial,
            256
        );

        const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        return hashHex === expectedHashHex;
    } else {
        // Legacy: plain SHA-256 hex — check for backward compatibility
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const legacyHash = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return legacyHash === storedHash;
    }
}

export async function getSession() {
    const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!session) return null;
    try {
        return await decrypt(session);
    } catch {
        // Invalid or revoked session
        return null;
    }
}

