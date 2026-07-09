import { env } from "./env.js"

let policyMaxAmountUsdc = Number(env.POLICY_MAX_AMOUNT_USDC)

export function getPolicyMaxAmountUsdc() {
  return policyMaxAmountUsdc
}

export function getPolicyMaxAtomic(): bigint {
  return BigInt(Math.round(policyMaxAmountUsdc * 1_000_000))
}

export function setPolicyMaxAmountUsdc(value: number) {
  policyMaxAmountUsdc = value
}
