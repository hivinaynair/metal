import { getAgentsWithMandates } from "@/lib/agents-data"
import { getAttestations } from "@/lib/attestations"
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export default async function PolicyPage() {
  const [agents, attestations] = await Promise.all([
    getAgentsWithMandates(),
    getAttestations(),
  ])

  const blockedCount = attestations.filter((a) => a.decision !== 0).length

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Settlement layer rules and agent mandate registry.
        </p>
      </div>

      {/* rule card */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Active Rule
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono">${POLICY_MAX_AMOUNT_USDC}</span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">POLICY_MAX_AMOUNT_USDC</span>
              <span className="text-xs text-muted-foreground">
                Enforced server-side in facilitator <code>onBeforeSettle</code>. Not decorative.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="destructive">{blockedCount} blocked</Badge>
            <span className="text-xs text-muted-foreground">
              transaction{blockedCount !== 1 ? "s" : ""} rejected by this policy
            </span>
          </div>
        </CardContent>
      </Card>

      {/* agent mandates */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Agent Mandates
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Mandate Limit</TableHead>
                <TableHead>Delegator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                    No mandates yet — run a demo to initialize agents.
                  </TableCell>
                </TableRow>
              )}
              {agents.map((agent) => (
                <TableRow key={agent.address}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {agent.address.slice(0, 6)}…{agent.address.slice(-4)}
                  </TableCell>
                  <TableCell className="font-mono">
                    ${(Number(agent.maxAmountUsdc)).toFixed(0)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {agent.delegatorAddress.slice(0, 6)}…{agent.delegatorAddress.slice(-4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  )
}
