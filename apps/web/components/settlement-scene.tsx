"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"
import {
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
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"

export type GateState = "idle" | "running" | "approved" | "rejected" | "skipped"

const gates = [
  { key: "challenge", label: "402", icon: Zap },
  { key: "identity", label: "ERC-8004", icon: ShieldCheck },
  { key: "mandate", label: "AP2", icon: FileText },
  { key: "policy", label: "Policy", icon: Settings },
  { key: "settlement", label: "Settlement", icon: Coins },
  { key: "attestation", label: "Attestation", icon: LinkIcon },
] as const

// Packet stop positions (%) per step — 0=start, 1–6=gate centers across full width
const stops = [4, 8, 25, 42, 58, 75, 92]

interface SettlementSceneProps {
  agentLabel: string
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

function gateState(index: number, activeStep: number, approved: boolean, running: boolean, rejectedReason?: string): GateState {
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
    "absolute -left-2 -right-2 h-[5px] rounded-[2px] border bg-gradient-to-b from-[#141a1f] to-[#0a0d0f]",
    active && "border-accent/20 shadow-[0_0_6px_rgba(63,224,208,0.1)]",
    blocked && "border-destructive/20",
    !active && !blocked && "border-white/[0.05]"
  )

  return (
    <div className={cn("flex flex-1 flex-col items-center pt-3 gap-2", skipped && "opacity-30")}>
      {/* Label */}
      <span className={cn(
        "font-mono text-[9px] font-bold uppercase tracking-[0.14em]",
        active && "text-accent",
        blocked && "text-destructive",
        !active && !blocked && "text-white/18"
      )}>
        {label}
      </span>

      {/* Gate body with flanges */}
      <div className="relative">
        {/* Top flanges */}
        <div className={cn(flangeClass, "top-2")} />
        {/* Bottom flanges */}
        <div className={cn(flangeClass, "bottom-2")} />

        {/* Icon block */}
        <div className={cn(
          "relative flex h-14 w-9 items-center justify-center rounded-[3px] border bg-gradient-to-b from-[#0e1215] to-[#080b0d]",
          active && "border-accent/25 shadow-[0_0_16px_rgba(63,224,208,0.12),inset_0_0_12px_rgba(63,224,208,0.05)]",
          blocked && "border-destructive/25 shadow-[0_0_16px_rgba(239,96,96,0.12),inset_0_0_12px_rgba(239,96,96,0.05)]",
          !active && !blocked && "border-white/[0.06]"
        )}>
          {active && (
            <div className="absolute inset-0 rounded-[3px] opacity-40 blur-sm"
              style={{ background: "radial-gradient(circle at 50% 50%, rgba(63,224,208,0.15), transparent 70%)" }} />
          )}
          {blocked && (
            <div className="absolute inset-0 rounded-[3px] opacity-40 blur-sm"
              style={{ background: "radial-gradient(circle at 50% 50%, rgba(239,96,96,0.15), transparent 70%)" }} />
          )}
          <Icon className={cn(
            "relative size-3.5",
            active && "text-accent",
            blocked && "text-destructive",
            !active && !blocked && "text-white/15"
          )} />
        </div>

        {/* Status badge */}
        {(state === "approved" || state === "rejected") && (
          <span className={cn(
            "absolute -right-2 -top-2 grid size-[18px] place-items-center rounded-full border-2 border-[#060709]",
            state === "approved"
              ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
              : "bg-destructive shadow-[0_0_8px_rgba(239,96,96,0.5)]"
          )}>
            {state === "approved" ? <Check className="size-2.5 text-white" /> : <X className="size-2.5 text-white" />}
          </span>
        )}
        {skipped && <Lock className="absolute -right-2 -top-2 size-3 text-white/20" />}
      </div>
    </div>
  )
}

export function SettlementScene({
  agentLabel,
  agentReasoning,
  amountLabel,
  routeLabel,
  mandateLimit,
  activeStep,
  running,
  approved,
  rejectedReason,
  settlementTx,
  attestationTx,
  action,
}: SettlementSceneProps) {
  const rejected = Boolean(rejectedReason) || (!running && !approved && activeStep > 0)
  const packetLeft = packetPosition(activeStep, rejectedReason)
  const statusLabel = running ? "RUNNING" : approved ? "SETTLED" : rejected ? "BLOCKED" : "READY"
  const latestReasoning = agentReasoning?.replace(/\s+/g, " ").trim().slice(-100)

  return (
    <section className="overflow-hidden rounded-sm border border-accent/10 bg-[#060709] text-foreground">

      {/* HUD header */}
      <div className="flex items-center gap-3 border-b border-accent/[0.07] bg-accent/[0.025] px-5 py-2.5">
        <div className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_6px_theme(colors.accent/DEFAULT)]" />
        <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-accent/70">
          x402 Settlement Pipeline
        </span>
        {latestReasoning && (
          <span className="ml-2 min-w-0 truncate font-mono text-[9px] text-white/20">
            {latestReasoning}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[9px] text-white/15">{agentLabel}</span>
      </div>

      {/* Pipeline */}
      <div className="relative h-[110px] px-6">
        {/* Track background */}
        <div className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-white/[0.04]" />

        {/* Track fill */}
        <motion.div
          className={cn(
            "absolute left-6 top-1/2 h-px -translate-y-1/2",
            rejected
              ? "shadow-[0_0_6px_rgba(239,96,96,0.5)] bg-gradient-to-r from-destructive/90 to-destructive/20"
              : "shadow-[0_0_6px_rgba(63,224,208,0.5)] bg-gradient-to-r from-accent/90 to-accent/20"
          )}
          initial={false}
          animate={{ width: `calc(${Math.max(0, packetLeft - 4)}% - 1.5rem)` }}
          transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
        />

        {/* Packet */}
        <motion.div
          className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          initial={false}
          animate={{ left: `${packetLeft}%` }}
          transition={{ duration: 0.72, ease: [0.2, 0, 0, 1] }}
        >
          <div className={cn(
            "rounded-[3px] border px-3 py-2 text-center backdrop-blur-md",
            rejected
              ? "border-destructive/50 bg-[#060709]/90 shadow-[0_0_20px_rgba(239,96,96,0.18),0_8px_24px_rgba(0,0,0,0.6)]"
              : "border-accent/50 bg-[#060709]/90 shadow-[0_0_20px_rgba(63,224,208,0.18),0_8px_24px_rgba(0,0,0,0.6)]"
          )}>
            <p className={cn(
              "font-mono text-[7px] font-bold uppercase tracking-[0.18em]",
              rejected ? "text-destructive" : "text-accent"
            )}>
              Payment
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-white">{amountLabel}</p>
          </div>
        </motion.div>

        {/* Gates */}
        <div className="relative z-10 flex h-full w-full">
          {gates.map((gate, index) => {
            const state = gateState(index, activeStep, approved, running, rejectedReason)
            return (
              <GateModule key={gate.key} state={state} icon={gate.icon} label={gate.label} />
            )
          })}
        </div>
      </div>

      {/* HUD status bar */}
      <div className="flex flex-wrap items-center gap-3 border-t border-accent/[0.06] bg-accent/[0.015] px-5 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          {[
            ["AGENT", agentLabel, undefined],
            ["ROUTE", routeLabel, undefined],
            ["MANDATE", mandateLimit, undefined],
            ["POLICY", `$${POLICY_MAX_AMOUNT_USDC}`, undefined],
            ["STATUS", statusLabel, running ? "text-accent" : approved ? "text-emerald-400" : rejected ? "text-destructive" : "text-white/30"],
            ["SETTLEMENT", settlementTx ? "READY" : rejected ? "NONE" : "PENDING", settlementTx ? "text-accent" : rejected ? "text-destructive/60" : "text-white/25"],
            ["ATTESTATION", attestationTx ? "READY" : rejected ? "NONE" : "PENDING", attestationTx ? "text-accent" : rejected ? "text-destructive/60" : "text-white/25"],
          ].map(([key, val, valClass]) => (
            <span key={key as string} className="font-mono text-[9px] tracking-[0.06em] text-white/20">
              {key}{" "}
              <span className={cn("text-white/45", valClass as string | undefined)}>{val}</span>
            </span>
          ))}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  )
}
