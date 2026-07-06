import { keccak256 } from "viem"
import { ATTESTATION_REGISTRY_ABI } from "@workspace/shared/abis"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { walletClient, account } from "../lib/clients.ts"
import { getMandate } from "../lib/mandate-store.ts"
import { getPayerAddress, USDC_ATOMIC_FACTOR } from "../lib/mandate.ts"
import { env } from "../lib/env.ts"
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
  const identityStatus = getMandate(payer) ? IdentityStatus.Verified : IdentityStatus.NotFound

  try {
    await walletClient.writeContract({
      address: env.ATTESTATION_REGISTRY_ADDRESS,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "attest",
      args: [paymentHash, payer, amountUsdcAtomic, identityStatus, Decision.Approved],
      chain: null, // use walletClient's default chain (Base Sepolia)
      account,
    })
  } catch (err) {
    console.error("[onAfterSettle] attestation failed — payment settled but not recorded on-chain:", err)
  }
}
