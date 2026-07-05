import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

export function getPublicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http() })
}

export function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return {
    account,
    client: createWalletClient({ account, chain: baseSepolia, transport: http() }),
  }
}
