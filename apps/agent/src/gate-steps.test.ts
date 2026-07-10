import { describe, expect, it } from "bun:test"
import { gateStepsForResult } from "./gate-steps.js"

describe("gateStepsForResult", () => {
  it("emits settlement gates on success", () => {
    expect(gateStepsForResult(undefined, "0xabc")).toEqual([2, 3, 4, 5])
  })

  it("stops at identity gate for identity_not_found", () => {
    expect(gateStepsForResult("identity_not_found", undefined)).toEqual([2])
  })

  it("stops at AP2 gate for mandate failures", () => {
    expect(gateStepsForResult("mandate_amount_exceeded", undefined)).toEqual([2, 3])
    expect(gateStepsForResult("mandate_missing", undefined)).toEqual([2, 3])
    expect(gateStepsForResult("mandate_invalid", undefined)).toEqual([2, 3])
    expect(gateStepsForResult("mandate_signature_invalid", undefined)).toEqual([2, 3])
    expect(gateStepsForResult("mandate_expired", undefined)).toEqual([2, 3])
  })

  it("stops at the x402 gate for insufficient funds", () => {
    expect(gateStepsForResult("insufficient_funds", undefined)).toEqual([])
  })

  it("stops at policy gate for policy_amount_exceeded", () => {
    expect(gateStepsForResult("policy_amount_exceeded", undefined)).toEqual([2, 3, 4])
  })

  it("stops at settlement gate for invalid_exact_evm errors", () => {
    expect(gateStepsForResult("invalid_exact_evm_insufficient_balance", undefined)).toEqual([2, 3, 4, 5])
    expect(gateStepsForResult("invalid_exact_evm_some_other_error", undefined)).toEqual([2, 3, 4, 5])
    expect(gateStepsForResult("settlement_transaction_failed", undefined)).toEqual([2, 3, 4, 5])
    expect(gateStepsForResult("settlement_receipt_unconfirmed", undefined)).toEqual([2, 3, 4, 5])
  })

  it("emits no gates for unknown errors", () => {
    expect(gateStepsForResult("some_unknown_error", undefined)).toEqual([])
  })

  it("emits no gates when there is no error and no settlement tx", () => {
    expect(gateStepsForResult(undefined, undefined)).toEqual([])
  })
})
