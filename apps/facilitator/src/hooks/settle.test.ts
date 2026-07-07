import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Decision, IdentityStatus } from "@workspace/shared/types"

// ── Provide DATABASE_URL so getDb() lazy init doesn't throw ────────────────
process.env.DATABASE_URL = "postgresql://fake"

// ── Mock the DB module before importing settle ──────────────────────────────
const mockInsertValues = mock(async () => {})
const mockInsert = mock(() => ({ values: mockInsertValues }))

const mockSelectLimit = mock(async () => [])
const mockSelect = mock(() => ({
  from: () => ({ where: () => ({ limit: mockSelectLimit }) }),
}))

mock.module("@workspace/shared/db", () => ({
  createDb: () => ({ select: mockSelect, insert: mockInsert }),
  schema: {
    settlementAttestations: { authorizationNonce: "authorization_nonce", decision: "decision" },
  },
}))

const mockWriteContract = mock(async () => "0xattesttx")
mock.module("../lib/clients.js", () => ({
  walletClient: { writeContract: mockWriteContract },
  account: "0xaccount",
}))

mock.module("../lib/mandate-store.js", () => ({
  getMandate: mock(async () => undefined),
}))

mock.module("../lib/env.js", () => ({
  env: { POLICY_MAX_AMOUNT_USDC: "10", ATTESTATION_REGISTRY_ADDRESS: "0xreg" },
}))

mock.module("@workspace/shared/abis", () => ({ ATTESTATION_REGISTRY_ABI: [] }))
mock.module("drizzle-orm", () => ({
  and: mock((...args: unknown[]) => args),
  eq: mock((a: unknown, b: unknown) => [a, b]),
}))

const { onBeforeSettle, onAfterSettle, onSettleFailure } = await import("./settle.js")

const PAYER = "0xe9F97E2F7c6DCB8FCdBCDFBA074334D22a6c3117" as `0x${string}`
const AUTH_NONCE = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
const NETWORK = "eip155:84532" as const
const SETTLEMENT_TX = "0xsettlementtxhash"

function makePayload(nonce?: string) {
  return {
    payload: { from: PAYER, authorization: { from: PAYER, nonce } },
    accepted: { amount: "10000000", network: NETWORK, scheme: "exact", asset: "usdc", payTo: PAYER, maxTimeoutSeconds: 60 },
  }
}

function makeRequirements(amount = "10000000") {
  return { amount, network: NETWORK, scheme: "exact", asset: "usdc", payTo: PAYER, maxTimeoutSeconds: 60 }
}

beforeEach(() => {
  mockSelect.mockClear()
  mockInsert.mockClear()
  mockInsertValues.mockClear()
  mockSelectLimit.mockClear()
  mockWriteContract.mockClear()
  mockSelectLimit.mockImplementation(async () => [])
})

describe("onBeforeSettle", () => {
  it("does not abort when amount is within policy", async () => {
    const result = await onBeforeSettle({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements("1000") as any,
    })
    expect(result).toBeUndefined()
  })

  it("aborts with policy_amount_exceeded when amount exceeds ceiling", async () => {
    const result = await onBeforeSettle({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements("20000000") as any,
    })
    expect(result).toEqual({ abort: true, reason: "policy_amount_exceeded" })
  })

  it("paymentHash is deterministic — same inputs produce same value in DB", async () => {
    const ctx = {
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements("20000000") as any,
    }
    await onBeforeSettle(ctx)
    await onBeforeSettle(ctx)

    expect(mockInsertValues).toHaveBeenCalledTimes(2)
    const [first, second] = mockInsertValues.mock.calls
    expect(first![0].paymentHash).toBe(second![0].paymentHash)
  })

  it("stores authorizationNonce on policy rejection", async () => {
    await onBeforeSettle({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements("20000000") as any,
    })
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationNonce: AUTH_NONCE, decision: Decision.Rejected })
    )
  })
})

describe("onAfterSettle", () => {
  it("inserts approved record with authorizationNonce", async () => {
    await onAfterSettle({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      result: { success: true, transaction: SETTLEMENT_TX, network: NETWORK },
    })
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementTx: SETTLEMENT_TX,
        authorizationNonce: AUTH_NONCE,
        decision: Decision.Approved,
      })
    )
  })

  it("still inserts DB record if attestation write fails", async () => {
    mockWriteContract.mockRejectedValueOnce(new Error("gas spike"))
    await onAfterSettle({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      result: { success: true, transaction: SETTLEMENT_TX, network: NETWORK },
    })
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ attestationTx: null, decision: Decision.Approved })
    )
  })

  it("returns early when result is not successful", async () => {
    await onAfterSettle({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      result: { success: false, transaction: "", network: NETWORK },
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe("onSettleFailure", () => {
  it("returns void when auth nonce is missing from payload", async () => {
    const result = await onSettleFailure({
      paymentPayload: makePayload(undefined) as any,
      requirements: makeRequirements() as any,
      error: new Error("nonce used"),
    })
    expect(result).toBeUndefined()
  })

  it("returns void when no matching approved record in DB", async () => {
    const result = await onSettleFailure({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements() as any,
      error: new Error("nonce used"),
    })
    expect(result).toBeUndefined()
  })

  it("recovers with cached txHash when approved record exists", async () => {
    mockSelectLimit.mockImplementationOnce(async () => [
      { settlementTx: SETTLEMENT_TX, decision: Decision.Approved },
    ])

    const result = await onSettleFailure({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements() as any,
      error: new Error("nonce used"),
    })

    expect(result).toEqual({
      recovered: true,
      result: { success: true, transaction: SETTLEMENT_TX, network: NETWORK },
    })
  })

  it("returns void when approved record exists but settlementTx is null", async () => {
    mockSelectLimit.mockImplementationOnce(async () => [
      { settlementTx: null, decision: Decision.Approved },
    ])

    const result = await onSettleFailure({
      paymentPayload: makePayload(AUTH_NONCE) as any,
      requirements: makeRequirements() as any,
      error: new Error("nonce used"),
    })
    expect(result).toBeUndefined()
  })
})
