# Console UI Plan — issues #6, #7, #8, #9

## Overview

4 phases. Main page IS the showcase (#9). Trigger button (#7) is just the "Run Demo" button on main. Feed (#6) and Policy (#8) are secondary nav pages.

---

## Phase 1 — Foundation

### 1a. env + data libs

**apps/web/env.ts** — add:
```ts
ATTESTATION_REGISTRY_ADDRESS: z.string().startsWith("0x"),
```
**apps/web/.env.local** — add:
```
ATTESTATION_REGISTRY_ADDRESS=0xe81ea4bd57eb034047c8f0fb016d74485239d76d
```

**apps/web/lib/attestations.ts** — new
- `getAttestations()` — viem `createPublicClient` + `getLogs` on `ATTESTATION_REGISTRY_ABI` Attested event
- Returns typed rows: `{ paymentHash, payer, amountUsdc, identityStatus, decision, timestamp, txHash }`
- Server-only (no `"use client"`)

**apps/web/lib/agents-data.ts** — new
- `getAgentsWithMandates()` — Drizzle join of agents + mandates tables
- Returns `{ address, name, agentId, maxAmountUsdc, delegatorAddress, expiry }[]`
- Server-only

### 1b. Layout + nav

**apps/web/app/layout.tsx** — add top nav:
- Links: **Demo** (`/`) | **Feed** (`/feed`) | **Policy** (`/policy`)
- Keep existing theme provider

---

## Phase 2 — Showcase page (app/page.tsx) — #7 + #9

**Client component.** Local state drives the trace.

### Preview card (before run)
- Shows next scenario: agent label, route, expected outcome, mandate limit
- Agent explanation: `"I am metal-agent-1, registered in ERC-8004. I have a mandate from 0xAbc… authorizing up to $1. This request costs $0.01."`
- Data comes from `getAgentsWithMandates()` (server-fetched, passed as prop)
- Cycle index stored in `useState`, increments after each run

### Run Demo button
- `POST /api/trigger-payment`
- While in-flight: animate trace steps 1–4 at ~800ms intervals
- On resolve: populate all steps with real data, mark failure step if rejected

### TracePanel component (`components/trace-panel.tsx`)

5 steps — each has: icon, label, status (`pending | running | approved | rejected | skipped`), detail line

| # | Step | Data shown |
|---|------|-----------|
| 1 | 402 Challenge | resource URL, price |
| 2 | ERC-8004 Identity | wallet address (truncated), registered/not-registered status |
| 3 | AP2 Mandate | delegator, limit, expiry |
| 4 | Policy Check | threshold ($2), payment amount |
| 5 | Settlement + Attestation | settlement txHash + attestation txHash (Basescan links) |

**Rejection mapping** (from `httpStatus` + `body.error`):
- `identity_not_found` → step 2 rejected, steps 3–5 skipped
- `mandate_amount_exceeded` → step 3 rejected, steps 4–5 skipped
- `policy_amount_exceeded` → step 4 rejected, step 5 skipped
- `200` → all steps approved

### Proof bundle
- Shown after completion
- Copy button → clipboard
```json
{
  "agentId": "...",
  "payer": "0x...",
  "mandateDelegator": "0x...",
  "mandateLimit": "$1",
  "policyThreshold": "$2",
  "policyDecision": "approved",
  "paymentTxHash": "0x...",
  "attestationTxHash": "0x..."
}
```

---

## Phase 3 — Feed page (app/feed/page.tsx) — #6

**Server component** (data fetched at request time).

- Calls `getAttestations()` — real rows from on-chain
- Below real rows: 4 hardcoded illustrative rows with inline `Illustrative` badge
- Table columns: timestamp, payer (truncated), amount, identity pill, decision pill, settlement tx ↗, attestation tx ↗
- Real rows: teal left-border glyph
- Client wrapper (`components/feed-table.tsx`) handles row click → Sheet

**DetailSheet (`components/detail-sheet.tsx`)**
- Same 5-step stepper as TracePanel but read-only, populated from row data
- AP2 mandate chain section with disclaimer: *"AP2 mandate verified off-chain. In production Metal, mandates are enforced as a native authorization primitive."*
- Both Basescan links

**Filter** — client-side, filter by decision (all / approved / rejected)

---

## Phase 4 — Policy page (app/policy/page.tsx) — #8

**Server component.**

- **Rule card**: `POLICY_MAX_AMOUNT_USDC = $2` — labeled *"Enforced server-side in facilitator onBeforeSettle. Not decorative."*
- **Agent mandates table**: from `getAgentsWithMandates()` — name, address, limit, delegator
- **Blocked tx count**: filter `getAttestations()` where `decision === Rejected`

---

## Shadcn components needed

Check `components.json` before installing. Likely needed:
`button`, `card`, `badge`, `sheet`, `table`, `separator`, `tooltip`

Install missing ones with: `bunx shadcn@latest add <component>`

---

## Risks / decisions

1. **No real attestations yet** — feed will show 0 real rows until first trigger runs. Illustrative rows carry the visual until then. Acceptable.
2. **Trace step timing** — 800ms per step during in-flight feels right but may need tuning. Step 5 (settlement) takes longest on-chain (~5–15s). UI should not time out.
3. **ATTESTATION_REGISTRY_ADDRESS in web env** — currently only in facilitator env. Must add to web .env.local and Vercel env.
4. **`/api/trigger-payment` response shape** — currently returns `{ slot, agent, route, httpStatus, txHash, settlementTx, body }`. The trace needs `agent.agentId` for step 2. Enrich the response with agentId from DB.
5. **Cycle state** — preview card needs to know *next* slot (A/B/C/D). Add `GET /api/trigger-payment/next` that returns the next slot without firing, OR just track cycle in client state starting at A.
