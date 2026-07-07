"use client"

import { cn } from "@workspace/ui/lib/utils"
import { demoAgents } from "@/lib/demo-scenarios"
import { SCENARIOS } from "@/lib/payment-demo"

export function ScenarioPicker({
  selectedIndex,
  loading,
  onSelect,
}: {
  selectedIndex: number
  loading: boolean
  onSelect: (index: number) => void
}) {
  return (
    <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1">
      <span className="metal-eyebrow px-2">Scenario</span>
      {SCENARIOS.map((scenario, index) => {
        const agent = demoAgents.find((a) => a.id === scenario.agentId)!
        const selected = index === selectedIndex
        return (
          <button
            key={scenario.slot}
            disabled={loading}
            onClick={() => onSelect(index)}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium transition",
              selected
                ? "bg-muted text-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground",
              loading && "cursor-not-allowed opacity-55"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full bg-muted-foreground",
                selected && agent.status === "approved" && "bg-emerald-400",
                selected && agent.status !== "approved" && "bg-destructive"
              )}
            />
            {scenario.title}
          </button>
        )
      })}
    </div>
  )
}
