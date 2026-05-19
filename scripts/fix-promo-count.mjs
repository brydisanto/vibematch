#!/usr/bin/env node
// Usage: node scripts/fix-promo-count.mjs <username> <newCount>
// One-shot to set a user's count on the active promo leaderboard zset.
// Used to clean up stale auto-credit double-increments that happened
// between activating the OpenSea promo and the client-side resolveBadge
// fix landing (commit 1cff059).

import { createClient } from "@vercel/kv";
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

const kvUrl = env.KV_REST_API_URL;
const kvToken = env.KV_REST_API_TOKEN;
if (!kvUrl || !kvToken) {
    console.error("Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env.local");
    process.exit(1);
}
const kv = createClient({ url: kvUrl, token: kvToken });

const username = (process.argv[2] || "").toLowerCase().trim();
const newCount = parseInt(process.argv[3] || "", 10);

if (!username || !Number.isFinite(newCount) || newCount < 0) {
    console.error("Usage: node scripts/fix-promo-count.mjs <username> <newCount>");
    process.exit(1);
}

// Hardcoded to the active promo for safety. Update if a different
// promo becomes active.
const promoId = "promo_opensea";
const key = `promo:${promoId}:leaderboard`;

const oldCount = await kv.zscore(key, username);
console.log(`Current count for ${username} on ${promoId}: ${oldCount ?? "(not on board)"}`);

if (newCount === 0) {
    // Remove the user entirely from the zset.
    await kv.zrem(key, username);
    console.log(`Removed ${username} from ${promoId} leaderboard.`);
} else {
    // ZADD overwrites the score for an existing member.
    await kv.zadd(key, { score: newCount, member: username });
    console.log(`Set ${username} count to ${newCount} on ${promoId}.`);
}

const verifyCount = await kv.zscore(key, username);
console.log(`Verified: ${username} now at ${verifyCount ?? "(not on board)"}.`);

// Also check for any stale pending the user has so we don't get another
// auto-credit later. If found and isPromo, log it so we can decide.
const pendingKey = `pinbook:${username}:pending`;
const pending = await kv.get(pendingKey);
if (pending) {
    console.log(`Heads up: ${username} has a pending capsule reveal in KV:`, pending);
    console.log(`If this isPromo: true, the next open will auto-credit it. Delete with:`);
    console.log(`  await kv.del("${pendingKey}")`);
}
