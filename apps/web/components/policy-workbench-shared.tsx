"use client"

import { Settings, Zap } from "lucide-react"

import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { cn } from "@workspace/ui/lib/utils"

export function FieldSelect<T extends string>({
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
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        disabled={disabled}
        className="h-10 w-full rounded-sm border border-field-border bg-field px-4 transition-colors focus-within:border-ring focus-within:ring-ring/20 focus-within:ring-2"
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {getLabel(option)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  )
}

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

export { cn }
