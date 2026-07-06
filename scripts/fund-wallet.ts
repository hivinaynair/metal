import { CdpClient } from "@coinbase/cdp-sdk"
import { isAddress } from "viem"

type BaseSepoliaToken = "eth" | "usdc" | "eurc" | "cbbtc"

type CliOptions = {
  address?: string
  token?: string
}

const baseSepoliaTokens = ["eth", "usdc", "eurc", "cbbtc"] as const

function usage() {
  console.log(`
Usage:
  bun scripts/fund-wallet.ts <evm-address> [--token eth|usdc|eurc|cbbtc]

Examples:
  bun scripts/fund-wallet.ts 0x1234...abcd
  bun scripts/fund-wallet.ts 0x1234...abcd --token usdc
`.trim())
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if(!arg) continue

    if (arg === "--help" || arg === "-h") {
      usage()
      process.exit(0)
    }

    if (arg === "--token") {
      options.token = argv[++i]?.toLowerCase()
      continue
    }

    if (arg.startsWith("--token=")) {
      options.token = arg.slice("--token=".length).toLowerCase()
      continue
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (options.address) {
      throw new Error(`Unexpected extra argument: ${arg}`)
    }

    options.address = arg
  }

  return options
}

function isBaseSepoliaToken(token: string): token is BaseSepoliaToken {
  return (baseSepoliaTokens as readonly string[]).includes(token)
}

const { address, token: requestedToken } = parseArgs(process.argv.slice(2))

console.log(address, requestedToken)
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
