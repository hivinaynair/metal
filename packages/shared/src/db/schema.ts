import { bigint, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

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

export const agentCredentials = pgTable("agent_credentials", {
  id: serial("id").primaryKey(),
  agentAddress: text("agent_address").notNull().references(() => agents.address),
  agentName: text("agent_name").notNull(),
  credentialType: text("credential_type").notNull(),
  credentialJson: jsonb("credential_json").notNull(),
  expiresAt: bigint("expires_at", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  agentCredentialUnique: uniqueIndex("agent_credentials_agent_type_idx").on(
    table.agentAddress,
    table.credentialType,
  ),
}))

export const settlementAttestations = pgTable("settlement_attestations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paymentHash: text("payment_hash").notNull(),
  settlementTx: text("settlement_tx"),
  attestationTx: text("attestation_tx"),
  payerAddress: text("payer_address").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "bigint" }).notNull(),
  policyMaxAmountUsdc: bigint("policy_max_amount_usdc", { mode: "bigint" }).default(2000000n).notNull(),
  decisionRecord: jsonb("decision_record"),
  identityStatus: integer("identity_status").notNull(),
  decision: integer("decision").notNull(),
  authorizationNonce: text("authorization_nonce"),
})
