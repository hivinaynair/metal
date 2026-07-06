import { lookupIdentity } from "@workspace/shared/identity"
import { getMandate } from "../lib/mandate-store.js"
import { verifyMandateSignature, getPayerAddress, USDC_ATOMIC_FACTOR } from "../lib/mandate.js"
import type { FacilitatorVerifyContext } from "@x402/core/facilitator"
import type { PublicClient } from "viem"

export interface VerifyDeps {
  getMandate: typeof getMandate
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

  // 1. Mandate must be pre-registered
  const mandateEntry = await deps.getMandate(payer)
  if (!mandateEntry) return { abort: true, reason: "mandate_not_registered" }

  const { mandate, agentId } = mandateEntry

  // 2. Mandate signature must be valid (delegator signed over agent + spend limits)
  const isValidSig = await deps.verifyMandateSignature(mandate)
  if (!isValidSig) return { abort: true, reason: "mandate_signature_invalid" }

  // 3. Mandate must not be expired
  if (mandate.payload.expiry < BigInt(Math.floor(Date.now() / 1000))) {
    return { abort: true, reason: "mandate_expired" }
  }

  // 4. Payment amount must be within mandate limit
  const paymentAmountAtomic = BigInt(requirements.amount)
  const mandateMaxAtomic = mandate.payload.maxAmountUsdc * USDC_ATOMIC_FACTOR
  if (paymentAmountAtomic > mandateMaxAtomic) {
    return { abort: true, reason: "mandate_amount_exceeded" }
  }

  // 5. Agent must be registered in ERC-8004 and the profile's wallet must match the payer
  const profile = await deps.lookupIdentity(agentId, deps.registryAddress, deps.client)
  if (!profile || profile.wallet.toLowerCase() !== payer.toLowerCase()) {
    return { abort: true, reason: "identity_not_found" }
  }
}
