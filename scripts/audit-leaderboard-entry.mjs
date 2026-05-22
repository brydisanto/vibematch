#!/usr/bin/env node
// Usage:
//   node scripts/audit-leaderboard-entry.mjs <username>                   # dry-run audit
//   node scripts/audit-leaderboard-entry.mjs <username> --live            # reset to highest gamelog score
//   node scripts/audit-leaderboard-entry.mjs <username> --live --set N    # reset to N
//
// Audits a user's classic leaderboard entry vs their gamelog (the
// authoritative play history). Reports the inflated delta + the most
// likely true high score (max classic gamelog entry). With --live,
// replaces the leaderboard entry with either the gamelog max or an
// explicit --set value.

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
const kv = createClient({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });

const args = process.argv.slice(2);
const live = args.includes("--live");
const setIdx = args.indexOf("--set");
const setValue = setIdx >= 0 ? Number(args[setIdx + 1]) : null;
const username = args.find(a => !a.startsWith("--") && (setIdx < 0 || args.indexOf(a) !== setIdx + 1));

if (!username) {
    console.error("Usage: node scripts/audit-leaderboard-entry.mjs <username> [--live] [--set N]");
    process.exit(1);
}

const lower = username.toLowerCase();
const profile = await kv.get(`user:${lower}`);
const canonical = profile?.username || username;

console.log(`Mode: ${live ? "LIVE (will write)" : "DRY RUN (no writes)"}`);
console.log(`Username: ${canonical} (lower: ${lower})\n`);

// Current leaderboard entries (both casings)
const lbCanonical = await kv.zscore("classic_leaderboard", canonical);
const lbLower = canonical !== lower ? await kv.zscore("classic_leaderboard", lower) : null;
const currentLb = Math.max(Number(lbCanonical || 0), Number(lbLower || 0));
console.log(`Current leaderboard: ${currentLb}`);

// Scan gamelog
const raw = await kv.zrange(`gamelog:${lower}`, 0, 499, { rev: true });
let maxClassic = 0;
let maxClassicValidated = 0;
let allEntries = 0;
const top10 = [];
for (const r of raw) {
    let e;
    try { e = typeof r === "string" ? JSON.parse(r) : r; } catch { continue; }
    if (!e || (e.gameMode && e.gameMode !== "classic")) continue;
    allEntries += 1;
    const s = Number(e.score) || 0;
    if (s > maxClassic) maxClassic = s;
    if (s > maxClassicValidated && e.validatedMatch) maxClassicValidated = s;
    top10.push({ score: s, validated: !!e.validatedMatch, ts: e.timestamp });
}
top10.sort((a, b) => b.score - a.score);

console.log(`Gamelog: ${allEntries} classic entries scanned`);
console.log(`  Max (validated):     ${maxClassicValidated}`);
console.log(`  Max (any):           ${maxClassic}`);
console.log(`  Top 10 scores:`);
for (const e of top10.slice(0, 10)) {
    const ts = new Date(e.ts).toISOString().slice(0, 19);
    console.log(`    ${String(e.score).padStart(7)}  ${e.validated ? "✓" : " "}  ${ts}`);
}

const delta = currentLb - maxClassicValidated;
console.log(`\nDelta: leaderboard - validated-max = ${delta}`);
if (delta > 0) {
    console.log("  ⚠ Leaderboard entry exceeds any legitimately validated game.");
} else {
    console.log("  ✓ Leaderboard is consistent with gameplay.");
}

if (!live) {
    if (delta > 0) {
        console.log(`\nDry-run: re-run with --live to reset to ${setValue ?? maxClassicValidated}.`);
    }
    process.exit(0);
}

// Live mode: reset
const newScore = setValue != null ? setValue : maxClassicValidated;
console.log(`\nResetting leaderboard entry for ${canonical} to ${newScore}...`);

// Remove both casings
await kv.zrem("classic_leaderboard", canonical);
if (canonical !== lower) await kv.zrem("classic_leaderboard", lower);

if (newScore > 0) {
    await kv.zadd("classic_leaderboard", { score: newScore, member: canonical });
}

// Also reset current weekly entry (Monday-based key)
const d = new Date();
const day = d.getDay();
const diff = d.getDate() - day + (day === 0 ? -6 : 1);
const monday = new Date(d.setDate(diff)).toISOString().split("T")[0];
const weeklyKey = `classic_weekly:${monday}`;

await kv.zrem(weeklyKey, canonical);
if (canonical !== lower) await kv.zrem(weeklyKey, lower);
if (newScore > 0) {
    await kv.zadd(weeklyKey, { score: newScore, member: canonical });
}

console.log("Wrote updated leaderboard entries.");
