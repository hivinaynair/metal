export const GATE_STEP = {
  AGENT_RESOLVED:    0,
  PAYMENT_SUBMITTED: 1,
  IDENTITY_CHECK:    2,
  MANDATE_CHECK:     3,
  POLICY_CHECK:      4,
  SETTLEMENT:        5,
  ATTESTATION:       6,
} as const

export const MANDATE_FAILURES = new Set([
  "mandate_missing",
  "mandate_invalid",
  "mandate_expired",
  "mandate_amount_exceeded",
])

export function isMandateFailure(error: unknown): boolean {
  return typeof error === "string" && MANDATE_FAILURES.has(error)
}

/**
 * Returns the terminal gate step for a known facilitator rejection reason.
 * Gate numbering matches the settlement pipeline UI (2=identity, 3=AP2, 4=policy).
 * Returns 0 for unknown errors or no error.
 */
export function settlementFailureGate(error?: string | null): number {
  if (error === "identity_not_found") return 2
  if (error && MANDATE_FAILURES.has(error)) return 3
  if (error === "policy_amount_exceeded") return 4
  if (error && error.startsWith("invalid_exact_evm_")) return 5
  return 0
}
