# Agent Init Refactor

**Supersedes:** `2026-07-08-db-backed-agent-init.md`

## Goal

- Agent owns its wallets, mandates, and routing — web just initiates
- Bootstrap mandates once at deploy time via a script
- `trigger-payment` becomes: look up `AgentId` → `POST /run { agentId }` → pipe SSE
- No per-request init, no mandate lookup in web, no policy fetch in payment path

## Architecture

```
[deploy] bun run demo:bootstrap
  → GET $AGENT_URL/agents         (agent loads/creates CDP wallets, registers ERC-8004)
  → sign EIP-712 mandates with DELEGATOR_PRIVATE_KEY
  → write agents + mandates to DB

[runtime] POST /api/trigger-payment { scenarioIndex }
  → resolve AgentId from scenarioIndex
  → POST $AGENT_URL/run { agentId }
  → pipe SSE back to browser

[agent /run]
  → load mandate from DB by agentId
  → derive targetUrl from APP_URL env + scenario route
  → run Claude with x402Fetch tool
  → stream SSE
```

**Delegator key stays in `apps/web`:** Web acts as the demo delegator (in production this is the user's wallet). Agent owns execution, web owns authorization issuance (at bootstrap time only).

---

## Steps

### Step 1 — Add `AgentId` enum to `packages/shared`

**What:** Add to `packages/shared/src/types.ts` (or new `packages/shared/src/agents.ts`):

```typescript
export enum AgentId {
  Agent1 = "metal-agent-1",
  Agent2 = "metal-agent-2",
  Agent3 = "metal-agent-3",
  Ghost  = "metal-agent-ghost",
}
```

**Touches:** `packages/shared/src/types.ts`, `packages/shared/src/index.ts` (re-export)

**Risk:** None — additive.

---

### Step 2 — Add `GET /agents` to `apps/agent/src/server.ts`

**What:** Idempotently load-or-create CDP accounts for each `AgentId`, register in ERC-8004 if not already, return `[{ agentId: AgentId, address: string }]`. Blocks until all agents are ready.

**Touches:** `apps/agent/src/server.ts`, possibly new `apps/agent/src/wallets.ts`

**Risk:** ERC-8004 registration is an on-chain tx — must be idempotent (check registry before writing). Fail loudly on partial success.

---

### Step 3 — Create `scripts/demo-bootstrap.ts`

**What:** `bun scripts/demo-bootstrap.ts`. Calls `GET $AGENT_URL/agents`, for each agent: checks DB for existing non-expired mandate, skips if found, signs EIP-712 mandate with `DELEGATOR_PRIVATE_KEY`, posts to facilitator, writes `agents` + `mandates` rows to DB.

**Env needed:** `AGENT_URL`, `DELEGATOR_PRIVATE_KEY`, `DATABASE_URL`, `FACILITATOR_URL`

**Touches:** New `scripts/demo-bootstrap.ts`

**Risk:** Agent must be running when bootstrap runs — fail loudly with clear message if unreachable.

---

### Step 4 — Update `apps/agent/src/server.ts` `/run` endpoint

**What:** Change request body from `{ scenarioIndex, mandateHeader, targetUrl }` to `{ agentId: AgentId }`. Agent:
- Loads CDP account by `agentId` name
- Loads mandate from DB by `agentId`
- Derives `targetUrl` from `APP_URL` env + hardcoded route per `AgentId`
- Runs Claude with x402Fetch tool, streams SSE

**Touches:** `apps/agent/src/server.ts`, `apps/agent/src/tools.ts`

**Risk:** Agent needs `APP_URL` and `DATABASE_URL` in env. Mandate not found → clear SSE error event.

---

### Step 5 — Delete `apps/web/lib/init-agents.ts`, simplify `trigger-payment`

**What:** Delete `init-agents.ts`. Update `trigger-payment/route.ts` to:
- Map `scenarioIndex` → `AgentId`
- `POST $AGENT_URL/run { agentId }`
- Pipe SSE (enrich done event with web-side display metadata as today)
- Remove `initAgents()`, mandate lookup, policy fetch

**Touches:** `apps/web/lib/init-agents.ts` (delete), `apps/web/app/api/trigger-payment/route.ts`

**Risk:** Check all imports of `init-agents.ts` (`agents-data.ts`, `payment-demo.ts`) — update or remove.

---

### Step 6 — Wire bootstrap to deploy

**What:** Document `bun scripts/demo-bootstrap.ts` as a required post-deploy step in `docs/plans/end-to-end-agent-demo.md`. Optionally add as a root `package.json` script: `"demo:bootstrap": "bun scripts/demo-bootstrap.ts"`.

**Touches:** Root `package.json`, `docs/plans/end-to-end-agent-demo.md`

**Risk:** Bootstrap must run after agent is live — not automatable as a Vercel build step. Manual for now.

---

## Unresolved Questions

1. Should `GET /agents` also handle ERC-8004 registration, or should bootstrap do it after receiving addresses?
2. Mandate expiry — hardcoded (e.g. 30 days) in bootstrap script or configurable via env?
3. Should agent load mandate from DB on each `/run` call, or cache in memory on startup?
