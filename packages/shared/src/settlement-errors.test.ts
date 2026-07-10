import { describe, expect, it } from "bun:test"
import { isMandateFailure, settlementFailureGate } from "./settlement-errors"

describe("settlement error mapping", () => {
  it("maps deployed mandate signature errors to the mandate gate", () => {
    expect(isMandateFailure("mandate_signature_invalid")).toBe(true)
    expect(settlementFailureGate("mandate_signature_invalid")).toBe(3)
  })

  it("treats future mandate_* reasons as mandate failures", () => {
    expect(isMandateFailure("mandate_scope_invalid")).toBe(true)
    expect(settlementFailureGate("mandate_scope_invalid")).toBe(3)
  })

  it("maps x402 insufficient funds to the payment-submitted gate", () => {
    expect(isMandateFailure("insufficient_funds")).toBe(false)
    expect(settlementFailureGate("insufficient_funds")).toBe(1)
  })
})
