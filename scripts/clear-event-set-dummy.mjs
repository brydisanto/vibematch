#!/usr/bin/env node
/**
 * Clear all seeded dummy data for Craig's Bubble Gum Blast so
 * production launches with an empty leaderboard.
 *
 *   node scripts/clear-event-set-dummy.mjs           # dry run
 *   node scripts/clear-event-set-dummy.mjs --apply   # delete
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
    envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

async function kvCmd(...parts) {
    const r = await fetch(`${KV_URL}/${parts.map(p => encodeURIComponent(String(p))).join("/")}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    return r.json();
}

const SET_ID = "craigs_bubble_gum_blast";
const PIN_IDS = [
    "craigs_bubble_gum_blast_common",
    "craigs_bubble_gum_blast_rare",
    "craigs_bubble_gum_blast_epic",
    "craigs_bubble_gum_blast_legendary",
];

const KEYS = [
    `event_set:${SET_ID}:points`,
    ...PIN_IDS.map(id => `promo:${id}:leaderboard`),
];

const apply = process.argv.includes("--apply");

console.log(`clear-event-set-dummy ${apply ? "--apply" : "(dry run)"}\n`);

for (const key of KEYS) {
    const before = await kvCmd("zcard", key);
    console.log(`${key.padEnd(60)} zcard=${before.result ?? 0}`);
}

if (!apply) {
    console.log("\nDry run. Pass --apply to delete.");
    process.exit(0);
}

console.log("\nDeleting...");
for (const key of KEYS) {
    const r = await kvCmd("del", key);
    console.log(`  DEL ${key} → ${r.result}`);
}
console.log("\nDone. Leaderboards are empty.");
