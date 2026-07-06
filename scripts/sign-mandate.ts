import { mkdirSync, writeFileSync } from "fs"
import { resolve } from "path"
import { privateKeyToAccount } from "viem/accounts"
import { signMandate } from "./lib/mandate"

const delegatorKey = process.env.DELEGATOR_PRIVATE_KEY
if (!delegatorKey) throw new Error("Missing: DELEGATOR_PRIVATE_KEY")

// AGENT_ADDRESS takes priority (AgentKit/CDP wallet).
// Falls back to PAYER_PRIVATE_KEY-derived address for backward compat.
const agentAddress: `0x${string}` = process.env.AGENT_ADDRESS
  ? (process.env.AGENT_ADDRESS as `0x${string}`)
  : (() => {
      const payerKey = process.env.PAYER_PRIVATE_KEY
      if (!payerKey) throw new Error("Missing: AGENT_ADDRESS or PAYER_PRIVATE_KEY")
      return privateKeyToAccount(payerKey as `0x${string}`).address
    })()

const mandate = await signMandate(agentAddress, delegatorKey as `0x${string}`)

const json = JSON.stringify(
  {
    payload: {
      agent: mandate.payload.agent,
      delegator: mandate.payload.delegator,
      maxAmountUsdc: Number(mandate.payload.maxAmountUsdc),
      expiry: Number(mandate.payload.expiry),
      nonce: Number(mandate.payload.nonce),
    },
    signature: mandate.signature,
  },
  null,
  2
)

const OUT_PATH = process.env.AGENT_ADDRESS ? "demo/agentkit-mandate.json" : "demo/mandate.json"
const outPath = resolve(process.cwd(), OUT_PATH)
mkdirSync(resolve(process.cwd(), "demo"), { recursive: true })
writeFileSync(outPath, json)
console.log("Wrote", outPath)
console.log(json)
