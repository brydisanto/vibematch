#!/usr/bin/env node
// Strip Frenzy leaderboard forgeries that landed via the pre-fix
// /api/scores Frenzy path (no matchstats verification). For each user
// in the FORGERS list:
//   1. Inspect their gamelog Frenzy entries
//   2. Pick the highest plausible legitimate Frenzy score from gamelog
//      (where gamelog.score === LB.score, since the safeNum clamp at
//      800K is the forgery fingerprint — those entries are bogus too)
//   3. zrem the LB, re-seed with the legit next-best
//   4. Audit entry on admin_grants:<user>
//
// Used 2026-05-31 after Frenzy matchstats verification shipped.

import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")];
}));
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

const TOP_LB_THRESHOLD_LEGIT = 800_000; // safeNum clamp ceiling — any gamelog Frenzy entry at exactly this value is forgery byproduct
const FORGERS = [
    { user: "dofa",      lbScore: 1212775 },
    { user: "slayer",    lbScore: 1136073 },
    { user: "Permaban",  lbScore: 951572 },
    { user: "aynomi",    lbScore: 840958 },
    { user: "wyllt",     lbScore: 828975 },
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

async function findLegitFrenzyBest(username) {
    // Pull every gamelog entry, filter to frenzy, drop any at the safeNum
    // clamp ceiling (those are forgery fingerprints), return the highest
    // remaining score.
    const r = await kv("zrange", `gamelog:${username}`, "0", "-1");
    const entries = [];
    for (const raw of (r.result || [])) {
        try {
            const e = JSON.parse(raw);
            if (e?.gameMode !== "frenzy") continue;
            const s = Number(e?.score) || 0;
            if (s >= TOP_LB_THRESHOLD_LEGIT) continue; // forgery clamp value
            entries.push({ score: s, matchId: e.matchId, ts: e.timestamp });
        } catch {}
    }
    entries.sort((a, b) => b.score - a.score);
    return entries[0] || null;
}

for (const { user, lbScore } of FORGERS) {
    // Try both casings.
    const lcKey = user.toLowerCase();
    const lcScore = (await kv("zscore", "frenzy_leaderboard", lcKey)).result;
    const exactScore = (await kv("zscore", "frenzy_leaderboard", user)).result;
    const memberToStrip = exactScore !== null ? user : (lcScore !== null ? lcKey : null);
    if (!memberToStrip) {
        console.log(`SKIP ${user}: no LB entry`);
        continue;
    }
    const legit = await findLegitFrenzyBest(lcKey);
    const reseedScore = legit?.score || 0;
    const audit = {
        timestamp: Date.now(),
        admin: "bry (script: lb-strip-frenzy-forged)",
        type: "lb_clean",
        reason: "frenzy-matchstats-bypass",
        note: `Stripped Frenzy forgery (${lbScore}). Frenzy /api/scores was missing matchstats verification before commit a766d165; submission above safeNum 800K clamp confirms the path. Re-seeded with legit gamelog next-best ${reseedScore}.`,
        removedScore: lbScore,
        reseededScore: reseedScore,
        reseededMatchId: legit?.matchId || null,
    };

    const ops = [
        ["zrem", "frenzy_leaderboard", memberToStrip],
    ];
    if (reseedScore > 0) {
        // Reseed at the legit best so they stay on the LB at honest rank.
        ops.push(["zadd", "frenzy_leaderboard", reseedScore, lcKey]);
    }
    ops.push(["zadd", `admin_grants:${lcKey}`, audit.timestamp, JSON.stringify(audit)]);
    const result = await kvPipeline(ops);
    const newScore = (await kv("zscore", "frenzy_leaderboard", lcKey)).result;
    console.log(`${user.padEnd(15)} ${lbScore.toLocaleString().padStart(10)} → ${(newScore ? Number(newScore).toLocaleString() : "removed").padStart(10)}    (${result.length} ops)`);
}
