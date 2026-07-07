import { createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { CdpClient } from "@coinbase/cdp-sdk"
import type { EvmServerAccount } from "@coinbase/cdp-sdk"
import { eq } from "drizzle-orm"
import { registerInErc8004 } from "@workspace/shared/erc8004"
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES } from "@workspace/shared/mandate"
import { createDb, schema } from "@workspace/shared/db"
import { env } from "@/env"

interface AgentConfig {
  name: string
  maxAmountUsdc: bigint
  register: boolean
}

const AGENT_CONFIGS: AgentConfig[] = [
  { name: "metal-agent-1",     maxAmountUsdc: 1n,  register: true  },
  { name: "metal-agent-2",     maxAmountUsdc: 1n,  register: true  },
  { name: "metal-agent-3",     maxAmountUsdc: 10n, register: true  },
  { name: "metal-agent-ghost", maxAmountUsdc: 0n,  register: false },
]

const MANDATE_EXPIRY = 9999999999n

export interface AgentAccounts {
  agent1: EvmServerAccount
  agent2: EvmServerAccount
  agent3: EvmServerAccount
  ghost: EvmServerAccount
}

// Module-level cache: init runs once per process, retries on failure
let initPromise: Promise<AgentAccounts> | null = null

// address (lowercase) → serialized mandate JSON for X-AP2-Mandate header
const mandateHeaders = new Map<string, string>()

export function getMandateHeader(address: string): string | undefined {
  return mandateHeaders.get(address.toLowerCase())
}

export function initAgents(): Promise<AgentAccounts> {
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      initPromise = null
      throw err
    })
  }
  return initPromise
}

async function runInit(): Promise<AgentAccounts> {
  const db = createDb(env.DATABASE_URL)
  const cdp = new CdpClient({
    apiKeyId: env.CDP_API_KEY_ID,
    apiKeySecret: env.CDP_API_KEY_SECRET,
    walletSecret: env.CDP_WALLET_SECRET,
  })

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
  const delegator = privateKeyToAccount(env.DELEGATOR_PRIVATE_KEY as `0x${string}`)

  const accounts = await Promise.all(
    AGENT_CONFIGS.map((c) => cdp.evm.getOrCreateAccount({ name: c.name }))
  )

  for (let i = 0; i < AGENT_CONFIGS.length; i++) {
    const config = AGENT_CONFIGS[i]!
    const account = accounts[i]!
    if (!config.register) continue

    const address = account.address as `0x${string}`
    const addressLower = address.toLowerCase()

    // 1. Get or create ERC-8004 registration
    const agentRow = await db.query.agents.findFirst({
      where: eq(schema.agents.address, addressLower),
    })

    let agentId: bigint
    if (agentRow) {
      agentId = agentRow.agentId
      console.log(`[init] ${config.name} already registered — agentId: ${agentId}`)
    } else {
      agentId = await registerInErc8004(account, env.APP_URL, publicClient)
      await db.insert(schema.agents).values({
        address: addressLower,
        agentId,
        name: config.name,
      })
      console.log(`[init] ${config.name} registered — agentId: ${agentId}`)
    }

    // 2. Get or create mandate
    const mandateRow = await db.query.mandates.findFirst({
      where: eq(schema.mandates.agentAddress, addressLower),
    })

    if (mandateRow) {
      mandateHeaders.set(addressLower, JSON.stringify({
        agentId: agentId.toString(),
        payload: {
          agent: address,
          delegator: mandateRow.delegatorAddress,
          maxAmountUsdc: mandateRow.maxAmountUsdc.toString(),
          expiry: mandateRow.expiry.toString(),
          nonce: mandateRow.nonce.toString(), // nonce = agentId at mandate creation time
        },
        signature: mandateRow.signature,
      }))
      console.log(`[init] Mandate rehydrated for ${config.name}`)
    } else {
      const mandatePayload = {
        agent: address,
        delegator: delegator.address,
        maxAmountUsdc: config.maxAmountUsdc,
        expiry: MANDATE_EXPIRY,
        nonce: agentId,
      }

      const signature = await delegator.signTypedData({
        domain: MANDATE_EIP712_DOMAIN,
        types: MANDATE_EIP712_TYPES,
        primaryType: "MandatePayload",
        message: mandatePayload,
      })

      const response = await fetch(`${env.FACILITATOR_URL}/mandates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: agentId.toString(),
          mandate: {
            payload: {
              agent: mandatePayload.agent,
              delegator: mandatePayload.delegator,
              maxAmountUsdc: mandatePayload.maxAmountUsdc.toString(),
              expiry: mandatePayload.expiry.toString(),
              nonce: mandatePayload.nonce.toString(),
            },
            signature,
          },
        }),
      })

      if (!response.ok && response.status !== 409) {
        throw new Error(`Mandate registration failed for ${config.name}: ${response.status} ${await response.text()}`)
      }

      await db.insert(schema.mandates).values({
        agentAddress: addressLower,
        delegatorAddress: delegator.address,
        maxAmountUsdc: config.maxAmountUsdc,
        expiry: MANDATE_EXPIRY,
        nonce: agentId,
        signature,
      })

      mandateHeaders.set(addressLower, JSON.stringify({
        agentId: agentId.toString(),
        payload: {
          agent: mandatePayload.agent,
          delegator: mandatePayload.delegator,
          maxAmountUsdc: mandatePayload.maxAmountUsdc.toString(),
          expiry: mandatePayload.expiry.toString(),
          nonce: mandatePayload.nonce.toString(),
        },
        signature,
      }))
      console.log(`[init] Mandate registered for ${config.name}`)
    }
  }

  const [agent1, agent2, agent3, ghost] = accounts as [EvmServerAccount, EvmServerAccount, EvmServerAccount, EvmServerAccount]
  return { agent1, agent2, agent3, ghost }
}
