import type { SignedMandate } from "@workspace/shared/mandate"

interface MandateEntry {
  mandate: SignedMandate
  agentId: bigint
}

const store = new Map<string, MandateEntry>()

export function registerMandate(mandate: SignedMandate, agentId: bigint): void {
  store.set(mandate.payload.agent.toLowerCase(), { mandate, agentId })
}

export function getMandate(agent: string): MandateEntry | undefined {
  return store.get(agent.toLowerCase())
}
