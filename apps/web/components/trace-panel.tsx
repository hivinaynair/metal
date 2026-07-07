"use client"

import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"

const TRACE_STEP_COUNT = 6

export type StepStatus = "pending" | "running" | "approved" | "rejected" | "skipped"

export interface TraceStep {
  id: number
  label: string
  status: StepStatus
  detail?: string
  link?: { href: string; label: string }
  attestationLink?: { href: string; label: string }
}

interface TracePanelProps {
  steps: TraceStep[]
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "approved") return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
  if (status === "rejected") return <XCircle className="h-4 w-4 text-destructive shrink-0" />
  if (status === "running") return <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
  if (status === "skipped") return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
}

export function TracePanel({ steps }: TracePanelProps) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="mt-1">
              <StepIcon status={step.status} />
            </div>
            {i < steps.length - 1 && (
              <div className={cn("w-px flex-1 my-1 min-h-[20px]",
                step.status === "skipped" ? "bg-border/30" : "bg-border"
              )} />
            )}
          </div>

          <div className={cn("pb-4 min-w-0", step.status === "skipped" && "opacity-40")}>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium",
                step.status === "rejected" && "text-destructive",
                step.status === "approved" && "text-foreground",
                (step.status === "pending" || step.status === "skipped") && "text-muted-foreground",
              )}>
                {step.label}
              </span>
              {step.status === "rejected" && (
                <Badge variant="destructive" className="text-xs py-0">rejected</Badge>
              )}
              {step.status === "approved" && (
                <Badge variant="outline" className="text-xs py-0 text-emerald-500 border-emerald-500/30">approved</Badge>
              )}
            </div>
            {step.detail && (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{step.detail}</p>
            )}
            <div className="flex gap-3 mt-0.5">
              {step.link && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-mono"
                >
                  {step.link.label} ↗
                </a>
              )}
              {step.attestationLink && (
                <a
                  href={step.attestationLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-mono"
                >
                  {step.attestationLink.label} ↗
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function buildTraceSteps(result: {
  httpStatus: number
  route: { path: string; price: string }
  agent: { id: string; mandateLimit: string } | null
  settlementTxHash?: string
  settlementTxUrl?: string
  attestationTxHash?: string
  attestationTxUrl?: string
  body?: { error?: string }
} | null, animStep: number): TraceStep[] {
  if (!result) {
    // animating — show steps 1..animStep as running/approved
    return [
      { id: 0, label: "Agent", status: animStep > 0 ? "approved" : "pending" },
      { id: 1, label: "402", status: animStep > 1 ? "approved" : animStep === 1 ? "running" : "pending" },
      { id: 2, label: "ERC-8004", status: animStep > 2 ? "approved" : animStep === 2 ? "running" : "pending" },
      { id: 3, label: "AP2", status: animStep > 3 ? "approved" : animStep === 3 ? "running" : "pending" },
      { id: 4, label: "Policy", status: animStep > 4 ? "approved" : animStep === 4 ? "running" : "pending" },
      { id: 5, label: "Settlement", status: animStep > 5 ? "approved" : animStep === 5 ? "running" : "pending" },
      { id: 6, label: "Attestation", status: animStep === 6 ? "running" : "pending" },
    ]
  }

  const error = result.body?.error
  const ok = result.httpStatus === 200

  // map error code → which step fails (steps after failStep are skipped)
  let failStep = 0
  if (!ok) {
    if (error === "identity_not_found") failStep = 2
    else if (error === "mandate_amount_exceeded") failStep = 3
    else if (error === "policy_amount_exceeded") failStep = 4
    else failStep = 4
  }

  function stepStatus(n: number): StepStatus {
    if (ok) return "approved"
    if (n < failStep) return "approved"
    if (n === failStep) return "rejected"
    return "skipped"
  }

  const txShort = result.settlementTxHash
    ? `${result.settlementTxHash.slice(0, 10)}…`
    : undefined

  return [
    {
      id: 0,
      label: "Agent",
      status: "approved",
      detail: result.agent ? result.agent.id : undefined,
    },
    {
      id: 1,
      label: "402",
      status: stepStatus(1),
      detail: `${result.route.path} · ${result.route.price}`,
    },
    {
      id: 2,
      label: "ERC-8004",
      status: stepStatus(2),
      detail: result.agent
        ? `${result.agent.id} · ${failStep === 2 ? "not registered" : "registered"}`
        : undefined,
    },
    {
      id: 3,
      label: "AP2",
      status: stepStatus(3),
      detail: result.agent ? `limit ${result.agent.mandateLimit}` : undefined,
    },
    {
      id: 4,
      label: "Policy",
      status: stepStatus(4),
      detail: `ceiling $${POLICY_MAX_AMOUNT_USDC} · payment ${result.route.price}`,
    },
    {
      id: 5,
      label: "Settlement",
      status: ok ? "approved" : "skipped",
      detail: txShort,
      link: result.settlementTxHash
        ? {
            href:
              result.settlementTxUrl ??
              `${BASE_SEPOLIA_EXPLORER}/tx/${result.settlementTxHash}`,
            label: "settlement tx",
          }
        : undefined,
    },
    {
      id: 6,
      label: "Attestation",
      status: result.attestationTxHash ? "approved" : ok ? "approved" : "skipped",
      detail: result.attestationTxHash
        ? `${result.attestationTxHash.slice(0, 10)}…`
        : undefined,
      attestationLink: result.attestationTxHash
        ? {
            href:
              result.attestationTxUrl ??
              `${BASE_SEPOLIA_EXPLORER}/tx/${result.attestationTxHash}`,
            label: "attestation tx",
          }
        : undefined,
    },
  ]
}

export { TRACE_STEP_COUNT }
