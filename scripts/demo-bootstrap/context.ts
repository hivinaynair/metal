import { CdpClient } from "@coinbase/cdp-sdk"
import { createPublicClient, http, type HttpTransport } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { createDb, schema } from "@workspace/db"
import { DELEGATOR_KEY } from "./config.js"

export type PublicClient = ReturnType<
  typeof createPublicClient<HttpTransport, typeof baseSepolia>
>
export type Database = ReturnType<typeof createDb>
export type Delegator = ReturnType<typeof privateKeyToAccount>

export type AgentRow = typeof schema.agents.$inferSelect

export type BootstrapContext = {
  db: Database
  cdp: CdpClient
  publicClient: PublicClient
  delegator: Delegator
}

export function createBootstrapContext(): BootstrapContext {
  const db = createDb()
  const cdp = new CdpClient()
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })
  const delegator = privateKeyToAccount(DELEGATOR_KEY)

  return { db, cdp, publicClient, delegator }
}
