import type { Address, Hex } from "viem"
import type { MandatePayload } from "@workspace/shared/mandate"
import type { DemoAgentName } from "@workspace/shared/types"

export type AgentFromServer = {
  agentName: DemoAgentName
  address: Address
}

export type SignedMandateForBootstrap = {
  payload: MandatePayload
  signature: Hex
}
