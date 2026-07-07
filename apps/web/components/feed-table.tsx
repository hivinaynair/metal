"use client"

import { useState } from "react"
import { CheckCircle2, ChevronRight, FileText, X } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatUsdc } from "@/lib/format"
import { DetailSheet } from "@/components/detail-sheet"
import type { AttestationRow } from "@/lib/attestations"

interface FeedTableProps {
  rows: AttestationRow[]
  agentNames?: Record<string, string>
}

// On-chain enum: decision 0 = approved
const DECISION_APPROVED = 0

type Filter = "all" | "approved" | "rejected"

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Blocked" },
]

export function FeedTable({ rows, agentNames = {} }: FeedTableProps) {
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<AttestationRow | null>(null)

  const filtered = rows.filter((r) => {
    if (filter === "approved") return r.decision === DECISION_APPROVED
    if (filter === "rejected") return r.decision !== DECISION_APPROVED
    return true
  })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="metal-inset flex gap-0.5 p-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-[2px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filter === f.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="ml-auto">
          <FileText className="size-4" />
          Export
        </Button>
      </div>

      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Identity</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead className="text-right">Proof</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No transactions yet — run a demo to generate one.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => {
              const approved = row.decision === DECISION_APPROVED
              const amountUsd = formatUsdc(row.amountUsdc)
              const agentName = agentNames[row.payer.toLowerCase()]
              const timeStr = new Date(row.timestamp * 1000).toLocaleString(
                undefined,
                {
                  dateStyle: "short",
                  timeStyle: "short",
                }
              )

              return (
                <TableRow
                  key={row.paymentHash}
                  className="cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {timeStr}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {agentName ?? (
                      <span className="text-muted-foreground">unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    /api/trigger-payment
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    ${amountUsd}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.identityStatus !== 0 ? (
                      <CheckCircle2 className="mx-auto size-4 text-[var(--positive)]" />
                    ) : (
                      <X className="mx-auto size-4 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={approved ? "secondary" : "destructive"}
                      className={
                        approved ? "text-[var(--positive)]" : undefined
                      }
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {approved ? "Approved" : "Blocked"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <DetailSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        row={selected}
      />
    </>
  )
}
