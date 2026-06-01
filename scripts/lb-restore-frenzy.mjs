#!/usr/bin/env node
// Undo the 2026-05-31 Frenzy LB strip (lb-strip-frenzy-forged.mjs).
// User decided the five flagged entries shouldn't be treated as
// confirmed forgeries — they want to keep watching.

import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")];
}));
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

const ENTRIES = [
    { user: "dofa",     score: 1212775 },
    { user: "slayer",   score: 1136073 },
    { user: "Permaban", score: 951572 },
    { user: "aynomi",   score: 840958 },
    { user: "wyllt",    score: 828975 },
];

async function kv(...parts) {
    const r = await fetch(`${KV_URL}/${parts.map(p => encodeURIComponent(String(p))).join("/")}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    return r.json();
}
async function kvPipeline(body) {
    const r = await fetch(`${KV_URL}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`pipeline failed: ${r.status} ${await r.text()}`);
    return r.json();
}

for (const { user, score } of ENTRIES) {
    const lcKey = user.toLowerCase();
    // Restore as the canonical-cased member; gt: true keeps higher scores
    // intact if the user's already legitimately exceeded.
    const audit = {
        timestamp: Date.now(),
        admin: "bry (script: lb-restore-frenzy)",
        type: "lb_restore",
        reason: "premature-cleanup-reverted",
        note: `Restoring ${score} after earlier strip; pending further investigation.`,
        restoredScore: score,
    };
    await kvPipeline([
        ["zrem", "frenzy_leaderboard", lcKey],
        ["zadd", "frenzy_leaderboard", score, user],
        ["zadd", `admin_grants:${lcKey}`, audit.timestamp, JSON.stringify(audit)],
    ]);
    const after = (await kv("zscore", "frenzy_leaderboard", user)).result;
    console.log(`${user.padEnd(15)} restored to ${score.toLocaleString()} (now ${after})`);
}
