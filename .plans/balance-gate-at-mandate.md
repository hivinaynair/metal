# Balance check at mandate gate (not settlement)

## Problem

`invalid_exact_evm_insufficient_balance` currently fails at gate 5 (SETTLEMENT), meaning the facilitator submits the tx, it reverts on-chain, and then the error surfaces. The right gate is AP2/MANDATE_CHECK (gate 3): if the agent wallet has no USDC, the mandate is unfulfillable — catch it before touching the chain.

## Approach

Add a USDC balance pre-check in `onBeforeSettle` using the already-available `publicClient` and the already-exported `ERC20_BALANCE_ABI` + `BASE_SEPOLIA_USDC_ADDRESS` from `@workspace/shared/abis`. Abort with reason `mandate_insufficient_balance` if balance < payment amount.

Because the reason starts with `mandate_`, `isMandateFailure()` already matches it → `settlementFailureGate` already returns gate 3. No changes needed in `settlement-errors.ts`.

---

## Steps

### Step 1 — Add balance check in `onBeforeSettle`

**File:** `apps/facilitator/src/hooks/settle.ts`

After `validateMandateForPayment` returns `ok: true`, call `publicClient.readContract` with `ERC20_BALANCE_ABI` / `BASE_SEPOLIA_USDC_ADDRESS` to get `balanceOf(payer)`. If `balance < paymentAmountAtomic`, call `recordRejection` (matching the pattern of policy rejection above it) and return `{ abort: true, reason: "mandate_insufficient_balance" }`.

**What could go wrong:** RPC call fails (network hiccup). Should we abort or pass through? Safest is to abort conservatively (fail closed), but that risks false rejections. For now: let the RPC error propagate — x402 will surface a 500, which is better than a reverted tx.

### Step 2 — Add `mandate_insufficient_balance` to `MANDATE_FAILURES` set

**File:** `packages/shared/src/settlement-errors.ts`

The `startsWith("mandate_")` fallback already handles it, but adding it explicitly to the set makes intent clear and keeps the set as the canonical list.

**Risk:** None — purely additive.

### Step 3 — Update `onBeforeSettle` tests

**File:** `apps/facilitator/src/hooks/settle.ts` test: `apps/facilitator/src/hooks/settle.test.ts`

Add a `mockReadContract` mock on `publicClient`. Add two new test cases:
- `aborts with mandate_insufficient_balance when balance < payment amount`
- `does not abort when balance >= payment amount` (happy path still passes)

Also update the existing happy-path test to set a sufficient mock balance on `publicClient.readContract`.

**Risk:** The existing mock for `../lib/clients.js` only exposes `walletClient` and `publicClient.waitForTransactionReceipt`. Need to add `publicClient.readContract` to the mock.

### Step 4 — Update `gate-steps.test.ts`

**File:** `apps/agent/src/gate-steps.test.ts`

Add a case to the "stops at AP2 gate for mandate failures" block:
```
expect(gateStepsForResult("mandate_insufficient_balance", undefined)).toEqual([2, 3])
```

And remove `invalid_exact_evm_insufficient_balance` from the "stops at settlement gate" block (it should no longer reach settlement).

---

## Files touched

| File | Change |
|---|---|
| `apps/facilitator/src/hooks/settle.ts` | Add balance `readContract` call + abort in `onBeforeSettle` |
| `apps/facilitator/src/hooks/settle.test.ts` | Mock `readContract`, add 2 new test cases, update happy path |
| `packages/shared/src/settlement-errors.ts` | Add `mandate_insufficient_balance` to `MANDATE_FAILURES` set |
| `apps/agent/src/gate-steps.test.ts` | Update test expectations |

---

## Unresolved questions

- Should a `readContract` RPC failure fail-closed (abort) or fail-open (let the tx try)? Currently proposing fail-open (let error propagate as 500) — confirm?
- Is `BASE_SEPOLIA_USDC_ADDRESS` the right constant, or should the USDC address come from the x402 payment requirements (to support other chains later)?
