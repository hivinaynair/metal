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
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      report: route.title,
      counterparty: "Acme Settlement Corp",
      exposureUsd: route.id === "premium" ? 875000 : 142500,
      riskScore: route.id === "premium" ? 0.91 : 0.67,
      riskLevel: route.riskLevel,
      factors:
        route.id === "premium"
          ? ["Cross-border exposure", "Thin liquidity", "Sanctions review required"]
          : ["High leverage", "Concentrated position", "Sector correlation"],
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
