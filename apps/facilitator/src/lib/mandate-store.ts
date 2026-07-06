import { Redis } from "@upstash/redis"
import type { SignedMandate } from "@workspace/shared/mandate"

export interface MandateEntry {
  mandate: SignedMandate
  agentId: bigint
}

interface StoredMandateEntry {
  mandate: {
    payload: {
      agent: `0x${string}`
      delegator: `0x${string}`
      maxAmountUsdc: string
      expiry: string
      nonce: string
    }
    signature: `0x${string}`
  }
  agentId: string
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : undefined

const keyForAgent = (agent: string) => `mandate:${agent.toLowerCase()}`

function requireRedis(): Redis {
  if (!redis) {
    throw new Error(
      "Missing Upstash Redis env vars: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    )
  }
  return redis
}

function serializeEntry(mandate: SignedMandate, agentId: bigint): StoredMandateEntry {
  return {
    mandate: {
      payload: {
        agent: mandate.payload.agent,
        delegator: mandate.payload.delegator,
        maxAmountUsdc: mandate.payload.maxAmountUsdc.toString(),
        expiry: mandate.payload.expiry.toString(),
        nonce: mandate.payload.nonce.toString(),
      },
      signature: mandate.signature,
    },
    agentId: agentId.toString(),
  }
}

function deserializeEntry(entry: StoredMandateEntry): MandateEntry {
  return {
    mandate: {
      payload: {
        ...entry.mandate.payload,
        maxAmountUsdc: BigInt(entry.mandate.payload.maxAmountUsdc),
        expiry: BigInt(entry.mandate.payload.expiry),
        nonce: BigInt(entry.mandate.payload.nonce),
      },
      signature: entry.mandate.signature,
    },
    agentId: BigInt(entry.agentId),
  }
}

export async function registerMandate(mandate: SignedMandate, agentId: bigint): Promise<boolean> {
  const key = keyForAgent(mandate.payload.agent)
  const redis = requireRedis()

  const result: unknown = await redis.set(
    key,
    JSON.stringify(serializeEntry(mandate, agentId)),
    { nx: true },
  )
  return result === "OK" || result === true
}

export async function getMandate(agent: string): Promise<MandateEntry | undefined> {
  const key = keyForAgent(agent)
  const redis = requireRedis()

  const value = await redis.get<StoredMandateEntry>(key)
  return value ? deserializeEntry(value) : undefined
}
