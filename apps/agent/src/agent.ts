import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import type { ToolSet } from "ai"

// Maximum tool-use rounds per agent run — enough for: check balance → fetch → summarize
const MAX_AGENT_STEPS = 8

const SYSTEM_PROMPT = `You are a financial compliance agent with a crypto wallet on Base Sepolia.
You have been authorized via an AP2 mandate (a signed delegation) to spend up to 100 USDC.

When asked to fetch a report:
1. Call get_wallet_details to confirm your address.
2. Call get_balance to check your USDC balance before spending.
3. Call x402Fetch with the URL to fetch the paywalled resource and pay for it automatically.
4. Summarize the response in plain English — risk level, key factors, recommendation.
5. If payment was made, report the transaction hash and link to Basescan.

Be concise. Focus on the data, not on explaining what tools you called.`

export async function runAgent(tools: ToolSet, prompt: string): Promise<string> {
  const { text, steps } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    tools,
    system: SYSTEM_PROMPT,
    prompt,
    maxSteps: MAX_AGENT_STEPS,
  })

  // Surface x402 payment transactions from tool results
  type AnyResult = { toolName: string; result: Record<string, unknown> }
  for (const step of steps) {
    for (const result of (step.toolResults ?? []) as AnyResult[]) {
      if (result.toolName === "x402Fetch") {
        const { txHash, basescan } = result.result
        if (txHash) {
          console.log(`[Metal Agent] Paid via x402 — tx: ${basescan ?? `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}`}`)
        }
      }
    }
  }

  return text
}
