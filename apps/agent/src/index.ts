import readline from "readline"
import { getAgentAccount } from "./lib/wallet.ts"
import { registerInErc8004 } from "./lib/setup.ts"
import { buildTools } from "./tools.ts"
import { runAgent } from "./agent.ts"
import { env } from "./lib/env.ts"

// ── Startup ──────────────────────────────────────────────────────────────────

const account = await getAgentAccount()
console.log(`[Metal Agent] Wallet: ${account.address}`)

// One-time ERC-8004 registration — runs only when AGENT_ID is not set
if (!env.AGENT_ID) {
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

console.log(`[Metal Agent] agentId: ${env.AGENT_ID}`)
console.log(`[Metal Agent] Ready. Type a task (or "exit" to quit).`)
console.log()

// ── REPL ─────────────────────────────────────────────────────────────────────

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
