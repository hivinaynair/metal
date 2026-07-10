"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import type { ReactNode } from "react"
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
import { AgentSplineModel } from "@/components/agent-spline-model"
import { settlementFailureStep } from "@/lib/settlement-status"

export type GateState = "idle" | "running" | "approved" | "rejected" | "skipped"

const gates = [
  { key: "challenge",   label: "x402",         name: "x402 Challenge",    icon: Zap },
  { key: "identity",    label: "ERC-8004",     name: "ERC-8004 Identity", icon: ShieldCheck },
  { key: "mandate",     label: "AP2",          name: "AP2 Mandate",      icon: FileText },
  { key: "policy",      label: "Policy",       name: "Policy Check",     icon: Settings },
  { key: "settlement",  label: "Settlement",   name: "Settlement",       icon: Coins },
  { key: "attestation", label: "Attestation",  name: "Attestation",      icon: LinkIcon },
] as const

// Horizontal packet stop positions (%) per step — 0=start, 1–6=gate centers
const stops = [17, 31, 44, 57, 70, 83, 95]

interface SettlementSceneProps {
  agentLabel: string
  agentStatus?: string
  agentReasoning?: string
  amountLabel: string
  routeLabel: string
  activeStep: number
  running: boolean
  approved: boolean
  rejectedReason?: string
  settlementTx?: string
  attestationTx?: string
  action?: ReactNode
}

function gateState(
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

function packetPosition(activeStep: number, rejectedReason?: string) {
  const fail = settlementFailureStep(rejectedReason)
  if (fail > 0) return stops[fail]!
  return stops[Math.min(Math.max(activeStep, 0), stops.length - 1)]!
}

function AgentActor({
  reasoning,
}: {
  reasoning?: string
}) {
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

function GateModule({
  state,
  icon: Icon,
  label,
}: {
  state: GateState
  icon: (typeof gates)[number]["icon"]
  label: string
}) {
  const active = state === "approved" || state === "running"
  const blocked = state === "rejected"
  const skipped = state === "skipped"

  const flangeClass = cn(
    "settlement-flange absolute -right-2 -left-2 h-[5px] rounded-[2px] border",
    active && "border-accent/20 shadow-glow-positive",
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
            active && "border-accent/25 shadow-glow-positive",
            blocked && "border-destructive/25 shadow-glow-negative",
            !active && !blocked && "border-white/[0.06]"
          )}
        >
          {active && <div className="gate-glow-positive absolute inset-0 rounded-[3px] opacity-40 blur-sm" />}
          {blocked && <div className="gate-glow-negative absolute inset-0 rounded-[3px] opacity-40 blur-sm" />}
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
              state === "approved" ? "bg-positive shadow-glow-positive" : "bg-destructive shadow-glow-negative"
            )}
          >
            {state === "approved" ? <Check className="size-2.5 text-white" /> : <X className="size-2.5 text-white" />}
          </span>
        )}
        {skipped && <Lock className="absolute -top-2 -right-2 size-3 text-white/20" />}
      </div>
    </div>
  )
}

// ── Option C: clean step row for mobile ──
function MobileStepRow({
  state,
  icon: Icon,
  name,
  amountLabel,
}: {
  state: GateState
  icon: (typeof gates)[number]["icon"]
  name: string
  amountLabel: string
}) {
  const isApproved = state === "approved"
  const isRunning  = state === "running"
  const isRejected = state === "rejected"
  const isDim      = state === "idle" || state === "skipped"

  const statusText = {
    idle:     "waiting",
    running:  "processing…",
    approved: "verified",
    rejected: "failed",
    skipped:  "skipped",
  }[state]

  return (
    <div className="flex h-14 items-center gap-4 px-5">
      {/* Circle dot — centered on track at left-[38px] (px-5=20px + size-9/2=18px) */}
      <div
        className={cn(
          "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
          isApproved && "border border-accent/40 bg-accent/15",
          isRunning  && "border border-accent/60 bg-accent/20 shadow-[0_0_14px_rgba(124,106,247,0.35)]",
          isRejected && "border border-destructive/40 bg-destructive/15",
          isDim      && "border border-white/[0.08] bg-white/[0.03] opacity-30"
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

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            isApproved && "font-medium text-white/90",
            isRunning  && "font-semibold text-white",
            isRejected && "font-medium text-destructive",
            isDim      && "font-medium text-white/30"
          )}
        >
          {name}
        </p>
        <p
          className={cn(
            "mt-0.5 font-mono text-[10px]",
            isApproved && "text-accent/60",
            isRunning  && "text-accent/70",
            isRejected && "text-destructive/60",
            isDim      && "text-white/20"
          )}
        >
          {statusText}
        </p>
      </div>

      {/* Right indicator */}
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
        <span className="shrink-0 rounded px-2 py-0.5 font-mono text-xs font-semibold text-white border border-accent/20 bg-accent/10">
          {amountLabel}
        </span>
      )}
    </div>
  )
}

export function SettlementScene({
  agentLabel,
  agentStatus = "Trusted",
  agentReasoning,
  amountLabel,
  routeLabel,
  activeStep,
  running,
  approved,
  rejectedReason,
  action,
}: SettlementSceneProps) {
  const rejected =
    Boolean(rejectedReason) || (!running && !approved && activeStep > 0)
  const packetLeft = packetPosition(activeStep, rejectedReason)
  const latestReasoning = agentReasoning?.replace(/\s+/g, " ").trim().slice(-100)
  const normalizedRoute = routeLabel
    .replace("/api/settlement-risk-report", "Settlement risk report")
    .replace("/api/premium-risk-report", "Premium risk report")
  const statusTone =
    agentStatus === "Trusted" || agentStatus === "approved"
      ? "bg-positive-surface text-positive"
      : agentStatus === "rejected"
        ? "bg-negative-surface text-negative"
        : "bg-warning-surface text-warning"

  return (
    <section className="settlement-pipeline settlement-pipeline-shadow overflow-hidden rounded-sm border border-accent/10 text-foreground sm:min-w-[620px]">

      {/* ── MOBILE: header (was footer) ── */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-sunken px-4 py-3 sm:hidden">
        <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{agentLabel}</span>
            <span className={cn("inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold", statusTone)}>
              {agentStatus}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {normalizedRoute} · {amountLabel.replace("$", "")} USDC
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* ── MOBILE: Option C — robot + clean step list ── */}
      <div className="flex flex-col sm:hidden">
        {/* Spline robot with purple glow + reasoning bubble */}
        <div className="relative h-44 overflow-hidden border-b border-accent/[0.07]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_65%,rgba(124,106,247,0.18)_0%,transparent_70%)]" />
          <AgentSplineModel />
          <div className="absolute bottom-3 left-3 right-3 rounded-md border border-white/[0.1] bg-black/55 px-3 py-2 backdrop-blur-md">
            <p className="font-mono text-[9px] leading-[1.45] text-white/70">
              {latestReasoning || "Im ready to make the payment!"}
            </p>
          </div>
        </div>

        {/* Step list */}
        <div className="relative">
          {/* Track background — from center of first dot to center of last dot */}
          {/* px-5=20px + size-9/2=18px = 38px from left edge */}
          <div className="absolute left-[38px] top-[28px] bottom-[28px] w-px bg-white/[0.05]" />

          {/* Track fill (animated) */}
          <motion.div
            className={cn(
              "absolute left-[38px] top-[28px] w-px origin-top",
              rejected
                ? "bg-gradient-to-b from-destructive/80 to-destructive/20"
                : "bg-gradient-to-b from-accent/80 to-accent/20"
            )}
            initial={false}
            animate={{ scaleY: Math.max(0, (activeStep - 1) / 5) }}
            style={{ height: "calc(100% - 56px)" }}
            transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
          />

          {gates.map((gate, index) => (
            <MobileStepRow
              key={gate.key}
              state={gateState(index, activeStep, approved, running, rejectedReason)}
              icon={gate.icon}
              name={gate.name}
              amountLabel={amountLabel}
            />
          ))}
        </div>
      </div>

      {/* ── DESKTOP: HUD header ── */}
      <div className="hidden items-center gap-3 border-b border-accent/[0.07] bg-accent/[0.025] px-5 py-3 sm:flex">
        <div className="size-1.5 shrink-0 rounded-full bg-accent shadow-glow-positive" />
        <span className="shrink-0 font-mono text-[9px] font-bold tracking-[0.2em] uppercase">
          x402 Settlement Pipeline
        </span>
        {latestReasoning && (
          <span className="ml-2 min-w-0 truncate font-mono text-[9px] text-white/35">
            {latestReasoning}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[9px] text-white/35">
          {agentLabel}
        </span>
      </div>

      {/* ── DESKTOP: horizontal pipeline ── */}
      <div className="relative hidden h-56 overflow-hidden px-6 sm:block">
        <div className="absolute top-[112px] right-4 left-[22%] h-px bg-white/[0.06]" />
        <motion.div
          className={cn(
            "absolute top-[112px] h-px",
            rejected
              ? "bg-gradient-to-r from-destructive/90 to-destructive/20 shadow-glow-negative"
              : "bg-gradient-to-r from-accent/90 to-accent/20 shadow-glow-positive"
          )}
          initial={false}
          animate={{ left: "22%", width: `${Math.max(0, packetLeft - 22)}%` }}
          transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
        />
        <motion.div
          className="absolute top-[112px] z-20 -translate-x-1/2 -translate-y-1/2"
          initial={false}
          animate={{ left: `${packetLeft}%` }}
          transition={{ duration: 0.72, ease: [0.2, 0, 0, 1] }}
        >
          <div
            className={cn(
              "rounded-[3px] border px-3 py-2 text-center backdrop-blur-md",
              rejected
                ? "settlement-pipeline border-destructive/50 shadow-rail-negative"
                : "settlement-pipeline border-accent/50 shadow-rail-positive"
            )}
          >
            <p className={cn("font-mono text-[8px] font-bold  uppercase", rejected ? "text-destructive" : "text-primary/80")}>
              Payment
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-white">{amountLabel}</p>
          </div>
        </motion.div>
        <div className="relative z-10 flex h-full w-full">
          <AgentActor reasoning={agentReasoning} />
          <div className="flex min-w-0 flex-1 pl-10">
            {gates.map((gate, index) => (
              <GateModule
                key={gate.key}
                state={gateState(index, activeStep, approved, running, rejectedReason)}
                icon={gate.icon}
                label={gate.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── DESKTOP: footer ── */}
      <div className="hidden flex-wrap items-center gap-4 border-t border-border bg-surface-sunken px-5 py-4 sm:flex">
        <div className="grid size-9 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold text-foreground">{agentLabel}</span>
            <span className={cn("inline-flex items-center rounded-[2px] px-2 py-0.5 text-[11px] font-semibold", statusTone)}>
              {agentStatus}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground sm:text-xs">
            {normalizedRoute} · {amountLabel.replace("$", "")} USDC · Base Sepolia
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  )
}
