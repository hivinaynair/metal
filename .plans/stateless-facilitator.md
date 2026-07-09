# Stateless Facilitator Refactor

Reflect Metal's target architecture: mandates are self-contained cryptographic credentials, chain is the source of truth for identity and attestation. The facilitator verifies math, not its own database.

**Principle:** Drop `mandates` and `agentCredentials` as authorization stores. Keep `settlementAttestations` as a read-only indexer of on-chain attestation state. Keep `agents` as an operational index owned by the agent app — used for fast lookups to initiate payments, never touched by the facilitator's verification path.

---

## Step 1: Extract shared `validateMandateForPayment()` ← key addition from Codex review

**Files:** new `apps/facilitator/src/lib/validate-mandate.ts`, `apps/facilitator/src/hooks/verify.ts`, `apps/facilitator/src/hooks/settle.ts`

The core correction: settle must independently authorize the payment, not just read mandate data for audit. A `/settle` call can arrive without a prior `/verify`. After removing the DB gate, there is no other enforcement on the settle path.

Extract all AP2 checks from `onBeforeVerify` into a shared function:
```ts
validateMandateForPayment({
  mandateJson,     // from requestCtx
  payer,           // from paymentPayload
  amountAtomic,    // from requirements
  deps,            // verifyMandateSignature, lookupIdentity, etc.
}): Promise<{ mandate, mandateEntry } | { abort: true; reason: string }>
```

Checks (same order as current verify):
1. Parse mandate from header — abort `mandate_missing` if absent
2. Verify EIP-712 signature — abort `mandate_invalid`
3. Confirm `mandate.payload.agent === payer` — abort `mandate_invalid`
4. Check ERC-8004 identity — abort `identity_not_found`
5. Check expiry — abort `mandate_expired`
6. Check amount ≤ mandate limit — abort `mandate_amount_exceeded`

`onBeforeVerify` calls this and aborts/records as before.
`onBeforeSettle` calls this and aborts *before* settlement executes — same logic, same error codes. `onAfterSettle` reads validated mandate from the same context for decision record metadata (no re-validation needed post-settlement).

**Risk:** `onBeforeSettle` currently returns `{ abort, reason }` to stop settlement. Confirm x402 core respects abort from `onBeforeSettle` — it does, per current usage.

---

## Step 2: Thread mandate through `requestCtx` in settle hooks

**Files:** `apps/facilitator/src/hooks/settle.ts`

`app.ts` already sets `requestCtx` for both `/verify` and `/settle` routes. ALS is safe here — separate HTTP requests do not bleed context; each `requestCtx.run(...)` creates an isolated async scope.

Replace `getMandate(payer)` with `requestCtx.get().mandateJson` fed into `validateMandateForPayment()` (Step 1). Add concurrent-request tests proving separate `requestCtx.run(...)` calls see distinct mandate headers.

**Risk:** If `requestCtx.get()` returns `undefined` (settle called outside the ALS scope), handle gracefully — treat as `mandate_missing`.

---

## Step 3: Fix EIP-712 domain — add `chainId` ← from Codex review

**Files:** `packages/shared/src/mandate.ts`

Current domain is `{ name, version }` only. A mandate signed on Base Sepolia is replayable on any other chain or against any other facilitator.

Add `chainId` (Base Sepolia: `84532`) to `MANDATE_EIP712_DOMAIN`. For production, also add `verifyingContract` (facilitator address or a dedicated mandate registry contract).

**Risk:** Any existing signed mandates (including `demo/mandate.json`) will have invalid signatures after this change — bootstrap must re-sign all mandates.

---

## Step 4: Update agent to load mandate from file instead of DB

**Files:** `apps/agent/src/credentials.ts`

Bootstrap will write `apps/agent/mandates.json` (see Step 5). The agent reads this file instead of querying `agentCredentials`. The mandate is agent-owned config — it belongs with the agent, not in a shared `demo/` folder.

`mandates.json` format — keyed by lowercase agent address:
```json
{
  "0xabc...": { "agentId": "42", "payload": { ... }, "signature": "0x..." }
}
```

`getAp2CredentialForAgent(agentAddress)` becomes a file read + lookup by address, with the same expiry check and `parseSerializedMandateHeader` parsing. Validate on read: address match, shape, expiry.

File path: `MANDATE_FILE` env var, defaulting to `./mandates.json` relative to the agent package. Gitignored. If the agent is ever deployed independently, the mandate file travels with it.

**Risk:** If file doesn't exist (bootstrap not run), agent returns `undefined` — same as today. Error stays `mandate_not_registered` → rename per Step 6.

---

## Step 5: Update bootstrap to write mandate files, skip DB/facilitator

**Files:** `scripts/demo-bootstrap/mandates.ts`, `scripts/demo-bootstrap/credentials.ts`, `scripts/demo-bootstrap/agents.ts`

In `ensureMandate()`:
- Remove `db.insert(schema.mandates)`
- Remove `registerMandateWithFacilitator()` call
- Instead: write signed mandate into `apps/agent/mandates.json` (read-modify-write, keyed by agent address, atomic write)

Idempotency: check whether address already exists in `mandates.json` — if so, rehydrate from file instead of re-signing. (Replaces the current DB row existence check.)

Remove `scripts/demo-bootstrap/credentials.ts` — `upsertAgentCredential()` no longer needed.
Remove `upsertAgentCredential()` call from `scripts/demo-bootstrap/agents.ts`.

**Risk:** After Step 3 (domain change), existing `mandates.json` mandates are invalid. Bootstrap re-run is required. This is expected.

---

## Step 6: Remove `/mandates` endpoint, `mandate-store.ts`, rename error codes

**Files:** `apps/facilitator/src/routes/mandates.ts` (delete), `apps/facilitator/src/lib/mandate-store.ts` (delete), `apps/facilitator/src/app.ts`, `apps/facilitator/src/hooks/verify.ts`, `apps/facilitator/src/hooks/settle.ts`

- Delete `mandates.ts` route file
- Delete `mandate-store.ts`
- In `app.ts`: remove `mandatesRouter` import and `app.route("/mandates", mandatesRouter)`
- Rename `mandate_not_registered` → `mandate_missing` throughout (the registration model no longer exists)

---

## Step 7: Drop `mandates` and `agentCredentials` from schema, generate migration

**Files:** `packages/db/src/schema.ts`

Remove:
- `export const mandates = pgTable(...)`
- `export const agentCredentials = pgTable(...)`

Keep `agents` — it's an operational index for the agent app (fast lookups of agent addresses/names to initiate payments). Bootstrap continues writing to it after ERC-8004 registration.

The facilitator never reads `agents`. Agent name in decision records comes from the ERC-8004 `profile` object fetched during `validateMandateForPayment()`.

Generate and run migration:

Generate and run migration:
```bash
pnpm --filter @workspace/db drizzle-kit generate
pnpm --filter @workspace/db drizzle-kit migrate
```

**Risk:** Destructive — drops tables and data. Run on a branch.

---

## Step 8: Cleanup

- `scripts/demo-bootstrap/context.ts`: Remove `MandateRow` type
- `scripts/demo-bootstrap/mandates.ts`: Remove `schema` import
- Add `apps/agent/mandates.json` to `.gitignore`

---

## What doesn't change

- `agents` table — kept as agent app operational index; facilitator never reads it ✓
- `settlementAttestations` table — correct as on-chain indexer ✓
- `AttestationRegistry` contract writes — unchanged ✓
- Web app (`attestations.ts`) — only queries `settlementAttestations`, unaffected ✓

---

## Out of scope for demo, must revisit for production

- **Delegator trust:** after removing the registration gate, any wallet can be a delegator. Production needs an allowlist, registry check, or issuer policy.
- **Revocation:** self-contained credentials with long expiries have no revocation path. Production needs revoked nonces, key rotation support, or an on-chain revocation registry. Short expiries are the demo workaround.
- **`verifyingContract` in EIP-712 domain:** prevents cross-facilitator replay. Requires a stable contract address to bind to.

---

## Resolved decisions

- **Delegator allowlist:** accept any delegator — pure cryptographic verification, no issuer check. Production concern tracked in "out of scope" section.
