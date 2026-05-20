#!/usr/bin/env node
// Usage: node scripts/reset-game-state.mjs [--dry-run] [--live]
//
// Wipes all game-state data while preserving user accounts (identity,
// auth credentials, profile pictures, wallet links, active sessions).
//
// KEEP (untouched):
//   user:<username>            — username, avatarUrl, walletAddress
//   user_auth:<username>       — password hashes, ban state
//   session:<jti>              — active login sessions (users stay logged in)
//   deleted_user:<username>    — forensic tombstones
//   kill:<scope>                — admin kill switches
//   rl:*                        — rate-limit windows (expire on their own)
//
// WIPE (everything else game-related):
//   pinbook:<u>                 — pins, capsules, plays, etc.
//   pinbook:<u>:pending         — pending capsule reveals
//   pinbook:<u>:activeMatch     — active match pointer
//   pinbook:<u>:match:<id>      — match tokens
//   pinbook:<u>:daily:<date>    — daily caps tracker
//   pinbook:lb:rank             — pinbook leaderboard zset
//   pinbook:lb:entry:<u>        — per-user pinbook leaderboard entry
//   pinbook:leaderboard         — legacy pinbook leaderboard
//   classic_leaderboard         — all-time classic scores zset
//   classic_weekly:<monday>     — weekly leaderboards
//   daily_leaderboard:<date>    — daily challenge leaderboards
//   daily_played:<u>:<date>     — daily play markers
//   daily_earned:<u>:<date>     — daily capsule earned markers
//   daily_bonus:<u>:<date>      — daily bonus capsule markers
//   daily_champ_bonus:<u>:<date>— champion bonus markers
//   daily_scored:<u>:<date>     — daily score markers
//   streak:<u>                  — daily streak counts
//   referral:<u>                — referral stats
//   referral:credited:<u>       — referral credit dedupe
//   gamelog:<u>                 — match logs / recent runs
//   achievements:<u>            — unlocked quest set
//   admin_grants:<u>            — admin grant audit log
//   matchstats:<u>:<id>         — per-match stats
//   matchstats:<u>:daily:<date> — daily aggregated stats
//   ftue_flags:<u>              — first-time-user flags (force fresh onboarding)
//   user_flags:<u>              — user flags (musicChanged, etc.)
//   promo:<id>:leaderboard      — Event tab counts
//   lock:*                       — transient KV locks (cleanup)
//
// Default mode is --dry-run. Pass --live to actually delete.

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

const live = process.argv.includes("--live");
const dryRun = !live || process.argv.includes("--dry-run");

console.log(`Mode: ${dryRun ? "DRY RUN (no deletes)" : "LIVE (will delete)"}`);
console.log("Scanning all KV keys...\n");

// Single SCAN of the whole keyspace, partition into keep / wipe.
const keepPrefixes = [
    "user:",
    "user_auth:",
    "session:",
    "deleted_user:",
    "kill:",
    "rl:",
    // tx:*:processed — onchain transaction replay-protection markers.
    // Wiping these would let an attacker re-submit a historical tx hash
    // and have it credited again. The actual Bonus Game / Reroll credit
    // that flowed from each tx is wiped via the pinbook:* sweep below;
    // leaving the marker is pure defense-in-depth against replay.
    "tx:",
];
const wipePrefixes = [
    "pinbook:",
    "classic_leaderboard",
    "classic_weekly:",
    "daily_leaderboard:",
    "daily_played:",
    "daily_earned:",
    "daily_bonus:",
    "daily_champ_bonus:",
    "daily_scored:",
    "streak:",
    "referral:",
    "gamelog:",
    "achievements:",
    "admin_grants:",
    "matchstats:",
    "ftue_flags:",
    "user_flags:",
    "promo:",
    "lock:",
    "classic_matches_played", // global game counter
];

let cursor = 0;
const allKeys = [];
do {
    const result = await kv.scan(cursor, { match: "*", count: 500 });
    cursor = result[0];
    allKeys.push(...result[1]);
} while (cursor != 0);

console.log(`Total keys: ${allKeys.length}`);

const toKeep = [];
const toWipe = [];
const unclassified = [];

for (const key of allKeys) {
    const keepHit = keepPrefixes.find(p => key === p || key.startsWith(p));
    const wipeHit = wipePrefixes.find(p => key === p || key.startsWith(p));
    if (keepHit) toKeep.push(key);
    else if (wipeHit) toWipe.push(key);
    else unclassified.push(key);
}

// Report by prefix
const byPrefix = {};
for (const k of toWipe) {
    const prefix = wipePrefixes.find(p => k === p || k.startsWith(p));
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
}

console.log(`\n=== KEEP (${toKeep.length}) ===`);
const keepBy = {};
for (const k of toKeep) {
    const p = keepPrefixes.find(p => k === p || k.startsWith(p));
    keepBy[p] = (keepBy[p] || 0) + 1;
}
for (const [p, n] of Object.entries(keepBy).sort()) console.log(`  ${n.toString().padStart(5)}  ${p}*`);

console.log(`\n=== WIPE (${toWipe.length}) ===`);
for (const [p, n] of Object.entries(byPrefix).sort()) console.log(`  ${n.toString().padStart(5)}  ${p}*`);

if (unclassified.length > 0) {
    console.log(`\n=== UNCLASSIFIED — NOT TOUCHED (${unclassified.length}) ===`);
    for (const k of unclassified) console.log(`  ${k}`);
    console.log("\n⚠️  Review these. If any should be wiped, add the prefix to wipePrefixes.");
}

if (dryRun) {
    console.log(`\n(Dry run — no deletes. Re-run with --live to execute.)`);
    process.exit(0);
}

console.log(`\nDeleting ${toWipe.length} keys in batches of 100...`);
let deleted = 0;
const BATCH = 100;
for (let i = 0; i < toWipe.length; i += BATCH) {
    const batch = toWipe.slice(i, i + BATCH);
    if (batch.length > 0) {
        await kv.del(...batch);
        deleted += batch.length;
        if (deleted % 500 === 0 || i + BATCH >= toWipe.length) {
            console.log(`  ${deleted}/${toWipe.length} deleted`);
        }
    }
}

console.log(`\nDone. Wiped ${deleted} keys. ${toKeep.length} identity keys preserved.`);
