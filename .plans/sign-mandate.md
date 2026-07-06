# Plan: demo/mandate.json — signed AP2 mandate (issue #3)

## Context

- EIP-712 types/domain already defined in `packages/shared/src/mandate.ts`
- `MandatePayload` / `SignedMandate` types in `packages/shared/src/types.ts`
- `scripts/lib/env.ts` — `setEnvVar` helper writes to `.env.local`
- `scripts/generate-wallet.ts` — generates private key + sets env var
- Existing scripts use viem + bun, no bundler needed
- `PAYER_PRIVATE_KEY` already in `.env.local` — its address becomes `agent`

---

## Steps

### Step 1 — Generate DELEGATOR_PRIVATE_KEY
**What:** Run `bun scripts/generate-wallet.ts DELEGATOR_PRIVATE_KEY` to generate a new wallet and write it to `.env.local`.
**Touches:** `.env.local`
**Risk:** None. Idempotent — `setEnvVar` will overwrite if re-run.

---

### Step 2 — Create `scripts/sign-mandate.ts`
**What:** Script that reads env, builds the mandate payload, signs it via viem `signTypedData`, and writes `demo/mandate.json`.

Implementation details:
- Import `MANDATE_EIP712_DOMAIN`, `MANDATE_EIP712_TYPES` from `@workspace/shared`
- Read `DELEGATOR_PRIVATE_KEY` + `PAYER_PRIVATE_KEY` from `process.env`
- Derive addresses via `privateKeyToAccount`
- Build `MandatePayload`:
  - `agent` = PAYER address
  - `delegator` = DELEGATOR address
  - `maxAmountUsdc` = 100n
  - `expiry` = 9999999999n
  - `nonce` = 0n
- Sign with delegator account using viem `signTypedData` (local account method, no RPC needed)
- `mkdir -p demo/` then write `demo/mandate.json`
- JSON must serialize bigints as numbers (not strings) to match the spec schema

**Touches:** `scripts/sign-mandate.ts` (new), `demo/mandate.json` (generated)

**Risk:**
- `signTypedData` on a local account (viem `privateKeyToAccount`) is synchronous-compatible — no RPC call needed. ✓
- EIP-712 domain in shared omits `chainId` and `verifyingContract`. That's fine for demo signing; just must be consistent when verifying.
- bigint JSON serialization — need a custom replacer or manual cast to number since `JSON.stringify` throws on bigint.

---

### Step 3 — Create `demo/` dir and commit `demo/mandate.json`
**What:** Ensure `demo/` exists, run the script, then commit the output.
**Touches:** `demo/mandate.json` (committed)
**Risk:** Committing a signed mandate with a hardcoded private key is intentional for demo purposes — the key is in `.env.local` which is gitignored.

---

## Acceptance checklist
- [ ] `bun scripts/sign-mandate.ts` runs without error
- [ ] `demo/mandate.json` exists and has correct shape
- [ ] `DELEGATOR_PRIVATE_KEY` in `.env.local`
- [ ] `mandate.payload.agent` == `privateKeyToAccount(PAYER_PRIVATE_KEY).address`
- [ ] `mandate.payload.expiry` == 9999999999
- [ ] `demo/mandate.json` committed to repo

---

## Unresolved questions
- Should `demo/mandate.json` serialize `maxAmountUsdc`, `expiry`, `nonce` as JSON numbers or strings? Issue shows them as numbers (`100`, `9999999999`) but they're `uint256` on-chain. Numbers fine for demo since they're small.
- Does the EIP-712 domain need `chainId: 84532` (baseSepolia) for future on-chain verification? Currently `MANDATE_EIP712_DOMAIN` omits it — add it in the script, or leave as-is?
