"use client"

import { Button } from "@workspace/ui/components/button"
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
          <Button
            key={scenario.slot}
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => onSelect(index)}
            className={cn(
              "justify-start gap-2 rounded-sm text-left",
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
          </Button>
        )
      })}
    </div>
  )
}
