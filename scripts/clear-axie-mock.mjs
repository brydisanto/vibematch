#!/usr/bin/env node
/**
 * Remove the MOCK Axie Mystic Chase leaderboard data seeded by
 * seed-axie-mock.mjs. Removes exactly the usernames recorded in
 * .axie-mock-users.json from every Axie board key + gvc:holders, so no
 * real data is touched. RUN THIS BEFORE THE Aug 3 LAUNCH.
 *
 *   node scripts/clear-axie-mock.mjs
 */
import { readFileSync } from "fs";
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
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
}

const SET = "axie_partner_event";
const zsets = [
    `event_set:${SET}:points`,
    `event_set:${SET}:set_done`,
    `event_set:${SET}:grails`,
    ...["axie_rare_1", "axie_rare_2", "axie_rare_3", "axie_epic_1", "axie_epic_2", "axie_epic_3",
        "axie_mystic_1", "axie_mystic_2", "axie_mystic_3", "axie_grail"].map(id => `promo:${id}:leaderboard`),
];
const gvcKey = "gvc:holders";

async function run() {
    let users;
    try {
        users = JSON.parse(readFileSync(resolve(__dirname, ".axie-mock-users.json"), "utf8"));
    } catch {
        console.error("No .axie-mock-users.json found — nothing to purge (or run seed first).");
        process.exit(1);
    }
    let removed = 0;
    for (const name of users) {
        for (const key of zsets) removed += (await kv("zrem", key, name)) || 0;
        await kv("srem", gvcKey, name);
    }
    console.log(`Purged ${users.length} mock users (${removed} zset memberships removed) + gvc:holders entries.`);
    console.log("Verify empty: the Axie boards should read 0 players until real launch traffic.");
}
run().catch(e => { console.error(e); process.exit(1); });
