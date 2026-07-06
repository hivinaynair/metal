# Plan: apps/facilitator — Custom x402 Facilitator with Metal Primitives

**Goal:** Build the Hono API server that replaces `x402.org/facilitator`. Unlike the hosted one, this runs Metal's full compliance stack on every payment: identity gate → mandate verify → policy check → settlement → on-chain attestation → Postgres mirror.

Without this, the x402 route and agent demo are just a payment demo. With it, they're a compliance primitive demo.

---

## How the x402 Facilitator Protocol Works

The resource server (`withX402` in the Next.js route) calls two facilitator endpoints:

```
POST /verify  — did the payer authorize a valid payment? (no funds move)
POST /settle  — execute the payment on-chain and record the audit trail
```

Both receive `{ x402Version, paymentPayload, paymentRequirements }`. The `ExactEvmScheme` from `@x402/evm/exact/facilitator` handles the cryptographic layer (EIP-3009 / Permit2 signature verification + USDC transfer). It takes a `FacilitatorEvmSigner` (wrapping the `FACILITATOR_PRIVATE_KEY` wallet) at **construction time**. Metal's logic wraps on top.

---

## How the AP2 Mandate Flows

**Finding:** `HTTPFacilitatorClient` in `@x402/core` sends ONLY `{ x402Version, paymentPayload, paymentRequirements }` to the facilitator. It does NOT forward any custom headers from the original request. `X-AP2-Mandate` as a passthrough header is not possible.

**Solution — mandate registry on the facilitator:**

Agents register their mandate with the facilitator once via a dedicated endpoint:

```
POST /mandates   { mandate: SignedMandate }
→ stored in-memory (or Postgres), keyed by mandate.payload.agent address
```

On `/verify`, the facilitator looks up the payer's mandate from this store. For the demo, the setup script POSTs `demo/mandate.json` to the facilitator after it starts. For the AgentKit agent, it POSTs `demo/agentkit-mandate.json`.

This also models what a real system would do — mandates are pre-registered, not sent per-request.

---

## Step-by-Step

### Step 1 — App scaffold

**What:** Create `apps/facilitator/` as a new Hono app in the monorepo.

**Touches:**
- `apps/facilitator/package.json`
- `apps/facilitator/tsconfig.json`
- `apps/facilitator/src/index.ts` (Hono entry point)
- `apps/facilitator/.env.example`
- `turbo.json` — add facilitator to workspace pipeline
- Root `package.json` — workspace reference

**Dependencies:**
```
hono                              # HTTP framework
@hono/node-server                 # local dev adapter
@x402/core                        # FacilitatorClient types + base facilitator
@x402/evm                         # ExactEvmScheme facilitator implementation
@workspace/shared                  # lookupIdentity, mandate types, ABIs
viem                               # chain interaction
```

**New env vars:**
```
FACILITATOR_PRIVATE_KEY=           # gas wallet (already exists in root .env.local)
IDENTITY_REGISTRY_ADDRESS=         # already set (0x8004... ERC-8004)
ATTESTATION_REGISTRY_ADDRESS=      # written after deploy-contracts.ts
POLICY_MAX_AMOUNT_USDC=            # e.g. 10
```

**Risks:** None. Pure new app.

---

### Step 2 — Baseline x402 endpoints (no Metal logic yet)

**What:** Implement the three required endpoints delegating straight to `ExactEvmScheme` from `@x402/evm/exact/facilitator`. At this point the facilitator works as a drop-in replacement for `x402.org/facilitator` but with no added compliance logic.

**Touches:** `apps/facilitator/src/routes/x402.ts`

```
GET  /supported  →  ExactEvmScheme.getSigners() + getExtra()
POST /verify     →  ExactEvmScheme.verify(payload, requirements)
POST /settle     →  ExactEvmScheme.settle(payload, requirements)
```

The `ExactEvmScheme` on the facilitator side needs a wallet client (using `FACILITATOR_PRIVATE_KEY`) to submit USDC transfer transactions on Base Sepolia.

**What to verify:** Swap `apps/web/app/api/settlement-risk-report/route.ts` to point at `http://localhost:3001` (facilitator dev URL) and run `bun scripts/pay-and-fetch.ts`. Payment should succeed end-to-end.

**Risks:**
- `@x402/evm/exact/facilitator` may require `FacilitatorContext` with a signer or viem wallet client injected at construction time — check constructor signature before building.
- Facilitator gas wallet needs Base Sepolia ETH for gas fees on each settlement tx.

---

### Step 3 — Mandate registry endpoint + Metal verify layer

**What:** Add `POST /mandates` for agents to pre-register their mandate. Then intercept `/verify` to run ERC-8004 identity lookup + AP2 mandate check.

**Touches:** `apps/facilitator/src/routes/mandates.ts`, `apps/facilitator/src/lib/metal-verify.ts`, updated `/verify` route handler

**Mandate store (in-memory for demo):**
```ts
// mandate-store.ts
const mandates = new Map<string, SignedMandate>() // keyed by agent address (lowercase)
export function registerMandate(m: SignedMandate) { mandates.set(m.payload.agent.toLowerCase(), m) }
export function getMandate(agent: string) { return mandates.get(agent.toLowerCase()) }
```

**POST /mandates logic:**
```
1. Parse body as SignedMandate
2. verifyTypedData to confirm signature is valid before storing
3. mandates.set(mandate.payload.agent, mandate)
4. Return 200
```

**POST /mandates body:**
```ts
{ mandate: SignedMandate, agentId: bigint }
```
The agent provides their `agentId` (from ERC-8004 registration) alongside the mandate. This solves the address → agentId reverse-lookup problem: ERC-8004 only exposes `getAgentWallet(agentId)`, not the reverse. Storing agentId at mandate registration time avoids chain log scanning.

Mandate store shape:
```ts
Map<string, { mandate: SignedMandate; agentId: bigint }>  // keyed by payer address
```

**POST /verify logic:**
```
1. Call ExactEvmScheme.verify() → get { isValid, payer }
2. If !isValid → return early with invalidReason
3. getMandate(payer)
   → if null: return { isValid: false, invalidReason: "mandate_not_registered" }
4. lookupIdentity(agentId, ERC8004_ADDRESS, publicClient) [from @workspace/shared]
   → calls getAgentWallet(agentId) — confirms agentId maps to payer address
   → if null or address mismatch: return { isValid: false, invalidReason: "identity_not_found" }
5. if mandate.payload.expiry < Date.now()/1000 → "mandate_expired"
6. if mandate.payload.maxAmountUsdc < paymentAmount → "mandate_amount_exceeded"
7. Return { isValid: true, payer, extra: { identityStatus: "Verified", mandateDelegator: ... } }
```

**Setup script update:** Add `scripts/register-mandate.ts` — reads `demo/mandate.json` + `AGENT_ID` from `.env.local`, POSTs to `FACILITATOR_URL/mandates`.

**Risks:**
- In-memory mandate store resets on restart. Fine for demo. Postgres can back it later.
- `verifyTypedData` from viem — the EIP-712 domain has no `chainId` or `verifyingContract` (intentional per `packages/shared/src/mandate.ts`). Confirm viem handles partial domains correctly.

---

### Step 4 — Metal settle layer

**What:** Intercept `/settle` to enforce policy, then after successful x402 settlement, write the on-chain attestation and Postgres record.

**Touches:** `apps/facilitator/src/lib/metal-settle.ts`, updated `/settle` route handler

**Logic:**

```
1. Re-run identity + mandate checks (same as verify — settle must be self-contained)
2. Policy check: paymentAmount > POLICY_MAX_AMOUNT_USDC → reject
   → return { success: false, errorReason: "policy_amount_exceeded" }
3. Call ExactEvmScheme.settle() → get { success, transaction: paymentTxHash }
4. If !success → write REJECTED attestation, return error
5. Call AttestationRegistry.attest(
     paymentHash,   // keccak256 of paymentTxHash
     payer,
     amountUsdc,
     identityStatus,  // IdentityStatus enum
     Decision.Approved
   ) → get attestationTxHash
6. Insert row into settlement_attestations (Drizzle)
7. Return { success: true, transaction: paymentTxHash, network: "eip155:84532" }
```

**Risks:**
- `AttestationRegistry.attest()` uses `FACILITATOR_PRIVATE_KEY` wallet (same gas wallet as x402 settlement). Two sequential on-chain txs per payment — ensure the nonce is managed correctly (viem handles this, but worth noting).
- The `paymentHash` arg to `attest()` needs to be a `bytes32`. Use `keccak256(toBytes(paymentTxHash))` from viem.

---

### Step 5 — (deferred) Postgres attestation cache

**What:** A read cache for the compliance console UI — fast queries of attestation history without scanning chain events.

**Deferred until:** `apps/web` compliance console is being built. The on-chain `AttestationRegistry.attest()` events are the source of truth and sufficient for the demo. Add Postgres (Drizzle + Neon) here when the console needs it.

---

### Step 6 — Add mandate registration to the demo setup

**What:** The existing test script and future AgentKit agent need to register their mandate with the facilitator before payment. `HTTPFacilitatorClient` does not forward arbitrary request headers to `/verify` or `/settle`, so `X-AP2-Mandate` is intentionally not part of the x402 request path.

**Touches:** `scripts/register-mandate.ts`, local demo setup docs

**Change:** Load `demo/mandate.json` and `AGENT_ID`, then POST them to `${FACILITATOR_URL}/mandates`.

```ts
const mandate = JSON.parse(readFileSync("demo/mandate.json", "utf8"));
await fetch(`${process.env.FACILITATOR_URL}/mandates`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mandate, agentId: process.env.AGENT_ID }),
});
```

**Risk:** In-memory facilitator mandate state resets on restart. Fine for local demo; use Postgres when persistence matters.

---

### Step 7 — Update apps/web to point at custom facilitator

**What:** Swap `x402.org/facilitator` in the Next.js route for the deployed (or local) custom facilitator URL.

**Touches:** `apps/web/app/api/settlement-risk-report/route.ts` — change the `url` in `HTTPFacilitatorClient`.

```ts
const facilitator = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
```

Add `FACILITATOR_URL` to `apps/web/env.ts` and `.env.local`.

**Risks:** None. One-line change.

---

### Step 8 — Deploy to Vercel

**What:** Deploy `apps/facilitator` as a Vercel serverless function.

**Touches:**
- `apps/facilitator/vercel.json` — route all traffic to Hono handler
- Root `vercel.json` (if monorepo root deployment is used)

**Vercel config:**
```json
{
  "builds": [{ "src": "src/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.ts" }]
}
```

Set env vars in Vercel dashboard. Update `FACILITATOR_URL` in `apps/web` to the Vercel deployment URL.

**Risks:** Hono with `@hono/node-server` works fine on Vercel. Alternatively use `@hono/vercel` adapter if the standard one has issues.

---

## Full Request Flow After This Ships

```
Agent (Claude + AgentKit)
  → one-time POST apps/facilitator/mandates (SignedMandate + ERC-8004 agentId)
  → GET /api/settlement-risk-report (x402 payment flow)
  → withX402 middleware sees 402 requirement
  → ExactEvmScheme client creates payment authorization (EIP-3009)
  → POST apps/facilitator/verify
      ✓ ExactEvmScheme.verify() — signature valid
      ✓ lookupIdentity(agentId) — live ERC-8004 wallet matches payer
      ✓ verifyTypedData() — registered mandate signature valid, amount/expiry OK
  → POST apps/facilitator/settle
      ✓ Policy check — amount ≤ POLICY_MAX_AMOUNT_USDC
      → ExactEvmScheme.settle() — USDC transferred on-chain (paymentTxHash)
      → AttestationRegistry.attest() — tamper-evident audit log (attestationTxHash)
      → Postgres insert — fast read for compliance console
  → Agent receives report + payment proof
  → Compliance console shows full trace
```

---

## Build Order vs Agent Plan

Both apps are independent. Recommended sequence:

```
1. apps/facilitator Steps 1–2  (baseline x402, no Metal logic)
2. apps/facilitator Step 6     (update pay-and-fetch.ts to send mandate)
   → end-to-end test with pay-and-fetch.ts → local facilitator
3. apps/facilitator Steps 3–5  (Metal verify, Metal settle, Drizzle)
   → full compliance stack confirmed working
4. apps/agent (all steps)      → AgentKit agent replaces pay-and-fetch.ts
5. apps/facilitator Steps 7–8  (point web at facilitator, deploy)
```

---

## Resolved Questions

1. **Mandate header forwarding** — `HTTPFacilitatorClient` does NOT forward custom headers. Resolved via mandate registry (`POST /mandates`) endpoint.
2. **ExactEvmScheme constructor** — Takes `FacilitatorEvmSigner` at construction time. Wire `FACILITATOR_PRIVATE_KEY` at app startup.
3. **Postgres** — Deferred. On-chain attestation events are sufficient for demo; add Postgres when console UI needs fast reads.
4. **Mandate lookup** — Stateless per-request lookup from in-memory store keyed by agent address.

## Unresolved Questions

1. **Rejected payment attestation** — Attest rejections on-chain (complete audit trail, costs gas) or approved-only?
2. **`FacilitatorEvmSigner` type** — Need to confirm exactly what this wraps (viem `WalletClient`? account + publicClient pair?) before Step 2.
