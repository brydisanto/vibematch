#!/usr/bin/env node
// Event-end snapshot for the OpenSea Aye Aye, Captain! event (ends
// 2026-06-08 16:00 UTC / 12PM EDT). Captures three leaderboards at
// the moment of running and writes wallet-resolved CSVs into
// snapshots/<ISO timestamp>/.
//
//   classic.csv  — top of classic_leaderboard
//   pins.csv     — top by uniquePins (pinbook scan)
//   opensea.csv  — top of promo:promo_opensea:leaderboard
//
// Each row includes username, score/pins, wallet, createdAt. Idempotent
// per run (each invocation writes its own timestamped folder).

import { readFileSync, writeFileSync, mkdirSync } from "fs";
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

const PROFILE_CHUNK = 100;
async function resolveProfiles(usernames) {
    const out = new Map();
    for (let i = 0; i < usernames.length; i += PROFILE_CHUNK) {
        const slice = usernames.slice(i, i + PROFILE_CHUNK);
        const pipe = slice.map(u => ["get", `user:${u.toLowerCase()}`]);
        const r = await kvPipeline(pipe);
        for (let j = 0; j < slice.length; j++) {
            const raw = r[j]?.result;
            if (!raw) { out.set(slice[j], { wallet: null, canonicalName: slice[j], createdAt: null }); continue; }
            try {
                const p = typeof raw === "string" ? JSON.parse(raw) : raw;
                out.set(slice[j], {
                    wallet: p?.walletAddress || null,
                    canonicalName: p?.username || slice[j],
                    createdAt: p?.createdAt || null,
                });
            } catch {
                out.set(slice[j], { wallet: null, canonicalName: slice[j], createdAt: null });
            }
        }
    }
    return out;
}

function escCsv(v) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

// Use environment override for deterministic test runs; falls back to "now".
const stampSrc = process.env.SNAPSHOT_TIMESTAMP || new Date().toISOString();
const folderStamp = stampSrc.replace(/[:.]/g, "-");
const outDir = resolve(__dirname, "..", "snapshots", folderStamp);
mkdirSync(outDir, { recursive: true });
console.log(`Writing to ${outDir}\n`);

// ── 1. Classic leaderboard ─────────────────────────────────────────
console.log("Classic leaderboard...");
const classicRaw = await kv("zrange", "classic_leaderboard", "0", "-1", "rev", "withscores");
const classicEntries = [];
const classicArr = classicRaw.result || [];
for (let i = 0; i < classicArr.length; i += 2) {
    classicEntries.push({ username: classicArr[i], score: Number(classicArr[i + 1]) || 0 });
}
console.log(`  ${classicEntries.length} entries`);

const classicNames = classicEntries.map(e => e.username);
const classicProfiles = await resolveProfiles(classicNames);
const classicCsv = [
    "rank,username,score,wallet_address,created_at",
    ...classicEntries.map((e, i) => {
        const p = classicProfiles.get(e.username) || {};
        return [i + 1, p.canonicalName || e.username, e.score, p.wallet || "", p.createdAt || ""].map(escCsv).join(",");
    }),
].join("\n");
writeFileSync(resolve(outDir, "classic.csv"), classicCsv);
console.log(`  → classic.csv`);

// ── 2. Pin collection (uniquePins) ─────────────────────────────────
console.log("\nPin leaderboard (uniquePins)...");
const pinbookKeys = (await scan("pinbook:*")).filter(k => !k.includes(":match:"));
console.log(`  scanning ${pinbookKeys.length} pinbooks`);
const pinHolders = [];
for (let i = 0; i < pinbookKeys.length; i += PROFILE_CHUNK) {
    const slice = pinbookKeys.slice(i, i + PROFILE_CHUNK);
    const pipe = slice.map(k => ["get", k]);
    const r = await kvPipeline(pipe);
    for (let j = 0; j < slice.length; j++) {
        const raw = r[j]?.result;
        if (!raw) continue;
        let data;
        try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { continue; }
        const pins = data?.pins;
        if (!pins || typeof pins !== "object") continue;
        const uniquePins = Object.keys(pins).length;
        if (uniquePins < 1) continue;
        const totalEarned = Number(data?.totalEarned) || 0;
        const username = slice[j].replace("pinbook:", "");
        pinHolders.push({ username, uniquePins, totalEarned });
    }
}
pinHolders.sort((a, b) => b.uniquePins - a.uniquePins || b.totalEarned - a.totalEarned);
const pinNames = pinHolders.map(h => h.username);
const pinProfiles = await resolveProfiles(pinNames);
const pinCsv = [
    "rank,username,unique_pins,total_capsules_earned,wallet_address,created_at",
    ...pinHolders.map((e, i) => {
        const p = pinProfiles.get(e.username) || {};
        return [i + 1, p.canonicalName || e.username, e.uniquePins, e.totalEarned, p.wallet || "", p.createdAt || ""].map(escCsv).join(",");
    }),
].join("\n");
writeFileSync(resolve(outDir, "pins.csv"), pinCsv);
console.log(`  → pins.csv (${pinHolders.length} collectors)`);

// ── 3. OpenSea event leaderboard ───────────────────────────────────
console.log("\nOpenSea event leaderboard...");
const openseaRaw = await kv("zrange", "promo:promo_opensea:leaderboard", "0", "-1", "rev", "withscores");
const openseaEntries = [];
const openseaArr = openseaRaw.result || [];
for (let i = 0; i < openseaArr.length; i += 2) {
    openseaEntries.push({ username: openseaArr[i], pinsCollected: Number(openseaArr[i + 1]) || 0 });
}
console.log(`  ${openseaEntries.length} collectors`);
const openseaNames = openseaEntries.map(e => e.username);
const openseaProfiles = await resolveProfiles(openseaNames);
const openseaCsv = [
    "rank,username,opensea_pins_collected,wallet_address,created_at",
    ...openseaEntries.map((e, i) => {
        const p = openseaProfiles.get(e.username) || {};
        return [i + 1, p.canonicalName || e.username, e.pinsCollected, p.wallet || "", p.createdAt || ""].map(escCsv).join(",");
    }),
].join("\n");
writeFileSync(resolve(outDir, "opensea.csv"), openseaCsv);
console.log(`  → opensea.csv`);

// ── Summary ────────────────────────────────────────────────────────
const summary = {
    snapshotAt: stampSrc,
    classic: {
        total: classicEntries.length,
        top3: classicEntries.slice(0, 3).map(e => ({
            username: classicProfiles.get(e.username)?.canonicalName || e.username,
            score: e.score,
            wallet: classicProfiles.get(e.username)?.wallet || null,
        })),
    },
    pins: {
        total: pinHolders.length,
        completedAll101: pinHolders.filter(h => h.uniquePins >= 101).length,
        top3: pinHolders.slice(0, 3).map(e => ({
            username: pinProfiles.get(e.username)?.canonicalName || e.username,
            uniquePins: e.uniquePins,
            wallet: pinProfiles.get(e.username)?.wallet || null,
        })),
    },
    opensea: {
        total: openseaEntries.length,
        top3: openseaEntries.slice(0, 3).map(e => ({
            username: openseaProfiles.get(e.username)?.canonicalName || e.username,
            pinsCollected: e.pinsCollected,
            wallet: openseaProfiles.get(e.username)?.wallet || null,
        })),
    },
};
writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log("\nSummary:");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nDone. Files in ${outDir}`);
