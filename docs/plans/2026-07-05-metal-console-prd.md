# PRD — Metal Compliance Console

## Context

This is a job application demo for Loong Wang, founder of Metal. Metal (founded June 2026) is building settlement infrastructure for agent-driven payments with compliance primitives baked into the chain — identity, authorization, policy, and attestation — rather than bolted on top.

This demo shows what Metal's primitive stack looks like, implemented on Base Sepolia as a proxy for Metal's native chain. The goal: demonstrate that the applicant understood the architecture from the blog post and could build it.

## Problem Statement

When an AI agent makes a payment, institutions need to know three things before the money moves: *who is this agent* (identity), *is it authorized to spend this* (mandate), and *what happened* (audit trail). Traditional payment rails don't answer these questions at the settlement layer — they're enforced after the fact, if at all.

Metal's thesis is that identity, authorization, policy, and attestation should be enforced at settlement — not in a separate compliance dashboard on top. This demo builds that primitive stack and makes it visible through a compliance console.

---

## Solution

Build and deploy five artifacts in the same Turborepo:

1. **Smart Contracts** (Base Sepolia) — two contracts deployed to Base Sepolia: `IdentityRegistry` (implements ERC-8004 — agent identity as an on-chain registry) and `AttestationRegistry` (tamper-evident settlement audit trail). These stand in for Metal's native chain primitives.

2. **`packages/shared`** — shared TypeScript package (`@workspace/shared`) containing the ERC-8004 `lookupIdentity()` utility (viem `readContract` against our deployed registry) and AP2 mandate types. Imported by both `apps/facilitator` and `apps/web`.

3. **Custom Facilitator** (`apps/facilitator`) — standalone Hono app (API only) implementing the x402 facilitator protocol with Metal's primitive stack wired in: ERC-8004 identity-gating, AP2 mandate verification (EIP-712), amount-threshold policy enforcement, and on-chain attestation write on every settlement. Deployed separately to Vercel.

4. **Compliance Console** (`apps/web`) — Next.js app with an x402-gated route backed by the custom facilitator, a live-trigger button, and a compliance feed showing real attestation data from the on-chain registry. Deployed to Vercel.

5. **`demo/mandate.json`** — pre-signed AP2 mandate (generated once by `scripts/sign-mandate.ts`) committing the demo institution wallet's authorization for the demo agent wallet. Checked into the repo so the demo is reproducible without re-signing.

---

## User Stories

### Activity Feed (Tier 1)
1. As a compliance officer, I want to see a dense transaction table with timestamp, agent identity, amount/asset, resource accessed, tx hash, AP2 mandate status, and ERC-8004 identity status, so I can scan recent activity at a glance.
2. As a compliance officer, I want to filter the feed by risk flag, jurisdiction tag, and amount range, so I can isolate entries needing review.
3. As a compliance officer, I want one pinned real transaction — marked distinctly — so I can verify the system reflects live on-chain activity.
4. As a compliance officer, I want to identify placeholder/illustrative rows by a clear label (not just a tooltip), so I understand what is real versus demo data.

### Transaction Detail (Tier 1)
5. As a compliance officer, I want to click any row and open a side sheet showing the full payment lifecycle (402 challenge → signed authorization → facilitator verify → settlement), so I can trace exactly how a payment was processed.
6. As a compliance officer, I want the real tx hash to be a clickable link to the Base Sepolia block explorer, so I can independently verify settlement.
7. As a compliance officer, I want the AP2 mandate chain shown as an expandable labeled trail, so I can audit which delegation authorized the payment.
8. As a compliance officer, I want the ERC-8004 identity result shown with the Sybil-risk caveat stated in plain language (not a tooltip), so I understand the confidence level without hunting for fine print.
9. As a compliance officer, I want to see the attestation log entry (timestamp, payer, amount, identity status, facilitator decision) for each settled transaction, so I have a tamper-evident audit record.

### Overview Dashboard (Tier 2)
10. As a compliance officer, I want KPI tiles showing flagged transactions awaiting review, percentage of verified vs. placeholder identities, and policy violations caught, so I can assess overall portfolio risk without drilling into individual rows.

### Policy Console (Tier 2)
11. As a compliance officer, I want to see an amount-threshold rule that is actually enforced server-side by the facilitator, so I can trust the policy layer is not just decorative.
12. As a compliance officer, I want a jurisdiction-based rule builder that is interactive in the UI — even though enforcement is against illustrative persona data — with a clear label stating the limitation and why (no reliable way to derive jurisdiction from a wallet address), so I can evaluate what real jurisdiction enforcement would look like.

### Live-Trigger (Tier 2)
13. As a compliance officer or demo viewer, I want a "Trigger Payment" button in the console that fires the real x402 payment flow live and updates the feed in real time, so I can see the end-to-end system working without switching to a CLI.

### x402 Payment Flow (Technical Demo)
14. As a developer reviewing the demo, I want to see a Next.js API route (`/api/settlement-risk-report`) gated with `withX402`, requiring $0.01 USDC on Base Sepolia from a buyer wallet that is distinct from the seller/payTo wallet, so the transaction is a real two-party settlement.
15. As a developer reviewing the demo, I want the payment flow to use `@x402/next`, `@x402/core`, and `@x402/evm` (v2 namespace only), so the implementation reflects current protocol state.

### Custom Facilitator (Technical Demo)
16. As a developer reviewing the demo, I want a self-built facilitator (`/api/facilitator/verify`, `/settle`, `/supported`) that wraps `@x402/core`/`@x402/evm` primitives without hand-rolling signature verification, so cryptographic correctness is delegated to the official library.
17. As a developer reviewing the demo, I want the `/verify` endpoint to call the ERC-8004 lookup on the payer address and flag or reject unregistered or high-Sybil-risk payers, so identity-gating is demonstrated at the settlement layer.
18. As a developer reviewing the demo, I want `/settle` to write a structured attestation record (timestamp, payer, amount, identity status, facilitator decision) to Postgres via Drizzle, so there is a real audit trail feeding the console's detail view.
19. As a developer reviewing the demo, I want an amount-threshold policy hook in the facilitator that rejects transactions above a configured limit before settlement, so compliance-at-the-settlement-layer is demonstrated.
20. As a developer reviewing the demo, I want the facilitator's gas wallet (a third distinct viem-generated keypair) to pay gas for broadcasting settlements and never hold or move USDC, so the wallet roles are clearly separated.

### ERC-8004 Lookup
21. As a developer reviewing the demo, I want a shared ERC-8004 lookup utility using `viem`'s `readContract` against our deployed Identity Registry on Base Sepolia, so both the facilitator's identity-gating and the console's detail view use the same source of truth.
22. As a compliance officer, I want the ERC-8004 lookup to return "not found" gracefully (not an error) when a payer has no registered identity, so the Sybil-risk point is illustrated clearly rather than crashing the flow.

---

## Implementation Decisions

### Monorepo Structure
- `apps/web` — existing Next.js app; hosts the compliance console UI and the x402-gated `/api/settlement-risk-report` route.
- `apps/facilitator` — new Hono app (API routes only, no UI); implements the x402 facilitator protocol with identity-gating, attestation logging, and policy enforcement. Deployed as a separate Vercel project.
- `packages/ui` — existing component library (Table, Badge, Sheet, Card, Tabs, Alert, Skeleton, Separator, Spinner, Empty); used by `apps/web` only.
- `packages/shared` — new package (`@workspace/shared`); contains the ERC-8004 lookup utility and AP2 mandate types shared between `apps/web` and `apps/facilitator`. Follows the existing workspace package convention.
- `contracts/` — Solidity source for `IdentityRegistry` and `AttestationRegistry`. Deploy scripts live in `scripts/`. No Hardhat/Foundry — compile with `solc` or `viem`'s `deployContract` with pre-compiled bytecode.

### Wallet Management
- Three wallets, all generated via `viem`'s `generatePrivateKey()`: buyer (`PAYER_PRIVATE_KEY` — already exists), seller/payTo (`RECIPIENT_PRIVATE_KEY` / `PAY_TO_ADDRESS` — already exists), facilitator gas wallet (new — add `FACILITATOR_PRIVATE_KEY` to env).
- No MetaMask, CDP Wallets, or thirdweb.
- The two-wallet fix (distinct buyer vs. seller) must be verified first by confirming `PAYER_PRIVATE_KEY` and `RECIPIENT_PRIVATE_KEY` produce different addresses — the env already has separate keys, confirm they resolve to different addresses before any other work.

### x402 Route
- Existing `/api/settlement-risk-report/route.ts` in `apps/web` uses the hosted `x402.org/facilitator` via `HTTPFacilitatorClient` during development. Once `apps/facilitator` is deployed, switch its `HTTPFacilitatorClient` URL to the deployed facilitator URL.
- The stub JSON response never needs real risk logic — only the payment gate matters.

### Custom Facilitator (`apps/facilitator`) — Tier 1
Standalone Hono app with `GET /api/supported`, `POST /api/verify`, `POST /api/settle`. Wraps `@x402/core` and `@x402/evm/exact/facilitator` primitives. Adds identity-gating (ERC-8004), attestation logging (Drizzle/Postgres), and amount-threshold policy hook. Deployed separately to Vercel.

**Build order: contracts (deploy + register) → `packages/shared` (ERC-8004 lookup + AP2 types) → `apps/facilitator` (Hono + Drizzle) → wire `apps/web` to the deployed facilitator URL.**

### ERC-8004 Identity Registry — Tier 1

ERC-8004 ("Trustless Agents") is a real EIP defining identity, reputation, and validation registries for agents. No official deployment exists on Base Sepolia yet — we deploy our own.

**`IdentityRegistry` contract** (deploy to Base Sepolia):
- Implements the ERC-8004 Identity Registry: maps `address → AgentProfile` (name, metadata URI, registered timestamp)
- Two functions: `register(address agent, string name, string metadataUri) external` and `lookup(address agent) external view returns (AgentProfile memory)`
- ~40 lines of Solidity. Deploy with a viem `deployContract` script.
- After deploying, run `scripts/register-agent.ts` to register the demo payer wallet.

**Lookup utility** (`packages/shared`):
- `lookupIdentity(address: Hex): Promise<AgentProfile | null>` — uses viem `readContract`, never throws on "not found"
- Imported by `apps/facilitator` (identity-gating in `/verify`) and `apps/web` (console detail view)

**Console label:** *"ERC-8004 identity verified. Registry deployed to Base Sepolia as a stand-in for Metal's native identity primitive."*

### Attestation Store — Tier 1

**Architecture:** On-chain attestation contract (Base Sepolia) as the source of truth; Postgres (Drizzle) as a read cache for the console UI. This mirrors Metal's actual primitive — attestations are on-chain and tamper-evident, not in an operator's DB.

**`AttestationRegistry` contract** (deploy to Base Sepolia):
- One function: `attest(bytes32 paymentHash, address payer, uint256 amountUsdc, uint8 identityStatus, uint8 decision) external`
- Emits `Attested(paymentHash, payer, amountUsdc, identityStatus, decision, block.timestamp)`
- No access control for the demo; facilitator calls it directly using the gas wallet.
- ~30 lines of Solidity. Deploy with a viem `deployContract` script.

**Postgres table** (`settlement_attestations`): `id`, `created_at`, `payment_tx_hash`, `attestation_tx_hash`, `payer_address`, `amount_usdc`, `identity_status` (enum: `verified | not_found | flagged`), `facilitator_decision` (enum: `approved | rejected`), `mandate_delegator` (text, nullable), `mandate_valid` (boolean), `policy_flags` (jsonb). Managed by Drizzle Kit.

**Write path (facilitator `/settle`):** settle on-chain → call `AttestationRegistry.attest()` → store both tx hashes in Postgres.

**Console:** shows two verifiable links per real transaction — USDC settlement tx and attestation tx — both on Basescan. UI note: *"In production Metal, the attestation is a native on-chain primitive. Here it is a contract on Base Sepolia standing in for that layer."*

### Live-Trigger Route
- `/api/trigger-payment` — server-side POST route, reads `PAYER_PRIVATE_KEY` from env, signs EIP-3009 `transferWithAuthorization`, calls the custom facilitator flow, returns the new attestation record.
- Console calls this route via client-side fetch; on success, invalidates/refetches the activity feed (React Query or SWR, or a simple `router.refresh()`).

### Console Pages and Layout
- `/` — Overview dashboard (KPI tiles). Tier 2, can be cut.
- `/feed` (or `/`) — Activity feed as the primary view. Tier 1.
- `/feed/[id]` detail opens as a Sheet overlay, not a separate route.
- `/policy` — Policy console. Tier 2.


### AP2 Mandate Verification — Tier 1

AP2 mandates are verified cryptographically in the facilitator — not illustrative.

**Mandate schema** (EIP-712 typed data, signed off-chain):
```ts
{
  agent: address,       // payer wallet
  delegator: address,   // institution/treasury that granted the mandate
  maxAmountUsdc: uint256,
  expiry: uint256,      // unix timestamp
  nonce: uint256,
}
```

**Flow:**
1. Institution wallet signs a mandate for the agent wallet using `signTypedData` (viem). This is done once, offline, stored as a JSON file in the demo.
2. The x402 client includes the signed mandate as a custom header (`X-AP2-Mandate`) on every payment request.
3. Facilitator `/verify` extracts the header, calls viem `verifyTypedData`, checks `maxAmountUsdc >= payment amount` and `expiry > now`. Rejects if invalid.
4. Attestation record stores `mandate_delegator` and `mandate_valid: boolean`.

**Console:** mandate chain in the detail sheet shows the real delegator address and expiry — not hardcoded. Labeled *"AP2 mandate verified off-chain. In production Metal, mandates are enforced as a native authorization primitive."*

**Script:** `scripts/sign-mandate.ts` — generates a signed mandate JSON for the demo agent wallet. Run once, commit the output as `demo/mandate.json`.

### Data Honesty
- Real, live-settled rows: pinned, distinctly marked (monospace hash + `ledger` teal glyph).
- Illustrative rows: labeled "Illustrative" in a non-dismissible inline note, not a tooltip.
- Jurisdiction data: always labeled "Illustrative — no reliable on-chain source" inline in the policy console.

---

## Testing Decisions

**What makes a good test:** Tests verify external behavior at the highest meaningful seam, not internal implementation. For API routes, test the HTTP contract (status codes, response shape, side effects on the DB). For UI, test user-visible interactions, not component internals.

**Primary seam — `apps/facilitator` HTTP routes (Hono):**
- `POST /api/verify`: given a valid x402 payment payload, returns approval or rejection based on ERC-8004 identity status. Test with a mocked `ExactEvmScheme.verify()` and a mocked ERC-8004 lookup — cover the verified, not-found, and flagged identity paths.
- `POST /api/settle`: given a payload above/below the policy threshold, returns blocked or proceeds to settle. Test that the DB attestation row is written on success (use a test DB or in-memory Drizzle mock) and skipped on block.
- `GET /api/supported`: snapshot test of the response shape.

**Secondary seam — ERC-8004 lookup utility:**
- Unit test the lookup utility with a mocked `viem` public client — test the `not_found` path and the `verified` path separately.

**Secondary seam — `/api/trigger-payment`:**
- Integration test: mock the x402 payment signing and facilitator call, assert the attestation record is written and a valid response is returned.

**UI — Activity Feed:**
- Render test: feed renders real pinned row with correct visual markers; illustrative rows show "Illustrative" label.
- Interaction test: clicking a row opens the Sheet with the correct transaction data.
- Filter test: filtering by risk flag shows only flagged rows.
