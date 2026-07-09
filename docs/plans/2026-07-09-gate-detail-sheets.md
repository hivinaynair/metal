# Gate Detail Sheets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make each gate in the trace panel clickable, opening a sheet that exposes the raw cryptographic artifact used at that gate (EIP-712 mandate, x402 challenge, ERC-8004 identity, policy rule, settlement tx).

**Architecture:** Pipe raw artifacts from the agent server into the SSE "done" event, forward through the web trigger-payment route, thread into `TraceStep.rawData`, and render gate-specific structured views in a new `GateDetailSheet` component.

**Tech Stack:** Hono (agent server), Next.js SSE route, React, shadcn/ui Sheet, Tailwind.

---

## Task 1: Add `RawMandate` type + extend shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

The agent already has `credential.entry` (a `MandateHeaderValue`) in scope when building the "done" event. We just need a serializable type to put it in the SSE payload.

**Step 1: Add types to `packages/shared/src/types.ts`**

Append at the bottom of the file:

```typescript
export interface RawMandate {
  agentId: string
  domain: { name: string; version: string; chainId: number }
  types: { MandatePayload: Array<{ name: string; type: string }> }
  payload: {
    agent: string
    delegator: string
    maxAmountUsdc: string
    expiry: string
    nonce: string
  }
  signature: string
}

export interface X402Challenge {
  scheme?: string
  network?: string
  maxAmountRequired?: string
  resource?: string
  description?: string
  error?: string
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: RawMandate and X402Challenge types"
```

---

## Task 2: Capture x402 challenge in `tools.ts`

**Files:**
- Modify: `apps/agent/src/tools.ts`

The `observingFetch` wrapper already intercepts each fetch call. When the x402 library gets a 402, it calls `observingFetch` and gets back the 402 response. We can read the `PAYMENT-REQUIRED` header from that response before returning it.

**Step 1: Add `x402Challenge` capture to `performX402Fetch`**

In `apps/agent/src/tools.ts`, update `X402FetchResult` and `performX402Fetch`:

```typescript
import type { X402Challenge } from "@workspace/shared/types"

export interface X402FetchResult {
  httpStatus: number
  body: unknown
  txHash?: string
  authorizationNonce?: string
  paymentRequiredError?: string
  basescan?: string
  x402Challenge?: X402Challenge
}

export async function performX402Fetch(
  cdpAccount: EvmServerAccount,
  url: string,
  opts?: { mandateHeader?: string },
): Promise<X402FetchResult> {
  let authorizationNonce: string | undefined
  let x402Challenge: X402Challenge | undefined

  const observingFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const paymentSignature = request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT")
    if (paymentSignature) {
      try {
        authorizationNonce = extractAuthorizationNonce(decodePaymentSignatureHeader(paymentSignature))
      } catch {
        authorizationNonce = undefined
      }
    }
    const response = await fetch(request)
    // Capture the x402 payment requirement from the initial 402 challenge
    if (response.status === 402 && !x402Challenge) {
      const header = response.headers.get("PAYMENT-REQUIRED") ?? response.headers.get("X-PAYMENT-REQUIRED")
      if (header) {
        try {
          const decoded = decodePaymentRequiredHeader(header) as Record<string, unknown>
          x402Challenge = {
            scheme: decoded.scheme as string | undefined,
            network: decoded.network as string | undefined,
            maxAmountRequired: decoded.maxAmountRequired as string | undefined,
            resource: decoded.resource as string | undefined,
            description: decoded.description as string | undefined,
          }
        } catch { /* ignore decode errors */ }
      }
    }
    return response
  }

  // ... rest of function unchanged, add x402Challenge to return:
  return {
    httpStatus: response.status,
    body,
    txHash,
    authorizationNonce,
    paymentRequiredError,
    basescan: txHash ? `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}` : undefined,
    x402Challenge,
  }
}
```

Note: The `observingFetch` must clone the response if the body is needed by both the interceptor and the x402 library. Headers-only access (used here) does NOT consume the response body, so no cloning needed.

**Step 2: Commit**

```bash
git add apps/agent/src/tools.ts
git commit -m "feat: capture x402 challenge from 402 response"
```

---

## Task 3: Add raw mandate + x402 challenge to SSE "done" event

**Files:**
- Modify: `apps/agent/src/server.ts`

`credential` is already in scope (line 130) and holds the full `MandateHeaderValue` including the EIP-712 payload and signature. We just serialize it into the done event.

**Step 1: Add imports to `server.ts`**

```typescript
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES } from "@workspace/shared/mandate"
import type { RawMandate } from "@workspace/shared/types"
```

**Step 2: Build `rawMandate` from credential before the stream**

After line 133 (`if (!credential) { ... }`), add:

```typescript
const rawMandate: RawMandate = {
  agentId: credential.entry.agentId.toString(),
  domain: {
    name: MANDATE_EIP712_DOMAIN.name,
    version: MANDATE_EIP712_DOMAIN.version,
    chainId: Number(MANDATE_EIP712_DOMAIN.chainId),
  },
  types: {
    MandatePayload: MANDATE_EIP712_TYPES.MandatePayload.map((f) => ({
      name: f.name,
      type: f.type,
    })),
  },
  payload: {
    agent: credential.entry.mandate.payload.agent,
    delegator: credential.entry.mandate.payload.delegator,
    maxAmountUsdc: credential.entry.mandate.payload.maxAmountUsdc.toString(),
    expiry: credential.entry.mandate.payload.expiry.toString(),
    nonce: credential.entry.mandate.payload.nonce.toString(),
  },
  signature: credential.entry.mandate.signature,
}
```

**Step 3: Thread into performX402Fetch call and done event**

The `performX402Fetch` call already returns `r`. Destructure `x402Challenge` from it:

```typescript
const r = await performX402Fetch(account, targetUrl, {
  mandateHeader: credential.header,
})
authorizationNonce = r.authorizationNonce
settlementTxHash = r.txHash
httpStatus = r.httpStatus
responseError = r.paymentRequiredError ?? errorFromBody(r.body)
// add:
const x402Challenge = r.x402Challenge
```

In the `send({ type: "done", result: { ... } })` block, add:

```typescript
rawMandate,
x402Challenge,
```

**Step 4: Commit**

```bash
git add apps/agent/src/server.ts
git commit -m "feat: include raw mandate and x402 challenge in done event"
```

---

## Task 4: Forward new fields through web trigger-payment route

**Files:**
- Modify: `apps/web/app/api/trigger-payment/route.ts`
- Modify: `apps/web/lib/payment-demo.ts` (TriggerResult type)

The trigger-payment route pipes SSE events from the agent server to the browser. It enriches the "done" event — we need to pass `rawMandate` and `x402Challenge` through.

**Step 1: Update `TriggerResult` in `apps/web/lib/payment-demo.ts`**

Add to the `TriggerResult` interface (find the existing type definition and add):

```typescript
import type { RawMandate, X402Challenge } from "@workspace/shared/types"

// In TriggerResult:
rawMandate?: RawMandate
x402Challenge?: X402Challenge
```

**Step 2: Forward in `apps/web/app/api/trigger-payment/route.ts`**

In the section that builds the enriched "done" result (find where `decisionProof`, `settlementTxHash` etc. are spread), add:

```typescript
rawMandate: agentResult.rawMandate,
x402Challenge: agentResult.x402Challenge,
```

Where `agentResult` is the parsed result from the agent's "done" event. Check the exact variable name in the file — it may be `parsed.result` or similar.

**Step 3: Commit**

```bash
git add apps/web/app/api/trigger-payment/route.ts apps/web/lib/payment-demo.ts
git commit -m "feat: forward rawMandate and x402Challenge through trigger-payment route"
```

---

## Task 5: Add `rawData` to `TraceStep` and make rows clickable

**Files:**
- Modify: `apps/web/components/trace-panel.tsx`

**Step 1: Define `GateRawData` union type and update `TraceStep`**

At the top of `trace-panel.tsx` (after existing imports), add:

```typescript
import type { RawMandate, X402Challenge } from "@workspace/shared/types"

export type GateRawData =
  | { gate: "agent"; address: string; uri: string; capabilities: string[] }
  | { gate: "x402"; challenge: X402Challenge }
  | { gate: "erc8004"; address: string; agentId?: string; identityStatus?: number }
  | { gate: "ap2"; mandate: RawMandate }
  | { gate: "policy"; ceiling: string; payment: string; decision: string }
  | { gate: "settlement"; txHash: string; txUrl: string }
  | { gate: "attestation"; txHash: string; txUrl: string }
```

Add `rawData?: GateRawData` to the `TraceStep` interface.

**Step 2: Add `onStepClick` to `TracePanelProps` and make rows clickable**

```typescript
interface TracePanelProps {
  steps: TraceStep[]
  onStepClick?: (step: TraceStep) => void
}
```

In the step row div, add a click handler when rawData is present:

```tsx
<div
  key={step.id}
  className={cn(
    "flex gap-3",
    step.rawData && "cursor-pointer group"
  )}
  onClick={() => step.rawData && onStepClick?.(step)}
>
```

Add a subtle "view" affordance next to the label when rawData is present (only shows on hover):

```tsx
{step.rawData && (
  <span className="text-xs text-muted-foreground/50 group-hover:text-primary transition-colors">
    view ↗
  </span>
)}
```

**Step 3: Commit**

```bash
git add apps/web/components/trace-panel.tsx
git commit -m "feat: TraceStep rawData and clickable rows"
```

---

## Task 6: Create `GateDetailSheet` component

**Files:**
- Create: `apps/web/components/gate-detail-sheet.tsx`

This component uses the existing `Sheet` from `@workspace/ui/components/sheet`. It renders gate-specific structured views — NOT raw JSON dumps.

**Step 1: Create the file**

```tsx
"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Badge } from "@workspace/ui/components/badge"
import type { TraceStep, GateRawData } from "@/components/trace-panel"

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn("text-xs break-all", mono && "font-mono text-foreground/80")}>
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

function AgentDetail({ data }: { data: Extract<GateRawData, { gate: "agent" }> }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Identity">
        <Row label="Address" value={data.address} mono />
        <Row label="Metadata URI" value={data.uri} mono />
      </Section>
      <Section title="Capabilities">
        <div className="flex gap-2 flex-wrap">
          {data.capabilities.map((c) => (
            <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
          ))}
        </div>
      </Section>
    </div>
  )
}

function X402Detail({ data }: { data: Extract<GateRawData, { gate: "x402" }> }) {
  const c = data.challenge
  return (
    <div className="flex flex-col gap-4">
      <Section title="402 Payment Required">
        {c.scheme && <Row label="Scheme" value={c.scheme} mono />}
        {c.network && <Row label="Network" value={c.network} mono />}
        {c.maxAmountRequired && <Row label="Max Amount (raw)" value={c.maxAmountRequired} mono />}
        {c.resource && <Row label="Resource" value={c.resource} mono />}
        {c.description && <Row label="Description" value={c.description} />}
      </Section>
    </div>
  )
}

function Erc8004Detail({ data }: { data: Extract<GateRawData, { gate: "erc8004" }> }) {
  const statusLabel = data.identityStatus === 1 ? "Verified" : data.identityStatus === 2 ? "Flagged" : "Not Found"
  return (
    <div className="flex flex-col gap-4">
      <Section title="Identity Registry Lookup">
        <Row label="Agent Address" value={data.address} mono />
        {data.agentId && <Row label="Agent ID" value={data.agentId} mono />}
        <Row label="Identity Status" value={statusLabel} />
      </Section>
    </div>
  )
}

function Ap2Detail({ data }: { data: Extract<GateRawData, { gate: "ap2" }> }) {
  const { mandate } = data
  const expiryDate = new Date(Number(mandate.payload.expiry) * 1000).toISOString()
  return (
    <div className="flex flex-col gap-6">
      <Section title="EIP-712 Domain">
        <Row label="Name" value={mandate.domain.name} mono />
        <Row label="Version" value={mandate.domain.version} mono />
        <Row label="Chain ID" value={String(mandate.domain.chainId)} mono />
      </Section>
      <Section title="Struct Types">
        <div className="font-mono text-xs text-foreground/80 bg-muted/30 rounded p-3 leading-6">
          MandatePayload &#123;<br />
          {mandate.types.MandatePayload.map((f) => (
            <span key={f.name} className="block pl-4">
              {f.type} {f.name};
            </span>
          ))}
          &#125;
        </div>
      </Section>
      <Section title="Payload">
        <Row label="Agent" value={mandate.payload.agent} mono />
        <Row label="Delegator" value={mandate.payload.delegator} mono />
        <Row label="Max Amount (USDC units)" value={mandate.payload.maxAmountUsdc} mono />
        <Row label="Expiry" value={`${mandate.payload.expiry} · ${expiryDate}`} mono />
        <Row label="Nonce" value={mandate.payload.nonce} mono />
      </Section>
      <Section title="Signature">
        <Row label="sig" value={mandate.signature} mono />
      </Section>
    </div>
  )
}

function PolicyDetail({ data }: { data: Extract<GateRawData, { gate: "policy" }> }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Policy Evaluation">
        <Row label="Ceiling" value={data.ceiling} mono />
        <Row label="Payment" value={data.payment} mono />
        <Row label="Decision" value={data.decision} />
      </Section>
    </div>
  )
}

function SettlementDetail({ data }: { data: Extract<GateRawData, { gate: "settlement" }> }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="USDC Settlement">
        <Row label="Tx Hash" value={data.txHash} mono />
        <a href={data.txUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline font-mono">
          view on Basescan ↗
        </a>
      </Section>
    </div>
  )
}

function AttestationDetail({ data }: { data: Extract<GateRawData, { gate: "attestation" }> }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="On-chain Attestation">
        <Row label="Tx Hash" value={data.txHash} mono />
        <a href={data.txUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline font-mono">
          view on Basescan ↗
        </a>
      </Section>
    </div>
  )
}

function GateContent({ rawData }: { rawData: GateRawData }) {
  switch (rawData.gate) {
    case "agent": return <AgentDetail data={rawData} />
    case "x402": return <X402Detail data={rawData} />
    case "erc8004": return <Erc8004Detail data={rawData} />
    case "ap2": return <Ap2Detail data={rawData} />
    case "policy": return <PolicyDetail data={rawData} />
    case "settlement": return <SettlementDetail data={rawData} />
    case "attestation": return <AttestationDetail data={rawData} />
  }
}

const GATE_TITLES: Record<GateRawData["gate"], string> = {
  agent: "Agent Identity",
  x402: "x402 Challenge",
  erc8004: "ERC-8004 Identity",
  ap2: "AP2 Mandate",
  policy: "Policy Evaluation",
  settlement: "Settlement",
  attestation: "Attestation",
}

interface GateDetailSheetProps {
  step: TraceStep | null
  onClose: () => void
}

export function GateDetailSheet({ step, onClose }: GateDetailSheetProps) {
  return (
    <Sheet open={!!step?.rawData} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-md">
        {step?.rawData && (
          <>
            <SheetHeader className="mb-6 p-0 pr-14">
              <SheetTitle>{GATE_TITLES[step.rawData.gate]}</SheetTitle>
              <p className="text-xs text-muted-foreground">{step.label} gate · {step.status}</p>
            </SheetHeader>
            <GateContent rawData={step.rawData} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

Note: add `import { cn } from "@workspace/ui/lib/utils"` at the top.

**Step 2: Commit**

```bash
git add apps/web/components/gate-detail-sheet.tsx
git commit -m "feat: GateDetailSheet component"
```

---

## Task 7: Thread rawData into `buildTraceSteps` and wire up `page.tsx`

**Files:**
- Modify: `apps/web/components/trace-panel.tsx` (`buildTraceSteps`)
- Modify: `apps/web/app/page.tsx`

**Step 1: Update `buildTraceSteps` signature and populate `rawData`**

The function signature gains the new result fields:

```typescript
export function buildTraceSteps(result: {
  // ... existing fields ...
  payer?: string
  agentUri?: string
  rawMandate?: RawMandate
  x402Challenge?: X402Challenge
  decisionProof?: {
    mandate?: { delegator: string; maxAmountUsdc: string }
    policy?: { maxAmountUsdc: string; decision: string }
    identityStatus?: number
  }
} | null, animStep: number): TraceStep[]
```

Then populate `rawData` on each step. Example for key gates:

```typescript
// Gate 0 (Agent)
{
  id: 0,
  label: "Agent",
  status: "approved",
  detail: result.agent?.id,
  rawData: result.payer ? {
    gate: "agent",
    address: result.payer,
    uri: result.agentUri ?? "",
    capabilities: ["payment", "settlement"],
  } : undefined,
},

// Gate 1 (x402)
{
  id: 1,
  label: "402",
  status: stepStatus(1),
  detail: `${result.route.path} · ${result.route.price}`,
  rawData: result.x402Challenge ? {
    gate: "x402",
    challenge: result.x402Challenge,
  } : undefined,
},

// Gate 2 (ERC-8004)
{
  id: 2,
  label: "ERC-8004",
  status: stepStatus(2),
  detail: ...,
  rawData: result.payer ? {
    gate: "erc8004",
    address: result.payer,
    agentId: result.decisionProof?.agentId,
    identityStatus: result.decisionProof?.identityStatus,
  } : undefined,
},

// Gate 3 (AP2)
{
  id: 3,
  label: "AP2",
  status: stepStatus(3),
  detail: result.agent ? `limit ${result.agent.mandateLimit}` : undefined,
  rawData: result.rawMandate ? {
    gate: "ap2",
    mandate: result.rawMandate,
  } : undefined,
},

// Gate 4 (Policy)
{
  id: 4,
  label: "Policy",
  status: stepStatus(4),
  detail: `ceiling $${POLICY_MAX_AMOUNT_USDC} · payment ${result.route.price}`,
  rawData: {
    gate: "policy",
    ceiling: `$${POLICY_MAX_AMOUNT_USDC}`,
    payment: result.route.price,
    decision: stepStatus(4) === "approved" ? "approved" : "rejected",
  },
},

// Gate 5 (Settlement) — only when tx exists
rawData: result.settlementTxHash ? {
  gate: "settlement",
  txHash: result.settlementTxHash,
  txUrl: result.settlementTxUrl ?? `${BASE_SEPOLIA_EXPLORER}/tx/${result.settlementTxHash}`,
} : undefined,

// Gate 6 (Attestation) — only when tx exists
rawData: result.attestationTxHash ? {
  gate: "attestation",
  txHash: result.attestationTxHash,
  txUrl: result.attestationTxUrl ?? `${BASE_SEPOLIA_EXPLORER}/tx/${result.attestationTxHash}`,
} : undefined,
```

**Step 2: Wire up in `page.tsx`**

Add sheet state:
```typescript
const [activeGateStep, setActiveGateStep] = useState<TraceStep | null>(null)
```

Pass to `TracePanel` and add `GateDetailSheet`:
```tsx
<TracePanel
  steps={traceSteps}
  onStepClick={setActiveGateStep}
/>
<GateDetailSheet
  step={activeGateStep}
  onClose={() => setActiveGateStep(null)}
/>
```

Import `GateDetailSheet` and `TraceStep` type.

**Step 3: Commit**

```bash
git add apps/web/components/trace-panel.tsx apps/web/app/page.tsx
git commit -m "feat: wire gate detail sheets into trace panel"
```

---

## Verification

Manual test checklist after all tasks:

1. Run `pnpm dev` from repo root
2. Select "Happy path" scenario, click "Run payment"
3. After run completes, click each gate — confirm sheet opens with gate-specific data
4. **AP2 gate**: confirm EIP-712 domain shows `"AP2Mandate"`, struct types render correctly, all payload fields visible, signature present
5. **x402 gate**: confirm challenge shows scheme/network/maxAmountRequired
6. **Settlement + Attestation gates**: confirm Basescan links open correctly
7. Run "Unregistered agent" scenario — ERC-8004 gate should show rejected with `identityStatus: 0`
8. Run "Mandate exceeded" — AP2 gate should still show the mandate (data present even on reject)
