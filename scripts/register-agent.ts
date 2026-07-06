import { decodeEventLog } from "viem"
import { getPublicClient, getWalletClient } from "./lib/clients"
import { setEnvVar } from "./lib/env"
import { ERC8004_ABI, ERC8004_ADDRESS } from "../packages/shared/src/abis"

const payerKey = process.env.PAYER_PRIVATE_KEY
const appUrl = process.env.APP_URL

if (!payerKey) throw new Error("Missing: PAYER_PRIVATE_KEY")
if (!appUrl) throw new Error("Missing: APP_URL")

const { account: payer, client: walletClient } = getWalletClient(payerKey as `0x${string}`)
const publicClient = getPublicClient()

const agentURI = `${appUrl}/api/agent/${payer.address}`
console.log(`Registering agent: ${payer.address}`)
console.log(`  agentURI: ${agentURI}`)

const hash = await walletClient.writeContract({
  address: ERC8004_ADDRESS,
  abi: ERC8004_ABI,
  functionName: "register",
  args: [agentURI],
})

const receipt = await publicClient.waitForTransactionReceipt({ hash })

// ERC-721 mints emit Transfer(from=0x0, to=registrant, tokenId=agentId)
const transferLog = receipt.logs.find((log) => {
  try {
    const decoded = decodeEventLog({ abi: ERC8004_ABI, ...log })
    return decoded.eventName === "Transfer"
  } catch {
    return false
  }
})

let agentId: bigint | null = null
if (transferLog) {
  const decoded = decodeEventLog({ abi: ERC8004_ABI, ...transferLog })
  agentId = (decoded.args as any).tokenId
} else {
  console.warn("⚠ could not parse agentId from receipt — AGENT_ID not written")
}

console.log(`✓ Registered ${payer.address}`)
console.log(`  tx: https://sepolia.basescan.org/tx/${hash}`)

if (agentId !== null) {
  setEnvVar("AGENT_ID", agentId.toString())
  console.log(`  agentId: ${agentId}`)
}
