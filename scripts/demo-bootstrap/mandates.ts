import type { Address, Hex } from "viem"
import type { MandatePayload } from "@workspace/shared/mandate"
import {
  MANDATE_EIP712_DOMAIN,
  MANDATE_EIP712_TYPES,
} from "@workspace/shared/mandate"
import { schema } from "@workspace/shared/db"
import type { DemoAgentName } from "@workspace/shared/types"
import {
  FACILITATOR_URL,
  MANDATE_FAR_FUTURE_EXPIRY,
  MAX_AMOUNT,
} from "./config.js"
import type { Database, Delegator, MandateRow } from "./context.js"
import type { SignedMandateForBootstrap } from "./types.js"

export async function ensureMandate({
  db,
  delegator,
  agentName,
  address,
  addressLower,
  onChainAgentId,
  mandateRow,
}: {
  db: Database
  delegator: Delegator
  agentName: DemoAgentName
  address: Address
  addressLower: string
  onChainAgentId: bigint
  mandateRow: MandateRow | undefined
}): Promise<SignedMandateForBootstrap> {
  if (mandateRow) {
    console.log("[bootstrap]   Mandate already exists - rehydrating credential")
    return {
      payload: payloadFromSavedMandate(address, mandateRow),
      signature: mandateRow.signature as Hex,
    }
  }

  const payload = newMandatePayload(
    address,
    delegator.address,
    agentName,
    onChainAgentId
  )
  const signature = await delegator.signTypedData({
    domain: MANDATE_EIP712_DOMAIN,
    types: MANDATE_EIP712_TYPES,
    primaryType: "MandatePayload",
    message: payload,
  })

  await registerMandateWithFacilitator(
    agentName,
    onChainAgentId,
    payload,
    signature
  )
  await db
    .insert(schema.mandates)
    .values({
      agentAddress: addressLower,
      delegatorAddress: delegator.address,
      maxAmountUsdc: payload.maxAmountUsdc,
      expiry: payload.expiry,
      nonce: payload.nonce,
      signature,
    })
    .onConflictDoNothing()

  console.log("[bootstrap]   Mandate signed and stored")
  return { payload, signature }
}

function payloadFromSavedMandate(
  address: Address,
  mandateRow: MandateRow
): MandatePayload {
  return {
    agent: address,
    delegator: mandateRow.delegatorAddress as Address,
    maxAmountUsdc: mandateRow.maxAmountUsdc,
    expiry: mandateRow.expiry,
    nonce: mandateRow.nonce,
  }
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

async function registerMandateWithFacilitator(
  agentName: DemoAgentName,
  onChainAgentId: bigint,
  payload: MandatePayload,
  signature: Hex
) {
  const facilitatorRes = await fetch(`${FACILITATOR_URL}/mandates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agentId: onChainAgentId.toString(),
      mandate: {
        payload: serializeMandatePayload(payload),
        signature,
      },
    }),
  })

  if (!facilitatorRes.ok && facilitatorRes.status !== 409) {
    throw new Error(
      `Mandate registration failed for ${agentName}: ${facilitatorRes.status} ${await facilitatorRes.text()}`
    )
  }
}

function serializeMandatePayload(payload: MandatePayload) {
  return {
    agent: payload.agent,
    delegator: payload.delegator,
    maxAmountUsdc: payload.maxAmountUsdc.toString(),
    expiry: payload.expiry.toString(),
    nonce: payload.nonce.toString(),
  }
}
