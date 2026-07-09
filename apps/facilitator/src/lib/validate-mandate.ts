import { keccak256 } from "viem"
import type { PublicClient } from "viem"
import { parseMandateHeader } from "@workspace/shared/mandate-header"
import { lookupIdentity } from "@workspace/shared/identity"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { buildDecisionRecord } from "@workspace/shared/decision-record"
import type { MandateHeaderValue } from "@workspace/shared/mandate-header"
import { schema } from "@workspace/db"
import { verifyMandateSignature, USDC_ATOMIC_FACTOR } from "./mandate.js"
import { requestCtx } from "./request-context.js"
import { getPolicyMaxAtomic } from "./policy-store.js"
import { getDb } from "./db.js"

export interface VerifyDeps {
  verifyMandateSignature: typeof verifyMandateSignature
  lookupIdentity: typeof lookupIdentity
  registryAddress: `0x${string}`
  client: Pick<PublicClient, "readContract">
}

export function buildVerifyRejectionPaymentHash({
  amountAtomic,
  authorizationNonce,
  payer,
  reason,
  resource,
}: {
  amountAtomic: bigint
  authorizationNonce?: string
  payer: string
  reason: string
  resource?: unknown
}) {
  const hashSeed = authorizationNonce
    ? `${payer}-${amountAtomic}-${authorizationNonce}-${reason}`
    : `${payer}-${amountAtomic}-${reason}-${String(resource ?? "")}`
  return keccak256(new TextEncoder().encode(hashSeed) as unknown as `0x${string}`)
}

export async function recordRejection({
  agentId,
  amountAtomic,
  authorizationNonce,
  identityStatus,
  mandateEntry,
  payer,
  reason,
  resource,
}: {
  agentId?: bigint
  amountAtomic: bigint
  authorizationNonce?: string
  identityStatus: IdentityStatus
  mandateEntry?: MandateHeaderValue
  payer: string
  reason: string
  resource?: unknown
}) {
  const paymentHash = buildVerifyRejectionPaymentHash({
    amountAtomic,
    authorizationNonce,
    payer,
    reason,
    resource,
  })
  const policyMaxAtomic = await getPolicyMaxAtomic()
  const decisionRecord = buildDecisionRecord({
    agentId,
    amountAtomic,
    decision: Decision.Rejected,
    identityStatus,
    mandate: mandateEntry?.mandate,
    payer,
    paymentHash,
    authorizationNonce,
    policyMaxAtomic,
    resource,
    rejectionReason: reason,
  })
  try {
    await getDb().insert(schema.settlementAttestations).values({
      paymentHash,
      settlementTx: null,
      attestationTx: null,
      payerAddress: payer,
      amountUsdc: amountAtomic,
      policyMaxAmountUsdc: policyMaxAtomic,
      decisionRecord,
      identityStatus,
      decision: Decision.Rejected,
      authorizationNonce: authorizationNonce ?? null,
    })
  } catch (err) {
    console.error("[recordRejection] db insert failed:", err)
  }
}

export type ValidateMandateResult =
  | { ok: true; mandateEntry: MandateHeaderValue }
  | { ok: false; abort: true; reason: string }

export async function validateMandateForPayment(
  {
    payer,
    amountAtomic,
    authorizationNonce,
    resource,
  }: {
    payer: string
    amountAtomic: bigint
    authorizationNonce?: string
    resource?: unknown
  },
  deps: VerifyDeps,
): Promise<ValidateMandateResult> {
  const { mandateJson } = requestCtx.get()
  const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined

  if (!mandateEntry) {
    await recordRejection({
      amountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.NotFound,
      payer,
      reason: "mandate_missing",
      resource,
    })
    return { ok: false, abort: true, reason: "mandate_missing" }
  }

  const { mandate, agentId } = mandateEntry

  const isValidSig = await deps.verifyMandateSignature(mandate)
  if (!isValidSig || mandate.payload.agent.toLowerCase() !== payer.toLowerCase()) {
    await recordRejection({
      agentId,
      amountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.NotFound,
      mandateEntry,
      payer,
      reason: "mandate_invalid",
      resource,
    })
    return { ok: false, abort: true, reason: "mandate_invalid" }
  }

  const profile = await deps.lookupIdentity(agentId, deps.registryAddress, deps.client)
  if (!profile || profile.wallet.toLowerCase() !== payer.toLowerCase()) {
    await recordRejection({
      agentId,
      amountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.NotFound,
      mandateEntry,
      payer,
      reason: "identity_not_found",
      resource,
    })
    return { ok: false, abort: true, reason: "identity_not_found" }
  }

  if (mandate.payload.expiry < BigInt(Math.floor(Date.now() / 1000))) {
    await recordRejection({
      agentId,
      amountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry,
      payer,
      reason: "mandate_expired",
      resource,
    })
    return { ok: false, abort: true, reason: "mandate_expired" }
  }

  const mandateMaxAtomic = mandate.payload.maxAmountUsdc * USDC_ATOMIC_FACTOR
  if (amountAtomic > mandateMaxAtomic) {
    await recordRejection({
      agentId,
      amountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry,
      payer,
      reason: "mandate_amount_exceeded",
      resource,
    })
    return { ok: false, abort: true, reason: "mandate_amount_exceeded" }
  }

  return { ok: true, mandateEntry }
}
