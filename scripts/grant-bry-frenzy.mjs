#!/usr/bin/env node
// One-off restitution for Bryan's missing Frenzy quests (Flow State,
// Zoom Zoom, Speed Racer). Achievement-route bug — see commit 6f843b01.
// Dry-run by default; pass --apply.

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

async function kv(...parts) {
    const r = await fetch(`${KV_URL}/${parts.map(p => encodeURIComponent(String(p))).join("/")}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    return r.json();
}
async function kvSetJson(key, value) {
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(value),
    });
    if (!r.ok) throw new Error(`set ${key} → ${r.status} ${await r.text()}`);
    return r.json();
}

const USER = "bry";
const FRENZY_LADDER = [
    { id: "frenzy_100k", min: 100_000, capsules: 1, title: "Flow State" },
    { id: "frenzy_200k", min: 200_000, capsules: 2, title: "Zoom Zoom" },
    { id: "frenzy_300k", min: 300_000, capsules: 3, title: "Speed Racer" },
    { id: "frenzy_400k", min: 400_000, capsules: 4, title: "Ricky Bobby" },
    { id: "frenzy_500k", min: 500_000, capsules: 5, title: "Here We Come, F1" },
    { id: "frenzy_690k", min: 690_000, capsules: 7, title: "Absolute Maniac" },
    { id: "frenzy_750k", min: 750_000, capsules: 8, title: "God of Frenzy" },
    { id: "frenzy_1m",   min: 1_000_000, capsules: 10, title: "Seven Figure Club" },
];

const gl = await kv("zrange", `gamelog:${USER}`, "0", "-1");
let best = 0;
let hasLowball = false;
for (const raw of (gl.result || [])) {
    try {
        const e = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (e?.gameMode !== "frenzy") continue;
        const score = Number(e?.score) || 0;
        if (score === 800_000) continue;
        if (score > best) best = score;
        const matchCount = Number(e?.matchCount) || 0;
        if (matchCount > 0 && score > 0 && score < 7500) hasLowball = true;
    } catch {}
}

console.log(`${USER} best Frenzy score: ${best}`);
console.log(`${USER} lowball eligible:  ${hasLowball}`);

const ach = await kv("get", `achievements:${USER}`);
const pin = await kv("get", `pinbook:${USER}`);
const achData = (ach.result && typeof ach.result === "string"
    ? JSON.parse(ach.result)
    : ach.result) || { unlocked: {} };
if (!achData.unlocked) achData.unlocked = {};
const pinbookData = (pin.result && typeof pin.result === "string"
    ? JSON.parse(pin.result)
    : pin.result) || { pins: {}, capsules: 0, totalOpened: 0, totalEarned: 0 };

const missing = [];
let capsulesToAdd = 0;
for (const rung of FRENZY_LADDER) {
    if (best >= rung.min && !achData.unlocked[rung.id]) {
        missing.push(rung);
        capsulesToAdd += rung.capsules;
    }
}
if (hasLowball && !achData.unlocked["lowball_frenzy"]) {
    missing.push({ id: "lowball_frenzy", capsules: 1, title: "Slow Lane" });
    capsulesToAdd += 1;
}

console.log(`\nMissing quests (${missing.length}):`);
for (const m of missing) console.log(`  ${m.id}  +${m.capsules}  ${m.title}`);
console.log(`\nTotal capsules: ${capsulesToAdd}`);
console.log(`Current pinbook capsules: ${pinbookData.capsules || 0} → ${(pinbookData.capsules || 0) + capsulesToAdd}`);

if (missing.length === 0) {
    console.log("\nNothing to do.");
    process.exit(0);
}

const forReal = process.argv.includes("--apply");
if (!forReal) {
    console.log("\nDry-run. Re-run with --apply to commit.");
    process.exit(0);
}

const now = Date.now();
const nowIso = new Date(now).toISOString();
for (const m of missing) achData.unlocked[m.id] = { unlockedAt: nowIso };
pinbookData.capsules = Number(pinbookData.capsules || 0) + capsulesToAdd;
pinbookData.totalEarned = Number(pinbookData.totalEarned || 0) + capsulesToAdd;

await kvSetJson(`achievements:${USER}`, achData);
await kvSetJson(`pinbook:${USER}`, pinbookData);

const audit = {
    timestamp: now,
    admin: "bry (script: grant-bry-frenzy)",
    type: "achievement_restitution",
    reason: "frenzy-matchstats-not-loaded-by-achievements-route",
    note: `Granted ${missing.map(m => m.id).join(", ")} — server verification path didn't load Frenzy matchstats. Best Frenzy score: ${best}.`,
    grantedIds: missing.map(m => m.id),
    capsules: capsulesToAdd,
    bestFrenzyScore: best,
};
await fetch(`${KV_URL}/zadd/${encodeURIComponent(`admin_grants:${USER}`)}/${now}/${encodeURIComponent(JSON.stringify(audit))}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
});

console.log(`\nApplied. Granted ${missing.length} quests, +${capsulesToAdd} capsules.`);
