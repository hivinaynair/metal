"use client"

import { Settings, Zap } from "lucide-react"

export function PanelHead({
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

export function PolicyJson({ maxAmountUsdc }: { maxAmountUsdc: number }) {
  const json = JSON.stringify(
    {
      mode: "strict",
      maxAmountUsdc,
      requireIdentity: "ERC-8004",
      requireMandate: "AP2",
      attestationRequired: true,
    },
    null,
    2
  )

  return (
    <pre className="mt-2 max-w-[420px] overflow-auto rounded-sm border border-border bg-surface-inset p-4 font-mono text-xs leading-6 text-text-secondary">
      {json}
    </pre>
  )
}
