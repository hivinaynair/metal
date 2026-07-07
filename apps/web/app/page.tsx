"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Copy, Play } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import { TracePanel, buildTraceSteps, TRACE_STEP_COUNT } from "@/components/trace-panel"
import { SettlementScene } from "@/components/settlement-scene"
import { demoAgents } from "@/lib/demo-scenarios"

const SCENARIOS = [
  { agentId: "metal-agent-1", slot: "A", title: "Happy Path" },
  { agentId: "metal-agent-2", slot: "B", title: "Mandate Exceeded" },
  { agentId: "metal-agent-3", slot: "C", title: "Policy Exceeded" },
  { agentId: "metal-agent-ghost", slot: "D", title: "Unregistered Agent" },
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
  txHash?: string
  settlementTx?: string
  attestationTx?: string
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
  return error ? 4 : 0
}

export default function Page() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [animStep, setAnimStep] = useState(0)
  const [result, setResult] = useState<TriggerResult | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedScenario = SCENARIOS[selectedIndex]!
  const selectedAgent = demoAgents.find((agent) => agent.id === selectedScenario.agentId)!
  const error = result?.body?.error
  const approved = result?.httpStatus === 200
  const activeStep = loading ? animStep : result ? (approved ? 6 : failureStep(error)) : 0

  function startAnim() {
    setAnimStep(1)
    let step = 1
    animRef.current = setInterval(() => {
      step++
      if (step > TRACE_STEP_COUNT) {
        clearInterval(animRef.current!)
        return
      }
      setAnimStep(step)
    }, 760)
  }

  function stopAnim() {
    if (animRef.current) clearInterval(animRef.current)
  }

  useEffect(() => () => stopAnim(), [])

  async function runDemo() {
    stopAnim()
    setResult(null)
    setCopyState("idle")
    setLoading(true)
    startAnim()

    try {
      const response = await fetch("/api/trigger-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioIndex: selectedIndex }),
      })
      const data: TriggerResult = await response.json()
      stopAnim()
      setResult(data)
    } catch (err) {
      stopAnim()
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
        rejectionReason: result?.body?.error ?? null,
        settlementTxHash: result?.txHash ?? null,
        settlementTxUrl: result?.settlementTx ?? null,
        attestationTxUrl: result?.attestationTx ?? null,
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
    <main className="dark min-h-[calc(100vh-57px)] overflow-x-hidden bg-[#050706] text-white">
      <div className="mx-4 box-border flex w-[calc(100vw-2rem)] min-w-0 max-w-7xl flex-col gap-6 py-5 sm:mx-6 sm:w-[calc(100vw-3rem)] lg:mx-auto lg:w-full lg:px-8">
        <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs text-teal-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_12px_rgba(94,234,212,0.9)]" />
                  Base Sepolia settlement demo
                </div>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Metal Demo</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/58">
                  A live 402 payment moving through identity, authorization, policy, settlement, and attestation gates.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={runDemo}
                  disabled={loading}
                  className="border border-teal-200/30 bg-teal-200 text-[#04110f] hover:bg-teal-100"
                >
                  <Play className="h-4 w-4" />
                  {loading ? "Running" : "Run Demo"}
                </Button>
                <Link
                  href="/feed"
                  className="inline-flex h-10 items-center justify-center gap-1.5 border border-white/15 bg-white/[0.04] px-6 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  Feed
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              {SCENARIOS.map((scenario, index) => {
                const agent = demoAgents.find((a) => a.id === scenario.agentId)!
                const selected = index === selectedIndex
                return (
                  <button
                    key={scenario.agentId}
                    onClick={() => {
                      if (loading) return
                      setSelectedIndex(index)
                      setResult(null)
                      setCopyState("idle")
                    }}
                    className={`min-w-0 overflow-hidden rounded-lg border p-3 text-left transition ${
                      selected
                        ? "border-teal-300/60 bg-teal-300/12 shadow-[0_0_28px_rgba(45,212,191,0.14)]"
                        : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-white/45">Slot {scenario.slot}</span>
                      <Badge
                        variant={agent.status === "approved" ? "outline" : "destructive"}
                        className={`hidden text-[10px] sm:inline-flex ${agent.status === "approved" ? "border-teal-300/40 bg-teal-300/10 text-teal-100" : "border-red-400/50 bg-red-500/15 text-red-100"}`}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{scenario.title}</p>
                    <p className="mt-1 text-xs text-white/45">{agent.failsAt === "-" ? "All gates open" : agent.failsAt}</p>
                  </button>
                )
              })}
            </div>

            <SettlementScene
              agentLabel={selectedAgent.id}
              amountLabel={result?.route.price ?? (selectedAgent.route.includes("$5") ? "$5.00" : "$0.01")}
              routeLabel={result?.route.path ?? (selectedAgent.route.startsWith("Premium") ? "/api/premium-risk-report" : "/api/settlement-risk-report")}
              mandateLimit={selectedAgent.mandateLimit}
              failAt={selectedAgent.failsAt}
              activeStep={activeStep}
              running={loading}
              approved={Boolean(approved)}
              rejectedReason={error}
              settlementTx={result?.settlementTx}
              attestationTx={result?.attestationTx}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Agent Statement</p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                I am <span className="font-mono text-teal-100">{selectedAgent.id}</span>. I have a mandate authorizing up to{" "}
                <span className="font-mono text-white">{selectedAgent.mandateLimit}</span>. This request costs{" "}
                <span className="font-mono text-white">{selectedAgent.route.split(" ")[1]}</span>.
              </p>
              <Separator className="my-4 bg-white/10" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-white/40">Payer</p>
                  <p className="mt-1 font-mono text-white">{shortAddress(result?.payer)}</p>
                </div>
                <div>
                  <p className="text-white/40">Delegator</p>
                  <p className="mt-1 font-mono text-white">{shortAddress(result?.mandateDelegator)}</p>
                </div>
                <div>
                  <p className="text-white/40">Policy</p>
                  <p className="mt-1 font-mono text-white">{result?.policyThreshold ?? "$2"} ceiling</p>
                </div>
                <div>
                  <p className="text-white/40">Decision</p>
                  <p className="mt-1 font-mono text-white">
                    {loading ? "running" : result ? (approved ? "approved" : "rejected") : "ready"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-white/40">Trace</p>
                {result && (
                  <Badge
                    variant={approved ? "outline" : "destructive"}
                    className={approved ? "border-teal-300/40 bg-teal-300/10 text-teal-100" : "border-red-400/50 bg-red-500/15 text-red-100"}
                  >
                    {approved ? "approved" : "blocked"}
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <TracePanel steps={traceSteps} />
              </div>
            </section>
          </aside>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40">Proof Bundle</p>
                <p className="mt-1 text-sm text-white/55">Copyable evidence package for the selected run.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyProof}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Copy className="h-4 w-4" />
                {copyState === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-black/35 p-4 text-xs text-teal-50/82">
              {proofBundle}
            </pre>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-wide text-white/40">Demo Readout</p>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                <p className="text-white/45">Thesis</p>
                <p className="mt-1 text-white/78">Compliance decisions execute before settlement, not after.</p>
              </div>
              <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                <p className="text-white/45">Failure copy</p>
                <p className="mt-1 text-white/78">Blocked before funds moved.</p>
              </div>
              <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                <p className="text-white/45">Primitive stack</p>
                <p className="mt-1 font-mono text-xs text-white/72">x402 / ERC-8004 / AP2 / Policy / Attestation</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
