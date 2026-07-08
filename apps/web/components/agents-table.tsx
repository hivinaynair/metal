"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { cn } from "@workspace/ui/lib/utils"

const PAGE_SIZE = 6

export type AgentsTableRow = {
  address: string
  name: string
  agentId: string
  erc8004: string
  delegatorAddress: string
  maxAmountUsdc: string
  expiry: string
  status: "Trusted" | "Mandate capped" | "Policy blocked" | "Expired mandate"
  registered: boolean
}

type StatusFilter = "All statuses" | AgentsTableRow["status"]
type RegistrationFilter = "All" | "Registered" | "Unregistered"

const statusStyles: Record<AgentsTableRow["status"], string> = {
  Trusted: "bg-positive-surface text-positive",
  "Mandate capped": "bg-warning-surface text-warning",
  "Policy blocked": "bg-negative-surface text-negative",
  "Expired mandate": "bg-warning-surface text-warning",
}

function shortAddress(address: string) {
  if (!address.startsWith("0x") || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function StatusPill({ status }: { status: AgentsTableRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-[2px] px-2.5 py-1 text-xs font-semibold",
        statusStyles[status]
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

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

function AgentIcon({ agent }: { agent: AgentsTableRow }) {
  const warning =
    agent.status === "Policy blocked" || agent.status === "Expired mandate"

  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-[2px] bg-muted text-muted-foreground",
        warning && "text-negative"
      )}
    >
      {warning ? (
        <AlertTriangle className="size-4" />
      ) : (
        <Bot className="size-4" />
      )}
    </span>
  )
}

function matchesRegistration(
  agent: AgentsTableRow,
  filter: RegistrationFilter
) {
  if (filter === "Registered") return agent.registered
  if (filter === "Unregistered") return !agent.registered
  return true
}

export function AgentsTable({ agents }: { agents: AgentsTableRow[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("All statuses")
  const [registration, setRegistration] = useState<RegistrationFilter>("All")
  const [page, setPage] = useState(1)

  const statuses = useMemo(
    () =>
      [
        "All statuses",
        ...Array.from(new Set(agents.map((agent) => agent.status))),
      ] as StatusFilter[],
    [agents]
  )

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase()

    return agents.filter((agent) => {
      const matchesQuery =
        q.length === 0 ||
        [
          agent.name,
          agent.agentId,
          agent.address,
          agent.erc8004,
          agent.delegatorAddress,
          agent.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      const matchesStatus = status === "All statuses" || agent.status === status

      return (
        matchesQuery &&
        matchesStatus &&
        matchesRegistration(agent, registration)
      )
    })
  }, [agents, query, status, registration])

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const visibleAgents = filteredAgents.slice(start, start + PAGE_SIZE)

  function updateQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function updateStatus(value: StatusFilter) {
    setStatus(value)
    setPage(1)
  }

  function updateRegistration(value: RegistrationFilter) {
    setRegistration(value)
    setPage(1)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 w-full items-center gap-3 rounded-sm border border-field-border bg-field px-4 text-sm text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:max-w-[280px]">
          <Search className="size-4 shrink-0" />
          <Input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search name, wallet, ERC-8004 id..."
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <FilterSelect
          value={status}
          options={statuses}
          onChange={updateStatus}
          className="sm:max-w-[236px]"
        />
        <FilterSelect
          value={registration}
          options={["All", "Registered", "Unregistered"]}
          onChange={updateRegistration}
          className="sm:max-w-[200px]"
        />
        <span className="ml-auto font-mono text-sm text-muted-foreground">
          {filteredAgents.length} agent
          {filteredAgents.length === 1 ? "" : "s"}
        </span>
      </div>

      <section className="metal-card overflow-hidden p-0">
        <div className="overflow-x-auto px-3 pt-1">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                <th className="px-3 py-4">Agent</th>
                <th className="px-3 py-4">Wallet</th>
                <th className="px-3 py-4">ERC-8004</th>
                <th className="px-3 py-4">Delegator</th>
                <th className="px-3 py-4 text-right">Mandate</th>
                <th className="px-3 py-4">Expiry</th>
                <th className="px-3 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleAgents.map((agent) => (
                <tr
                  key={agent.address}
                  className="border-b border-border text-sm transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <AgentIcon agent={agent} />
                      <span>
                        <span className="block font-semibold text-foreground">
                          {agent.name}
                        </span>
                        <span className="mt-1 block font-mono text-xs text-muted-foreground">
                          #{agent.agentId}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 font-mono text-muted-foreground">
                    {shortAddress(agent.address)}
                  </td>
                  <td className="px-3 py-4 font-mono text-muted-foreground">
                    {agent.erc8004}
                  </td>
                  <td className="px-3 py-4 font-mono text-muted-foreground">
                    {shortAddress(agent.delegatorAddress)}
                  </td>
                  <td className="px-3 py-4 text-right font-mono text-foreground">
                    {agent.maxAmountUsdc}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-4 font-mono text-muted-foreground",
                      agent.status === "Expired mandate" &&
                        "text-negative"
                    )}
                  >
                    {agent.expiry}
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill status={agent.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleAgents.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
              No agents match your filters.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground">
          {filteredAgents.length > 0 ? (
            <span>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {start + 1}-{Math.min(start + PAGE_SIZE, filteredAgents.length)}
              </span>{" "}
              of {filteredAgents.length}
            </span>
          ) : (
            <span>Showing 0 of 0</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              className="gap-2 text-muted-foreground"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={pageNumber === currentPage ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "min-w-10 px-3 font-mono",
                    pageNumber === currentPage
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              className="gap-2 text-foreground"
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
