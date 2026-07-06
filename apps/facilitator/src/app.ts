import { Hono } from "hono"
import { x402Facilitator } from "@x402/core/facilitator"
import { parsePaymentPayload, parsePaymentRequirements } from "@x402/core/schemas"
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types"
import { ExactEvmScheme } from "@x402/evm/exact/facilitator"
import { BASE_SEPOLIA_CAIP2 } from "@workspace/shared/chains"
import { facilitatorSigner } from "./lib/clients.ts"
import { verifyDeps } from "./lib/deps.ts"
import { onBeforeVerify } from "./hooks/verify.ts"
import { onBeforeSettle, onAfterSettle } from "./hooks/settle.ts"
import mandatesRouter from "./routes/mandates.ts"
import type { Context } from "hono"
import { isRecord, parseBigIntField, readJsonObject } from "./lib/http.ts"

interface ParsedPaymentRequirements {
  scheme: string
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: Record<string, unknown> | null
}

function normalizeRequirements(requirements: ParsedPaymentRequirements): PaymentRequirements {
  return {
    ...requirements,
    network: requirements.network as PaymentRequirements["network"],
    extra: requirements.extra ?? {},
  }
}

function normalizePaymentPayload(payload: {
  x402Version: 2
  resource?: PaymentPayload["resource"]
  accepted: ParsedPaymentRequirements
  payload: Record<string, unknown>
  extensions?: Record<string, unknown> | null
}): PaymentPayload {
  return {
    x402Version: payload.x402Version,
    ...(payload.resource ? { resource: payload.resource } : {}),
    accepted: normalizeRequirements(payload.accepted),
    payload: payload.payload,
    ...(payload.extensions ? { extensions: payload.extensions } : {}),
  }
}

async function readPaymentBody(c: Context) {
  const body = await readJsonObject(c)
  if (body instanceof Response) return body
  if (!isRecord(body.paymentPayload) || !isRecord(body.paymentRequirements)) {
    return c.json({ error: "paymentPayload and paymentRequirements are required" }, 400)
  }

  const paymentPayload = parsePaymentPayload(body.paymentPayload)
  if (!paymentPayload.success) {
    return c.json({ error: "paymentPayload is invalid", issues: paymentPayload.error.issues }, 400)
  }
  if (paymentPayload.data.x402Version !== 2) {
    return c.json({ error: "paymentPayload.x402Version must be 2" }, 400)
  }

  const paymentRequirements = parsePaymentRequirements(body.paymentRequirements)
  if (!paymentRequirements.success) {
    return c.json({ error: "paymentRequirements is invalid", issues: paymentRequirements.error.issues }, 400)
  }

  if (!("amount" in paymentRequirements.data)) {
    return c.json({ error: "paymentRequirements.amount is required" }, 400)
  }
  const amount = parseBigIntField(paymentRequirements.data.amount, "paymentRequirements.amount")
  if (typeof amount === "string") return c.json({ error: amount }, 400)

  return {
    paymentPayload: normalizePaymentPayload(paymentPayload.data),
    paymentRequirements: normalizeRequirements(paymentRequirements.data),
  }
}

// Build x402 facilitator with Metal compliance hooks
const facilitator = new x402Facilitator()

facilitator
  .register(BASE_SEPOLIA_CAIP2, new ExactEvmScheme(facilitatorSigner))
  .onBeforeVerify((ctx) => onBeforeVerify(ctx, verifyDeps))
  .onBeforeSettle(onBeforeSettle)
  .onAfterSettle(onAfterSettle)

// Hono app
const app = new Hono()

app.get("/supported", (c) => c.json(facilitator.getSupported()))

app.post("/verify", async (c) => {
  const body = await readPaymentBody(c)
  if (body instanceof Response) return body
  const result = await facilitator.verify(body.paymentPayload, body.paymentRequirements)
  return c.json(result)
})

app.post("/settle", async (c) => {
  const body = await readPaymentBody(c)
  if (body instanceof Response) return body
  const result = await facilitator.settle(body.paymentPayload, body.paymentRequirements)
  return c.json(result)
})

app.route("/mandates", mandatesRouter)

export default app
