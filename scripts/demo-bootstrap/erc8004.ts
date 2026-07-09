import { decodeEventLog, encodeFunctionData } from "viem"
import type { Hash, TransactionReceipt } from "viem"
import { ERC8004_ABI, ERC8004_ADDRESS } from "@workspace/shared/abis"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"

const BASE_SEPOLIA_NETWORK = "base-sepolia"

// Minimal interface for a CDP EvmServerAccount. The SDK's useNetwork return
// type is generic, so keep this local to the script instead of sharing it.
type CdpAccount = {
  address: string
  useNetwork(network: typeof BASE_SEPOLIA_NETWORK): Promise<CdpNetworkAccount>
}

type CdpNetworkAccount = {
  sendTransaction: (args: {
    transaction: { to: typeof ERC8004_ADDRESS; data: Hash }
  }) => Promise<{ transactionHash: Hash }>
  waitForTransactionReceipt: (args: {
    transactionHash: Hash
  }) => Promise<TransactionReceipt>
}

// Registers an agent in ERC-8004. Returns the minted agentId (tokenId).
export async function registerInErc8004(
  cdpAccount: CdpAccount,
  agentUrl: string
): Promise<bigint> {
  const agentURI = `${agentUrl.replace(/\/+$/, "")}/api/agent/${cdpAccount.address}`
  console.log(`[erc8004] Registering: ${agentURI}`)

  const networkAccount = await cdpAccount.useNetwork(BASE_SEPOLIA_NETWORK)
  const hash = await sendRegistrationTransaction(networkAccount, agentURI)
  const receipt = await waitForRegistrationReceipt(networkAccount, hash)
  const onChainAgentId = getRegisteredAgentId(receipt, cdpAccount.address)

  console.log(`[erc8004] Registered - agentId: ${onChainAgentId}`)
  return onChainAgentId
}

async function sendRegistrationTransaction(
  networkAccount: CdpNetworkAccount,
  agentURI: string
): Promise<Hash> {
  const data = encodeFunctionData({
    abi: ERC8004_ABI,
    functionName: "register",
    args: [agentURI],
  })

  const { transactionHash } = await networkAccount.sendTransaction({
    transaction: { to: ERC8004_ADDRESS, data },
  })
  console.log(`[erc8004] Tx: ${BASE_SEPOLIA_EXPLORER}/tx/${transactionHash}`)
  return transactionHash
}

function waitForRegistrationReceipt(
  networkAccount: CdpNetworkAccount,
  transactionHash: Hash
): Promise<TransactionReceipt> {
  return networkAccount.waitForTransactionReceipt({ transactionHash })
}

function getRegisteredAgentId(
  receipt: TransactionReceipt,
  agentAddress: string
): bigint {
  const transferLog = receipt.logs.find(isTransferLog)
  if (!transferLog) {
    throw new Error(`No Transfer event in ERC-8004 tx for ${agentAddress}`)
  }

  const decoded = decodeEventLog({ abi: ERC8004_ABI, ...transferLog })
  return (decoded.args as Record<string, unknown>).tokenId as bigint
}

function isTransferLog(log: TransactionReceipt["logs"][number]): boolean {
  try {
    return decodeEventLog({ abi: ERC8004_ABI, ...log }).eventName === "Transfer"
  } catch {
    return false
  }
}
