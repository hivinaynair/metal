import { NextResponse, type NextRequest } from "next/server"
import { withX402, x402ResourceServer } from "@x402/next"
import { HTTPFacilitatorClient } from "@x402/core/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { env } from "@/env"
import { getReportRoute, type ReportRouteId } from "@/lib/demo-scenarios"

// Minimal custom client that forwards X-AP2-Mandate to the facilitator.
// Falls back to the standard HTTPFacilitatorClient when no mandate is present.
class MandateFacilitatorClient {
  private inner: HTTPFacilitatorClient
  private baseUrl: string

  constructor(url: string, private mandateJson: string | undefined) {
    this.inner = new HTTPFacilitatorClient({ url })
    this.baseUrl = url.replace(/\/+$/, "")
  }

  private async call(path: "verify" | "settle", paymentPayload: unknown, paymentRequirements: unknown) {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.mandateJson) headers["X-AP2-Mandate"] = this.mandateJson
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        x402Version: (paymentPayload as { x402Version?: number }).x402Version ?? 2,
        paymentPayload,
        paymentRequirements,
      }),
    })
    return response.json()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async verify(paymentPayload: any, paymentRequirements: any) {
    if (!this.mandateJson) return this.inner.verify(paymentPayload, paymentRequirements)
    return this.call("verify", paymentPayload, paymentRequirements)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async settle(paymentPayload: any, paymentRequirements: any) {
    if (!this.mandateJson) return this.inner.settle(paymentPayload, paymentRequirements)
    return this.call("settle", paymentPayload, paymentRequirements)
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
    const mandateJson = request.headers.get("X-AP2-Mandate") ?? undefined
    const facilitator = new MandateFacilitatorClient(env.FACILITATOR_URL, mandateJson)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const server = new x402ResourceServer(facilitator as any).register("eip155:84532", new ExactEvmScheme())
    const handler = withX402(innerHandler, routeConfig, server, undefined, undefined, false)
    return handler(request)
  }
}
