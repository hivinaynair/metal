# Metal — Settlement Infrastructure Demo

A reference implementation of Metal's compliance primitive stack, built on Base Sepolia.

Metal's thesis: identity, authorization, policy, and attestation should be enforced **at the settlement layer** — not bolted on as a dashboard afterwards. This demo builds each primitive and makes it visible through a compliance console.

## Primitive Stack

| Primitive | Standard | Implementation |
|---|---|---|
| Identity | [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Live Base Sepolia registry at `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Authorization | AP2 mandate | EIP-712 signed mandate, verified in facilitator |
| Policy | Amount threshold | Enforced server-side in `/api/verify` before settlement |
| Attestation | Metal native | `AttestationRegistry` contract on Base Sepolia + Postgres read cache |
| Settlement | [x402](https://x402.org) | `@x402/evm` exact scheme, Base Sepolia USDC |

In production Metal, these would be native chain primitives. Here they run on Base Sepolia as a proxy.

## What's Built

```
bare-metal/
├── contracts/              # AttestationRegistry (Solidity); identity uses live ERC-8004
├── apps/
│   ├── web/                # Compliance console UI + x402-gated route (Next.js → Vercel)
│   └── facilitator/        # Custom x402 facilitator with Metal primitive stack (Hono → Vercel)
├── packages/
│   ├── shared/             # ERC-8004 lookup + AP2 mandate types
│   └── ui/                 # Component library
├── scripts/                # Deploy contracts, register agent, sign mandate, pay-and-fetch
└── demo/
    └── mandate.json        # Pre-signed AP2 mandate for the demo agent wallet
```

## How it Works

1. **Agent makes a payment** to an x402-gated API (`/api/settlement-risk-report`)
2. **Facilitator `/verify`** runs the full primitive stack:
   - Looks up the agent in live ERC-8004 — rejects if not registered
   - Verifies the AP2 mandate signature — rejects if invalid, expired, or over-amount
   - Checks amount against policy threshold — rejects if over limit
3. **Facilitator `/settle`** settles the USDC payment on-chain, then:
   - Calls `AttestationRegistry.attest()` — tamper-evident on-chain record
   - Mirrors to Postgres for fast console querying
4. **Compliance console** shows the full trace — both tx hashes, identity status, mandate chain

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- Base Sepolia ETH (for gas) and USDC in the payer wallet
- Postgres database (Neon recommended)

### Environment

```bash
cp .env.example .env.local
```

Required vars:

```
# Wallets (generate new ones with: bun scripts/generate-wallet.ts VAR_NAME)
PAYER_PRIVATE_KEY=         # Agent wallet — must hold Base Sepolia USDC
RECIPIENT_PRIVATE_KEY=     # Seller/payTo wallet
PAY_TO_ADDRESS=            # Address derived from RECIPIENT_PRIVATE_KEY
FACILITATOR_PRIVATE_KEY=   # Gas wallet — must hold Base Sepolia ETH for gas
DELEGATOR_PRIVATE_KEY=     # Institution wallet that signs AP2 mandates

# Contracts (populated by deploy script)
IDENTITY_REGISTRY_ADDRESS=  # live ERC-8004: 0x8004A818BFB912233c491871b3d84c89A494BD9e
ATTESTATION_REGISTRY_ADDRESS=
AGENT_ID=                   # ERC-8004 token ID returned by register-agent.ts
APP_URL=                    # base URL used for ERC-8004 agentURI metadata

# Facilitator
FACILITATOR_URL=           # Deployed facilitator URL (or http://localhost:3001 for local)
POLICY_MAX_AMOUNT_USDC=    # e.g. 10

# Database
DATABASE_URL=              # Postgres connection string
```

### Deploy contracts

```bash
bun scripts/deploy-contracts.ts      # deploys AttestationRegistry, writes address to .env.local
bun scripts/register-agent.ts        # self-registers payer wallet in live ERC-8004 and writes AGENT_ID
```

### Sign the AP2 mandate

```bash
bun scripts/sign-mandate.ts          # writes demo/mandate.json
```

### Run locally

```bash
bun dev                              # starts all apps via Turborepo
```

### Test a real payment

```bash
bun scripts/pay-and-fetch.ts         # fires a real x402 payment end-to-end
```

Both the USDC settlement tx and the attestation tx will be logged with Basescan links.

## GitHub Issues

See [#1](https://github.com/hivinaynair/metal/issues/1) for the full PRD and [#2–#8](https://github.com/hivinaynair/metal/issues) for implementation slices.
