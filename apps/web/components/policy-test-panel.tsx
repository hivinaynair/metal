"use client"

import Link from "next/link"
import { ArrowRight, Check, Minus, Zap } from "lucide-react"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FieldSelect, PanelHead, cn } from "@/components/policy-workbench-shared"
import type {
  EvaluationResult,
  PolicyAgent,
  PolicyResource,
} from "@/lib/policy-evaluation"

function EvaluationResultCard({ result }: { result: EvaluationResult }) {
  return (
    <div
      className={cn(
        "rounded-sm border p-5",
        result.pass
          ? "border-positive/45 bg-positive-surface text-positive"
          : "border-negative/45 bg-negative-surface text-negative"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full text-white",
            result.pass ? "bg-positive" : "bg-negative"
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
          <span className="text-right text-foreground">{result.reason}</span>
        </div>
      </div>
    </div>
  )
}

export function PolicyTestPanel({
  agents,
  resources,
  selectedAgent,
  selectedResource,
  agentAddress,
  resourceId,
  amount,
  result,
  railScenarioIndex,
  onAgentChange,
  onResourceChange,
  onAmountChange,
  onEvaluate,
}: {
  agents: PolicyAgent[]
  resources: PolicyResource[]
  selectedAgent?: PolicyAgent
  selectedResource?: PolicyResource
  agentAddress: string
  resourceId: string
  amount: string
  result: EvaluationResult | null
  railScenarioIndex: number
  onAgentChange: (value: string) => void
  onResourceChange: (value: string) => void
  onAmountChange: (value: string) => void
  onEvaluate: () => void
}) {
  const agentOptions = agents.map((agent) => agent.address)
  const resourceOptions = resources.map((resource) => resource.id)

  return (
    <div className="metal-card overflow-hidden p-0">
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
            agents.find((agent) => agent.address === address)?.name ?? address
          }
          onChange={onAgentChange}
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
            onChange={onResourceChange}
            disabled={resources.length === 0}
          />
          <label className="grid gap-2">
            <span className="metal-eyebrow">Amount</span>
            <span className="flex h-10 items-center gap-2 rounded-sm border border-field-border bg-field px-4 focus-within:border-ring focus-within:ring-ring/20 focus-within:ring-2">
              <span className="font-mono text-muted-foreground">$</span>
              <Input
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
                className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm"
              />
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onEvaluate} disabled={!selectedAgent}>
            <Zap className="size-4" />
            Evaluate
          </Button>
          {result && selectedResource ? (
            <Link
              href={`/?scenario=${railScenarioIndex}`}
              className={cn(buttonVariants({ variant: "outline" }), "border-0")}
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
          <EvaluationResultCard result={result} />
        ) : (
          <div className="rounded-sm border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
            {agents.length === 0
              ? "No registered agents with mandates are available yet."
              : "Evaluate a payment to see whether the rail would settle it."}
          </div>
        )}
      </div>
    </div>
  )
}
