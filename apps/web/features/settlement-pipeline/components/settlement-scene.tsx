"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { AgentSplineModel } from "./agent-spline-model"
import {
  AgentActor,
  Bot,
  GateModule,
  MobileStepRow,
  gateState,
  packetPosition,
  settlementGates,
} from "./settlement-scene-parts"

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

const SCENE_CLASSES = {
  rejected: {
    verticalBar: "bg-gradient-to-b from-destructive/80 to-destructive/20",
    horizontalBar: "shadow-glow-negative bg-gradient-to-r from-destructive/90 to-destructive/20",
    packet: "settlement-pipeline shadow-rail-negative border-destructive/50",
    label: "text-destructive",
  },
  approved: {
    verticalBar: "bg-gradient-to-b from-accent/80 to-accent/20",
    horizontalBar: "shadow-glow-positive bg-gradient-to-r from-accent/90 to-accent/20",
    packet: "settlement-pipeline shadow-rail-positive border-accent/50",
    label: "text-primary/80",
  },
}

function statusTone(agentStatus: string) {
  if (agentStatus === "Trusted" || agentStatus === "approved") {
    return "bg-positive-surface text-positive"
  }
  if (agentStatus === "rejected") return "bg-negative-surface text-negative"
  return "bg-warning-surface text-warning"
}

function displayRoute(routeLabel: string) {
  return routeLabel
    .replace("/api/settlement-risk-report", "Settlement risk report")
    .replace("/api/premium-risk-report", "Premium risk report")
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

  const sceneClasses = SCENE_CLASSES[rejected ? "rejected" : "approved"]
  const latestReasoning = agentReasoning
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(-100)
  const normalizedRoute = displayRoute(routeLabel)
  const tone = statusTone(agentStatus)

  return (
    <section className="settlement-pipeline settlement-pipeline-shadow overflow-hidden rounded-sm border border-accent/10 text-foreground sm:min-w-[620px]">
      <div className="flex items-center gap-3 border-b border-border bg-surface-sunken px-4 py-3 sm:hidden">
        <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {agentLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold",
                tone
              )}
            >
              {agentStatus}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {normalizedRoute} · {amountLabel.replace("$", "")} USDC
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="flex flex-col sm:hidden">
        <div className="relative h-44 overflow-hidden border-b border-accent/[0.07]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_65%,rgba(124,106,247,0.18)_0%,transparent_70%)]" />
          <AgentSplineModel />
          <div className="absolute right-3 bottom-3 left-3 rounded-md border border-white/[0.1] bg-black/55 px-3 py-2 backdrop-blur-md">
            <p className="font-mono text-[9px] leading-[1.45] text-white/70">
              {latestReasoning || "Im ready to make the payment!"}
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-[28px] bottom-[28px] left-[38px] w-px bg-white/[0.05]" />
          <motion.div
            className={cn(
              "absolute top-[28px] left-[38px] w-px origin-top",
              sceneClasses.verticalBar
            )}
            initial={false}
            animate={{ scaleY: Math.max(0, (activeStep - 1) / 5) }}
            style={{ height: "calc(100% - 56px)" }}
            transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
          />

          {settlementGates.map((gate, index) => (
            <MobileStepRow
              key={gate.key}
              state={gateState(
                index,
                activeStep,
                approved,
                running,
                rejectedReason
              )}
              icon={gate.icon}
              name={gate.name}
              amountLabel={amountLabel}
            />
          ))}
        </div>
      </div>

      <div className="hidden items-center gap-3 border-b border-accent/[0.07] bg-accent/[0.025] px-5 py-3 sm:flex">
        <div className="shadow-glow-positive size-1.5 shrink-0 rounded-full bg-accent" />
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

      <div className="relative hidden h-56 overflow-hidden px-6 sm:block">
        <div className="absolute top-[112px] right-4 left-[22%] h-px bg-white/[0.06]" />
        <motion.div
          className={cn("absolute top-[112px] h-px", sceneClasses.horizontalBar)}
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
              sceneClasses.packet
            )}
          >
            <p
              className={cn(
                "font-mono text-[8px] font-bold uppercase",
                sceneClasses.label
              )}
            >
              Payment
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-white">
              {amountLabel}
            </p>
          </div>
        </motion.div>
        <div className="relative z-10 flex h-full w-full">
          <AgentActor reasoning={agentReasoning} />
          <div className="flex min-w-0 flex-1 pl-10">
            {settlementGates.map((gate, index) => (
              <GateModule
                key={gate.key}
                state={gateState(
                  index,
                  activeStep,
                  approved,
                  running,
                  rejectedReason
                )}
                icon={gate.icon}
                label={gate.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-4 border-t border-border bg-surface-sunken px-5 py-4 sm:flex">
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
                tone
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
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  )
}
