"use client"

import { useState } from "react"
import {
  Bot,
  Check,
  Coins,
  FileText,
  LinkIcon,
  Lock,
  Settings,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { AgentSplineModel } from "./agent-spline-model"
import { settlementFailureStep } from "@/lib/settlement-status"

export type GateState = "idle" | "running" | "approved" | "rejected" | "skipped"

export const settlementGates = [
  { key: "challenge", label: "x402", name: "x402 Challenge", icon: Zap },
  {
    key: "identity",
    label: "ERC-8004",
    name: "ERC-8004 Identity",
    icon: ShieldCheck,
  },
  { key: "mandate", label: "AP2", name: "AP2 Mandate", icon: FileText },
  { key: "policy", label: "Policy", name: "Policy Check", icon: Settings },
  { key: "settlement", label: "Settlement", name: "Settlement", icon: Coins },
  {
    key: "attestation",
    label: "Attestation",
    name: "Attestation",
    icon: LinkIcon,
  },
] as const

const stops = [17, 31, 44, 57, 70, 83, 95]

export function gateState(
  index: number,
  activeStep: number,
  approved: boolean,
  running: boolean,
  rejectedReason?: string
): GateState {
  const step = index + 1
  const fail = settlementFailureStep(rejectedReason)
  const isFinalFailure = !running && !approved && activeStep > 0

  if (approved && activeStep >= step) return "approved"
  if (fail > 0) {
    if (step < fail) return "approved"
    if (step === fail) return "rejected"
    return "skipped"
  }
  if (isFinalFailure) {
    if (step < activeStep) return "approved"
    if (step === activeStep) return "rejected"
    return "skipped"
  }
  if (activeStep === step) return "running"
  if (activeStep > step) return "approved"
  return "idle"
}

export function packetPosition(activeStep: number, rejectedReason?: string) {
  const fail = settlementFailureStep(rejectedReason)
  if (fail > 0) return stops[fail]!
  return stops[Math.min(Math.max(activeStep, 0), stops.length - 1)]!
}

export function AgentActor({ reasoning }: { reasoning?: string }) {
  const [robotLoaded, setRobotLoaded] = useState(false)
  const latestReasoning = reasoning?.replace(/\s+/g, " ").trim().slice(-100)

  return (
    <div className="relative h-full w-44 shrink-0">
      <div
        className="settlement-panel shadow-rail-panel absolute top-5 left-0 z-40 w-56 rounded-md border border-white/[0.14] px-3 py-2 text-left backdrop-blur-md transition-opacity duration-700"
        style={{ opacity: robotLoaded ? 1 : 0 }}
      >
        <p className="line-clamp-2 font-mono text-[0.68rem] leading-[1.45] text-white/85">
          {latestReasoning || "Im ready to make the payment!"}
        </p>
      </div>
      <div className="relative h-full w-full translate-x-4 overflow-visible">
        <AgentSplineModel onLoad={() => setRobotLoaded(true)} />
      </div>
    </div>
  )
}

export function GateModule({
  state,
  icon: Icon,
  label,
}: {
  state: GateState
  icon: (typeof settlementGates)[number]["icon"]
  label: string
}) {
  const active = state === "approved" || state === "running"
  const blocked = state === "rejected"
  const skipped = state === "skipped"

  const flangeClass = cn(
    "settlement-flange absolute -right-2 -left-2 h-[5px] rounded-[2px] border",
    active && "shadow-glow-positive border-accent/20",
    blocked && "border-destructive/20",
    !active && !blocked && "border-white/[0.05]"
  )

  return (
    <div className="flex flex-1 flex-col items-center gap-2 pt-16">
      <span
        className={cn(
          "relative z-10 font-mono text-xs font-bold tracking-[0.14em] uppercase",
          state === "running" && "text-accent",
          state === "approved" && "text-white",
          blocked && "text-destructive",
          skipped && "text-white/50",
          state === "idle" && "text-white/60"
        )}
      >
        {label}
      </span>
      <div className={cn("relative", skipped && "opacity-30")}>
        <div className={cn(flangeClass, "top-2")} />
        <div className={cn(flangeClass, "bottom-2")} />
        <div
          className={cn(
            "settlement-gate relative flex h-14 w-9 items-center justify-center rounded-[3px] border",
            active && "shadow-glow-positive border-accent/25",
            blocked && "shadow-glow-negative border-destructive/25",
            !active && !blocked && "border-white/[0.06]"
          )}
        >
          {active && (
            <div className="gate-glow-positive absolute inset-0 rounded-[3px] opacity-40 blur-sm" />
          )}
          {blocked && (
            <div className="gate-glow-negative absolute inset-0 rounded-[3px] opacity-40 blur-sm" />
          )}
          <Icon
            className={cn(
              "relative size-3.5",
              active && "text-accent",
              blocked && "text-destructive",
              !active && !blocked && "text-white/30"
            )}
          />
        </div>
        {(state === "approved" || state === "rejected") && (
          <span
            className={cn(
              "absolute -top-2 -right-2 grid size-[18px] place-items-center rounded-full border-2 border-surface-sunken",
              state === "approved"
                ? "shadow-glow-positive bg-positive"
                : "shadow-glow-negative bg-destructive"
            )}
          >
            {state === "approved" ? (
              <Check className="size-2.5 text-white" />
            ) : (
              <X className="size-2.5 text-white" />
            )}
          </span>
        )}
        {skipped && (
          <Lock className="absolute -top-2 -right-2 size-3 text-white/20" />
        )}
      </div>
    </div>
  )
}

export function MobileStepRow({
  state,
  icon: Icon,
  name,
  amountLabel,
}: {
  state: GateState
  icon: (typeof settlementGates)[number]["icon"]
  name: string
  amountLabel: string
}) {
  const isApproved = state === "approved"
  const isRunning = state === "running"
  const isRejected = state === "rejected"
  const isDim = state === "idle" || state === "skipped"

  const statusText = {
    idle: "waiting",
    running: "processing...",
    approved: "verified",
    rejected: "failed",
    skipped: "skipped",
  }[state]

  return (
    <div className="flex h-14 items-center gap-4 px-5">
      <div
        className={cn(
          "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
          isApproved && "border border-accent/40 bg-accent/15",
          isRunning &&
            "border border-accent/60 bg-accent/20 shadow-[0_0_14px_rgba(124,106,247,0.35)]",
          isRejected && "border border-destructive/40 bg-destructive/15",
          isDim && "border border-white/[0.08] bg-white/[0.03] opacity-30"
        )}
      >
        <Icon
          className={cn(
            "size-3.5",
            (isApproved || isRunning) && "text-accent",
            isRejected && "text-destructive",
            isDim && "text-white/20"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            isApproved && "font-medium text-white/90",
            isRunning && "font-semibold text-white",
            isRejected && "font-medium text-destructive",
            isDim && "font-medium text-white/30"
          )}
        >
          {name}
        </p>
        <p
          className={cn(
            "mt-0.5 font-mono text-[10px]",
            isApproved && "text-accent/60",
            isRunning && "text-accent/70",
            isRejected && "text-destructive/60",
            isDim && "text-white/20"
          )}
        >
          {statusText}
        </p>
      </div>

      {isApproved && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-positive shadow-[0_0_8px_rgba(74,222,128,0.4)]">
          <Check className="size-2.5 text-white" />
        </span>
      )}
      {isRejected && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive">
          <X className="size-2.5 text-white" />
        </span>
      )}
      {isRunning && (
        <span className="shrink-0 rounded border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-white">
          {amountLabel}
        </span>
      )}
    </div>
  )
}

export { Bot }
