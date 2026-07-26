#!/usr/bin/env node
// For each suspect Classic player, pull their top gamelog entries
// and run the server replay against the stored seed + moveSequence.
// Surfaces:
//   - score mismatches (submitted vs. replay-computed)
//   - missing replay records (can't verify at all)
//   - bombsCreated / maxCombo / cascade ratio per replay
//
// Goal: rank the top-leaderboard players by forgery likelihood.

import { readFileSync } from "fs";
import { register } from "module";
import { pathToFileURL } from "url";

// Use tsx to import the TypeScript engine directly.
// We invoke this script through `npx tsx` so the .ts imports resolve.
const { replayMoveSequence } = await import("../src/lib/gameEngine.ts");
const { BADGES } = await import("../src/lib/badges.ts");

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")];
}));
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

async function kv(...parts) {
    const url = `${KV_URL}/${parts.map(p => encodeURIComponent(String(p))).join("/")}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return r.json();
}

const SUSPECTS = [
    "sukoed", "crystavern", "moonrelium", "frosthaven", "ashenmoor",
    "miserymi", "klopi", "velorian", "papich", "hellmyname",
    "myravelle", "highway2hell", "shadowmere", "veronicamonacry", "buffet",
    "onward",
];

const rows = [];

for (const user of SUSPECTS) {
    // Get top 5 classic gamelog entries by score
    const r = await kv("zrange", `gamelog:${user}`, "0", "-1");
    const entries = (r.result || [])
        .map(raw => { try { return JSON.parse(raw); } catch { return null; } })
        .filter(e => e && e.gameMode === "classic")
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 3);

    for (const entry of entries) {
        const matchId = entry.matchId;
        const submitted = Number(entry.score) || 0;
        const ts = new Date(entry.timestamp).toISOString().slice(0, 10);

        if (!matchId) {
            rows.push({ user, ts, submitted, status: "no_matchid", computed: null, delta: null, bombs: entry.bombsCreated, moves: 0 });
            continue;
        }

        // Fetch the match token (seed + draftedBadgeIds) and the replay record
        const [tokRes, replayRes] = await Promise.all([
            kv("get", `pinbook:${user}:match:${matchId}`),
            kv("get", `replay:${user}:${matchId}`),
        ]);

        const matchToken = (() => {
            const raw = tokRes.result;
            if (!raw) return null;
            try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
        })();
        const replayRecord = (() => {
            const raw = replayRes.result;
            if (!raw) return null;
            try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
        })();

        if (!matchToken?.seed) {
            rows.push({ user, ts, submitted, status: "no_seed", computed: null, delta: null, bombs: entry.bombsCreated, moves: 0 });
            continue;
        }
        if (!Array.isArray(replayRecord?.moveSequence) || replayRecord.moveSequence.length === 0) {
            rows.push({ user, ts, submitted, status: "no_moves", computed: null, delta: null, bombs: entry.bombsCreated, moves: 0 });
            continue;
        }

        try {
            const draftedBadges = matchToken.draftedBadgeIds
                ? matchToken.draftedBadgeIds.map(id => BADGES.find(b => b.id === id)).filter(Boolean)
                : undefined;
            const result = replayMoveSequence({
                mode: "classic",
                seed: matchToken.seed,
                draftedBadges,
                moves: replayRecord.moveSequence,
            });
            const delta = submitted - result.finalScore;
            rows.push({
                user, ts, submitted,
                computed: result.finalScore,
                delta,
                bombs: entry.bombsCreated,
                replayBombs: result.bombsCreated,
                moves: replayRecord.moveSequence.length,
                status: Math.abs(delta) > 1 ? "MISMATCH" : "ok",
            });
        } catch (e) {
            rows.push({ user, ts, submitted, status: "replay_error", computed: null, delta: null, bombs: entry.bombsCreated, moves: replayRecord.moveSequence.length, err: e.message?.slice(0, 80) });
        }
    }
}

console.log("user            date        submitted  computed   delta      bombsC  bombsR  moves   status");
console.log("-".repeat(110));
for (const r of rows) {
    const u = r.user.padEnd(15);
    const sub = String(r.submitted).padStart(9);
    const comp = (r.computed != null ? String(r.computed) : "—").padStart(9);
    const del = (r.delta != null ? (r.delta > 0 ? "+" : "") + r.delta : "—").padStart(9);
    const bc = String(r.bombs ?? "?").padStart(6);
    const br = String(r.replayBombs ?? "—").padStart(6);
    const mv = String(r.moves || 0).padStart(5);
    console.log(`${u} ${r.ts}  ${sub}  ${comp}  ${del}  ${bc}  ${br}  ${mv}   ${r.status}${r.err ? " " + r.err : ""}`);
}
