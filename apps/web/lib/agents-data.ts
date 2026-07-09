import { createDb, schema } from "@workspace/db"

export interface AgentWithMandate {
  address: string
  name: string
  agentId: bigint
  maxAmountUsdc: bigint | null
  delegatorAddress: string | null
  expiry: bigint | null
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) _db = createDb()
  return _db
}

export async function getAgentsWithMandates(): Promise<AgentWithMandate[]> {
  const rows = await getDb()
    .select({
      address: schema.agents.address,
      name: schema.agents.name,
      agentId: schema.agents.agentId,
    })
    .from(schema.agents)

  return rows.map((r) => ({
    ...r,
    maxAmountUsdc: null,
    delegatorAddress: null,
    expiry: null,
  }))
}
