import { readFileSync } from "fs"
import { resolve } from "path"
import type { SignedMandate } from "@workspace/shared/mandate"

const facilitatorUrl = process.env.FACILITATOR_URL
if (!facilitatorUrl) throw new Error("FACILITATOR_URL not set")

const agentId = process.env.AGENT_ID
if (!agentId) throw new Error("AGENT_ID not set")

const mandatePath = resolve(process.cwd(), "demo/mandate.json")
const mandate: SignedMandate = JSON.parse(readFileSync(mandatePath, "utf8"))

console.log(`Registering mandate for agent ${mandate.payload.agent} (agentId=${agentId})...`)

const res = await fetch(`${facilitatorUrl}/mandates`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mandate, agentId }),
})

if (!res.ok) {
  const text = await res.text()
  throw new Error(`Failed to register mandate: ${res.status} ${text}`)
}

console.log("Mandate registered successfully.")
