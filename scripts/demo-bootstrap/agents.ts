import { CdpClient } from "@coinbase/cdp-sdk"
import { eq } from "drizzle-orm"
import type { Address } from "viem"
import {
  BASE_SEPOLIA_USDC_ADDRESS,
  ERC20_BALANCE_ABI,
} from "@workspace/shared/abis"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { schema } from "@workspace/db"
import type { DemoAgentName } from "@workspace/shared/types"
import { AGENT_URL, BOOTSTRAP_SECRET, NO_REGISTER, UNREGISTERED_AGENT_ID } from "./config.js"
import type {
  AgentRow,
  BootstrapContext,
  Database,
  PublicClient,
} from "./context.js"
import { registerInErc8004 } from "./erc8004.js"
import { ensureMandate } from "./mandates.js"
import type { AgentFromServer } from "./types.js"

export async function fetchAgentList(): Promise<AgentFromServer[]> {
  console.log(`[bootstrap] Fetching agent addresses from ${AGENT_URL}/agents`)
  const agentsRes = await fetch(`${AGENT_URL}/agents`, {
    headers: BOOTSTRAP_SECRET ? { Authorization: `Bearer ${BOOTSTRAP_SECRET}` } : {},
  })
  if (!agentsRes.ok) {
    throw new Error(
      `GET /agents failed: ${agentsRes.status} ${await agentsRes.text()}`
    )
  }

  const agentList = (await agentsRes.json()) as AgentFromServer[]
  console.log(`[bootstrap] Got ${agentList.length} agent(s)`)
  return agentList
}

export async function bootstrapAgent(
  context: BootstrapContext,
  { agentName, address }: AgentFromServer
) {
  const addressLower = address.toLowerCase()
  console.log(`\n[bootstrap] Processing ${agentName} (${addressLower})`)

  await fundAgentWithUsdc(context.cdp, address)
  await logUsdcBalance(context.publicClient, address)

  const agentRow = await loadAgentRow(context.db, addressLower)

  const onChainAgentId = await ensureAgentRegistration({
    db: context.db,
    cdp: context.cdp,
    agentName,
    addressLower,
    agentRow,
  })

  await ensureMandate({
    delegator: context.delegator,
    agentName,
    address,
    addressLower,
    onChainAgentId,
  })

  console.log("[bootstrap]   Agent AP2 credential ready")
}

async function fundAgentWithUsdc(cdp: CdpClient, address: Address) {
  try {
    const { transactionHash } = await cdp.evm.requestFaucet({
      address,
      network: "base-sepolia",
      token: "usdc",
    })
    console.log(
      `[bootstrap]   Funded USDC: ${BASE_SEPOLIA_EXPLORER}/tx/${transactionHash}`
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[bootstrap]   Faucet USDC skipped (${msg})`)
  }
}

async function logUsdcBalance(publicClient: PublicClient, address: Address) {
  const usdcBalance = await publicClient.readContract({
    address: BASE_SEPOLIA_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [address],
  })
  console.log(
    `[bootstrap]   USDC balance: $${(Number(usdcBalance) / 1_000_000).toFixed(6)}`
  )
}

async function loadAgentRow(db: Database, addressLower: string): Promise<AgentRow | undefined> {
  return db.query.agents.findFirst({
    where: eq(schema.agents.address, addressLower),
  })
}

async function ensureAgentRegistration({
  db,
  cdp,
  agentName,
  addressLower,
  agentRow,
}: {
  db: Database
  cdp: CdpClient
  agentName: DemoAgentName
  addressLower: string
  agentRow: AgentRow | undefined
}): Promise<bigint> {
  if (agentRow) {
    await db
      .update(schema.agents)
      .set({ name: agentName })
      .where(eq(schema.agents.address, addressLower))
    console.log(
      `[bootstrap]   ERC-8004 already registered - agentId: ${agentRow.agentId}`
    )
    return agentRow.agentId
  }

  if (NO_REGISTER.has(agentName)) {
    console.log(`[bootstrap]   Skipping ERC-8004 registration for ${agentName}`)
    await db
      .insert(schema.agents)
      .values({
        address: addressLower,
        agentId: UNREGISTERED_AGENT_ID,
        name: agentName,
      })
      .onConflictDoNothing()
    return UNREGISTERED_AGENT_ID
  }

  const cdpAccount = await cdp.evm.getOrCreateAccount({ name: agentName })
  const onChainAgentId = await registerInErc8004(cdpAccount, AGENT_URL)
  await db.insert(schema.agents).values({
    address: addressLower,
    agentId: onChainAgentId,
    name: agentName,
  })
  console.log(`[bootstrap]   Registered - ERC-8004 agentId: ${onChainAgentId}`)
  return onChainAgentId
}
