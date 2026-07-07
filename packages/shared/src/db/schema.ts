import { pgTable, text, bigint, timestamp, serial, integer } from "drizzle-orm/pg-core"

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

export const settlementAttestations = pgTable("settlement_attestations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paymentHash: text("payment_hash").notNull(),
  settlementTx: text("settlement_tx"),
  attestationTx: text("attestation_tx"),
  payerAddress: text("payer_address").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "bigint" }).notNull(),
  identityStatus: integer("identity_status").notNull(),
  decision: integer("decision").notNull(),
  authorizationNonce: text("authorization_nonce"),
})
