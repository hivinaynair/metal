import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { eq } from "drizzle-orm"
import { keccak256 } from "viem"
import { createDb, schema } from "@workspace/shared/db"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { AgentId, AGENT_ROUTE } from "@workspace/shared/types"
import { buildTools } from "./tools.js"
import type { CdpClient } from "@coinbase/cdp-sdk"

const PORT = Number(process.env.PORT ?? 3002)


const AGENT_PROMPT: Record<AgentId, string> = {
  [AgentId.AGENT_1]: `You are metal-agent-1, a financial agent on Base Sepolia. Call x402Fetch to fetch the settlement risk report and pay for it. Report the settlement tx hash.`,
  [AgentId.AGENT_2]: `You are metal-agent-2, a financial agent on Base Sepolia. Call x402Fetch to fetch the premium report. Report exactly what error the facilitator returned.`,
  [AgentId.AGENT_3]: `You are metal-agent-3, a financial agent on Base Sepolia. Call x402Fetch to fetch the premium report. Report exactly what error the facilitator returned.`,
  [AgentId.GHOST]: `You are metal-agent-ghost on Base Sepolia. Call x402Fetch to fetch the settlement risk report. Report exactly what error the facilitator returned.`,
}

const ROUTE_PATH: Record<"basic" | "premium", string> = {
  basic: "/api/reports/basic",
  premium: "/api/reports/premium",
}

// Mandate headers loaded from DB at startup, keyed by AgentId
const mandateHeaders = new Map<AgentId, string>()

let _cdp: CdpClient | undefined
async function getCdp() {
  if (!_cdp) {
    const { CdpClient } = await import("@coinbase/cdp-sdk")
    _cdp = new CdpClient()
  }
  return _cdp
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("Missing env var: DATABASE_URL")
  if (!_db) _db = createDb(url)
  return _db
}

// Poll Postgres for attestation tx — onAfterSettle is async so it may lag the settlement
async function getAttestationTx(settlementTxHash: string, retries = 5): Promise<string | null> {
  const paymentHash = keccak256(settlementTxHash as `0x${string}`)
  for (let i = 0; i < retries; i++) {
    const rows = await getDb()
      .select({ attestationTx: schema.settlementAttestations.attestationTx })
      .from(schema.settlementAttestations)
      .where(eq(schema.settlementAttestations.paymentHash, paymentHash))
      .limit(1)
    if (rows[0]?.attestationTx) return rows[0].attestationTx
    await new Promise((r) => setTimeout(r, 800))
  }
  return null
}

// Load mandate headers from DB into memory on startup
async function loadMandates() {
  const rows = await getDb()
    .select({
      name:             schema.agents.name,
      erc8004AgentId:   schema.agents.agentId,
      agentAddress:     schema.mandates.agentAddress,
      delegatorAddress: schema.mandates.delegatorAddress,
      maxAmountUsdc:    schema.mandates.maxAmountUsdc,
      expiry:           schema.mandates.expiry,
      nonce:            schema.mandates.nonce,
      signature:        schema.mandates.signature,
    })
    .from(schema.mandates)
    .innerJoin(schema.agents, eq(schema.mandates.agentAddress, schema.agents.address))

  for (const row of rows) {
    const agentId = Object.values(AgentId).find((id) => id === row.name)
    if (!agentId) continue
    const header = JSON.stringify({
      agentId: row.erc8004AgentId.toString(),
      payload: {
        agent:          row.agentAddress,
        delegator:      row.delegatorAddress,
        maxAmountUsdc:  row.maxAmountUsdc.toString(),
        expiry:         row.expiry.toString(),
        nonce:          row.nonce.toString(),
      },
      signature: row.signature,
    })
    mandateHeaders.set(agentId, header)
  }
  console.log(`[Metal Agent] Loaded ${mandateHeaders.size} mandate(s) from DB`)
}

const app = new Hono()

app.get("/health", (c) => c.text("ok"))

// Returns all agent addresses — used by demo:bootstrap to sign mandates
app.get("/agents", async (c) => {
  const cdp = await getCdp()
  const agents = await Promise.all(
    Object.values(AgentId).map(async (agentId) => {
      const account = await cdp.evm.getOrCreateAccount({ name: agentId })
      return { agentId, address: account.address as string }
    }),
  )
  return c.json(agents)
})

app.post("/run", async (c) => {
  const body = await c.req.json<{ agentId?: AgentId }>()
  const agentId = body.agentId && Object.values(AgentId).includes(body.agentId)
    ? body.agentId
    : AgentId.AGENT_1

  const mandateHeader = mandateHeaders.get(agentId)
  if (!mandateHeader) {
    return c.json({ error: "bootstrap not run — no mandate found for agent" }, 503)
  }

  const appUrl = process.env.APP_URL
  if (!appUrl) return c.json({ error: "Missing env var: APP_URL" }, 500)

  const route = AGENT_ROUTE[agentId]
  const targetUrl = `${appUrl}${ROUTE_PATH[route]}`

  const account = await (await getCdp()).evm.getOrCreateAccount({ name: agentId })
  const tools = await buildTools(account, { mandateHeader })

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      // Gate 0: agent identity resolved
      send({ type: "gate", step: 0 })

      let settlementTxHash: string | undefined
      let httpStatus: number | undefined
      let responseError: string | undefined

      try {
        const result = streamText({
          model: anthropic("claude-sonnet-4-6"),
          tools,
          system: "You are a financial compliance agent with a crypto wallet on Base Sepolia.",
          prompt: `${AGENT_PROMPT[agentId]}\n\nUse this exact URL when calling x402Fetch: ${targetUrl}`,
          maxSteps: 4,
        })

        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            send({ type: "token", text: chunk.textDelta })
          } else if (chunk.type === "tool-call" && chunk.toolName === "x402Fetch") {
            // Gate 1: agent is submitting payment to the 402 endpoint / facilitator
            send({ type: "gate", step: 1 })
          } else if (chunk.type === "tool-result" && chunk.toolName === "x402Fetch") {
            const r = chunk.result as { txHash?: string; httpStatus?: number; body?: { error?: string } }
            if (r.txHash) settlementTxHash = r.txHash
            if (r.httpStatus) httpStatus = r.httpStatus
            if (r.body?.error) responseError = r.body.error
          }
        }
      } catch (err) {
        send({ type: "token", text: `\n[Agent error: ${String(err)}]` })
      }

      // Fetch attestation tx from Postgres (give facilitator time to write it)
      let attestationTxHash: string | null = null
      if (settlementTxHash) {
        attestationTxHash = await getAttestationTx(settlementTxHash)
      }

      send({
        type: "done",
        result: {
          payer:            account.address,
          agentUri:         `${appUrl}/api/agent/${account.address}`,
          settlementTxHash,
          settlementTxUrl:  settlementTxHash ? `${BASE_SEPOLIA_EXPLORER}/tx/${settlementTxHash}` : undefined,
          attestationTxHash: attestationTxHash ?? undefined,
          attestationTxUrl: attestationTxHash ? `${BASE_SEPOLIA_EXPLORER}/tx/${attestationTxHash}` : undefined,
          httpStatus,
          error: responseError,
        },
      })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
})

export async function startServer() {
  await loadMandates()
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[Metal Agent] HTTP server running on port ${PORT}`)
  })
}

export default app
