#!/usr/bin/env node
// Usage: node scripts/burn-user-duplicates.mjs <username> [--live]
//
// Reduces every badge in <username>'s pinbook with count > 1 down to count = 1.
// Used to manually clean up after a reroll bug where VIBESTR was taken but
// pins weren't burned and admin already credited the capsules separately.
//
// Default mode is dry-run. Pass --live to actually write.

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

const args = process.argv.slice(2);
const live = args.includes("--live");
const dryRun = !live;
const username = args.find(a => !a.startsWith("--"));

if (!username) {
    console.error("Usage: node scripts/burn-user-duplicates.mjs <username> [--live]");
    process.exit(1);
}

const lower = username.toLowerCase();
const pinbookKey = `pinbook:${lower}`;

console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE (will write)"}`);
console.log(`Target: ${pinbookKey}\n`);

const pinbook = await kv.get(pinbookKey);
if (!pinbook) {
    console.error(`No pinbook found for "${lower}".`);
    process.exit(1);
}
if (!pinbook.pins || typeof pinbook.pins !== "object") {
    console.error(`Pinbook for "${lower}" has no pins object.`);
    process.exit(1);
}

let totalDupesRemoved = 0;
let badgesAffected = 0;
const newPins = {};
const log = [];

for (const [badgeId, pin] of Object.entries(pinbook.pins)) {
    const count = Number(pin?.count) || 0;
    if (count <= 1) {
        newPins[badgeId] = pin;
        continue;
    }
    const dupes = count - 1;
    totalDupesRemoved += dupes;
    badgesAffected += 1;
    log.push({ badgeId, from: count, to: 1, removed: dupes });
    newPins[badgeId] = { ...pin, count: 1 };
}

// Sort log by most-removed first for readability
log.sort((a, b) => b.removed - a.removed);
for (const entry of log) {
    console.log(`  ${entry.badgeId.padEnd(40)} ${String(entry.from).padStart(3)} → 1   (-${entry.removed})`);
}

console.log("");
console.log(`Badges affected: ${badgesAffected}`);
console.log(`Total duplicate pins removed: ${totalDupesRemoved}`);
console.log("");

if (dryRun) {
    console.log("Dry-run: no writes performed. Re-run with --live to apply.");
    process.exit(0);
}

const updated = { ...pinbook, pins: newPins };
await kv.set(pinbookKey, updated);
console.log("Wrote updated pinbook.");
