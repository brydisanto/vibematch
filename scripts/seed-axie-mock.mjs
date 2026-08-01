#!/usr/bin/env node
/**
 * Seed MOCK data for the Axie Infinity Mystic Chase leaderboards so the
 * preview branch can be reviewed visually. Populates all four boards:
 * Points, Full Set Race (set_done), Grail (grails composite), and
 * GVC Holders (gvc:holders subset).
 *
 *   node scripts/seed-axie-mock.mjs
 *
 * ⚠️  Preview and production share ONE Upstash KV. This writes to the REAL
 *     Axie keys. Axie is not live on prod so it will not display there, but
 *     it MUST be purged before the Aug 3 launch:
 *         node scripts/clear-axie-mock.mjs
 *     The exact usernames written are recorded to .axie-mock-users.json so
 *     the purge removes precisely these and nothing real.
 */
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
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
}

const SET = "axie_partner_event";
const pointsKey = `event_set:${SET}:points`;
const setDoneKey = `event_set:${SET}:set_done`;
const grailsKey = `event_set:${SET}:grails`;
const gvcKey = "gvc:holders";
const pinKey = id => `promo:${id}:leaderboard`;

const BASE = [
    ["axie_rare_1", 2], ["axie_rare_2", 2], ["axie_rare_3", 2],
    ["axie_epic_1", 4], ["axie_epic_2", 4], ["axie_epic_3", 4],
    ["axie_mystic_1", 10], ["axie_mystic_2", 10], ["axie_mystic_3", 10],
];
const GRAIL = "axie_grail";
const GRAIL_PTS = 25;
const GRAIL_BUCKET = 10_000_000;
const START_MS = Date.parse("2026-07-24T00:00:00Z"); // matches the preview shim
const WINDOW_S = 3.5 * 24 * 3600; // ~3.5 days into the event

function encodeGrailScore(count, secondsSinceStart) {
    const s = Math.min(GRAIL_BUCKET - 1, Math.max(0, Math.floor(secondsSinceStart)));
    return Math.max(0, Math.floor(count)) * GRAIL_BUCKET + (GRAIL_BUCKET - 1 - s);
}

// Fixed handle list so the purge script removes exactly these.
const HANDLES = [
    "NovaStrike", "PixelWraith", "GigaChad_Ron", "0xLumen", "shakabruh", "mistyvale",
    "ClaySmasher", "vibecheck_99", "AxieAndy", "terra_nyx", "OriginMain", "frostbyte",
    "kelpforest", "RoninRider", "moonpetal", "dustdevil", "SLPfarmer", "quietstorm_",
    "hexadecimal", "cobaltcat", "puddlejump", "GrailHunter", "sun_seeker", "mntbiker",
    "lotus_eater", "byte_me", "crimsonfin", "willowisp", "AxieMomo", "deepcurrent",
    "starlark", "pixelpounce", "verdanthum", "toastcrumb", "nimbus_ley", "AeryStorm",
    "koi_pond", "emberling", "glasswing", "sundropz", "AxieZuki", "riverstone",
    "cloudcover", "mossgrove", "AxieValen",
];

const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));

async function run() {
    const usernames = [];
    let completed = 0, withGrail = 0, gvc = 0;

    for (let u = 0; u < HANDLES.length; u++) {
        const name = HANDLES[u];
        usernames.push(name);
        // Simulate opens; top handles open more so the board has a spread.
        const opens = irnd(15, 170);
        const counts = Object.fromEntries(BASE.map(([id]) => [id, 0]));
        counts[GRAIL] = 0;
        const totalWeight = 52 * 3 + 25 * 3 + 22 * 3 + 3.3;
        for (let o = 0; o < opens; o++) {
            if (Math.random() >= 0.30) continue; // 30% event-pin rate
            let r = Math.random() * totalWeight;
            let picked = GRAIL;
            for (const [id] of BASE) {
                const w = id.includes("rare") ? 52 : id.includes("epic") ? 25 : 22;
                if ((r -= w) <= 0) { picked = id; break; }
            }
            counts[picked]++;
        }
        const baseCounts = BASE.map(([id]) => counts[id]);
        const fullSets = Math.min(...baseCounts);
        let points = BASE.reduce((s, [id, pts]) => s + counts[id] * pts, 0)
            + counts[GRAIL] * GRAIL_PTS + fullSets * 25;
        if (points <= 0) points = irnd(2, 12); // no dead rows

        // Points board + per-pin counters.
        await kv("zadd", pointsKey, points, name);
        for (const [id] of BASE) if (counts[id] > 0) await kv("zadd", pinKey(id), counts[id], name);
        if (counts[GRAIL] > 0) await kv("zadd", pinKey(GRAIL), counts[GRAIL], name);

        // Full Set Race: completion timestamp for anyone with a full set.
        if (fullSets >= 1) {
            const doneAt = START_MS + Math.floor(rnd(3600, WINDOW_S)) * 1000;
            await kv("zadd", setDoneKey, doneAt, name);
            completed++;
        }
        // Grail board: composite score (count, time-to-count).
        if (counts[GRAIL] > 0) {
            const secs = Math.floor(rnd(3600, WINDOW_S));
            await kv("zadd", grailsKey, encodeGrailScore(counts[GRAIL], secs), name);
            withGrail++;
        }
        // ~1 in 3 are GVC holders.
        if (Math.random() < 0.34) { await kv("sadd", gvcKey, name); gvc++; }
    }

    writeFileSync(resolve(__dirname, ".axie-mock-users.json"), JSON.stringify(usernames, null, 2));
    console.log(`Seeded ${usernames.length} mock players:`);
    console.log(`  Points board:     ${usernames.length}`);
    console.log(`  Full Set Race:    ${completed}`);
    console.log(`  Grail board:      ${withGrail}`);
    console.log(`  GVC Holders:      ${gvc}`);
    console.log(`Usernames recorded to scripts/.axie-mock-users.json`);
    console.log(`Purge before launch: node scripts/clear-axie-mock.mjs`);
}
run().catch(e => { console.error(e); process.exit(1); });
