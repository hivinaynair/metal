import { createPublicClient, http, formatEther, formatUnits, isAddress } from "viem"
import { baseSepolia } from "viem/chains"

const address = process.argv[2]

if (!address) {
  console.log("Usage: bun scripts/balance.ts <evm-address>")
  process.exit(1)
}

if (!isAddress(address)) {
  throw new Error("Address must be a valid EVM 0x address")
}

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const
const USDC_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const

const client = createPublicClient({ chain: baseSepolia, transport: http() })

const [eth, usdc] = await Promise.all([
  client.getBalance({ address }),
  client.readContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: [address] }),
])

console.log(`Address: ${address}`)
console.log(`ETH:     ${formatEther(eth)} ETH`)
console.log(`USDC:    ${formatUnits(usdc, 6)} USDC`)
