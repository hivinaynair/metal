# ERC-8004 On-Chain Trusted Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded "Trusted" default on the agents table with a live ERC-8004 on-chain check — an agent is "Trusted" only if its `agentId` is registered in the registry AND `getAgentWallet(agentId)` matches its stored wallet address.

**Architecture:** The Next.js agents page is async SSR. During render, we create a viem `PublicClient` and call `lookupIdentity` (already in `@workspace/shared/identity`) for each agent in parallel. The result gates the status: if not on-chain verified, status = `"Unregistered"`; otherwise existing mandate/policy logic applies.

**Tech Stack:** viem v2 (already in `@workspace/shared`; needs adding to `apps/web`), Next.js 16 SSR, Base Sepolia public RPC (`https://sepolia.base.org`).

---

### Task 1: Add viem to web app and implement `getOnChainTrusted`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/agents-data.ts`

**Step 1: Add viem to web app dependencies**

In `apps/web/package.json`, add to `"dependencies"`:
```json
"viem": "^2"
```

**Step 2: Install**

Run from repo root:
```bash
pnpm install
```
Expected: resolves without errors (viem is already in the monorepo via `@workspace/shared`).

**Step 3: Update `apps/web/lib/agents-data.ts`**

Replace the entire file with:
```ts
import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { createDb, schema } from "@workspace/db"
import { lookupIdentity } from "@workspace/shared/identity"
import { ERC8004_REGISTRY_ADDRESS } from "@workspace/shared/chains"

export interface AgentWithMandate {
  address: string
  name: string
  agentId: bigint
  maxAmountUsdc: bigint | null
  delegatorAddress: string | null
  expiry: bigint | null
  onChainTrusted: boolean
}

let _db: ReturnType<typeof createDb> | undefined
function getDb() {
  if (!_db) _db = createDb()
  return _db
}

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  })
}

async function getOnChainTrusted(agentId: bigint, address: string): Promise<boolean> {
  const client = getPublicClient()
  const profile = await lookupIdentity(agentId, ERC8004_REGISTRY_ADDRESS, client)
  if (!profile) return false
  return profile.wallet.toLowerCase() === address.toLowerCase()
}

export async function getAgentsWithMandates(): Promise<AgentWithMandate[]> {
  const rows = await getDb()
    .select({
      address: schema.agents.address,
      name: schema.agents.name,
      agentId: schema.agents.agentId,
    })
    .from(schema.agents)

  const withTrust = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      maxAmountUsdc: null,
      delegatorAddress: null,
      expiry: null,
      onChainTrusted: await getOnChainTrusted(r.agentId, r.address),
    }))
  )

  return withTrust
}
```

Note: `ERC8004_REGISTRY_ADDRESS` is exported from `@workspace/shared/chains` (it's `"0x8004A818BFB912233c491871b3d84c89A494BD9e"`). Verify with:
```bash
grep -n "ERC8004_REGISTRY_ADDRESS" packages/shared/src/chains.ts
```

**Step 4: Verify typecheck passes**

```bash
cd apps/web && pnpm typecheck
```
Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/lib/agents-data.ts pnpm-lock.yaml
git commit -m "feat: add on-chain ERC-8004 trust check to agents-data"
```

---

### Task 2: Use `onChainTrusted` in the agents page status logic

**Files:**
- Modify: `apps/web/app/agents/page.tsx`

**Step 1: Update `toAgentsTableRow`**

Replace the `toAgentsTableRow` function (lines 6–38) with:
```ts
function toAgentsTableRow(
  agent: Awaited<ReturnType<typeof getAgentsWithMandates>>[number]
): AgentsTableRow {
  const maxAmountUsdc = agent.maxAmountUsdc !== null ? Number(agent.maxAmountUsdc) : null
  const expirySeconds = agent.expiry !== null ? Number(agent.expiry) : 0
  const expired = expirySeconds > 0 && expirySeconds * 1000 < Date.now()

  let status: AgentsTableRow["status"] = "Trusted"
  if (!agent.onChainTrusted) {
    status = "Unregistered"
  } else if (maxAmountUsdc === null) {
    status = "Trusted"
  } else if (expired) {
    status = "Expired mandate"
  } else if (maxAmountUsdc < POLICY_MAX_AMOUNT_USDC) {
    status = "Mandate capped"
  } else if (maxAmountUsdc > POLICY_MAX_AMOUNT_USDC) {
    status = "Policy blocked"
  }

  return {
    address: agent.address,
    name: agent.name,
    agentId: agent.agentId.toString(),
    erc8004: `0x${agent.agentId.toString(16)}`,
    delegatorAddress: agent.delegatorAddress ?? "—",
    maxAmountUsdc: maxAmountUsdc !== null ? maxAmountUsdc.toFixed(2) : "—",
    expiry:
      expirySeconds > 0
        ? new Date(expirySeconds * 1000).toISOString().slice(0, 10)
        : "—",
    status,
    registered: agent.onChainTrusted,
  }
}
```

**Step 2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: error on `"Unregistered"` — not yet in the type union. Proceed to Task 3.

---

### Task 3: Add `"Unregistered"` status to the agents table component

**Files:**
- Modify: `apps/web/components/agents-table.tsx`

**Step 1: Extend the status union (line 30)**

Change:
```ts
status: "Trusted" | "Mandate capped" | "Policy blocked" | "Expired mandate"
```
To:
```ts
status: "Trusted" | "Mandate capped" | "Policy blocked" | "Expired mandate" | "Unregistered"
```

**Step 2: Add badge style (lines 37–42)**

Add `"Unregistered"` entry to `statusStyles`:
```ts
const statusStyles: Record<AgentsTableRow["status"], string> = {
  Trusted: "bg-positive-surface text-positive",
  "Mandate capped": "bg-warning-surface text-warning",
  "Policy blocked": "bg-negative-surface text-negative",
  "Expired mandate": "bg-warning-surface text-warning",
  Unregistered: "bg-muted text-muted-foreground",
}
```

**Step 3: Show warning icon for "Unregistered" (lines 92–109)**

Update the `warning` condition in `AgentIcon`:
```ts
const warning =
  agent.status === "Policy blocked" ||
  agent.status === "Expired mandate" ||
  agent.status === "Unregistered"
```

**Step 4: Verify typecheck passes**

```bash
cd apps/web && pnpm typecheck
```
Expected: no errors.

**Step 5: Build to confirm no runtime issues**

```bash
cd apps/web && pnpm build
```
Expected: build succeeds.

**Step 6: Commit**

```bash
git add apps/web/components/agents-table.tsx apps/web/app/agents/page.tsx
git commit -m "feat: derive agent trust status from ERC-8004 on-chain registry"
```
