import { keccak256 } from "viem"
import { ATTESTATION_REGISTRY_ABI } from "@workspace/shared/abis"
import { IdentityStatus, Decision } from "@workspace/shared/types"
import { createDb, schema } from "@workspace/shared/db"
import { walletClient, account } from "../lib/clients.js"
import { getMandate } from "../lib/mandate-store.js"
import { getPayerAddress, USDC_ATOMIC_FACTOR } from "../lib/mandate.js"
import { env } from "../lib/env.js"
import type {
  FacilitatorSettleContext,
  FacilitatorSettleResultContext,
} from "@x402/core/facilitator"

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("Missing env var: DATABASE_URL")
    _db = createDb(url)
  }
  return _db
}

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

  try {
    await db.insert(schema.settlementAttestations).values({
      paymentHash,
      settlementTx: result.transaction as string,
      attestationTx,
      payerAddress: payer,
      amountUsdc: amountUsdcAtomic,
      identityStatus,
      decision: Decision.Approved,
    })
  } catch (err) {
    console.error("[onAfterSettle] db insert failed:", err)
  }
}
