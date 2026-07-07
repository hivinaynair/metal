# Lazy Init + Demo Scenarios Plan

## Overview

On first `/api/trigger-payment` call, all 4 demo agents bootstrap themselves automatically — no scripts, no manual steps. Subsequent calls skip init. All steps are idempotent.

DATABASE_URL: `postgresql://neondb_owner:npg_gxsyCbu6Jmp4@ep-calm-snow-aobjmc7k-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

---

## 4 Demo Scenarios

| Slot | Agent | Route | Price | Mandate limit | Fails at | Outcome |
|------|-------|-------|-------|---------------|----------|---------|
| A | metal-agent-retail | /api/settlement-risk-report | $0.01 | $1 | — | ✅ approved |
| B | metal-agent-capped | /api/premium-risk-report | $5.00 | $1 | mandate ($5 > $1) | ❌ mandate_amount_exceeded |
| C | metal-agent-uncapped | /api/premium-risk-report | $5.00 | $10 | policy ($5 > $2 ceiling) | ❌ policy_amount_exceeded |
| D | metal-agent-ghost | /api/settlement-risk-report | $0.01 | none | identity (not in ERC-8004) | ❌ identity_not_found |

POLICY_MAX_AMOUNT_USDC = 2

---

## Steps

### Step 1 — Drizzle schema in `packages/shared`

**New files:**
- `packages/shared/src/db/schema.ts` — `agents` + `mandates` tables
- `packages/shared/src/db/index.ts` — Drizzle client (neon-http driver)
- `packages/shared/drizzle.config.ts` — drizzle-kit config
- `packages/shared/src/db/migrations/` — committed SQL migration files

**Schema:**
```ts
agents(
  address TEXT PRIMARY KEY,     // CDP wallet address
  agent_id BIGINT NOT NULL,     // ERC-8004 token ID
  name TEXT NOT NULL,           // "metal-agent-retail" etc
  registered_at TIMESTAMPTZ DEFAULT now()
)

mandates(
  agent_address TEXT PRIMARY KEY REFERENCES agents(address),
  delegator_address TEXT NOT NULL,
  max_amount_usdc BIGINT NOT NULL,  // in whole USDC (not atomic)
  expiry BIGINT NOT NULL,           // unix timestamp
  nonce BIGINT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)
```

**Add to `packages/shared/package.json`:** `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`

**Export paths:** `@workspace/shared/db`

**Risk:** Both apps/web and apps/facilitator need DATABASE_URL. Add to both env files + env.ts validation.

---

### Step 2 — Lazy init function in `apps/web`

**New file:** `apps/web/lib/init-agents.ts`

**Logic (all idempotent):**
```
initAgents():
  1. CdpClient.getOrCreateAccount × 4 (by name) → get addresses
  2. For retail, capped, uncapped:
     a. SELECT from agents WHERE address = ?
     b. If missing: registerInErc8004(account) → INSERT into agents
     c. SELECT from mandates WHERE agent_address = ?
     d. If missing: signTypedData(DELEGATOR_PRIVATE_KEY, mandatePayload) → INSERT into mandates
     e. Check USDC balance → if < 0.10 USDC: CDP faucet request
  3. Ghost: getOrCreateAccount only — no ERC-8004, no mandate
  4. Return { retail, capped, uncapped, ghost } account objects
```

**Mandate payload per agent:**
- retail: `{ agent, delegator, maxAmountUsdc: 1n, expiry: 9999999999n, nonce: 0n }`
- capped: `{ agent, delegator, maxAmountUsdc: 1n, expiry: 9999999999n, nonce: 0n }`
- uncapped: `{ agent, delegator, maxAmountUsdc: 10n, expiry: 9999999999n, nonce: 0n }`

**Module-level promise cache:** `let initPromise: Promise<Agents> | null = null` — ensures init runs once per process even under concurrent requests.

**Risk:** ERC-8004 registration costs gas. Agents need Base Sepolia ETH. CDP faucet only gives USDC, not ETH. ETH must be funded separately (once, before first run). Flag this clearly in README.

**Risk:** First cold-start takes ~15s (3 ERC-8004 txs). `/api/trigger-payment` should return `{ status: "initializing" }` immediately and poll, OR accept the latency on first call.

---

### Step 3 — `/api/trigger-payment` in `apps/web`

**New file:** `apps/web/app/api/trigger-payment/route.ts`

**Request:** `POST /api/trigger-payment` with optional `?slot=A|B|C|D` (defaults to auto-cycle A→B→C→D)

**Logic:**
```
1. await initAgents()
2. pick scenario by slot
3. build fetchWithPayment using ExactEvmScheme(account)
4. POST to APP_URL/{route}
5. decode PAYMENT-RESPONSE header → extract txHash
6. return { slot, agent, route, outcome, txHash, basescan }
```

**Auto-cycle:** module-level counter `let cycle = 0`, increments per call, `slot = ["A","B","C","D"][cycle % 4]`

**New env vars needed in `apps/web/env.ts`:**
- `DATABASE_URL`
- `DELEGATOR_PRIVATE_KEY`
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`

---

### Step 4 — `/api/premium-risk-report` in `apps/web`

**New file:** `apps/web/app/api/premium-risk-report/route.ts`

Same pattern as `settlement-risk-report` but price = `"$5.00"`. Returns a different mock report body.

---

### Step 5 — Facilitator: replace Redis with Drizzle

**Rewrite:** `apps/facilitator/src/lib/mandate-store.ts`

Same public API (`getMandate(agent)`, `registerMandate(mandate, agentId)`) but backed by Drizzle + Neon instead of Upstash Redis.

```ts
// getMandate: SELECT FROM mandates JOIN agents WHERE agent_address = agent
// registerMandate: INSERT INTO agents + mandates (on conflict do nothing)
```

**Remove from `apps/facilitator/package.json`:** `@upstash/redis`

**Add:** `drizzle-orm`, `@neondatabase/serverless`

**New env var in facilitator:** `DATABASE_URL`

**Remove env vars:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**`verify.ts` deps:** no interface changes — `getMandate` signature stays identical.

---

### Step 6 — Console UI (high level, separate plan)

Issues #6, #7, #8 — separate plan after lazy init is working.

- `/feed` page: query `AttestationRegistry` events on-chain, render table
- Trigger button: calls `/api/trigger-payment`, refreshes feed
- Detail sheet: per-row primitive stack trace
- Policy page (#8): show mandate limits from DB

---

## Env vars summary

| Var | apps/web | apps/facilitator |
|-----|----------|-----------------|
| DATABASE_URL | ✅ | ✅ |
| DELEGATOR_PRIVATE_KEY | ✅ | — |
| CDP_API_KEY_ID | ✅ | — |
| CDP_API_KEY_SECRET | ✅ | — |
| CDP_WALLET_SECRET | ✅ | — |
| FACILITATOR_URL | ✅ (exists) | — |
| ATTESTATION_REGISTRY_ADDRESS | — | ✅ (exists) |
| IDENTITY_REGISTRY_ADDRESS | — | ✅ (exists) |
| FACILITATOR_PRIVATE_KEY | — | ✅ (exists) |
| POLICY_MAX_AMOUNT_USDC | — | ✅ set to 2 |

Remove from facilitator: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## Open questions

1. **Ghost mandate in DB?** Ghost never registers in ERC-8004. Does it get a mandate row in DB? Recommend: no — simplest way to trigger `identity_not_found` is to have no identity, regardless of mandate.
2. **First-run ETH funding:** who funds the 3 agent wallets with Base Sepolia ETH for gas? Must happen before first trigger. Recommend adding to README as the only manual step.
3. **Scenario cycle:** auto-cycle (A→B→C→D) vs explicit `?slot=` param? Recommend auto-cycle for the demo button, explicit param for testing.
4. **DB schema location:** `packages/shared/src/db` (shared between web + facilitator) vs each app owns its own? Recommend shared — both apps read the same tables.
