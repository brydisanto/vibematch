#!/usr/bin/env node
// Restitution sweep for the Frenzy achievement-verification regression
// fixed in commit 6f843b01.
//
// The achievements POST handler only loaded matchstats when
// gameMode === 'classic', so every Frenzy submission ended up with an
// empty serverVerifiedGameplay set. The Frenzy score-ladder quests
// (Flow State 100K through Seven Figure Club 1M, plus Slow Lane
// lowball) all fall through that path — they were silently rejected
// for every Frenzy player since launch.
//
// This sweep walks each user's gamelog, finds their best Frenzy
// score, and grants any missing rungs of the Frenzy score ladder
// (and the lowball quest if they have at least one sub-7,500 Frenzy
// game with matchCount > 0). Capsules are credited to pinbook just
// like the in-flight unlock path does.
//
// Idempotent: re-runs skip already-unlocked IDs.
// Dry-run by default; pass --apply to commit writes.

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
async function scan(pattern) {
    const keys = [];
    let cursor = "0";
    do {
        const r = await kv("scan", cursor, "match", pattern, "count", "500");
        if (!Array.isArray(r.result)) break;
        const [next, batch] = r.result;
        keys.push(...(batch || []));
        if (String(next) === "0" || String(next) === cursor) break;
        cursor = String(next);
    } while (true);
    return keys;
}

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

// safeNum clamp at 800K marks forgery byproducts — same exclusion as
// restitute-frenzy-scores.mjs. Any gamelog score at exactly this value
// is a clamped attempt and shouldn't earn quest credit.
const SAFE_NUM_CAP = 800_000;

const gamelogKeys = await scan("gamelog:*");
console.log(`scanning ${gamelogKeys.length} gamelogs for Frenzy peaks...`);

const candidates = []; // { username, bestFrenzyScore, lowballEligible }
for (const key of gamelogKeys) {
    const username = key.replace(/^gamelog:/, "");
    const r = await kv("zrange", key, "0", "-1");
    let best = 0;
    let hasLowball = false;
    for (const raw of (r.result || [])) {
        try {
            const e = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (e?.gameMode !== "frenzy") continue;
            const score = Number(e?.score) || 0;
            if (score === SAFE_NUM_CAP) continue;
            if (score > best) best = score;
            const matchCount = Number(e?.matchCount) || 0;
            if (matchCount > 0 && score > 0 && score < 7500) hasLowball = true;
        } catch {}
    }
    if (best >= 100_000 || hasLowball) {
        candidates.push({ username, bestFrenzyScore: best, lowballEligible: hasLowball });
    }
}

console.log(`${candidates.length} candidates with at least one qualifying Frenzy game\n`);

const plan = []; // { username, missingIds: string[], capsulesToAdd: number, best, achKey, pinKey, achData, pinbookData }

for (const c of candidates) {
    const achKey = `achievements:${c.username}`;
    const pinKey = `pinbook:${c.username}`;
    const [ach, pin] = await Promise.all([kv("get", achKey), kv("get", pinKey)]);

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
        if (c.bestFrenzyScore >= rung.min && !achData.unlocked[rung.id]) {
            missing.push(rung);
            capsulesToAdd += rung.capsules;
        }
    }
    if (c.lowballEligible && !achData.unlocked["lowball_frenzy"]) {
        missing.push({ id: "lowball_frenzy", capsules: 1, title: "Slow Lane" });
        capsulesToAdd += 1;
    }

    if (missing.length > 0) {
        plan.push({
            username: c.username,
            best: c.bestFrenzyScore,
            missingIds: missing.map(m => m.id),
            missingTitles: missing.map(m => m.title),
            capsulesToAdd,
            achKey,
            pinKey,
            achData,
            pinbookData,
        });
    }
}

console.log(`${plan.length} users need restitution\n`);

let totalCapsules = 0;
for (const p of plan) totalCapsules += p.capsulesToAdd;

console.log("user                  best Frenzy   add caps   missing quests");
for (const p of plan) {
    console.log(`${p.username.padEnd(20)}  ${String(p.best).padStart(10)}  ${String(p.capsulesToAdd).padStart(8)}    ${p.missingTitles.join(", ")}`);
}
console.log(`\nTotal capsules to grant: ${totalCapsules}`);

if (plan.length === 0) {
    console.log("nothing to restitute.");
    process.exit(0);
}

const forReal = process.argv.includes("--apply");
if (!forReal) {
    console.log("\nDry-run. Re-run with --apply to commit writes.");
    process.exit(0);
}

console.log("\nApplying...");
const now = Date.now();
const nowIso = new Date(now).toISOString();

for (const p of plan) {
    for (const id of p.missingIds) {
        p.achData.unlocked[id] = { unlockedAt: nowIso };
    }
    p.pinbookData.capsules = Number(p.pinbookData.capsules || 0) + p.capsulesToAdd;
    p.pinbookData.totalEarned = Number(p.pinbookData.totalEarned || 0) + p.capsulesToAdd;

    await kvSetJson(p.achKey, p.achData);
    await kvSetJson(p.pinKey, p.pinbookData);

    const audit = {
        timestamp: now,
        admin: "bry (script: restitute-frenzy-achievements)",
        type: "achievement_restitution",
        reason: "frenzy-matchstats-not-loaded-by-achievements-route",
        note: `Granted ${p.missingIds.length} Frenzy quest(s) (${p.missingIds.join(", ")}) — server verification path didn't load Frenzy matchstats. Best Frenzy score: ${p.best}.`,
        grantedIds: p.missingIds,
        capsules: p.capsulesToAdd,
        bestFrenzyScore: p.best,
    };
    await fetch(`${KV_URL}/zadd/${encodeURIComponent(`admin_grants:${p.username}`)}/${now}/${encodeURIComponent(JSON.stringify(audit))}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
}

console.log(`\nApplied ${plan.length} restitutions, granted ${totalCapsules} capsules.`);
