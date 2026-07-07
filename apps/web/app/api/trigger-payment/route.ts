import { NextResponse } from "next/server"
import { ExactEvmScheme } from "@x402/evm"
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch"
import { privateKeyToAccount } from "viem/accounts"
import { BASE_SEPOLIA_CAIP2, BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { initAgents, getMandateHeader } from "@/lib/init-agents"
import { reportRoutes, demoAgents, POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import { env } from "@/env"

// Slot order: A(agent1+basic) → B(agent2+premium) → C(agent3+premium) → D(ghost+basic)
const SCENARIOS = [
  { agentKey: "agent1" as const, routeId: "basic"   as const },
  { agentKey: "agent2" as const, routeId: "premium" as const },
  { agentKey: "agent3" as const, routeId: "premium" as const },
  { agentKey: "ghost"  as const, routeId: "basic"   as const },
] as const

let cycle = 0

export async function POST(request: Request) {
  const agents = await initAgents()

  let requestedIndex: number | undefined
  try {
    const body = await request.json() as { scenarioIndex?: unknown }
    if (typeof body.scenarioIndex === "number" && Number.isInteger(body.scenarioIndex)) {
      requestedIndex = body.scenarioIndex
    }
  } catch {
    // Empty body keeps the original cycle behavior for callers that do not select a scenario.
  }

  const scenarioIndex = requestedIndex !== undefined
    ? Math.min(Math.max(requestedIndex, 0), SCENARIOS.length - 1)
    : cycle % SCENARIOS.length
  if (requestedIndex === undefined) cycle++

  const scenario = SCENARIOS[scenarioIndex]!
  const account = agents[scenario.agentKey]
  const route = reportRoutes.find((r) => r.id === scenario.routeId)!
  // Map agentKey to demoAgents id — e.g. "agent1" -> "metal-agent-1", "ghost" -> "metal-agent-ghost"
  const agentId = scenario.agentKey === "ghost"
    ? "metal-agent-ghost"
    : `metal-agent-${scenario.agentKey.replace("agent", "")}`
  const demoAgent = demoAgents.find((a) => a.id === agentId)
  const url = `${env.APP_URL}${route.path}`
  const delegator = privateKeyToAccount(env.DELEGATOR_PRIVATE_KEY as `0x${string}`)

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: BASE_SEPOLIA_CAIP2,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: new ExactEvmScheme(account as any),
      },
    ],
  })

  const mandateJson = getMandateHeader(account.address)

  let txHash: string | undefined
  let settlementTx: string | undefined
  let responseBody: unknown
  let httpStatus: number

  try {
    const response = await fetchWithPayment(
      url,
      mandateJson ? { headers: { "X-AP2-Mandate": mandateJson } } : undefined,
    )
    httpStatus = response.status

    const paymentHeader = response.headers.get("PAYMENT-RESPONSE")
    if (paymentHeader) {
      const decoded = decodePaymentResponseHeader(paymentHeader) as Record<string, unknown>
      txHash = (decoded.transaction as string | undefined) ?? (decoded.txHash as string | undefined)
      if (txHash) settlementTx = `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}`
    }

    responseBody = await response.json()
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const responseError = responseBody && typeof responseBody === "object" && "error" in responseBody
    ? String((responseBody as { error?: unknown }).error)
    : undefined
  const mandateValid = Boolean(
    demoAgent?.mandateLimit !== "none" &&
      responseError !== "mandate_not_registered" &&
      responseError !== "mandate_signature_invalid" &&
      responseError !== "mandate_expired" &&
      responseError !== "mandate_amount_exceeded",
  )

  return NextResponse.json({
    slot: ["A", "B", "C", "D"][scenarioIndex],
    agentKey: scenario.agentKey,
    agent: demoAgent,
    route: { id: route.id, path: route.path, price: route.priceLabel },
    httpStatus,
    payer: account.address,
    agentUri: `${env.APP_URL}/api/agent/${account.address}`,
    mandateDelegator: demoAgent?.mandateLimit === "none" ? undefined : delegator.address,
    mandateValid,
    policyThreshold: `$${POLICY_MAX_AMOUNT_USDC}`,
    txHash,
    settlementTx,
    body: responseBody,
  })
}
