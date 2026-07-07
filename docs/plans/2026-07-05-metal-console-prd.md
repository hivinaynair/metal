# PRD — Metal Compliance Console

## Context

Job application demo for Loong Wang, founder of Metal. Metal (founded June 2026) is building settlement infrastructure for agent-driven payments with compliance primitives baked into the chain.

This demo builds Metal's primitive stack on Base Sepolia — identity, authorization, policy, attestation — and makes it visible through a compliance console with a live Claude agent executing real payments.

## Problem Statement

When an AI agent makes a payment, institutions need three things enforced *before* funds move: who is this agent (identity), is it authorized to spend this (mandate), and what happened (audit trail). Traditional rails bolt this on afterwards. Metal's thesis: these are settlement primitives, not dashboard features.

---

## What's Built

Five deployed artifacts in a Turborepo monorepo:

### 1. On-chain primitives (Base Sepolia)

- **ERC-8004 identity registry** — live registry at `0x8004A818BFB912233c491871b3d84c89A494BD9e`. Agents self-register with `register(agentURI)`, receive an ERC-721 token ID. Identity lookup via `tokenURI(agentId)` + `getAgentWallet(agentId)`.
- **AttestationRegistry** — deployed at `0xe81ea4bd57eb034047c8f0fb016d74485239d76d`. Every settlement writes a tamper-evident `Attested` event on-chain: payer, amount, identity status, decision.

### 2. `packages/shared`

Shared TypeScript package (`@workspace/shared`). Contains:
- `lookupIdentity(agentId, registryAddress, client)` — ERC-8004 lookup, never throws on not-found
- `registerInErc8004(account, appUrl, client)` — self-registration helper
- ERC-8004, AttestationRegistry, ERC-20 ABIs
- AP2 mandate types (`MandatePayload`, `SignedMandate`) + EIP-712 domain/types
- Chain constants (`ERC8004_REGISTRY_ADDRESS`, `BASE_SEPOLIA_EXPLORER`, etc.)
- Drizzle schema (`agents`, `mandates` tables)

### 3. `apps/facilitator` (Hono → Vercel)

Custom x402 facilitator with Metal's full primitive stack. Deployed separately.

**Routes:**
- `GET /supported` — supported payment schemes
- `POST /verify` — runs in order: x402 signature verify → ERC-8004 identity lookup → AP2 mandate signature + expiry + amount check → policy ceiling check. Rejects at first failure with a specific error code.
- `POST /settle` — settles USDC via x402, then calls `AttestationRegistry.attest()` on-chain.
- `POST /mandates` — registers a signed AP2 mandate for an agent (stored in Neon Postgres).

**Error codes:** `identity_not_found`, `mandate_not_registered`, `mandate_signature_invalid`, `mandate_expired`, `mandate_amount_exceeded`, `policy_amount_exceeded`.

**Policy:** `POLICY_MAX_AMOUNT_USDC` env var, enforced in `onBeforeSettle` hook before funds move.

### 4. `apps/web` (Next.js → Vercel)

Compliance console. Three pages:

**`/` — Demo landing page**
- Framing copy: what Metal's primitive stack is
- 4 scenario buttons (A–D), each maps to a named CDP agent account
- On "Run": calls `POST /api/trigger-payment` → delegates to `apps/agent` → streams Claude's reasoning into a terminal panel → trace animates through 6 gates → result + proof bundle
- Animated settlement rail showing each gate (402 → ERC-8004 → AP2 Mandate → Policy → Settlement → Attestation)
- Proof bundle: copyable JSON with payer, agentId, delegator, mandate validity, policy decision, settlementTxHash, attestationTxHash

**`/feed` — Activity feed**
- Real `Attested` events from AttestationRegistry via `getLogs`
- Table: time, agent, payer, amount, identity status, decision, tx hash
- Row click opens detail sheet with full trace

**`/policy` — Policy console**
- Active amount-threshold rule card (matches `POLICY_MAX_AMOUNT_USDC` in facilitator)
- Mandate registry table (agents + delegators + limits from Postgres)

**Key API routes:**
- `POST /api/trigger-payment` — calls `initAgents()` (CDP setup, mandate registration), then delegates to `AGENT_URL/run` (streams SSE back)
- `GET /api/settlement-risk-report` — x402-gated at $0.01, returns stub JSON
- `GET /api/premium-risk-report` — x402-gated at $5.00, returns stub JSON
- `GET /api/agent/[address]` — ERC-8004 agent metadata endpoint

**Agent initialization (`lib/init-agents.ts`):**
- Creates 4 named CDP accounts (`metal-agent-1`, `metal-agent-2`, `metal-agent-3`, `metal-agent-ghost`)
- Funds ETH + USDC via CDP faucet if needed
- Registers agents 1–3 in ERC-8004
- Signs + registers AP2 mandates with facilitator (agent 1: $1, agent 2: $1, agent 3: $10, ghost: none)
- Caches mandate headers for payment requests

### 5. `apps/agent` (Bun + CDP AgentKit → Vercel)

Real Claude-powered agent. Serves both as a CLI REPL and an HTTP server for the web demo.

**HTTP server mode (`bun --filter agent dev serve`):**
- `POST /run { scenarioIndex, mandateHeader }` — picks named CDP account, streams `generateText` tokens as SSE, calls x402Fetch tool to execute real payment, ends with `{ type: "done", result }` event

**CLI modes:**
- `bun --filter agent dev` — interactive REPL
- `bun --filter agent dev happy-path` — one-shot scenario A, exit
- `bun --filter agent dev mandate-exceeded` — one-shot scenario B, prints why blocked
- `bun --filter agent dev policy-exceeded` — one-shot scenario C
- `bun --filter agent dev ghost` — one-shot scenario D

**Tools:** AgentKit wallet tools (`get_wallet_details`, `get_balance`, ERC-20), custom `x402Fetch` (handles x402 challenge + mandate header + payment, returns body + txHash).

---

## The 4 Demo Scenarios

| Slot | Agent | Mandate | Route | Fails at | Outcome |
|------|-------|---------|-------|----------|---------|
| A | metal-agent-1 | $1 | Basic $0.01 | — | Approved, real settlement |
| B | metal-agent-2 | $1 | Premium $5 | Mandate ($5 > $1) | `mandate_amount_exceeded` |
| C | metal-agent-3 | $10 | Premium $5 | Policy ($5 > $2 ceiling) | `policy_amount_exceeded` |
| D | metal-agent-ghost | none | Basic $0.01 | Identity (not in ERC-8004) | `identity_not_found` |

Each scenario uses a real CDP wallet. The agent reasons aloud before attempting payment.

---

## Wallet Roles

Three distinct wallets, generated via CDP or viem:

| Role | Env var | Purpose |
|------|---------|---------|
| Agent wallets (×4) | CDP accounts by name | Payers — hold USDC, sign x402 |
| Recipient / payTo | `PAY_TO_ADDRESS` | Receives USDC on settlement |
| Facilitator gas | `FACILITATOR_PRIVATE_KEY` | Pays gas for attest() calls, never holds USDC |
| Delegator | `DELEGATOR_PRIVATE_KEY` | Signs AP2 mandates for all agent wallets |

---

## Infrastructure

| Component | Address / URL |
|-----------|---------------|
| ERC-8004 registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Base Sepolia, live) |
| AttestationRegistry | `0xe81ea4bd57eb034047c8f0fb016d74485239d76d` (Base Sepolia) |
| Facilitator | `https://metal-facilitator.vercel.app` |
| Mandate store | Neon Postgres (Drizzle ORM) |
| Redis | Upstash (x402 nonce/replay protection) |

---

## Key Technical Decisions

- **No IdentityRegistry** — use live ERC-8004 registry, not a custom contract.
- **No Hardhat/Foundry** — compile with `solc`, deploy with viem `deployContract`.
- **CDP named accounts** — deterministic wallet per agent name, same account accessed from both `apps/web` and `apps/agent`.
- **Attestation on-chain only** — no `settlement_attestations` Postgres table; feed reads `getLogs` from chain. Postgres only stores agents + mandates.
- **AP2 mandate as HTTP header** — `X-AP2-Mandate` JSON header on every x402 request, verified by facilitator.
- **SSE streaming** — agent reasoning streams token-by-token from `apps/agent` → `apps/web` → browser.
- **Policy enforced in `onBeforeSettle`** — amount ceiling blocks payment before USDC moves, not after.
