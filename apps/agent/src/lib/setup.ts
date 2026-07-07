import { decodeEventLog, encodeFunctionData } from "viem"
import { ERC8004_ABI, ERC8004_ADDRESS } from "@workspace/shared/abis"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { setEnvVar } from "./persist.ts"
import type { EvmServerAccount } from "@coinbase/cdp-sdk"

// Registers the agent in ERC-8004 using msg.sender = cdpAccount.
// Called once at startup when AGENT_ID is not yet set.
// Persists the returned agentId to .env.local.
export async function registerInErc8004(
  cdpAccount: EvmServerAccount,
  appUrl: string,
): Promise<bigint> {
  const networkAccount = await cdpAccount.useNetwork("base-sepolia")

  const agentURI = `${appUrl}/api/agent/${cdpAccount.address}`
  console.log(`[Metal Agent] Registering in ERC-8004: ${agentURI}`)

  const data = encodeFunctionData({
    abi: ERC8004_ABI,
    functionName: "register",
    args: [agentURI],
  })

  const { transactionHash } = await networkAccount.sendTransaction({
    transaction: { to: ERC8004_ADDRESS, data },
  })

  console.log(`[Metal Agent] Tx: ${BASE_SEPOLIA_EXPLORER}/tx/${transactionHash}`)
  const receipt = await networkAccount.waitForTransactionReceipt({ transactionHash })

  // ERC-721 mint emits Transfer(from=0x0, to=registrant, tokenId=agentId)
  const transferLog = receipt.logs.find((log) => {
    try {
      const decoded = decodeEventLog({ abi: ERC8004_ABI, ...log })
      return decoded.eventName === "Transfer"
    } catch {
      return false
    }
  })

  if (!transferLog) throw new Error("Could not find Transfer event in ERC-8004 registration tx")

  const decoded = decodeEventLog({ abi: ERC8004_ABI, ...transferLog })
  const agentId = (decoded.args as Record<string, unknown>).tokenId as bigint

  setEnvVar("AGENT_ID", agentId.toString())
  console.log(`[Metal Agent] Registered — agentId: ${agentId}`)

  return agentId
}
