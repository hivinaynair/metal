import { cn } from "@workspace/ui/lib/utils"

export function PacketPanel({
  amount,
  from,
  mandate,
  policy,
}: {
  amount: string
  from: string
  mandate: string
  policy: string
}) {
  const rows = [
    ["Amount", `${amount.replace("$", "")} USDC`],
    ["From", from],
    ["To", "configured payTo"],
    ["Mandate", mandate],
    ["Policy", policy],
    ["Created", "after run"],
  ]

  return (
    <div className="grid">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-4 py-3 text-sm",
            index < rows.length - 1 && "border-b border-border"
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="text-right font-mono text-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}
