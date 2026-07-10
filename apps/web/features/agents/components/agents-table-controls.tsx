"use client"

import { Search } from "lucide-react"

import { Input } from "@workspace/ui/components/input"

export function AgentsTableToolbar({
  query,
  count,
  onQueryChange,
}: {
  query: string
  count: number
  onQueryChange: (value: string) => void
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
      <span className="ml-auto font-mono text-sm text-muted-foreground">
        {count} agent{count === 1 ? "" : "s"}
      </span>
    </div>
  )
}
