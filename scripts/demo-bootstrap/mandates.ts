import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Address, Hex } from "viem"
import type { MandatePayload } from "@workspace/shared/mandate"
import {
  MANDATE_EIP712_DOMAIN,
  MANDATE_EIP712_TYPES,
} from "@workspace/shared/mandate"
import { toSerializedMandateHeader, parseSerializedMandateHeader } from "@workspace/shared/mandate-header"
import type { DemoAgentName } from "@workspace/shared/types"
import {
  MANDATE_FAR_FUTURE_EXPIRY,
  MAX_AMOUNT,
} from "./config.js"
import type { Delegator } from "./context.js"
import type { SignedMandateForBootstrap } from "./types.js"

const MANDATE_FILE = resolve(
  import.meta.dirname,
  "../../apps/agent/mandates.json"
)

function readMandateFile(): Record<string, unknown> {
  try {
    const raw = readFileSync(MANDATE_FILE, "utf-8")
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeMandateFile(data: Record<string, unknown>): void {
  writeFileSync(MANDATE_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

export async function ensureMandate({
  delegator,
  agentName,
  address,
  addressLower,
  onChainAgentId,
}: {
  delegator: Delegator
  agentName: DemoAgentName
  address: Address
  addressLower: string
  onChainAgentId: bigint
}): Promise<SignedMandateForBootstrap> {
  const file = readMandateFile()

  if (file[addressLower]) {
    const entry = parseSerializedMandateHeader(file[addressLower])
    if (entry) {
      console.log("[bootstrap]   Mandate already exists - rehydrating from file")
      return {
        payload: entry.mandate.payload,
        signature: entry.mandate.signature,
      }
    }
  }

  const payload = newMandatePayload(address, delegator.address, agentName, onChainAgentId)
  const signature = await delegator.signTypedData({
    domain: MANDATE_EIP712_DOMAIN,
    types: MANDATE_EIP712_TYPES,
    primaryType: "MandatePayload",
    message: payload,
  })

  const serialized = toSerializedMandateHeader({
    agentId: onChainAgentId,
    mandate: { payload, signature },
  })
  file[addressLower] = serialized
  writeMandateFile(file)

  console.log("[bootstrap]   Mandate signed and written to mandates.json")
  return { payload, signature }
}

function newMandatePayload(
  address: Address,
  delegatorAddress: Address,
  agentName: DemoAgentName,
  onChainAgentId: bigint
): MandatePayload {
  return {
    agent: address,
    delegator: delegatorAddress,
    maxAmountUsdc: MAX_AMOUNT[agentName],
    expiry: MANDATE_FAR_FUTURE_EXPIRY,
    nonce: onChainAgentId,
  }
}
