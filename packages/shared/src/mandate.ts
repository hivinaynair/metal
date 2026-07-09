export type { MandatePayload, SignedMandate } from "./types.js"
import { BASE_SEPOLIA_CHAIN_ID } from "./chains.js"

// AP2 is Metal's agent authorization primitive — a signed delegation from an
// institution (delegator) to an agent, scoping what the agent may spend.
// This EIP-712 domain name identifies AP2 mandates for signature verification.
// chainId prevents cross-chain replay of signed mandates.
export const MANDATE_EIP712_DOMAIN = {
  name: "AP2Mandate",
  version: "1",
  chainId: BASE_SEPOLIA_CHAIN_ID,
} as const

export const MANDATE_EIP712_TYPES = {
  MandatePayload: [
    { name: "agent", type: "address" },
    { name: "delegator", type: "address" },
    { name: "maxAmountUsdc", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const
