import { demoAgents } from "@/lib/demo-scenarios"
import type { DecisionProof } from "@workspace/shared/types"

export const SCENARIOS = [
  {
    agentId: "metal-agent-1",
    slot: "A",
    title: "Happy path",
    displayAgent: "Orion Pay",
    packetFrom: "0x9F21...Ae21",
    mandate: "ap2_9F21...Ae21",
  },
  {
    agentId: "metal-agent-2",
    slot: "B",
    title: "Mandate exceeded",
    displayAgent: "Atlas Treasury",
    packetFrom: "0xC4b8...A1F0",
    mandate: "ap2_C4b8...A1F0",
  },
  {
    agentId: "metal-agent-3",
    slot: "C",
    title: "Policy exceeded",
    displayAgent: "Nova Fetch",
    packetFrom: "0x3af5...Ab12",
    mandate: "ap2_3af5...Ab12",
  },
  {
    agentId: "metal-agent-ghost",
    slot: "D",
    title: "Unregistered agent",
    displayAgent: "Ghost Runner",
    packetFrom: "0x62c1...Gh09",
    mandate: "ap2_none",
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
  body?: { error?: string }
}

export type DemoScenario = (typeof SCENARIOS)[number]
export type DemoAgent = (typeof demoAgents)[number]

export function fallbackRouteForAgent(agent: DemoAgent) {
  const premium = agent.route.startsWith("Premium")
  return {
    id: premium ? "premium" : "basic",
    path: premium ? "/api/premium-risk-report" : "/api/settlement-risk-report",
    price: agent.route.includes("$5") ? "$5.00" : "$0.50",
  }
}

export function shortAddress(value?: string) {
  if (!value || !value.startsWith("0x")) return value ?? "pending"
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}
