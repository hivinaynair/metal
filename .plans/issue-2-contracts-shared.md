# Issue #2 — Contracts + Shared Foundation

**Goal:** Use the live ERC-8004 registry on Base Sepolia for agent identity, deploy only Metal's `AttestationRegistry`, and create `packages/shared` with typed ERC-8004 lookup utilities, attestation ABI, and AP2 mandate types.

**ERC-8004 Base Sepolia address:** `0x8004A818BFB912233c491871b3d84c89A494BD9e`

**Architecture:**
- Identity is not a local Solidity contract. The payer/agent wallet self-registers with live ERC-8004 by calling `register(agentURI)`.
- ERC-8004 registration returns an `agentId` token ID. Store it in `.env.local` as `AGENT_ID`.
- `lookupIdentity(agentId, registryAddress, client)` calls ERC-8004 `tokenURI(agentId)` and `getAgentWallet(agentId)`.
- `AttestationRegistry` is the only contract deployed by this repo.
- Solidity is compiled via `solc`; ABIs/artifacts are committed where needed.
- Tests use `bun test`.

---

## Phase 1 — Attestation Contract

### Task 1: Keep only `AttestationRegistry.sol`

**Files:**
- Keep/create: `contracts/AttestationRegistry.sol`
- Remove: `contracts/IdentityRegistry.sol`
- Remove: `contracts/artifacts/IdentityRegistry.json`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AttestationRegistry {
    event Attested(
        bytes32 indexed paymentHash,
        address indexed payer,
        uint256 amountUsdc,
        uint8 identityStatus,
        uint8 decision,
        uint256 timestamp
    );

    function attest(
        bytes32 paymentHash,
        address payer,
        uint256 amountUsdc,
        uint8 identityStatus,
        uint8 decision
    ) external {
        emit Attested(paymentHash, payer, amountUsdc, identityStatus, decision, block.timestamp);
    }
}
```

### Task 2: Compile only attestation

**Files:**
- Modify: `scripts/compile-contracts.ts`
- Create/update: `contracts/artifacts/AttestationRegistry.json`

`compile-contracts.ts` should compile `AttestationRegistry` only. It should not read or emit `IdentityRegistry`.

### Task 3: Deploy only attestation

**Files:**
- Modify: `scripts/deploy-contracts.ts`

Deploy `AttestationRegistry` with `FACILITATOR_PRIVATE_KEY`, then write only:

```env
ATTESTATION_REGISTRY_ADDRESS=
IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
```

Do not deploy an identity contract.

---

## Phase 2 — ERC-8004 Registration

### Task 4: Register the payer/agent wallet in live ERC-8004

**Files:**
- Modify: `scripts/register-agent.ts`

ERC-8004 `register(agentURI)` uses `msg.sender` as the registered wallet, so the payer wallet must send the transaction.

Implementation requirements:
- Read `PAYER_PRIVATE_KEY`, `APP_URL`, and `IDENTITY_REGISTRY_ADDRESS`.
- Default `IDENTITY_REGISTRY_ADDRESS` to `0x8004A818BFB912233c491871b3d84c89A494BD9e` if absent.
- Derive `agentURI` as `${APP_URL}/api/agent/${payer.address}`.
- Call `register(agentURI)` from the payer wallet.
- Capture the returned `agentId` and write it to `.env.local` as `AGENT_ID`.

**Gas:** fund the `PAYER_PRIVATE_KEY` wallet with a small amount of Base Sepolia ETH before running this script.

### Task 5: Add agent metadata route

**Files:**
- Create: `apps/web/app/api/agent/[address]/route.ts`

Return stable JSON metadata for the ERC-8004 `agentURI`:

```ts
export const GET = (_: Request, { params }: { params: { address: string } }) =>
  Response.json({
    address: params.address,
    name: "Metal Agent",
    version: "1.0.0",
    capabilities: ["payment", "settlement"],
  })
```

---

## Phase 3 — packages/shared

### Task 6: Scaffold package

**Files:**
- Create/update: `packages/shared/package.json`
- Create/update: `packages/shared/tsconfig.json`
- Create/update: `packages/shared/src/index.ts`

Exports should include `./identity`, `./mandate`, `./types`, and `./abis`.

### Task 7: Types

**Files:**
- Modify: `packages/shared/src/types.ts`

```ts
export interface AgentProfile {
  agentId: bigint
  wallet: `0x${string}`
  agentURI: string
}

export interface MandatePayload {
  agent: `0x${string}`
  delegator: `0x${string}`
  maxAmountUsdc: bigint
  expiry: bigint
  nonce: bigint
}

export interface SignedMandate {
  payload: MandatePayload
  signature: `0x${string}`
}
```

### Task 8: ABIs

**Files:**
- Modify: `packages/shared/src/abis.ts`

Replace the custom `IDENTITY_REGISTRY_ABI` with ERC-8004:

```ts
export const ERC8004_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "getAgentWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const
```

Keep `ATTESTATION_REGISTRY_ABI` for `attest(...)`.

### Task 9: TDD — `lookupIdentity(agentId)`

**Files:**
- Modify: `packages/shared/src/identity.ts`
- Modify: `packages/shared/src/identity.test.ts`

`lookupIdentity` signature:

```ts
lookupIdentity(
  agentId: bigint,
  registryAddress: `0x${string}`,
  client: Pick<PublicClient, "readContract">
): Promise<AgentProfile | null>
```

Behavior:
- Calls `tokenURI(agentId)` and `getAgentWallet(agentId)`.
- Returns `{ agentId, wallet, agentURI }` when both calls succeed.
- Returns `null` when either call rejects or returns unusable data.

Test cases:
- registered `agentId` returns profile
- not found returns `null`
- rejected contract call returns `null`

---

## Phase 4 — Mandate Registration Contract

ERC-8004 has no address-to-agentId lookup. The facilitator should avoid log scanning by storing `agentId` when the mandate is registered.

**Facilitator mandate store shape:**

```ts
Map<string, { mandate: SignedMandate; agentId: bigint }>
```

Key by `mandate.payload.agent.toLowerCase()`.

`POST /mandates` body:

```ts
{ mandate: SignedMandate, agentId: bigint }
```

`POST /verify` should:
1. Run x402 verification.
2. Look up the mandate by payer address.
3. Call `lookupIdentity(agentId, ERC8004_ADDRESS, publicClient)`.
4. Confirm `profile.wallet.toLowerCase() === payer.toLowerCase()`.
5. Verify AP2 signature, expiry, and amount.

---

## Acceptance Checklist

- [ ] No local `IdentityRegistry.sol` or artifact remains.
- [ ] `scripts/compile-contracts.ts` compiles only `AttestationRegistry`.
- [ ] `scripts/deploy-contracts.ts` deploys only `AttestationRegistry`.
- [ ] `.env.local` uses `IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- [ ] `scripts/register-agent.ts` self-registers the payer wallet in ERC-8004 and writes `AGENT_ID`.
- [ ] `apps/web/app/api/agent/[address]/route.ts` serves valid JSON metadata.
- [ ] `packages/shared` exposes ERC-8004 ABI, attestation ABI, AP2 mandate types, and `lookupIdentity(agentId)`.
- [ ] `bun test packages/shared/src/identity.test.ts` passes.
