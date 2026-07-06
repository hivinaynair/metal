import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { toFacilitatorEvmSigner } from "@x402/evm"
import { env } from "./env.ts"

export const account = privateKeyToAccount(env.FACILITATOR_PRIVATE_KEY)

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
})

// FacilitatorEvmSigner wraps both clients into the interface ExactEvmScheme expects
export const facilitatorSigner = toFacilitatorEvmSigner({
  address: account.address,
  getCode: (args) => publicClient.getCode(args),
  readContract: (args) => publicClient.readContract({ ...args, args: args.args ?? [] }),
  verifyTypedData: (args) => publicClient.verifyTypedData(args as Parameters<typeof publicClient.verifyTypedData>[0]),
  writeContract: (args) => walletClient.writeContract(args as Parameters<typeof walletClient.writeContract>[0]),
  sendTransaction: (args) => walletClient.sendTransaction(args as Parameters<typeof walletClient.sendTransaction>[0]),
  waitForTransactionReceipt: (args) => publicClient.waitForTransactionReceipt(args),
})
