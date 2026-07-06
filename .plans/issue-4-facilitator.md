# Issue #4 — apps/facilitator: full Metal primitive stack

## Current state

The facilitator is ~95% built. All core logic exists:
- x402 verify/settle/supported routes
- AP2 mandate verification (EIP-712, expiry, amount)
- ERC-8004 identity lookup in `onBeforeVerify`
- Policy enforcement in `onBeforeSettle`
- On-chain attestation in `onAfterSettle`
- Mandate registration endpoint `/mandates`

**What's missing per the issue AC:**
1. Tests for all verify paths (mocked ERC-8004 + mocked ExactEvmScheme)
2. `vercel.json` for Vercel deployment

> **No Postgres needed.** `AttestationRegistry` on-chain is the audit log. The console UI reads `Attested` events directly from Base Sepolia — no DB, no sync lag, no extra infra.

---

## Steps

### Step 1 — Tests for verify paths

**Files to create:**
- `apps/facilitator/src/hooks/verify.test.ts`

**Test framework:** bun test (already in the workspace).

**Paths to cover (all 5 `onBeforeVerify` branches):**
1. No mandate registered for payer → `{ abort: true, reason: "mandate_not_found" }`
2. Invalid EIP-712 signature → `{ abort: true, reason: "invalid_mandate_signature" }`
3. Expired mandate (`expiry < now`) → `{ abort: true, reason: "mandate_expired" }`
4. Amount exceeds mandate `maxAmountUsdc` → `{ abort: true, reason: "mandate_amount_exceeded" }`
5. ERC-8004 lookup fails / wallet mismatch → `{ abort: true, reason: "identity_not_found" }` or `"wallet_mismatch"`
6. Happy path → `undefined` (no abort)

**Mocking strategy:**
- Mock `getMandate` from mandate-store (module mock)
- Mock `verifyMandateSignature` to control signature result
- `lookupIdentity` hits real Base Sepolia — use the deployed `IdentityRegistry` at `IDENTITY_REGISTRY_ADDRESS`

**Risk:** Real chain reads in tests means tests need a live RPC. Acceptable since Base Sepolia is always up. For the "identity not found" case, use an address that's provably not registered.

---

### Step 2 — Vercel deployment

**Decision:** Hono app on Vercel Functions — use `@hono/vercel` adapter, export `app.fetch` as default.

**Files:**
- `apps/facilitator/package.json` — add `@hono/vercel`
- `apps/facilitator/src/index.ts` — split into `app.ts` (Hono app) + `index.ts` (local `serve()`). Export `handle(app)` as default from `api/index.ts` for Vercel.
- `apps/facilitator/vercel.json`:

```json
{
  "version": 2,
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }]
}
```

- `apps/facilitator/api/index.ts` — Vercel entry: `export default handle(app)`

**Risk:** `@hono/node-server`'s `serve()` is dev-only — must not be called in the Vercel entry. Splitting into `app.ts` + `index.ts` isolates this cleanly.
