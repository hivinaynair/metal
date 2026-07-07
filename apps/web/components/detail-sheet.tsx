"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import { formatUsdc, truncateAddress } from "@/lib/format"
import { TracePanel } from "@/components/trace-panel"
import type { TraceStep } from "@/components/trace-panel"

interface DetailSheetProps {
  open: boolean
  onClose: () => void
  row: {
    payer: string
    amountUsdc: bigint
    identityStatus: number
    decision: number
    timestamp: number
    txHash: string
    attestationTx: string
  } | null
}

// On-chain enum: decision 0 = approved, non-zero = rejected
// identityStatus 0 = unknown, non-zero = verified
const DECISION_APPROVED = 0

function buildSteps(row: NonNullable<DetailSheetProps["row"]>): TraceStep[] {
  const approved = row.decision === DECISION_APPROVED
  const identityOk = row.identityStatus !== 0
  const amountUsd = formatUsdc(row.amountUsdc)

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
      detail: `ceiling $${POLICY_MAX_AMOUNT_USDC} · payment $${amountUsd}`,
    },
    {
      id: 5,
      label: "Settlement + Attestation",
      status: approved ? "approved" : "skipped",
      detail: row.txHash ? `${row.txHash.slice(0, 10)}…` : undefined,
      link: row.txHash
        ? { href: `${BASE_SEPOLIA_EXPLORER}/tx/${row.txHash}`, label: "settlement tx" }
        : undefined,
      attestationLink: row.attestationTx
        ? { href: row.attestationTx, label: "attestation tx" }
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
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

        <Separator className="my-4" />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p className="italic">
            AP2 mandate verified off-chain. In production Metal, mandates are enforced as a native authorization primitive.
          </p>
          <div className="flex flex-col gap-1">
            {row.txHash && (
              <a
                href={`${BASE_SEPOLIA_EXPLORER}/tx/${row.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono"
              >
                settlement tx ↗
              </a>
            )}
            {row.attestationTx && (
              <a
                href={row.attestationTx}
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
