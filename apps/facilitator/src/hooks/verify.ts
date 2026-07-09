import { getPayerAddress, extractAuthNonce } from "../lib/mandate.js"
import { validateMandateForPayment } from "../lib/validate-mandate.js"
import type { VerifyDeps } from "../lib/validate-mandate.js"
import type { FacilitatorVerifyContext } from "@x402/core/facilitator"

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
}
