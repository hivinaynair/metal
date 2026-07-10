import { keccak256 } from "viem"
import { and, eq } from "drizzle-orm"
import { ATTESTATION_REGISTRY_ABI, ERC20_BALANCE_ABI, BASE_SEPOLIA_USDC_ADDRESS } from "@workspace/shared/abis"
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
import { walletClient, publicClient, account } from "../lib/clients.js"
import { validateMandateForPayment, recordRejection } from "../lib/validate-mandate.js"
import { verifyDeps } from "../lib/deps.js"
import { getPayerAddress, extractAuthNonce } from "../lib/mandate.js"
import { getDb } from "../lib/db.js"
import { requestCtx } from "../lib/request-context.js"
import { env } from "../env.js"
import { getPolicyMaxAtomic } from "../lib/policy-store.js"

const SETTLEMENT_TX_FAILED_REASON = "settlement_transaction_failed"
const SETTLEMENT_RECEIPT_UNCONFIRMED_REASON = "settlement_receipt_unconfirmed"

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

  // Check payer's USDC balance before attempting settlement
  const balance = await publicClient.readContract({
    address: BASE_SEPOLIA_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [payer],
    authorizationList: undefined,
  })
  console.log(`[onBeforeSettle] payer=${payer} balance=${balance} required=${paymentAmountAtomic}`)
  if (balance < paymentAmountAtomic) {
    await recordRejection({
      agentId: mandateResult.mandateEntry.agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry: mandateResult.mandateEntry,
      payer,
      reason: "insufficient_funds",
      resource: paymentPayload.resource,
    })
    return { abort: true, reason: "insufficient_funds" }
  }

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
  if (!result.success) {
    const payer = getPayerAddress(paymentPayload.payload)
    if (!payer) return
    const authorizationNonce = extractAuthNonce(paymentPayload.payload) ?? null
    const amountUsdcAtomic = BigInt(paymentPayload.accepted.amount)
    const { mandateJson } = requestCtx.get()
    const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined
    const identityStatus = mandateEntry ? IdentityStatus.Verified : IdentityStatus.NotFound
    const policyMaxAtomic = await getPolicyMaxAtomic()
    const db = getDb()
    const syntheticPaymentHash = keccak256(
      `0x${Buffer.from(`failed:${authorizationNonce ?? payer}`).toString("hex")}` as `0x${string}`
    )
    const decisionRecord = buildDecisionRecord({
      agentId: mandateEntry?.agentId,
      amountAtomic: amountUsdcAtomic,
      decision: Decision.Rejected,
      identityStatus,
      mandate: mandateEntry?.mandate,
      payer,
      authorizationNonce,
      policyMaxAtomic,
      resource: paymentPayload.resource,
      rejectionReason: result.errorReason ?? "settlement_rejected",
    })
    try {
      await db.insert(schema.settlementAttestations).values({
        paymentHash: syntheticPaymentHash,
        settlementTx: null,
        attestationTx: null,
        payerAddress: payer,
        amountUsdc: amountUsdcAtomic,
        policyMaxAmountUsdc: policyMaxAtomic,
        decisionRecord,
        identityStatus,
        decision: Decision.Rejected,
        authorizationNonce,
      })
    } catch (err) {
      console.error("[onAfterSettle] db insert failed for settlement failure:", err)
    }
    return
  }
  if (!result.transaction) return

  const payer = getPayerAddress(paymentPayload.payload)
  if (!payer) return

  const settlementTx = result.transaction as `0x${string}`
  const amountUsdcAtomic = BigInt(paymentPayload.accepted.amount)
  const paymentHash = keccak256(settlementTx)
  const authorizationNonce = extractAuthNonce(paymentPayload.payload) ?? null

  const { mandateJson } = requestCtx.get()
  const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined
  const identityStatus = mandateEntry ? IdentityStatus.Verified : IdentityStatus.NotFound
  const db = getDb()

  // Fetch policy and await receipt in parallel
  const policyPromise = getPolicyMaxAtomic()
  const receiptPromise = publicClient.waitForTransactionReceipt({ hash: settlementTx })
  const policyMaxAtomic = await policyPromise

  const insertSettlement = async ({
    decision,
    rejectionReason,
    attestationTx = null,
  }: {
    decision: Decision
    rejectionReason?: string
    attestationTx?: string | null
  }) => {
    const decisionRecord = buildDecisionRecord({
      agentId: mandateEntry?.agentId,
      amountAtomic: amountUsdcAtomic,
      decision,
      identityStatus,
      mandate: mandateEntry?.mandate,
      payer,
      paymentHash,
      authorizationNonce,
      policyMaxAtomic,
      resource: paymentPayload.resource,
      rejectionReason,
      settlementTxHash: settlementTx,
      attestationTxHash: attestationTx,
    })
    try {
      await db.insert(schema.settlementAttestations).values({
        paymentHash,
        settlementTx,
        attestationTx,
        payerAddress: payer,
        amountUsdc: amountUsdcAtomic,
        policyMaxAmountUsdc: policyMaxAtomic,
        decisionRecord,
        identityStatus,
        decision,
        authorizationNonce,
      })
    } catch (err) {
      console.error("[onAfterSettle] db insert failed:", err)
    }
  }

  let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>
  try {
    receipt = await receiptPromise
  } catch (err) {
    console.error("[onAfterSettle] settlement receipt lookup failed:", err)
    await insertSettlement({ decision: Decision.Rejected, rejectionReason: SETTLEMENT_RECEIPT_UNCONFIRMED_REASON })
    return
  }

  if (receipt.status !== "success") {
    await insertSettlement({ decision: Decision.Rejected, rejectionReason: SETTLEMENT_TX_FAILED_REASON })
    return
  }

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

  await insertSettlement({ decision: Decision.Approved, attestationTx })
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
