"use client"

import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { formatUsdc, truncateAddress } from "@/lib/format"
import { DetailSheet } from "@/components/detail-sheet"
import type { AttestationRow } from "@/lib/attestations"

interface FeedTableProps {
  rows: AttestationRow[]
  agentNames?: Record<string, string>
}

// On-chain enum: decision 0 = approved
const DECISION_APPROVED = 0

type Filter = "all" | "approved" | "rejected"

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
      <div className="flex gap-2 mb-4">
        {(["all", "approved", "rejected"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Identity</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Tx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                  No transactions yet — run a demo to generate one.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => {
              const approved = row.decision === DECISION_APPROVED
              const amountUsd = formatUsdc(row.amountUsdc)
              const agentName = agentNames[row.payer.toLowerCase()]
              const timeStr = new Date(row.timestamp * 1000).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })

              return (
                <TableRow
                  key={row.paymentHash}
                  className="cursor-pointer hover:bg-muted/50 border-l-2 border-l-teal-500"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {timeStr}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {agentName ?? <span className="text-muted-foreground">unknown</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncateAddress(row.payer)}
                  </TableCell>
                  <TableCell className="text-xs">${amountUsd}</TableCell>
                  <TableCell>
                    <Badge variant={row.identityStatus !== 0 ? "outline" : "destructive"} className="text-[10px]">
                      {row.identityStatus !== 0 ? "verified" : "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={approved ? "outline" : "destructive"} className="text-[10px]">
                      {approved ? "approved" : "rejected"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.txHash && (
                      <a
                        href={`${BASE_SEPOLIA_EXPLORER}/tx/${row.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline font-mono"
                      >
                        {row.txHash.slice(0, 8)}… ↗
                      </a>
                    )}
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
