export type PolicyAgent = {
  address: string
  name: string
  maxAmountUsdc: number
  delegatorAddress: string
  expiry: string
  expired: boolean
  onChainTrusted: boolean
}

export type PolicyResource = {
  id: string
  label: string
  path: string
  price: number
}

export type PolicyProofRun = {
  failedRule: string
  amount: string
  limit: string
  settlementTx: string
}

export type EvaluationResult =
  | { pass: true; reason: string }
  | { pass: false; rule: string; reason: string }

export function clampPolicyMax(value: number) {
  return Math.max(0.1, Math.min(25, Math.round(value * 10) / 10))
}

export function evaluatePolicy({
  agent,
  amount,
  maxAmountUsdc,
}: {
  agent: PolicyAgent
  amount: string
  maxAmountUsdc: number
}): EvaluationResult {
  const parsedAmount = Number.parseFloat(amount)
  const paymentAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0

  if (!agent.onChainTrusted) {
    return {
      pass: false,
      rule: "requireIdentity",
      reason: "Agent is not registered in ERC-8004.",
    }
  }

  if (agent.expired) {
    return {
      pass: false,
      rule: "requireMandate",
      reason: `Mandate expired ${agent.expiry}.`,
    }
  }

  if (paymentAmount > maxAmountUsdc) {
    return {
      pass: false,
      rule: "maxAmountUsdc",
      reason: `${paymentAmount.toFixed(2)} USDC exceeds ${maxAmountUsdc.toFixed(2)} USDC policy limit.`,
    }
  }

  if (paymentAmount > agent.maxAmountUsdc) {
    return {
      pass: false,
      rule: "mandateLimit",
      reason: `${paymentAmount.toFixed(2)} USDC exceeds ${agent.maxAmountUsdc.toFixed(2)} USDC mandate.`,
    }
  }

  return {
    pass: true,
    reason: "Payment satisfies the configured policy and mandate.",
  }
}
