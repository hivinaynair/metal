import { desc } from "drizzle-orm"
import { createDb, schema } from "@workspace/shared/db"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { DEMO_POLICY_MAX_AMOUNT_USDC } from "@workspace/shared/demo"
import { env } from "@/env"

export interface AttestationRow {
  paymentHash: string
  payer: string
  amountUsdc: bigint
  policyMaxAmountUsdc: bigint
  identityStatus: number
  decision: number
  timestamp: number
  settlementTx: string | null
  settlementTxUrl: string
  attestationTx: string
  attestationTxUrl: string
}

interface AttestationDbRow {
  paymentHash: string
  payerAddress: string
  amountUsdc: bigint
  policyMaxAmountUsdc?: bigint
  identityStatus: number
  decision: number
  createdAt: Date
  settlementTx: string | null
  attestationTx: string | null
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) _db = createDb(env.DATABASE_URL)
  return _db
}

const DEFAULT_POLICY_MAX_ATOMIC = BigInt(Math.round(DEMO_POLICY_MAX_AMOUNT_USDC * 1_000_000))

export async function getAttestations(): Promise<AttestationRow[]> {
  const db = getDb()
  const baseSelect = {
    paymentHash: schema.settlementAttestations.paymentHash,
    payerAddress: schema.settlementAttestations.payerAddress,
    amountUsdc: schema.settlementAttestations.amountUsdc,
    identityStatus: schema.settlementAttestations.identityStatus,
    decision: schema.settlementAttestations.decision,
    createdAt: schema.settlementAttestations.createdAt,
    settlementTx: schema.settlementAttestations.settlementTx,
    attestationTx: schema.settlementAttestations.attestationTx,
  }

  let rows: AttestationDbRow[]

  try {
    rows = await db
      .select({
        ...baseSelect,
        policyMaxAmountUsdc: schema.settlementAttestations.policyMaxAmountUsdc,
      })
      .from(schema.settlementAttestations)
      .orderBy(desc(schema.settlementAttestations.createdAt))
      .limit(50)
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("policy_max_amount_usdc")) {
      throw err
    }
    rows = await db
      .select(baseSelect)
      .from(schema.settlementAttestations)
      .orderBy(desc(schema.settlementAttestations.createdAt))
      .limit(50)
  }

  return rows.map((row) => ({
    paymentHash: row.paymentHash,
    payer: row.payerAddress,
    amountUsdc: row.amountUsdc,
    policyMaxAmountUsdc: row.policyMaxAmountUsdc ?? DEFAULT_POLICY_MAX_ATOMIC,
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
