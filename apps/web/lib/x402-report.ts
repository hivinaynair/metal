import { NextResponse, type NextRequest } from "next/server"
import { withX402, x402ResourceServer } from "@x402/next"
import { HTTPFacilitatorClient } from "@x402/core/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { env } from "@/env"
import { getReportRoute, type ReportRouteId } from "@/lib/demo-scenarios"

function makeMandateClient(url: string, mandateJson: string | undefined) {
  const inner = new HTTPFacilitatorClient({ url })
  if (!mandateJson) return inner
  const mandate = mandateJson

  const baseUrl = url.replace(/\/+$/, "")

  async function callWithMandate(path: "verify" | "settle", paymentPayload: unknown, paymentRequirements: unknown) {
    const response = await fetch(`${baseUrl}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-AP2-Mandate": mandate },
      body: JSON.stringify({
        x402Version: (paymentPayload as { x402Version?: number }).x402Version ?? 2,
        paymentPayload,
        paymentRequirements,
      }),
    })
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
      const text = await response.text()
      throw new Error(
        `Facilitator ${path} returned ${response.status} ${response.statusText}: ${text.slice(0, 240) || "empty response"}`
      )
    }
    return response.json()
  }

  return {
    getSupported: () => inner.getSupported(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verify: (paymentPayload: any, paymentRequirements: any) => callWithMandate("verify", paymentPayload, paymentRequirements),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settle: (paymentPayload: any, paymentRequirements: any) => callWithMandate("settle", paymentPayload, paymentRequirements),
  }
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
