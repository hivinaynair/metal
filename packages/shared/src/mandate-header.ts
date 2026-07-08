import type { SignedMandate } from "./mandate.js"

export interface MandateHeaderValue {
  agentId: bigint
  mandate: SignedMandate
}

export interface SerializedMandateHeader {
  agentId: string
  payload: {
    agent: string
    delegator: string
    maxAmountUsdc: string
    expiry: string
    nonce: string
  }
  signature: string
}

export function toSerializedMandateHeader({ agentId, mandate }: MandateHeaderValue): SerializedMandateHeader {
  return {
    agentId: agentId.toString(),
    payload: {
      agent: mandate.payload.agent,
      delegator: mandate.payload.delegator,
      maxAmountUsdc: mandate.payload.maxAmountUsdc.toString(),
      expiry: mandate.payload.expiry.toString(),
      nonce: mandate.payload.nonce.toString(),
    },
    signature: mandate.signature,
  }
}

export function serializeMandateHeader(value: MandateHeaderValue): string {
  return JSON.stringify(toSerializedMandateHeader(value))
}

export function parseSerializedMandateHeader(raw: unknown): MandateHeaderValue | undefined {
  try {
    const value = raw as SerializedMandateHeader
    if (
      typeof value.agentId !== "string" ||
      typeof value.signature !== "string" ||
      !value.payload ||
      typeof value.payload.agent !== "string" ||
      typeof value.payload.delegator !== "string" ||
      typeof value.payload.maxAmountUsdc !== "string" ||
      typeof value.payload.expiry !== "string" ||
      typeof value.payload.nonce !== "string"
    ) {
      return undefined
    }

    return {
      agentId: BigInt(value.agentId),
      mandate: {
        payload: {
          agent: value.payload.agent as `0x${string}`,
          delegator: value.payload.delegator as `0x${string}`,
          maxAmountUsdc: BigInt(value.payload.maxAmountUsdc),
          expiry: BigInt(value.payload.expiry),
          nonce: BigInt(value.payload.nonce),
        },
        signature: value.signature as `0x${string}`,
      },
    }
  } catch {
    return undefined
  }
}

export function parseMandateHeader(json: string): MandateHeaderValue | undefined {
  try {
    return parseSerializedMandateHeader(JSON.parse(json))
  } catch {
    return undefined
  }
}
