"use client"

import { motion } from "framer-motion"
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

export type GateState = "idle" | "running" | "approved" | "rejected" | "skipped"

const gates = [
  { key: "challenge", label: "402", icon: Zap },
  { key: "identity", label: "ERC-8004", icon: ShieldCheck },
  { key: "mandate", label: "AP2", icon: FileText },
  { key: "policy", label: "Policy", icon: Settings },
  { key: "settlement", label: "Settlement", icon: Coins },
  { key: "attestation", label: "Attestation", icon: LinkIcon },
] as const

// Packet stop positions (%) per step — 0=start (after agent), 1–6=gate centers
const stops = [16, 31, 44, 57, 70, 83, 95]

interface SettlementSceneProps {
  agentLabel: string
  agentStatus?: string
  agentReasoning?: string
  amountLabel: string
  routeLabel: string
  mandateLimit: string
  activeStep: number
  running: boolean
  approved: boolean
  rejectedReason?: string
  settlementTx?: string
  attestationTx?: string
  action?: ReactNode
}

function failedStep(reason?: string) {
  if (reason === "identity_not_found") return 2
  if (reason === "mandate_amount_exceeded") return 3
  if (reason === "policy_amount_exceeded") return 4
  return reason ? 4 : 0
}

function gateState(
  index: number,
  activeStep: number,
  approved: boolean,
  running: boolean,
  rejectedReason?: string
): GateState {
  const step = index + 1
  const fail = failedStep(rejectedReason)
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
  const fail = failedStep(rejectedReason)
  if (fail > 0) return stops[fail]!
  return stops[Math.min(Math.max(activeStep, 0), stops.length - 1)]!
}

function AgentActor({
  reasoning,
  active,
  blocked,
}: {
  reasoning?: string
  active: boolean
  blocked: boolean
}) {
  const latestReasoning = reasoning?.replace(/\s+/g, " ").trim().slice(-100)

  return (
    <div className="relative h-full w-44 shrink-0">
      <div className="absolute top-5 left-0 z-40 w-56 rounded-md border border-white/[0.14] bg-[#11151c]/95 px-3 py-2 text-left shadow-[0_14px_34px_rgba(0,0,0,0.42),0_0_24px_rgba(63,224,208,0.08)] backdrop-blur-md">
        <p className="line-clamp-2 font-mono text-[0.68rem] leading-[1.45] text-white/85">
          {latestReasoning ||
            "Im ready to make the payment!"}
        </p>
      </div>
      <div
        className={cn(
          "relative h-full w-full translate-x-6 overflow-visible",
        )}
      >
        <AgentSplineModel active={active} blocked={blocked} />
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
    "absolute -right-2 -left-2 h-[5px] rounded-[2px] border bg-gradient-to-b from-[#141a1f] to-[#0a0d0f]",
    active && "border-accent/20 shadow-[0_0_6px_rgba(63,224,208,0.1)]",
    blocked && "border-destructive/20",
    !active && !blocked && "border-white/[0.05]"
  )

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-2 pt-16",
        skipped && "opacity-30"
      )}
    >
      {/* Label */}
      <span
        className={cn(
          "font-mono text-[9px] font-bold tracking-[0.14em] uppercase",
          active && "text-accent",
          blocked && "text-destructive",
          !active && !blocked && "text-white/60"
        )}
      >
        {label}
      </span>

      {/* Gate body with flanges */}
      <div className="relative">
        {/* Top flanges */}
        <div className={cn(flangeClass, "top-2")} />
        {/* Bottom flanges */}
        <div className={cn(flangeClass, "bottom-2")} />

        {/* Icon block */}
        <div
          className={cn(
            "relative flex h-14 w-9 items-center justify-center rounded-[3px] border bg-gradient-to-b from-[#0e1215] to-[#080b0d]",
            active &&
              "border-accent/25 shadow-[0_0_16px_rgba(63,224,208,0.12),inset_0_0_12px_rgba(63,224,208,0.05)]",
            blocked &&
              "border-destructive/25 shadow-[0_0_16px_rgba(239,96,96,0.12),inset_0_0_12px_rgba(239,96,96,0.05)]",
            !active && !blocked && "border-white/[0.06]"
          )}
        >
          {active && (
            <div
              className="absolute inset-0 rounded-[3px] opacity-40 blur-sm"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(63,224,208,0.15), transparent 70%)",
              }}
            />
          )}
          {blocked && (
            <div
              className="absolute inset-0 rounded-[3px] opacity-40 blur-sm"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(239,96,96,0.15), transparent 70%)",
              }}
            />
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

        {/* Status badge */}
        {(state === "approved" || state === "rejected") && (
          <span
            className={cn(
              "absolute -top-2 -right-2 grid size-[18px] place-items-center rounded-full border-2 border-[#060709]",
              state === "approved"
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : "bg-destructive shadow-[0_0_8px_rgba(239,96,96,0.5)]"
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
  const latestReasoning = agentReasoning
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(-100)
  const normalizedRoute = routeLabel
    .replace("/api/settlement-risk-report", "GET /v1/market-data")
    .replace("/api/premium-risk-report", "GET /v1/bulk-feed")
  const statusTone =
    agentStatus === "Trusted" || agentStatus === "approved"
      ? "bg-[var(--positive-surface)] text-[var(--positive)]"
      : agentStatus === "rejected"
        ? "bg-[var(--negative-surface)] text-[var(--negative)]"
        : "bg-[var(--warning-surface)] text-[var(--warning)]"

  return (
    <section className="overflow-hidden rounded-sm border border-accent/10 bg-[#060709] text-foreground">
      {/* HUD header */}
      <div className="flex items-center gap-3 border-b border-accent/[0.07] bg-accent/[0.025] px-5 py-2.5">
        <div className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_6px_theme(colors.accent/DEFAULT)]" />
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

      {/* Pipeline */}
      <div className="relative h-56 overflow-hidden px-6">
        {/* Track background */}
        <div className="absolute top-[112px] right-4 left-[22%] h-px bg-white/[0.06]" />

        {/* Track fill */}
        <motion.div
          className={cn(
            "absolute top-[112px] h-px",
            rejected
              ? "bg-gradient-to-r from-destructive/90 to-destructive/20 shadow-[0_0_6px_rgba(239,96,96,0.5)]"
              : "bg-gradient-to-r from-accent/90 to-accent/20 shadow-[0_0_6px_rgba(63,224,208,0.5)]"
          )}
          initial={false}
          animate={{ left: "22%", width: `${Math.max(0, packetLeft - 22)}%` }}
          transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
        />

        {/* Packet */}
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
                ? "border-destructive/50 bg-[#060709]/90 shadow-[0_0_20px_rgba(239,96,96,0.18),0_8px_24px_rgba(0,0,0,0.6)]"
                : "border-accent/50 bg-[#060709]/90 shadow-[0_0_20px_rgba(63,224,208,0.18),0_8px_24px_rgba(0,0,0,0.6)]"
            )}
          >
            <p
              className={cn(
                "font-mono text-[7px] font-bold tracking-[0.18em] uppercase",
                rejected ? "text-destructive" : "text-accent"
              )}
            >
              Payment
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-white">
              {amountLabel}
            </p>
          </div>
        </motion.div>

        {/* Agent + Gates */}
        <div className="relative z-10 flex h-full w-full">
          <AgentActor
            reasoning={agentReasoning}
            active={activeStep > 0}
            blocked={rejected}
          />
          <div className="flex min-w-0 flex-1 pl-10">
            {gates.map((gate, index) => {
              const state = gateState(
                index,
                activeStep,
                approved,
                running,
                rejectedReason
              )
              return (
                <GateModule
                  key={gate.key}
                  state={state}
                  icon={gate.icon}
                  label={gate.label}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Payment footer */}
      <div className="flex flex-wrap items-center gap-4 border-t border-border bg-[#050607] px-5 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold text-foreground">
              {agentLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-[2px] px-2 py-0.5 text-[11px] font-semibold",
                statusTone
              )}
            >
              {agentStatus}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground sm:text-xs">
            {normalizedRoute} · {amountLabel.replace("$", "")} USDC · Base
            Sepolia
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  )
}
