import { lookupIdentity } from "@workspace/shared/identity"
import { getMandate } from "../lib/mandate-store.js"
import { verifyMandateSignature, getPayerAddress, USDC_ATOMIC_FACTOR } from "../lib/mandate.js"
import { requestCtx } from "../lib/request-context.js"
import type { FacilitatorVerifyContext } from "@x402/core/facilitator"
import type { PublicClient } from "viem"
import type { SignedMandate } from "@workspace/shared/mandate"

export interface VerifyDeps {
  getMandate: typeof getMandate
  verifyMandateSignature: typeof verifyMandateSignature
  lookupIdentity: typeof lookupIdentity
  registryAddress: `0x${string}`
  client: Pick<PublicClient, "readContract">
}

interface MandateHeaderJson {
  agentId: string
  payload: {
    agent: string
    delegator: string
    maxAmountUsdc: string
    expiry: string
    nonce: string
  }
  signature: string
}

function parseMandateHeader(json: string): { mandate: SignedMandate; agentId: bigint } | undefined {
  try {
    const raw = JSON.parse(json) as MandateHeaderJson
    return {
      agentId: BigInt(raw.agentId),
      mandate: {
        payload: {
          agent: raw.payload.agent as `0x${string}`,
          delegator: raw.payload.delegator as `0x${string}`,
          maxAmountUsdc: BigInt(raw.payload.maxAmountUsdc),
          expiry: BigInt(raw.payload.expiry),
          nonce: BigInt(raw.payload.nonce),
        },
        signature: raw.signature as `0x${string}`,
      },
    }
  } catch {
    return undefined
  }
}

export async function onBeforeVerify(
  { paymentPayload, requirements }: FacilitatorVerifyContext,
  deps: VerifyDeps,
): Promise<void | { abort: true; reason: string }> {
  const payer = getPayerAddress(paymentPayload.payload)
  if (!payer) return // non-EIP-3009 scheme — let base verify handle it

  // Prefer mandate from X-AP2-Mandate header; fall back to DB
  const { mandateJson } = requestCtx.get()
  const mandateEntry = mandateJson
    ? parseMandateHeader(mandateJson)
    : await deps.getMandate(payer)

  if (!mandateEntry) return { abort: true, reason: "mandate_not_registered" }

  const { mandate, agentId } = mandateEntry

  // 1. Mandate signature must be valid (delegator signed over agent + spend limits)
  const isValidSig = await deps.verifyMandateSignature(mandate)
  if (!isValidSig) return { abort: true, reason: "mandate_signature_invalid" }

  // 2. Mandate must not be expired
  if (mandate.payload.expiry < BigInt(Math.floor(Date.now() / 1000))) {
    return { abort: true, reason: "mandate_expired" }
  }

  // 3. Payment amount must be within mandate limit
  const paymentAmountAtomic = BigInt(requirements.amount)
  const mandateMaxAtomic = mandate.payload.maxAmountUsdc * USDC_ATOMIC_FACTOR
  if (paymentAmountAtomic > mandateMaxAtomic) {
    return { abort: true, reason: "mandate_amount_exceeded" }
  }

  // 4. Agent must be registered in ERC-8004 and the profile's wallet must match the payer
  const profile = await deps.lookupIdentity(agentId, deps.registryAddress, deps.client)
  if (!profile || profile.wallet.toLowerCase() !== payer.toLowerCase()) {
    return { abort: true, reason: "identity_not_found" }
  }
}
