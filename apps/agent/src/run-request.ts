import { z } from "zod"
import {
  DEMO_REPORT_ROUTES,
  getDemoReportRouteByPath,
  type DemoReportRoute,
} from "@workspace/shared/demo"
import { DemoAgentName } from "@workspace/shared/types"

export type AgentRunRequest = {
  agentName: DemoAgentName
  targetUrl: string
}

export type ValidatedAgentRunRequest = AgentRunRequest & {
  route: DemoReportRoute
}

const runRequestSchema = z.object({
  agentName: z.nativeEnum(DemoAgentName, {
    message: "agentName must be a known demo agent",
  }),
  targetUrl: z
    .string({ required_error: "targetUrl is required" })
    .url("targetUrl must be a valid URL"),
})

export function validateRunRequest(
  body: unknown,
  appUrl: string
): { ok: true; value: ValidatedAgentRunRequest } | { ok: false; error: string } {
  const appOrigin = new URL(appUrl).origin

  const parsed = runRequestSchema.safeParse(body)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" }
  }

  const target = new URL(parsed.data.targetUrl)

  if (target.origin !== appOrigin) {
    return { ok: false, error: "targetUrl origin is not allowed" }
  }

  const route = getDemoReportRouteByPath(target.pathname)
  
  if (!route) {
    const allowed = DEMO_REPORT_ROUTES.map((r) => r.path).join(", ")
    return { ok: false, error: `targetUrl path must be one of: ${allowed}` }
  }

  return {
    ok: true,
    value: { agentName: parsed.data.agentName, targetUrl: target.toString(), route },
  }
}
