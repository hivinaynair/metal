import { demoAgents } from "@/lib/demo-scenarios"

export interface AgentWithMandate {
  address: string
  name: string
  agentId: bigint
  maxAmountUsdc: bigint
  delegatorAddress: string
  expiry: bigint
}

export async function getAgentsWithMandates(): Promise<AgentWithMandate[]> {
  return demoAgents
    .filter((agent) => agent.mandateLimit !== "none")
    .map((agent, index) => ({
      address: `demo:${agent.id}`,
      name: agent.id,
      agentId: BigInt(index + 1),
      maxAmountUsdc: BigInt(agent.mandateLimit.replace("$", "")),
      delegatorAddress: "0x0000000000000000000000000000000000000000",
      expiry: 9999999999n,
    }))
}
