"use client"

import { useMemo, useState } from "react"

import { AgentsTableBody } from "./agents-table-body"
import { AgentsTablePagination } from "./agents-table-pagination"
import { AgentsTableToolbar } from "./agents-table-controls"
import type {
  AgentsTableRow,
  RegistrationFilter,
  StatusFilter,
} from "./agents-table-types"

const PAGE_SIZE = 6

export type { AgentsTableRow }

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
      <AgentsTableToolbar
        query={query}
        status={status}
        statuses={statuses}
        registration={registration}
        count={filteredAgents.length}
        onQueryChange={updateQuery}
        onStatusChange={updateStatus}
        onRegistrationChange={updateRegistration}
      />

      <section className="metal-card overflow-hidden p-0">
        <AgentsTableBody agents={visibleAgents} />
        <AgentsTablePagination
          start={start}
          pageSize={PAGE_SIZE}
          totalCount={filteredAgents.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </section>
    </>
  )
}
