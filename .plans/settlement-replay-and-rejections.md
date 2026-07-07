# Settlement Pipeline: Replay Protection + Verify Rejection Recording

**Issue:** hivinaynair/metal#11
**Files touched:** `apps/facilitator/src/hooks/settle.ts`, `apps/facilitator/src/app.ts`, `packages/shared/src/db/schema.ts`, plus a DB migration

---

## Context

Two gaps remain in the settlement pipeline after the other parallel branch wired up `recordRejection()` calls:

1. **Replay protection is missing.** If an agent's network request fails after payment was settled but before it received the 200, it retries with the same EIP-3009 authorization. The on-chain nonce will reject the re-attempt, but only after a wasted gas write and a confusing failure returned to the agent. The Facilitator should detect this case and return the cached success.

2. **Policy rejection `paymentHash` is non-deterministic.** It uses `Date.now()` — not a replay risk (rejections are cheap to record multiple times) but makes DB records untraceable back to the original authorization.

---

## Step 1 — Add `authorization_nonce` column to `settlementAttestations`

**What:** Add a nullable `text` column `authorization_nonce` to `settlement_attestations`. Nullable so existing rows don't break.

**Files:**
- `packages/shared/src/db/schema.ts` — add `authorizationNonce: text("authorization_nonce")`
- New migration SQL file (or use `bun run db:push` / drizzle-kit depending on project convention)

**What could go wrong:**
- The column must be nullable — existing approved rows have no nonce and will be null. The dedup query must filter `authorization_nonce IS NOT NULL`.
- Check whether this project uses `drizzle-kit push` or explicit migration files (look at `package.json` scripts).

---

## Step 2 — Fix `onBeforeSettle` paymentHash for policy rejections

**What:** Replace `Date.now()` with a stable input derived from the EIP-3009 authorization nonce (or payer + amount if nonce isn't available at that layer). This makes policy rejection records traceable.

**Files:** `apps/facilitator/src/hooks/settle.ts`

```typescript
// Before (non-deterministic)
const paymentHash = keccak256(
  new TextEncoder().encode(`${payer}-${paymentAmountAtomic}-${Date.now()}`) as ...
)

// After (deterministic)
const auth = (paymentPayload.payload as Record<string, unknown>).authorization as Record<string, unknown> | undefined
const authNonce = (auth?.nonce ?? "") as string
const paymentHash = keccak256(
  new TextEncoder().encode(`${payer}-${paymentAmountAtomic}-${authNonce}`) as ...
)
```

**What could go wrong:**
- If `authorization.nonce` is missing (non-EIP-3009 scheme), falls back to empty string — identical hashes for same payer+amount across different policy-rejected requests. Acceptable for rejections (no double-spend risk). Could add a per-rejection suffix from `crypto.randomUUID()` as last resort if needed.

---

## Step 3 — Store `authorizationNonce` in `onAfterSettle`

**What:** Extract the EIP-3009 nonce from `paymentPayload.payload.authorization.nonce` and persist it into the new column on successful settlements.

**Files:** `apps/facilitator/src/hooks/settle.ts`

```typescript
// In onAfterSettle, extract before db.insert:
const auth = (paymentPayload.payload as Record<string, unknown>).authorization as Record<string, unknown> | undefined
const authorizationNonce = auth?.nonce as string | undefined

// Pass to insert:
await db.insert(schema.settlementAttestations).values({
  ...existingFields,
  authorizationNonce: authorizationNonce ?? null,
})
```

**What could go wrong:**
- The path `paymentPayload.payload.authorization.nonce` is not typed — must cast. Validate against a real payload in dev to confirm the field name.
- If nonce is undefined (non-EIP-3009 scheme), column stays null — dedup simply won't apply for those schemes.

---

## Step 4 — Add `onSettleFailure` recovery hook

**What:** New exported function `onSettleFailure` in `settle.ts`. When the EVM transfer fails (most likely: nonce already used on-chain), extract the auth nonce, query DB for an approved record with that nonce, and return `{ recovered: true, result: { success: true, transaction: existingTxHash } }`.

**Files:** `apps/facilitator/src/hooks/settle.ts`

```typescript
export async function onSettleFailure({
  paymentPayload,
}: FacilitatorSettleFailureContext): Promise<void | { recovered: true; result: SettleResponse }> {
  const auth = (paymentPayload.payload as Record<string, unknown>).authorization as Record<string, unknown> | undefined
  const authNonce = auth?.nonce as string | undefined
  if (!authNonce) return

  const existing = await getDb()
    .select()
    .from(schema.settlementAttestations)
    .where(
      and(
        eq(schema.settlementAttestations.authorizationNonce, authNonce),
        eq(schema.settlementAttestations.decision, Decision.Approved),
      )
    )
    .limit(1)

  if (existing.length > 0 && existing[0].settlementTx) {
    console.log("[onSettleFailure] duplicate payment detected, recovering:", authNonce)
    return {
      recovered: true,
      result: { success: true, transaction: existing[0].settlementTx },
    }
  }
}
```

**What could go wrong:**
- **Race condition:** `onAfterSettle` (DB write) hasn't completed when the duplicate arrives. In that window, the DB lookup returns nothing and the hook returns `void` → agent gets a failure for a payment that will eventually be recorded. Mitigation: the agent can retry once more and the next attempt will hit the record. Document this as a known edge case.
- **`SettleResponse` type must be imported** from `@x402/core/facilitator` — check the exact import path.
- **Only recovers if `settlementTx` is non-null** — if the first settlement had a null tx (shouldn't happen for Approved, but be defensive).

---

## Step 5 — Wire `onSettleFailure` in `app.ts`

**What:** Add `.onSettleFailure(onSettleFailure)` to the facilitator chain.

**Files:** `apps/facilitator/src/app.ts`

```typescript
import { onBeforeSettle, onAfterSettle, onSettleFailure } from "./hooks/settle.js"

facilitator
  .register(BASE_SEPOLIA_CAIP2, new ExactEvmScheme(facilitatorSigner))
  .onBeforeVerify((ctx) => onBeforeVerify(ctx, verifyDeps))
  .onBeforeSettle(onBeforeSettle)
  .onAfterSettle(onAfterSettle)
  .onSettleFailure(onSettleFailure)   // ← new
```

**What could go wrong:**
- Verify that `x402Facilitator.onSettleFailure()` returns `this` for chaining — it does per the type definition.

---

## Step 6 — Tests

**What:** Add tests for the two new behaviors.

**Files:** New or extended test file alongside `verify.test.ts`

Tests to write:
1. `onSettleFailure` — returns `recovered` when DB has matching `authorizationNonce` with `decision = Approved`
2. `onSettleFailure` — returns `void` when DB has no matching nonce (nonce not yet stored / different payment)
3. `onSettleFailure` — returns `void` when auth nonce is missing from payload
4. `onBeforeSettle` policy rejection — paymentHash no longer contains `Date.now()` (verify determinism by calling twice with same inputs)

---

## Execution Order

1. Schema + migration (Step 1) — must come first, the hook reads/writes this column
2. Steps 2 and 3 together — both in `settle.ts`, one diff
3. Steps 4 and 5 together — hook definition + wiring
4. Step 6 — tests last

---

## Risks & Watchouts

| Risk | Mitigation |
|---|---|
| `authorization.nonce` field name differs across x402 schemes | Check with real payload in dev; fail gracefully if missing (nonce = undefined → dedup skipped) |
| Race condition: parallel settle + lookup | Accept: agent retries once more; window is <1s |
| Drizzle migration convention | Check `package.json` scripts — use `push` or explicit migration file per project standard |
| `SettleResponse` type import path | Check against existing imports in settle.ts |
