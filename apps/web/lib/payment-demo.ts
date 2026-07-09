import { demoAgents } from "@/lib/demo-scenarios"
import type { DecisionProof, RawMandate, X402Challenge } from "@workspace/shared/types"

export const SCENARIOS = [
  {
    agentName: "metal-agent-1",
    slot: "A",
    title: "Happy path",
    displayAgent: "metal-agent-1",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
  {
    agentName: "metal-agent-2",
    slot: "B",
    title: "Mandate exceeded",
    displayAgent: "metal-agent-2",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
  {
    agentName: "metal-agent-3",
    slot: "C",
    title: "Policy exceeded",
    displayAgent: "metal-agent-3",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
  {
    agentName: "metal-agent-ghost",
    slot: "D",
    title: "Unregistered agent",
    displayAgent: "metal-agent-ghost",
    packetFrom: "agent wallet pending",
    mandate: "AP2 credential",
  },
] as const

export interface TriggerResult {
  slot: string
  agent: DemoAgent | null
  route: { id: string; path: string; price: string }
  httpStatus: number
  agentKey?: string
  payer?: string
  agentUri?: string
  mandateDelegator?: string
  mandateValid?: boolean
  authorizationNonce?: string
  policyThreshold?: string
  proofLookupError?: string
  settlementTxHash?: string
  settlementTxUrl?: string
  attestationTxHash?: string
  attestationTxUrl?: string
  decisionProof?: DecisionProof
  rawMandate?: RawMandate
  x402Challenge?: X402Challenge
  body?: { error?: string }
}

export type DemoScenario = (typeof SCENARIOS)[number]
export type DemoAgent = (typeof demoAgents)[number]

export function fallbackRouteForAgent(agent: DemoAgent) {
  const premium = agent.route.startsWith("Premium")
  return {
    id: premium ? "premium" : "basic",
    path: premium ? "/api/premium-risk-report" : "/api/settlement-risk-report",
    price: premium ? "$5.00" : "$0.50",
  }
}

export function shortAddress(value?: string) {
  if (!value || !value.startsWith("0x")) return value ?? "pending"
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}
