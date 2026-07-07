import { env } from "./env.js"

let policyMaxAmountUsdc = env.POLICY_MAX_AMOUNT_USDC

export function getPolicyMaxAmountUsdc() {
  return policyMaxAmountUsdc
}

export function setPolicyMaxAmountUsdc(value: number) {
  policyMaxAmountUsdc = value
}
