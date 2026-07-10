import { getAgentsWithMandates } from "@/server/agents"
import { getAttestations } from "@/server/attestations"
import { fetchPolicyMax } from "@/features/policy/server/queries"
import { toPolicyAgent, toProofRun } from "@/features/policy/lib/transforms"
import { reportRoutes } from "@/lib/demo-scenarios"
import { PolicyWorkbench, type PolicyResource } from "@/features/policy/components/policy-workbench"
import { PageFrame, PageHead } from "@/components/page-chrome"

export default async function PolicyPage() {
  const [agents, attestations, policyMax] = await Promise.all([
    getAgentsWithMandates(),
    getAttestations(),
    fetchPolicyMax(),
  ])

  const resources: PolicyResource[] = reportRoutes.map((route) => ({
    id: route.id,
    label: route.path.replace("/api/", "GET /v1/"),
    path: route.path,
    price: Number(route.priceLabel.replace("$", "")),
  }))

  return (
    <PageFrame>
      <PageHead
        eyebrow="Programmable controls"
        title="Compliance as executable logic"
        question="Change the active institution policy. The next payment must pass it before settlement."
      />

      <PolicyWorkbench
        agents={agents.map(toPolicyAgent)}
        resources={resources}
        initialMaxAmountUsdc={policyMax}
        proofRun={toProofRun(attestations)}
      />
    </PageFrame>
  )
}
