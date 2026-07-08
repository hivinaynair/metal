import { and, eq } from "drizzle-orm"
import { createDb, schema } from "@workspace/shared/db"
import {
  parseSerializedMandateHeader,
  serializeMandateHeader,
} from "@workspace/shared/mandate-header"
import type { MandateHeaderValue } from "@workspace/shared/mandate-header"

const AP2_CREDENTIAL_TYPE = "ap2_mandate"

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("Missing env var: DATABASE_URL")
  if (!_db) _db = createDb(url)
  return _db
}

export async function getAp2CredentialForAgent(agentAddress: string): Promise<{
  entry: MandateHeaderValue
  header: string
} | undefined> {
  const normalised = agentAddress.toLowerCase()
  const rows = await getDb()
    .select({
      credentialJson: schema.agentCredentials.credentialJson,
      expiresAt: schema.agentCredentials.expiresAt,
    })
    .from(schema.agentCredentials)
    .where(and(
      eq(schema.agentCredentials.agentAddress, normalised),
      eq(schema.agentCredentials.credentialType, AP2_CREDENTIAL_TYPE),
    ))
    .limit(1)

  const row = rows[0]
  if (!row || row.expiresAt < BigInt(Math.floor(Date.now() / 1000))) {
    return undefined
  }

  const entry = parseSerializedMandateHeader(row.credentialJson)
  if (!entry || entry.mandate.payload.agent.toLowerCase() !== normalised) {
    return undefined
  }

  return {
    entry,
    header: serializeMandateHeader(entry),
  }
}

