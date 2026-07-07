import { desc } from "drizzle-orm"
import { createDb, schema } from "@workspace/shared/db"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { env } from "@/env"

export interface AttestationRow {
  paymentHash: string
  payer: string
  amountUsdc: bigint
  identityStatus: number
  decision: number
  timestamp: number
  settlementTx: string | null
  settlementTxUrl: string
  attestationTx: string
  attestationTxUrl: string
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) _db = createDb(env.DATABASE_URL)
  return _db
}

export async function getAttestations(): Promise<AttestationRow[]> {
  const rows = await getDb()
    .select()
    .from(schema.settlementAttestations)
    .orderBy(desc(schema.settlementAttestations.createdAt))
    .limit(50)

  return rows.map((row) => ({
    paymentHash: row.paymentHash,
    payer: row.payerAddress,
    amountUsdc: row.amountUsdc,
    identityStatus: row.identityStatus,
    decision: row.decision,
    timestamp: Math.floor(row.createdAt.getTime() / 1000),
    settlementTx: row.settlementTx,
    settlementTxUrl: row.settlementTx
      ? `${BASE_SEPOLIA_EXPLORER}/tx/${row.settlementTx}`
      : "",
    attestationTx: row.attestationTx ?? "",
    attestationTxUrl: row.attestationTx
      ? `${BASE_SEPOLIA_EXPLORER}/tx/${row.attestationTx}`
      : "",
  }))
}
