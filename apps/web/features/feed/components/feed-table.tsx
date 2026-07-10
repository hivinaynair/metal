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
import { cn } from "@workspace/ui/lib/utils"
import { formatUsdc } from "@/lib/format"
import { DetailSheet } from "./detail-sheet"
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

  function exportCsv() {
    const header = [
      "time",
      "agent",
      "payer",
      "amount_usdc",
      "identity",
      "decision",
      "settlement_tx",
      "attestation_tx",
    ]
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    const lines = filtered.map((row) => {
      const approved = row.decision === DECISION_APPROVED
      const agentName = agentNames[row.payer.toLowerCase()] ?? "unknown"
      return [
        new Date(row.timestamp * 1000).toISOString(),
        agentName,
        row.payer,
        formatUsdc(row.amountUsdc),
        row.identityStatus !== 0 ? "verified" : "unknown",
        approved ? "approved" : "blocked",
        row.settlementTx,
        row.attestationTx,
      ]
        .map((value) => escape(String(value)))
        .join(",")
    })
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `metal-feed-${filter}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="metal-inset flex gap-0.5 p-0.5">
          {filters.map((f) => (
            <Button
              key={f.id}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-auto rounded-[2px] px-3 py-1.5 text-[12.5px] font-medium",
                filter === f.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <FileText className="size-4" />
          Export
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="hidden sm:table-cell">Resource</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden text-center sm:table-cell">Identity</TableHead>
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
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    /api/trigger-payment
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    ${amountUsd}
                  </TableCell>
                  <TableCell className="hidden text-center sm:table-cell">
                    {row.identityStatus !== 0 ? (
                      <CheckCircle2 className="mx-auto size-4 text-positive" />
                    ) : (
                      <X className="mx-auto size-4 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={approved ? "secondary" : "destructive"}
                      className={
                        approved ? "text-positive" : undefined
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
