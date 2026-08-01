#!/usr/bin/env node
// Compute per-game score averages for Classic vs Frenzy by scanning
// every user's gamelog zset and bucketing the entries by mode.

import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")];
}));
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

async function kv(cmd) {
    const r = await fetch(`${KV_URL}/${cmd.join("/")}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return r.json();
}
async function scan(pattern) {
    const keys = [];
    let cursor = "0";
    do {
        const r = await kv(["scan", cursor, "match", encodeURIComponent(pattern), "count", "500"]);
        const result = r.result;
        if (!Array.isArray(result)) break;
        const next = String(result[0]);
        const batch = result[1] || [];
        keys.push(...batch);
        if (next === "0" || next === cursor) break;
        cursor = next;
    } while (true);
    return keys;
}

const keys = await scan("gamelog:*");
console.log(`Scanning ${keys.length} gamelog zsets...`);

const buckets = { classic: [], frenzy: [], daily: [] };
let processed = 0;

for (const key of keys) {
    const r = await kv(["zrange", encodeURIComponent(key), "0", "-1"]);
    const members = r.result || [];
    for (const raw of members) {
        try {
            const entry = JSON.parse(raw);
            const mode = entry.gameMode || "classic";
            const score = Number(entry.score);
            if (!Number.isFinite(score) || score <= 0) continue;
            if (buckets[mode]) buckets[mode].push(score);
        } catch {}
    }
    processed++;
    if (processed % 100 === 0) console.error(`  ${processed}/${keys.length}`);
}

function stats(arr, label) {
    if (!arr.length) { console.log(`${label}: no data`); return; }
    const s = arr.slice().sort((a,b) => a-b);
    const n = s.length;
    const sum = s.reduce((a,b) => a+b, 0);
    const avg = sum / n;
    const median = n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2;
    const p25 = s[Math.floor(n*0.25)];
    const p75 = s[Math.floor(n*0.75)];
    const p90 = s[Math.floor(n*0.9)];
    const p99 = s[Math.floor(n*0.99)];
    const fmt = v => Math.round(v).toLocaleString();
    console.log(`${label}:
  games:  ${n.toLocaleString()}
  avg:    ${fmt(avg)}
  p25:    ${fmt(p25)}
  median: ${fmt(median)}
  p75:    ${fmt(p75)}
  p90:    ${fmt(p90)}
  p99:    ${fmt(p99)}
  top:    ${fmt(s[n-1])}`);
}

stats(buckets.classic, "CLASSIC (per game)");
stats(buckets.frenzy,  "FRENZY  (per game)");
stats(buckets.daily,   "DAILY   (per game)");
