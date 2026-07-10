# Bare Metal

> Compliance enforced at the settlement layer. Before funds move, not in a dashboard afterwards.

**[Live Demo →](https://metal-web.vercel.app/)**

> Unofficial application project inspired by Metal's public thesis. Not affiliated with or endorsed by Metal.

Most compliance systems work backwards: money moves first, then a monitoring dashboard flags the violation. Metal flips this. Identity, authorization, policy, and attestation are verified cryptographically at the settlement moment. If any gate fails, funds never leave the wallet.

This is a full-stack implementation of that primitive stack, live on Base Sepolia, with a real Claude agent at the center making real payments.

---

## The Primitive Stack

| Primitive | Standard | What it does |
|-----------|----------|--------------|
| **Identity** | [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Agent must exist in the on-chain registry before funds can move |
| **Authorization** | AP2 mandate | Agent carries an EIP-712 signed delegation from its institution: explicit spending limits, expiry, and scope |
| **Policy** | Amount ceiling | Facilitator enforces a configurable `POLICY_MAX_AMOUNT_USDC` per settlement |
| **Settlement** | [x402](https://x402.org) | HTTP-native micropayment protocol, `@x402/evm` exact scheme, Base Sepolia USDC |
| **Attestation** | On-chain | `AttestationRegistry` emits a tamper-evident record for approved settlements |

Every gate is a hard block, not a soft warning. The first failure aborts settlement and writes the rejection reason to the audit log.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│  Click "Run" → SSE stream → live gate animations + reasoning + tx links │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Agent Server   │  Bun / Hono
                    │  :3002          │
                    │                 │  ① Load CDP wallet
                    │                 │  ② Load AP2 credential
                    │                 │  ③ Claude reasons aloud
                    │                 │  ④ performX402Fetch()
                    └────────┬────────┘
                             │  X-AP2-Mandate header + x402 payment sig
                             │
                    ┌────────▼────────┐
                    │  Web App        │  Next.js / Vercel
                    │  :3000          │
                    │                 │  x402 middleware intercepts request
                    │                 │  → calls facilitator.verify()
                    │                 │  → calls facilitator.settle()
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Facilitator    │  Bun / Hono
                    │  :3001          │
                    │                 │
                    │  /verify        │
                    │  ① AP2 mandate present?
                    │  ② ERC-8004 identity valid?
                    │  ③ EIP-712 sig + expiry + limit?
                    │  ④ Below policy ceiling?
                    │    ↳ first failure → abort, log
                    │                 │
                    │  /settle        │
                    │  ⑤ USDC transfer (Base Sepolia)
                    │  ⑥ AttestationRegistry.attest()
                    │  ⑦ Persist DecisionRecord → Postgres
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Base Sepolia   │
                    │                 │
                    │  USDC transfer  │
                    │  Attested event │  ← tamper-evident on-chain record
                    └─────────────────┘
```

---

## Settlement Gate Pipeline

```
  Agent Request
       │
  [0] Agent resolved ──────── CDP wallet + AP2 credential loaded
       │
  [1] Payment submitted ───── x402 challenge issued by web server
       │
  [2] Identity check ──────── ERC-8004 registry lookup (agentId → wallet)
       │                      ↳ fail: identity_not_found
  [3] Mandate check ───────── EIP-712 signature verify + expiry + amount limit
       │                      ↳ fail: mandate_missing / mandate_invalid / mandate_expired / mandate_amount_exceeded
  [4] Policy check ────────── Amount ≤ POLICY_MAX_AMOUNT_USDC ceiling
       │                      ↳ fail: policy_amount_exceeded
  [5] Settlement ──────────── USDC transfer on Base Sepolia
       │
  [6] Attestation ─────────── AttestationRegistry.attest() + Postgres log
       │
  Resource returned ────────── JSON report + both Basescan links
```

Every rejection at gates 2–4 means funds never left the wallet. Approved settlements are attested on-chain; every decision is persisted in the database with the full policy snapshot.

---

## The 4 Demo Scenarios

| | Agent | Mandate limit | Route | Price | Fails at |
|---|---|---|---|---|---|
| **A** | metal-agent-1 | $1 | Basic report | $0.20 | approved, real USDC settlement |
| **B** | metal-agent-2 | $1 | Premium report | $5.00 | Mandate ($5 > $1 limit) |
| **C** | metal-agent-3 | $10 | Premium report | $5.00 | Policy ceiling ($5 > $2 ceiling) |
| **D** | metal-agent-ghost | n/a | Basic report | $0.20 | Identity (not in ERC-8004 registry) |

Each uses a real CDP wallet. The Claude agent emits live status text before attempting payment, and the stream appears in the UI alongside the gate animations.

---

## Repo Structure

```
bare-metal/
├── apps/
│   ├── web/          # Compliance console + x402-gated routes     (Next.js)
│   ├── agent/        # Claude agent with CDP wallet + x402 fetch  (Bun / Hono)
│   └── facilitator/  # Custom x402 facilitator, full gate stack   (Bun / Hono)
├── packages/
│   ├── shared/       # ERC-8004 lookup, AP2 types, ABIs, decision records
│   ├── db/           # Drizzle schema: agents + settlementAttestations
│   └── ui/           # React component library
├── contracts/        # AttestationRegistry.sol + compiled artifacts
└── scripts/          # Deploy contracts, fund wallets, bootstrap mandates
```

---

## How AP2 Mandates Work

AP2 is the agent authorization primitive. An institution signs a delegation credential for each agent wallet:

```typescript
// EIP-712 signed struct
{
  agent: address,           // CDP wallet address
  delegator: address,       // Institution's wallet
  maxAmountUsdc: uint256,   // Hard spending limit
  expiry: uint256,          // Unix timestamp
  nonce: uint256            // Prevents replay
}
```

The agent carries this credential as JSON in the `X-AP2-Mandate` header on every paid request. The facilitator verifies the EIP-712 signature against the institution's key. If the signature is wrong, the mandate is forged and the gate blocks immediately.

This means spending authority is always traceable to a specific institution, for a specific agent, at a specific limit. No mandate, no payment.

---

## Decision Evidence

Approved settlements are recorded in `AttestationRegistry`:

```solidity
event Attested(
  bytes32 indexed paymentHash,
  address indexed payer,
  uint256 amountUsdc,
  IdentityStatus identityStatus,  // NotFound | Verified | Flagged
  Decision decision,              // Approved | Rejected
  uint256 timestamp
);
```

Approved settlements emit two transactions: the USDC transfer and the attestation. Both Basescan links appear in the UI. Rejected decisions are persisted as DecisionRecords with the rejection reason and policy snapshot, with no funds moved.

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- CDP API key (Coinbase Developer Platform, for agent wallets)
- Neon Postgres

### Environment

Copy `.env.example` → `.env.local` in each app:

```bash
# Wallets
PAY_TO_ADDRESS=              # receives USDC on settlement
FACILITATOR_PRIVATE_KEY=     # gas wallet, holds ETH, never USDC
DELEGATOR_PRIVATE_KEY=       # institution wallet that signs AP2 mandates

# CDP / AgentKit
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
ANTHROPIC_API_KEY=

# Contracts
ATTESTATION_REGISTRY_ADDRESS=0xe81ea4bd57eb034047c8f0fb016d74485239d76d

# URLs
APP_URL=                     # web app (or http://localhost:3000)
FACILITATOR_URL=             # facilitator (or http://localhost:3001)
AGENT_URL=                   # agent server (or http://localhost:3002)

# Storage
DATABASE_URL=                # Neon Postgres
```

### Run locally

```bash
bun install
bun dev        # starts web + facilitator + agent server via Turborepo
```

`localhost:3000` - web console
`localhost:3001` - facilitator
`localhost:3002` - agent server

Agent wallets are created and funded via CDP on first request.

### CLI agent

```bash
bun --filter agent dev                   # interactive REPL
bun --filter agent dev happy-path        # pays $0.20, prints reasoning + tx hashes
bun --filter agent dev mandate-exceeded  # blocked at mandate gate
bun --filter agent dev policy-exceeded   # blocked at policy ceiling
bun --filter agent dev ghost             # blocked at identity gate
bun --filter agent dev serve             # HTTP server mode (used by web console)
```

### Deploy contracts

```bash
bun --filter @workspace/scripts deploy-contracts   # deploys AttestationRegistry
bun --filter @workspace/scripts fund-wallet        # funds facilitator wallet with Base Sepolia ETH
bun --filter @workspace/scripts demo-bootstrap     # registers agents in ERC-8004, signs AP2 mandates
```

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| Identity Registry (ERC-8004) | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| Attestation Registry | [`0xe81ea4bd57eb034047c8f0fb016d74485239d76d`](https://sepolia.basescan.org/address/0xe81ea4bd57eb034047c8f0fb016d74485239d76d) |

---

## Tech Stack

| | |
|---|---|
| Runtime | Bun 1.3 |
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Hono 4.7 |
| Blockchain | viem 2.54, Base Sepolia |
| Agent | Claude via Anthropic SDK + AI SDK tool use |
| Wallets | Coinbase CDP / AgentKit |
| x402 | `@x402/evm`, `@x402/core`, `@x402/fetch`, `@x402/next` |
| Database | Neon Postgres + Drizzle ORM |
| Monorepo | Turborepo |
