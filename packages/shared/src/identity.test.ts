import { describe, it, expect, mock } from "bun:test"
import { lookupIdentity } from "./identity"
import type { AgentProfile } from "./types"

const REGISTRY = "0x1234000000000000000000000000000000000001" as `0x${string}`
const AGENT = "0xdeadbeef00000000000000000000000000000002" as `0x${string}`

const registered: AgentProfile = {
  name: "Demo Agent",
  metadataUri: "https://example.com/agent",
  registeredAt: 1234567890n,
  exists: true,
}

const unregistered: AgentProfile = {
  name: "",
  metadataUri: "",
  registeredAt: 0n,
  exists: false,
}

describe("lookupIdentity", () => {
  it("returns profile for registered address", async () => {
    const client = { readContract: mock(() => Promise.resolve(registered)) }
    const result = await lookupIdentity(AGENT, REGISTRY, client as any)
    expect(result).toEqual(registered)
  })

  it("returns null for unregistered address", async () => {
    const client = { readContract: mock(() => Promise.resolve(unregistered)) }
    const result = await lookupIdentity(AGENT, REGISTRY, client as any)
    expect(result).toBeNull()
  })

  it("returns null and does not throw when contract call rejects", async () => {
    const client = { readContract: mock(() => Promise.reject(new Error("not a contract"))) }
    const result = await lookupIdentity(AGENT, REGISTRY, client as any)
    expect(result).toBeNull()
  })
})
