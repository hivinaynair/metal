import { keccak256 } from "viem"
import { and, eq } from "drizzle-orm"
import { ATTESTATION_REGISTRY_ABI } from "@workspace/shared/abis"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { createDb, schema } from "@workspace/shared/db"
import { walletClient, account } from "../lib/clients.js"
import { getMandate } from "../lib/mandate-store.js"
import { getPayerAddress } from "../lib/mandate.js"
import { env } from "../lib/env.js"
import { getPolicyMaxAmountUsdc } from "../lib/policy-store.js"
import type {
  FacilitatorSettleContext,
  FacilitatorSettleResultContext,
  FacilitatorSettleFailureContext,
} from "@x402/core/facilitator"
import type { SettleResponse } from "@x402/core/types"

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("Missing env var: DATABASE_URL")
    _db = createDb(url)
  }
  return _db
}

function extractAuthNonce(payload: unknown): string | undefined {
  const p = payload as Record<string, unknown>
  const auth = p.authorization as Record<string, unknown> | undefined
  return auth?.nonce as string | undefined
}

export async function onBeforeSettle({
  paymentPayload,
  requirements,
}: FacilitatorSettleContext): Promise<void | { abort: true; reason: string }> {
  const paymentAmountAtomic = BigInt(requirements.amount)
  const policyMaxAtomic = BigInt(Math.round(getPolicyMaxAmountUsdc() * 1_000_000))
  if (paymentAmountAtomic > policyMaxAtomic) {
    const payer = getPayerAddress(paymentPayload.payload)
    if (payer) {
      const mandate = await getMandate(payer)
      const identityStatus = mandate ? IdentityStatus.Verified : IdentityStatus.NotFound
      const authNonce = extractAuthNonce(paymentPayload.payload) ?? ""
      const paymentHash = keccak256(
        new TextEncoder().encode(
          `${payer}-${paymentAmountAtomic}-${authNonce}`
        ) as unknown as `0x${string}`
      )
      try {
        await getDb().insert(schema.settlementAttestations).values({
          paymentHash,
          settlementTx: null,
          attestationTx: null,
          payerAddress: payer,
          amountUsdc: paymentAmountAtomic,
          identityStatus,
          decision: Decision.Rejected,
          authorizationNonce: authNonce || null,
        })
      } catch (err) {
        console.error("[onBeforeSettle] db insert failed:", err)
      }
    }
    return { abort: true, reason: "policy_amount_exceeded" }
  }
}

export async function onAfterSettle({
  paymentPayload,
  result,
}: FacilitatorSettleResultContext): Promise<void> {
  if (!result.success || !result.transaction) return

  const payer = getPayerAddress(paymentPayload.payload)
  if (!payer) return

  const amountUsdcAtomic = BigInt(paymentPayload.accepted.amount)
  const paymentHash = keccak256(result.transaction as `0x${string}`)
  const mandate = await getMandate(payer)
  const identityStatus = mandate ? IdentityStatus.Verified : IdentityStatus.NotFound

  const db = getDb()
  let attestationTx: string | null = null

  try {
    attestationTx = await walletClient.writeContract({
      address: env.ATTESTATION_REGISTRY_ADDRESS,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "attest",
      args: [paymentHash, payer, amountUsdcAtomic, identityStatus, Decision.Approved],
      chain: null,
      account,
    })
    console.log("[onAfterSettle] attestation tx:", attestationTx)
  } catch (err) {
    console.error("[onAfterSettle] attestation failed:", err)
  }

  const authorizationNonce = extractAuthNonce(paymentPayload.payload) ?? null

  try {
    await db.insert(schema.settlementAttestations).values({
      paymentHash,
      settlementTx: result.transaction as string,
      attestationTx,
      payerAddress: payer,
      amountUsdc: amountUsdcAtomic,
      identityStatus,
      decision: Decision.Approved,
      authorizationNonce,
    })
  } catch (err) {
    console.error("[onAfterSettle] db insert failed:", err)
  }
}

export async function onSettleFailure({
  paymentPayload,
  requirements,
}: FacilitatorSettleFailureContext): Promise<void | { recovered: true; result: SettleResponse }> {
  const authNonce = extractAuthNonce(paymentPayload.payload)
  if (!authNonce) return

  const db = getDb()
  try {
    const existing = await db
      .select()
      .from(schema.settlementAttestations)
      .where(
        and(
          eq(schema.settlementAttestations.authorizationNonce, authNonce),
          eq(schema.settlementAttestations.decision, Decision.Approved),
        )
      )
      .limit(1)

    if (existing.length > 0 && existing[0]!.settlementTx) {
      console.log("[onSettleFailure] duplicate detected, recovering:", authNonce)
      return {
        recovered: true,
        result: { success: true, transaction: existing[0]!.settlementTx, network: requirements.network },
      }
    }
  } catch (err) {
    console.error("[onSettleFailure] db lookup failed:", err)
  }
}
