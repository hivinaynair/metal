import { getAttestations } from "@/lib/attestations"
import { getAgentsWithMandates } from "@/lib/agents-data"
import { FeedTable } from "@/components/feed-table"
import { PageFrame, PageHead } from "@/components/page-chrome"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"

export default async function FeedPage() {
  const [rows, agents] = await Promise.all([getAttestations(), getAgentsWithMandates()])

  const agentNames: Record<string, string> = {}
  for (const a of agents) agentNames[a.address.toLowerCase()] = a.name

  return (
    <PageFrame>
      <PageHead
        eyebrow="Compliance flight recorder"
        title="Every attempt, on the record"
        question="Each row is a full lifecycle trace with on-chain proof: approvals and rejections alike."
        right={
          <div className="metal-card flex items-center gap-4 px-4 py-3">
            <div>
              <p className="metal-eyebrow">Attestations</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{rows.length}</p>
            </div>
            <Badge className="text-muted-foreground">Base Sepolia</Badge>
          </div>
        }
      />

      <Card className="metal-card gap-0 p-0 shadow-none">
        <CardContent className="p-3">
          {rows.length === 0 ? (
            <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No transactions yet. Run the live rail to generate the first
              attestation.
            </div>
          ) : (
            <FeedTable rows={rows} agentNames={agentNames} />
          )}
        </CardContent>
      </Card>
    </PageFrame>
  )
}
