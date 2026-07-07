import { getAttestations } from "@/lib/attestations"
import { getAgentsWithMandates } from "@/lib/agents-data"
import { FeedTable } from "@/components/feed-table"

export default async function FeedPage() {
  const [rows, agents] = await Promise.all([getAttestations(), getAgentsWithMandates()])

  const agentNames: Record<string, string> = {}
  for (const a of agents) agentNames[a.address.toLowerCase()] = a.name

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          On-chain attestations from the Metal settlement registry.
          {rows.length === 0 && " No transactions yet — run a demo to generate one."}
        </p>
      </div>

      <FeedTable rows={rows} agentNames={agentNames} />
    </main>
  )
}
