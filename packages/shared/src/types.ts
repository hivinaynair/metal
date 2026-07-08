export enum AgentId {
  AGENT_1 = "metal-agent-1",
  AGENT_2 = "metal-agent-2",
  AGENT_3 = "metal-agent-3",
  GHOST = "metal-agent-ghost",
}

export type ReportRouteId = "basic" | "premium"

// Maps each agent to the report route it is authorized to access
export const AGENT_ROUTE: Record<AgentId, ReportRouteId> = {
  [AgentId.AGENT_1]: "basic",
  [AgentId.AGENT_2]: "premium",
  [AgentId.AGENT_3]: "premium",
  [AgentId.GHOST]: "basic",
}

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
