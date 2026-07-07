"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Circle, Lock, ShieldCheck, XCircle } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"

export type GateState = "idle" | "running" | "approved" | "rejected" | "skipped"

interface Gate {
  key: string
  label: string
  short: string
  detail: string
}

const gates: Gate[] = [
  { key: "challenge", label: "402 Challenge", short: "402", detail: "paid route" },
  { key: "identity", label: "ERC-8004", short: "ID", detail: "agent identity" },
  { key: "mandate", label: "AP2 Mandate", short: "AP2", detail: "delegated spend" },
  { key: "policy", label: "Policy", short: "POL", detail: "settlement rule" },
  { key: "settlement", label: "Settlement", short: "SET", detail: "USDC transfer" },
  { key: "attestation", label: "Attestation", short: "ATT", detail: "audit proof" },
]

const packetStops = [4, 19, 34, 49, 64, 79, 94]

interface SettlementSceneProps {
  agentLabel: string
  amountLabel: string
  routeLabel: string
  mandateLimit: string
  failAt: string
  activeStep: number
  running: boolean
  approved: boolean
  rejectedReason?: string
  settlementTx?: string
  attestationTx?: string
}

function failedStep(reason?: string) {
  if (reason === "identity_not_found") return 2
  if (reason === "mandate_amount_exceeded") return 3
  if (reason === "policy_amount_exceeded") return 4
  return reason ? 4 : 0
}

function gateState(index: number, activeStep: number, approved: boolean, rejectedReason?: string): GateState {
  const step = index + 1
  const fail = failedStep(rejectedReason)

  if (approved && activeStep >= step) return "approved"
  if (fail > 0) {
    if (step < fail) return "approved"
    if (step === fail) return "rejected"
    return "skipped"
  }
  if (activeStep === step) return "running"
  if (activeStep > step) return "approved"
  return "idle"
}

function packetPosition(activeStep: number, rejectedReason?: string) {
  const fail = failedStep(rejectedReason)
  if (fail > 0) return packetStops[fail]!
  return packetStops[Math.min(Math.max(activeStep, 0), packetStops.length - 1)]!
}

function railProgress(activeStep: number, rejectedReason?: string) {
  return packetPosition(activeStep, rejectedReason)
}

function stateStyles(state: GateState) {
  if (state === "approved") {
    return {
      shell: "border-teal-300/60 bg-teal-300/12 text-teal-50 shadow-[0_0_28px_rgba(45,212,191,0.18)]",
      dot: "bg-teal-300 shadow-[0_0_18px_rgba(94,234,212,0.85)]",
      line: "bg-teal-300",
    }
  }
  if (state === "running") {
    return {
      shell: "border-cyan-200/70 bg-cyan-300/12 text-cyan-50 shadow-[0_0_32px_rgba(103,232,249,0.22)]",
      dot: "bg-cyan-200 shadow-[0_0_20px_rgba(103,232,249,0.95)]",
      line: "bg-cyan-200",
    }
  }
  if (state === "rejected") {
    return {
      shell: "border-red-400/75 bg-red-500/16 text-red-50 shadow-[0_0_34px_rgba(248,113,113,0.26)]",
      dot: "bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.9)]",
      line: "bg-red-400",
    }
  }
  if (state === "skipped") {
    return {
      shell: "border-white/10 bg-white/[0.03] text-white/24",
      dot: "bg-white/18",
      line: "bg-white/10",
    }
  }
  return {
    shell: "border-white/12 bg-white/[0.045] text-white/55",
    dot: "bg-white/28",
    line: "bg-white/16",
  }
}

function GateIcon({ state }: { state: GateState }) {
  if (state === "approved") return <CheckCircle2 className="h-4 w-4 text-teal-200" />
  if (state === "rejected") return <XCircle className="h-4 w-4 text-red-200" />
  if (state === "running") return <ShieldCheck className="h-4 w-4 text-cyan-100" />
  if (state === "skipped") return <Lock className="h-4 w-4 text-white/25" />
  return <Circle className="h-4 w-4 text-white/35" />
}

export function SettlementScene({
  agentLabel,
  amountLabel,
  routeLabel,
  mandateLimit,
  failAt,
  activeStep,
  running,
  approved,
  rejectedReason,
  settlementTx,
  attestationTx,
}: SettlementSceneProps) {
  const rejected = Boolean(rejectedReason)
  const packetLeft = packetPosition(activeStep, rejectedReason)
  const progress = railProgress(activeStep, rejectedReason)

  return (
    <section className="relative box-border w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-white/10 bg-[#060908] text-white shadow-2xl sm:max-w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.2),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_24px)]" />
      <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-teal-200/50 to-transparent" />

      <div className="relative grid min-w-0 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:p-6">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-teal-100/70">Settlement Rail</p>
              <h2 className="mt-1 max-w-xl text-wrap text-xl font-semibold text-white">
                Payment primitives executing before funds move
              </h2>
            </div>
            <Badge
              variant={rejected ? "destructive" : approved ? "outline" : "secondary"}
              className={cn(
                "border-white/20 bg-white/10 text-white",
                approved && "border-teal-300/50 bg-teal-300/10 text-teal-100",
                rejected && "border-red-400/70 bg-red-500/20 text-red-50",
              )}
            >
              {running ? "running" : rejected ? "blocked before funds moved" : approved ? "approved" : "ready"}
            </Badge>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#030504] p-4 sm:p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_46%_42%,rgba(20,184,166,0.18),transparent_34%),linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent_36%)]" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-teal-200/18 to-transparent" />

            <div className="relative mb-4 flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
              <span>Agent authorization</span>
              <span>Base Sepolia settlement</span>
            </div>

            <div className="relative min-h-[360px] overflow-hidden pt-12 sm:min-h-[430px]">
              <div className="absolute left-6 right-6 top-[118px] h-2 rounded-full bg-white/10 sm:left-8 sm:right-8">
                <motion.div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-teal-300 via-cyan-200 to-teal-300 shadow-[0_0_28px_rgba(45,212,191,0.48)]",
                    rejected && "from-teal-300 via-cyan-200 to-red-400",
                  )}
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 80, damping: 18 }}
                />
              </div>

              <motion.div
                className="absolute top-[84px] z-20 -translate-x-1/2"
                initial={false}
                animate={{ left: `${packetLeft}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 17 }}
              >
                <motion.div
                  className={cn(
                    "relative flex h-16 w-24 items-center justify-center rounded-full border text-xs font-semibold",
                    rejected
                      ? "border-red-300/80 bg-red-500/25 text-red-50 shadow-[0_0_44px_rgba(248,113,113,0.48)]"
                      : "border-teal-100/80 bg-teal-300/22 text-teal-50 shadow-[0_0_44px_rgba(45,212,191,0.52)]",
                  )}
                  animate={{
                    scale: running ? [1, 1.05, 1] : 1,
                    boxShadow: rejected
                      ? "0 0 44px rgba(248,113,113,0.48)"
                      : "0 0 44px rgba(45,212,191,0.52)",
                  }}
                  transition={{ duration: 1, repeat: running ? Infinity : 0 }}
                >
                  <span>{amountLabel}</span>
                  <span className="absolute inset-0 rounded-full border border-white/30" />
                </motion.div>
              </motion.div>

              <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {gates.map((gate, index) => {
                  const state = gateState(index, activeStep, approved, rejectedReason)
                  const styles = stateStyles(state)
                  return (
                    <motion.div
                      key={gate.key}
                      className={cn("relative min-h-36 min-w-0 rounded-lg border p-3 backdrop-blur sm:min-h-40", styles.shell)}
                      initial={false}
                      animate={{
                        y: state === "running" ? [0, -4, 0] : 0,
                        opacity: state === "skipped" ? 0.45 : 1,
                      }}
                      transition={{ duration: 0.9, repeat: state === "running" ? Infinity : 0 }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />
                        <GateIcon state={state} />
                      </div>
                      <div className="mt-8 sm:mt-12">
                        <p className="font-mono text-[11px] uppercase tracking-wide text-white/45">{gate.short}</p>
                        <p className="mt-1 break-words text-sm font-medium text-white">{gate.label}</p>
                        <p className="mt-1 text-xs text-white/42">{gate.detail}</p>
                      </div>
                      <motion.div
                        className={cn("absolute inset-x-3 bottom-3 h-1 rounded-full", styles.line)}
                        initial={false}
                        animate={{ scaleX: state === "running" ? [0.25, 1, 0.25] : state === "idle" ? 0.22 : 1 }}
                        transition={{ duration: 1.1, repeat: state === "running" ? Infinity : 0 }}
                        style={{ transformOrigin: "left" }}
                      />
                    </motion.div>
                  )
                })}
              </div>

              <motion.div
                className="mt-5 grid min-w-0 gap-2 text-xs text-white/70 sm:grid-cols-3"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="min-w-0 rounded border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-white/40">Agent</p>
                  <p className="mt-1 break-all font-mono text-white">{agentLabel}</p>
                </div>
                <div className="min-w-0 rounded border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-white/40">Resource</p>
                  <p className="mt-1 break-all font-mono text-white">{routeLabel}</p>
                </div>
                <div className="min-w-0 rounded border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-white/40">Mandate / Policy</p>
                  <p className="mt-1 font-mono text-white">
                    {mandateLimit} / ${POLICY_MAX_AMOUNT_USDC}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Scenario</p>
            <p className="mt-1 text-sm text-white">{failAt === "-" ? "Happy path" : failAt}</p>
          </div>
          <div className="h-px bg-white/10" />
          <div className="grid gap-3 text-xs">
            <div>
              <p className="text-white/40">Current packet</p>
              <p className="mt-1 font-mono text-teal-100">{amountLabel} USDC authorization</p>
            </div>
            <div>
              <p className="text-white/40">Safety invariant</p>
              <p className="mt-1 text-white/80">Rejected flows stop before settlement.</p>
            </div>
            <motion.div
              animate={{
                borderColor: rejected ? "rgba(248,113,113,0.35)" : approved ? "rgba(94,234,212,0.35)" : "rgba(255,255,255,0.1)",
              }}
              className="rounded border border-white/10 bg-black/15 p-3"
            >
              <p className="text-white/40">Proof artifacts</p>
              <div className="mt-2 flex flex-col gap-2">
                <span
                  className={cn(
                    "rounded border px-2 py-1 font-mono",
                    settlementTx
                      ? "border-teal-300/40 bg-teal-300/10 text-teal-100"
                      : "border-white/10 bg-white/[0.03] text-white/35",
                  )}
                >
                  settlement tx {settlementTx ? "ready" : "pending"}
                </span>
                <span
                  className={cn(
                    "rounded border px-2 py-1 font-mono",
                    attestationTx
                      ? "border-teal-300/40 bg-teal-300/10 text-teal-100"
                      : "border-white/10 bg-white/[0.03] text-white/35",
                  )}
                >
                  attestation {attestationTx ? "ready" : approved ? "emitted" : "pending"}
                </span>
              </div>
            </motion.div>
          </div>
        </aside>
      </div>
    </section>
  )
}
