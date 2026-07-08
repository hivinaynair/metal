import { AgentId, type ReportRouteId } from "./types.js"

export const DEMO_POLICY_MAX_AMOUNT_USDC = 2

export const DEMO_SCENARIO_AGENTS = [
  AgentId.AGENT_1,
  AgentId.AGENT_2,
  AgentId.AGENT_3,
  AgentId.GHOST,
] as const

export const DEMO_REPORT_ROUTES = [
  {
    id: "basic",
    path: "/api/settlement-risk-report",
    priceLabel: "$0.50",
    price: "$0.50",
    amountAtomic: "500000",
    title: "Settlement Risk Report",
    riskLevel: "MEDIUM",
    recommendation: "Reduce exposure by 20% before settlement window.",
  },
  {
    id: "premium",
    path: "/api/premium-risk-report",
    priceLabel: "$2.00",
    price: "$2.00",
    amountAtomic: "2000000",
    title: "Premium Risk Report",
    riskLevel: "HIGH",
    recommendation: "Pause settlement and require human approval.",
  },
] as const

export const DEMO_AGENT_ROUTE: Record<AgentId, ReportRouteId> = {
  [AgentId.AGENT_1]: "basic",
  [AgentId.AGENT_2]: "premium",
  [AgentId.AGENT_3]: "premium",
  [AgentId.GHOST]: "basic",
}

export type DemoReportRoute = (typeof DEMO_REPORT_ROUTES)[number]

export function getDemoReportRoute(id: ReportRouteId) {
  return DEMO_REPORT_ROUTES.find((route) => route.id === id) ?? DEMO_REPORT_ROUTES[0]
}

export function getDemoReportRouteByPath(path: string) {
  return DEMO_REPORT_ROUTES.find((route) => route.path === path)
}

export type FailureGate = "identity" | "mandate" | "policy" | "settlement" | "attestation"

export function failureGateForReason(reason?: string): FailureGate | undefined {
  if (!reason) return undefined
  if (reason === "identity_not_found") return "identity"
  if (reason.startsWith("mandate_")) return "mandate"
  if (reason.startsWith("policy_")) return "policy"
  return "settlement"
}

