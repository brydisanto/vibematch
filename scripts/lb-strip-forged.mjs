#!/usr/bin/env node
// One-off: strip a single suspicious leaderboard entry without banning
// the account. Re-seeds the player's LB score with their legitimate
// next-highest gamelog entry so they stay on the LB at a believable
// rank, and writes an admin_grants audit row so the action is
// traceable.
//
// Used 2026-05-30 for hollowmere — their 463,175 Classic submission
// had 12 lasers + 29 bombs + 1 cosmic in 30 moves (mathematically
// near-impossible) and was pre-snapshot, so replay-verification
// couldn't run post-hoc. Replay enforcement is now live so any
// future forgery attempt gets caught at submission.

import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")];
}));
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

const USERNAME = "hollowmere";
const FORGED_SCORE = 463175;
const LEGIT_NEXT_BEST = 174812;
const REASON = "lb-cleanup-stat-anomaly";
const NOTE = "Stripped 463,175 Classic submission (matchId b9a301d6, 12 lasers + 29 bombs + 1 cosmic over 30 moves — mathematically near-impossible). Pre-snapshot replay records expired so direct verification impossible. Account left intact for monitoring.";

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

const before = await kv("zscore", "classic_leaderboard", USERNAME);
console.log(`BEFORE classic_leaderboard score: ${before.result}`);

if (Number(before.result) !== FORGED_SCORE) {
    console.error(`Aborting: expected current LB score to be ${FORGED_SCORE}, got ${before.result}`);
    process.exit(1);
}

// 1. Remove the forged entry.
// 2. Re-seed with the player's next-highest legitimate Classic game.
// 3. Audit entry on admin_grants:<user>.
const auditEntry = {
    timestamp: Date.now(),
    admin: "bry (script: lb-strip-forged)",
    type: "lb_clean",
    reason: REASON,
    note: NOTE,
    removedScore: FORGED_SCORE,
    reseededScore: LEGIT_NEXT_BEST,
};
const result = await kvPipeline([
    ["zrem", "classic_leaderboard", USERNAME],
    ["zadd", "classic_leaderboard", LEGIT_NEXT_BEST, USERNAME],
    ["zadd", `admin_grants:${USERNAME}`, auditEntry.timestamp, JSON.stringify(auditEntry)],
]);

console.log("zrem result:", result[0]);
console.log("zadd LB result:", result[1]);
console.log("zadd audit result:", result[2]);

const after = await kv("zscore", "classic_leaderboard", USERNAME);
const newRank = await kv("zrevrank", "classic_leaderboard", USERNAME);
console.log(`\nAFTER classic_leaderboard score: ${after.result}`);
console.log(`New rank (0-indexed from top): ${newRank.result}`);
