import type { Hex } from "viem"
import { DemoAgentName } from "@workspace/shared/types"

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

export const AGENT_URL = requireEnv("AGENT_URL")
export const FACILITATOR_URL = requireEnv("FACILITATOR_URL")
export const DATABASE_URL = requireEnv("DATABASE_URL")
export const DELEGATOR_KEY = requireEnv("DELEGATOR_PRIVATE_KEY") as Hex

// Unix timestamp year ~2286: effectively non-expiring for this demo.
export const MANDATE_FAR_FUTURE_EXPIRY = 9999999999n

// Agents without spending authority should not be registered in ERC-8004.
export const NO_REGISTER = new Set<DemoAgentName>([DemoAgentName.GHOST])

// Placeholder on-chain ID for unregistered agents
export const UNREGISTERED_AGENT_ID = 0n

// Max spending per agent in whole USDC: 1n = $1.00.
export const MAX_AMOUNT: Record<DemoAgentName, bigint> = {
  [DemoAgentName.AGENT_1]: 1n,
  [DemoAgentName.AGENT_2]: 1n,
  [DemoAgentName.AGENT_3]: 10n,
  [DemoAgentName.GHOST]: 0n,
}

export const AP2_CREDENTIAL_TYPE = "ap2_mandate"
