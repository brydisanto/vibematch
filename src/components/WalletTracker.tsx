"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";

/**
 * Invisible component that watches for wallet connection changes
 * and persists the address to the user's profile on the server.
 * Must be mounted inside a WagmiProvider.
 */
export default function WalletTracker() {
    const { address, isConnected } = useAccount();

    useEffect(() => {
        if (isConnected && address) {
            fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address }),
            }).catch(() => {});
        }
    }, [isConnected, address]);

    return null;
}
