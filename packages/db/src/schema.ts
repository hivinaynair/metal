import { bigint, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const agents = pgTable("agents", {
  address: text("address").primaryKey(),
  agentId: bigint("agent_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
})

export const settlementAttestations = pgTable("settlement_attestations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paymentHash: text("payment_hash").notNull().unique(),
  settlementTx: text("settlement_tx"),
  attestationTx: text("attestation_tx"),
  payerAddress: text("payer_address").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "number" }).notNull(),
  policyMaxAmountUsdc: bigint("policy_max_amount_usdc", { mode: "number" }).default(2000000).notNull(),
  decisionRecord: jsonb("decision_record"),
  identityStatus: integer("identity_status").notNull(),
  decision: integer("decision").notNull(),
  authorizationNonce: text("authorization_nonce"),
})
