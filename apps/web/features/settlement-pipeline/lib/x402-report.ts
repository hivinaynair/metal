import { NextResponse, type NextRequest } from "next/server"
import { withX402, x402ResourceServer } from "@x402/next"
import { HTTPFacilitatorClient } from "@x402/core/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { env } from "@/env"
import { getReportRoute, type ReportRouteId } from "@/lib/demo-scenarios"

function makeMandateClient(url: string, mandateJson: string | undefined) {
  if (!mandateJson) return new HTTPFacilitatorClient({ url })

  return new HTTPFacilitatorClient({
    url,
    createAuthHeaders: async () => ({
      verify: { "X-AP2-Mandate": mandateJson },
      settle: { "X-AP2-Mandate": mandateJson },
      supported: {},
    }),
  })
}

const ROUTE_REPORT_DATA: Record<string, { exposureUsd: number; riskScore: number; factors: string[] }> = {
  premium: {
    exposureUsd: 875000,
    riskScore: 0.91,
    factors: ["Cross-border exposure", "Thin liquidity", "Sanctions review required"],
  },
  basic: {
    exposureUsd: 142500,
    riskScore: 0.67,
    factors: ["High leverage", "Concentrated position", "Sector correlation"],
  },
}

export function createRiskReportHandler(routeId: ReportRouteId) {
  const route = getReportRoute(routeId)

  const routeConfig = {
    accepts: {
      scheme: "exact",
      price: route.price,
      network: "eip155:84532" as `${string}:${string}`,
      payTo: env.PAY_TO_ADDRESS,
    },
    description: `${route.title} - ${route.priceLabel} per request`,
  }

  const innerHandler = async () => {
    const reportData = ROUTE_REPORT_DATA[route.id] ?? ROUTE_REPORT_DATA.basic
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      report: route.title,
      counterparty: "Acme Settlement Corp",
      ...reportData,
      riskLevel: route.riskLevel,
      recommendation: route.recommendation,
    })
  }

  // Return a per-request handler so each call uses the mandate from that request.
  return async (request: NextRequest) => {
    try {
      const mandateJson = request.headers.get("X-AP2-Mandate") ?? undefined
      const facilitator = makeMandateClient(env.FACILITATOR_URL, mandateJson)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const server = new x402ResourceServer(facilitator as any).register("eip155:84532", new ExactEvmScheme())
      await server.initialize()
      const handler = withX402(innerHandler, routeConfig, server, undefined, undefined, false)
      return await handler(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      )
    }
  }
}
