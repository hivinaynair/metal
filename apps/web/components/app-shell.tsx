"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bot, Settings, Zap } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

const nav = [
  { href: "/", label: "Demo", sub: "The live rail", icon: Zap },
  { href: "/feed", label: "Feed", sub: "Flight recorder", icon: Activity },
  {
    href: "/policy",
    label: "Policy",
    sub: "Programmable controls",
    icon: Settings,
  },
  { href: "/agents", label: "Agents", sub: "Identity + mandates", icon: Bot },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="dark flex min-h-svh bg-background text-foreground">
      <aside className="sticky top-0 hidden h-svh w-[244px] shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5 border-0">
            <Image
              src="/logo-mark-light.svg"
              alt="Metal"
              width={28}
              height={28}
              className="size-7"
              priority
            />
            <span className="font-serif text-[21px] tracking-tight">Metal</span>
          </Link>
          <p className="mt-3.5 font-serif text-[15px] leading-tight text-text-secondary">
            Compliance before
            <br />
            settlement, not after.
          </p>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-[11px] rounded-sm border-0 px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-text-tertiary hover:bg-sidebar-accent/60 hover:text-text-secondary"
                )}
              >
                <Icon className="size-[17px] shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-text-disabled group-hover:text-text-tertiary">
                    {item.sub}
                  </span>
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-sidebar-border p-4">
          <Badge
            variant="secondary"
            className="gap-2 overflow-visible bg-transparent px-0 py-0 font-mono text-[11px] text-text-secondary"
          >
            <span className="status-dot-live size-2.5 rounded-full" />
            Live · Base Sepolia
          </Badge>
          <p className="mt-2.5 text-[11px] leading-normal text-text-tertiary">
            A settlement-layer compliance demo for tokenized, agent-native
            payments.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 lg:hidden">
          <Link href="/" className="border-0 font-serif text-xl tracking-tight">
            Metal
          </Link>
          <nav className="ml-auto flex items-center gap-4 overflow-x-auto text-xs text-muted-foreground">
            {nav.slice(0, 4).map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap",
                    active ? "font-medium text-foreground" : ""
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>
        {children}
      </div>
    </div>
  )
}
