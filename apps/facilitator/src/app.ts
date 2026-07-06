import { Hono } from "hono"
import { x402Facilitator } from "@x402/core/facilitator"
import { ExactEvmScheme } from "@x402/evm/exact/facilitator"
import { BASE_SEPOLIA_CAIP2 } from "@workspace/shared/chains"
import { facilitatorSigner } from "./lib/clients.ts"
import { env } from "./lib/env.ts"
import { verifyDeps } from "./lib/deps.ts"
import { onBeforeVerify } from "./hooks/verify.ts"
import { onBeforeSettle, onAfterSettle } from "./hooks/settle.ts"
import mandatesRouter from "./routes/mandates.ts"

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
  const body = await c.req.json()
  const result = await facilitator.verify(body.paymentPayload, body.paymentRequirements)
  return c.json(result)
})

app.post("/settle", async (c) => {
  const body = await c.req.json()
  const result = await facilitator.settle(body.paymentPayload, body.paymentRequirements)
  return c.json(result)
})

app.route("/mandates", mandatesRouter)

export default app
