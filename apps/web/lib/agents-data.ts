import { eq } from "drizzle-orm"
import { createDb, schema } from "@workspace/shared/db"
import { env } from "@/env"

export interface AgentWithMandate {
  address: string
  name: string
  agentId: bigint
  maxAmountUsdc: bigint
  delegatorAddress: string
  expiry: bigint
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) _db = createDb(env.DATABASE_URL)
  return _db
}

export async function getAgentsWithMandates(): Promise<AgentWithMandate[]> {
  const rows = await getDb()
    .select({
      address: schema.agents.address,
      name: schema.agents.name,
      agentId: schema.agents.agentId,
      maxAmountUsdc: schema.mandates.maxAmountUsdc,
      delegatorAddress: schema.mandates.delegatorAddress,
      expiry: schema.mandates.expiry,
    })
    .from(schema.agents)
    .innerJoin(schema.mandates, eq(schema.agents.address, schema.mandates.agentAddress))

  return rows
}
