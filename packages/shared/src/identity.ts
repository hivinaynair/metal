import type { PublicClient } from "viem"
import { ERC8004_ABI } from "./abis.js"
import type { AgentProfile } from "./types.js"

export async function lookupIdentity(
  agentId: bigint,
  registryAddress: `0x${string}`,
  client: Pick<PublicClient, "readContract">
): Promise<AgentProfile | null> {
  try {
    const [agentURI, wallet] = await Promise.all([
      client.readContract({
        address: registryAddress,
        abi: ERC8004_ABI,
        functionName: "tokenURI",
        args: [agentId],
      }) as Promise<string>,
      client.readContract({
        address: registryAddress,
        abi: ERC8004_ABI,
        functionName: "getAgentWallet",
        args: [agentId],
      }) as Promise<`0x${string}`>,
    ])
    if (!agentURI) return null
    return { agentId, wallet, agentURI }
  } catch {
    // treat any registry error (network, wrong address, unregistered token) as not found
    return null
  }
}
