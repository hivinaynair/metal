import {
  DEMO_REPORT_ROUTES,
  getDemoReportRouteByPath,
  type DemoReportRoute,
} from "@workspace/shared/demo"
import { AgentId } from "@workspace/shared/types"

export interface AgentRunRequest {
  agentId: AgentId
  targetUrl: string
}

export interface ValidatedAgentRunRequest extends AgentRunRequest {
  route: DemoReportRoute
}

export function validateRunRequest(
  body: { agentId?: unknown; targetUrl?: unknown },
  appUrl: string,
): { ok: true; value: ValidatedAgentRunRequest } | { ok: false; error: string } {
  if (typeof body.agentId !== "string" || !Object.values(AgentId).includes(body.agentId as AgentId)) {
    return { ok: false, error: "agentId must be a known demo agent" }
  }
  if (typeof body.targetUrl !== "string") {
    return { ok: false, error: "targetUrl is required" }
  }
  let appOrigin: string
  let target: URL
  try {
    appOrigin = new URL(appUrl).origin
    target = new URL(body.targetUrl)
  } catch {
    return { ok: false, error: "targetUrl must be a valid URL" }
  }

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
    value: {
      agentId: body.agentId as AgentId,
      targetUrl: target.toString(),
      route,
    },
  }
}
