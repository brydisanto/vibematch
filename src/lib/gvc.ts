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
export async function resolveGvcCandidates(
    wallet: `0x${string}`,
): Promise<{ candidates: `0x${string}`[]; delegationOk: boolean }> {
    const candidates = new Set<string>([wallet.toLowerCase()]);
    let delegationOk = false;
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
        delegationOk = true;
    } catch {
        // Registry unreachable — we may have missed a delegating vault, so the
        // caller must treat a zero direct balance as UNKNOWN, not "no".
        delegationOk = false;
    }
    return { candidates: [...candidates] as `0x${string}`[], delegationOk };
}

/** Read balanceOf(GVC, addr) with retries. Returns null only if every
 *  attempt failed, so a caller can tell "confirmed 0" from "couldn't read". */
async function readGvcBalance(addr: `0x${string}`): Promise<bigint | null> {
    const client = getMainnetClient();
    const RETRIES = 3;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
            const balance = await client.readContract({
                address: GVC_CONTRACT,
                abi: erc721BalanceAbi,
                functionName: "balanceOf",
                args: [addr],
            });
            return typeof balance === "bigint" ? balance : BigInt(balance as unknown as string);
        } catch {
            if (attempt < RETRIES - 1) {
                await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
            }
        }
    }
    return null;
}

export type GvcHolderStatus = "holds" | "no" | "unknown";

/**
 * Tri-state GVC holder check. "unknown" means we could NOT verify (an RPC
 * balance read failed, or the delegation lookup failed so a delegating vault
 * may have been missed). Callers that decide REMOVAL must never drop a holder
 * on "unknown" — only on a confirmed "no". Prevents transient RPC failures
 * from churning real holders off the board.
 */
export async function checkGvcHolder(wallet: `0x${string}`): Promise<GvcHolderStatus> {
    const { candidates, delegationOk } = await resolveGvcCandidates(wallet);
    let anyReadFailed = false;
    for (const addr of candidates) {
        const bal = await readGvcBalance(addr);
        if (bal === null) { anyReadFailed = true; continue; }
        if (bal > ZERO) return "holds";
    }
    // No candidate confirmed a balance. If anything was unverifiable, we can't
    // be sure they don't hold — say "unknown" so membership is preserved.
    if (anyReadFailed || !delegationOk) return "unknown";
    return "no";
}

/**
 * True if `wallet` holds GVC directly or via delegation. Add-only callers
 * (verify-on-connect) use this: only a definitive "holds" adds to the set;
 * "no"/"unknown" never remove.
 */
export async function isGvcHolder(wallet: `0x${string}`): Promise<boolean> {
    return (await checkGvcHolder(wallet)) === "holds";
}
