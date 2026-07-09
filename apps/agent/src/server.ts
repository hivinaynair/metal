import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { isAddress } from "viem"
import { DemoAgentName } from "@workspace/shared/types"
import type { RawMandate } from "@workspace/shared/types"
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES } from "@workspace/shared/mandate"
import { getAp2CredentialForAgent } from "./credentials.js"
import { validateRunRequest } from "./run-request.js"
import { getCdp } from "./cdp.js"
import { buildRunStream } from "./run-stream.js"

const PORT = Number(process.env.PORT ?? 3002)

const AGENT_NAME = "Metal Agent"
const AGENT_VERSION = "1.0.0"
const AGENT_CAPABILITIES = ["payment", "settlement"]

const app = new Hono()

app.get("/health", (c) => c.text("ok"))
app.get("/", (c) => c.text("ok"))


app.get("/api/agent/:address", (c) => {
  const address = c.req.param("address")
  if (!isAddress(address)) {
    return c.json({ error: "invalid agent address" }, 400)
  }
  return c.json({ address, name: AGENT_NAME, version: AGENT_VERSION, capabilities: AGENT_CAPABILITIES })
})

// Returns all agent addresses — used by demo:bootstrap to sign mandates
app.get("/agents", async (c) => {
  const secret = process.env.BOOTSTRAP_SECRET
  if (secret && c.req.header("Authorization") !== `Bearer ${secret}`) {
    return c.json({ error: "unauthorized" }, 401)
  }
  const cdp = await getCdp()
  const agents = await Promise.all(
    Object.values(DemoAgentName).map(async (agentName) => {
      const account = await cdp.evm.getOrCreateAccount({ name: agentName })
      return { agentName, address: account.address as string }
    })
  )
  return c.json(agents)
})

app.post("/run", async (c) => {
  const appUrl = process.env.APP_URL
  if (!appUrl) return c.json({ error: "Missing env var: APP_URL" }, 500)
  const agentUrl = process.env.AGENT_URL ?? `http://localhost:${PORT}`

  const body = await c.req.json().catch(() => undefined)

  if (!body || typeof body !== "object") {
    return c.json({ error: "JSON body is required" }, 400)
  }

  const validated = validateRunRequest(body, appUrl)

  if (validated.ok === false) {
    return c.json({ error: validated.error }, 400)
  }

  const { agentName, targetUrl } = validated.value

  const cdp = await getCdp()
  const account = await cdp.evm.getOrCreateAccount({ name: agentName })
  const credential = getAp2CredentialForAgent(account.address)
  
  if (!credential) {
    return c.json({ error: "mandate_missing" }, 503)
  }

  const rawMandate: RawMandate = {
    agentId: credential.entry.agentId.toString(),
    domain: {
      name: MANDATE_EIP712_DOMAIN.name,
      version: MANDATE_EIP712_DOMAIN.version,
      chainId: Number(MANDATE_EIP712_DOMAIN.chainId),
    },
    types: {
      MandatePayload: MANDATE_EIP712_TYPES.MandatePayload.map((f) => ({
        name: f.name,
        type: f.type,
      })),
    },
    payload: {
      agent: credential.entry.mandate.payload.agent,
      delegator: credential.entry.mandate.payload.delegator,
      maxAmountUsdc: credential.entry.mandate.payload.maxAmountUsdc.toString(),
      expiry: credential.entry.mandate.payload.expiry.toString(),
      nonce: credential.entry.mandate.payload.nonce.toString(),
    },
    signature: credential.entry.mandate.signature,
  }

  return new Response(buildRunStream(account, credential, agentName, targetUrl, agentUrl, rawMandate), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
})

export async function startServer() {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[Metal Agent] HTTP server running on port ${PORT}`)
  })
}

export default app
