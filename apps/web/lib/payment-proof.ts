import type { DemoAgent, TriggerResult } from "@/lib/payment-demo"
import { fallbackRouteForAgent } from "@/lib/payment-demo"
import { cleanRejectionReason } from "@/lib/settlement-status"

export function buildProofBundle(
  result: TriggerResult | null,
  selectedAgent: DemoAgent
) {
  const agent = result?.agent ?? selectedAgent
  const route = result?.route ?? fallbackRouteForAgent(selectedAgent)

  if (result?.decisionProof) {
    return JSON.stringify(
      {
        ...result.decisionProof,
        settlementTxUrl: result.settlementTxUrl ?? null,
        attestationTxUrl: result.attestationTxUrl ?? null,
      },
      null,
      2
    )
  }

  return JSON.stringify(
    {
      agentId: agent.id,
      payer: result?.payer ?? "pending run",
      agentURI: result?.agentUri ?? "pending run",
      route: route.path,
      amount: route.price,
      mandateLimit: agent.mandateLimit,
      mandateDelegator: result?.mandateDelegator ?? "pending run",
      mandateValid: result?.mandateValid ?? null,
      policyThreshold: result?.policyThreshold ?? "$2",
      policyDecision: result
        ? result.httpStatus === 200
          ? "approved"
          : "rejected"
        : "not run",
      rejectionReason: cleanRejectionReason(result?.body?.error),
      settlementTxHash: result?.settlementTxHash ?? null,
      settlementTxUrl: result?.settlementTxUrl ?? null,
      attestationTxHash: result?.attestationTxHash ?? null,
      attestationTxUrl: result?.attestationTxUrl ?? null,
    },
    null,
    2
  )
}
