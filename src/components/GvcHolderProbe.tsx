"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * Sibling of VibestrHolderProbe: when a wallet is connected, POSTs the
 * address to /api/wallet/gvc-check so the server can (re)verify GVC NFT
 * holding — directly or via a delegate.xyz delegation — and reflect the
 * result into the `gvc:holders` set that powers the Axie "Points/GVC"
 * leaderboard.
 *
 * Fires once per distinct connected address per mount. The server
 * rate-limits and is idempotent, so re-fires are cheap and safe.
 */
export default function GvcHolderProbe() {
    const { address, isConnected } = useAccount();
    const lastChecked = useRef<string | null>(null);

    useEffect(() => {
        if (!isConnected || !address) return;
        const normalized = address.toLowerCase();
        if (lastChecked.current === normalized) return;
        lastChecked.current = normalized;

        fetch("/api/wallet/gvc-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: address }),
        }).catch(() => { /* silent — board fills on the next cron sweep */ });
    }, [isConnected, address]);

    return null;
}
