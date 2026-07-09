import { describe, expect, it } from "bun:test"
import { DemoAgentName } from "@workspace/shared/types"
import { validateRunRequest } from "./run-request.js"

const APP_URL = "http://localhost:3000"

describe("validateRunRequest", () => {
  it("rejects a missing target URL", () => {
    const result = validateRunRequest(
      {
        agentName: DemoAgentName.AGENT_1,
      },
      APP_URL
    )

    expect(result).toEqual({ ok: false, error: "targetUrl is required" })
  })

  it("rejects a target URL outside the app origin", () => {
    const result = validateRunRequest(
      {
        agentName: DemoAgentName.AGENT_1,
        targetUrl: "https://example.com/api/settlement-risk-report",
      },
      APP_URL
    )

    expect(result).toEqual({
      ok: false,
      error: "targetUrl origin is not allowed",
    })
  })

  it("rejects a target URL outside the allowed report paths", () => {
    const result = validateRunRequest(
      {
        agentName: DemoAgentName.AGENT_1,
        targetUrl: `${APP_URL}/api/admin`,
      },
      APP_URL
    )

    expect(result).toEqual({
      ok: false,
      error:
        "targetUrl path must be one of: /api/settlement-risk-report, /api/premium-risk-report",
    })
  })

  it("accepts allowed report paths", () => {
    const result = validateRunRequest(
      {
        agentName: DemoAgentName.AGENT_1,
        targetUrl: `${APP_URL}/api/settlement-risk-report`,
      },
      APP_URL
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.route.id).toBe("basic")
      expect(result.value.targetUrl).toBe(
        `${APP_URL}/api/settlement-risk-report`
      )
    }
  })
})
