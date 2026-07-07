"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { Copy, Play, Wallet, Zap } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { PageFrame, PageHead } from "@/components/page-chrome"
import { TracePanel, buildTraceSteps } from "@/components/trace-panel"
import { SettlementScene } from "@/components/settlement-scene"
import { demoAgents } from "@/lib/demo-scenarios"

const SCENARIOS = [
  { agentId: "metal-agent-1", slot: "A", title: "Happy path", displayAgent: "Orion Pay", packetFrom: "0x9F21...Ae21", mandate: "ap2_9F21...Ae21" },
  { agentId: "metal-agent-2", slot: "B", title: "Mandate exceeded", displayAgent: "Atlas Treasury", packetFrom: "0xC4b8...A1F0", mandate: "ap2_C4b8...A1F0" },
  { agentId: "metal-agent-3", slot: "C", title: "Policy exceeded", displayAgent: "Nova Fetch", packetFrom: "0x3af5...Ab12", mandate: "ap2_3af5...Ab12" },
  { agentId: "metal-agent-ghost", slot: "D", title: "Unregistered agent", displayAgent: "Ghost Runner", packetFrom: "0x62c1...Gh09", mandate: "ap2_none" },
  { agentId: "metal-agent-2", slot: "E", title: "Expired mandate", displayAgent: "Vega Scheduler", packetFrom: "0x8d0e...Vg1a", mandate: "ap2_8d0e...Vg1a", disabled: true },
]

interface TriggerResult {
  slot: string
  agent: (typeof demoAgents)[number] | null
  route: { id: string; path: string; price: string }
  httpStatus: number
  agentKey?: string
  payer?: string
  agentUri?: string
  mandateDelegator?: string
  mandateValid?: boolean
  policyThreshold?: string
  settlementTxHash?: string
  settlementTxUrl?: string
  attestationTxHash?: string
  attestationTxUrl?: string
  body?: { error?: string }
}

function shortAddress(value?: string) {
  if (!value || !value.startsWith("0x")) return value ?? "pending"
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function failureStep(error?: string) {
  if (error === "identity_not_found") return 2
  if (error === "mandate_amount_exceeded") return 3
  if (error === "policy_amount_exceeded") return 4
  return 4
}

function cleanRejectionReason(error?: string | null) {
  if (!error) return null
  const trimmed = error.trim()
  if (/^(<!doctype html|<html)/i.test(trimmed)) {
    const title = trimmed.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]
      ?.replace(/\s+/g, " ")
      .trim()
    return title ? `Upstream returned HTML: ${title}` : "Upstream returned an HTML error page"
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed
}

export default function Page() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [animStep, setAnimStep] = useState(0)
  const [result, setResult] = useState<TriggerResult | null>(null)
  const [agentReasoning, setAgentReasoning] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")

  const selectedScenario = SCENARIOS[selectedIndex]!
  const selectedAgent = demoAgents.find((agent) => agent.id === selectedScenario.agentId)!
  const error = result?.body?.error
  const approved = result?.httpStatus === 200
  const activeStep = loading ? animStep : result ? (approved ? 6 : failureStep(error)) : 0

  async function runDemo() {
    setAnimStep(0)
    setResult(null)
    setAgentReasoning("")
    setCopyState("idle")
    setLoading(true)

    try {
      const response = await fetch("/api/trigger-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioIndex: selectedIndex }),
      })

      if (!response.body) throw new Error("No response stream")

      const reader = response.body.getReader()
      const dec = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; text?: string; step?: number; result?: TriggerResult }
            if (event.type === "token" && event.text) {
              setAgentReasoning((prev) => prev + event.text)
            } else if (event.type === "gate" && typeof event.step === "number") {
              setAnimStep(event.step)
            } else if (event.type === "done" && event.result) {
              setResult(event.result)
              setLoading(false)
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (err) {
      setResult({
        slot: selectedScenario.slot,
        agent: selectedAgent,
        route: { id: "unknown", path: "/api/trigger-payment", price: selectedAgent.route.includes("$5") ? "$5.00" : "$0.01" },
        httpStatus: 500,
        body: { error: String(err) },
      })
    } finally {
      setLoading(false)
    }
  }

  const traceSteps = buildTraceSteps(result, loading ? animStep : 0)
  const proofBundle = useMemo(() => {
    const agent = result?.agent ?? selectedAgent
    const route = result?.route ?? {
      id: selectedAgent.route.startsWith("Premium") ? "premium" : "basic",
      path: selectedAgent.route.startsWith("Premium") ? "/api/premium-risk-report" : "/api/settlement-risk-report",
      price: selectedAgent.route.includes("$5") ? "$5.00" : "$0.01",
    }

    return JSON.stringify(
      {
        agentId: agent.id,
        payer: result?.payer ?? "pending run",
        agentURI: result?.agentUri ?? "pending run",
        route: route.path,
        amount: route.price,
        mandateLimit: agent.mandateLimit,
        mandateDelegator: result?.mandateDelegator ?? "pending run",
        mandateValid: result?.mandateValid ?? null,
        policyThreshold: result?.policyThreshold ?? "$2",
        policyDecision: result ? (result.httpStatus === 200 ? "approved" : "rejected") : "not run",
        rejectionReason: cleanRejectionReason(result?.body?.error),
        settlementTxHash: result?.settlementTxHash ?? null,
        settlementTxUrl: result?.settlementTxUrl ?? null,
        attestationTxHash: result?.attestationTxHash ?? null,
        attestationTxUrl: result?.attestationTxUrl ?? null,
      },
      null,
      2,
    )
  }, [result, selectedAgent])

  async function copyProof() {
    await navigator.clipboard.writeText(proofBundle)
    setCopyState("copied")
    window.setTimeout(() => setCopyState("idle"), 1500)
  }

  return (
    <PageFrame>
      <PageHead
        eyebrow="The live rail"
        title="Compliance before settlement"
        question="Send a payment through the rail. Each gate approves, blocks, or skips — a rejected flow physically stops before it can settle."
        right={<TopStatus />}
      />

      <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1">
        <span className="metal-eyebrow px-2">Scenario</span>
        {SCENARIOS.map((scenario, index) => {
          const agent = demoAgents.find((a) => a.id === scenario.agentId)!
          const selected = index === selectedIndex
          return (
            <button
              key={scenario.slot}
              disabled={loading || scenario.disabled}
              onClick={() => {
                if (loading || scenario.disabled) return
                setSelectedIndex(index)
                setResult(null)
                setAgentReasoning("")
                setCopyState("idle")
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium transition",
                selected
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
                scenario.disabled && "cursor-not-allowed opacity-55 hover:text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full bg-muted-foreground",
                  selected && agent.status === "approved" && "bg-emerald-400",
                  selected && agent.status !== "approved" && "bg-destructive"
                )}
              />
              {scenario.title}
            </button>
          )
        })}
      </div>

      <SettlementScene
        agentLabel={selectedScenario.displayAgent}
        agentReasoning={agentReasoning}
        amountLabel={result?.route.price ?? (selectedAgent.route.includes("$5") ? "$5.00" : "$0.01")}
        routeLabel={result?.route.path ?? (selectedAgent.route.startsWith("Premium") ? "/api/premium-risk-report" : "/api/settlement-risk-report")}
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
            onClick={runDemo}
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

      <section className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[1.05fr_1fr_0.82fr]">
        <Panel title="Technical trace" icon={<Zap className="size-4" />}>
          <TracePanel steps={traceSteps} />
        </Panel>

        <Panel
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
            <pre className="h-full min-h-0 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-foreground/80">
              {proofBundle}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Portable, on-chain-anchored evidence appears here after a run.
            </p>
          )}
        </Panel>

        <Panel title="Packet" icon={<Wallet className="size-4" />}>
          <PacketPanel
            amount={result?.route.price ?? (selectedAgent.route.includes("$5") ? "$5.00" : "$0.01")}
            from={result?.payer ? shortAddress(result.payer) : selectedScenario.packetFrom}
            mandate={selectedScenario.mandate}
            policy="pol_9f8a…d21b"
          />
        </Panel>
      </section>
    </PageFrame>
  )
}

function TopStatus() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex overflow-hidden rounded-md border border-border bg-card">
        <div className="border-r border-border px-4 py-2">
          <p className="metal-eyebrow">Network</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Base Sepolia
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="metal-eyebrow">Environment</p>
          <p className="mt-1 text-sm font-semibold">Testnet</p>
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="metal-card flex min-h-80 flex-col rounded-md p-0">
      <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="min-h-0 flex-1 p-5">{children}</div>
    </section>
  )
}

function PacketPanel({
  amount,
  from,
  mandate,
  policy,
}: {
  amount: string
  from: string
  mandate: string
  policy: string
}) {
  const rows = [
    ["Amount", `${amount.replace("$", "")} USDC`],
    ["From", from],
    ["To", "0xMetal…9E21"],
    ["Mandate", mandate],
    ["Policy", policy],
    ["Created", "14:23:10.912Z"],
  ]

  return (
    <div className="grid">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-4 py-3 text-sm",
            index < rows.length - 1 && "border-b border-border"
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="text-right font-mono text-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}
