"use client"

import { useMemo, useState } from "react"
import { Copy, MessageSquareText, Play, Wallet, Zap } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { DashboardPanel } from "@/components/dashboard-panel"
import { DecisionLog } from "@/components/decision-log"
import { PacketPanel } from "@/components/packet-panel"
import { PageFrame, PageHead } from "@/components/page-chrome"
import { ScenarioPicker } from "@/components/scenario-picker"
import { SettlementScene } from "@/components/settlement-scene"
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

  const selectedScenario = SCENARIOS[selectedIndex]!
  const selectedAgent = demoAgents.find(
    (agent) => agent.id === selectedScenario.agentId
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

      <div className="overflow-x-auto">
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
              size="lg"
              onClick={startRun}
              disabled={loading}
              className="border border-foreground bg-foreground text-background hover:bg-foreground/85"
            >
              {loading ? (
                <>
                  <Zap className="h-4 w-4 animate-pulse" />
                  Running
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run payment
                </>
              )}
            </Button>
          }
        />
      </div>

      <section className="grid min-w-0 items-stretch gap-4 overflow-x-auto pb-1 lg:grid-cols-[minmax(360px,1.05fr)_minmax(420px,1fr)_320px]">
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
          />
        </DashboardPanel>

        <DashboardPanel
          title="Proof / evidence"
          icon={<Wallet className="size-4" />}
          action={
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
          }
        >
          {result ? (
            <pre className="font-mono text-xs leading-6 break-words whitespace-pre-wrap text-foreground/80">
              {proofBundle}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Portable, on-chain-anchored evidence appears here after a run.
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
