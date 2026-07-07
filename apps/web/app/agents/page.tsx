import { getAgentsWithMandates } from "@/lib/agents-data"
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import { AgentsTable, type AgentsTableRow } from "@/components/agents-table"
import { PageFrame, PageHead } from "@/components/page-chrome"

function toAgentsTableRow(
  agent: Awaited<ReturnType<typeof getAgentsWithMandates>>[number]
): AgentsTableRow {
  const maxAmountUsdc = Number(agent.maxAmountUsdc)
  const expirySeconds = Number(agent.expiry)
  const expired = expirySeconds * 1000 < Date.now()

  let status: AgentsTableRow["status"] = "Trusted"
  if (expired) {
    status = "Expired mandate"
  } else if (maxAmountUsdc < POLICY_MAX_AMOUNT_USDC) {
    status = "Mandate capped"
  } else if (maxAmountUsdc > POLICY_MAX_AMOUNT_USDC) {
    status = "Policy blocked"
  }

  return {
    address: agent.address,
    name: agent.name,
    agentId: agent.agentId.toString(),
    erc8004: `0x${agent.agentId.toString(16)}`,
    delegatorAddress: agent.delegatorAddress,
    maxAmountUsdc: maxAmountUsdc.toFixed(2),
    expiry:
      expirySeconds > 0
        ? new Date(expirySeconds * 1000).toISOString().slice(0, 10)
        : "—",
    status,
    registered: true,
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
