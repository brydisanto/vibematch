"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * Tiny sibling component that lives inside WalletProvider and, when the
 * user has a connected wallet, POSTs the address to
 * /api/wallet/vibestr-check. The server verifies VIBESTR balance via RPC
 * and writes the `vibestrHolder` flag onto user_flags — which in turn
 * unlocks the "Bag Holder" mastery quest on the next achievement check.
 *
 * Safe to render unconditionally inside any WalletProvider subtree; the
 * server deduplicates flagged users and rate-limits per session.
 */
export default function VibestrHolderProbe() {
    const { address, isConnected } = useAccount();
    const lastChecked = useRef<string | null>(null);

    useEffect(() => {
        if (!isConnected || !address) return;
        const normalized = address.toLowerCase();
        if (lastChecked.current === normalized) return;
        lastChecked.current = normalized;

        fetch("/api/wallet/vibestr-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: address }),
        })
            .then(r => r.json())
            .then(data => {
                if (data?.verified) {
                    // Signal the retroactive check via the same window event
                    // we already use for music, so Bag Holder fires without
                    // a page refresh.
                    window.dispatchEvent(new Event("vm:music-changed"));
                }
            })
            .catch(() => { /* silent */ });
    }, [isConnected, address]);

    return null;
}
