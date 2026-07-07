import { createPublicClient, decodeEventLog, encodeFunctionData, http } from "viem"
import type { Hash, TransactionReceipt } from "viem"
import { baseSepolia } from "viem/chains"
import { ERC8004_ABI, ERC8004_ADDRESS } from "./abis.js"
import { BASE_SEPOLIA_EXPLORER } from "./chains.js"

// Minimal interface for a CDP EvmServerAccount — only what we need here.
// useNetwork returns a generic type in the SDK so we use any for compatibility.
interface CdpAccount {
  address: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useNetwork(network: string): Promise<any>
}

// Minimal interface — only the method we actually call on publicClient.
interface TxWaiter {
  waitForTransactionReceipt: (args: { hash: Hash }) => Promise<TransactionReceipt>
}

// Registers an agent in ERC-8004. Returns the minted agentId (tokenId).
export async function registerInErc8004(
  cdpAccount: CdpAccount,
  appUrl: string,
  publicClient?: TxWaiter,
): Promise<bigint> {
  const networkAccount = await cdpAccount.useNetwork("base-sepolia")

  const agentURI = `${appUrl}/api/agent/${cdpAccount.address}`
  console.log(`[erc8004] Registering: ${agentURI}`)

  const data = encodeFunctionData({
    abi: ERC8004_ABI,
    functionName: "register",
    args: [agentURI],
  })

  const { transactionHash } = await networkAccount.sendTransaction({
    transaction: { to: ERC8004_ADDRESS, data },
  })

  const hash = transactionHash as Hash
  console.log(`[erc8004] Tx: ${BASE_SEPOLIA_EXPLORER}/tx/${hash}`)

  // Use CDP's waitForTransactionReceipt if no publicClient provided
  const receipt = publicClient
    ? await publicClient.waitForTransactionReceipt({ hash })
    : await networkAccount.waitForTransactionReceipt({ transactionHash })

  // ERC-721 mint emits Transfer(from=0x0, to=registrant, tokenId=agentId)
  const transferLog = (receipt as TransactionReceipt).logs.find((log) => {
    try {
      return decodeEventLog({ abi: ERC8004_ABI, ...log }).eventName === "Transfer"
    } catch {
      return false
    }
  })

  if (!transferLog) throw new Error(`No Transfer event in ERC-8004 tx for ${cdpAccount.address}`)

  const decoded = decodeEventLog({ abi: ERC8004_ABI, ...transferLog })
  const agentId = (decoded.args as Record<string, unknown>).tokenId as bigint

  console.log(`[erc8004] Registered — agentId: ${agentId}`)
  return agentId
}
