"use client"

import { cn } from "@workspace/ui/lib/utils"
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

const IDENTITY_STATUS_LABELS: Record<number, string> = {
  1: "Verified",
  2: "Flagged",
}

function Erc8004Detail({ data }: { data: Extract<GateRawData, { gate: "erc8004" }> }) {
  const statusLabel = IDENTITY_STATUS_LABELS[data.identityStatus!] ?? "Not Found"
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
          {"MandatePayload {"}
          {mandate.types.MandatePayload.map((f) => (
            <span key={f.name} className="block pl-4">
              {f.type} {f.name};
            </span>
          ))}
          {"}"}
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
        <a
          href={data.txUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline font-mono"
        >
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
        <a
          href={data.txUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline font-mono"
        >
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
              <p className="text-xs text-muted-foreground">
                {step.label} gate · {step.status}
              </p>
            </SheetHeader>
            <GateContent rawData={step.rawData} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
