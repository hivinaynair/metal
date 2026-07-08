import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

export function PageFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={cn(
        "metal-grid min-h-svh min-w-0 overflow-x-clip px-4 py-[26px] sm:px-6 lg:px-[30px] lg:pb-11",
        className
      )}
    >
      <div className="flex w-full flex-col gap-6">{children}</div>
    </main>
  )
}

export function PageHead({
  eyebrow,
  title,
  question,
  right,
}: {
  eyebrow: string
  title: string
  question?: string
  right?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl">
        <p className="metal-eyebrow mb-2.5">{eyebrow}</p>
        {title ? (
          <h1 className="font-serif text-[26px] sm:text-[34px] leading-[1.05] tracking-tight text-foreground">
            {title}
          </h1>
        ) : null}
        {question ? (
          <p className="mt-2.5 max-w-[620px] text-sm leading-normal text-text-tertiary">
            {question}
          </p>
        ) : null}
      </div>
      {right}
    </div>
  )
}
