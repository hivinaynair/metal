export const POLICY_MAX_AMOUNT_USDC = 2

export const reportRoutes = [
  {
    id: "basic",
    path: "/api/settlement-risk-report",
    priceLabel: "$0.01",
    price: "$0.01",
    amountAtomic: "10000",
    title: "Settlement Risk Report",
    riskLevel: "MEDIUM",
    recommendation: "Reduce exposure by 20% before settlement window.",
  },
  {
    id: "premium",
    path: "/api/premium-risk-report",
    priceLabel: "$5.00",
    price: "$5.00",
    amountAtomic: "5000000",
    title: "Premium Risk Report",
    riskLevel: "HIGH",
    recommendation: "Pause settlement and require human approval.",
  },
] as const

export const demoAgents = [
  {
    id: "metal-agent-1",
    label: "Retail",
    mandateLimit: "$1",
    route: "Basic $0.01",
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
    route: "Basic $0.01",
    failsAt: "Identity (not in ERC-8004)",
    outcome: "identity_not_found",
    status: "rejected",
    narrative: "Identity failure: no live ERC-8004 agent identity maps to this payer.",
  },
] as const

export type ReportRouteId = (typeof reportRoutes)[number]["id"]

export function getReportRoute(id: ReportRouteId) {
  return reportRoutes.find((route) => route.id === id) ?? reportRoutes[0]
}
