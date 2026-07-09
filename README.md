# Metal — Settlement Infrastructure Demo

Metal's thesis: identity, authorization, policy, and attestation enforce compliance **at the settlement layer** — before funds move, not in a dashboard afterwards. This demo builds that primitive stack live on Base Sepolia and puts a real Claude agent at the center of it.

## Primitive Stack

| Primitive | Standard | Implementation |
|-----------|----------|----------------|
| Identity | [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Live registry at `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Authorization | AP2 mandate | Agent-held EIP-712 signed delegation, verified in facilitator before settlement |
| Policy | Amount threshold | `POLICY_MAX_AMOUNT_USDC` ceiling enforced in `onBeforeSettle` |
| Attestation | On-chain | `AttestationRegistry` at `0xe81ea4bd57eb034047c8f0fb016d74485239d76d` |
| Settlement | [x402](https://x402.org) | `@x402/evm` exact scheme, Base Sepolia USDC |

In production Metal, these are native chain primitives. Here they run on Base Sepolia as a proxy.

## Repo Structure

```
bare-metal/
├── apps/
│   ├── web/          # Compliance console + x402-gated routes (Next.js → Vercel)
│   ├── agent/        # Claude agent with CDP/AgentKit wallet — HTTP server + CLI (Bun → Vercel)
│   └── facilitator/  # Custom x402 facilitator with full primitive stack (Hono → Vercel)
├── packages/
│   ├── shared/       # ERC-8004 lookup, AP2 mandate types, ABIs, Drizzle schema
│   └── ui/           # Component library
├── contracts/        # AttestationRegistry.sol + compiled artifacts
└── scripts/          # Deploy contracts, fund wallets, sign/register mandates
```

## How it Works

```
Agent wants to pay $0.50 for /api/settlement-risk-report
  → agent loads its AP2 credential for its CDP wallet
  → x402 challenge issued
  → Facilitator /verify:
      1. AP2 mandate header — is there an explicit signed authorization artifact?
      2. ERC-8004 lookup — is this agent registered?
      3. AP2 limits — is the EIP-712 signature valid, not expired, amount within limit?
      4. Policy check — is amount below the settlement ceiling?
      ↳ reject at first failure, funds never move
  → Facilitator /settle:
      5. USDC settles on Base Sepolia
      6. AttestationRegistry.attest() — tamper-evident on-chain record
  → Compliance console shows trace + both Basescan links
```

## The 4 Demo Scenarios

| Slot | Agent | Mandate | Route | Fails at |
|------|-------|---------|-------|----------|
| A | metal-agent-1 | $1 | Basic $0.50 | — (approved, real settlement) |
| B | metal-agent-2 | $1 | Premium $5 | Mandate exceeded ($5 > $1) |
| C | metal-agent-3 | $10 | Premium $5 | Policy ceiling ($5 > $2) |
| D | metal-agent-ghost | zero-limit AP2 header | Basic $0.50 | Identity not found in ERC-8004 |

Each uses a real CDP wallet. The agent service retrieves its own AP2 credential and every paid request carries an explicit `X-AP2-Mandate` header. The Claude agent reasons aloud before attempting payment — its reasoning streams live into the UI.

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- CDP API key (for agent wallets)
- Neon Postgres + Upstash Redis URLs

### Environment

Copy `.env.example` to `.env.local` in each app. Required vars:

```bash
# Wallets
PAY_TO_ADDRESS=              # receives USDC on settlement
FACILITATOR_PRIVATE_KEY=     # gas wallet — holds Base Sepolia ETH, never USDC
DELEGATOR_PRIVATE_KEY=       # institution wallet that signs AP2 mandates

# CDP / AgentKit
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
ANTHROPIC_API_KEY=

# Contracts
ATTESTATION_REGISTRY_ADDRESS=0xe81ea4bd57eb034047c8f0fb016d74485239d76d

# URLs
APP_URL=                     # deployed web app (or http://localhost:3000)
FACILITATOR_URL=             # deployed facilitator (or http://localhost:3001)
AGENT_URL=                   # deployed agent server; used for ERC-8004 agentURI (or http://localhost:3002)

# Storage
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
DATABASE_URL=                # Neon Postgres
```

### Run locally

```bash
bun dev          # starts web + facilitator + agent server via Turborepo
```

Web → `localhost:3000`, facilitator → `localhost:3001`, agent server → `localhost:3002`.

Agent wallets are created and funded automatically on first request to the web console.

### CLI agent

```bash
bun --filter agent dev                     # interactive REPL — ask it to fetch a report
bun --filter agent dev happy-path          # one-shot: pays $0.50, prints reasoning + tx hashes
bun --filter agent dev mandate-exceeded    # one-shot: blocked at mandate gate, agent explains why
bun --filter agent dev policy-exceeded     # one-shot: blocked at policy ceiling
bun --filter agent dev ghost               # one-shot: blocked at identity gate
bun --filter agent dev serve               # HTTP server mode (used by web console)
```

The CLI agent uses a real CDP wallet, verifies its mandate and identity, and pays via x402. Approved settlements are attested on-chain and logged with Basescan links; rejected gate decisions are recorded in Postgres with the policy snapshot used for the decision.

### Deploy contracts (if redeploying)

```bash
bun --filter @workspace/scripts deploy-contracts   # deploys AttestationRegistry, writes address to .env.local
bun --filter @workspace/scripts fund-wallet        # funds FACILITATOR_PRIVATE_KEY with Base Sepolia ETH
```

Mandates are signed by `demo:bootstrap`, registered with the facilitator, and deposited into the agent credential store so the agent can present its own AP2 credential at runtime.
