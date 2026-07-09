import { parseArgs } from "util"
import { CdpClient } from "@coinbase/cdp-sdk"
import { isAddress } from "viem"

type BaseSepoliaToken = "eth" | "usdc"

const baseSepoliaTokens: BaseSepoliaToken[] = ["eth", "usdc"] as const

function usage() {
  console.log(`
Usage:
  bun scripts/fund-wallet.ts <evm-address> [--token eth|usdc]

Examples:
  bun scripts/fund-wallet.ts 0x1234...abcd
  bun scripts/fund-wallet.ts 0x1234...abcd --token usdc
`.trim())
}

function isBaseSepoliaToken(token: string): token is BaseSepoliaToken {
  return (baseSepoliaTokens as readonly string[]).includes(token)
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    token: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
})

if (values.help) {
  usage()
  process.exit(0)
}

const address = positionals[0]
const requestedToken = values.token?.toLowerCase()

if (!address) {
  usage()
  process.exit(1)
}

if (!isAddress(address)) {
  throw new Error("Address must be a valid EVM 0x address")
}

const token = requestedToken ?? "eth"

if (!isBaseSepoliaToken(token)) {
  throw new Error(`Base Sepolia supports these faucet tokens: ${baseSepoliaTokens.join(", ")}`)
}

console.log(`Requesting Base Sepolia ${token.toUpperCase()} for: ${address}`)

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
})

const { transactionHash } = await cdp.evm.requestFaucet({
  address,
  network: "base-sepolia",
  token,
})

console.log(`Faucet tx: ${transactionHash}`)
console.log(`https://sepolia.basescan.org/tx/${transactionHash}`)
