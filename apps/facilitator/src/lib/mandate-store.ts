import { eq } from "drizzle-orm"
import { createDb, schema } from "@workspace/shared/db"
import type { SignedMandate } from "@workspace/shared/mandate"

export interface MandateEntry {
  mandate: SignedMandate
  agentId: bigint
}

let _db: ReturnType<typeof createDb> | undefined

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("Missing env var: DATABASE_URL")
    _db = createDb(url)
  }
  return _db
}

export async function getMandate(agent: string): Promise<MandateEntry | undefined> {
  const db = getDb()
  const normalised = agent.toLowerCase()

  const rows = await db
    .select({
      agentId: schema.agents.agentId,
      delegatorAddress: schema.mandates.delegatorAddress,
      maxAmountUsdc: schema.mandates.maxAmountUsdc,
      expiry: schema.mandates.expiry,
      nonce: schema.mandates.nonce,
      signature: schema.mandates.signature,
    })
    .from(schema.mandates)
    .innerJoin(schema.agents, eq(schema.agents.address, schema.mandates.agentAddress))
    .where(eq(schema.mandates.agentAddress, normalised))
    .limit(1)

  if (rows.length === 0) return undefined

  const row = rows[0]!
  return {
    agentId: row.agentId,
    mandate: {
      payload: {
        agent: agent as `0x${string}`,
        delegator: row.delegatorAddress as `0x${string}`,
        maxAmountUsdc: row.maxAmountUsdc,
        expiry: row.expiry,
        nonce: row.nonce,
      },
      signature: row.signature as `0x${string}`,
    },
  }
}

export async function registerMandate(mandate: SignedMandate, agentId: bigint): Promise<boolean> {
  const db = getDb()
  const address = mandate.payload.agent.toLowerCase()

  await db.insert(schema.agents)
    .values({ address, agentId, name: address })
    .onConflictDoNothing()

  const result = await db.insert(schema.mandates)
    .values({
      agentAddress: address,
      delegatorAddress: mandate.payload.delegator,
      maxAmountUsdc: mandate.payload.maxAmountUsdc,
      expiry: mandate.payload.expiry,
      nonce: mandate.payload.nonce,
      signature: mandate.signature,
    })
    .onConflictDoNothing()
    .returning()

  return result.length > 0
}
