"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import { formatUsdc, truncateAddress } from "@/lib/format"
import { TracePanel } from "@/components/trace-panel"
import type { TraceStep } from "@/components/trace-panel"

interface DetailSheetProps {
  open: boolean
  onClose: () => void
  row: {
    payer: string
    amountUsdc: bigint
    policyMaxAmountUsdc: bigint
    identityStatus: number
    decision: number
    timestamp: number
    settlementTx: string | null
    settlementTxUrl: string
    attestationTx: string
    attestationTxUrl: string
  } | null
}

// On-chain enum: decision 0 = approved, non-zero = rejected
// identityStatus 0 = unknown, non-zero = verified
const DECISION_APPROVED = 0

function buildSteps(row: NonNullable<DetailSheetProps["row"]>): TraceStep[] {
  const approved = row.decision === DECISION_APPROVED
  const identityOk = row.identityStatus !== 0
  const amountUsd = formatUsdc(row.amountUsdc)
  const policyMaxUsd = formatUsdc(row.policyMaxAmountUsdc)

  function stepStatus(n: number): TraceStep["status"] {
    if (approved) return "approved"
    if (!identityOk && n === 2) return "rejected"
    if (!identityOk && n > 2) return "skipped"
    if (!approved && n === 3) return "rejected"
    if (!approved && n > 3) return "skipped"
    return "approved"
  }

  return [
    {
      id: 1,
      label: "402 Challenge",
      status: "approved",
      detail: `$${amountUsd}`,
    },
    {
      id: 2,
      label: "ERC-8004 Identity",
      status: stepStatus(2),
      detail: `${truncateAddress(row.payer)} · ${identityOk ? "registered" : "not registered"}`,
    },
    {
      id: 3,
      label: "AP2 Mandate",
      status: stepStatus(3),
    },
    {
      id: 4,
      label: "Policy Check",
      status: stepStatus(4),
      detail: `ceiling $${policyMaxUsd} · payment $${amountUsd}`,
    },
    {
      id: 5,
      label: "Settlement + Attestation",
      status: approved ? "approved" : "skipped",
      detail: row.settlementTx ? `${row.settlementTx.slice(0, 10)}…` : undefined,
      link: row.settlementTx
        ? { href: row.settlementTxUrl, label: "settlement tx" }
        : undefined,
      attestationLink: row.attestationTx
        ? { href: row.attestationTxUrl, label: "attestation tx" }
        : undefined,
    },
  ]
}

export function DetailSheet({ open, onClose, row }: DetailSheetProps) {
  if (!row) return null

  const approved = row.decision === DECISION_APPROVED
  const amountUsd = formatUsdc(row.amountUsdc)
  const steps = buildSteps(row)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-md">
        <SheetHeader className="mb-6 p-0 pr-14">
          <SheetTitle className="flex items-center gap-2">
            Transaction
            <Badge variant={approved ? "outline" : "destructive"}>
              {approved ? "approved" : "rejected"}
            </Badge>
          </SheetTitle>
          <p className="text-sm text-muted-foreground font-mono">
            {truncateAddress(row.payer)} · ${amountUsd}
          </p>
        </SheetHeader>

        <TracePanel steps={steps} />

        <Separator className="my-4 -mx-6 w-auto" />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p className="italic">
            AP2 mandate verified off-chain. In production Metal, mandates are enforced as a native authorization primitive.
          </p>
          <div className="flex flex-col gap-1">
            {row.settlementTx && (
              <a
                href={row.settlementTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono"
              >
                settlement tx ↗
              </a>
            )}
            {row.attestationTx && (
              <a
                href={row.attestationTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono"
              >
                attestation tx ↗
              </a>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
