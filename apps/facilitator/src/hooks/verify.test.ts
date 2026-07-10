import { describe, it, expect, mock } from "bun:test"
import { buildVerifyRejectionPaymentHash, onBeforeVerify, type VerifyDeps } from "./verify.js"
import type { AgentProfile } from "@workspace/shared/types"
import type { SignedMandate } from "@workspace/shared/mandate"
import { serializeMandateHeader } from "@workspace/shared/mandate-header"
import { requestCtx } from "../lib/request-context.js"

const PAYER = "0xe9F97E2F7c6DCB8FCdBCDFBA074334D22a6c3117" as `0x${string}`
const DELEGATOR = "0xAa870A9C6FEd34B8aC01Da17d675d748f238a420" as `0x${string}`
const REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`
const AGENT_ID = 1n

const VALID_MANDATE: SignedMandate = {
  payload: {
    agent: PAYER,
    delegator: DELEGATOR,
    maxAmountUsdc: 100n,
    expiry: 9999999999n,
    nonce: 0n,
  },
  signature: "0x44c8561e7d2102913d710e6602bff7b81a06ab57f81761328d6d60d6d5ec95070cf73e7f3b452afda359fec26af2b7544c4e56c680640156b8a125993e30793b1b",
}

const VALID_PROFILE: AgentProfile = {
  agentId: AGENT_ID,
  wallet: PAYER,
  agentURI: "http://localhost:3000/api/agent/0xe9F97E2F7c6DCB8FCdBCDFBA074334D22a6c3117",
}

const DEFAULT_AMOUNT_ATOMIC = "10000"
const AUTH_NONCE = "0xabc123"

function makeCtx(amountAtomic = DEFAULT_AMOUNT_ATOMIC) {
  return {
    paymentPayload: {
      resource: "http://localhost:3000/api/settlement-risk-report",
      payload: { from: PAYER, authorization: { nonce: AUTH_NONCE } },
      accepted: { amount: amountAtomic },
    },
    requirements: { amount: amountAtomic },
  } as any
}

function happyDeps(overrides: Partial<VerifyDeps> = {}): VerifyDeps {
  return {
    verifyMandateSignature: mock(async () => true),
    lookupIdentity: mock(async () => VALID_PROFILE),
    registryAddress: REGISTRY,
    client: {} as any,
    ...overrides,
  }
}

function withMandateHeader<T>(
  fn: () => Promise<T>,
  mandate: SignedMandate = VALID_MANDATE,
  agentId = AGENT_ID,
) {
  return requestCtx.run({
    mandateJson: serializeMandateHeader({ mandate, agentId }),
  }, fn)
}

describe("onBeforeVerify", () => {
  it("builds deterministic rejection hashes from authorization nonce", () => {
    const input = {
      amountAtomic: 200000n,
      authorizationNonce: AUTH_NONCE,
      payer: PAYER,
      reason: "identity_not_found",
      resource: "http://localhost:3000/api/settlement-risk-report",
    }
    expect(buildVerifyRejectionPaymentHash(input)).toBe(buildVerifyRejectionPaymentHash(input))
    expect(buildVerifyRejectionPaymentHash(input)).not.toBe(
      buildVerifyRejectionPaymentHash({ ...input, reason: "mandate_amount_exceeded" })
    )
  })

  it("aborts when mandate header is missing", async () => {
    const result = await onBeforeVerify(makeCtx(), happyDeps())
    expect(result).toEqual({ abort: true, reason: "mandate_missing" })
  })

  it("aborts when mandate signature is invalid", async () => {
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx(), happyDeps({
        verifyMandateSignature: mock(async () => false),
      }))
    )
    expect(result).toEqual({ abort: true, reason: "mandate_invalid" })
  })

  it("aborts when mandate is expired", async () => {
    const expired: SignedMandate = {
      ...VALID_MANDATE,
      payload: { ...VALID_MANDATE.payload, expiry: 1n },
    }
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx(), happyDeps()),
      expired,
    )
    expect(result).toEqual({ abort: true, reason: "mandate_expired" })
  })

  it("aborts when payment amount exceeds mandate maxAmountUsdc", async () => {
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx("101000000"), happyDeps())
    )
    expect(result).toEqual({ abort: true, reason: "mandate_amount_exceeded" })
  })

  it("aborts when agent not found in ERC-8004 (lookup returns null)", async () => {
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx(), happyDeps({
        lookupIdentity: mock(async () => null),
      }))
    )
    expect(result).toEqual({ abort: true, reason: "identity_not_found" })
  })

  it("checks ERC-8004 identity before amount for the zero-limit ghost mandate", async () => {
    const ghostMandate: SignedMandate = {
      ...VALID_MANDATE,
      payload: { ...VALID_MANDATE.payload, maxAmountUsdc: 0n, nonce: 0n },
    }
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx("200000"), happyDeps({
        lookupIdentity: mock(async () => null),
      })),
      ghostMandate,
      0n,
    )
    expect(result).toEqual({ abort: true, reason: "identity_not_found" })
  })

  it("aborts when ERC-8004 wallet does not match payer", async () => {
    const wrongWallet = "0x0000000000000000000000000000000000000001" as `0x${string}`
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx(), happyDeps({
        lookupIdentity: mock(async () => ({ ...VALID_PROFILE, wallet: wrongWallet })),
      }))
    )
    expect(result).toEqual({ abort: true, reason: "identity_not_found" })
  })

  it("returns undefined when all checks pass", async () => {
    const result = await withMandateHeader(() =>
      onBeforeVerify(makeCtx(), happyDeps())
    )
    expect(result).toBeUndefined()
  })
})
