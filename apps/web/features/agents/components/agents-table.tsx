"use client"

import { useMemo, useState } from "react"

import { AgentsTableBody } from "./agents-table-body"
import { AgentsTableToolbar } from "./agents-table-controls"
import type { AgentsTableRow } from "./agents-table-types"

export type { AgentsTableRow }

export function AgentsTable({ agents }: { agents: AgentsTableRow[] }) {
  const [query, setQuery] = useState("")

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

      return matchesQuery
    })
  }, [agents, query])

  return (
    <>
      <AgentsTableToolbar
        query={query}
        count={filteredAgents.length}
        onQueryChange={setQuery}
      />

      <section className="metal-card overflow-hidden p-0">
        <AgentsTableBody agents={filteredAgents} />
      </section>
    </>
  )
}
