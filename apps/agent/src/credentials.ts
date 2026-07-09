import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  parseSerializedMandateHeader,
  serializeMandateHeader,
} from "@workspace/shared/mandate-header"
import type { MandateHeaderValue } from "@workspace/shared/mandate-header"

function readMandateFile(): Record<string, unknown> {
  try {
    if (process.env.MANDATES_JSON) {
      return JSON.parse(process.env.MANDATES_JSON) as Record<string, unknown>
    }
    const filePath = process.env.MANDATE_FILE ?? resolve(import.meta.dirname, "..", "mandates.json")
    const raw = readFileSync(filePath, "utf-8")
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function getAp2CredentialForAgent(agentAddress: string): {
  entry: MandateHeaderValue
  header: string
} | undefined {
  const normalised = agentAddress.toLowerCase()
  const file = readMandateFile()
  const raw = file[normalised]
  if (!raw) return undefined

  const entry = parseSerializedMandateHeader(raw)
  if (!entry || entry.mandate.payload.agent.toLowerCase() !== normalised) {
    return undefined
  }

  if (entry.mandate.payload.expiry < BigInt(Math.floor(Date.now() / 1000))) {
    return undefined
  }

  return {
    entry,
    header: serializeMandateHeader(entry),
  }
}
