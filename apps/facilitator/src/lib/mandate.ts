import { verifyTypedData } from "viem"
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES } from "@workspace/shared/mandate"
import type { SignedMandate } from "@workspace/shared/mandate"

// USDC has 6 decimals — multiply whole-unit amounts by this to get atomic units
export const USDC_ATOMIC_FACTOR = 1_000_000n

export function getPayerAddress(
  payload: unknown,
): `0x${string}` | undefined {
  return (payload as Record<string, unknown>).from as `0x${string}` | undefined
}

// Verifies the delegator's EIP-712 signature over a SignedMandate.
// mandate.payload fields must already be bigint (as stored in mandate-store).
export function verifyMandateSignature(mandate: SignedMandate): Promise<boolean> {
  return verifyTypedData({
    address: mandate.payload.delegator,
    domain: MANDATE_EIP712_DOMAIN,
    types: MANDATE_EIP712_TYPES,
    primaryType: "MandatePayload",
    message: {
      agent: mandate.payload.agent,
      delegator: mandate.payload.delegator,
      maxAmountUsdc: mandate.payload.maxAmountUsdc,
      expiry: mandate.payload.expiry,
      nonce: mandate.payload.nonce,
    },
    signature: mandate.signature,
  })
}
