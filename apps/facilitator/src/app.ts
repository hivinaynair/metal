import { Hono } from "hono"
import { desc, eq } from "drizzle-orm"
import { keccak256 } from "viem"
import { schema } from "@workspace/db"
import { getDb } from "./lib/db.js"
import { requestCtx } from "./lib/request-context.js"
import { getPolicyMaxAmountUsdc, setPolicyMaxAmountUsdc } from "./lib/policy-store.js"
import { readPaymentBody } from "./lib/payment.js"
import { facilitator } from "./lib/x402.js"

const app = new Hono()

app.get("/supported", (c) => c.json(facilitator.getSupported()))

app.post("/verify", async (c) => {
  try {
    const body = await readPaymentBody(c)
    if (body instanceof Response) return body
    const mandateJson = c.req.header("X-AP2-Mandate")
    const result = await requestCtx.run({ mandateJson }, () =>
      facilitator.verify(body.paymentPayload, body.paymentRequirements),
    )
    return c.json(result)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

app.post("/settle", async (c) => {
  try {
    const body = await readPaymentBody(c)
    if (body instanceof Response) return body
    const mandateJson = c.req.header("X-AP2-Mandate")
    const result = await requestCtx.run({ mandateJson }, () =>
      facilitator.settle(body.paymentPayload, body.paymentRequirements),
    )
    return c.json(result)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

app.get("/decision-records/by-settlement/:txHash", async (c) => {
  const txHash = c.req.param("txHash")
  if (!txHash.startsWith("0x")) {
    return c.json({ error: "txHash must be hex" }, 400)
  }
  const paymentHash = keccak256(txHash as `0x${string}`)
  const rows = await getDb()
    .select({ decisionRecord: schema.settlementAttestations.decisionRecord })
    .from(schema.settlementAttestations)
    .where(eq(schema.settlementAttestations.paymentHash, paymentHash))
    .limit(1)
  return c.json({ decisionRecord: rows[0]?.decisionRecord ?? null })
})

app.get("/decision-records/by-auth-nonce/:nonce", async (c) => {
  const nonce = c.req.param("nonce")
  const rows = await getDb()
    .select({ decisionRecord: schema.settlementAttestations.decisionRecord })
    .from(schema.settlementAttestations)
    .where(eq(schema.settlementAttestations.authorizationNonce, nonce))
    .orderBy(desc(schema.settlementAttestations.createdAt))
    .limit(1)
  return c.json({ decisionRecord: rows[0]?.decisionRecord ?? null })
})

app.get("/decision-records/latest", async (c) => {
  const payer = c.req.query("payer")?.toLowerCase()
  if (!payer) return c.json({ error: "payer is required" }, 400)
  const rows = await getDb()
    .select({ decisionRecord: schema.settlementAttestations.decisionRecord })
    .from(schema.settlementAttestations)
    .where(eq(schema.settlementAttestations.payerAddress, payer))
    .orderBy(desc(schema.settlementAttestations.createdAt))
    .limit(1)
  return c.json({ decisionRecord: rows[0]?.decisionRecord ?? null })
})

app.get("/policy", async (c) => c.json({ maxAmountUsdc: await getPolicyMaxAmountUsdc() }))

app.post("/policy", async (c) => {
  const body = await c.req.json() as { maxAmountUsdc?: unknown }
  if (typeof body.maxAmountUsdc !== "number") {
    return c.json({ error: "maxAmountUsdc must be a number" }, 400)
  }
  await setPolicyMaxAmountUsdc(body.maxAmountUsdc)
  return c.json({ maxAmountUsdc: await getPolicyMaxAmountUsdc() })
})

export default app
