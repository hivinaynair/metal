import { Hono } from "hono"
import type { SignedMandate } from "@workspace/shared/mandate"
import { registerMandate, getMandate } from "../lib/mandate-store.ts"
import { verifyMandateSignature } from "../lib/mandate.ts"

const app = new Hono()

app.post("/", async (c) => {
  const body = await c.req.json<{ mandate: SignedMandate; agentId: string }>()

  if (!body.mandate || !body.agentId) {
    return c.json({ error: "mandate and agentId required" }, 400)
  }

  const { mandate, agentId } = body

  // Normalise JSON-parsed numbers to bigint (JSON does not preserve bigint)
  const normalised: SignedMandate = {
    payload: {
      ...mandate.payload,
      maxAmountUsdc: BigInt(mandate.payload.maxAmountUsdc),
      expiry: BigInt(mandate.payload.expiry),
      nonce: BigInt(mandate.payload.nonce),
    },
    signature: mandate.signature,
  }

  const isValid = await verifyMandateSignature(normalised)
  if (!isValid) {
    return c.json({ error: "invalid mandate signature" }, 400)
  }

  // Prevent overwriting an existing mandate — agent must deregister first
  if (getMandate(normalised.payload.agent)) {
    return c.json({ error: "mandate already registered for this agent" }, 409)
  }

  registerMandate(normalised, BigInt(agentId))

  return c.json({ ok: true })
})

export default app
