"use client"

import { useState, useTransition } from "react"

import type { DemoAgent, DemoScenario, TriggerResult } from "./payment-demo"
import { fallbackRouteForAgent } from "./payment-demo"
import { resultFailureStep } from "@/lib/settlement-status"

export function usePaymentRun({
  selectedIndex,
  selectedScenario,
  selectedAgent,
}: {
  selectedIndex: number
  selectedScenario: DemoScenario
  selectedAgent: DemoAgent
}) {
  const [isPending, startTransition] = useTransition()
  const [animStep, setAnimStep] = useState(0)
  const [result, setResult] = useState<TriggerResult | null>(null)
  const [agentReasoning, setAgentReasoning] = useState("")

  const approved = result?.httpStatus === 200
  const activeStep = isPending
    ? animStep
    : result
      ? approved
        ? 6
        : resultFailureStep(result)
      : 0

  function resetRunState() {
    setAnimStep(0)
    setResult(null)
    setAgentReasoning("")
  }

  function runDemo() {
    startTransition(async () => {
      resetRunState()

      try {
        const response = await fetch("/api/trigger-payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioIndex: selectedIndex }),
        })

        if (!response.ok) {
          throw new Error(await response.text())
        }
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
              const event = JSON.parse(line.slice(6)) as {
                type: string
                text?: string
                step?: number
                result?: TriggerResult
              }
              if (event.type === "token" && event.text) {
                setAgentReasoning((prev) => prev + event.text)
              } else if (
                event.type === "gate" &&
                typeof event.step === "number"
              ) {
                setAnimStep(event.step)
              } else if (event.type === "done" && event.result) {
                setResult({ ...event.result, completedAt: new Date().toISOString() })
              }
            } catch {
              /* malformed line */
            }
          }
        }
      } catch (err) {
        setResult({
          slot: selectedScenario.slot,
          agent: selectedAgent,
          route: {
            ...fallbackRouteForAgent(selectedAgent),
            id: "unknown",
            path: "/api/trigger-payment",
          },
          httpStatus: 500,
          body: { error: String(err) },
        })
      }
    })
  }

  return {
    activeStep,
    agentReasoning,
    approved,
    loading: isPending,
    resetRunState,
    result,
    runDemo,
  }
}
