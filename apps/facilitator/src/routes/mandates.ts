import { Hono } from "hono"
import { isAddress } from "viem"
import type { SignedMandate } from "@workspace/shared/mandate"
import { registerMandate } from "../lib/mandate-store.js"
import { verifyMandateSignature } from "../lib/mandate.js"
import { isRecord, parseBigIntField, readJsonObject } from "../lib/http.js"

const app = new Hono()

app.post("/", async (c) => {
  const body = await readJsonObject(c)
  if (body instanceof Response) return body

  if (!isRecord(body.mandate) || body.agentId === undefined) {
    return c.json({ error: "mandate and agentId required" }, 400)
  }

  const { mandate, agentId } = body
  if (!isRecord(mandate.payload)) {
    return c.json({ error: "mandate.payload required" }, 400)
  }

  const agent = mandate.payload.agent
  const delegator = mandate.payload.delegator
  if (typeof agent !== "string" || typeof delegator !== "string" || !isAddress(agent) || !isAddress(delegator)) {
    return c.json({ error: "mandate payload must include valid agent and delegator addresses" }, 400)
  }

  if (typeof mandate.signature !== "string" || !mandate.signature.startsWith("0x")) {
    return c.json({ error: "mandate.signature must be a hex string" }, 400)
  }

  const maxAmountUsdc = parseBigIntField(mandate.payload.maxAmountUsdc, "mandate.payload.maxAmountUsdc")
  const expiry = parseBigIntField(mandate.payload.expiry, "mandate.payload.expiry")
  const nonce = parseBigIntField(mandate.payload.nonce, "mandate.payload.nonce")
  const parsedAgentId = parseBigIntField(agentId, "agentId")

  if (typeof maxAmountUsdc === "string") return c.json({ error: maxAmountUsdc }, 400)
  if (typeof expiry === "string") return c.json({ error: expiry }, 400)
  if (typeof nonce === "string") return c.json({ error: nonce }, 400)
  if (typeof parsedAgentId === "string") return c.json({ error: parsedAgentId }, 400)

  // Normalise JSON-parsed numbers to bigint (JSON does not preserve bigint)
  const normalised: SignedMandate = {
    payload: {
      agent,
      delegator,
      maxAmountUsdc,
      expiry,
      nonce,
    },
    signature: mandate.signature as `0x${string}`,
  }

  const isValid = await verifyMandateSignature(normalised)
  if (!isValid) {
    return c.json({ error: "invalid mandate signature" }, 400)
  }

  const registered = await registerMandate(normalised, parsedAgentId)
  if (!registered) {
    return c.json({ error: "mandate already registered for this agent" }, 409)
  }

  return c.json({ ok: true })
})

export default app
