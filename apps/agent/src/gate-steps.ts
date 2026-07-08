import { GATE_STEP, settlementFailureGate } from "@workspace/shared/settlement-errors"

/**
 * Returns the gate step numbers to emit after x402Fetch resolves,
 * based on the outcome of the settlement pipeline.
 *
 * Steps 0 and 1 are emitted before x402Fetch (agent resolved, payment submitted).
 * Steps 2–5 are emitted here to animate the facilitator gates in sequence.
 * Step 6 (attestation) is emitted separately after polling for the decision record.
 */
export function gateStepsForResult(
  responseError: string | undefined,
  settlementTxHash: string | undefined,
): number[] {
  if (!responseError && settlementTxHash) {
    return [GATE_STEP.IDENTITY_CHECK, GATE_STEP.MANDATE_CHECK, GATE_STEP.POLICY_CHECK, GATE_STEP.SETTLEMENT]
  }
  const failGate = settlementFailureGate(responseError)
  if (failGate === 0) return []
  return Array.from({ length: failGate - 1 }, (_, i) => i + GATE_STEP.IDENTITY_CHECK)
}
