#!/usr/bin/env node
// List users who have collected all 101 unique pins, with their wallet
// addresses. Reads pinbook:<user>.pins (the source of truth for
// uniquePins) and user:<user>.walletAddress.

import { readFileSync, writeFileSync } from "fs";
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

const pinbookKeys = await scan("pinbook:*");
// Filter out per-match keys (pinbook:<user>:match:<id>).
const userPinbookKeys = pinbookKeys.filter(k => !k.includes(":match:"));
console.log(`scanning ${userPinbookKeys.length} pinbooks for 101-pin holders...`);

// Pull in batches of 100
const CHUNK = 100;
const holders = []; // { username, uniquePins }
for (let i = 0; i < userPinbookKeys.length; i += CHUNK) {
    const slice = userPinbookKeys.slice(i, i + CHUNK);
    const pipe = slice.map(k => ["get", k]);
    const results = await kvPipeline(pipe);
    for (let j = 0; j < slice.length; j++) {
        const raw = results[j]?.result;
        if (!raw) continue;
        let data;
        try {
            data = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
            continue;
        }
        const pins = data?.pins;
        if (!pins || typeof pins !== "object") continue;
        const uniquePins = Object.keys(pins).length;
        if (uniquePins >= 101) {
            const username = slice[j].replace("pinbook:", "");
            holders.push({ username, uniquePins });
        }
    }
}

console.log(`${holders.length} users with >=101 pins\n`);

// Resolve wallets + canonical-cased usernames
const profilePipe = holders.map(h => ["get", `user:${h.username}`]);
const profileResults = await kvPipeline(profilePipe);
for (let i = 0; i < holders.length; i++) {
    const raw = profileResults[i]?.result;
    if (!raw) continue;
    let profile;
    try {
        profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
        continue;
    }
    holders[i].wallet = profile?.walletAddress || null;
    holders[i].canonicalName = profile?.username || holders[i].username;
    holders[i].createdAt = profile?.createdAt || null;
}

// Sort by canonical name for legibility
holders.sort((a, b) => (a.canonicalName || "").localeCompare(b.canonicalName || ""));

console.log("username                       unique  wallet");
console.log("-".repeat(90));
for (const h of holders) {
    const name = (h.canonicalName || h.username).padEnd(28);
    const u = String(h.uniquePins).padStart(4);
    const w = h.wallet || "(no wallet linked)";
    console.log(`${name}  ${u}    ${w}`);
}

// Write CSV
const outPath = resolve(__dirname, "..", "out-pins-all-holders.csv");
const csv = [
    "username,unique_pins,wallet_address,created_at",
    ...holders.map(h => [
        h.canonicalName || h.username,
        h.uniquePins,
        h.wallet || "",
        h.createdAt || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
].join("\n");
writeFileSync(outPath, csv);
console.log(`\nCSV → ${outPath}`);
console.log(`Total: ${holders.length} (${holders.filter(h => h.wallet).length} with wallet, ${holders.filter(h => !h.wallet).length} without)`);
