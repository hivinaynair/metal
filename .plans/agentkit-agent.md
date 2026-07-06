# Plan: AgentKit-Powered Demo Agent

**Goal:** Replace `scripts/pay-and-fetch.ts` (dumb script) with a real LLM-powered agent (Claude + Coinbase AgentKit) that autonomously reasons about, pays for, and retrieves the settlement risk report — making the Metal primitive stack tangible.

---

## Background

The demo currently has a script that pretends to be an agent. AgentKit turns it into an actual AI agent:
- The agent gets a task in plain English
- It checks its wallet balance, decides to pay, executes x402 payment on-chain
- It reads the risk report and summarizes it
- The full Metal compliance stack runs (identity check → mandate verify → policy → settlement → attestation)

---

## Architecture Decision: Who Signs the x402 Payment?

Two options. Chosen option matters for how the AgentKit wallet is wired:

### Option A — AgentKit CDP wallet signs x402 (tighter integration)
- AgentKit creates/manages the wallet via Coinbase Developer Platform (MPC, no raw key)
- We write a thin viem `Account` adapter that delegates `signTypedData` to the CDP API
- The CDP wallet address is registered in live ERC-8004 + has its mandate
- Pro: The "agent" truly is the AgentKit agent end-to-end
- Con: Custom signer adapter needed; CDP wallet must hold testnet USDC

### Option B — Env private key signs x402 (simpler, good enough for demo)
- Keep `PAYER_PRIVATE_KEY` for x402 payment signing (as today)
- AgentKit provides the LLM reasoning layer + tool framework on top
- The agent's "wallet awareness" comes from AgentKit's `getBalance` tool
- Pro: x402 works out-of-box, no adapter needed
- Con: The AgentKit wallet address ≠ the paying wallet address (slight conceptual mismatch)

**Recommended: Option A** — it makes the story coherent ("the AI agent pays from its own wallet"). But Option B is a valid fallback if CDP wallet ↔ x402 signing is painful.

---

## Steps

### Step 1 — Create `apps/agent` app

**What:** New Bun/Node app in the monorepo.

**Touches:**
- `apps/agent/package.json`
- `apps/agent/tsconfig.json`
- `apps/agent/.env.example`
- `turbo.json` (add agent to workspace)
- Root `package.json` (workspace reference)

**Dependencies to add:**
```
@coinbase/agentkit          # wallet + on-chain actions
@coinbase/agentkit-ai-sdk-extension  # Vercel AI SDK adapter for AgentKit tools
ai                           # Vercel AI SDK
@ai-sdk/anthropic            # Claude provider for Vercel AI SDK
@x402/fetch                  # x402 payment wrapping
@x402/evm                    # ExactEvmScheme
viem                         # already in root, needed here too
```

**New env vars needed:**
```
CDP_API_KEY_NAME=            # from Coinbase Developer Platform
CDP_API_KEY_PRIVATE_KEY=     # CDP API private key (not the wallet key)
CDP_WALLET_DATA=             # JSON blob of persisted wallet state (after first run)
ANTHROPIC_API_KEY=           # for Claude
AGENT_URL=                   # URL of x402-gated route
```

**Risks:** None. Pure new app, no existing code touched.

---

### Step 2 — AgentKit wallet initialization

**What:** Script/init code that creates or loads a CDP-managed wallet, persists it, and logs the wallet address.

**Touches:**
- `apps/agent/src/wallet.ts` — `initWallet()` helper
- Writes `CDP_WALLET_DATA` to `.env.local` on first run (similar to `scripts/lib/env.ts`)

**What it does:**
```ts
// First run: creates wallet, saves to env
// Subsequent runs: loads from CDP_WALLET_DATA
const agentkit = await AgentKit.from({
  cdpApiKeyName: process.env.CDP_API_KEY_NAME,
  cdpApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
  walletData: process.env.CDP_WALLET_DATA,
  networkId: "base-sepolia",
});
// persist wallet data after creation
```

**Risks:** CDP wallet must be funded with Base Sepolia ETH (gas) and USDC (for payment). User needs a Coinbase Developer Platform account + API key.

---

### Step 3 — ERC-8004 self-registration in agent startup

**What:** The CDP wallet calls `register(agentURI)` on ERC-8004 itself — `msg.sender` is the registrant. This replaces `scripts/register-agent.ts` for the AgentKit agent.

**ERC-8004 address:** `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Base Sepolia, same across chains)

**Touches:** `apps/agent/src/setup.ts` — runs once at agent startup if `AGENT_ID` not already set

```ts
const agentURI = `${process.env.APP_URL}/api/agent/${walletAddress}`
// call register(agentURI) via AgentKit's invokeContract action or viem
// capture returned agentId, persist to env/config
```

**Why AgentKit calls it directly:** ERC-8004 uses `msg.sender` as the registrant. The CDP wallet must be the tx sender, so the facilitator wallet or a script can't do it on its behalf.

**Risks:**
- CDP wallet needs Base Sepolia ETH for gas on this tx. Fund via faucet after Step 2.
- AgentKit's `invokeContract` action should handle this, but may need the ABI passed explicitly. Confirm `ERC8004_ABI` from `@workspace/shared` works here.

---

### Step 4 — Sign AP2 mandate for AgentKit wallet

**What:** Run `sign-mandate.ts` with the AgentKit wallet address as the agent, produce `demo/agentkit-mandate.json`.

**Touches:**
- `scripts/sign-mandate.ts` — needs to accept an address override (currently hardcodes `PAYER_PRIVATE_KEY` derived address)
- `demo/agentkit-mandate.json` (new output)

**Also:** Update `scripts/register-mandate.ts` (new, from facilitator plan) to POST this mandate + agentId to the facilitator.

**Risks:** Small refactor to sign-mandate.ts. The delegator (`DELEGATOR_PRIVATE_KEY`) stays the same.

---

### Step 5 — Build the agent tools

**What:** Define the tools Claude will have access to.

**Touches:** `apps/agent/src/tools.ts`

**Tools:**

#### `x402Fetch` tool
Wraps `fetchWithPayment` from `@x402/fetch`. The agent calls this with a URL; internally it handles the 402 and USDC payment.

```ts
// For Option A: pass agentkit signer as the account
// For Option B: use PAYER_PRIVATE_KEY account
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:84532", client: new ExactEvmScheme(account) }],
});
```

This is a Vercel AI SDK `tool()` with:
- Input: `{ url: string }`
- Executes: fetchWithPayment, parses payment header, returns response body + tx hash

#### AgentKit built-in tools (via `agentKitTools()`)
- `get_wallet_details` — agent can see its address
- `get_balance` — agent can check USDC balance before paying
- Potentially: `transfer` — agent could top up if balance is low (stretch goal)

**Risks (Option A):** If CDP wallet can't sign EIP-712 via the x402 ExactEvmScheme, need a custom adapter. The `ServerWallet.signTypedData()` API exists in AgentKit — need to verify it returns the right signature format for x402.

---

### Step 6 — Build the agent loop

**What:** Main agent file — Claude + tools in a `generateText` loop with `maxSteps`.

**Touches:** `apps/agent/src/agent.ts`

```ts
const result = await generateText({
  model: anthropic("claude-sonnet-4-6"),
  tools: { ...agentKitTools, x402Fetch },
  maxSteps: 5,
  system: `You are a financial agent with a crypto wallet. You have been authorized via an AP2 mandate to spend up to 100 USDC. Use your tools to complete tasks.`,
  prompt: `Fetch a settlement risk report from ${process.env.AGENT_URL}. Check your balance first. After fetching, summarize the risk level and recommendation.`,
});
```

**What happens at runtime:**
1. Agent calls `get_balance` → sees USDC balance
2. Agent calls `x402Fetch` with the URL
3. x402 fetch hits the 402 → pays $0.01 USDC on-chain → returns data + tx hash
4. Agent reads the JSON, summarizes it in natural language
5. Logs: tx hash, Basescan link, agent's summary

**Risks:** Need `maxSteps` ≥ 3 for multi-tool use. Verbose tool output can confuse Claude — system prompt needs to be clear.

---

### Step 7 — Entry point + logging

**What:** `apps/agent/src/index.ts` — clean entry point with pretty console output.

**Touches:**
- `apps/agent/src/index.ts`
- Add `"agent": "bun run src/index.ts"` script to `apps/agent/package.json`
- Optionally add to root `bun dev` if we want it running in the background

**Output format:**
```
[Metal Agent] Wallet: 0xABC...
[Metal Agent] USDC balance: 1.23
[Metal Agent] Fetching report from https://...
[Metal Agent] Paid 0.01 USDC — tx: 0xDEF... (basescan link)
[Metal Agent] Report summary: MEDIUM risk. Recommendation: reduce exposure by 20%...
```

**Risks:** None structural. Polish only.

---

## Sequence Summary

```
1. apps/agent setup (package.json, deps, tsconfig)
2. AgentKit wallet init (create CDP wallet, persist)
3. Register wallet in live ERC-8004 (one-time setup)
4. Sign AP2 mandate for wallet (one-time script, demo/agentkit-mandate.json)
5. Build tools (x402FetchTool + AgentKit built-ins)
6. Build agent loop (Claude + tools via Vercel AI SDK)
7. Entry point + logging
```

Steps 1–4 are setup/wiring (mostly scripts). Steps 5–7 are the actual agent code.

---

## What This Demonstrates

| Before (script) | After (AgentKit agent) |
|---|---|
| Hardcoded `PAYER_PRIVATE_KEY` wallet | CDP-managed wallet (MPC, no raw key) |
| `pay-and-fetch.ts` fires unconditionally | Claude reasons: check balance → decide → pay |
| No explanation of what happened | Agent summarizes the risk report in plain English |
| "Script simulating an agent" | Actual LLM agent autonomous payment |

The Metal compliance stack is identical — identity, mandate, policy, attestation all run the same. The difference is what's driving the payment.

---

## Decisions

1. **Option A** — CDP wallet signs x402. Need thin viem Account adapter delegating to AgentKit signer.
2. **CDP keys** — Sandbox API key available.
3. **USDC funding** — Use Circle's Base Sepolia USDC faucet (https://faucet.circle.com/) once CDP wallet address is known from Step 2.
4. **Interactive REPL** — Agent runs a readline loop; user types tasks, agent executes them with tools.
5. **Build `apps/facilitator` alongside (or first)** — Without it, the x402 route uses `x402.org/facilitator` which skips ALL Metal primitives (no identity check, no mandate verify, no attestation). The agent demo without the facilitator shows "Claude makes x402 payments" but not Metal's compliance stack. See updated step ordering below.

---

## Revised Step Ordering

Since the custom facilitator is what makes this Metal (not just x402), build it in parallel or first:

```
Phase 0 (prerequisite): apps/facilitator — Hono server implementing x402 verify+settle with Metal primitives
Phase 1–7: apps/agent — as planned above, but pointing at the custom facilitator URL
```

The facilitator is an independent app — it can be built in parallel with Steps 1–4 of the agent.
