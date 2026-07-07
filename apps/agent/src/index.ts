import readline from "readline"
import { getAgentAccount, getClient } from "./lib/wallet.ts"
import { registerInErc8004 } from "./lib/setup.ts"
import { buildTools } from "./tools.ts"
import { runAgent } from "./agent.ts"
import { startServer } from "./server.ts"
import { env } from "./lib/env.ts"

const MODE = process.argv[2]

// ── Server mode ───────────────────────────────────────────────────────────────

if (MODE === "serve") {
  startServer()
  process.on("SIGINT", () => process.exit(0))
} else {
  // ── Agent modes (REPL + one-shot) ──────────────────────────────────────────

  const account = await getAgentAccount()
  console.log(`[Metal Agent] Wallet: ${account.address}`)

  // One-time ERC-8004 registration
  if (!env.AGENT_ID) {
    console.log(`[Metal Agent] Requesting ETH from faucet…`)
    await getClient().evm.requestFaucet({ address: account.address, network: "base-sepolia", token: "eth" })

    const agentId = await registerInErc8004(account, env.APP_URL)
    console.log()
    console.log(`[Metal Agent] Setup complete. Next steps:`)
    console.log(`  1. Sign mandate:     AGENT_ADDRESS=${account.address} bun scripts/sign-mandate.ts`)
    console.log(`  2. Register mandate: FACILITATOR_URL=${env.FACILITATOR_URL} AGENT_ID=${agentId} bun scripts/register-mandate.ts`)
    console.log(`  3. Fund wallet with Base Sepolia USDC: https://faucet.circle.com/`)
    console.log(`  4. Restart the agent`)
    process.exit(0)
  }

  const tools = await buildTools(account)

  // ── One-shot scenarios ────────────────────────────────────────────────────

  const ONE_SHOT_PROMPTS: Record<string, string> = {
    "happy-path":
      `Fetch the settlement risk report at ${env.APP_URL}/api/settlement-risk-report. Check your wallet first, confirm you are authorized under your mandate and the policy, then pay and summarize the result.`,
    "mandate-exceeded":
      `Attempt to fetch the premium risk report at ${env.APP_URL}/api/premium-risk-report (costs $5). Your mandate limit is $1. Try anyway and explain exactly what blocked you.`,
    "policy-exceeded":
      `Attempt to fetch the premium risk report at ${env.APP_URL}/api/premium-risk-report (costs $5). Your mandate allows up to $10 but the settlement-layer policy ceiling is $2. Try and explain what the facilitator rejected and why.`,
    "ghost":
      `Attempt to fetch the settlement risk report at ${env.APP_URL}/api/settlement-risk-report. You have no ERC-8004 registration and no mandate. Try anyway and explain what blocked you at the identity gate.`,
  }

  if (MODE && ONE_SHOT_PROMPTS[MODE]) {
    console.log(`[Metal Agent] Running one-shot: ${MODE}`)
    console.log()
    const reply = await runAgent(tools, ONE_SHOT_PROMPTS[MODE]!)
    console.log(reply)
    process.exit(0)
  }

  // ── REPL ──────────────────────────────────────────────────────────────────

  console.log(`[Metal Agent] agentId: ${env.AGENT_ID}`)
  console.log(`[Metal Agent] Ready. Type a task (or "exit" to quit).`)
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "agent> ",
  })

  rl.prompt()

  rl.on("line", async (line) => {
    const task = line.trim()
    if (!task) { rl.prompt(); return }
    if (task === "exit" || task === "quit") { rl.close(); return }

    try {
      console.log()
      const reply = await runAgent(tools, task)
      console.log()
      console.log(reply)
    } catch (err) {
      console.error("[Metal Agent] Error:", err)
    }

    console.log()
    rl.prompt()
  })

  rl.on("close", () => {
    console.log("[Metal Agent] Bye.")
    process.exit(0)
  })
}
