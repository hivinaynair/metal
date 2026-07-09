import {
  DEMO_POLICY_MAX_AMOUNT_USDC,
  DEMO_REPORT_ROUTES,
  getDemoReportRoute,
  type DemoReportRoute,
} from "@workspace/shared/demo"

export const POLICY_MAX_AMOUNT_USDC = DEMO_POLICY_MAX_AMOUNT_USDC
export const reportRoutes = DEMO_REPORT_ROUTES

export const demoAgents = [
  {
    id: "metal-agent-1",
    label: "Retail",
    mandateLimit: "$1",
    route: "Basic $0.50",
    failsAt: "-",
    outcome: "Approved",
    status: "approved",
    narrative: "Happy path: identity, AP2 mandate, policy, and settlement all pass.",
  },
  {
    id: "metal-agent-2",
    label: "Capped",
    mandateLimit: "$1",
    route: "Premium $5",
    failsAt: "Mandate ($5 > $1)",
    outcome: "mandate_amount_exceeded",
    status: "rejected",
    narrative: "Authorization failure: the agent is real, but the AP2 mandate is too small.",
  },
  {
    id: "metal-agent-3",
    label: "Uncapped",
    mandateLimit: "$10",
    route: "Premium $5",
    failsAt: "Policy ($5 > $2 ceiling)",
    outcome: "policy_amount_exceeded",
    status: "rejected",
    narrative: "Policy failure: the mandate permits it, but the settlement layer ceiling blocks it.",
  },
  {
    id: "metal-agent-ghost",
    label: "Ghost",
    mandateLimit: "none",
    route: "Basic $0.50",
    failsAt: "Identity (not in ERC-8004)",
    outcome: "identity_not_found",
    status: "rejected",
    narrative: "Identity failure: no live ERC-8004 agent identity maps to this payer.",
  },
] as const

export type ReportRouteId = DemoReportRoute["id"]

export function getReportRoute(id: ReportRouteId) {
  return getDemoReportRoute(id)
}
