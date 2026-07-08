import { getAgentsWithMandates } from "@/lib/agents-data"
import { getAttestations } from "@/lib/attestations"
import { formatUsdc } from "@/lib/format"
import { reportRoutes } from "@/lib/demo-scenarios"
import { env } from "@/env"
import {
  PolicyWorkbench,
  type PolicyAgent,
  type PolicyProofRun,
  type PolicyResource,
} from "@/components/policy-workbench"
import { PageFrame, PageHead } from "@/components/page-chrome"

function toPolicyAgent(
  agent: Awaited<ReturnType<typeof getAgentsWithMandates>>[number]
): PolicyAgent {
  const expirySeconds = Number(agent.expiry)

  return {
    address: agent.address,
    name: agent.name,
    maxAmountUsdc: Number(agent.maxAmountUsdc),
    delegatorAddress: agent.delegatorAddress,
    expiry:
      expirySeconds > 0
        ? new Date(expirySeconds * 1000).toISOString().slice(0, 10)
        : "—",
    expired: expirySeconds * 1000 < Date.now(),
  }
}

function toProofRun(
  attestations: Awaited<ReturnType<typeof getAttestations>>
): PolicyProofRun | null {
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

async function fetchPolicyMax(): Promise<number> {
  try {
    const res = await fetch(`${env.FACILITATOR_URL}/policy`, { cache: "no-store" })
    const data = await res.json() as { maxAmountUsdc?: number }
    return typeof data.maxAmountUsdc === "number" ? data.maxAmountUsdc : 2
  } catch {
    return 2
  }
}

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
        right={
          <div className="metal-card flex items-center gap-2 px-4 py-2 font-mono text-sm text-text-secondary">
            <span className="size-2 rounded-full bg-positive" />
            mode: strict
          </div>
        }
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
