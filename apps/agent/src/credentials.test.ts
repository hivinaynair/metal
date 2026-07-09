import { afterEach, describe, expect, it } from "bun:test"
import { getAp2CredentialForAgent } from "./credentials"

const AGENT = "0xBf43C2E070BeCF6F5eAC23787813c9ad8747Be46"
const AGENT_LOWER = AGENT.toLowerCase()

const MANDATE = {
  agentId: "7889",
  payload: {
    agent: AGENT,
    delegator: "0xe3F1Bac5798fe72a0fF43d8eA6Ae8e87E2d7E81C",
    maxAmountUsdc: "1",
    expiry: "9999999999",
    nonce: "7889",
  },
  signature:
    "0x961f874aaf9fb59cc4b763f9130e7914e9b6546b81e0e5f6d52727ced2520e531369ebf47b927ef164eeeff80f2e21e4d34a879f42948e8a7f4cbea5f075b1671c",
}

afterEach(() => {
  delete process.env.MANDATES_JSON
})

describe("getAp2CredentialForAgent", () => {
  it("reads MANDATES_JSON keyed by lower-case address", () => {
    process.env.MANDATES_JSON = JSON.stringify({ [AGENT_LOWER]: MANDATE })

    const credential = getAp2CredentialForAgent(AGENT)

    expect(credential?.entry.agentId).toBe(7889n)
    expect(credential?.entry.mandate.payload.agent).toBe(AGENT)
  })

  it("normalizes checksum keys in MANDATES_JSON", () => {
    process.env.MANDATES_JSON = JSON.stringify({ [AGENT]: MANDATE })

    const credential = getAp2CredentialForAgent(AGENT_LOWER)

    expect(credential?.entry.agentId).toBe(7889n)
  })

  it("accepts a nested mandates object", () => {
    process.env.MANDATES_JSON = JSON.stringify({ mandates: { [AGENT]: MANDATE } })

    const credential = getAp2CredentialForAgent(AGENT)

    expect(credential?.entry.agentId).toBe(7889n)
  })

  it("accepts stringified mandate values", () => {
    process.env.MANDATES_JSON = JSON.stringify({ [AGENT]: JSON.stringify(MANDATE) })

    const credential = getAp2CredentialForAgent(AGENT)

    expect(credential?.entry.agentId).toBe(7889n)
  })
})
