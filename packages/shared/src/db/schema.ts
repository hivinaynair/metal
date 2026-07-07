import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core"

export const agents = pgTable("agents", {
  address: text("address").primaryKey(),
  agentId: bigint("agent_id", { mode: "bigint" }).notNull(),
  name: text("name").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
})

export const mandates = pgTable("mandates", {
  agentAddress: text("agent_address").primaryKey().references(() => agents.address),
  delegatorAddress: text("delegator_address").notNull(),
  maxAmountUsdc: bigint("max_amount_usdc", { mode: "bigint" }).notNull(),
  expiry: bigint("expiry", { mode: "bigint" }).notNull(),
  nonce: bigint("nonce", { mode: "bigint" }).notNull(),
  signature: text("signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
