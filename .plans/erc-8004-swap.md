# Plan: Swap IdentityRegistry → ERC-8004

**Goal:** Replace the custom `IdentityRegistry.sol` with the live ERC-8004 contract already deployed on Base Sepolia. Metal's website claims native ERC-8004 support — the demo should back that up.

**ERC-8004 Base Sepolia address:** `0x8004A818BFB912233c491871b3d84c89A494BD9e`

---

## Key Differences to Understand

| | Custom IdentityRegistry | ERC-8004 |
|---|---|---|
| Register | `register(address, name, metadataUri)` — facilitator registers anyone | `register(agentURI)` — `msg.sender` self-registers |
| Return value | none | `agentId` (ERC-721 token ID) |
| Lookup | `lookup(address) → AgentProfile` | no `lookup(address)` — indexed by `agentId`, not address |
| Data stored | `name`, `metadataUri`, `registeredAt`, `exists` | `agentURI` (points to off-chain JSON) |
| Deploy needed | yes | no — already live |

---

## Phase 1 — Registration

### Task 1: Update `register-agent.ts`

ERC-8004's `register()` has no `address` param — `msg.sender` is the registrant. The **payer wallet must send the tx itself**, not the facilitator.

**Files:**
- Modify: `scripts/register-agent.ts`

**Changes:**
- Switch from facilitator wallet to payer wallet as the tx sender
- Change target address to ERC-8004 contract (`0x8004A818BFB912233c491871b3d84c89A494BD9e`)
- Derive `agentURI` from the payer's wallet address: `${APP_URL}/api/agent/${payer.address}` — no env var needed, URI is always deterministic
- Call `register(agentURI)` with payer wallet as sender
- Capture returned `agentId` and write it to `.env.local` as `AGENT_ID`

**Gas:** ERC-8004 requires `msg.sender` = registrant, so the payer wallet pays gas. In production Metal would sponsor this (paymaster or pre-funded wallet). For the demo, fund `PAYER_PRIVATE_KEY` wallet with a small amount of Base Sepolia ETH from the faucet before running.

---

### Task 2: Update `.env.local`

- Hardcode `IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Add `APP_URL=` (base URL of the deployed Next.js app — used to derive agentURI)
- Remove `AGENT_METADATA_URI` (no longer needed)
- Add `AGENT_ID=` (written by register-agent.ts at runtime)

---

## Phase 1b — Agent Metadata Route

### Task 2b: Create `apps/web/app/api/agent/[address]/route.ts`

Returns agent metadata JSON for any wallet address. This is what `agentURI` points to.

```ts
export const GET = (_: Request, { params }: { params: { address: string } }) =>
  Response.json({
    address: params.address,
    name: "Metal Agent",
    version: "1.0.0",
    capabilities: ["payment", "settlement"],
  })
```

**Configurable later:** swap the hardcoded object for a DB/AgentKit lookup keyed by address. For now, static JSON is enough — ERC-8004 just needs a valid URL that returns JSON.

---

## Phase 2 — Lookup

### Task 3: Resolve the lookup model (DECISION NEEDED)

ERC-8004 has no `lookup(address)`. It has:
- `tokenURI(agentId) → string` — returns the `agentURI` (off-chain JSON URL)
- `getAgentWallet(agentId) → address` — agentId → wallet (reverse of what we need)

To go address → profile, options are:

**Option A: Store `agentId` after registration, look up by token ID**
- After `register-agent.ts` runs, save `agentId` to `.env.local`
- `lookupIdentity` takes `agentId` instead of `address`
- Simple, but breaks the `lookupIdentity(address)` interface used downstream

**Option B: Reverse lookup via `AgentRegistered` event**
- Filter `AgentRegistered(tokenId, wallet, agentURI)` events where `wallet = address`
- Works without storing agentId, but requires a log query (slower, more complex)

**Option C: Keep custom IdentityRegistry for lookup, use ERC-8004 for registration only**
- Register in ERC-8004 (for standards compliance / demo story)
- Also register in custom registry (for fast `lookup(address)`)
- Doubles the registration txs

**Recommended: Option A** — for the demo, `lookupIdentity` only needs to work for the one registered agent. Store `agentId` in `.env.local`, update the function signature to accept `agentId: bigint`. The downstream caller (facilitator) will know the agentId.

---

### Task 4: Update `abis.ts`

Replace `IDENTITY_REGISTRY_ABI` with ERC-8004 ABI:

```typescript
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

---

### Task 5: Update `identity.ts` and `types.ts`

**`types.ts`:** Replace `AgentProfile` (mirrors custom struct) with ERC-8004 shape:
```typescript
export interface AgentProfile {
  agentId: bigint
  wallet: `0x${string}`
  agentURI: string
}
```

**`identity.ts`:** Change `lookupIdentity(address, registryAddress, client)` to `lookupIdentity(agentId, registryAddress, client)`. Calls `tokenURI(agentId)` and `getAgentWallet(agentId)`, returns `AgentProfile | null`.

---

### Task 6: Update `identity.test.ts`

Rewrite tests to match new signature. Same 3 cases (found, not-found, rejects) but mock `tokenURI` and `getAgentWallet` calls instead of `lookup`.

---

## Phase 3 — Cleanup

### Task 7: Update `deploy-contracts.ts`

Remove IdentityRegistry deploy. Only `AttestationRegistry` is deployed by us now.

### Task 8: Remove `IdentityRegistry.sol` and its artifact

- Delete `contracts/IdentityRegistry.sol`
- Delete `contracts/artifacts/IdentityRegistry.json`

---

## Phase 4 — Verify

### Task 9: Run tests

```bash
bun test packages/shared/src/identity.test.ts
```

Expected: 3 pass.

### Task 10: Run register-agent.ts

```bash
bun scripts/register-agent.ts
```

Expected: payer wallet registers itself in ERC-8004, `agentId` written to `.env.local`, tx visible on Basescan at `https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e`.

---

## Unresolved Questions

1. **Payer gas**: fund `PAYER_PRIVATE_KEY` wallet with Base Sepolia ETH before running `register-agent.ts`. Faucet: https://faucet.quicknode.com/base/sepolia
2. **APP_URL**: set in `.env.local` before registering. Use Vercel preview URL or `http://localhost:3000` for local testing.
