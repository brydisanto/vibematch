import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(getKey());
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, getKey(), {
        algorithms: ["HS256"],
    });
    return payload;
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
    return await decrypt(session);
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!session) return;

    // Refresh the session so it doesn't expire
    const parsed = await decrypt(session);
    parsed.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const res = NextResponse.next();
    res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: await encrypt(parsed),
        httpOnly: true,
        expires: parsed.expires,
    });
    return res;
}
