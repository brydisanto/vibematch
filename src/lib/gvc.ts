import { parseAbi } from "viem";
import { getMainnetClient } from "@/lib/eth-rpc";

/**
 * GVC (Good Vibes Club) NFT holder verification.
 *
 * Used by the Axie event's "Points/GVC" leaderboard, which ranks only
 * players who hold a GVC NFT. Holding is resolved two ways:
 *   1. Direct: balanceOf(GVC, wallet) > 0.
 *   2. Delegated: the wallet has an incoming delegate.xyz (v2) delegation
 *      from a vault that itself holds GVC. This lets holders compete from
 *      a hot/burner wallet without moving the NFT out of cold storage.
 *
 * The resolved set of qualifying usernames lives in the `gvc:holders` KV
 * set (see gvcHoldersKey). The leaderboard route filters the ranked
 * points cohort against that set — so a player who earns points first
 * and verifies their wallet later still appears, no backfill needed.
 */

export const GVC_CONTRACT = "0xb8ea78fcacef50d41375e44e6814ebba36bb33c4" as `0x${string}`;

// delegate.xyz v2 DelegateRegistry — same canonical CREATE2 address on
// every EVM chain, including Ethereum mainnet.
const DELEGATE_REGISTRY_V2 = "0x00000000000000447e69651d841bD8D104Bed493" as `0x${string}`;

export const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;

/** KV set of lowercased usernames verified to hold (or be delegated) GVC. */
export function gvcHoldersKey(): string {
    return "gvc:holders";
}

const erc721BalanceAbi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
]);

// v2 registry: getIncomingDelegations returns the full delegation list
// granted TO an address. type_: 0 NONE, 1 ALL, 2 CONTRACT, 3 ERC721,
// 4 ERC20, 5 ERC1155.
const delegateRegistryAbi = parseAbi([
    "struct Delegation { uint8 type_; address to; address from; bytes32 rights; address contract_; uint256 tokenId; uint256 amount; }",
    "function getIncomingDelegations(address to) view returns (Delegation[])",
]);

const ZERO = BigInt(0);

/**
 * Given a connected wallet, return every address that could satisfy GVC
 * holding on its behalf: the wallet itself, plus any vault that has
 * delegated to it at a scope covering GVC (ALL, or CONTRACT/ERC721 for
 * the GVC contract). Delegate resolution is best-effort — a registry
 * hiccup never blocks the direct-balance path.
 */
export async function resolveGvcCandidates(wallet: `0x${string}`): Promise<`0x${string}`[]> {
    const candidates = new Set<string>([wallet.toLowerCase()]);
    try {
        const client = getMainnetClient();
        const delegations = await client.readContract({
            address: DELEGATE_REGISTRY_V2,
            abi: delegateRegistryAbi,
            functionName: "getIncomingDelegations",
            args: [wallet],
        }) as ReadonlyArray<{ type_: number; from: string; contract_: string }>;
        const gvc = GVC_CONTRACT.toLowerCase();
        for (const d of delegations) {
            const scopesGvc =
                d.type_ === 1 || // ALL
                ((d.type_ === 2 || d.type_ === 3) && d.contract_.toLowerCase() === gvc); // CONTRACT / ERC721
            if (scopesGvc && d.from) candidates.add(d.from.toLowerCase());
        }
    } catch {
        // Registry unreachable — fall back to direct wallet only.
    }
    return [...candidates] as `0x${string}`[];
}

/**
 * True if `wallet` holds GVC directly or via an incoming delegation from
 * a GVC-holding vault. Reads balanceOf across all candidate addresses,
 * short-circuiting on the first positive balance.
 */
export async function isGvcHolder(wallet: `0x${string}`): Promise<boolean> {
    const client = getMainnetClient();
    const candidates = await resolveGvcCandidates(wallet);
    for (const addr of candidates) {
        try {
            const balance = await client.readContract({
                address: GVC_CONTRACT,
                abi: erc721BalanceAbi,
                functionName: "balanceOf",
                args: [addr],
            });
            const held = typeof balance === "bigint" ? balance : BigInt(balance as unknown as string);
            if (held > ZERO) return true;
        } catch {
            // Skip a single failed read; try the next candidate.
        }
    }
    return false;
}
