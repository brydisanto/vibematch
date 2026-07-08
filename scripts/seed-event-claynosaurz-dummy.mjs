#!/usr/bin/env node
/**
 * Seed dummy per-pin counts for the Claynosaurz partner event so the
 * drawer's Points + Herds leaderboards render meaningful preview data.
 *
 * Writes:
 *   - promo:<pinId>:leaderboard              — per-pin owned counts (5 pins)
 *   - event_set:claynosaurz_partner_event:points  — computed total (points board)
 *   - event_set:claynosaurz_partner_event:herds   — composite score for Herds board
 *
 * Composite Herds score: fullSets * 1000 + cappedPoints (see
 *   src/lib/promo-badges.ts: encodeHerdsScore). fullSets = min of the
 *   4 BASE pin counts (cosmic excluded via isChase).
 *
 * Usage:
 *   node scripts/seed-event-claynosaurz-dummy.mjs                # dry run
 *   node scripts/seed-event-claynosaurz-dummy.mjs --apply         # write to KV
 *   node scripts/seed-event-claynosaurz-dummy.mjs --apply --clear # wipe + re-seed
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

const SET_ID = "claynosaurz_partner_event";
const PINS = [
    { id: "claynosaurz_common",    label: "Milo (Common)",         points: 1,  isChase: false },
    { id: "claynosaurz_rare",      label: "Bex (Rare)",            points: 2,  isChase: false },
    { id: "claynosaurz_epic",      label: "Trix (Epic)",           points: 5,  isChase: false },
    { id: "claynosaurz_legendary", label: "Flea (Legendary)",      points: 10, isChase: false },
    { id: "claynosaurz_cosmic",    label: "Claynoz Pio. (Cosmic)", points: 20, isChase: true  },
];
const SET_BONUS = 25;
const SCORE_CAP = 100;

// Fixture designed to exercise both leaderboards:
//   - Herds range from 0 → 4
//   - Multiple players at the 100-point cap (raffle-style tie)
//   - Some cosmic pulls sprinkled in for the "chase" flavor
const FIXTURE = [
    // [username,   common, rare, epic, leg, cosmic]
    ["bry",              8,   5,   4,   3,   1],  // 3 herds, points cap
    ["humanizer",       10,   7,   5,   4,   0],  // 4 herds → herds leader, points cap
    ["bunya",            9,   6,   4,   3,   2],  // 3 herds, points cap
    ["btdwayne",         7,   5,   3,   2,   0],  // 2 herds, points cap
    ["wyllt",            8,   4,   3,   2,   1],  // 2 herds, points cap
    ["matthieumdb",      6,   4,   2,   1,   0],  // 1 herd, 59 points
    ["adacrow",          5,   3,   2,   1,   0],  // 1 herd, 56 points
    ["laserguy",         4,   2,   1,   1,   0],  // 1 herd, 48 points
    ["catriona",         3,   2,   1,   0,   0],  // 0 herds, 12 points
    ["onward",           2,   1,   1,   0,   0],  // 0 herds, 9 points
    ["mrcookies",        2,   1,   0,   0,   0],  // 0 herds, 4 points
    ["panda",            1,   0,   0,   0,   0],  // 0 herds, 1 point
];

function computeScore(counts) {
    let pinScore = 0;
    let minBase = Infinity;
    let baseCount = 0;
    for (let i = 0; i < PINS.length; i++) {
        const owned = counts[i];
        pinScore += owned * PINS[i].points;
        if (PINS[i].isChase) continue;
        baseCount++;
        if (owned < minBase) minBase = owned;
    }
    const fullSets = baseCount === 0 || minBase === Infinity ? 0 : minBase;
    const setBonus = fullSets * SET_BONUS;
    const rawTotal = pinScore + setBonus;
    const cappedTotal = Math.min(rawTotal, SCORE_CAP);
    // Composite herds score matches encodeHerdsScore in promo-badges.ts.
    const herdsComposite = fullSets * 1000 + Math.min(999, Math.max(0, cappedTotal));
    return { pinScore, fullSets, setBonus, rawTotal, cappedTotal, herdsComposite };
}

const apply = process.argv.includes("--apply");
const doClear = process.argv.includes("--clear");

console.log(`seed-event-claynosaurz-dummy ${apply ? "--apply" : "(dry run)"} ${doClear ? "+ clear" : ""}\n`);

const pointsKey = `event_set:${SET_ID}:points`;
const herdsKey = `event_set:${SET_ID}:herds`;

if (apply && doClear) {
    console.log(`clearing existing data...`);
    await kvCmd("del", pointsKey);
    await kvCmd("del", herdsKey);
    for (const pin of PINS) {
        await kvCmd("del", `promo:${pin.id}:leaderboard`);
    }
}

const plan = FIXTURE.map(([username, c, r, e, l, cos]) => {
    const counts = [c, r, e, l, cos];
    const s = computeScore(counts);
    return { username, counts, ...s };
});

console.log("user            common  rare  epic  leg   cosmic  herds  points");
console.log("-".repeat(72));
for (const p of plan) {
    const [c, r, e, l, cos] = p.counts;
    console.log(
        `${p.username.padEnd(14)}  ` +
        `${String(c).padStart(6)}  ${String(r).padStart(4)}  ${String(e).padStart(4)}  ` +
        `${String(l).padStart(4)}  ${String(cos).padStart(6)}  ` +
        `${String(p.fullSets).padStart(5)}  ${String(p.cappedTotal).padStart(6)}`
    );
}

if (!apply) {
    console.log("\nDry run. Pass --apply to write.");
    process.exit(0);
}

console.log("\nWriting to KV...");
for (const p of plan) {
    for (let i = 0; i < PINS.length; i++) {
        const pin = PINS[i];
        await kvCmd("zadd", `promo:${pin.id}:leaderboard`, p.counts[i], p.username);
    }
    await kvCmd("zadd", pointsKey, p.cappedTotal, p.username);
    await kvCmd("zadd", herdsKey, p.herdsComposite, p.username);
}
console.log(`\nSeeded ${plan.length} users.`);
console.log(`\nPoints leaderboard (top 5):`);
[...plan].sort((a, b) => b.cappedTotal - a.cappedTotal).slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.username.padEnd(14)}  ${p.cappedTotal} pts`);
});
console.log(`\nHerds leaderboard (top 5, tie-broken by points):`);
[...plan].sort((a, b) => b.herdsComposite - a.herdsComposite).slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.username.padEnd(14)}  ${p.fullSets} herds · ${p.cappedTotal} pts`);
});
