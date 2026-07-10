import { getAgentsWithMandates } from "@/lib/agents-data"
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import { AgentsTable, type AgentsTableRow } from "@/features/agents/components/agents-table"
import { PageFrame, PageHead } from "@/components/page-chrome"

function deriveAgentStatus({
  onChainTrusted,
  maxAmountUsdc,
  expired,
}: {
  onChainTrusted: boolean
  maxAmountUsdc: number | null
  expired: boolean
}): AgentsTableRow["status"] {
  if (!onChainTrusted) return "Unregistered"
  if (maxAmountUsdc === null) return "Trusted"
  if (expired) return "Expired mandate"
  if (maxAmountUsdc < POLICY_MAX_AMOUNT_USDC) return "Mandate capped"
  if (maxAmountUsdc > POLICY_MAX_AMOUNT_USDC) return "Policy blocked"
  return "Trusted"
}

function toAgentsTableRow(
  agent: Awaited<ReturnType<typeof getAgentsWithMandates>>[number]
): AgentsTableRow {
  const maxAmountUsdc = agent.maxAmountUsdc !== null ? Number(agent.maxAmountUsdc) : null
  const expirySeconds = agent.expiry !== null ? Number(agent.expiry) : 0
  const expired = expirySeconds > 0 && expirySeconds * 1000 < Date.now()

  const status = deriveAgentStatus({ onChainTrusted: agent.onChainTrusted, maxAmountUsdc, expired })

  return {
    address: agent.address,
    name: agent.name,
    agentId: agent.agentId.toString(),
    erc8004: `0x${agent.agentId.toString(16)}`,
    delegatorAddress: agent.delegatorAddress ?? "—",
    maxAmountUsdc: maxAmountUsdc !== null ? maxAmountUsdc.toFixed(2) : "—",
    expiry:
      expirySeconds > 0
        ? new Date(expirySeconds * 1000).toISOString().slice(0, 10)
        : "—",
    status,
    registered: agent.onChainTrusted,
  }
}

export default async function AgentsPage() {
  const agents = await getAgentsWithMandates()

  return (
    <PageFrame>
      <PageHead
        eyebrow="Identity + mandates"
        title="Who is moving the money"
        question="Who are these autonomous actors, and who authorized them? Every agent carries an on-chain identity and a delegated mandate with hard limits."
      />

      <AgentsTable agents={agents.map(toAgentsTableRow)} />
    </PageFrame>
  )
}
