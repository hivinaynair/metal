import { DEMO_POLICY_MAX_AMOUNT_USDC } from "@workspace/shared/demo"

let policyMaxAmountUsdc = Number(process.env.POLICY_MAX_AMOUNT_USDC ?? DEMO_POLICY_MAX_AMOUNT_USDC)

export function getPolicyMaxAmountUsdc() {
  return policyMaxAmountUsdc
}

export function getPolicyMaxAtomic(): bigint {
  return BigInt(Math.round(policyMaxAmountUsdc * 1_000_000))
}

export function setPolicyMaxAmountUsdc(value: number) {
  policyMaxAmountUsdc = value
}
