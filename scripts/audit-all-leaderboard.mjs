#!/usr/bin/env node
// Usage: node scripts/audit-all-leaderboard.mjs [--threshold N]
//
// Walks the entire classic_leaderboard and compares each entry's score
// against the user's max validated classic gamelog score. Flags anyone
// whose leaderboard entry exceeds their validated max by more than
// --threshold (default 5000). Read-only — never writes.

import { createClient } from "@vercel/kv";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
    envFile.split("\n")
        .filter(l => l && !l.startsWith("#"))
        .map(l => { const [k, ...v] = l.split("="); return [k, v.join("=").replace(/^"|"$/g, "")]; })
);
const kv = createClient({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });

const args = process.argv.slice(2);
const tIdx = args.indexOf("--threshold");
const THRESHOLD = tIdx >= 0 ? Number(args[tIdx + 1]) : 5000;

// Top 200 leaderboard entries by score (descending)
const rows = await kv.zrange("classic_leaderboard", 0, 199, { rev: true, withScores: true });
// vercel/kv returns alternating [member, score, member, score, ...]
const entries = [];
for (let i = 0; i < rows.length; i += 2) {
    entries.push({ member: String(rows[i]), score: Number(rows[i + 1]) });
}

console.log(`Auditing ${entries.length} leaderboard entries (threshold: +${THRESHOLD})\n`);
console.log("  USER".padEnd(30) + "LB SCORE".padStart(10) + "  GAMELOG MAX".padStart(14) + "  DELTA".padStart(10));
console.log("  " + "-".repeat(64));

const flagged = [];
for (const { member, score: lbScore } of entries) {
    const lower = member.toLowerCase();
    const raw = await kv.zrange(`gamelog:${lower}`, 0, 499, { rev: true });
    let maxValidated = 0;
    for (const r of raw) {
        let e;
        try { e = typeof r === "string" ? JSON.parse(r) : r; } catch { continue; }
        if (!e || (e.gameMode && e.gameMode !== "classic")) continue;
        const s = Number(e.score) || 0;
        if (s > maxValidated && e.validatedMatch) maxValidated = s;
    }
    const delta = lbScore - maxValidated;
    const flag = delta > THRESHOLD ? " ⚠" : "";
    console.log(`  ${member.padEnd(28)}${String(lbScore).padStart(10)}  ${String(maxValidated).padStart(12)}  ${String(delta).padStart(8)}${flag}`);
    if (delta > THRESHOLD) flagged.push({ member, lbScore, maxValidated, delta });
}

console.log("");
if (flagged.length === 0) {
    console.log("✓ All entries consistent within threshold.");
} else {
    console.log(`⚠ ${flagged.length} flagged entries:`);
    for (const f of flagged) {
        console.log(`  ${f.member}: lb=${f.lbScore} validated=${f.maxValidated} delta=${f.delta}`);
        console.log(`    fix: node scripts/audit-leaderboard-entry.mjs ${f.member} --live`);
    }
}
