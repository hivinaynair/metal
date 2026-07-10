import { formatUsdc } from "@/lib/format"
import type { AgentWithMandate } from "@/server/agents"
import type { AttestationRow } from "@/server/attestations"
import type { PolicyAgent, PolicyProofRun } from "@/features/policy/components/policy-workbench"

export function toPolicyAgent(agent: AgentWithMandate): PolicyAgent {
  const expirySeconds = agent.expiry !== null ? Number(agent.expiry) : 0
  const hasExpiry = expirySeconds > 0

  return {
    address: agent.address,
    name: agent.name,
    maxAmountUsdc: agent.maxAmountUsdc !== null ? Number(agent.maxAmountUsdc) : 0,
    delegatorAddress: agent.delegatorAddress ?? "—",
    onChainTrusted: agent.onChainTrusted,
    expiry: hasExpiry ? new Date(expirySeconds * 1000).toISOString().slice(0, 10) : "—",
    expired: hasExpiry && expirySeconds * 1000 < Date.now(),
  }
}

export function toProofRun(attestations: AttestationRow[]): PolicyProofRun | null {
  const blocked = attestations.find((attestation) => attestation.decision !== 0)
  if (!blocked) return null

  const amount = Number(formatUsdc(blocked.amountUsdc))
  const policySnapshot = Number(formatUsdc(blocked.policyMaxAmountUsdc))
  const failedRule =
    blocked.identityStatus === 0
      ? "requireIdentity"
      : amount > policySnapshot
        ? "maxAmountUsdc"
        : "preSettlementPolicy"

  return {
    failedRule,
    amount: `${amount.toFixed(2)} USDC`,
    limit: `${policySnapshot.toFixed(2)} USDC`,
    settlementTx: blocked.settlementTx || "none",
  }
}
