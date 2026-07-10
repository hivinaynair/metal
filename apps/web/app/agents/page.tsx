import { getAgentsWithMandates } from "@/server/agents"
import { toAgentsTableRow } from "@/features/agents/lib/transforms"
import { AgentsTable } from "@/features/agents/components/agents-table"
import { PageFrame, PageHead } from "@/components/page-chrome"

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
