import type { PublicClient } from "viem"
import { IDENTITY_REGISTRY_ABI } from "./abis"
import type { AgentProfile } from "./types"

export async function lookupIdentity(
  agent: `0x${string}`,
  registryAddress: `0x${string}`,
  client: Pick<PublicClient, "readContract">
): Promise<AgentProfile | null> {
  try {
    const profile = (await client.readContract({
      address: registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "lookup",
      args: [agent],
    })) as AgentProfile
    return profile.exists ? profile : null
  } catch {
    return null
  }
}
