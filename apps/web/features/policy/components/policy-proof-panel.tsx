"use client"

import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { PolicyProofRun } from "../lib/policy-evaluation"

function ProofStat({
  label,
  children,
  danger,
}: {
  label: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm font-semibold text-foreground",
          danger && "text-negative"
        )}
      >
        {children}
      </span>
    </div>
  )
}

export function PolicyProofPanel({
  proofRun,
}: {
  proofRun: PolicyProofRun | null
}) {
  return (
    <section className="metal-card p-5">
      <div className="flex flex-wrap items-center gap-6">
        <div className="min-w-[260px] flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-positive" />
            <h2 className="text-sm font-semibold">Server-side enforcement</h2>
          </div>
          <p className="mt-2 max-w-[430px] text-sm leading-6 text-muted-foreground">
            The most recent blocked run was refused{" "}
            <b className="text-text-secondary">
              before a settlement transaction existed.
            </b>
          </p>
        </div>
        {proofRun ? (
          <div className="flex flex-wrap items-center gap-7">
            <ProofStat label="Status">
              <Badge variant="destructive">
                <span className="size-1.5 rounded-full bg-current" />
                Blocked
              </Badge>
            </ProofStat>
            <ProofStat label="Failed rule" danger>
              {proofRun.failedRule}
            </ProofStat>
            <ProofStat label="Amount">{proofRun.amount}</ProofStat>
            <ProofStat label="Limit">{proofRun.limit}</ProofStat>
            <ProofStat label="Settlement tx">{proofRun.settlementTx}</ProofStat>
            <Link
              href="/feed"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "border-0"
              )}
            >
              View run
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No blocked attestations recorded yet.
          </p>
        )}
      </div>
    </section>
  )
}
