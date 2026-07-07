import { keccak256 } from "viem"
import { ATTESTATION_REGISTRY_ABI } from "@workspace/shared/abis"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { walletClient, account } from "../lib/clients.js"
import { getMandate } from "../lib/mandate-store.js"
import { getPayerAddress, USDC_ATOMIC_FACTOR } from "../lib/mandate.js"
import { env } from "../lib/env.js"
import type {
  FacilitatorSettleContext,
  FacilitatorSettleResultContext,
} from "@x402/core/facilitator"

export async function onBeforeSettle({
  requirements,
}: FacilitatorSettleContext): Promise<void | { abort: true; reason: string }> {
  const paymentAmountAtomic = BigInt(requirements.amount)
  const policyMaxAtomic = BigInt(env.POLICY_MAX_AMOUNT_USDC) * USDC_ATOMIC_FACTOR
  if (paymentAmountAtomic > policyMaxAtomic) {
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

  try {
    const hash = await walletClient.writeContract({
      address: env.ATTESTATION_REGISTRY_ADDRESS,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "attest",
      args: [paymentHash, payer, amountUsdcAtomic, identityStatus, Decision.Approved],
      chain: null,
      account,
    })
    console.log("[onAfterSettle] attestation tx:", hash)
  } catch (err) {
    console.error("[onAfterSettle] attestation failed:", err)
  }
}
