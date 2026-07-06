import { describe, it, expect, mock } from "bun:test"
import { lookupIdentity } from "./identity"
import { ERC8004_ADDRESS } from "./abis"
import type { AgentProfile } from "./types"

const REGISTRY = ERC8004_ADDRESS
const AGENT_ID = 42n
const WALLET = "0xdeadbeef00000000000000000000000000000002" as `0x${string}`
const AGENT_URI = "http://localhost:3000/api/agent/0xdeadbeef00000000000000000000000000000002"

const registered: AgentProfile = {
  agentId: AGENT_ID,
  wallet: WALLET,
  agentURI: AGENT_URI,
}

describe("lookupIdentity", () => {
  it("returns profile for registered agentId", async () => {
    const client = {
      readContract: mock((args: any) => {
        if (args.functionName === "tokenURI") return Promise.resolve(AGENT_URI)
        if (args.functionName === "getAgentWallet") return Promise.resolve(WALLET)
        return Promise.reject(new Error("unexpected call"))
      }),
    }
    const result = await lookupIdentity(AGENT_ID, REGISTRY, client as any)
    expect(result).toEqual(registered)
  })

  it("returns null when tokenURI is empty (unregistered agentId)", async () => {
    const client = {
      readContract: mock((args: any) => {
        if (args.functionName === "tokenURI") return Promise.resolve("")
        if (args.functionName === "getAgentWallet") return Promise.resolve(WALLET)
        return Promise.reject(new Error("unexpected call"))
      }),
    }
    const result = await lookupIdentity(AGENT_ID, REGISTRY, client as any)
    expect(result).toBeNull()
  })

  it("returns null and does not throw when contract call rejects", async () => {
    const client = {
      readContract: mock(() => Promise.reject(new Error("not a contract"))),
    }
    const result = await lookupIdentity(AGENT_ID, REGISTRY, client as any)
    expect(result).toBeNull()
  })
})
