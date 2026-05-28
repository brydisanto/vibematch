#!/usr/bin/env node
// One-off: set a temp password for a user. Uses the same PBKDF2 routine as
// src/lib/auth.ts hashPassword() so the user can log in normally.
import { readFileSync } from "fs";
import { webcrypto as crypto } from "crypto";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
    envText
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#"))
        .map((l) => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
);

const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

const username = process.argv[2];
if (!username) {
    console.error("usage: set-temp-password.mjs <username>");
    process.exit(1);
}

function generatePassword() {
    // pindrop-XXXXXXXX where X is base32-ish alphanumeric (no ambiguous chars)
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    let s = "";
    for (const b of bytes) s += alphabet[b % alphabet.length];
    return `pindrop-${s}`;
}

async function hashPassword(password) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: saltBytes, iterations: 200_000, hash: "SHA-256" },
        keyMaterial,
        256,
    );
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `pbkdf2:${saltHex}:${hashHex}`;
}

async function kvGet(key) {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const j = await r.json();
    if (j.result == null) return null;
    try { return JSON.parse(j.result); } catch { return j.result; }
}

async function kvSet(key, value) {
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(value),
    });
    if (!r.ok) throw new Error(`kvSet failed: ${r.status} ${await r.text()}`);
    return r.json();
}

async function kvZadd(key, score, member) {
    const r = await fetch(`${KV_URL}/zadd/${encodeURIComponent(key)}/${score}/${encodeURIComponent(member)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!r.ok) throw new Error(`kvZadd failed: ${r.status} ${await r.text()}`);
    return r.json();
}

const lower = username.toLowerCase();
const authKey = `user_auth:${lower}`;
const auth = await kvGet(authKey);
if (!auth) {
    console.error(`User not found: ${username}`);
    process.exit(1);
}

const tempPassword = generatePassword();
const newHash = await hashPassword(tempPassword);

await kvSet(authKey, { ...auth, password: newHash });

const audit = {
    timestamp: Date.now(),
    admin: "bry (script: set-temp-password)",
    type: "password_reset",
    note: "temp password issued via admin script",
};
await kvZadd(`admin_grants:${lower}`, audit.timestamp, JSON.stringify(audit));

console.log(`\nUser:          ${auth.username || username}`);
console.log(`Temp password: ${tempPassword}`);
console.log(`\nAudit entry written to admin_grants:${lower}`);
