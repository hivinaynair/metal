import { AgentId, AGENT_ROUTE } from "@workspace/shared/types"
import { reportRoutes, demoAgents } from "@/lib/demo-scenarios"
import { isMandateFailure } from "@/lib/settlement-status"
import { env } from "@/env"

const SCENARIO_AGENT: AgentId[] = [
  AgentId.AGENT_1,
  AgentId.AGENT_2,
  AgentId.AGENT_3,
  AgentId.GHOST,
]


export async function POST(request: Request) {
  let scenarioIndex = 0
  try {
    const body = await request.json() as { scenarioIndex?: unknown }
    if (typeof body.scenarioIndex === "number" && Number.isInteger(body.scenarioIndex)) {
      scenarioIndex = Math.min(Math.max(body.scenarioIndex, 0), SCENARIO_AGENT.length - 1)
    }
  } catch { /* no body */ }

  const agentId = SCENARIO_AGENT[scenarioIndex]!

  // Delegate payment + reasoning to the agent server
  let agentRes: Response
  try {
    agentRes = await fetch(`${env.AGENT_URL}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId }),
    })
  } catch (err) {
    return new Response(`Agent server unreachable: ${String(err)}`, { status: 503 })
  }

  if (agentRes.status === 503) {
    const errBody = await agentRes.json().catch(() => ({})) as { error?: string }
    return new Response(errBody.error ?? "Agent bootstrap not run", { status: 503 })
  }

  if (!agentRes.ok || !agentRes.body) {
    return new Response(`Agent server error: ${agentRes.status}`, { status: 503 })
  }

  // Web-side display metadata
  const routeId = AGENT_ROUTE[agentId]
  const route = reportRoutes.find((r) => r.id === routeId)!
  const demoAgent = demoAgents.find((a) => a.id === agentId)
  const slot = (["A", "B", "C", "D"] as const)[scenarioIndex]

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
            if (event.type === "token" || event.type === "gate") {
              await writer.write(enc.encode(line + "\n\n"))
            } else if (event.type === "done") {
              const agentResult = event.result ?? {}
              const mandateValid = Boolean(
                demoAgent?.mandateLimit !== "none" &&
                !isMandateFailure(agentResult["error"]),
              )
              const enriched = {
                type: "done",
                result: {
                  slot,
                  agentKey: agentId,
                  agent: demoAgent,
                  route: { id: route.id, path: route.path, price: route.priceLabel },
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
      const errEvent = `data: ${JSON.stringify({ type: "done", result: { slot, body: { error: String(err) }, httpStatus: 500 } })}\n\n`
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
