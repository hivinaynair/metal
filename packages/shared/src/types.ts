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
  name: string
  metadataUri: string
  registeredAt: bigint
  exists: boolean
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
