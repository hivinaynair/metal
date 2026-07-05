# Issue #2 — Contracts + Shared Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy `IdentityRegistry` (ERC-8004) and `AttestationRegistry` contracts to Base Sepolia, then create `packages/shared` with a typed `lookupIdentity()` utility and AP2 mandate types.

**Architecture:**
- Solidity contracts compiled via `solc` npm package, ABIs committed as JSON artifacts
- Deploy scripts follow existing pattern in `scripts/` (viem + bun, reads/writes `.env.local`)
- `packages/shared` mirrors `packages/ui` workspace conventions (`@workspace/shared`, `workspace:*` ref)
- Tests use `bun test` (built-in, zero config)

**Tech Stack:** Solidity, `solc` npm package, viem `deployContract`, bun test, TypeScript

---

## Phase 1 — Solidity Contracts

### Task 1: Write `IdentityRegistry.sol`

**Files:**
- Create: `contracts/IdentityRegistry.sol`

**Step 1: Write the contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    struct AgentProfile {
        string name;
        string metadataUri;
        uint256 registeredAt;
        bool exists;
    }

    mapping(address => AgentProfile) private profiles;

    event AgentRegistered(address indexed agent, string name, uint256 registeredAt);

    function register(address agent, string calldata name, string calldata metadataUri) external {
        profiles[agent] = AgentProfile(name, metadataUri, block.timestamp, true);
        emit AgentRegistered(agent, name, block.timestamp);
    }

    function lookup(address agent) external view returns (AgentProfile memory) {
        return profiles[agent];
    }
}
```

**Step 2: Verify it compiles (next task)**

---

### Task 2: Write `AttestationRegistry.sol`

**Files:**
- Create: `contracts/AttestationRegistry.sol`

**Step 1: Write the contract**

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

**Note:** No storage — events only. Cheaper gas, still verifiable on Basescan.

---

### Task 3: Set up compilation

**Files:**
- Modify: `package.json` (root) — add `solc` devDep
- Create: `scripts/compile-contracts.ts`
- Create: `contracts/artifacts/IdentityRegistry.json`
- Create: `contracts/artifacts/AttestationRegistry.json`

**Step 1: Install solc**

```bash
bun add -d solc -w
```

**Step 2: Write compile script**

```typescript
// scripts/compile-contracts.ts
import solc from "solc"
import { readFileSync, writeFileSync, mkdirSync } from "fs"

function compile(name: string) {
  const source = readFileSync(`contracts/${name}.sol`, "utf8")
  const input = {
    language: "Solidity",
    sources: { [`${name}.sol`]: { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  if (output.errors?.some((e: { severity: string }) => e.severity === "error")) {
    console.error(output.errors)
    process.exit(1)
  }
  const contract = output.contracts[`${name}.sol`][name]
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object }
}

mkdirSync("contracts/artifacts", { recursive: true })

const identity = compile("IdentityRegistry")
writeFileSync("contracts/artifacts/IdentityRegistry.json", JSON.stringify(identity, null, 2))
console.log("✓ IdentityRegistry compiled")

const attestation = compile("AttestationRegistry")
writeFileSync("contracts/artifacts/AttestationRegistry.json", JSON.stringify(attestation, null, 2))
console.log("✓ AttestationRegistry compiled")
```

**Step 3: Run compile**

```bash
bun scripts/compile-contracts.ts
```

Expected: two JSON files in `contracts/artifacts/`. No errors.

**Step 4: Commit artifacts** (committed so deploy script doesn't need solc at runtime)

```bash
git add contracts/ && git commit -m "feat: add Solidity contracts and compiled artifacts"
```

---

### Task 4: Write deploy script

**Files:**
- Create: `scripts/deploy-contracts.ts`

**Risk:** Needs `FACILITATOR_PRIVATE_KEY` for gas. This wallet must hold Base Sepolia ETH. Generate it first if it doesn't exist:
```bash
bun scripts/generate-wallet.ts FACILITATOR_PRIVATE_KEY
```
Then fund it at https://faucet.quicknode.com/base/sepolia

**Step 1: Write the deploy script**

```typescript
// scripts/deploy-contracts.ts
import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { readFileSync, writeFileSync, readFileSync as rf } from "fs"

const key = process.env.FACILITATOR_PRIVATE_KEY
if (!key) throw new Error("FACILITATOR_PRIVATE_KEY not set")

const account = privateKeyToAccount(key as `0x${string}`)
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() })

async function deploy(name: string) {
  const { abi, bytecode } = JSON.parse(readFileSync(`contracts/artifacts/${name}.json`, "utf8"))
  const hash = await walletClient.deployContract({ abi, bytecode: `0x${bytecode}`, account })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error(`${name} deploy failed`)
  console.log(`✓ ${name}: ${receipt.contractAddress}`)
  console.log(`  https://sepolia.basescan.org/address/${receipt.contractAddress}`)
  return receipt.contractAddress
}

const identityAddr = await deploy("IdentityRegistry")
const attestationAddr = await deploy("AttestationRegistry")

// Write addresses to .env.local
let env = readFileSync(".env.local", "utf8")
const set = (key: string, val: string) => {
  const re = new RegExp(`^${key}=.*`, "m")
  env = re.test(env) ? env.replace(re, `${key}=${val}`) : env + `\n${key}=${val}`
}
set("IDENTITY_REGISTRY_ADDRESS", identityAddr)
set("ATTESTATION_REGISTRY_ADDRESS", attestationAddr)
writeFileSync(".env.local", env)
console.log("✓ Addresses written to .env.local")
```

**Step 2: Run it**

```bash
bun scripts/deploy-contracts.ts
```

Expected: two contract addresses logged, both visible on Basescan, `.env.local` updated.

**Step 3: Commit**

```bash
git add .env.local && git commit -m "chore: add deployed contract addresses"
```

---

### Task 5: Write register-agent script

**Files:**
- Create: `scripts/register-agent.ts`

```typescript
// scripts/register-agent.ts
import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { readFileSync } from "fs"
import { abi } from "../contracts/artifacts/IdentityRegistry.json"

const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`
const payerKey = process.env.PAYER_PRIVATE_KEY as `0x${string}`
const registryAddress = process.env.IDENTITY_REGISTRY_ADDRESS as `0x${string}`

if (!facilitatorKey || !payerKey || !registryAddress) {
  throw new Error("Missing env vars")
}

const facilitator = privateKeyToAccount(facilitatorKey)
const payer = privateKeyToAccount(payerKey)

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
const walletClient = createWalletClient({ account: facilitator, chain: baseSepolia, transport: http() })

const hash = await walletClient.writeContract({
  address: registryAddress,
  abi,
  functionName: "register",
  args: [payer.address, "Demo Agent", "https://metal-demo.vercel.app/agent"],
})

await publicClient.waitForTransactionReceipt({ hash })
console.log(`✓ Registered ${payer.address}`)
console.log(`  https://sepolia.basescan.org/tx/${hash}`)
```

**Run:**

```bash
bun scripts/register-agent.ts
```

Expected: payer address registered, tx visible on Basescan.

**Commit:**
```bash
git add scripts/ && git commit -m "feat: add register-agent script"
```

---

## Phase 2 — packages/shared

### Task 6: Scaffold the workspace package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Step 1: package.json** (mirror packages/ui pattern)

```json
{
  "name": "@workspace/shared",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./identity": "./src/identity.ts",
    "./mandate": "./src/mandate.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5"
  },
  "dependencies": {
    "viem": "^2"
  }
}
```

**Step 2: tsconfig.json**

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "include": ["src"]
}
```

**Step 3: Verify bun picks up the new package**

```bash
bun install
```

Expected: no errors.

---

### Task 7: Types

**Files:**
- Create: `packages/shared/src/types.ts`

```typescript
// packages/shared/src/types.ts
export interface AgentProfile {
  name: string
  metadataUri: string
  registeredAt: bigint
  exists: boolean
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

---

### Task 8: TDD — `lookupIdentity()`

**Files:**
- Create: `packages/shared/src/identity.test.ts`
- Create: `packages/shared/src/identity.ts`

**Step 1: Write the failing test**

```typescript
// packages/shared/src/identity.test.ts
import { describe, it, expect, mock } from "bun:test"
import type { AgentProfile } from "./types"

// We'll import lookupIdentity after writing it
import { lookupIdentity } from "./identity"

const REGISTRY = "0x1234000000000000000000000000000000000001" as `0x${string}`
const AGENT = "0xdeadbeef00000000000000000000000000000002" as `0x${string}`

const mockRegistered: AgentProfile = {
  name: "Demo Agent",
  metadataUri: "https://example.com/agent",
  registeredAt: 1234567890n,
  exists: true,
}

describe("lookupIdentity", () => {
  it("returns profile for registered address", async () => {
    const mockClient = {
      readContract: mock(() => Promise.resolve(mockRegistered)),
    }
    const result = await lookupIdentity(AGENT, REGISTRY, mockClient as any)
    expect(result).toEqual(mockRegistered)
  })

  it("returns null for unregistered address", async () => {
    const unregistered: AgentProfile = {
      name: "",
      metadataUri: "",
      registeredAt: 0n,
      exists: false,
    }
    const mockClient = {
      readContract: mock(() => Promise.resolve(unregistered)),
    }
    const result = await lookupIdentity(AGENT, REGISTRY, mockClient as any)
    expect(result).toBeNull()
  })

  it("returns null and does not throw when contract call rejects", async () => {
    const mockClient = {
      readContract: mock(() => Promise.reject(new Error("not a contract"))),
    }
    const result = await lookupIdentity(AGENT, REGISTRY, mockClient as any)
    expect(result).toBeNull()
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
cd packages/shared && bun test
```

Expected: FAIL — `lookupIdentity` not found.

**Step 3: Write minimal implementation**

```typescript
// packages/shared/src/identity.ts
import type { PublicClient } from "viem"
import type { AgentProfile } from "./types"
import { IDENTITY_REGISTRY_ABI } from "./abis"

export async function lookupIdentity(
  agent: `0x${string}`,
  registryAddress: `0x${string}`,
  client: Pick<PublicClient, "readContract">
): Promise<AgentProfile | null> {
  try {
    const profile = await client.readContract({
      address: registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "lookup",
      args: [agent],
    }) as AgentProfile
    return profile.exists ? profile : null
  } catch {
    return null
  }
}
```

**Step 4: Add ABI constant**

```typescript
// packages/shared/src/abis.ts
export const IDENTITY_REGISTRY_ABI = [
  {
    name: "lookup",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "metadataUri", type: "string" },
          { name: "registeredAt", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "name", type: "string" },
      { name: "metadataUri", type: "string" },
    ],
    outputs: [],
  },
] as const

export const ATTESTATION_REGISTRY_ABI = [
  {
    name: "attest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentHash", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "amountUsdc", type: "uint256" },
      { name: "identityStatus", type: "uint8" },
      { name: "decision", type: "uint8" },
    ],
    outputs: [],
  },
] as const
```

**Step 5: Run tests to confirm they pass**

```bash
cd packages/shared && bun test
```

Expected: 3 tests pass.

**Step 6: Commit**

```bash
git add packages/shared/ && git commit -m "feat: add packages/shared with lookupIdentity and mandate types"
```

---

### Task 9: Verify importable from apps/web

**Step 1: Add to apps/web/package.json**

```json
"@workspace/shared": "workspace:*"
```

**Step 2: bun install**

```bash
bun install
```

**Step 3: Test import in apps/web**

Add a temporary import to `apps/web/app/page.tsx`, run `bun typecheck`, remove it.

```bash
cd apps/web && bun typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/package.json bun.lock && git commit -m "chore: add @workspace/shared to apps/web deps"
```

---

## Risks and Unknowns

1. **FACILITATOR_PRIVATE_KEY gas**: wallet must have Base Sepolia ETH before deploy. Faucet: https://faucet.quicknode.com/base/sepolia
2. **solc version**: `solc` npm package must match `pragma solidity ^0.8.20`. Pin to `0.8.20` in compile script if needed.
3. **bun test mock API**: uses `bun:test` module — confirm `mock()` import syntax matches bun 1.3.9.
4. **Module resolution**: `packages/shared` uses `NodeNext` module resolution — exports map must match exactly.
5. **ABI import in scripts**: `register-agent.ts` imports from `contracts/artifacts/IdentityRegistry.json` — requires `resolveJsonModule: true` in tsconfig (already set in base config).
