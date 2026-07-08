import { keccak256 } from "viem"
import { eq } from "drizzle-orm"
import { lookupIdentity } from "@workspace/shared/identity"
import { verifyMandateSignature, getPayerAddress, USDC_ATOMIC_FACTOR } from "../lib/mandate.js"
import { requestCtx } from "../lib/request-context.js"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { createDb, schema } from "@workspace/shared/db"
import { parseMandateHeader } from "@workspace/shared/mandate-header"
import { buildDecisionRecord } from "@workspace/shared/decision-record"
import { getPolicyMaxAmountUsdc } from "../lib/policy-store.js"
import type { FacilitatorVerifyContext } from "@x402/core/facilitator"
import type { PublicClient } from "viem"
import type { MandateHeaderValue } from "@workspace/shared/mandate-header"

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
  return typeof auth?.nonce === "string" ? auth.nonce : undefined
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

async function recordRejection({
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
  const policyMaxAmountUsdc = BigInt(Math.round(getPolicyMaxAmountUsdc() * 1_000_000))
  let agentName: string | undefined
  try {
    const rows = await getDb()
      .select({ name: schema.agents.name })
      .from(schema.agents)
      .where(eq(schema.agents.address, payer.toLowerCase()))
      .limit(1)
    agentName = rows[0]?.name
  } catch {
    agentName = undefined
  }
  const decisionRecord = buildDecisionRecord({
    agentId: agentName ?? agentId,
    amountAtomic,
    decision: Decision.Rejected,
    identityStatus,
    mandate: mandateEntry?.mandate,
    payer,
    paymentHash,
    authorizationNonce,
    policyMaxAtomic: policyMaxAmountUsdc,
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
      policyMaxAmountUsdc,
      decisionRecord,
      identityStatus,
      decision: Decision.Rejected,
      authorizationNonce: authorizationNonce ?? null,
    })
  } catch (err) {
    console.error("[onBeforeVerify] db insert failed:", err)
  }
}

export interface VerifyDeps {
  verifyMandateSignature: typeof verifyMandateSignature
  lookupIdentity: typeof lookupIdentity
  registryAddress: `0x${string}`
  client: Pick<PublicClient, "readContract">
}

export async function onBeforeVerify(
  { paymentPayload, requirements }: FacilitatorVerifyContext,
  deps: VerifyDeps,
): Promise<void | { abort: true; reason: string }> {
  const payer = getPayerAddress(paymentPayload.payload)
  if (!payer) return // non-EIP-3009 scheme — let base verify handle it

  const paymentAmountAtomic = BigInt(requirements.amount)
  const authorizationNonce = extractAuthNonce(paymentPayload.payload)

  const { mandateJson } = requestCtx.get()
  const mandateEntry = mandateJson ? parseMandateHeader(mandateJson) : undefined

  if (!mandateEntry) {
    const reason = "mandate_not_registered"
    await recordRejection({
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.NotFound,
      payer,
      reason,
      resource: paymentPayload.resource,
    })
    return { abort: true, reason }
  }

  const { mandate, agentId } = mandateEntry

  // 1. Mandate signature must be valid (delegator signed over agent + spend limits)
  const isValidSig = await deps.verifyMandateSignature(mandate)
  if (!isValidSig || mandate.payload.agent.toLowerCase() !== payer.toLowerCase()) {
    const reason = "mandate_signature_invalid"
    await recordRejection({
      agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.NotFound,
      mandateEntry,
      payer,
      reason,
      resource: paymentPayload.resource,
    })
    return { abort: true, reason }
  }

  // 2. Agent must be registered in ERC-8004 and the profile's wallet must match the payer
  const profile = await deps.lookupIdentity(agentId, deps.registryAddress, deps.client)
  if (!profile || profile.wallet.toLowerCase() !== payer.toLowerCase()) {
    const reason = "identity_not_found"
    await recordRejection({
      agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.NotFound,
      mandateEntry,
      payer,
      reason,
      resource: paymentPayload.resource,
    })
    return { abort: true, reason }
  }

  // 3. Mandate must not be expired
  if (mandate.payload.expiry < BigInt(Math.floor(Date.now() / 1000))) {
    const reason = "mandate_expired"
    await recordRejection({
      agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry,
      payer,
      reason,
      resource: paymentPayload.resource,
    })
    return { abort: true, reason }
  }

  // 4. Payment amount must be within mandate limit
  const mandateMaxAtomic = mandate.payload.maxAmountUsdc * USDC_ATOMIC_FACTOR
  if (paymentAmountAtomic > mandateMaxAtomic) {
    const reason = "mandate_amount_exceeded"
    await recordRejection({
      agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry,
      payer,
      reason,
      resource: paymentPayload.resource,
    })
    return { abort: true, reason }
  }
}
