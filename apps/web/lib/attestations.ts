import { desc } from "drizzle-orm"
import { schema } from "@workspace/db"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { DEMO_POLICY_MAX_AMOUNT_USDC } from "@workspace/shared/demo"
import { Decision } from "@workspace/shared/types"
import { getDb } from "./db"
import { publicClient } from "./viem-client"

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

const DEFAULT_POLICY_MAX_ATOMIC = BigInt(Math.round(DEMO_POLICY_MAX_AMOUNT_USDC * 1_000_000))

async function decisionWithReceiptStatus(row: AttestationDbRow) {
  if (row.decision !== Decision.Approved || !row.settlementTx) return row.decision
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: row.settlementTx as `0x${string}`,
    })
    return receipt.status === "success" ? row.decision : Decision.Rejected
  } catch {
    return row.decision
  }
}

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

  return Promise.all(rows.map(async (row) => ({
    paymentHash: row.paymentHash,
    payer: row.payerAddress,
    amountUsdc: row.amountUsdc,
    policyMaxAmountUsdc: row.policyMaxAmountUsdc ?? DEFAULT_POLICY_MAX_ATOMIC,
    identityStatus: row.identityStatus,
    decision: await decisionWithReceiptStatus(row),
    timestamp: Math.floor(row.createdAt.getTime() / 1000),
    settlementTx: row.settlementTx,
    settlementTxUrl: row.settlementTx
      ? `${BASE_SEPOLIA_EXPLORER}/tx/${row.settlementTx}`
      : "",
    attestationTx: row.attestationTx ?? "",
    attestationTxUrl: row.attestationTx
      ? `${BASE_SEPOLIA_EXPLORER}/tx/${row.attestationTx}`
      : "",
  })))
}
