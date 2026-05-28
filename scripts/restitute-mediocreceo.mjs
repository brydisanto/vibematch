#!/usr/bin/env node
// One-off restitution for mediocreceo. Capsule opens between his usage
// history landed without crediting the rolled badge (collectReveal had
// no retry, no server-side stranded-pending recovery — both fixed in
// commit f5a3d3a7). He confirmed three specific missed pins (Straw
// Man, Cosmic Guardian dupe, Suited Up dupe) and the audit math shows
// nine total lost opens, so we inject those three pins by hand and
// grant six fresh capsules to cover the remaining missed pulls.

import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
    envText.split("\n")
        .filter(l => l.trim() && !l.trim().startsWith("#"))
        .map(l => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
);

const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

const USERNAME = "mediocreceo";
const CAPSULES_TO_GRANT = 6;
const PINS_TO_INJECT = [
    { id: "straw_man", tier: "gold" },
    { id: "cosmic_guardian", tier: "cosmic" },
    { id: "suited_up", tier: "blue" },
];

async function kvGet(key) {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const j = await r.json();
    if (j.result == null) return null;
    try { return JSON.parse(j.result); } catch { return j.result; }
}

async function kvSet(key, value) {
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(value),
    });
    if (!r.ok) throw new Error(`kvSet failed: ${r.status} ${await r.text()}`);
    return r.json();
}

async function kvZadd(key, score, member) {
    const r = await fetch(`${KV_URL}/zadd/${encodeURIComponent(key)}/${score}/${encodeURIComponent(member)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!r.ok) throw new Error(`kvZadd failed: ${r.status} ${await r.text()}`);
    return r.json();
}

const pinbookKey = `pinbook:${USERNAME}`;
const data = await kvGet(pinbookKey);
if (!data) {
    console.error(`No pinbook found for ${USERNAME}`);
    process.exit(1);
}

const before = {
    capsules: data.capsules ?? 0,
    totalEarned: data.totalEarned ?? 0,
    pinCounts: PINS_TO_INJECT.map(p => ({ id: p.id, count: data.pins?.[p.id]?.count ?? 0 })),
    tierFound: { ...(data.totalFoundByTier ?? {}) },
};

data.pins = data.pins ?? {};
data.totalFoundByTier = data.totalFoundByTier ?? {};

const nowIso = new Date().toISOString();
for (const pin of PINS_TO_INJECT) {
    const existing = data.pins[pin.id];
    if (existing) {
        existing.count += 1;
        existing.lastPulled = nowIso;
    } else {
        data.pins[pin.id] = { count: 1, firstEarned: nowIso, lastPulled: nowIso };
    }
    data.totalFoundByTier[pin.tier] = (data.totalFoundByTier[pin.tier] ?? 0) + 1;
}

data.capsules = (data.capsules ?? 0) + CAPSULES_TO_GRANT;
data.totalEarned = (data.totalEarned ?? 0) + CAPSULES_TO_GRANT;

await kvSet(pinbookKey, data);

const audit = {
    timestamp: Date.now(),
    admin: "bry (script: restitute-mediocreceo)",
    type: "restitution",
    amount: CAPSULES_TO_GRANT,
    note: `restitution for stranded-pending bug: injected ${PINS_TO_INJECT.map(p => p.id).join(", ")} + ${CAPSULES_TO_GRANT} capsules`,
};
await kvZadd(`admin_grants:${USERNAME}`, audit.timestamp, JSON.stringify(audit));

const after = {
    capsules: data.capsules,
    totalEarned: data.totalEarned,
    pinCounts: PINS_TO_INJECT.map(p => ({ id: p.id, count: data.pins[p.id].count })),
    tierFound: data.totalFoundByTier,
};

console.log("BEFORE", JSON.stringify(before, null, 2));
console.log("AFTER ", JSON.stringify(after, null, 2));
console.log(`\nAudit entry written to admin_grants:${USERNAME}`);
