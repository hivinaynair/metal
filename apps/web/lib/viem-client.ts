import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const publicClient: any = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
})
