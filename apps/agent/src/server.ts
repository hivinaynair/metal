import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { keccak256 } from "viem"
import { CdpClient } from "@coinbase/cdp-sdk"
import { createDb, schema } from "@workspace/shared/db"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { buildTools } from "./tools.ts"

const PORT = Number(process.env.PORT ?? 3002)

// scenarioIndex → named CDP account + scenario context
const SCENARIOS = [
  {
    name: "metal-agent-1",
    prompt: `You are metal-agent-1, a financial agent registered in the ERC-8004 identity registry on Base Sepolia.
Your AP2 mandate authorizes you to spend up to $1 USDC. The facilitator policy ceiling is $2 USDC.
You want to fetch a settlement risk report that costs $0.01 USDC.
1. Call get_wallet_details to confirm your address.
2. Call get_balance to verify your USDC balance.
3. Explain in one sentence why you are authorized to proceed (mandate limit, payment amount, policy ceiling).
4. Call x402Fetch to fetch the report and pay for it.
5. Summarize the result and report the settlement tx hash.
Be concise — focus on the compliance check and the result.`,
  },
  {
    name: "metal-agent-2",
    prompt: `You are metal-agent-2, a financial agent registered in the ERC-8004 identity registry on Base Sepolia.
Your AP2 mandate authorizes you to spend up to $1 USDC. The facilitator policy ceiling is $2 USDC.
You want to fetch a premium report that costs $5.00 USDC.
1. Call get_wallet_details to confirm your address.
2. Explain why you believe this payment will be blocked (mandate limit vs payment amount).
3. Attempt the fetch anyway with x402Fetch.
4. Report exactly what error the facilitator returned and at which gate it was rejected.
Be concise.`,
  },
  {
    name: "metal-agent-3",
    prompt: `You are metal-agent-3, a financial agent registered in the ERC-8004 identity registry on Base Sepolia.
Your AP2 mandate authorizes you to spend up to $10 USDC, but the facilitator policy ceiling is $2 USDC.
You want to fetch a premium report that costs $5.00 USDC.
1. Call get_wallet_details to confirm your address.
2. Explain why this payment might be blocked despite your mandate being sufficient.
3. Attempt the fetch with x402Fetch.
4. Report exactly what the facilitator rejected and why the policy ceiling blocked it even though your mandate allowed it.
Be concise.`,
  },
  {
    name: "metal-agent-ghost",
    prompt: `You are metal-agent-ghost. You are not registered in the ERC-8004 identity registry and have no AP2 mandate.
You want to fetch a settlement risk report that costs $0.01 USDC.
1. Call get_wallet_details to confirm your address.
2. Acknowledge that you lack identity registration and a mandate.
3. Attempt the fetch anyway with x402Fetch.
4. Report exactly what the facilitator rejected and at which gate (identity check) it stopped you.
Be concise.`,
  },
] as const

let _cdp: CdpClient | undefined
function getCdp() {
  if (!_cdp) _cdp = new CdpClient()
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
      .where((t, { eq }) => eq(t.paymentHash, paymentHash))
      .limit(1)
    if (rows[0]?.attestationTx) return rows[0].attestationTx
    await new Promise((r) => setTimeout(r, 800))
  }
  return null
}

const app = new Hono()

app.get("/health", (c) => c.text("ok"))

app.post("/run", async (c) => {
  const body = await c.req.json<{ scenarioIndex?: number; mandateHeader?: string }>()
  const index = Math.min(Math.max(Number(body.scenarioIndex ?? 0), 0), SCENARIOS.length - 1)
  const scenario = SCENARIOS[index]!

  const account = await getCdp().evm.getOrCreateAccount({ name: scenario.name })
  const tools = await buildTools(account, { mandateHeader: body.mandateHeader })

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      let settlementTxHash: string | undefined
      let httpStatus: number | undefined
      let responseError: string | undefined

      try {
        const result = streamText({
          model: anthropic("claude-sonnet-4-6"),
          tools,
          system: "You are a financial compliance agent with a crypto wallet on Base Sepolia.",
          prompt: scenario.prompt,
          maxSteps: 4,
        })

        for await (const chunk of result.textStream) {
          send({ type: "token", text: chunk })
        }

        // Extract payment result from tool calls
        for (const step of await result.steps) {
          for (const tr of step.toolResults ?? []) {
            if (tr.toolName === "x402Fetch") {
              const r = tr.result as { txHash?: string; httpStatus?: number; body?: { error?: string } }
              if (r.txHash) settlementTxHash = r.txHash
              if (r.httpStatus) httpStatus = r.httpStatus
              if (r.body?.error) responseError = r.body.error
            }
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
          settlementTxHash,
          settlementTxUrl: settlementTxHash ? `${BASE_SEPOLIA_EXPLORER}/tx/${settlementTxHash}` : undefined,
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

export function startServer() {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[Metal Agent] HTTP server running on port ${PORT}`)
  })
}

export default app
