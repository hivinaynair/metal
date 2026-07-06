import { mkdirSync, writeFileSync } from "fs"
import { resolve } from "path"
import { privateKeyToAccount } from "viem/accounts"
import { signMandate } from "./lib/mandate"

const delegatorKey = process.env.DELEGATOR_PRIVATE_KEY
const payerKey = process.env.PAYER_PRIVATE_KEY

if (!delegatorKey || !payerKey) {
  throw new Error("Missing: DELEGATOR_PRIVATE_KEY or PAYER_PRIVATE_KEY")
}

const agentAddress = privateKeyToAccount(payerKey as `0x${string}`).address
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

const OUT_PATH = "demo/mandate.json"
const outPath = resolve(process.cwd(), OUT_PATH)
mkdirSync(resolve(process.cwd(), "demo"), { recursive: true })
writeFileSync(outPath, json)
console.log("Wrote", outPath)
console.log(json)
