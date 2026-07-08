import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { AgentId, type DecisionRecord } from "@workspace/shared/types"
import { getAp2CredentialForAgent } from "./credentials.js"
import { validateRunRequest } from "./run-request.js"
import { buildTools } from "./tools.js"
import { gateStepsForResult } from "./gate-steps.js"
import type { CdpClient } from "@coinbase/cdp-sdk"

const PORT = Number(process.env.PORT ?? 3002)


const AGENT_PROMPT: Record<AgentId, string> = {
  [AgentId.AGENT_1]: `You are metal-agent-1, a financial agent on Base Sepolia. Call x402Fetch to fetch the settlement risk report and pay for it. Report the settlement tx hash.`,
  [AgentId.AGENT_2]: `You are metal-agent-2, a financial agent on Base Sepolia. Call x402Fetch to fetch the premium report. Report exactly what error the facilitator returned.`,
  [AgentId.AGENT_3]: `You are metal-agent-3, a financial agent on Base Sepolia. Call x402Fetch to fetch the premium report. Report exactly what error the facilitator returned.`,
  [AgentId.GHOST]: `You are metal-agent-ghost on Base Sepolia. Call x402Fetch to fetch the settlement risk report. Report exactly what error the facilitator returned.`,
}

let _cdp: CdpClient | undefined
async function getCdp() {
  if (!_cdp) {
    const { CdpClient } = await import("@coinbase/cdp-sdk")
    _cdp = new CdpClient()
  }
  return _cdp
}

// Poll facilitator for its canonical decision record. The settlement hook can lag the x402 response.
async function getDecisionRecord(
  {
    authorizationNonce,
    payer,
    settlementTxHash,
  }: {
    authorizationNonce?: string
    payer: string
    settlementTxHash?: string
  },
  retries = 5,
): Promise<DecisionRecord | undefined> {
  const baseUrl = process.env.FACILITATOR_URL?.replace(/\/+$/, "")
  if (!baseUrl) return undefined

  for (let i = 0; i < retries; i++) {
    const path = settlementTxHash
      ? `/decision-records/by-settlement/${settlementTxHash}`
      : authorizationNonce
        ? `/decision-records/by-auth-nonce/${encodeURIComponent(authorizationNonce)}`
        : `/decision-records/latest?payer=${encodeURIComponent(payer.toLowerCase())}`
    const response = await fetch(`${baseUrl}${path}`).catch(() => undefined)
    const body = response?.ok
      ? await response.json().catch(() => undefined) as { decisionRecord?: DecisionRecord | null } | undefined
      : undefined
    if (body?.decisionRecord) return body.decisionRecord
    await new Promise((r) => setTimeout(r, 800))
  }
  return undefined
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
  const appUrl = process.env.APP_URL
  if (!appUrl) return c.json({ error: "Missing env var: APP_URL" }, 500)

  const body = await c.req.json().catch(() => undefined)
  if (!body || typeof body !== "object") {
    return c.json({ error: "JSON body is required" }, 400)
  }

  const validated = validateRunRequest(body, appUrl)
  if (!validated.ok) {
    return c.json({ error: validated.error }, 400)
  }

  const { agentId, targetUrl } = validated.value
  const account = await (await getCdp()).evm.getOrCreateAccount({ name: agentId })
  const credential = await getAp2CredentialForAgent(account.address)
  if (!credential) {
    return c.json({ error: "mandate_not_registered" }, 503)
  }

  const tools = await buildTools(account, { mandateHeader: credential.header })

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      // Gate 0: agent identity resolved
      send({ type: "gate", step: 0 })

      let settlementTxHash: string | undefined
      let authorizationNonce: string | undefined
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
            const r = chunk.result as {
              authorizationNonce?: string
              txHash?: string
              httpStatus?: number
              body?: { error?: string }
            }
            if (r.authorizationNonce) authorizationNonce = r.authorizationNonce
            if (r.txHash) settlementTxHash = r.txHash
            if (r.httpStatus) httpStatus = r.httpStatus
            if (r.body?.error) responseError = r.body.error
          }
        }
      } catch (err) {
        send({ type: "token", text: `\n[Agent error: ${String(err)}]` })
      }

      // Emit facilitator gate steps based on the settlement outcome.
      // Paced at 120ms each so the UI animation has time to render each step.
      for (const step of gateStepsForResult(responseError, settlementTxHash)) {
        send({ type: "gate", step })
        await new Promise((r) => setTimeout(r, 120))
      }

      const decisionRecord = await getDecisionRecord({
        authorizationNonce,
        payer: account.address,
        settlementTxHash,
      })
      const attestationTxHash = decisionRecord?.attestationTxHash

      // Step 6 (attestation) emitted here, not in gateStepsForResult, because it depends on async polling
      if (!responseError && attestationTxHash) {
        send({ type: "gate", step: 6 })
      }
      const policyMaxAmountUsdc = decisionRecord?.policy.maxAmountUsdc

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
          authorizationNonce,
          policyThreshold: policyMaxAmountUsdc ? `$${policyMaxAmountUsdc}` : undefined,
          proofLookupError: decisionRecord ? undefined : "decision_record_not_found",
          decisionProof: decisionRecord,
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
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[Metal Agent] HTTP server running on port ${PORT}`)
  })
}

export default app
