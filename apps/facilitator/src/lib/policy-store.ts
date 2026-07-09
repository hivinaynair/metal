import { schema } from "@workspace/db"
import { env } from "../env.js"
import { getDb } from "./db.js"
import { USDC_ATOMIC_FACTOR } from "./mandate.js"

export async function getPolicyMaxAmountUsdc(): Promise<number> {
  const db = getDb()
  const rows = await db.select().from(schema.facilitatorConfig).limit(1)
  if (rows.length > 0) return Number(rows[0]!.policyMaxAmountUsdc)
  // No row yet — seed from env var and return the default.
  await db
    .insert(schema.facilitatorConfig)
    .values({ id: 1, policyMaxAmountUsdc: String(env.POLICY_MAX_AMOUNT_USDC) })
    .onConflictDoNothing()
  return env.POLICY_MAX_AMOUNT_USDC
}

export async function getPolicyMaxAtomic(): Promise<bigint> {
  const usdc = await getPolicyMaxAmountUsdc()
  return BigInt(Math.round(usdc * Number(USDC_ATOMIC_FACTOR)))
}

export async function setPolicyMaxAmountUsdc(value: number): Promise<void> {
  await getDb()
    .insert(schema.facilitatorConfig)
    .values({ id: 1, policyMaxAmountUsdc: String(value) })
    .onConflictDoUpdate({
      target: schema.facilitatorConfig.id,
      set: { policyMaxAmountUsdc: String(value) },
    })
}
