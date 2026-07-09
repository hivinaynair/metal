export enum DemoAgentName {
  AGENT_1 = "metal-agent-1",
  AGENT_2 = "metal-agent-2",
  AGENT_3 = "metal-agent-3",
  GHOST = "metal-agent-ghost",
}

export type ReportRouteId = "basic" | "premium"

// Mirrors AttestationRegistry.sol enums
export enum IdentityStatus {
  NotFound = 0,
  Verified = 1,
  Flagged = 2,
}

export enum Decision {
  Approved = 0,
  Rejected = 1,
}

export interface AgentProfile {
  agentId: bigint
  wallet: `0x${string}`
  agentURI: string
}

export interface MandatePayload {
  agent: `0x${string}`
  delegator: `0x${string}`
  maxAmountUsdc: bigint
  expiry: bigint
  nonce: bigint
}

export interface SignedMandate {
  payload: MandatePayload
  signature: `0x${string}`
}

export interface DecisionProof {
  agentId: string
  payer?: string
  paymentHash?: string
  authorizationNonce?: string
  route: { path: string; price: string }
  mandate: {
    source: "x-ap2-mandate-header"
    delegator: string
    maxAmountUsdc: string
    valid: boolean
  }
  policy: {
    maxAmountUsdc: string
    decision: "approved" | "rejected"
  }
  failureGate?: "identity" | "mandate" | "policy" | "settlement" | "attestation"
  rejectionReason?: string
  settlementTxHash?: string
  attestationTxHash?: string
}

export type DecisionRecord = DecisionProof & {
  amountUsdc: string
  identityStatus: IdentityStatus
}

export interface RawMandate {
  agentId: string
  domain: { name: string; version: string; chainId: number }
  types: { MandatePayload: Array<{ name: string; type: string }> }
  payload: {
    agent: string
    delegator: string
    maxAmountUsdc: string
    expiry: string
    nonce: string
  }
  signature: string
}

export interface X402Challenge {
  scheme?: string
  network?: string
  maxAmountRequired?: string
  resource?: string
  description?: string
  error?: string
}
