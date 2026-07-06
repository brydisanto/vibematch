#!/usr/bin/env node
/**
 * Seed dummy per-pin counts for Craig's Bubble Gum Blast so the
 * leaderboard renders meaningful preview data. Writes:
 *   - promo:<pinId>:leaderboard  zsets — per-pin owned counts per user
 *   - event_set:craigs_bubble_gum_blast:points — computed total score
 *
 * Idempotent: each user's per-pin counts are SET (zadd) not
 * incremented, so re-running keeps the same fixture.
 *
 * Usage:
 *   node scripts/seed-event-set-dummy.mjs                # dry run
 *   node scripts/seed-event-set-dummy.mjs --apply         # write to KV
 *   node scripts/seed-event-set-dummy.mjs --apply --clear # wipe + re-seed
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
const PINS = [
    { id: "craigs_bubble_gum_blast_common",    label: "Common",    points: 1 },
    { id: "craigs_bubble_gum_blast_rare",      label: "Rare",      points: 2 },
    { id: "craigs_bubble_gum_blast_epic",      label: "Epic",      points: 5 },
    { id: "craigs_bubble_gum_blast_legendary", label: "Legendary", points: 10 },
];
const SET_BONUS = 25;
const SCORE_CAP = 100;

// Dummy fixture — varied profiles so the columns + sort behavior all
// surface in the preview. bry leads on Giga collection (most Legendary).
// humanizer is at the cap from heavy pulls. bunya is climbing. A few
// mid-tier and casual players round out the top 10.
const FIXTURE = [
    // [username,     common, rare, epic, legendary]
    ["bry",                8,   5,   3,   4],   // 4 Gigas → top of "most Giga" leaderboard
    ["humanizer",         12,   8,   5,   3],   // heavy pulls, capped
    ["bunya",             14,   6,   4,   2],
    ["btdwayne",          10,   5,   2,   2],
    ["wyllt",              9,   4,   3,   1],
    ["matthieumdb",        8,   3,   2,   2],
    ["adacrow",            6,   3,   2,   1],
    ["laserguy",           5,   2,   1,   1],
    ["catriona",           4,   2,   1,   0],
    ["onward",             3,   1,   1,   0],
    ["mrcookies",          2,   1,   0,   0],
    ["panda",              2,   0,   0,   0],
];

function computeScore(counts) {
    let pinScore = 0;
    let minOwned = Infinity;
    for (let i = 0; i < PINS.length; i++) {
        const owned = counts[i];
        pinScore += owned * PINS[i].points;
        if (owned < minOwned) minOwned = owned;
    }
    const fullSets = minOwned === Infinity ? 0 : minOwned;
    const setBonus = fullSets * SET_BONUS;
    const raw = pinScore + setBonus;
    return Math.min(raw, SCORE_CAP);
}

const apply = process.argv.includes("--apply");
const doClear = process.argv.includes("--clear");

console.log(`seed-event-set-dummy ${apply ? "--apply" : "(dry run)"} ${doClear ? "+ clear" : ""}\n`);

const eventSetKey = `event_set:${SET_ID}:points`;

if (apply && doClear) {
    console.log(`clearing existing data...`);
    await kvCmd("del", eventSetKey);
    for (const pin of PINS) {
        await kvCmd("del", `promo:${pin.id}:leaderboard`);
    }
}

const plan = FIXTURE.map(([username, c, r, e, l]) => {
    const counts = [c, r, e, l];
    const score = computeScore(counts);
    return { username, counts, score };
});

console.log("user            common  rare  epic  legendary  score");
console.log("-".repeat(60));
for (const p of plan) {
    const [c, r, e, l] = p.counts;
    console.log(
        `${p.username.padEnd(14)}  ${String(c).padStart(6)}  ${String(r).padStart(4)}  ${String(e).padStart(4)}  ${String(l).padStart(9)}  ${String(p.score).padStart(5)}`
    );
}

if (!apply) {
    console.log("\nDry run. Pass --apply to write.");
    process.exit(0);
}

console.log("\nWriting to KV...");
for (const p of plan) {
    // Per-pin counts → promo:<pinId>:leaderboard
    for (let i = 0; i < PINS.length; i++) {
        const pin = PINS[i];
        await kvCmd("zadd", `promo:${pin.id}:leaderboard`, p.counts[i], p.username);
    }
    // Computed score → event_set:<setId>:points
    await kvCmd("zadd", eventSetKey, p.score, p.username);
}
console.log(`\nSeeded ${plan.length} users.`);
console.log(`\nGiga leaderboard (sort by Legendary count):`);
const byGiga = [...plan].sort((a, b) => b.counts[3] - a.counts[3]);
byGiga.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.username.padEnd(14)}  ${p.counts[3]} Giga`);
});
