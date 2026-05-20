#!/usr/bin/env node
// Usage: node scripts/migrate-avatars-to-blob.mjs [--dry-run]
//
// One-shot migration: scans every user profile in KV, finds any whose
// avatarUrl is an inline data:image base64 URI, decodes it, uploads to
// Vercel Blob storage, and writes the resulting public URL back to the
// profile.
//
// Use --dry-run to scan and report without mutating anything.
//
// Run from the project root. Pulls BLOB_READ_WRITE_TOKEN and KV creds
// from .env.local.

import { createClient } from "@vercel/kv";
import { put } from "@vercel/blob";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
    envFile.split("\n")
        .filter(l => l && !l.startsWith("#"))
        .map(l => { const [k, ...v] = l.split("="); return [k, v.join("=").replace(/^"|"$/g, "")]; })
);

const dryRun = process.argv.includes("--dry-run");
const blobToken = env.BLOB_READ_WRITE_TOKEN;
const kvUrl = env.KV_REST_API_URL;
const kvToken = env.KV_REST_API_TOKEN;

if (!blobToken) {
    console.error("Missing BLOB_READ_WRITE_TOKEN in .env.local");
    process.exit(1);
}
if (!kvUrl || !kvToken) {
    console.error("Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env.local");
    process.exit(1);
}
const kv = createClient({ url: kvUrl, token: kvToken });

// Decode a data:image URI into { buffer, contentType, ext }.
function decodeDataUri(uri) {
    const match = uri.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!match) return null;
    const contentType = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], "base64");
    const ext = contentType === "image/png" ? "png"
        : contentType === "image/webp" ? "webp"
        : contentType === "image/jpeg" || contentType === "image/jpg" ? "jpg"
        : null;
    if (!ext) return null;
    return { buffer, contentType, ext };
}

console.log(`Migration mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE (will write)"}`);
console.log("Scanning user:* keys in KV...");

let cursor = 0;
const userKeys = [];
do {
    const result = await kv.scan(cursor, { match: "user:*", count: 200 });
    cursor = result[0];
    userKeys.push(...result[1]);
} while (cursor != 0);

console.log(`Found ${userKeys.length} user keys. Inspecting avatars...`);

let migrated = 0;
let skipped = 0;
let failed = 0;
let nonDataUri = 0;
let emptyAvatar = 0;

for (const key of userKeys) {
    const profile = await kv.get(key);
    if (!profile) { skipped++; continue; }
    const avatarUrl = profile.avatarUrl ?? "";
    if (!avatarUrl) { emptyAvatar++; continue; }
    if (!avatarUrl.startsWith("data:")) { nonDataUri++; continue; }

    const decoded = decodeDataUri(avatarUrl);
    if (!decoded) {
        console.warn(`  ${key}: unrecognized data URI shape, skipping`);
        failed++;
        continue;
    }

    const username = key.replace(/^user:/, "");
    const pathname = `avatars/${username}-migrated-${Date.now()}.${decoded.ext}`;
    const sizeKb = (decoded.buffer.length / 1024).toFixed(1);

    if (dryRun) {
        console.log(`  ${key}: would upload ${sizeKb} KB as ${pathname}`);
        migrated++;
        continue;
    }

    try {
        const uploaded = await put(pathname, decoded.buffer, {
            access: "public",
            contentType: decoded.contentType,
            addRandomSuffix: true,
            token: blobToken,
        });
        // Re-fetch and write back with the new URL, preserving everything
        // else on the profile (walletAddress, etc).
        const fresh = await kv.get(key);
        await kv.set(key, { ...fresh, avatarUrl: uploaded.url });
        console.log(`  ${key}: ${sizeKb} KB → ${uploaded.url}`);
        migrated++;
    } catch (e) {
        console.error(`  ${key}: upload failed —`, e.message ?? e);
        failed++;
    }
}

console.log("\nSummary:");
console.log(`  ${migrated}\tmigrated`);
console.log(`  ${nonDataUri}\talready a remote URL (no migration needed)`);
console.log(`  ${emptyAvatar}\tno avatar set`);
console.log(`  ${skipped}\tprofile missing / unreadable`);
console.log(`  ${failed}\tfailed`);
if (dryRun) console.log("\n(Dry run — no writes happened.)");
