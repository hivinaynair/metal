import type { ReactNode } from "react"

import { ScrollArea } from "@workspace/ui/components/scroll-area"

export function DashboardPanel({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="metal-card flex h-[420px] min-w-0 flex-col rounded-md p-0">
      <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">{children}</div>
      </ScrollArea>
    </section>
  )
}
