# Demo Polish — Gate Animation, Timeout & Keepalive

## Goal
Three targeted fixes to prevent the demo from looking broken or silently hanging during a live run with Loong.

---

## Step 1 — Emit gate events from agent server after tool result

**File:** `apps/agent/src/server.ts`

**What:** After the `streamText` loop ends (line ~126), parse `responseError` and `settlementTxHash` to emit the correct gate step events before calling `getDecisionRecord`. For the success path, emit gate 6 (attestation) after polling resolves.

**Current behavior:** Only `gate: 0` and `gate: 1` are emitted. Gates 2–6 only light up after `done` arrives — so the pipeline is frozen at the 402 gate for 30–45s.

**New behavior:**
- `identity_not_found` → emit `gate: 2` (stops at ERC-8004)
- mandate failures → emit `gate: 2`, `gate: 3` (stops at AP2)
- `policy_amount_exceeded` → emit `gate: 2`, `gate: 3`, `gate: 4` (stops at Policy)
- success → emit `gate: 2`, `gate: 3`, `gate: 4`, `gate: 5`, then after polling `gate: 6`

**What could go wrong:**
- The gate step numbers must match `settlement-status.ts` mapping exactly. Cross-check:
  - Step 2 = identity (`settlementFailureStep("identity_not_found") === 2`) ✓
  - Step 3 = AP2 mandate (`MANDATE_FAILURES` → `2` in `resultFailureStep`... wait, `settlementFailureStep` returns 3 for mandate failures) ✓
  - Step 4 = policy ✓
  - Step 5 = settlement (success only)
  - Step 6 = attestation (success only)
- Small delay (~100ms) between gate events gives the animation room to play each transition visually. Without it, all gates fire in the same tick and may appear to animate simultaneously.

**Changes:** `apps/agent/src/server.ts` only.

---


## Sequence

```
Step 1 (gate events) → Step 2 (done)
```

---

## Out of scope
- On-chain attestation (dropped — Postgres decision record is the proof artifact)
- Run guard / concurrent run protection
- Error gate disambiguation for infra failures

---

## Unresolved questions
- Is the web app on Vercel Pro? (needed for `maxDuration = 60`)
- Is the agent server also behind a Vercel timeout? (check `apps/agent/vercel.json` or deployment config)
