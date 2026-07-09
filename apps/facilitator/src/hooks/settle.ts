import { keccak256 } from "viem"
import { and, eq } from "drizzle-orm"
import { ATTESTATION_REGISTRY_ABI } from "@workspace/shared/abis"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { schema } from "@workspace/db"
import { buildDecisionRecord } from "@workspace/shared/decision-record"
import { parseMandateHeader } from "@workspace/shared/mandate-header"
import type { SettleResponse } from "@x402/core/types"
import type {
  FacilitatorSettleContext,
  FacilitatorSettleResultContext,
  FacilitatorSettleFailureContext,
} from "@x402/core/facilitator"
import { walletClient, account } from "../lib/clients.js"
import { validateMandateForPayment, recordRejection } from "../lib/validate-mandate.js"
import { verifyDeps } from "../lib/deps.js"
import { getPayerAddress, extractAuthNonce } from "../lib/mandate.js"
import { getDb } from "../lib/db.js"
import { requestCtx } from "../lib/request-context.js"
import { env } from "../env.js"
import { getPolicyMaxAtomic } from "../lib/policy-store.js"

export async function onBeforeSettle({
  paymentPayload,
  requirements,
}: FacilitatorSettleContext): Promise<void | { abort: true; reason: string }> {
  const payer = getPayerAddress(paymentPayload.payload)
  if (!payer) return

  const paymentAmountAtomic = BigInt(requirements.amount)
  const authorizationNonce = extractAuthNonce(paymentPayload.payload)

  // Independently validate mandate — settle can arrive without a prior /verify
  const mandateResult = await validateMandateForPayment(
    { payer, amountAtomic: paymentAmountAtomic, authorizationNonce, resource: paymentPayload.resource },
    verifyDeps,
  )
  if (mandateResult.ok === false) return { abort: true, reason: mandateResult.reason }

  // Check facilitator policy ceiling
  const policyMaxAtomic = await getPolicyMaxAtomic()
  if (paymentAmountAtomic > policyMaxAtomic) {
    await recordRejection({
      agentId: mandateResult.mandateEntry.agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry: mandateResult.mandateEntry,
      payer,
      reason: "policy_amount_exceeded",
      resource: paymentPayload.resource,
    })
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
  const policyMaxAtomic = await getPolicyMaxAtomic()
  const paymentHash = keccak256(result.transaction as `0x${string}`)

  const { mandateJson } = requestCtx.get()
  const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined
  const identityStatus = mandateEntry ? IdentityStatus.Verified : IdentityStatus.NotFound

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
  const decisionRecord = buildDecisionRecord({
    agentId: mandateEntry?.agentId,
    amountAtomic: amountUsdcAtomic,
    decision: Decision.Approved,
    identityStatus,
    mandate: mandateEntry?.mandate,
    payer,
    paymentHash,
    authorizationNonce,
    policyMaxAtomic,
    resource: paymentPayload.resource,
    settlementTxHash: result.transaction as string,
    attestationTxHash: attestationTx,
  })

  try {
    await db.insert(schema.settlementAttestations).values({
      paymentHash,
      settlementTx: result.transaction as string,
      attestationTx,
      payerAddress: payer,
      amountUsdc: amountUsdcAtomic,
      policyMaxAmountUsdc: policyMaxAtomic,
      decisionRecord,
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
  const authorizationNonce = extractAuthNonce(paymentPayload.payload)
  if (!authorizationNonce) return

  const db = getDb()
  try {
    const existing = await db
      .select()
      .from(schema.settlementAttestations)
      .where(
        and(
          eq(schema.settlementAttestations.authorizationNonce, authorizationNonce),
          eq(schema.settlementAttestations.decision, Decision.Approved),
        )
      )
      .limit(1)

    if (existing.length > 0 && existing[0]!.settlementTx) {
      console.log("[onSettleFailure] duplicate detected, recovering:", authorizationNonce)
      return {
        recovered: true,
        result: { success: true, transaction: existing[0]!.settlementTx, network: requirements.network },
      }
    }
  } catch (err) {
    console.error("[onSettleFailure] db lookup failed:", err)
  }
}
