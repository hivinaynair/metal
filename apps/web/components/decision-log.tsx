"use client"

import { CheckCircle2, XCircle, Zap } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import type { DemoAgent, DemoScenario, TriggerResult } from "@/lib/payment-demo"
import { fallbackRouteForAgent } from "@/lib/payment-demo"
import {
  cleanRejectionReason,
  resultFailureStep,
} from "@/lib/settlement-status"

function decisionStatus(
  step: number,
  activeStep: number,
  result: TriggerResult | null,
  running: boolean
) {
  if (running) {
    if (activeStep > step) return "approved"
    if (activeStep === step) return "running"
    return "pending"
  }

  if (!result) return "pending"
  if (result.httpStatus === 200) return "approved"

  const failed = resultFailureStep(result)
  if (step < failed) return "approved"
  if (step === failed) return "rejected"
  return "skipped"
}

export function DecisionLog({
  result,
  running,
  activeStep,
  selectedAgent,
  selectedScenario,
}: {
  result: TriggerResult | null
  running: boolean
  activeStep: number
  selectedAgent: DemoAgent
  selectedScenario: DemoScenario
}) {
  const route = result?.route ?? fallbackRouteForAgent(selectedAgent)
  const rejectedReason = cleanRejectionReason(result?.body?.error)

  const rows = [
    {
      step: 0,
      label: "Agent request",
      detail: `${selectedScenario.displayAgent} requests ${route.path}`,
    },
    {
      step: 1,
      label: "x402 challenge",
      detail: `${route.price} payment requirement received`,
    },
    {
      step: 2,
      label: "Identity",
      detail: result?.agentUri
        ? `ERC-8004 URI ${result.agentUri}`
        : selectedAgent.id,
    },
    {
      step: 3,
      label: "Mandate",
      detail:
        result?.mandateValid === false
          ? "AP2 mandate rejected"
          : `Limit ${selectedAgent.mandateLimit}`,
    },
    {
      step: 4,
      label: "Policy",
      detail: `Payment ${route.price} against ceiling ${result?.policyThreshold ?? "$2"}`,
    },
    {
      step: 5,
      label: "Settlement",
      detail: result?.settlementTxHash
        ? result.settlementTxHash.slice(0, 10) + "..."
        : result && result.httpStatus !== 200
          ? "No settlement transaction created"
          : "Pending",
    },
  ]

  if (!running && !result) {
    return (
      <div className="flex h-full min-h-52 flex-col justify-center rounded-sm border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Waiting for a run.</p>
        <p className="mt-2 leading-6">
          The settlement checks will appear here as the payment moves through
          the pipeline.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const status = decisionStatus(row.step, activeStep, result, running)
        const approved = status === "approved"
        const rejected = status === "rejected"
        const runningStep = status === "running"

        return (
          <div
            key={row.label}
            className={cn(
              "flex gap-3 rounded-sm border border-transparent px-2 py-1.5",
              runningStep && "border-border bg-muted/30",
              status === "skipped" && "opacity-45"
            )}
          >
            <span className="mt-0.5">
              {approved ? (
                <CheckCircle2 className="size-4 text-positive" />
              ) : rejected ? (
                <XCircle className="size-4 text-destructive" />
              ) : runningStep ? (
                <Zap className="size-4 animate-pulse text-foreground" />
              ) : (
                <span className="block size-4 rounded-full border border-border" />
              )}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-medium",
                  rejected && "text-destructive",
                  !approved &&
                    !rejected &&
                    !runningStep &&
                    "text-muted-foreground"
                )}
              >
                {row.label}
              </span>
              <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                {rejected && rejectedReason ? rejectedReason : row.detail}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
