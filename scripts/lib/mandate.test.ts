import { describe, it, expect } from "bun:test"
import { verifyTypedData } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES } from "../../packages/shared/src/mandate"
import { signMandate } from "./mandate"

const AGENT_KEY = "0xd54408e57b408f06b2a8149c098e5466b9d803158a92dae1d50cdbca5c816a2d" as const
const DELEGATOR_KEY = "0x1111111111111111111111111111111111111111111111111111111111111111" as const

const agentAddress = privateKeyToAccount(AGENT_KEY).address
const delegatorAddress = privateKeyToAccount(DELEGATOR_KEY).address

describe("signMandate", () => {
  it("returns payload with correct agent address", async () => {
    const result = await signMandate(agentAddress, DELEGATOR_KEY)
    expect(result.payload.agent).toBe(agentAddress)
  })

  it("returns payload with correct delegator, maxAmountUsdc, expiry, nonce", async () => {
    const result = await signMandate(agentAddress, DELEGATOR_KEY)
    expect(result.payload.delegator).toBe(delegatorAddress)
    expect(result.payload.maxAmountUsdc).toBe(100n)
    expect(result.payload.expiry).toBe(9999999999n)
    expect(result.payload.nonce).toBe(0n)
  })

  it("signature recovers to delegator address", async () => {
    const result = await signMandate(agentAddress, DELEGATOR_KEY)
    const recovered = await verifyTypedData({
      address: delegatorAddress,
      domain: MANDATE_EIP712_DOMAIN,
      types: MANDATE_EIP712_TYPES,
      primaryType: "MandatePayload",
      message: result.payload,
      signature: result.signature,
    })
    expect(recovered).toBe(true)
  })
})
