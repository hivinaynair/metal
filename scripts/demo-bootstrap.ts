/**
 * demo-bootstrap.ts
 *
 * Run once after deploy to set up agent wallets, ERC-8004 registrations,
 * and AP2 mandates. Safe to re-run — skips already-registered agents and
 * already-signed mandates.
 *
 * Required env vars:
 *   AGENT_URL, APP_URL, FACILITATOR_URL, DATABASE_URL
 *   DELEGATOR_PRIVATE_KEY
 *   CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET
 *
 * Usage:
 *   bun scripts/demo-bootstrap.ts
 */

import { createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { CdpClient } from "@coinbase/cdp-sdk"
import { eq } from "drizzle-orm"
import { AgentId } from "@workspace/shared/types"
import { registerInErc8004 } from "@workspace/shared/erc8004"
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES } from "@workspace/shared/mandate"
import { toSerializedMandateHeader } from "@workspace/shared/mandate-header"
import { createDb, schema } from "@workspace/shared/db"

// ─── Helpers ───────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

// ─── Config ────────────────────────────────────────────────────────────────

const AGENT_URL = requireEnv("AGENT_URL")
const APP_URL = requireEnv("APP_URL")
const FACILITATOR_URL = requireEnv("FACILITATOR_URL")
const DATABASE_URL = requireEnv("DATABASE_URL")
const DELEGATOR_KEY = requireEnv("DELEGATOR_PRIVATE_KEY") as `0x${string}`

// Unix timestamp year ~2286 — treat as non-expiring for demo purposes
const MANDATE_FAR_FUTURE_EXPIRY = 9999999999n

// Agents that should NOT be registered in ERC-8004 (no spending authority)
const NO_REGISTER = new Set<AgentId>([AgentId.GHOST])

// Placeholder on-chain ID for unregistered agents (used as mandate nonce)
const UNREGISTERED_AGENT_ID = 0n

// Max spending per agent (in USDC base units — 1n = $0.000001)
const MAX_AMOUNT: Record<AgentId, bigint> = {
  [AgentId.AGENT_1]: 1n,
  [AgentId.AGENT_2]: 1n,
  [AgentId.AGENT_3]: 10n,
  [AgentId.GHOST]: 0n,
}

const AP2_CREDENTIAL_TYPE = "ap2_mandate"

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("[bootstrap] Starting demo bootstrap...")

  // 1. Fetch agent addresses from the agent server
  console.log(`[bootstrap] Fetching agent addresses from ${AGENT_URL}/agents`)
  const agentsRes = await fetch(`${AGENT_URL}/agents`)
  if (!agentsRes.ok) {
    throw new Error(`GET /agents failed: ${agentsRes.status} ${await agentsRes.text()}`)
  }
  const agentList = await agentsRes.json() as { agentId: AgentId; address: string }[]
  console.log(`[bootstrap] Got ${agentList.length} agent(s)`)

  // 2. Set up clients
  const db = createDb(DATABASE_URL)
  const cdp = new CdpClient()
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
  const delegator = privateKeyToAccount(DELEGATOR_KEY)

  console.log(`[bootstrap] Delegator: ${delegator.address}`)

  // 3. For each agent: register in ERC-8004 + sign mandate
  for (const { agentId, address } of agentList) {
    const addressLower = address.toLowerCase()
    console.log(`\n[bootstrap] Processing ${agentId} (${addressLower})`)

    // ── ERC-8004 registration ───────────────────────────────────────────────
    let onChainId: bigint

    const agentRow = await db.query.agents.findFirst({
      where: eq(schema.agents.address, addressLower),
    })

    if (agentRow) {
      onChainId = agentRow.agentId
      await db.update(schema.agents)
        .set({ name: agentId })
        .where(eq(schema.agents.address, addressLower))
      console.log(`[bootstrap]   ERC-8004 already registered — agentId: ${onChainId}`)
    } else if (NO_REGISTER.has(agentId)) {
      console.log(`[bootstrap]   Skipping ERC-8004 registration for ${agentId}`)
      onChainId = UNREGISTERED_AGENT_ID
      await db.insert(schema.agents).values({
        address: addressLower,
        agentId: onChainId,
        name: agentId,
      }).onConflictDoNothing()
    } else {
      const cdpAccount = await cdp.evm.getOrCreateAccount({ name: agentId })
      onChainId = await registerInErc8004(cdpAccount, APP_URL, publicClient)
      await db.insert(schema.agents).values({
        address: addressLower,
        agentId: onChainId,
        name: agentId,
      })
      console.log(`[bootstrap]   Registered — agentId: ${onChainId}`)
    }

    // ── Mandate signing ─────────────────────────────────────────────────────
    const mandateRow = await db.query.mandates.findFirst({
      where: eq(schema.mandates.agentAddress, addressLower),
    })

    let mandatePayload = {
      agent: address as `0x${string}`,
      delegator: delegator.address,
      maxAmountUsdc: MAX_AMOUNT[agentId],
      expiry: MANDATE_FAR_FUTURE_EXPIRY,
      nonce: onChainId,
    }
    let signature: `0x${string}`

    if (mandateRow) {
      console.log(`[bootstrap]   Mandate already exists — rehydrating credential`)
      mandatePayload = {
        agent: address as `0x${string}`,
        delegator: mandateRow.delegatorAddress as `0x${string}`,
        maxAmountUsdc: mandateRow.maxAmountUsdc,
        expiry: mandateRow.expiry,
        nonce: mandateRow.nonce,
      }
      signature = mandateRow.signature as `0x${string}`
    } else {
      signature = await delegator.signTypedData({
        domain: MANDATE_EIP712_DOMAIN,
        types: MANDATE_EIP712_TYPES,
        primaryType: "MandatePayload",
        message: mandatePayload,
      })

      // Register with facilitator
      const facilitatorRes = await fetch(`${FACILITATOR_URL}/mandates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: onChainId.toString(),
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

      if (!facilitatorRes.ok && facilitatorRes.status !== 409) {
        throw new Error(`Mandate registration failed for ${agentId}: ${facilitatorRes.status} ${await facilitatorRes.text()}`)
      }

      await db.insert(schema.mandates).values({
        agentAddress: addressLower,
        delegatorAddress: delegator.address,
        maxAmountUsdc: mandatePayload.maxAmountUsdc,
        expiry: mandatePayload.expiry,
        nonce: mandatePayload.nonce,
        signature,
      }).onConflictDoNothing()

      console.log(`[bootstrap]   Mandate signed and stored`)
    }

    await db.insert(schema.agentCredentials).values({
      agentAddress: addressLower,
      agentName: agentId,
      credentialType: AP2_CREDENTIAL_TYPE,
      credentialJson: toSerializedMandateHeader({
        agentId: onChainId,
        mandate: { payload: mandatePayload, signature },
      }),
      expiresAt: mandatePayload.expiry,
    }).onConflictDoUpdate({
      target: [
        schema.agentCredentials.agentAddress,
        schema.agentCredentials.credentialType,
      ],
      set: {
        agentName: agentId,
        credentialJson: toSerializedMandateHeader({
          agentId: onChainId,
          mandate: { payload: mandatePayload, signature },
        }),
        expiresAt: mandatePayload.expiry,
      },
    })

    console.log(`[bootstrap]   Agent AP2 credential ready`)
  }

  console.log("\n[bootstrap] Done.")
}

main().catch((err) => {
  console.error("[bootstrap] Fatal:", err)
  process.exit(1)
})
