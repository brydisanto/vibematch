#!/usr/bin/env node
// Restitution sweep for the Frenzy matchstats-validation bug
// (commits a766d165 → 2718ce2f, 2026-05-31 to 2026-06-02).
//
// During that window the Frenzy /api/scores path required matchstats
// agreement, but the logGame code only wrote matchstats for Classic
// games. Every legit Frenzy submission was therefore rejected with
// outcome=missing, and the leaderboard never advanced.
//
// This script scans every user's gamelog, finds the max Frenzy
// score per user, and bumps frenzy_leaderboard to that score if the
// gamelog max exceeds the current LB entry. zadd uses GT semantics
// so we never lower anyone's score — if their current LB is already
// higher (perhaps because of pre-bug submissions), we leave it.
//
// Best-effort and idempotent: safe to re-run.

import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")];
}));
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

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
    if (!r.ok) throw new Error(`pipeline ${r.status} ${await r.text()}`);
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

const SAFE_NUM_CAP = 800_000; // anything at this exact value is a clamped forgery byproduct — skip
const RESTITUTION_WINDOW_START = Date.parse("2026-05-31T00:00:00Z"); // when the regression went live

const keys = await scan("gamelog:*");
console.log(`scanning ${keys.length} gamelogs for Frenzy max within restitution window...`);

const candidates = []; // { username, maxScore, matchId, ts }
for (const key of keys) {
    const username = key.replace(/^gamelog:/, "");
    const r = await kv("zrange", key, "0", "-1");
    let best = null;
    for (const raw of (r.result || [])) {
        try {
            const e = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (e?.gameMode !== "frenzy") continue;
            const ts = Number(e?.timestamp) || 0;
            if (ts < RESTITUTION_WINDOW_START) continue;
            const score = Number(e?.score) || 0;
            // Skip safeNum-clamped forgery byproducts at exactly 800K
            // (those were the dofa/slayer/etc. cluster).
            if (score >= SAFE_NUM_CAP) continue;
            if (!best || score > best.score) {
                best = { score, matchId: e.matchId, ts };
            }
        } catch {}
    }
    if (best && best.score > 0) {
        candidates.push({ username, ...best });
    }
}

console.log(`${candidates.length} users have at least one in-window Frenzy game\n`);

// Resolve canonical-cased username from user profile so we hit the right
// LB member (the score POST writes using profile.username casing, not
// the lowercase gamelog key). Without this we'd accidentally create
// duplicate lowercase entries alongside the existing capital-cased ones.
const profilePipe = [];
for (const c of candidates) profilePipe.push(["get", `user:${c.username}`]);
const profileResults = await kvPipeline(profilePipe);
for (let i = 0; i < candidates.length; i++) {
    try {
        const raw = profileResults[i]?.result;
        if (!raw) continue;
        const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (profile?.username && typeof profile.username === "string") {
            candidates[i].canonicalName = profile.username;
        }
    } catch {}
}
for (const c of candidates) {
    if (!c.canonicalName) c.canonicalName = c.username;
}

// Fetch current LB scores against the CANONICAL member name.
const pipeline = [];
for (const c of candidates) pipeline.push(["zscore", "frenzy_leaderboard", c.canonicalName]);
const lbResults = await kvPipeline(pipeline);

const bumps = [];
for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const currentLb = Number(lbResults[i]?.result ?? 0);
    if (c.score > currentLb) {
        bumps.push({ ...c, currentLb });
    }
}

console.log(`${bumps.length} users need an LB bump:\n`);
console.log("user                  canonical            current LB      new max         delta            matchId");
for (const b of bumps) {
    console.log(`${b.username.padEnd(20)}  ${b.canonicalName.padEnd(18)}  ${String(b.currentLb).padStart(10)}  ${String(b.score).padStart(10)}  ${String(b.score - b.currentLb).padStart(10)}     ${b.matchId?.slice(0, 8) || ''}`);
}

if (bumps.length === 0) {
    console.log("no restitution needed.");
    process.exit(0);
}

// Confirm before writing
const forReal = process.argv.includes("--apply");
if (!forReal) {
    console.log("\nDry-run. Re-run with --apply to perform writes.");
    process.exit(0);
}

console.log("\nApplying...");
const ops = [];
const now = Date.now();
for (const b of bumps) {
    ops.push(["zadd", "frenzy_leaderboard", { gt: true }, b.score, b.username]);
    const audit = {
        timestamp: now,
        admin: "bry (script: restitute-frenzy-scores)",
        type: "lb_restitution",
        reason: "frenzy-matchstats-false-positive",
        note: `Frenzy LB bumped from ${b.currentLb} → ${b.score} (matchId ${b.matchId}). Score was rejected during 5/31-6/2 by Frenzy matchstats verification while logGame wasn't writing matchstats for Frenzy.`,
        previousLb: b.currentLb,
        restoredScore: b.score,
        matchId: b.matchId,
    };
    ops.push(["zadd", `admin_grants:${b.username.toLowerCase()}`, now, JSON.stringify(audit)]);
}

// Note: zadd with options needs raw redis args, not the structured-arg form.
// Use a separate pass for the LB writes via individual calls so the GT option
// applies cleanly.
for (const b of bumps) {
    await kv("zadd", "frenzy_leaderboard", "GT", b.score, b.canonicalName);
}
// Audit rows can go in one pipeline
const auditOps = [];
for (const b of bumps) {
    const audit = {
        timestamp: now,
        admin: "bry (script: restitute-frenzy-scores)",
        type: "lb_restitution",
        reason: "frenzy-matchstats-false-positive",
        note: `Frenzy LB bumped from ${b.currentLb} → ${b.score} (matchId ${b.matchId}).`,
        previousLb: b.currentLb,
        restoredScore: b.score,
        matchId: b.matchId,
    };
    auditOps.push(["zadd", `admin_grants:${b.username.toLowerCase()}`, now, JSON.stringify(audit)]);
}
await kvPipeline(auditOps);

console.log(`\nApplied ${bumps.length} LB bumps + audit rows.`);
