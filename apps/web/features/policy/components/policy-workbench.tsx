"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { PolicyConfigPanel } from "./policy-config-panel"
import { PolicyProofPanel } from "./policy-proof-panel"
import { PolicyTestPanel } from "./policy-test-panel"
import { PolicyJson, cn } from "./policy-workbench-shared"
import {
  clampPolicyMax,
  evaluatePolicy,
  type EvaluationResult,
  type PolicyAgent,
  type PolicyProofRun,
  type PolicyResource,
} from "../lib/policy-evaluation"

export type { PolicyAgent, PolicyProofRun, PolicyResource }

export function PolicyWorkbench({
  agents,
  resources,
  initialMaxAmountUsdc,
  proofRun,
}: {
  agents: PolicyAgent[]
  resources: PolicyResource[]
  initialMaxAmountUsdc: number
  proofRun: PolicyProofRun | null
}) {
  const [maxAmountUsdc, setMaxAmountUsdc] = useState(initialMaxAmountUsdc)
  const [agentAddress, setAgentAddress] = useState(agents[0]?.address ?? "")
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "")
  const [amount, setAmount] = useState(
    (resources[0]?.price ?? initialMaxAmountUsdc).toFixed(2)
  )
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  )

  const selectedAgent = agents.find((agent) => agent.address === agentAddress)
  const selectedResource = resources.find(
    (resource) => resource.id === resourceId
  )

  const railScenarioIndex =
    selectedResource?.id === "premium"
      ? selectedAgent?.maxAmountUsdc &&
        selectedAgent.maxAmountUsdc >= maxAmountUsdc
        ? 2
        : 1
      : 0

  function setMax(value: number) {
    setMaxAmountUsdc(clampPolicyMax(value))
    setResult(null)
  }

  async function savePolicy() {
    setSaveState("saving")
    try {
      await fetch("/api/policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxAmountUsdc }),
      })
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch {
      setSaveState("idle")
    }
  }

  function evaluate() {
    if (!selectedAgent) return
    setResult(
      evaluatePolicy({
        agent: selectedAgent,
        amount,
        maxAmountUsdc,
      })
    )
  }

  function changeAgent(value: string) {
    setAgentAddress(value)
    setResult(null)
  }

  function changeResource(value: string) {
    setResourceId(value)
    const resource = resources.find((item) => item.id === value)
    if (resource) setAmount(resource.price.toFixed(2))
    setResult(null)
  }

  function changeAmount(value: string) {
    setAmount(value)
    setResult(null)
  }

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-2">
        <PolicyConfigPanel
          maxAmountUsdc={maxAmountUsdc}
          saveState={saveState}
          onSetMax={setMax}
          onSavePolicy={savePolicy}
        />

        <div className="grid h-fit gap-4">
          <PolicyTestPanel
            agents={agents}
            resources={resources}
            selectedAgent={selectedAgent}
            selectedResource={selectedResource}
            agentAddress={agentAddress}
            resourceId={resourceId}
            amount={amount}
            result={result}
            railScenarioIndex={railScenarioIndex}
            onAgentChange={changeAgent}
            onResourceChange={changeResource}
            onAmountChange={changeAmount}
            onEvaluate={evaluate}
          />

          <div>
            <Button
              variant="outline"
              onClick={() => setShowJson((value) => !value)}
              className="font-mono text-text-secondary"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  showJson && "rotate-90"
                )}
              />
              View policy.json
            </Button>
            {showJson ? <PolicyJson maxAmountUsdc={maxAmountUsdc} /> : null}
          </div>
        </div>
      </section>

      <PolicyProofPanel proofRun={proofRun} />
    </>
  )
}
