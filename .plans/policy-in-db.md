# Plan: Store Policy Max Amount in Postgres

## Goal
Replace the in-memory `policy-store.ts` variable with a DB-backed row so the policy
ceiling persists across restarts and is consistent across all facilitator instances.

---

## Steps

### Step 1 — Add `facilitator_config` table to schema
**File:** `packages/db/src/schema.ts`

Add a single-row config table:
```ts
export const facilitatorConfig = pgTable("facilitator_config", {
  id: integer().primaryKey().default(1),  // always row 1
  policyMaxAmountUsdc: numeric("policy_max_amount_usdc").notNull(),
})
```

Using `integer` PK with default 1 enforces a single row (upsert on id=1).
Using `numeric` instead of `bigint` since the value is a decimal USDC amount (e.g. 2.5).

**Risk:** Schema change needs `db:push` — run `pnpm --filter @workspace/db db:push` after.

---

### Step 2 — Rewrite `policy-store.ts` to be DB-backed
**File:** `apps/facilitator/src/lib/policy-store.ts`

Both functions become async and hit the DB:

```ts
export async function getPolicyMaxAmountUsdc(): Promise<number> {
  const db = getDb()
  const rows = await db.select().from(schema.facilitatorConfig).limit(1)
  if (rows.length > 0) return Number(rows[0].policyMaxAmountUsdc)
  // Seed from env var if no row exists yet
  await db.insert(schema.facilitatorConfig)
    .values({ id: 1, policyMaxAmountUsdc: String(env.POLICY_MAX_AMOUNT_USDC) })
    .onConflictDoNothing()
  return env.POLICY_MAX_AMOUNT_USDC
}

export async function getPolicyMaxAtomic(): Promise<bigint> {
  const usdc = await getPolicyMaxAmountUsdc()
  return BigInt(Math.round(usdc * 1_000_000))
}

export async function setPolicyMaxAmountUsdc(value: number): Promise<void> {
  await getDb()
    .insert(schema.facilitatorConfig)
    .values({ id: 1, policyMaxAmountUsdc: String(value) })
    .onConflictDoUpdate({ target: schema.facilitatorConfig.id, set: { policyMaxAmountUsdc: String(value) } })
}
```

**Risk:** Both functions become async — callers need `await`.

---

### Step 3 — Update callers of `getPolicyMaxAtomic()`
**Files:** `apps/facilitator/src/lib/validate-mandate.ts`, `apps/facilitator/src/hooks/settle.ts`

Both files already use async functions so adding `await` is straightforward:
- `validate-mandate.ts`: `recordRejection` — `const policyMaxAmountUsdc = await getPolicyMaxAtomic()`
- `settle.ts`: `onBeforeSettle` — `const policyMaxAtomic = await getPolicyMaxAtomic()`
- `settle.ts`: `onAfterSettle` — `const policyMaxAtomic = await getPolicyMaxAtomic()`

---

### Step 4 — Update `GET /policy` and `POST /policy` in `app.ts`
**File:** `apps/facilitator/src/app.ts`

Both route handlers need to `await`:
```ts
app.get("/policy", async (c) => c.json({ maxAmountUsdc: await getPolicyMaxAmountUsdc() }))

app.post("/policy", async (c) => {
  ...
  await setPolicyMaxAmountUsdc(body.maxAmountUsdc)
  return c.json({ maxAmountUsdc: await getPolicyMaxAmountUsdc() })
})
```

---

### Step 5 — Remove `POLICY_MAX_AMOUNT_USDC` from `env.ts`
**File:** `apps/facilitator/src/lib/env.ts`

Once the DB is seeded on first read, the env var is only needed as a seed default.
Keep it as optional with a default so existing deployments don't break:
```ts
POLICY_MAX_AMOUNT_USDC: z.coerce.number().default(DEMO_POLICY_MAX_AMOUNT_USDC)
```
(Already optional — no change needed here.)

---

## Risks & Unknowns

- **DB latency on every payment**: `getPolicyMaxAtomic()` is now called in `onBeforeSettle` and `onAfterSettle` on every request. Could add a short-lived in-memory cache (e.g. 5s TTL) if this becomes a concern.
- **`numeric` vs `real`**: Drizzle's `numeric` returns a string from Postgres — need `Number()` cast on read.
- **`db:push` needs to run**: Schema change won't apply until pushed to Neon.
- **Single-row pattern**: Using `id = 1` as the convention. An alternative is a `key/value` config table for future extensibility.
