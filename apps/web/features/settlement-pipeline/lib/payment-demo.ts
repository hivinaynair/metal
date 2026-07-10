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
  completedAt?: string
  body?: { error?: string }
}

export type DemoScenario = (typeof SCENARIOS)[number]
export type DemoAgent = (typeof demoAgents)[number]

const FALLBACK_ROUTES = {
  premium: { id: "premium", path: "/api/premium-risk-report", price: "$5.00" },
  basic: { id: "basic", path: "/api/settlement-risk-report", price: "$0.20" },
} as const

export function fallbackRouteForAgent(agent: DemoAgent) {
  return FALLBACK_ROUTES[agent.route.startsWith("Premium") ? "premium" : "basic"]
}
