"use client"

import { useMemo, useState } from "react"
import { Copy, ExternalLink, MessageSquareText, Play, Wallet, Zap } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { DashboardPanel } from "@/components/dashboard-panel"
import { DecisionLog } from "@/components/decision-log"
import { GateDetailSheet } from "@/components/gate-detail-sheet"
import { PacketPanel } from "@/components/packet-panel"
import { PageFrame, PageHead } from "@/components/page-chrome"
import { ScenarioPicker } from "@/components/scenario-picker"
import { SettlementScene } from "@/components/settlement-scene"
import { buildTraceSteps } from "@/components/trace-panel"
import type { TraceStep } from "@/components/trace-panel"
import { demoAgents } from "@/lib/demo-scenarios"
import { buildProofBundle } from "@/lib/payment-proof"
import {
  fallbackRouteForAgent,
  SCENARIOS,
  shortAddress,
} from "@/lib/payment-demo"
import { usePaymentRun } from "@/lib/use-payment-run"

export default function Page() {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (typeof window === "undefined") return 0
    const requestedScenario = Number(
      new URLSearchParams(window.location.search).get("scenario") ?? 0
    )
    return Number.isInteger(requestedScenario)
      ? Math.min(Math.max(requestedScenario, 0), SCENARIOS.length - 1)
      : 0
  })
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")
  const [activeGateStep, setActiveGateStep] = useState<TraceStep | null>(null)

  const selectedScenario = SCENARIOS[selectedIndex]!
  const selectedAgent = demoAgents.find(
    (agent) => agent.id === selectedScenario.agentName
  )!
  const {
    activeStep,
    agentReasoning,
    approved,
    loading,
    resetRunState,
    result,
    runDemo,
  } = usePaymentRun({ selectedIndex, selectedScenario, selectedAgent })
  const error = result?.body?.error

  const proofBundle = useMemo(
    () => buildProofBundle(result, selectedAgent),
    [result, selectedAgent]
  )

  async function copyProof() {
    await navigator.clipboard.writeText(proofBundle)
    setCopyState("copied")
    window.setTimeout(() => setCopyState("idle"), 1500)
  }

  async function startRun() {
    setCopyState("idle")
    await runDemo()
  }

  return (
    <PageFrame>
      <PageHead
        eyebrow="The Bare-Metal rail"
        title="Compliance before settlement"
      />

      <ScenarioPicker
        selectedIndex={selectedIndex}
        loading={loading}
        onSelect={(index) => {
          if (loading) return
          setSelectedIndex(index)
          resetRunState()
          setCopyState("idle")
        }}
      />

      <div className="sm:overflow-x-auto">
        <SettlementScene
          agentLabel={selectedScenario.displayAgent}
          agentStatus={
            selectedAgent.status === "approved"
              ? "Trusted"
              : selectedScenario.title
          }
          agentReasoning={agentReasoning}
          amountLabel={
            result?.route.price ?? fallbackRouteForAgent(selectedAgent).price
          }
          routeLabel={
            result?.route.path ?? fallbackRouteForAgent(selectedAgent).path
          }
          mandateLimit={selectedAgent.mandateLimit}
          activeStep={activeStep}
          running={loading}
          approved={Boolean(approved)}
          rejectedReason={error}
          settlementTx={result?.settlementTxUrl}
          attestationTx={result?.attestationTxUrl}
          action={
            <Button
              size="sm"
              onClick={startRun}
              disabled={loading}
              className="h-8 border border-foreground bg-foreground px-3 text-xs text-background hover:bg-foreground/85"
            >
              {loading ? (
                <>
                  <Zap className="h-3 w-3 animate-pulse" />
                  Running
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Run payment
                </>
              )}
            </Button>
          }
        />
      </div>

      <GateDetailSheet step={activeGateStep} onClose={() => setActiveGateStep(null)} />

      <section className="grid min-w-0 grid-cols-1 items-stretch gap-4 pb-1 lg:grid-cols-[minmax(360px,1.05fr)_minmax(420px,1fr)_320px] lg:overflow-x-auto">
        <DashboardPanel
          title="Decision log"
          icon={<MessageSquareText className="size-4" />}
        >
          <DecisionLog
            result={result}
            running={loading}
            activeStep={activeStep}
            selectedAgent={selectedAgent}
            selectedScenario={selectedScenario}
            traceSteps={buildTraceSteps(result, activeStep)}
            onStepClick={setActiveGateStep}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Proof / evidence"
          icon={<Wallet className="size-4" />}
          action={
            <div className="flex gap-2">
              {result?.settlementTxUrl && (
                <a
                  href={result.settlementTxUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-input text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  Basescan
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={copyProof}
                disabled={!result}
                className="h-10 text-muted-foreground"
              >
                <Copy className="h-4 w-4" />
                {copyState === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
          }
        >
          {result ? (
            <pre className="font-mono text-xs leading-6 break-words whitespace-pre-wrap text-foreground/80">
              {proofBundle}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Portable decision evidence appears here after a run.
            </p>
          )}
        </DashboardPanel>

        <DashboardPanel title="Packet" icon={<Wallet className="size-4" />}>
          <PacketPanel
            amount={
              result?.route.price ?? fallbackRouteForAgent(selectedAgent).price
            }
            from={
              result?.payer
                ? shortAddress(result.payer)
                : selectedScenario.packetFrom
            }
            mandate={selectedScenario.mandate}
            policy="pol_9f8a…d21b"
          />
        </DashboardPanel>
      </section>
    </PageFrame>
  )
}
