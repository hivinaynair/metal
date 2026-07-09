import { bigint, integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const agents = pgTable("agents", {
  address: text("address").primaryKey(),
  agentId: bigint("agent_id", { mode: "bigint" }).notNull(),
  name: text("name").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
})

// Single-row config table — always upserted at id=1.
// policyMaxAmountUsdc stores whole USDC units (e.g. 2.5), not atomic units.
export const facilitatorConfig = pgTable("facilitator_config", {
  id: integer("id").primaryKey().default(1),
  policyMaxAmountUsdc: numeric("policy_max_amount_usdc").notNull(),
})

export const settlementAttestations = pgTable("settlement_attestations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paymentHash: text("payment_hash").notNull().unique(),
  settlementTx: text("settlement_tx"),
  attestationTx: text("attestation_tx"),
  payerAddress: text("payer_address").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "bigint" }).notNull(),
  policyMaxAmountUsdc: bigint("policy_max_amount_usdc", { mode: "bigint" }).notNull(),
  decisionRecord: jsonb("decision_record"),
  identityStatus: integer("identity_status").notNull(),
  decision: integer("decision").notNull(),
  authorizationNonce: text("authorization_nonce"),
})
