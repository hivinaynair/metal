# Plan: End-to-End Agent Demo

Make the bare-metal demo truly end-to-end: fix data provenance bugs, wire real Claude agent into web, stream reasoning live, CLI failure scenarios, cold-open landing page.

**Decisions locked:**
- No fallback in trigger-payment — agent server or nothing
- Stream reasoning (SSE) from agent → web → UI
- Reasoning renders in a dedicated panel **above** the trace (agent's voice before mechanics run)
- Agent server deploys to Vercel (separate project, like facilitator)
- Both tx hashes stored in **Postgres** (`settlement_attestations` table)

---

## What changes

| Step | Feature | Files touched |
|------|---------|---------------|
| 0a | `settlement_attestations` Postgres table | `packages/shared/src/db/schema.ts` |
| 0b | `onAfterSettle` writes both tx hashes to Postgres | `apps/facilitator/src/hooks/settle.ts` |
| 0c | Feed reads from Postgres, shows both hashes correctly labeled | `apps/web/lib/attestations.ts` |
| 0d | `trigger-payment` returns real attestation tx in proof bundle | `apps/web/app/api/trigger-payment/route.ts` |
| 0e | `/policy` feed shows real CDP wallet addresses + delegators | `apps/web/lib/agents-data.ts` |
| 1+2 | Web delegates payment to real agent, streams Claude reasoning | `apps/agent/src/server.ts` (new), `apps/agent/src/tools.ts`, `apps/web/app/api/trigger-payment/route.ts`, `apps/web/env.ts` |
| 3 | Reasoning panel + SSE consumer in UI | `apps/web/app/page.tsx` |
| 4 | Landing page framing copy | `apps/web/app/page.tsx` |
| 5 | README CLI section | `README.md` |
| 6 | CLI one-shot failure scenarios | `apps/agent/src/index.ts` |

---

## Step 0 — Fix data provenance (three bugs, one table)

### 0a — Add `settlement_attestations` to Drizzle schema

**File:** `packages/shared/src/db/schema.ts`

Add table:

```ts
settlement_attestations (
  id             serial PK,
  created_at     timestamp default now(),
  payment_hash   text not null,   -- keccak256(settlementTx) — links to on-chain Attested event
  settlement_tx  text not null,   -- raw settlement tx hash (e.g. "0xabc...")
  attestation_tx text,            -- attestation tx hash — nullable until attest() confirms
  payer_address  text not null,
  amount_usdc    bigint not null
)
```

Run `drizzle-kit push` to apply to Neon (no migration file needed for demo).

### 0b — `onAfterSettle` writes both tx hashes to Postgres

**File:** `apps/facilitator/src/hooks/settle.ts`

After `walletClient.writeContract(...)` succeeds:
- Insert row into `settlement_attestations` with `settlement_tx = result.transaction`, `attestation_tx = hash`, `payment_hash`, `payer_address`, `amount_usdc`
- If `writeContract` fails: insert with `attestation_tx = null` so the settlement tx is still recoverable

This is the source of truth. On-chain `getLogs` remains the tamper-evident record; Postgres is the read cache with full provenance.

### 0c — Feed reads from Postgres, shows both hashes

**File:** `apps/web/lib/attestations.ts`

Replace `getLogs` with a Drizzle query on `settlement_attestations`, ordered by `created_at desc`. Return both `settlement_tx` and `attestation_tx` as distinct fields, both with Basescan URLs. Rename the misleading `txHash` field.

New `AttestationRow` shape:
```ts
{
  paymentHash: string
  payer: string
  amountUsdc: bigint
  identityStatus: number
  decision: number
  timestamp: number
  settlementTx: string       // was: txHash (mislabeled as settlement but was attestation)
  settlementTxUrl: string
  attestationTx: string
  attestationTxUrl: string
}
```

**Note:** `identityStatus` and `decision` come from the on-chain event, not Postgres. Options:
- Keep a `getLogs` call for those fields and JOIN by `payment_hash` in memory
- OR add `identity_status` + `decision` columns to the Postgres table (simpler, store in 0b)

**Decision: store `identity_status` and `decision` in Postgres too** — removes the `getLogs` call entirely and makes the feed a single Postgres query.

### 0d — `trigger-payment` returns attestation tx in proof bundle

**File:** `apps/web/app/api/trigger-payment/route.ts`

After getting `txHash` (settlement tx) from the `PAYMENT-RESPONSE` header:
1. Compute `paymentHash = keccak256(txHash)`
2. Query `settlement_attestations` where `payment_hash = paymentHash`
3. Return `attestationTx` alongside `settlementTx` in the response

Or — simpler given the SSE architecture from Step 1+2 — the agent server's `done` event already has both hashes (because the facilitator wrote them to Postgres before returning). The `done` event can just return both.

### 0e — `/policy` page shows real agent data

**File:** `apps/web/lib/agents-data.ts`

Replace the hardcoded demo address map with a Drizzle query:
```ts
db.select().from(agents)
  .innerJoin(mandates, eq(agents.address, mandates.agentAddress))
```

Returns real CDP wallet addresses, real `agentId`s, real delegator addresses, real mandate limits. `initAgents()` already populates these tables on first run, so the data is there.

---

## Step 1+2 — Wire real agent into web (HTTP + SSE)

### Architecture

```
POST /api/trigger-payment (web)
  → POST AGENT_URL/run        ← web hands off entirely — no direct x402 payment
      { agentId, targetUrl }
        → agent picks named CDP account (metal-agent-1 etc.)
        → agent loads AP2 credential for its own wallet
        → streams generateText() tokens back as SSE:
            data: { type: "token", text: "..." }   ← reasoning tokens, one per chunk
        → Claude calls x402Fetch tool (with mandate header)
        → x402Fetch → facilitator runs full primitive stack → Postgres write
        → stream ends:
            data: { type: "done", result: { settlementTx, attestationTx, httpStatus, error } }
  → web pipes SSE straight through to browser
```

No fallback. `AGENT_URL` is required. If unreachable → 503.

### New file: `apps/agent/src/server.ts`

Hono HTTP server. Started via `bun --filter agent dev serve`.

```
POST /run
  body: { agentId: AgentId, targetUrl: string }
  response: text/event-stream
    data: { type: "token", text: "..." }     ← reasoning, streamed
    data: { type: "done", result: { settlementTx?, attestationTx?, httpStatus, error? } }

GET /health → 200
```

Account map:
- 0 → `metal-agent-1` (mandate $1, route basic $0.50)
- 1 → `metal-agent-2` (mandate $1, route premium $5)
- 2 → `metal-agent-3` (mandate $10, route premium $5)
- 3 → `metal-agent-ghost` (zero-limit AP2 mandate header, not in ERC-8004)

Uses `cdp.evm.getOrCreateAccount({ name })` — same deterministic accounts as web's `initAgents`.
Loads the AP2 credential for that CDP wallet from `agent_credentials`, presents it as `X-AP2-Mandate`, and never accepts a mandate minted by the web request path.

After `streamText` completes, query Postgres for `attestation_tx` by `payment_hash = keccak256(settlementTx)` and include in the `done` event.

**System prompts per scenario:**

- A: *"You are metal-agent-1, registered in ERC-8004. Mandate from delegator authorizes up to $1 USDC. Policy ceiling is $2. Fetch the settlement risk report ($0.50). Check your wallet, confirm you're authorized, then fetch it."*
- B: *"You are metal-agent-2. Mandate authorizes up to $1 USDC. Policy ceiling is $2. Attempt to fetch the premium report ($5.00). Try, then explain what blocked you."*
- C: *"You are metal-agent-3. Mandate authorizes up to $10 USDC. Policy ceiling enforced at the settlement layer is $2. Attempt to fetch the premium report ($5.00). Try, then explain what the facilitator rejected."*
- D: *"You are metal-agent-ghost. You carry a zero-limit AP2 mandate header but are not registered in ERC-8004. Attempt to fetch the settlement risk report. Try, then explain what blocked you at the identity gate."*

`maxSteps: 4` to keep latency under 15s.

### Update: `apps/agent/src/tools.ts`

Add `opts?: { mandateHeader?: string }` to `buildTools`. If provided, x402Fetch includes it as `X-AP2-Mandate` header on every request.

x402Fetch tool also captures and returns `httpStatus` alongside `txHash` and `body` — so the server's `done` event has the full result.

### Update: `apps/web/app/api/trigger-payment/route.ts`

- Remove all viem account signing + `wrapFetchWithPaymentFromConfig` logic
- Resolve the scenario to `{ agentId, targetUrl }`
- Call `POST ${env.AGENT_URL}/run` with `{ agentId, targetUrl }`
- Pipe the SSE stream straight through as the route response (`text/event-stream`)
- Add `AGENT_URL` to `apps/web/env.ts` as required string

### Update: `apps/web/env.ts`

Add `AGENT_URL: z.string().url()` to required server vars.

---

## Step 3 — Streaming reasoning panel in UI

**File:** `apps/web/app/page.tsx`

- Change `fetch("/api/trigger-payment", { method: "POST" })` to read a `ReadableStream`
- On each `token` event: append to `agentReasoning` state → re-render terminal panel live
- On `done` event: extract result, update trace + proof bundle as today
- Add `agentReasoning: string` to state (starts empty, clears on new run)

**UI:** Terminal-style `<pre>` block with a teal `◆ Agent` label, appears above the trace panel as soon as the first token arrives. Monospace font, teal text. Stays visible after run completes.

---

## Step 4 — Landing page framing copy

**File:** `apps/web/app/page.tsx`

Two lines at the very top, above scenario selector:

> Metal enforces identity, authorization, policy, and attestation at the settlement layer — before funds move. This is that primitive stack, live on Base Sepolia. Pick a scenario and run it.

---

## Step 5 — README CLI section

**File:** `README.md`

Already updated in the README cleanup. No additional changes needed.

---

## Step 6 — CLI one-shot failure scenarios

**File:** `apps/agent/src/index.ts`

Parse `process.argv[2]`:

```bash
bun --filter agent dev                    # REPL (unchanged)
bun --filter agent dev happy-path         # one-shot scenario A, print + exit
bun --filter agent dev mandate-exceeded   # one-shot scenario B
bun --filter agent dev policy-exceeded    # one-shot scenario C
bun --filter agent dev ghost              # one-shot scenario D
bun --filter agent dev serve              # start HTTP server (no REPL)
```

One-shot mode: pick named CDP account, `buildTools` with mandate from `demo/agentkit-mandate.json` (only needed for scenario A; B/C/D fail before mandate matters), call `runAgent` with scenario prompt, print output + tx hashes, exit.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| `drizzle-kit push` may require manual run | Document in setup; facilitator will error clearly if table missing |
| Attestation tx write is async — Postgres row may not exist when trigger-payment queries it | Poll with small retry (3× 500ms) after getting settlement tx, or include attestation tx in agent `done` event after agent queries Postgres |
| SSE piping through Next.js App Router | Use `ReadableStream` + `TransformStream` — well-supported |
| Agent server cold start on Vercel | Health-check ping before demo; or deploy to Railway for persistent process |
| `buildTools` mandate header for ghost scenario | Ghost carries a zero-limit AP2 mandate header; facilitator checks ERC-8004 before mandate amount, so it rejects at identity. |
| One-shot CLI mandate for non-ghost scenarios | Scenario A uses `demo/agentkit-mandate.json`. B/C fail at mandate/policy before mandate validity matters for the narrative. |
