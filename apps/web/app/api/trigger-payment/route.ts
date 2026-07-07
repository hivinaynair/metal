import { privateKeyToAccount } from "viem/accounts"
import { initAgents, getMandateHeader } from "@/lib/init-agents"
import { reportRoutes, demoAgents, POLICY_MAX_AMOUNT_USDC } from "@/lib/demo-scenarios"
import { env } from "@/env"

const SCENARIOS = [
  { agentKey: "agent1" as const, routeId: "basic"   as const },
  { agentKey: "agent2" as const, routeId: "premium" as const },
  { agentKey: "agent3" as const, routeId: "premium" as const },
  { agentKey: "ghost"  as const, routeId: "basic"   as const },
] as const

export async function POST(request: Request) {
  const agents = await initAgents()

  let scenarioIndex = 0
  try {
    const body = await request.json() as { scenarioIndex?: unknown }
    if (typeof body.scenarioIndex === "number" && Number.isInteger(body.scenarioIndex)) {
      scenarioIndex = Math.min(Math.max(body.scenarioIndex, 0), SCENARIOS.length - 1)
    }
  } catch { /* no body */ }

  const scenario = SCENARIOS[scenarioIndex]!
  const account = agents[scenario.agentKey]
  const route = reportRoutes.find((r) => r.id === scenario.routeId)!
  const agentId = scenario.agentKey === "ghost"
    ? "metal-agent-ghost"
    : `metal-agent-${scenario.agentKey.replace("agent", "")}`
  const demoAgent = demoAgents.find((a) => a.id === agentId)
  const delegator = privateKeyToAccount(env.DELEGATOR_PRIVATE_KEY as `0x${string}`)
  const mandateHeader = getMandateHeader(account.address)

  // Delegate payment + reasoning to the real agent server
  let agentRes: Response
  try {
    agentRes = await fetch(`${env.AGENT_URL}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioIndex, mandateHeader }),
    })
  } catch (err) {
    return new Response(`Agent server unreachable: ${String(err)}`, { status: 503 })
  }

  if (!agentRes.ok || !agentRes.body) {
    return new Response(`Agent server error: ${agentRes.status}`, { status: 503 })
  }

  // Metadata known by web (not the agent)
  const meta = {
    slot: (["A", "B", "C", "D"] as const)[scenarioIndex],
    agentKey: scenario.agentKey,
    agent: demoAgent,
    route: { id: route.id, path: route.path, price: route.priceLabel },
    payer: account.address,
    agentUri: `${env.APP_URL}/api/agent/${account.address}`,
    mandateDelegator: demoAgent?.mandateLimit === "none" ? undefined : delegator.address,
    policyThreshold: `$${POLICY_MAX_AMOUNT_USDC}`,
  }

  // Pipe SSE from agent → browser; enrich the done event with web-side metadata
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const enc = new TextEncoder()
  const dec = new TextDecoder()

  ;(async () => {
    const reader = agentRes.body!.getReader()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; result?: Record<string, unknown> }
            if (event.type === "token") {
              await writer.write(enc.encode(line + "\n\n"))
            } else if (event.type === "done") {
              const agentResult = event.result ?? {}
              const mandateValid = Boolean(
                demoAgent?.mandateLimit !== "none" &&
                agentResult["error"] !== "mandate_not_registered" &&
                agentResult["error"] !== "mandate_signature_invalid" &&
                agentResult["error"] !== "mandate_expired" &&
                agentResult["error"] !== "mandate_amount_exceeded",
              )
              const enriched = {
                type: "done",
                result: {
                  ...meta,
                  mandateValid,
                  ...agentResult,
                  body: agentResult["error"] ? { error: agentResult["error"] } : undefined,
                },
              }
              await writer.write(enc.encode(`data: ${JSON.stringify(enriched)}\n\n`))
            }
          } catch { /* malformed SSE line — skip */ }
        }
      }
    } catch (err) {
      const errEvent = `data: ${JSON.stringify({ type: "done", result: { ...meta, body: { error: String(err) }, httpStatus: 500 } })}\n\n`
      await writer.write(enc.encode(errEvent))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
