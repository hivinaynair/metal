"use client"

import { useState } from "react"

import type { DemoAgent, DemoScenario, TriggerResult } from "@/lib/payment-demo"
import { fallbackRouteForAgent } from "@/lib/payment-demo"
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
  const [loading, setLoading] = useState(false)
  const [animStep, setAnimStep] = useState(0)
  const [result, setResult] = useState<TriggerResult | null>(null)
  const [agentReasoning, setAgentReasoning] = useState("")

  const approved = result?.httpStatus === 200
  const activeStep = loading
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

  async function runDemo() {
    resetRunState()
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
              setResult(event.result)
              setLoading(false)
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
    } finally {
      setLoading(false)
    }
  }

  return {
    activeStep,
    agentReasoning,
    approved,
    loading,
    resetRunState,
    result,
    runDemo,
  }
}
