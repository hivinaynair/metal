import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { createDb, schema } from "@workspace/db"
import { lookupIdentity } from "@workspace/shared/identity"
import { ERC8004_REGISTRY_ADDRESS } from "@workspace/shared/chains"

export interface AgentWithMandate {
  address: string
  name: string
  agentId: bigint
  maxAmountUsdc: bigint | null
  delegatorAddress: string | null
  expiry: bigint | null
  onChainTrusted: boolean
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) _db = createDb()
  return _db
}

let _client: ReturnType<typeof createPublicClient> | undefined
function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: baseSepolia,
      transport: http("https://sepolia.base.org"),
    })
  }
  return _client
}

async function getOnChainTrusted(agentId: bigint, address: string): Promise<boolean> {
  try {
    const client = getPublicClient()
    const profile = await lookupIdentity(agentId, ERC8004_REGISTRY_ADDRESS, client)
    if (!profile) return false
    return profile.wallet.toLowerCase() === address.toLowerCase()
  } catch {
    return false
  }
}

export async function getAgentsWithMandates(): Promise<AgentWithMandate[]> {
  const rows = await getDb()
    .select({
      address: schema.agents.address,
      name: schema.agents.name,
      agentId: schema.agents.agentId,
    })
    .from(schema.agents)

  const withTrust = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      maxAmountUsdc: null,
      delegatorAddress: null,
      expiry: null,
      onChainTrusted: await getOnChainTrusted(r.agentId, r.address),
    }))
  )

  return withTrust
}
