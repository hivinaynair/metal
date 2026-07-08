import { DEMO_REPORT_ROUTES, failureGateForReason } from "./demo.js"
import { Decision, IdentityStatus, type DecisionRecord, type SignedMandate } from "./types.js"

export function formatUsdcAtomic(amount: bigint) {
  const whole = amount / 1_000_000n
  const fraction = amount % 1_000_000n
  if (fraction === 0n) return whole.toString()
  return `${whole}.${fraction.toString().padStart(6, "0").replace(/0+$/, "")}`
}

export function routeFromResource(resource: unknown, amountAtomic: bigint) {
  let path: string | undefined
  if (typeof resource === "string") {
    try {
      path = new URL(resource, "http://local.invalid").pathname
    } catch {
      path = undefined
    }
  }
  const known = path ? DEMO_REPORT_ROUTES.find((route) => route.path === path) : undefined
  return {
    path: known?.path ?? path ?? "unknown",
    price: known?.priceLabel ?? `$${formatUsdcAtomic(amountAtomic)}`,
  }
}

export function buildDecisionRecord({
  agentId,
  amountAtomic,
  decision,
  identityStatus,
  mandate,
  payer,
  paymentHash,
  policyMaxAtomic,
  resource,
  rejectionReason,
  settlementTxHash,
  attestationTxHash,
  authorizationNonce,
}: {
  agentId?: bigint | string
  amountAtomic: bigint
  decision: Decision
  identityStatus: IdentityStatus
  mandate?: SignedMandate
  payer?: string
  paymentHash?: string
  policyMaxAtomic: bigint
  resource?: unknown
  rejectionReason?: string
  settlementTxHash?: string
  attestationTxHash?: string | null
  authorizationNonce?: string | null
}): DecisionRecord {
  const rejected = decision === Decision.Rejected
  return {
    agentId: agentId?.toString() ?? "unknown",
    payer,
    paymentHash,
    authorizationNonce: authorizationNonce ?? undefined,
    route: routeFromResource(resource, amountAtomic),
    amountUsdc: formatUsdcAtomic(amountAtomic),
    mandate: {
      source: "x-ap2-mandate-header",
      delegator: mandate?.payload.delegator ?? "unknown",
      maxAmountUsdc: mandate?.payload.maxAmountUsdc.toString() ?? "unknown",
      valid: !rejectionReason?.startsWith("mandate_"),
    },
    policy: {
      maxAmountUsdc: formatUsdcAtomic(policyMaxAtomic),
      decision: rejected ? "rejected" : "approved",
    },
    identityStatus,
    failureGate: rejected ? failureGateForReason(rejectionReason) : undefined,
    rejectionReason,
    settlementTxHash,
    attestationTxHash: attestationTxHash ?? undefined,
  }
}
