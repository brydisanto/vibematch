import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Multi-account clusters: accounts that share an IP or a device fingerprint,
 * derived from the passive signal indexes (sig_ip:*, sig_device:*). A cluster
 * of 2+ usernames on the same signal is a candidate multi-account group to
 * review before validating event-reward payouts. Read-only; admin-gated.
 */

interface Cluster {
    type: "ip" | "device";
    value: string;
    count: number;
    members: string[];
}

async function scanClusters(prefix: string, type: "ip" | "device", minSize: number, keyCap: number): Promise<Cluster[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
        const [next, batch] = (await kv.scan(cursor, { match: `${prefix}*`, count: 300 })) as [string | number, string[]];
        cursor = next;
        keys.push(...batch);
        if (keys.length >= keyCap) break;
    } while (cursor !== 0 && cursor !== "0");

    const clusters: Cluster[] = [];
    // Batch the SMEMBERS reads so a large keyspace doesn't serialize.
    for (let i = 0; i < keys.length; i += 40) {
        const batch = keys.slice(i, i + 40);
        const memberLists = await Promise.all(batch.map(k => kv.smembers(k) as Promise<string[]>));
        memberLists.forEach((members, j) => {
            if (members.length >= minSize) {
                clusters.push({ type, value: batch[j].slice(prefix.length), count: members.length, members: members.sort() });
            }
        });
    }
    return clusters;
}

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const [ipClusters, deviceClusters] = await Promise.all([
            scanClusters("sig_ip:", "ip", 2, 20000),
            scanClusters("sig_device:", "device", 2, 20000),
        ]);
        const clusters = [...ipClusters, ...deviceClusters].sort((a, b) => b.count - a.count).slice(0, 300);
        return NextResponse.json({
            ipClusters: ipClusters.length,
            deviceClusters: deviceClusters.length,
            accountsInClusters: new Set(clusters.flatMap(c => c.members)).size,
            clusters,
        });
    } catch (e) {
        console.error("[clusters] error:", e);
        return NextResponse.json({ error: "Failed to compute clusters" }, { status: 500 });
    }
}
