"use client"

import { Check, Minus, Plus, Save } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"
import { PanelHead } from "./policy-workbench-shared"

const STATIC_RULES = ["ERC-8004 identity required", "AP2 mandate required"]

export function PolicyConfigPanel({
  maxAmountUsdc,
  isPending,
  saved,
  onSetMax,
  onSavePolicy,
}: {
  maxAmountUsdc: number
  isPending: boolean
  saved: boolean
  onSetMax: (value: number) => void
  onSavePolicy: () => void
}) {
  return (
    <div className="metal-card overflow-hidden p-0">
      <PanelHead
        icon="settings"
        title="Configure policy"
        right={<Badge variant="outline">Facilitator policy</Badge>}
      />
      <div className="grid gap-6 p-5">
        <div className="rounded-sm border border-border bg-surface-inset p-5">
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
              onClick={() => onSetMax(maxAmountUsdc - 0.1)}
            >
              <Minus className="size-4" />
            </Button>
            <Slider
              min={0.1}
              max={25}
              step={0.1}
              value={[maxAmountUsdc]}
              onValueChange={(values) => {
                const v = Array.isArray(values) ? values[0] : values
                if (v !== undefined) onSetMax(v)
              }}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onSetMax(maxAmountUsdc + 0.1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {[0.3, 1, 2, 5, 10].map((value) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => onSetMax(value)}
                className={cn(
                  "h-auto rounded-[2px] py-2 font-mono text-xs text-muted-foreground",
                  maxAmountUsdc === value &&
                    "border-transparent bg-muted text-foreground"
                )}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <p className="metal-eyebrow">Active rules</p>
          <div className="mt-3 grid gap-2">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Check className="size-4 text-positive" />
              {`Max payment <= ${maxAmountUsdc.toFixed(2)} USDC`}
            </div>
            {STATIC_RULES.map((rule) => (
              <div
                key={rule}
                className="flex items-center gap-2 text-sm text-text-secondary"
              >
                <Check className="size-4 text-positive" />
                {rule}
              </div>
            ))}
          </div>
          <Button
            onClick={onSavePolicy}
            disabled={isPending}
            className="mt-5 w-full"
          >
            <Save className="size-4" />
            {saved ? "Saved" : isPending ? "Saving..." : "Save policy"}
          </Button>
        </div>
      </div>
    </div>
  )
}
