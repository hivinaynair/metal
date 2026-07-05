import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { env } from "@/env";

const facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitator).register(
  "eip155:84532",
  new ExactEvmScheme(),
);

const handler = async (_: NextRequest) => {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    counterparty: "Acme Settlement Corp",
    exposureUsd: 142500,
    riskScore: 0.67,
    riskLevel: "MEDIUM",
    factors: ["High leverage", "Concentrated position", "Sector correlation"],
    recommendation: "Reduce exposure by 20% before settlement window.",
  });
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: "eip155:84532",
      payTo: env.PAY_TO_ADDRESS,
    },
    description: "Settlement risk report — $0.01 per request",
  },
  resourceServer,
);
