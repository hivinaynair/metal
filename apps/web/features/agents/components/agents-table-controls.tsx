"use client"

import { Search } from "lucide-react"

import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { cn } from "@workspace/ui/lib/utils"
import type {
  RegistrationFilter,
  StatusFilter,
} from "./agents-table-types"

function FilterSelect<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(
        "h-10 w-full min-w-40 rounded-sm border border-field-border bg-field px-4 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        className
      )}
    >
      {options.map((option) => (
        <NativeSelectOption key={option} value={option}>
          {option}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function AgentsTableToolbar({
  query,
  status,
  statuses,
  registration,
  count,
  onQueryChange,
  onStatusChange,
  onRegistrationChange,
}: {
  query: string
  status: StatusFilter
  statuses: readonly StatusFilter[]
  registration: RegistrationFilter
  count: number
  onQueryChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
  onRegistrationChange: (value: RegistrationFilter) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex h-10 w-full items-center gap-3 rounded-sm border border-field-border bg-field px-4 text-sm text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:max-w-[280px]">
        <Search className="size-4 shrink-0" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name, wallet, ERC-8004 id..."
          className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-foreground placeholder:text-muted-foreground"
        />
      </label>
      <FilterSelect
        value={status}
        options={statuses}
        onChange={onStatusChange}
        className="sm:max-w-[236px]"
      />
      <FilterSelect
        value={registration}
        options={["All", "Registered", "Unregistered"]}
        onChange={onRegistrationChange}
        className="sm:max-w-[200px]"
      />
      <span className="ml-auto font-mono text-sm text-muted-foreground">
        {count} agent{count === 1 ? "" : "s"}
      </span>
    </div>
  )
}
