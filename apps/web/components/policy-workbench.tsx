"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"

export type PolicyAgent = {
  address: string
  name: string
  maxAmountUsdc: number
  delegatorAddress: string
  expiry: string
  expired: boolean
}

export type PolicyResource = {
  id: string
  label: string
  path: string
  price: number
}

export type PolicyProofRun = {
  failedRule: string
  amount: string
  limit: string
  settlementTx: string
}

type EvaluationResult =
  { pass: true; reason: string } | { pass: false; rule: string; reason: string }

function FieldSelect<T extends string>({
  label,
  value,
  options,
  getLabel = (option) => option,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: readonly T[]
  getLabel?: (option: T) => string
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <label className="grid gap-2">
      <span className="metal-eyebrow">{label}</span>
      <span className="relative block h-10 rounded-sm border border-[var(--field-border)] bg-[var(--field-bg)] text-sm text-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          disabled={disabled}
          className="h-full w-full appearance-none bg-transparent px-4 pr-10 outline-none disabled:opacity-60"
        >
          {options.map((option) => (
            <option
              key={option}
              value={option}
              className="bg-[var(--bg-raised)]"
            >
              {getLabel(option)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  )
}

function PanelHead({
  icon,
  title,
  right,
}: {
  icon: "settings" | "zap"
  title: string
  right?: React.ReactNode
}) {
  const Icon = icon === "settings" ? Settings : Zap

  return (
    <div className="flex h-[62px] items-center gap-3 border-b border-border px-5">
      <Icon className="size-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="ml-auto">{right}</div>
    </div>
  )
}

function RuleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 py-2.5 text-sm text-[var(--text-secondary)]">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      {label}
    </label>
  )
}

function ProofStat({
  label,
  children,
  danger,
}: {
  label: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm font-semibold text-foreground",
          danger && "text-[var(--negative)]"
        )}
      >
        {children}
      </span>
    </div>
  )
}

function PolicyJson({
  maxAmountUsdc,
  requireIdentity,
  requireMandate,
  settleOnPass,
}: {
  maxAmountUsdc: number
  requireIdentity: boolean
  requireMandate: boolean
  settleOnPass: boolean
}) {
  const json = JSON.stringify(
    {
      mode: "strict",
      maxAmountUsdc,
      requireIdentity: requireIdentity ? "ERC-8004" : false,
      requireMandate,
      settleOnPassOnly: settleOnPass,
      attestationRequired: true,
    },
    null,
    2
  )

  return (
    <pre className="mt-2 max-w-[420px] overflow-auto rounded-sm border border-border bg-[var(--bg-inset)] p-4 font-mono text-xs leading-6 text-[var(--text-secondary)]">
      {json}
    </pre>
  )
}

export function PolicyWorkbench({
  agents,
  resources,
  initialMaxAmountUsdc,
  proofRun,
}: {
  agents: PolicyAgent[]
  resources: PolicyResource[]
  initialMaxAmountUsdc: number
  proofRun: PolicyProofRun | null
}) {
  const [maxAmountUsdc, setMaxAmountUsdc] = useState(initialMaxAmountUsdc)
  const [requireIdentity, setRequireIdentity] = useState(true)
  const [requireMandate, setRequireMandate] = useState(true)
  const [settleOnPass, setSettleOnPass] = useState(true)
  const [agentAddress, setAgentAddress] = useState(agents[0]?.address ?? "")
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "")
  const [amount, setAmount] = useState(
    (resources[0]?.price ?? initialMaxAmountUsdc).toFixed(2)
  )
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [showJson, setShowJson] = useState(false)

  const selectedAgent = agents.find((agent) => agent.address === agentAddress)
  const selectedResource = resources.find(
    (resource) => resource.id === resourceId
  )

  const agentOptions = agents.map((agent) => agent.address)
  const resourceOptions = resources.map((resource) => resource.id)

  const activeRules = [
    {
      label: `Max payment <= ${maxAmountUsdc.toFixed(2)} USDC`,
      enabled: true,
    },
    { label: "Agent identity required", enabled: requireIdentity },
    { label: "Valid mandate required", enabled: requireMandate },
    { label: "Settlement only after all checks pass", enabled: settleOnPass },
  ]

  const rangePct = Math.min(100, Math.max(0, (maxAmountUsdc / 25) * 100))

  const canEvaluate = Boolean(selectedAgent)

  const proof = useMemo(() => proofRun, [proofRun])

  function setMax(value: number) {
    setMaxAmountUsdc(Math.max(0.5, Math.min(25, Math.round(value * 2) / 2)))
    setResult(null)
  }

  function evaluate() {
    if (!selectedAgent) return
    const parsedAmount = Number.parseFloat(amount)
    const paymentAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0

    if (requireMandate && selectedAgent.expired) {
      setResult({
        pass: false,
        rule: "requireMandate",
        reason: `Mandate expired ${selectedAgent.expiry}.`,
      })
      return
    }

    if (requireMandate && paymentAmount > selectedAgent.maxAmountUsdc) {
      setResult({
        pass: false,
        rule: "mandateLimit",
        reason: `${paymentAmount.toFixed(2)} USDC exceeds ${selectedAgent.maxAmountUsdc.toFixed(2)} USDC mandate.`,
      })
      return
    }

    if (paymentAmount > maxAmountUsdc) {
      setResult({
        pass: false,
        rule: "maxAmountUsdc",
        reason: `${paymentAmount.toFixed(2)} USDC exceeds ${maxAmountUsdc.toFixed(2)} USDC policy limit.`,
      })
      return
    }

    setResult({
      pass: true,
      reason: "Payment satisfies the configured policy and mandate.",
    })
  }

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="metal-card overflow-hidden p-0">
          <PanelHead
            icon="settings"
            title="Configure policy"
            right={<Badge variant="outline">Facilitator policy</Badge>}
          />
          <div className="grid gap-6 p-5">
            <FieldSelect
              label="Policy profile"
              value="facilitator"
              options={["facilitator"]}
              getLabel={() => "Facilitator policy"}
              onChange={() => undefined}
            />

            <div className="rounded-sm border border-border bg-[var(--bg-inset)] p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <span className="metal-eyebrow">Max transaction amount</span>
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-3xl font-semibold">
                    {maxAmountUsdc.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">USDC</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setMax(maxAmountUsdc - 0.5)}
                >
                  <Minus className="size-4" />
                </Button>
                <input
                  type="range"
                  min="0.5"
                  max="25"
                  step="0.5"
                  value={maxAmountUsdc}
                  onChange={(event) => setMax(Number(event.target.value))}
                  className="policy-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none"
                  style={{
                    background: `linear-gradient(90deg, var(--text-primary) 0%, var(--text-primary) ${rangePct}%, var(--bg-base) ${rangePct}%, var(--bg-base) 100%)`,
                  }}
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setMax(maxAmountUsdc + 0.5)}
                >
                  +
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[1, 2, 5, 10].map((value) => (
                  <button
                    key={value}
                    onClick={() => setMax(value)}
                    className={cn(
                      "rounded-[2px] border border-border py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground",
                      maxAmountUsdc === value &&
                        "border-transparent bg-muted text-foreground"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <RuleRow
                label="Require ERC-8004 identity"
                checked={requireIdentity}
                onCheckedChange={setRequireIdentity}
              />
              <RuleRow
                label="Require AP2 mandate"
                checked={requireMandate}
                onCheckedChange={setRequireMandate}
              />
              <RuleRow
                label="Settle only on pass"
                checked={settleOnPass}
                onCheckedChange={setSettleOnPass}
              />
            </div>

            <div className="border-t border-border pt-5">
              <p className="metal-eyebrow">Active rules</p>
              <div className="mt-3 grid gap-2">
                {activeRules.map((rule) => (
                  <div
                    key={rule.label}
                    className={cn(
                      "flex items-center gap-2 text-sm text-[var(--text-secondary)]",
                      !rule.enabled && "opacity-40"
                    )}
                  >
                    <Check className="size-4 text-[var(--positive)]" />
                    {rule.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="metal-card h-fit overflow-hidden p-0">
          <PanelHead
            icon="zap"
            title="Test payment"
            right={
              <span className="font-mono text-xs text-muted-foreground">
                vs active policy
              </span>
            }
          />
          <div className="grid gap-4 p-5">
            <FieldSelect
              label="Agent"
              value={agentAddress}
              options={agentOptions}
              getLabel={(address) =>
                agents.find((agent) => agent.address === address)?.name ??
                address
              }
              onChange={(value) => {
                setAgentAddress(value)
                setResult(null)
              }}
              disabled={agents.length === 0}
            />
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <FieldSelect
                label="Resource"
                value={resourceId}
                options={resourceOptions}
                getLabel={(id) =>
                  resources.find((resource) => resource.id === id)?.label ?? id
                }
                onChange={(value) => {
                  setResourceId(value)
                  const resource = resources.find((item) => item.id === value)
                  if (resource) setAmount(resource.price.toFixed(2))
                  setResult(null)
                }}
                disabled={resources.length === 0}
              />
              <label className="grid gap-2">
                <span className="metal-eyebrow">Amount</span>
                <span className="flex h-10 items-center gap-2 rounded-sm border border-[var(--field-border)] bg-[var(--field-bg)] px-4 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                  <span className="font-mono text-muted-foreground">$</span>
                  <input
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value)
                      setResult(null)
                    }}
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
                  />
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={evaluate} disabled={!canEvaluate}>
                <Zap className="size-4" />
                Evaluate
              </Button>
              {result && selectedResource ? (
                <Link
                  href="/"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "border-0"
                  )}
                >
                  Run through rail
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Button variant="outline" disabled>
                  Run through rail
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>

            {result ? (
              <div
                className={cn(
                  "rounded-sm border p-5",
                  result.pass
                    ? "border-[color-mix(in_srgb,var(--positive)_45%,transparent)] bg-[var(--positive-surface)] text-[var(--positive)]"
                    : "border-[color-mix(in_srgb,var(--negative)_45%,transparent)] bg-[var(--negative-surface)] text-[var(--negative)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full text-white",
                      result.pass
                        ? "bg-[var(--positive)]"
                        : "bg-[var(--negative)]"
                    )}
                  >
                    {result.pass ? (
                      <Check className="size-5" />
                    ) : (
                      <Minus className="size-5" />
                    )}
                  </span>
                  <div>
                    <p className="text-xl font-bold">
                      {result.pass ? "PASS" : "BLOCKED"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.pass
                        ? "Satisfies active institution policy"
                        : "Refused by active institution policy"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  {!result.pass ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Failed rule</span>
                      <span className="font-mono">{result.rule}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="text-right text-foreground">
                      {result.reason}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
                {agents.length === 0
                  ? "No registered agents with mandates are available yet."
                  : "Evaluate a payment to see whether the rail would settle it."}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="metal-card p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-[260px] flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--positive)]" />
              <h2 className="text-sm font-semibold">Server-side enforcement</h2>
            </div>
            <p className="mt-2 max-w-[430px] text-sm leading-6 text-muted-foreground">
              The most recent blocked run was refused{" "}
              <b className="text-[var(--text-secondary)]">
                before a settlement transaction existed.
              </b>
            </p>
          </div>
          {proof ? (
            <div className="flex flex-wrap items-center gap-7">
              <ProofStat label="Status">
                <Badge variant="destructive">
                  <span className="size-1.5 rounded-full bg-current" />
                  Blocked
                </Badge>
              </ProofStat>
              <ProofStat label="Failed rule" danger>
                {proof.failedRule}
              </ProofStat>
              <ProofStat label="Amount">{proof.amount}</ProofStat>
              <ProofStat label="Limit">{proof.limit}</ProofStat>
              <ProofStat label="Settlement tx">{proof.settlementTx}</ProofStat>
              <Link
                href="/feed"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "border-0"
                )}
              >
                View run
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No blocked attestations recorded yet.
            </p>
          )}
        </div>
      </section>

      <div>
        <button
          onClick={() => setShowJson((value) => !value)}
          className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 font-mono text-sm text-[var(--text-secondary)] transition-colors hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              showJson && "rotate-90"
            )}
          />
          View policy.json
        </button>
        {showJson ? (
          <PolicyJson
            maxAmountUsdc={maxAmountUsdc}
            requireIdentity={requireIdentity}
            requireMandate={requireMandate}
            settleOnPass={settleOnPass}
          />
        ) : null}
      </div>
    </>
  )
}
