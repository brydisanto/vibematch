#!/usr/bin/env node
// Pull every Classic game in the gamelog and surface the ones with
// abnormally high bomb counts or score-per-move ratios. Goal: spot
// the exploit pattern before patching.

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
        if (!Array.isArray(r.result)) break;
        const [next, batch] = r.result;
        keys.push(...(batch || []));
        if (String(next) === "0" || String(next) === cursor) break;
        cursor = String(next);
    } while (true);
    return keys;
}

const keys = await scan("gamelog:*");
console.error(`scanning ${keys.length} gamelogs...`);

const classic = [];
let scanned = 0;
for (const key of keys) {
    const username = key.replace(/^gamelog:/, "");
    const r = await kv(["zrange", encodeURIComponent(key), "0", "-1"]);
    for (const raw of (r.result || [])) {
        try {
            const e = JSON.parse(raw);
            if (e.gameMode !== "classic") continue;
            classic.push({
                username,
                score: Number(e.score) || 0,
                matchCount: Number(e.matchCount) || 0,
                maxCombo: Number(e.maxCombo) || 0,
                totalCascades: Number(e.totalCascades) || 0,
                bombs: Number(e.bombsCreated) || 0,
                vibestreaks: Number(e.vibestreaksCreated) || 0,
                cosmic: Number(e.cosmicBlastsCreated) || 0,
                matchId: e.matchId || null,
                validated: e.validatedMatch !== false,
                timestamp: Number(e.timestamp) || 0,
            });
        } catch {}
    }
    scanned++;
    if (scanned % 200 === 0) console.error(`  ${scanned}/${keys.length}`);
}

console.error(`${classic.length} classic games\n`);

// Distribution of bombs in Classic
const bombs = classic.map(g => g.bombs).sort((a,b) => a-b);
const n = bombs.length;
const p = pct => bombs[Math.min(n-1, Math.floor(n*pct))];
console.log("BOMB DISTRIBUTION (classic):");
console.log(`  median: ${p(0.5)}  p75: ${p(0.75)}  p90: ${p(0.9)}  p95: ${p(0.95)}  p99: ${p(0.99)}  max: ${bombs[n-1]}\n`);

const scores = classic.map(g => g.score).sort((a,b) => a-b);
console.log("SCORE DISTRIBUTION (classic):");
console.log(`  median: ${p.call(null, 0.5)}  ` + `p75: ${scores[Math.floor(n*0.75)].toLocaleString()}  p90: ${scores[Math.floor(n*0.9)].toLocaleString()}  p95: ${scores[Math.floor(n*0.95)].toLocaleString()}  p99: ${scores[Math.floor(n*0.99)].toLocaleString()}  max: ${scores[n-1].toLocaleString()}\n`);

// Top 25 by bomb count
console.log("TOP 25 BY BOMBS (classic):");
console.log("score\t\tbombs\tmatches\tcascades\tcombo\tlaser\tcosmic\tvalidated\tuser\tdate");
classic
    .sort((a,b) => b.bombs - a.bombs)
    .slice(0, 25)
    .forEach(g => {
        const d = new Date(g.timestamp).toISOString().slice(0,10);
        console.log(`${g.score.toLocaleString().padEnd(12)}\t${g.bombs}\t${g.matchCount}\t${g.totalCascades}\t\t${g.maxCombo}\t${g.vibestreaks}\t${g.cosmic}\t${g.validated}\t\t${g.username}\t${d}`);
    });

console.log("\nTOP 15 BY SCORE (classic):");
console.log("score\t\tbombs\tmatches\tcascades\tcombo\tspm\tvalidated\tuser\tdate");
classic
    .sort((a,b) => b.score - a.score)
    .slice(0, 15)
    .forEach(g => {
        const d = new Date(g.timestamp).toISOString().slice(0,10);
        const spm = g.matchCount > 0 ? Math.round(g.score / g.matchCount) : 0;
        console.log(`${g.score.toLocaleString().padEnd(12)}\t${g.bombs}\t${g.matchCount}\t${g.totalCascades}\t\t${g.maxCombo}\t${spm}\t${g.validated}\t\t${g.username}\t${d}`);
    });

console.log("\nTOP 15 BY SCORE/MATCH RATIO (classic, matchCount > 10):");
classic
    .filter(g => g.matchCount > 10)
    .sort((a,b) => (b.score/b.matchCount) - (a.score/a.matchCount))
    .slice(0, 15)
    .forEach(g => {
        const spm = Math.round(g.score / g.matchCount);
        const d = new Date(g.timestamp).toISOString().slice(0,10);
        console.log(`spm=${spm}\tscore=${g.score.toLocaleString()}\tbombs=${g.bombs}\tmatches=${g.matchCount}\tcasc=${g.totalCascades}\tcombo=${g.maxCombo}\tvalid=${g.validated}\t${g.username}\t${d}`);
    });
