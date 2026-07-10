import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import type { AgentWithMandate } from "@/server/agents"
import type { AgentsTableRow } from "@/features/agents/components/agents-table"

function agentStatus(
  onChainTrusted: boolean,
  maxAmountUsdc: number | null,
  expired: boolean
): AgentsTableRow["status"] {
  if (!onChainTrusted) return "Unregistered"
  if (maxAmountUsdc === null) return "Trusted"
  if (expired) return "Expired mandate"
  if (maxAmountUsdc < POLICY_MAX_AMOUNT_USDC) return "Mandate capped"
  if (maxAmountUsdc > POLICY_MAX_AMOUNT_USDC) return "Policy blocked"
  return "Trusted"
}

export function toAgentsTableRow(agent: AgentWithMandate): AgentsTableRow {
  const maxAmountUsdc = agent.maxAmountUsdc !== null ? Number(agent.maxAmountUsdc) : null
  const expirySeconds = agent.expiry !== null ? Number(agent.expiry) : 0
  const hasExpiry = expirySeconds > 0
  const expired = hasExpiry && expirySeconds * 1000 < Date.now()

  return {
    address: agent.address,
    name: agent.name,
    agentId: agent.agentId.toString(),
    erc8004: `0x${agent.agentId.toString(16)}`,
    delegatorAddress: agent.delegatorAddress ?? "—",
    maxAmountUsdc: maxAmountUsdc !== null ? maxAmountUsdc.toFixed(2) : "—",
    expiry: hasExpiry ? new Date(expirySeconds * 1000).toISOString().slice(0, 10) : "—",
    status: agentStatus(agent.onChainTrusted, maxAmountUsdc, expired),
  }
}
