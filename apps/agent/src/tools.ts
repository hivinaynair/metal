import { tool } from "ai"
import { z } from "zod"
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch"
import { ExactEvmScheme } from "@x402/evm"
import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
} from "@coinbase/agentkit"
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk"
import { BASE_SEPOLIA_CAIP2, BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import type { EvmServerAccount } from "@coinbase/cdp-sdk"

// Build all tools for the agent — AgentKit built-ins + custom x402FetchTool.
// CdpEvmWalletProvider reads CDP_API_KEY_NAME/SECRET/WALLET_SECRET from env automatically.
export async function buildTools(cdpAccount: EvmServerAccount) {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID ?? process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId: "base-sepolia",
    address: cdpAccount.address,
  })

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      walletActionProvider(),  // get_wallet_details, get_balance, native_transfer
      erc20ActionProvider(),   // ERC-20 get_balance, transfer
    ],
  })

  const agentKitTools = getVercelAITools(agentkit)

  // x402FetchTool — agent uses this to fetch paywalled resources.
  // EvmServerAccount is viem-compatible at runtime so it satisfies ExactEvmScheme.
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: BASE_SEPOLIA_CAIP2,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: new ExactEvmScheme(cdpAccount as any),
      },
    ],
  })

  const x402FetchTool = tool({
    description:
      "Fetch a URL that may be gated behind an x402 paywall. Handles payment automatically. Returns the response body and the transaction hash if payment was made.",
    parameters: z.object({
      url: z.string().describe("The URL to fetch"),
    }),
    execute: async ({ url }) => {
      const response = await fetchWithPayment(url)
      const paymentHeader = response.headers.get("PAYMENT-RESPONSE")
      let txHash: string | undefined

      if (paymentHeader) {
        const decoded = decodePaymentResponseHeader(paymentHeader)
        const d = decoded as Record<string, unknown>
        txHash = (d.transaction as string | undefined) ?? (d.txHash as string | undefined)
        if (!txHash) {
          console.warn("[Metal Agent] x402 payment made but no txHash found in PAYMENT-RESPONSE header")
        }
      }

      const body = await response.json()
      return {
        status: response.status,
        body,
        txHash,
        basescan: txHash ? `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}` : undefined,
      }
    },
  })

  return { ...agentKitTools, x402Fetch: x402FetchTool }
}
