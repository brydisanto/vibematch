#!/usr/bin/env node
// Usage: node scripts/count-achievement.mjs <achievement_id>
// Scans every achievements:<username> key and counts how many users have
// the given achievement id unlocked.

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

const target = (process.argv[2] || "first_cross_shape").trim();
if (!target) {
    console.error("Usage: node scripts/count-achievement.mjs <achievement_id>");
    process.exit(1);
}

console.error(`Scanning achievements:* for "${target}"…`);

const keys = [];
let cursor = 0;
do {
    const [next, batch] = await kv.scan(cursor, { match: "achievements:*", count: 500 });
    cursor = next;
    if (Array.isArray(batch)) keys.push(...batch);
} while (String(cursor) !== "0");

console.error(`Found ${keys.length} player records. Counting…`);

const CHUNK = 100;
let unlocked = 0;
let scanned = 0;
const sampleUsernames = [];
for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    const records = await Promise.all(slice.map(k => kv.get(k)));
    for (let j = 0; j < slice.length; j++) {
        scanned++;
        const r = records[j];
        if (!r || typeof r !== "object") continue;
        const unl = r.unlocked || {};
        if (unl[target]) {
            unlocked++;
            if (sampleUsernames.length < 5) {
                sampleUsernames.push(slice[j].replace("achievements:", ""));
            }
        }
    }
}

console.log(JSON.stringify({
    achievement: target,
    totalPlayersWithAchievements: scanned,
    unlocked,
    percentage: scanned > 0 ? Number(((unlocked / scanned) * 100).toFixed(2)) : 0,
    sample: sampleUsernames,
}, null, 2));
