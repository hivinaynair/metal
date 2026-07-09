# ERC-8004 On-Chain Trusted Status

## Problem

The agents table shows "Trusted" for all agents by default (when no mandate is set). Trust should be derived from the ERC-8004 on-chain registry, not assumed.

## Definition of Trusted

An agent is on-chain trusted if:
1. `tokenURI(agentId)` returns a non-empty string (agent is registered)
2. `getAgentWallet(agentId)` returns an address that matches the stored wallet address

## Design

### Data flow

At SSR time, `agents/page.tsx` fetches agents from DB then calls `lookupIdentity` (already in `packages/shared/src/identity.ts`) for each agent in parallel via a viem public client on Base Sepolia. The result determines `onChainTrusted: boolean` per agent.

### Status logic

- `onChainTrusted === false` → `"Unregistered"` (short-circuits all other checks)
- `onChainTrusted === true` + `maxAmountUsdc === null` → `"Trusted"`
- `onChainTrusted === true` + expired → `"Expired mandate"`
- `onChainTrusted === true` + amount < policy → `"Mandate capped"`
- `onChainTrusted === true` + amount > policy → `"Policy blocked"`

### Files to change

1. **`apps/web/lib/agents-data.ts`**
   - Add viem `createPublicClient` on Base Sepolia (`https://sepolia.base.org`)
   - Add `getOnChainTrusted(agentId, address)` using `lookupIdentity`
   - `getAgentsWithMandates` returns `onChainTrusted: boolean` per agent (parallel calls)

2. **`apps/web/app/agents/page.tsx`**
   - Use `onChainTrusted` to gate status: false → `"Unregistered"`, true → existing logic

3. **`apps/web/components/agents-table.tsx`**
   - Add `"Unregistered"` to `AgentsTableRow["status"]` union
   - Add badge style for `"Unregistered"` (e.g. muted/gray)

### RPC

Base Sepolia public endpoint: `https://sepolia.base.org` — no API key required.
All agent lookups run in `Promise.all` (currently 4 agents).
