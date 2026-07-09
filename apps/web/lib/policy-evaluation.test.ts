import { describe, expect, it } from "bun:test"

import { evaluatePolicy, type PolicyAgent } from "./policy-evaluation"

const agent: PolicyAgent = {
  address: "0xagent",
  name: "metal-agent-1",
  maxAmountUsdc: 0,
  delegatorAddress: "0xdelegator",
  expiry: "2099-01-01",
  expired: false,
}

describe("evaluatePolicy", () => {
  it("reports the active policy limit before a lower mandate cap", () => {
    expect(
      evaluatePolicy({
        agent,
        amount: "3.00",
        maxAmountUsdc: 1,
        requireMandate: true,
      })
    ).toEqual({
      pass: false,
      rule: "maxAmountUsdc",
      reason: "3.00 USDC exceeds 1.00 USDC policy limit.",
    })
  })

  it("reports the mandate limit when the active policy allows the amount", () => {
    expect(
      evaluatePolicy({
        agent,
        amount: "0.50",
        maxAmountUsdc: 1,
        requireMandate: true,
      })
    ).toEqual({
      pass: false,
      rule: "mandateLimit",
      reason: "0.50 USDC exceeds 0.00 USDC mandate.",
    })
  })
})
