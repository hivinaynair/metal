import { getPayerAddress, extractAuthNonce } from "../lib/mandate.js"
import { validateMandateForPayment, recordRejection } from "../lib/validate-mandate.js"
import type { VerifyDeps } from "../lib/validate-mandate.js"
import type { FacilitatorVerifyContext } from "@x402/core/facilitator"
import { BASE_SEPOLIA_USDC_ADDRESS, ERC20_BALANCE_ABI } from "@workspace/shared/abis"
import { IdentityStatus } from "@workspace/shared/types"

export type { VerifyDeps } from "../lib/validate-mandate.js"
export { buildVerifyRejectionPaymentHash } from "../lib/validate-mandate.js"

export async function onBeforeVerify(
  { paymentPayload, requirements }: FacilitatorVerifyContext,
  deps: VerifyDeps,
): Promise<void | { abort: true; reason: string }> {
  const payer = getPayerAddress(paymentPayload.payload)
  if (!payer) return

  const paymentAmountAtomic = BigInt(requirements.amount)
  const authorizationNonce = extractAuthNonce(paymentPayload.payload)

  const result = await validateMandateForPayment(
    { payer, amountAtomic: paymentAmountAtomic, authorizationNonce, resource: paymentPayload.resource },
    deps,
  )
  if (result.ok === false) return { abort: true, reason: result.reason }

  // Check payer's USDC balance early so insufficient funds are caught at verify, not settle.
  const balance = await deps.client.readContract({
    address: BASE_SEPOLIA_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [payer],
    authorizationList: undefined,
  })
  console.log(`[onBeforeVerify] payer=${payer} balance=${balance} required=${paymentAmountAtomic}`)
  if (balance < paymentAmountAtomic) {
    await recordRejection({
      agentId: result.mandateEntry.agentId,
      amountAtomic: paymentAmountAtomic,
      authorizationNonce,
      identityStatus: IdentityStatus.Verified,
      mandateEntry: result.mandateEntry,
      payer,
      reason: "insufficient_funds",
      resource: paymentPayload.resource,
    })
    return { abort: true, reason: "insufficient_funds" }
  }
}
